import { env } from "../config/env.js";
import type { CanvasCourse, CanvasUser, CanvasModule, CanvasFile } from "../canvas/types.js";
import type { EnrichedAssignment } from "../canvas/assignments.js";
import type { EnrichedAnnouncement } from "../canvas/announcements.js";
import type { EnrichedDiscussionTopic } from "../canvas/discussions.js";
import type { BotState } from "../services/storage.js";


import TurndownService from "turndown";

/**
 * Shared Turndown instance configured for Canvas LMS HTML parsing.
 */
export const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
});

// Disable Turndown's aggressive backslash escaping (which generates 1\., \[\], \_\_\_)
turndown.escape = (str: string) => str;

// Strip script, style, and head tags completely
turndown.remove(["script", "style", "head"]);

// Custom rule to preserve clean clickable markdown links
turndown.addRule("cleanCanvasLinks", {
    filter: "a",
    replacement: (content, node) => {
        const href = (node as HTMLElement).getAttribute("href");
        if (!href) return content;
        return `[${content.trim() || "Link"}](${href})`;
    },
});

/**
 * Escapes HTML characters for Telegram HTML parse mode.
 */
export function escapeHtml(text: string = ""): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Converts rich Canvas HTML instructions into beautifully formatted, valid Telegram HTML.
 * Uses Turndown to convert DOM/HTML into clean Markdown, then converts to safe Telegram HTML.
 */
export function formatInstructionsToTelegramHtml(html: string = "", maxLength = 2200): string {
    if (!html || !html.trim()) return "<i>No written instructions provided for this assignment.</i>";

    let md = turndown.turndown(html);

    if (md.length > maxLength) {
        md = md.slice(0, maxLength).trim() + "\n\n_... [Instructions truncated. Tap button below to view full on Canvas]_";
    }

    return markdownToTelegramHtml(md);
}

/**
 * Strips HTML tags and produces a clean single-line or short text preview snippet.
 */
export function cleanHtmlSnippet(html: string = "", maxLength = 220): string {
    if (!html || !html.trim()) return "";
    let md = turndown.turndown(html);
    let cleaned = md.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.slice(0, maxLength).trim() + "...";
}

/**
 * Formats an ISO date into a localized, human-friendly string with relative time.
 */
