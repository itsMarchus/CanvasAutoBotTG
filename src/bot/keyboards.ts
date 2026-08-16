import { InlineKeyboard } from "grammy";
import type { CanvasCourse, CanvasAssignment } from "../canvas/types.js";

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
        .text("📅 Upcoming Tasks", `course_upcoming:${courseId}`)
        .text("⏳ Pending / Todo", `course_todo:${courseId}`)
        .row()
        .text("📂 All Assignments", `course_all:${courseId}`)
        .text("📢 Announcements", `course_announce:${courseId}`)
        .row()
        .text("« Back to Courses", "back_courses");
}

/**
 * Builds an interactive keyboard with buttons to view specific assignment details.
 */
export function buildAssignmentSelectionKeyboard(
    assignments: CanvasAssignment[],
    courseId: number,
    maxButtons: number = 8
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    const subset = assignments.slice(0, maxButtons);
    subset.forEach((a, index) => {
        const label = a.name.length > 28 ? `${a.name.slice(0, 26)}...` : a.name;
        keyboard.text(`📝 ${index + 1}. ${label}`, `assign_view:${courseId}:${a.id}`).row();
    });

    keyboard.text("« Back to Course Menu", `course:${courseId}`);
    return keyboard;
}

/**
 * Builds an action keyboard for a single assignment detail view.
 */
export function buildAssignmentDetailKeyboard(htmlUrl: string, courseId?: number): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (htmlUrl) {
        keyboard.url("👉 Open in Canvas Browser", htmlUrl).row();
    }

    if (courseId) {
        keyboard.text("« Back to Course Tasks", `course:${courseId}`);
    } else {
        keyboard.text("« Back to All Courses", "back_courses");
    }

    return keyboard;
}

/**
 * Builds a back to courses button.
 */
export function buildBackToCoursesKeyboard(): InlineKeyboard {
    return new InlineKeyboard().text("« Back to All Courses", "back_courses");
}
