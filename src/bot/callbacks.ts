import type { Context } from "grammy";
import { getCurrentUser } from "../canvas/client.js";
import { getActiveCourses, getCourseById } from "../canvas/courses.js";
import { getCourseAssignments, getAssignmentDetails } from "../canvas/assignments.js";
import { getLatestAnnouncements, getAnnouncementDetails } from "../canvas/announcements.js";
import { getCourseDiscussions, getDiscussionDetails } from "../canvas/discussions.js";
import { getCourseModules } from "../canvas/modules.js";
import { getCourseFiles, getCanvasFileMetadata } from "../canvas/files.js";
import { askGeminiAgent } from "../ai/agent.js";
import {
    escapeHtml,
    formatAssignmentList,
    formatAssignmentDetail,
    formatAnnouncementList,
    formatAnnouncementDetail,
    formatDiscussionList,
    formatDiscussionDetail,
    formatCourseList,
    formatModuleList,
    formatModuleDetail,
    formatCourseFileList,
    formatFileDetail,
    formatAiResponseChunks,
} from "./formatters.js";
import {
    buildCoursesKeyboard,
    buildCourseActionKeyboard,
    buildAssignmentSelectionKeyboard,
    buildAssignmentDetailKeyboard,
    buildAnnouncementSelectionKeyboard,
    buildAnnouncementDetailKeyboard,
    buildDiscussionSelectionKeyboard,
    buildDiscussionDetailKeyboard,
    buildModulesKeyboard,
    buildCourseFilesKeyboard,
    buildFileDetailKeyboard,
    buildBackToCoursesKeyboard,
} from "./keyboards.js";


/**
 * Handles callback queries from inline keyboards.
 */