export function formatDueDate(dateString: string | null): string {
    if (!dateString) {
        return "<i>No due date</i>";
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const formatted = date.toLocaleString("en-US", {
        timeZone: env.TIMEZONE,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

    let relative = "";
    if (diffMs < 0) {
        const pastHours = Math.abs(diffHours);
        if (pastHours < 24) {
            relative = ` (⚠️ <b>Past due ${Math.round(pastHours)}h ago</b>)`;
        } else {
            const days = Math.round(pastHours / 24);
            relative = ` (⚠️ <b>Past due ${days}d ago</b>)`;
        }
    } else if (diffHours < 1) {
        const mins = Math.max(1, Math.round(diffMs / (1000 * 60)));
        relative = ` (🚨 <b>Due in ${mins} mins!</b>)`;
    } else if (diffHours <= 24) {
        relative = ` (⏳ <b>Due in ${Math.round(diffHours)} hours</b>)`;
    } else {
        const days = Math.round(diffHours / 24);
        relative = ` (📅 In ${days} days)`;
    }

    return `<b>${formatted}</b>${relative}`;
}

/**
 * Formats welcome / help message.
 */
export function formatHelpMessage(): string {
    return `📚 <b>Canvas Academic Assistant</b>

Here are the commands and features you can use:

🤖 <b>Gemini AI Academic Assistant</b>
• 💬 <i>Send any message directly to chat with Gemini!</i>
• /ask &lt;question&gt; — Ask anything (tutoring, conceptual questions, Canvas queries)
• /explain &lt;id&gt; — Step-by-step breakdown of an assignment's instructions
• /answer &lt;id&gt; — Generate comprehensive answers & solutions for an assignment
• /studyplan — Generate a personalized study schedule based on upcoming deadlines
• /clear — Reset conversation memory

🎯 <b>Assignments & Tasks</b>
• /assignments or /upcoming — View active & upcoming assignments
• /todo or /unsubmitted — View pending assignments needing action
• /noduedate or /undated — View assignments without explicit deadlines
• /completed or /submitted — View submitted & graded work with scores
• /past or /overdue — View past assignments whose due date has passed
• /allassignments or /all — View full master list of all assignments
• /assignment &lt;id&gt; — View full details & instructions for a specific task

📖 <b>Courses & Materials</b>
• /courses — List active courses with interactive action buttons
• /modules [courseId] — View weekly learning units, lesson pages & files
• /files [courseId] — Browse downloadable files & lecture slide decks
• /announcements — View latest course announcements with interactive selection buttons
• /announcement &lt;id&gt; — View full content & instructions for an announcement
• /discussions or /forums — View course discussion topics & activities
• /discussion &lt;id&gt; — View full prompt & instructions for a discussion topic

⚙️ <b>Bot & System</b>
• /status — View bot health & sync timestamp
• /help — Show this help menu

<i>💡 Tip: You will automatically receive push notifications for new announcements, newly posted assignments, new discussion activities, and deadline countdown reminders!</i>`;
}

/**
 * Formats the course list view.
 */
export function formatCourseList(courses: CanvasCourse[]): string {
    if (courses.length === 0) {
        return "ℹ️ <b>No active courses found on Canvas.</b>";
    }

    let text = `📚 <b>Active Canvas Courses (${courses.length})</b>\n\n`;
    courses.forEach((c, index) => {
        const code = c.course_code ? `<code>${escapeHtml(c.course_code)}</code> ` : "";
        text += `${index + 1}. ${code}<b>${escapeHtml(c.name)}</b>\n`;
        text += `   └ ID: <code>${c.id}</code>\n\n`;
    });

    text += `<i>Tap a course button below to view its assignments or announcements.</i>`;
    return text;
}

/**
 * Formats a list of assignments into chunks that never exceed Telegram's 4096 character limit.
 */
export function formatAssignmentListChunks(
    assignments: EnrichedAssignment[],
    title: string = "Assignments",
    emptyMessage: string = "🎉 <b>No assignments found! You're all caught up.</b>",
    chunkSize: number = 10
): string[] {
    if (assignments.length === 0) {
        return [emptyMessage];
    }

    const chunks: string[] = [];
    const total = assignments.length;
    const totalChunks = Math.ceil(total / chunkSize);

    for (let i = 0; i < total; i += chunkSize) {
        const chunkAssignments = assignments.slice(i, i + chunkSize);
        const chunkIndex = Math.floor(i / chunkSize) + 1;
        const pageHeader = totalChunks > 1 ? ` (Part ${chunkIndex}/${totalChunks})` : "";
        let text = `📋 <b>${title}${pageHeader} [${total}]</b>\n\n`;

        chunkAssignments.forEach((a, index) => {
            const globalIndex = i + index + 1;
            const course = a.courseCode ? `[${escapeHtml(a.courseCode)}] ` : "";
            const points =
                a.points_possible !== null && a.points_possible !== undefined
                    ? ` • <i>${a.points_possible} pts</i>`
                    : "";
            const status =
                a.submission?.workflow_state === "submitted" || a.submission?.submitted_at
                    ? "✅ <b>Submitted</b>"
                    : a.submission?.workflow_state === "graded"
                        ? `🎯 <b>Score: ${a.submission.score ?? a.submission.grade ?? "Graded"}</b>`
                        : "⏳ <b>Pending</b>";

            text += `${globalIndex}. ${course}<a href="${a.html_url}"><b>${escapeHtml(a.name)}</b></a>${points}\n`;
            text += `   • Status: ${status}\n`;
            text += `   • Due: ${formatDueDate(a.due_at)}\n\n`;
        });

        chunks.push(text);
    }

    return chunks;
}

/**
 * Formats a list of assignments into a single string (for small lists or preview).
 */
export function formatAssignmentList(
    assignments: EnrichedAssignment[],
    title: string = "Assignments",
    emptyMessage: string = "🎉 <b>No assignments found! You're all caught up.</b>"
): string {
    const chunks = formatAssignmentListChunks(assignments, title, emptyMessage, 15);
    return chunks[0] || emptyMessage;
}

/**
 * Formats a list of announcements.
 */
export function formatAnnouncementList(announcements: EnrichedAnnouncement[]): string {
    if (announcements.length === 0) {
        return "📢 <b>No recent announcements found across your courses.</b>";
    }

    let text = `📢 <b>Recent Canvas Announcements (${announcements.length})</b>\n\n`;

    announcements.forEach((item, index) => {
        const course = item.courseName ? `<b>[${escapeHtml(item.courseName)}]</b>\n` : "";
        const date = new Date(item.posted_at || item.created_at).toLocaleString("en-US", {
            timeZone: env.TIMEZONE,
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
        const author = item.author?.display_name ? ` by <i>${escapeHtml(item.author.display_name)}</i>` : "";
        const preview = cleanHtmlSnippet(item.message, 180);

        text += `${index + 1}. ${course}<a href="${item.html_url || item.url}"><b>${escapeHtml(item.title)}</b></a>\n`;
        text += `   📅 ${date}${author}\n`;
        if (preview) {
            text += `   <i>"${escapeHtml(preview)}"</i>\n`;
        }
        text += `\n`;
    });

    return text;
}

/**
 * Formats full detailed card for a single announcement, preserving complete text.
 */
export function formatAnnouncementDetail(announcement: EnrichedAnnouncement): string {
    const course = announcement.courseName
        ? `📚 <b>Course:</b> ${escapeHtml(announcement.courseName)}\n`
        : "";
    const author = announcement.author?.display_name
        ? `👤 <b>Author:</b> ${escapeHtml(announcement.author.display_name)}\n`
        : "";

    const postedTime = announcement.posted_at || announcement.created_at
        ? new Date(announcement.posted_at || announcement.created_at).toLocaleString("en-US", {
            timeZone: env.TIMEZONE,
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        })
        : "Unknown";

    const contentText = formatInstructionsToTelegramHtml(announcement.message || "", 3500);

    return `📢 <b>${escapeHtml(announcement.title)}</b>\n` +
        `${course}` +
        `${author}` +
        `📅 <b>Posted:</b> ${postedTime}\n\n` +
        `📖 <b>Content:</b>\n` +
        `${contentText}\n\n` +
        `🆔 Announcement ID: <code>${announcement.id}</code>`;
}

/**
 * Notification for a newly discovered announcement.
 */
export function formatNewAnnouncementNotification(announcement: EnrichedAnnouncement): string {
    const course = announcement.courseName ? `<b>Course:</b> ${escapeHtml(announcement.courseName)}\n` : "";
    const author = announcement.author?.display_name ? `<b>Author:</b> ${escapeHtml(announcement.author.display_name)}\n` : "";
    const snippet = cleanHtmlSnippet(announcement.message, 280);

    return `🔔 <b>NEW CANVAS ANNOUNCEMENT</b>\n\n` +
        `${course}` +
        `<b>Title:</b> <a href="${announcement.html_url || announcement.url}">${escapeHtml(announcement.title)}</a>\n` +
        `${author}\n` +
        `<i>"${escapeHtml(snippet)}"</i>\n\n` +
        `<a href="${announcement.html_url || announcement.url}">👉 Open Announcement in Canvas</a>`;
}

/**
 * Notification for a newly created assignment.
 */
export function formatNewAssignmentNotification(assignment: EnrichedAssignment): string {
    const course = assignment.courseName ? `<b>Course:</b> ${escapeHtml(assignment.courseName)}\n` : "";
    const points = assignment.points_possible !== null && assignment.points_possible !== undefined ? `<b>Points:</b> ${assignment.points_possible}\n` : "";

    return `📝 <b>NEW ASSIGNMENT POSTED</b>\n\n` +
        `${course}` +
        `<b>Assignment:</b> <a href="${assignment.html_url}">${escapeHtml(assignment.name)}</a>\n` +
        `${points}` +
        `<b>Due Date:</b> ${formatDueDate(assignment.due_at)}\n\n` +
        `<a href="${assignment.html_url}">👉 View Assignment in Canvas</a>`;
}

/**
 * Notification for a newly created Discussion Topic / Forum Activity.
 */
export function formatNewDiscussionNotification(discussion: EnrichedDiscussionTopic): string {
    const course = discussion.courseName ? `<b>Course:</b> ${escapeHtml(discussion.courseName)}\n` : "";
    const author = discussion.author?.display_name || discussion.user_name ? `<b>Author:</b> ${escapeHtml(discussion.author?.display_name || discussion.user_name || "")}\n` : "";
    const snippet = cleanHtmlSnippet(discussion.message || "", 280);
    const initialPostNote = discussion.require_initial_post ? `\n🔒 <i>Requires initial post before replies are visible.</i>` : "";

    return `💬 <b>NEW DISCUSSION / FORUM ACTIVITY</b>\n\n` +
        `${course}` +
        `<b>Topic:</b> <a href="${discussion.html_url || discussion.url}">${escapeHtml(discussion.title)}</a>\n` +
        `${author}` +
        `<i>"${escapeHtml(snippet)}"</i>` +
        `${initialPostNote}\n\n` +
        `<a href="${discussion.html_url || discussion.url}">👉 Open Discussion in Canvas</a>`;
}

/**
 * Formats full detailed card for a single discussion topic, including instructions.
 */
export function formatDiscussionDetail(discussion: EnrichedDiscussionTopic): string {
    const course = discussion.courseName
        ? `📚 <b>Course:</b> ${escapeHtml(discussion.courseName)}\n`
        : "";
    const author = discussion.author?.display_name || discussion.user_name
        ? `👤 <b>Author:</b> ${escapeHtml(discussion.author?.display_name || discussion.user_name || "")}\n`
        : "";
    
    const postedTime = discussion.posted_at || discussion.created_at
        ? new Date(discussion.posted_at || discussion.created_at).toLocaleString("en-US", {
            timeZone: env.TIMEZONE,
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        })
        : "Unknown";

    const repliesCount = discussion.discussion_subentry_count !== undefined
        ? `💬 <b>Replies:</b> ${discussion.discussion_subentry_count}\n`
        : "";

    const lockStatus = discussion.locked ? "🔒 <i>Closed / Locked for replies</i>\n" : "🔓 <i>Open for replies</i>\n";

    const instructionsText = formatInstructionsToTelegramHtml(discussion.message || "", 2200);

    return `💬 <b>${escapeHtml(discussion.title)}</b>\n` +
        `${course}` +
        `${author}` +
        `📅 <b>Posted:</b> ${postedTime}\n` +
        `${repliesCount}` +
        `📊 <b>Status:</b> ${lockStatus}\n` +
        `📖 <b>Instructions / Prompt:</b>\n` +
        `${instructionsText}\n\n` +
        `🆔 Discussion ID: <code>${discussion.id}</code>`;
}

/**
 * Formats a list of recent course discussions.
 */
export function formatDiscussionList(discussions: EnrichedDiscussionTopic[]): string {
    if (discussions.length === 0) {
        return `💬 <b>Course Discussions</b>\n\n<i>No active discussion topics found.</i>`;
    }

    let text = `💬 <b>Course Discussions & Forum Activities</b> (${discussions.length})\n\n`;

    discussions.slice(0, 15).forEach((d, index) => {
        const course = d.courseCode || d.courseName ? `[${escapeHtml(d.courseCode || d.courseName || "")}] ` : "";
        const replies = d.discussion_subentry_count !== undefined ? ` (${d.discussion_subentry_count} replies)` : "";
        text += `${index + 1}. ${course}<b><a href="${d.html_url || d.url}">${escapeHtml(d.title)}</a></b>${replies}\n`;
    });

    if (discussions.length > 15) {
        text += `\n<i>... and ${discussions.length - 15} more topics. Use buttons below to inspect.</i>`;
    }

    return text;
}

/**
 * Formats full detailed card for a single assignment, including professor instructions.
 */
export function formatAssignmentDetail(assignment: EnrichedAssignment): string {
    const course = assignment.courseName
        ? `📚 <b>Course:</b> ${escapeHtml(assignment.courseName)}\n`
        : "";
    const points =
        assignment.points_possible !== null && assignment.points_possible !== undefined
            ? `${assignment.points_possible} pts`
            : "Not graded";
    const gradingType = assignment.grading_type ? ` (${escapeHtml(assignment.grading_type)})` : "";

    // Submission types
    const subTypes =
        assignment.submission_types && assignment.submission_types.length > 0
            ? assignment.submission_types
                .map((t) =>
                    t
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())
                )
                .join(", ")
            : "None / External";

    // Submission status
    let statusText = "⏳ <b>Unsubmitted</b>";
    if (assignment.submission?.workflow_state === "graded") {
        statusText = `🎯 <b>Graded: ${assignment.submission.score ?? assignment.submission.grade ?? "Complete"}</b>`;
    } else if (assignment.submission?.workflow_state === "submitted" || assignment.submission?.submitted_at) {
        const submittedTime = assignment.submission.submitted_at
            ? new Date(assignment.submission.submitted_at).toLocaleString("en-US", {
                timeZone: env.TIMEZONE,
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            })
            : "Yes";
        statusText = `✅ <b>Submitted (${submittedTime})</b>`;
    }

    // Description / Instructions formatting (preserves paragraphs, newlines, and bullet lists)
    const instructionsText = formatInstructionsToTelegramHtml(assignment.description || "", 2200);

    let text = `📝 <b>${escapeHtml(assignment.name)}</b>\n` +
        `${course}\n` +
        `🎯 <b>Points:</b> ${points}${gradingType}\n` +
        `📅 <b>Deadline:</b> ${formatDueDate(assignment.due_at)}\n` +
        `📥 <b>Submission:</b> ${escapeHtml(subTypes)}\n` +
        `📊 <b>Your Status:</b> ${statusText}\n\n` +
        `📖 <b>Instructions:</b>\n` +
        `${instructionsText}\n\n` +
        `🆔 Assignment ID: <code>${assignment.id}</code>`;

    return text;
}

/**
 * Urgent reminder for an assignment due in 1 to 3 hours.
 */
export function formatDueReminderNotification(assignment: EnrichedAssignment, hoursRemaining: number): string {
    const urgencyHeader = hoursRemaining <= 1
        ? "🚨🚨 <b>FINAL CALL: ASSIGNMENT DUE IN 1 HOUR!</b>"
        : "⏰ <b>URGENT REMINDER: ASSIGNMENT DUE SOON</b>";

    const course = assignment.courseName ? `<b>Course:</b> ${escapeHtml(assignment.courseName)}\n` : "";
    const points = assignment.points_possible !== null && assignment.points_possible !== undefined ? `<b>Points:</b> ${assignment.points_possible}\n` : "";

    return `${urgencyHeader}\n\n` +
        `${course}` +
        `<b>Task:</b> <a href="${assignment.html_url}">${escapeHtml(assignment.name)}</a>\n` +
        `${points}` +
        `<b>Deadline:</b> ${formatDueDate(assignment.due_at)}\n\n` +
        `⚠️ <i>This task is currently unsubmitted. Make sure to complete and submit before the deadline!</i>\n\n` +
        `<a href="${assignment.html_url}">👉 Submit Now on Canvas</a>`;
}

/**
 * Formats system status message.
 */
export function formatStatusMessage(state: BotState, user: CanvasUser): string {
    const syncTime = state.lastSyncAt
        ? new Date(state.lastSyncAt).toLocaleString("en-US", { timeZone: env.TIMEZONE })
        : "Never";

    return `🤖 <b>Canvas Assistant Status</b>\n\n` +
        `👤 <b>Canvas User:</b> ${escapeHtml(user.name)} (ID: <code>${user.id}</code>)\n` +
        `🌐 <b>Base URL:</b> <code>${escapeHtml(env.CANVAS_BASE_URL)}</code>\n` +
        `📚 <b>Active Courses Tracked:</b> ${state.coursesCount}\n` +
        `🔄 <b>Last Background Sync:</b> ${syncTime}\n` +
        `⏰ <b>Sync Schedule:</b> Every 10 mins (<code>${env.POLL_INTERVAL_CRON}</code>)\n` +
        `🔔 <b>Proactive Reminders:</b> Enabled (3h and 1h countdowns)\n` +
        `🧠 <b>Gemini AI:</b> ${env.GEMINI_API_KEY ? "🟢 Enabled (" + (env.GEMINI_MODEL || "gemini-2.5-flash") + ")" : "⚪ Disabled (Key not set)"}\n` +
        `🟢 <b>System Status:</b> Operational & Polling 24/7`;
}

/**
 * Converts standard Markdown output from Gemini into safe Telegram HTML.
 * Protects code blocks, inline code, and links, while escaping raw angle brackets.
 */
export function markdownToTelegramHtml(markdown: string = ""): string {
    if (!markdown) return "";

    const placeholders: string[] = [];
    const savePlaceholder = (val: string) => {
        const key = `\uE000PH${placeholders.length}\uE001`;
        placeholders.push(val);
        return key;
    };

    let text = markdown;

    // 1. Strip unwanted backslash escapes from Markdown engines (e.g. 1\. -> 1., \[ -> [, \_ -> _)
    text = text.replace(/\\([_*\\[\]().\-~>#+`!])/g, "$1");

    // 2. Protect code blocks
    text = text.replace(/```(?:[\w-]+)?\n([\s\S]*?)```/g, (_match, code) => {
        const escapedCode = escapeHtml(code.trim());
        return savePlaceholder(`<pre>${escapedCode}</pre>`);
    });

    // 3. Protect inline code
    text = text.replace(/`([^`]+)`/g, (_match, code) => {
        const escapedCode = escapeHtml(code);
        return savePlaceholder(`<code>${escapedCode}</code>`);
    });

    // 4. Protect links [text](url)
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
        const escapedLabel = escapeHtml(label);
        return savePlaceholder(`<a href="${url}">${escapedLabel}</a>`);
    });

    // 5. Protect fill-in-the-blank underline streaks (e.g. _______________)
    text = text.replace(/_{2,}/g, (match) => {
        return savePlaceholder(match);
    });

    // 6. Escape remaining raw HTML characters in the body (&, <, >)
    text = escapeHtml(text);

    // 7. Convert markdown formatting
    text = text
        // Headers
        .replace(/^### (.*?)$/gm, "\n<b>$1</b>\n")
        .replace(/^## (.*?)$/gm, "\n<b>$1</b>\n")
        .replace(/^# (.*?)$/gm, "\n<b>$1</b>\n")
        // Bold
        .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
        // Italic (note: text is already html escaped)
        .replace(/\*(.*?)\*/g, "<i>$1</i>")
        // Checklists & bullets
        .replace(/^• \[[ xX]\] /gm, "✅ ")
        .replace(/^• \[ \] /gm, "⬜ ")
        .replace(/^\[[ xX]\] /gm, "✅ ")
        .replace(/^\[ \] /gm, "⬜ ")
        .replace(/^(\s*)[-*]\s+/gm, "$1• ");

    // 8. Restore placeholders
    placeholders.forEach((val, i) => {
        text = text.replaceAll(`\uE000PH${i}\uE001`, val);
    });

    // 9. Clean up excessive newlines
    text = text.replace(/\n{3,}/g, "\n\n").trim();
    return text;
}

/**
 * Splits AI markdown responses safely into chunks smaller than 3500 chars.
 */
export function formatAiResponseChunks(rawResponse: string, chunkSize = 3500): string[] {
    const formatted = markdownToTelegramHtml(rawResponse);
    if (formatted.length <= chunkSize) {
        return [formatted];
    }

    const chunks: string[] = [];
    const paragraphs = formatted.split("\n\n");
    let currentChunk = "";

    for (const para of paragraphs) {
        if ((currentChunk + "\n\n" + para).length > chunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = para;
        } else {
            currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Formats a list of course modules for Telegram HTML.
 */
export function formatModuleList(modules: CanvasModule[], courseName?: string): string {
    const header = courseName
        ? `📦 <b>Weekly Learning Modules for ${escapeHtml(courseName)}</b>\n\n`
        : `📦 <b>Weekly Learning Modules</b>\n\n`;

    if (modules.length === 0) {
        return `${header}<i>No published modules found in this course.</i>`;
    }

    const items = modules.map((m, index) => {
        const count = m.items_count ?? m.items?.length ?? 0;
        const stateStr = m.state ? ` (${escapeHtml(m.state)})` : "";
        return `<b>${index + 1}. ${escapeHtml(m.name)}</b>${stateStr}\n   📄 <i>${count} learning items</i>`;
    });

    return `${header}${items.join("\n\n")}\n\n👉 <i>Tap a module button below to inspect files and lessons.</i>`;
}

/**
 * Formats full details and items of a single module.
 */
export function formatModuleDetail(module: CanvasModule, courseName?: string): string {
    const courseStr = courseName ? ` • <i>${escapeHtml(courseName)}</i>` : "";
    let message = `📦 <b>${escapeHtml(module.name)}</b>${courseStr}\n\n`;

    if (!module.items || module.items.length === 0) {
        message += `<i>No learning items found in this module.</i>`;
        return message;
    }

    message += `<b>Module Learning Items (${module.items.length}):</b>\n\n`;

    const itemLines = module.items.map((it, idx) => {
        let icon = "📄";
        if (it.type === "Assignment") icon = "📝";
        else if (it.type === "Quiz") icon = "❓";
        else if (it.type === "Discussion") icon = "💬";
        else if (it.type === "File") icon = "📁";
        else if (it.type === "SubHeader") icon = "📌";
        else if (it.type === "ExternalUrl") icon = "🔗";

        const title = escapeHtml(it.title);
        const typeStr = escapeHtml(it.type);
        return `${icon} <b>${idx + 1}. ${title}</b>\n   <i>Type: ${typeStr}</i>`;
    });

    message += itemLines.join("\n\n");
    return message;
}

/**
 * Formats a list of course files and slide decks for Telegram HTML.
 */
export function formatCourseFileList(files: CanvasFile[], courseName?: string): string {
    const header = courseName
        ? `📁 <b>Course Files & Slide Decks for ${escapeHtml(courseName)}</b>\n\n`
        : `📁 <b>Course Files & Slide Decks</b>\n\n`;

    if (files.length === 0) {
        return `${header}<i>No downloadable files found in this course repository.</i>`;
    }

    const items = files.slice(0, 15).map((f, index) => {
        const name = escapeHtml(f.display_name || f.filename);
        const sizeMb = f.size ? (f.size / (1024 * 1024)).toFixed(1) + " MB" : "Unknown size";
        return `<b>${index + 1}. 📄 ${name}</b>\n   <i>Size: ${sizeMb}</i>`;
    });

    return `${header}${items.join("\n\n")}\n\n👉 <i>Tap a file button below to download or have Gemini AI explain/summarize it.</i>`;
}

/**
 * Formats details of a single course file.
 */
export function formatFileDetail(file: CanvasFile, courseName?: string): string {
    const courseStr = courseName ? `\n📖 <b>Course:</b> ${escapeHtml(courseName)}` : "";
    const name = escapeHtml(file.display_name || file.filename);
    const sizeMb = file.size ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : "Unknown size";
    const typeStr = file["content-type"] ? escapeHtml(file["content-type"]) : "Document";

    return `📄 <b>${name}</b>${courseStr}\n\n` +
        `📦 <b>Size:</b> ${sizeMb}\n` +
        `🏷️ <b>Type:</b> <code>${typeStr}</code>\n\n` +
        `💡 <i>Tap <b>AI Summarize / Explain</b> to have Gemini read this document and extract its key takeaways and notes!</i>`;
}

