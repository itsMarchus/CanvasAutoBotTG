import type { CommandContext, Context } from "grammy";
import { getCurrentUser } from "../canvas/client.js";
import { getActiveCourses } from "../canvas/courses.js";
import {
    getAllAssignments,
    getUpcomingAssignments,
    getNoDueDateAssignments,
    getPastAssignments,
    getUnsubmittedAssignments,
    getSubmittedAssignments,
    getCourseAssignments,
    findAssignmentById,
} from "../canvas/assignments.js";
import { getLatestAnnouncements } from "../canvas/announcements.js";
import { storage } from "../services/storage.js";
import { askGeminiAgent } from "../ai/agent.js";
import {
    escapeHtml,
    formatHelpMessage,
    formatCourseList,
    formatAssignmentListChunks,
    formatAssignmentDetail,
    formatAnnouncementList,
    formatStatusMessage,
    formatAiResponseChunks,
} from "./formatters.js";
import { buildCoursesKeyboard, buildAssignmentDetailKeyboard } from "./keyboards.js";

/**
 * Safely sends AI markdown/HTML response chunks with plain text fallback if parsing errors occur.
 */
async function replyAiChunksSafe(ctx: Context, response: string): Promise<void> {
    const chunks = formatAiResponseChunks(response);
    for (const chunk of chunks) {
        try {
            await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
        } catch {
            // Graceful fallback to plain text if any edge case tag is rejected by Telegram
            await ctx.reply(chunk, { link_preview_options: { is_disabled: true } });
        }
    }
}

/**
 * /start command handler.
 */
export async function handleStart(ctx: CommandContext<Context>): Promise<void> {
    const chatId = ctx.chat.id;
    const userId = ctx.from?.id;

    // Save chat ID for proactive notifications
    await storage.setTargetChatId(chatId);

    // If no allowed user is pinned yet, pin this user
    const currentAllowed = await storage.getAllowedUserId();
    if (!currentAllowed && userId) {
        await storage.setAllowedUserId(userId);
    }

    let canvasUserGreeting = "";
    try {
        const user = await getCurrentUser();
        canvasUserGreeting = `\n\nConnected to Canvas account: <b>${escapeHtml(user.name)}</b> 🎓`;
    } catch (err) {
        console.warn("Could not fetch Canvas user in /start:", err);
    }

    const welcome = `👋 <b>Hello! Your Canvas Academic Assistant is online and ready!</b> 🚀${canvasUserGreeting}\n\n` +
        `I monitor your Canvas courses and automatically notify you of:\n` +
        `• 🔔 <b>New course announcements</b>\n` +
        `• 📝 <b>New assignments posted</b>\n` +
        `• ⏰ <b>Urgent deadline alerts (1–3 hours before due date)</b>\n\n` +
        `💡 <b>Gemini AI is ready:</b> Send any message directly to chat with your AI Academic Tutor, or use /help to see all commands!`;

    await ctx.reply(welcome, { parse_mode: "HTML" });
}

/**
 * /help command handler.
 */
export async function handleHelp(ctx: CommandContext<Context>): Promise<void> {
    await ctx.reply(formatHelpMessage(), { parse_mode: "HTML" });
}

/**
 * /courses command handler.
 */
export async function handleCourses(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    try {
        const courses = await getActiveCourses();
        const text = formatCourseList(courses);
        await ctx.reply(text, {
            parse_mode: "HTML",
            reply_markup: buildCoursesKeyboard(courses),
        });
    } catch (error) {
        console.error("Error in /courses:", error);
        await ctx.reply("❌ <b>Failed to fetch courses from Canvas.</b> Please check your token or try again later.", {
            parse_mode: "HTML",
        });
    }
}

/**
 * /assignments or /upcoming: Shows active and upcoming tasks.
 */
export async function handleAssignments(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    const arg = ctx.match?.trim();

    try {
        if (arg && !isNaN(Number(arg))) {
            const courseId = Number(arg);
            const rawAssignments = await getCourseAssignments(courseId);
            const cutoff = Date.now() - 12 * 60 * 60 * 1000;
            const upcoming = rawAssignments
                .filter((a) => a.due_at !== null && new Date(a.due_at).getTime() >= cutoff)
                .map((a) => ({ ...a, courseCode: `Course ${courseId}` }));

            const chunks = formatAssignmentListChunks(
                upcoming,
                `Upcoming Tasks for Course ${courseId}`,
                `🎉 <b>No upcoming assignments due for course ${courseId}.</b>`,
                12
            );
            for (const chunk of chunks) {
                await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
            }
            return;
        }

        const assignments = await getUpcomingAssignments();
        const chunks = formatAssignmentListChunks(
            assignments,
            "Active & Upcoming Canvas Assignments",
            "🎉 <b>No upcoming assignments due soon! You are all caught up.</b>",
            12
        );
        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
        }
    } catch (error) {
        console.error("Error in /assignments:", error);
        await ctx.reply("❌ <b>Failed to fetch upcoming assignments from Canvas.</b>", { parse_mode: "HTML" });
    }
}