export async function handleCallbackQuery(ctx: Context): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    try {
        // 1. Back to courses or Refresh courses
        if (data === "back_courses" || data === "refresh_courses") {
            await ctx.answerCallbackQuery({ text: "Loading courses..." });
            const courses = await getActiveCourses();
            await ctx.editMessageText(formatCourseList(courses), {
                parse_mode: "HTML",
                reply_markup: buildCoursesKeyboard(courses),
            });
            return;
        }

        // 2. Select a course -> show action options
        if (data.startsWith("course:")) {
            const courseId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(courseId)) return;

            await ctx.answerCallbackQuery();
            const course = await getCourseById(courseId);
            if (!course) {
                await ctx.reply("❌ Course not found.");
                return;
            }

            const term = course.term?.name ? `\n🗓️ <i>${escapeHtml(course.term.name)}</i>` : "";
            const text = `📖 <b>${escapeHtml(course.name)}</b>${term}\n\n` +
                `• Course ID: <code>${course.id}</code>\n` +
                (course.course_code ? `• Code: <code>${escapeHtml(course.course_code)}</code>\n` : "") +
                `\nWhat would you like to view for this course?`;

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: buildCourseActionKeyboard(courseId),
            });
            return;
        }

        // 3. View upcoming assignments for a specific course
        if (data.startsWith("course_upcoming:")) {
            const courseId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(courseId)) return;

            await ctx.answerCallbackQuery({ text: "Fetching upcoming tasks..." });
            const [course, rawAssignments] = await Promise.all([
                getCourseById(courseId),
                getCourseAssignments(courseId),
            ]);

            const cutoff = Date.now() - 12 * 60 * 60 * 1000;
            const upcoming = rawAssignments
                .filter((a) => a.due_at !== null && new Date(a.due_at).getTime() >= cutoff)
                .map((a) => ({
                    ...a,
                    courseName: course?.name,
                    courseCode: course?.course_code || course?.name,
                }));

            const courseTitle = course ? course.name : `Course ${courseId}`;
            const text = formatAssignmentList(
                upcoming,
                `Upcoming Tasks for ${escapeHtml(courseTitle)}`,
                `🎉 <b>No upcoming assignments due for ${escapeHtml(courseTitle)}.</b>`
            );

            const keyboard = upcoming.length > 0
                ? buildAssignmentSelectionKeyboard(upcoming, courseId)
                : buildBackToCoursesKeyboard();

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 4. View pending / todo assignments for a specific course
        if (data.startsWith("course_todo:")) {
            const courseId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(courseId)) return;

            await ctx.answerCallbackQuery({ text: "Fetching pending tasks..." });
            const [course, rawAssignments] = await Promise.all([
                getCourseById(courseId),
                getCourseAssignments(courseId),
            ]);

            const pending = rawAssignments
                .filter((a) => {
                    if (a.has_submitted_submissions) return false;
                    if (a.submission?.workflow_state === "submitted" || a.submission?.workflow_state === "graded") return false;
                    return true;
                })
                .map((a) => ({
                    ...a,
                    courseName: course?.name,
                    courseCode: course?.course_code || course?.name,
                }));

            const courseTitle = course ? course.name : `Course ${courseId}`;
            const text = formatAssignmentList(
                pending,
                `Pending Tasks for ${escapeHtml(courseTitle)}`,
                `🎉 <b>No pending assignments for ${escapeHtml(courseTitle)}. You're caught up!</b>`
            );

            const keyboard = pending.length > 0
                ? buildAssignmentSelectionKeyboard(pending, courseId)
                : buildBackToCoursesKeyboard();

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 5. View ALL assignments for a specific course
        if (data.startsWith("course_all:") || data.startsWith("course_assign:")) {
            const courseId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(courseId)) return;

            await ctx.answerCallbackQuery({ text: "Fetching all assignments..." });
            const [course, rawAssignments] = await Promise.all([
                getCourseById(courseId),
                getCourseAssignments(courseId),
            ]);

            const assignments = rawAssignments.map((a) => ({
                ...a,
                courseName: course?.name,
                courseCode: course?.course_code || course?.name,
            }));

            const courseTitle = course ? course.name : `Course ${courseId}`;
            const text = formatAssignmentList(
                assignments,
                `All Assignments for ${escapeHtml(courseTitle)}`,
                `🎉 <b>No assignments found for ${escapeHtml(courseTitle)}.</b>`
            );

            const keyboard = assignments.length > 0
                ? buildAssignmentSelectionKeyboard(assignments, courseId)
                : buildBackToCoursesKeyboard();

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 6. View specific assignment details & description
        if (data.startsWith("assign_view:")) {
            const parts = data.split(":");
            const courseId = parseInt(parts[1] || "", 10);
            const assignmentId = parseInt(parts[2] || "", 10);

            if (isNaN(courseId) || isNaN(assignmentId)) return;

            await ctx.answerCallbackQuery({ text: "Loading assignment details..." });
            const assignment = await getAssignmentDetails(courseId, assignmentId);

            if (!assignment) {
                await ctx.reply("❌ <b>Assignment details not found.</b>", { parse_mode: "HTML" });
                return;
            }

            const text = formatAssignmentDetail(assignment);
            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: buildAssignmentDetailKeyboard(assignment.html_url, courseId, assignment.id),
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 7. AI Explain Assignment Callback Button
        if (data.startsWith("ai_explain:")) {
            const assignmentId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(assignmentId)) return;

            await ctx.answerCallbackQuery({ text: "🧠 Gemini is analyzing instructions..." });
            if (!ctx.chat) return;

            await ctx.replyWithChatAction("typing");

            const prompt = `Please fetch the details and instructions for assignment ID ${assignmentId}. ` +
                `Explain the task clearly, summarize what the professor expects, break down the requirements into an actionable step-by-step checklist, and give tips on how to score full points.`;

            const user = await getCurrentUser().catch(() => undefined);
            const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
            const chunks = formatAiResponseChunks(response);

            for (const chunk of chunks) {
                try {
                    await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
                } catch {
                    // Fallback to plain text if any edge case tag fails
                    await ctx.reply(chunk, { link_preview_options: { is_disabled: true } });
                }
            }
            return;
        }

        // 8. AI Generate Answer / Solution Callback Button
        if (data.startsWith("ai_answer:")) {
            const assignmentId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(assignmentId)) return;

            await ctx.answerCallbackQuery({ text: "💡 Gemini is generating comprehensive solution..." });
            if (!ctx.chat) return;

            await ctx.replyWithChatAction("typing");

            const prompt = `Please fetch the details and full instructions for assignment ID ${assignmentId}. ` +
                `First, validate whether the questions and tasks are written directly in the description text or located inside an attached file: ` +
                `- If the questions/tasks are written in the description, provide a complete, comprehensive, and accurate draft solution and answers with step-by-step logic, code, formulas, and explanations. ` +
                `- If the assignment only contains an attached file link without the actual questions in text, state that the questions are inside the attached document, and invite the student to copy & paste the questions here to solve them. ` +
                `- If both text and files are present, analyze if it is answerable from the text, solve what is possible, and request the missing questions if needed.`;

            const user = await getCurrentUser().catch(() => undefined);
            const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
            const chunks = formatAiResponseChunks(response);

            for (const chunk of chunks) {
                try {
                    await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
                } catch {
                    await ctx.reply(chunk, { link_preview_options: { is_disabled: true } });
                }
            }
            return;
        }

        // 8. View announcements for a specific course
        if (data.startsWith("course_announce:")) {
            const courseId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(courseId)) return;

            await ctx.answerCallbackQuery({ text: "Fetching announcements..." });
            const announcements = await getLatestAnnouncements([courseId], 8);
            const text = formatAnnouncementList(announcements);
            const keyboard = announcements.length > 0
                ? buildAnnouncementSelectionKeyboard(announcements, courseId)
                : buildBackToCoursesKeyboard();

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 9. View discussions for a specific course
        if (data.startsWith("course_disc:")) {
            const courseId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(courseId)) return;

            await ctx.answerCallbackQuery({ text: "Fetching discussion topics..." });
            const [course, discussions] = await Promise.all([
                getCourseById(courseId),
                getCourseDiscussions(courseId, 15),
            ]);

            const enriched = discussions.map((d) => ({
                ...d,
                courseName: course?.name,
                courseCode: course?.course_code || course?.name,
            }));

            const text = formatDiscussionList(enriched);
            const keyboard = enriched.length > 0
                ? buildDiscussionSelectionKeyboard(enriched, courseId)
                : buildBackToCoursesKeyboard();

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 10. View specific discussion topic details
        if (data.startsWith("disc_view:")) {
            const parts = data.split(":");
            const courseId = parseInt(parts[1] || "", 10);
            const topicId = parseInt(parts[2] || "", 10);

            if (isNaN(topicId)) return;

            await ctx.answerCallbackQuery({ text: "Loading discussion prompt..." });
            const topic = await getDiscussionDetails(courseId, topicId);

            if (!topic) {
                await ctx.reply("❌ <b>Discussion topic details not found.</b>", { parse_mode: "HTML" });
                return;
            }

            const text = formatDiscussionDetail(topic);
            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: buildDiscussionDetailKeyboard(topic.html_url || topic.url, courseId, topic.id),
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 11. AI Explain Discussion Topic Prompt
        if (data.startsWith("ai_explain_disc:")) {
            const parts = data.split(":");
            const courseId = parseInt(parts[1] || "", 10);
            const topicId = parseInt(parts[2] || "", 10);

            if (isNaN(topicId)) return;

            await ctx.answerCallbackQuery({ text: "🧠 Gemini is analyzing discussion prompt..." });
            if (!ctx.chat) return;

            await ctx.replyWithChatAction("typing");

            const prompt = `Please fetch the details and prompt for discussion topic ID ${topicId} in course ID ${courseId}. ` +
                `Explain the discussion activity clearly, summarize what the professor or prompt is asking for, list all required points to address, and provide guidelines on how to craft a high-scoring post or peer response.`;

            const user = await getCurrentUser().catch(() => undefined);
            const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
            const chunks = formatAiResponseChunks(response);

            for (const chunk of chunks) {
                try {
                    await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
                } catch {
                    await ctx.reply(chunk, { link_preview_options: { is_disabled: true } });
                }
            }
            return;
        }

        // 12. AI Draft Answer / Solution for Discussion Activity
        if (data.startsWith("ai_answer_disc:")) {
            const parts = data.split(":");
            const courseId = parseInt(parts[1] || "", 10);
            const topicId = parseInt(parts[2] || "", 10);

            if (isNaN(topicId)) return;

            await ctx.answerCallbackQuery({ text: "💡 Gemini is generating response..." });
            if (!ctx.chat) return;

            await ctx.replyWithChatAction("typing");

            const prompt = `Please fetch the full details and prompt for discussion topic ID ${topicId} in course ID ${courseId}. ` +
                `First, determine if this discussion is an exercise/activity with specific questions or an open discussion forum: ` +
                `- If it contains exercises, questions, or problems to solve (e.g. PivotTables, queries, code, math), provide the full step-by-step solutions, explanations, and answers! ` +
                `- If it only references an attached document without text questions, notify the student and ask them to paste questions from the file. ` +
                `- If it is an open discussion or reflection question, draft a thoughtful, articulate, and well-structured response following academic best practices.`;

            const user = await getCurrentUser().catch(() => undefined);
            const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
            const chunks = formatAiResponseChunks(response);

            for (const chunk of chunks) {
                try {
                    await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
                } catch {
                    await ctx.reply(chunk, { link_preview_options: { is_disabled: true } });
                }
            }
            return;
        }

        // 13. Back to / Refresh Announcements list
        if (data === "refresh_announcements") {
            await ctx.answerCallbackQuery({ text: "Loading announcements..." });
            const announcements = await getLatestAnnouncements(undefined, 10);
            const text = formatAnnouncementList(announcements);
            const keyboard = announcements.length > 0
                ? buildAnnouncementSelectionKeyboard(announcements)
                : buildBackToCoursesKeyboard();

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 14. View specific announcement full details
        if (data.startsWith("announce_view:")) {
            const parts = data.split(":");
            const courseId = parseInt(parts[1] || "", 10);
            const announcementId = parseInt(parts[2] || "", 10);

            if (isNaN(announcementId)) return;

            await ctx.answerCallbackQuery({ text: "Loading announcement content..." });
            const announcement = await getAnnouncementDetails(courseId, announcementId);

            if (!announcement) {
                await ctx.reply("❌ <b>Announcement details not found.</b>", { parse_mode: "HTML" });
                return;
            }

            const text = formatAnnouncementDetail(announcement);
            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: buildAnnouncementDetailKeyboard(announcement.html_url || announcement.url, courseId, announcement.id),
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 15. AI Summarize / Explain Announcement
        if (data.startsWith("ai_explain_announce:")) {
            const parts = data.split(":");
            const courseId = parseInt(parts[1] || "", 10);
            const announcementId = parseInt(parts[2] || "", 10);

            if (isNaN(announcementId)) return;

            await ctx.answerCallbackQuery({ text: "🧠 Gemini is analyzing announcement..." });
            if (!ctx.chat) return;

            await ctx.replyWithChatAction("typing");

            const prompt = `Please fetch the details for announcement ID ${announcementId} in course ID ${courseId}. ` +
                `Summarize this announcement clearly for the student, highlight any critical dates, deadlines, room numbers, Zoom links, exam instructions, schedule changes, or required student action items.`;

            const user = await getCurrentUser().catch(() => undefined);
            const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
            const chunks = formatAiResponseChunks(response);

            for (const chunk of chunks) {
                try {
                    await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
                } catch {
                    await ctx.reply(chunk, { link_preview_options: { is_disabled: true } });
                }
            }
            return;
        }

        // 16. View course weekly modules
        if (data.startsWith("course_modules:")) {
            const courseId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(courseId)) return;

            await ctx.answerCallbackQuery({ text: "Fetching course modules..." });
            const [course, modules] = await Promise.all([
                getCourseById(courseId),
                getCourseModules(courseId),
            ]);

            const courseName = course ? course.name : `Course #${courseId}`;
            const text = formatModuleList(modules, courseName);
            const keyboard = modules.length > 0
                ? buildModulesKeyboard(modules, courseId)
                : buildCourseActionKeyboard(courseId);

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 17. View specific module items
        if (data.startsWith("module_view:")) {
            const parts = data.split(":");
            const courseId = parseInt(parts[1] || "", 10);
            const moduleId = parseInt(parts[2] || "", 10);

            if (isNaN(moduleId)) return;

            await ctx.answerCallbackQuery({ text: "Loading module details..." });
            const [course, modules] = await Promise.all([
                getCourseById(courseId),
                getCourseModules(courseId),
            ]);

            const module = modules.find((m) => m.id === moduleId);
            if (!module) {
                await ctx.reply("❌ <b>Module not found.</b>", { parse_mode: "HTML" });
                return;
            }

            const courseName = course ? course.name : `Course #${courseId}`;
            const text = formatModuleDetail(module, courseName);

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: buildModulesKeyboard(modules, courseId),
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 18. View course files repository & slide decks
        if (data.startsWith("course_files:")) {
            const courseId = parseInt(data.split(":")[1] || "", 10);
            if (isNaN(courseId)) return;

            await ctx.answerCallbackQuery({ text: "Fetching course files..." });
            const [course, files] = await Promise.all([
                getCourseById(courseId),
                getCourseFiles(courseId, undefined, 20),
            ]);

            const courseName = course ? course.name : `Course #${courseId}`;
            const text = formatCourseFileList(files, courseName);
            const keyboard = files.length > 0
                ? buildCourseFilesKeyboard(files, courseId)
                : buildCourseActionKeyboard(courseId);

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 19. View specific file details
        if (data.startsWith("file_view:")) {
            const parts = data.split(":");
            const courseId = parseInt(parts[1] || "", 10);
            const fileId = parseInt(parts[2] || "", 10);

            if (isNaN(fileId)) return;

            await ctx.answerCallbackQuery({ text: "Loading file metadata..." });
            const [course, file] = await Promise.all([
                getCourseById(courseId),
                getCanvasFileMetadata(fileId),
            ]);

            if (!file) {
                await ctx.reply("❌ <b>File not found on Canvas.</b>", { parse_mode: "HTML" });
                return;
            }

            const courseName = course ? course.name : `Course #${courseId}`;
            const text = formatFileDetail(file, courseName);

            await ctx.editMessageText(text, {
                parse_mode: "HTML",
                reply_markup: buildFileDetailKeyboard(file, courseId),
                link_preview_options: { is_disabled: true },
            });
            return;
        }

        // 20. AI Summarize / Explain Course File or Slide Deck
        if (data.startsWith("ai_explain_file:")) {
            const parts = data.split(":");
            const courseId = parseInt(parts[1] || "", 10);
            const fileId = parseInt(parts[2] || "", 10);

            if (isNaN(fileId)) return;

            await ctx.answerCallbackQuery({ text: "🧠 Gemini is reading document..." });
            if (!ctx.chat) return;

            await ctx.replyWithChatAction("typing");

            const prompt = `Please download and read the course document with file ID ${fileId} in course ID ${courseId}. ` +
                `Provide a comprehensive academic breakdown, outline key concepts covered, explain formulas/theories/diagrams, and summarize main takeaways for the student.`;

            const user = await getCurrentUser().catch(() => undefined);
            const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
            const chunks = formatAiResponseChunks(response);

            for (const chunk of chunks) {
                try {
                    await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
                } catch {
                    await ctx.reply(chunk, { link_preview_options: { is_disabled: true } });
                }
            }
            return;
        }

        await ctx.answerCallbackQuery();
    } catch (error) {
        console.error("Callback query error:", error);
        await ctx.answerCallbackQuery({ text: "⚠️ Error processing request." });
    }
}

