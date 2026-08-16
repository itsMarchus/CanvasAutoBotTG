import type { Context } from "grammy";
import { getActiveCourses, getCourseById } from "../canvas/courses.js";
import { getCourseAssignments } from "../canvas/assignments.js";
import { getLatestAnnouncements } from "../canvas/announcements.js";
import {
  escapeHtml,
  formatAssignmentList,
  formatAnnouncementList,
  formatCourseList,
} from "./formatters.js";
import {
  buildCoursesKeyboard,
  buildCourseActionKeyboard,
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

      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildBackToCoursesKeyboard(),
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

      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildBackToCoursesKeyboard(),
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

      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildBackToCoursesKeyboard(),
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    // 6. View announcements for a specific course
    if (data.startsWith("course_announce:")) {
      const courseId = parseInt(data.split(":")[1] || "", 10);
      if (isNaN(courseId)) return;

      await ctx.answerCallbackQuery({ text: "Fetching announcements..." });
      const announcements = await getLatestAnnouncements([courseId], 5);
      const text = formatAnnouncementList(announcements);

      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildBackToCoursesKeyboard(),
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error("Callback query error:", error);
    await ctx.answerCallbackQuery({ text: "⚠️ Error processing request." });
  }
}