/**
 * /noduedate or /undated: Shows assignments without explicit due dates.
 */
export async function handleNoDueDate(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    const arg = ctx.match?.trim();

    try {
        if (arg && !isNaN(Number(arg))) {
            const courseId = Number(arg);
            const rawAssignments = await getCourseAssignments(courseId);
            const undated = rawAssignments
                .filter((a) => a.due_at === null)
                .map((a) => ({ ...a, courseCode: `Course ${courseId}` }));

            const chunks = formatAssignmentListChunks(
                undated,
                `Undated Tasks for Course ${courseId}`,
                `ℹ️ <b>No undated assignments found for course ${courseId}.</b>`,
                12
            );
            for (const chunk of chunks) {
                await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
            }
            return;
        }

        const assignments = await getNoDueDateAssignments();
        const chunks = formatAssignmentListChunks(
            assignments,
            "Assignments with No Due Date",
            "ℹ️ <b>No undated assignments found across your courses.</b>",
            12
        );
        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
        }
    } catch (error) {
        console.error("Error in /noduedate:", error);
        await ctx.reply("❌ <b>Failed to fetch undated tasks from Canvas.</b>", { parse_mode: "HTML" });
    }
}

/**
 * /past or /overdue: Shows past assignments whose deadline has elapsed.
 */
export async function handlePast(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    const arg = ctx.match?.trim();

    try {
        if (arg && !isNaN(Number(arg))) {
            const courseId = Number(arg);
            const rawAssignments = await getCourseAssignments(courseId);
            const now = Date.now();
            const past = rawAssignments
                .filter((a) => a.due_at !== null && new Date(a.due_at).getTime() < now)
                .map((a) => ({ ...a, courseCode: `Course ${courseId}` }));

            const chunks = formatAssignmentListChunks(
                past,
                `Past Tasks for Course ${courseId}`,
                `ℹ️ <b>No past assignments found for course ${courseId}.</b>`,
                12
            );
            for (const chunk of chunks) {
                await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
            }
            return;
        }

        const assignments = await getPastAssignments();
        const chunks = formatAssignmentListChunks(
            assignments,
            "Past Assignments Archive",
            "ℹ️ <b>No past assignments found in active courses.</b>",
            12
        );
        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
        }
    } catch (error) {
        console.error("Error in /past:", error);
        await ctx.reply("❌ <b>Failed to fetch past tasks from Canvas.</b>", { parse_mode: "HTML" });
    }
}

/**
 * /allassignments or /all: Master list of ALL assignments (past, present, undated).
 */
export async function handleAllAssignments(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    const arg = ctx.match?.trim();

    try {
        if (arg && !isNaN(Number(arg))) {
            const courseId = Number(arg);
            const rawAssignments = await getCourseAssignments(courseId);
            const assignments = rawAssignments.map((a) => ({ ...a, courseCode: `Course ${courseId}` }));
            const chunks = formatAssignmentListChunks(
                assignments,
                `All Assignments for Course ${courseId}`,
                `🎉 <b>No assignments found for course ${courseId}.</b>`,
                12
            );
            for (const chunk of chunks) {
                await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
            }
            return;
        }

        const assignments = await getAllAssignments();
        const chunks = formatAssignmentListChunks(
            assignments,
            "Master Assignment List (All Courses)",
            "🎉 <b>No assignments found! You are all caught up.</b>",
            12
        );
        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
        }
    } catch (error) {
        console.error("Error in /allassignments:", error);
        await ctx.reply("❌ <b>Failed to fetch all assignments from Canvas.</b>", { parse_mode: "HTML" });
    }
}

/**
 * /assignment or /task <id>: Views full details and instructions for a specific assignment.
 */
