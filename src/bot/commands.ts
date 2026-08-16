import type { CommandContext, Context } from "grammy";
import { getCurrentUser } from "../canvas/client.js";
import { getActiveCourses } from "../canvas/courses.js";
import {
  getAllAssignments,
  getUnsubmittedAssignments,
  getSubmittedAssignments,
  getCourseAssignments,
} from "../canvas/assignments.js";
import { getLatestAnnouncements } from "../canvas/announcements.js";
import { storage } from "../services/storage.js";
import {
  escapeHtml,
  formatHelpMessage,
  formatCourseList,
  formatAssignmentList,
  formatAnnouncementList,
  formatStatusMessage,
} from "./formatters.js";
import { buildCoursesKeyboard } from "./keyboards.js";

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
    `I will monitor your courses 24/7 and automatically send you:\n` +
    `• 🔔 <b>New course announcements</b>\n` +
    `• 📝 <b>New assignments posted</b>\n` +
    `• ⏰ <b>Urgent deadline alerts (1–3 hours before due date)</b>\n\n` +
    `Use /help to see all available commands, or /courses to view your classes.`;

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
 * /assignments command handler.
 * Usage: /assignments or /assignments <course_id>
 */
export async function handleAssignments(ctx: CommandContext<Context>): Promise<void> {
  await ctx.replyWithChatAction("typing");
  const arg = ctx.match?.trim();

  try {
    if (arg && !isNaN(Number(arg))) {
      const courseId = Number(arg);
      const rawAssignments = await getCourseAssignments(courseId);
      const assignments = rawAssignments.map((a) => ({ ...a, courseCode: `Course ${courseId}` }));
      const text = formatAssignmentList(
        assignments,
        `Assignments for Course ${courseId}`,
        `🎉 <b>No assignments found for course ${courseId}.</b>`
      );
      await ctx.reply(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
      return;
    }

    const assignments = await getAllAssignments();
    const text = formatAssignmentList(
      assignments,
      "All Upcoming Canvas Assignments",
      "🎉 <b>No assignments found! You are all caught up.</b>"
    );
    await ctx.reply(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  } catch (error) {
    console.error("Error in /assignments:", error);
    await ctx.reply("❌ <b>Failed to fetch assignments from Canvas.</b>", { parse_mode: "HTML" });
  }
}

/**
 * /todo or /unsubmitted command handler.
 */
export async function handleTodo(ctx: CommandContext<Context>): Promise<void> {
  await ctx.replyWithChatAction("typing");
  try {
    const pending = await getUnsubmittedAssignments();
    const text = formatAssignmentList(
      pending,
      "Pending / Unsubmitted Tasks",
      "🎉 <b>Awesome! You have no pending or unsubmitted assignments.</b>"
    );
    await ctx.reply(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  } catch (error) {
    console.error("Error in /todo:", error);
    await ctx.reply("❌ <b>Failed to fetch pending tasks from Canvas.</b>", { parse_mode: "HTML" });
  }
}

/**
 * /completed or /submitted command handler.
 */
export async function handleCompleted(ctx: CommandContext<Context>): Promise<void> {
  await ctx.replyWithChatAction("typing");
  try {
    const completed = await getSubmittedAssignments();
    const text = formatAssignmentList(
      completed,
      "Submitted & Graded Assignments",
      "ℹ️ <b>No submitted assignments recorded in recent courses.</b>"
    );
    await ctx.reply(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
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
