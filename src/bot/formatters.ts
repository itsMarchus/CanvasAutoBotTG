import { env } from "../config/env.js";
import type { CanvasCourse, CanvasUser } from "../canvas/types.js";
import type { EnrichedAssignment } from "../canvas/assignments.js";
import type { EnrichedAnnouncement } from "../canvas/announcements.js";
import type { BotState } from "../services/storage.js";

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
 * Strips HTML tags and produces a clean text preview snippet.
 */
export function cleanHtmlSnippet(html: string = "", maxLength = 220): string {
  if (!html) return "";
  const cleaned = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

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

Here are the commands you can use:

🎯 <b>Assignments & Tasks</b>
• /todo or /unsubmitted — View pending assignments
• /assignments — View all upcoming assignments
• /completed or /submitted — View submitted & graded work

📖 <b>Courses & Updates</b>
• /courses — List all your active Canvas courses
• /announcements — View latest course announcements
• /sync — Force an immediate sync with Canvas

⚙️ <b>Bot & System</b>
• /status — View bot status & last sync timestamp
• /help — Show this help menu

<i>💡 Tip: You will automatically receive notifications for new announcements, newly posted assignments, and reminder alerts 1–3 hours before deadlines!</i>`;
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
    `🟢 <b>System Status:</b> Operational & Polling 24/7`;
}