export async function handleAssignmentDetail(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    const arg = ctx.match?.trim();

    if (!arg || isNaN(Number(arg))) {
        await ctx.reply("ℹ️ <b>Please specify an assignment ID.</b>\nExample: <code>/assignment 2614</code>", {
            parse_mode: "HTML",
        });
        return;
    }

    const assignmentId = Number(arg);

    try {
        const assignment = await findAssignmentById(assignmentId);

        if (!assignment) {
            await ctx.reply(`❌ <b>Assignment #${assignmentId} not found</b> in your active courses.`, {
                parse_mode: "HTML",
            });
            return;
        }

        const text = formatAssignmentDetail(assignment);
        await ctx.reply(text, {
            parse_mode: "HTML",
            reply_markup: buildAssignmentDetailKeyboard(assignment.html_url, assignment.course_id, assignment.id),
            link_preview_options: { is_disabled: true },
        });
    } catch (error) {
        console.error(`Error in /assignment ${assignmentId}:`, error);
        await ctx.reply("❌ <b>Failed to retrieve assignment details.</b>", { parse_mode: "HTML" });
    }
}

/**
 * /todo or /unsubmitted: Pending unsubmitted tasks.
 */
export async function handleTodo(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    try {
        const pending = await getUnsubmittedAssignments();
        const chunks = formatAssignmentListChunks(
            pending,
            "Pending / Unsubmitted Tasks",
            "🎉 <b>Awesome! You have no pending or unsubmitted assignments.</b>",
            12
        );
        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
        }
    } catch (error) {
        console.error("Error in /todo:", error);
        await ctx.reply("❌ <b>Failed to fetch pending tasks from Canvas.</b>", { parse_mode: "HTML" });
    }
}

/**
 * /completed or /submitted: Graded and submitted tasks.
 */
export async function handleCompleted(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    try {
        const completed = await getSubmittedAssignments();
        const chunks = formatAssignmentListChunks(
            completed,
            "Submitted & Graded Assignments",
            "ℹ️ <b>No submitted assignments recorded in recent courses.</b>",
            12
        );
        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
        }
    } catch (error) {
        console.error("Error in /completed:", error);
        await ctx.reply("❌ <b>Failed to fetch completed tasks from Canvas.</b>", { parse_mode: "HTML" });
    }
}

/**
 * /announcements command handler.
 */
