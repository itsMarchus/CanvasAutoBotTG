import { InlineKeyboard } from "grammy";
import type { CanvasCourse } from "../canvas/types.js";

/**
 * Builds an inline keyboard listing courses with buttons to view details.
 */
export function buildCoursesKeyboard(courses: CanvasCourse[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  courses.forEach((course) => {
    const label = course.course_code || course.name.slice(0, 30);
    keyboard.text(`📖 ${label}`, `course:${course.id}`).row();
  });

  keyboard.text("🔄 Refresh Courses", "refresh_courses");
  return keyboard;
}

/**
 * Builds an action menu for a specific course.
 */
export function buildCourseActionKeyboard(courseId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("📋 View Assignments", `course_assign:${courseId}`)
    .text("📢 Announcements", `course_announce:${courseId}`)
    .row()
    .text("« Back to Courses", "back_courses");
}

/**
 * Builds a back to courses button.
 */
export function buildBackToCoursesKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("« Back to All Courses", "back_courses");
}