export async function handleAnnouncements(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    const arg = ctx.match?.trim();
    const courseId = arg && !isNaN(Number(arg)) ? [Number(arg)] : undefined;

    try {
        const announcements = await getLatestAnnouncements(courseId, 10);
        const text = formatAnnouncementList(announcements);
        await ctx.reply(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    } catch (error) {
        console.error("Error in /announcements:", error);
        await ctx.reply("❌ <b>Failed to fetch announcements from Canvas.</b>", { parse_mode: "HTML" });
    }
}

/**
 * /status command handler.
 */
export async function handleStatus(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");
    try {
        const [user, state] = await Promise.all([getCurrentUser(), storage.getState()]);
        const text = formatStatusMessage(state, user);
        await ctx.reply(text, { parse_mode: "HTML" });
    } catch (error) {
        console.error("Error in /status:", error);
        await ctx.reply("⚠️ <b>Could not retrieve status. Check connection to Canvas.</b>", { parse_mode: "HTML" });
    }
}

/**
 * /ask <question>: Direct prompt to Gemini with full Canvas context.
 */
export async function handleAsk(ctx: CommandContext<Context>): Promise<void> {
    const question = ctx.match?.trim();
    if (!question) {
        await ctx.reply("ℹ️ <b>Please provide a question for Gemini.</b>\nExample: <code>/ask What assignments are due this week?</code>", {
            parse_mode: "HTML",
        });
        return;
    }

    await ctx.replyWithChatAction("typing");

    try {
        const user = await getCurrentUser().catch(() => undefined);
        const response = await askGeminiAgent(ctx.chat.id, question, user?.name);
        await replyAiChunksSafe(ctx, response);
    } catch (err: any) {
        console.error("Error in /ask:", err);
        await ctx.reply(`❌ <b>AI Error:</b> ${err.message || "Failed to process question."}`, { parse_mode: "HTML" });
    }
}

/**
 * /explain <assignment_id_or_title>: Explains and breaks down an assignment into steps.
 */
export async function handleExplain(ctx: CommandContext<Context>): Promise<void> {
    let target = ctx.match?.trim() || "";
    if (!target) {
        await ctx.reply("ℹ️ <b>Please specify an assignment ID or name.</b>\nExample: <code>/explain 4453</code> or <code>/explain PivotTable</code>", {
            parse_mode: "HTML",
        });
        return;
    }

    // Clean up input variations like "assignment ID 4453", "assignment 4453", "ID 4453", "#4453"
    const cleaned = target.replace(/^(?:assignment\s*id\s*|assignment\s*|id\s*|#\s*)/i, "").trim();
    if (cleaned) {
        target = cleaned;
    }

    await ctx.replyWithChatAction("typing");

    try {
        const prompt = `Please fetch the details and instructions for assignment "${target}". ` +
            `Explain the task clearly, summarize what the professor expects, break down the requirements into an actionable step-by-step checklist, and give tips on how to score full points.`;

        const user = await getCurrentUser().catch(() => undefined);
        const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
        await replyAiChunksSafe(ctx, response);
    } catch (err: any) {
        console.error("Error in /explain:", err);
        await ctx.reply(`❌ <b>AI Error:</b> ${err.message || "Failed to explain assignment."}`, { parse_mode: "HTML" });
    }
}

/**
 * /answer <assignment_id_or_title>: Generates comprehensive answers/solutions for an assignment.
 */
export async function handleAnswer(ctx: CommandContext<Context>): Promise<void> {
    let target = ctx.match?.trim() || "";
    if (!target) {
        await ctx.reply("ℹ️ <b>Please specify an assignment ID or name.</b>\nExample: <code>/answer 4453</code> or <code>/answer Activity 6</code>", {
            parse_mode: "HTML",
        });
        return;
    }

    // Clean up input variations
    const cleaned = target.replace(/^(?:assignment\s*id\s*|assignment\s*|id\s*|#\s*)/i, "").trim();
    if (cleaned) {
        target = cleaned;
    }

    await ctx.replyWithChatAction("typing");

    try {
        const prompt = `Please fetch the details and full instructions for assignment "${target}". ` +
            `First, validate whether the questions and tasks are written directly in the description text or located inside an attached file: ` +
            `- If the questions/tasks are written in the description, provide a complete, comprehensive, and accurate draft solution and answers with step-by-step logic, code, formulas, and explanations. ` +
            `- If the assignment only contains an attached file link without the actual questions in text, state that the questions are inside the attached document, and invite the student to copy & paste the questions here to solve them. ` +
            `- If both text and files are present, analyze if it is answerable from the text, solve what is possible, and request the missing questions if needed.`;

        const user = await getCurrentUser().catch(() => undefined);
        const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
        await replyAiChunksSafe(ctx, response);
    } catch (err: any) {
        console.error("Error in /answer:", err);
        await ctx.reply(`❌ <b>AI Error:</b> ${err.message || "Failed to generate solution."}`, { parse_mode: "HTML" });
    }
}

/**
 * /studyplan: Generates a prioritized study schedule based on real active deadlines.
 */
export async function handleStudyPlan(ctx: CommandContext<Context>): Promise<void> {
    await ctx.replyWithChatAction("typing");

    try {
        const prompt = `Look up all my active and upcoming assignments across my Canvas courses. ` +
            `Create a realistic, prioritized 7-day study timetable and action plan based on the deadlines and task complexities. ` +
            `Include tips for managing workload effectively.`;

        const user = await getCurrentUser().catch(() => undefined);
        const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
        await replyAiChunksSafe(ctx, response);
    } catch (err: any) {
        console.error("Error in /studyplan:", err);
        await ctx.reply(`❌ <b>AI Error:</b> ${err.message || "Failed to generate study plan."}`, { parse_mode: "HTML" });
    }
}

/**
 * /clear or /reset: Clears conversational memory.
 */
export async function handleClearChat(ctx: CommandContext<Context>): Promise<void> {
    await storage.clearChatHistory(ctx.chat.id);
    await ctx.reply("🧹 <b>Conversation memory cleared!</b> You can now start a fresh conversation with Gemini.", {
        parse_mode: "HTML",
    });
}

/**
 * Natural Free-Form Chat Handler (all non-command text messages).
 */
export async function handleFreeFormChat(ctx: Context): Promise<void> {
    const text = ctx.message?.text?.trim();
    if (!text || text.startsWith("/") || !ctx.chat) return;

    await ctx.replyWithChatAction("typing");

    try {
        const user = await getCurrentUser().catch(() => undefined);
        const response = await askGeminiAgent(ctx.chat.id, text, user?.name);
        await replyAiChunksSafe(ctx, response);
    } catch (err: any) {
        console.error("Error in handleFreeFormChat:", err);
        await ctx.reply(`❌ <b>AI Error:</b> ${err.message || "Failed to process message."}`, { parse_mode: "HTML" });
    }
}
