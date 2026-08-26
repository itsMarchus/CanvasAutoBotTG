import { InlineKeyboard } from "grammy";
import type { CanvasCourse, CanvasAssignment, CanvasDiscussionTopic, CanvasAnnouncement } from "../canvas/types.js";
import type { EnrichedDiscussionTopic } from "../canvas/discussions.js";
import type { EnrichedAnnouncement } from "../canvas/announcements.js";

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
        .text("💬 Discussions & Activities", `course_disc:${courseId}`)
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
 * Builds an interactive keyboard with buttons to view specific discussion topics.
 */
export function buildDiscussionSelectionKeyboard(
    discussions: EnrichedDiscussionTopic[] | CanvasDiscussionTopic[],
    courseId?: number,
    maxButtons: number = 8
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    const subset = discussions.slice(0, maxButtons);
    subset.forEach((d, index) => {
        const label = d.title.length > 28 ? `${d.title.slice(0, 26)}...` : d.title;
        const cId = (d as EnrichedDiscussionTopic).courseId || courseId || 0;
        keyboard.text(`💬 ${index + 1}. ${label}`, `disc_view:${cId}:${d.id}`).row();
    });

    if (courseId) {
        keyboard.text("« Back to Course Menu", `course:${courseId}`);
    } else {
        keyboard.text("« Back to Courses", "back_courses");
    }
    return keyboard;
}

/**
 * Builds an interactive keyboard with buttons to view specific announcement details.
 */
export function buildAnnouncementSelectionKeyboard(
    announcements: EnrichedAnnouncement[] | CanvasAnnouncement[],
    courseId?: number,
    maxButtons: number = 8
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    const subset = announcements.slice(0, maxButtons);
    subset.forEach((a, index) => {
        const label = a.title.length > 28 ? `${a.title.slice(0, 26)}...` : a.title;
        const cId = (a as EnrichedAnnouncement).courseId || courseId || 0;
        keyboard.text(`📢 ${index + 1}. ${label}`, `announce_view:${cId}:${a.id}`).row();
    });

    if (courseId) {
        keyboard.text("« Back to Course Menu", `course:${courseId}`);
    } else {
        keyboard.text("« Back to Courses", "back_courses");
    }
    return keyboard;
}

/**
 * Builds an action keyboard for a single announcement detail view.
 */
export function buildAnnouncementDetailKeyboard(
    htmlUrl: string,
    courseId?: number,
    announcementId?: number
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (announcementId) {
        keyboard
            .text("🤖 AI Summarize / Explain", `ai_explain_announce:${courseId || 0}:${announcementId}`)
            .row();
    }

    if (htmlUrl) {
        keyboard.url("👉 Open in Canvas Browser", htmlUrl);
    }

    if (courseId) {
        keyboard.row().text("« Back to Course Menu", `course:${courseId}`);
    } else {
        keyboard.row().text("« Back to Announcements", "refresh_announcements");
    }

    return keyboard;
}

/**
 * Builds an action keyboard for a single assignment detail view.
 */
export function buildAssignmentDetailKeyboard(
    htmlUrl: string,
    courseId?: number,
    assignmentId?: number
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (assignmentId) {
        keyboard
            .text("🤖 Explain Instructions", `ai_explain:${assignmentId}`)
            .text("💡 Generate Answer", `ai_answer:${assignmentId}`)
            .row();
    }

    if (htmlUrl) {
        keyboard.url("👉 Open in Canvas Browser", htmlUrl);
    }

    if (courseId) {
        keyboard.row().text("« Back to Course Tasks", `course:${courseId}`);
    } else {
        keyboard.row().text("« Back to All Courses", "back_courses");
    }

    return keyboard;
}

/**
 * Builds an action keyboard for a single discussion topic detail view.
 */
export function buildDiscussionDetailKeyboard(
    htmlUrl: string,
    courseId?: number,
    topicId?: number
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (topicId) {
        keyboard
            .text("🤖 Explain Prompt", `ai_explain_disc:${courseId || 0}:${topicId}`)
            .text("💡 Draft Response / Answer", `ai_answer_disc:${courseId || 0}:${topicId}`)
            .row();
    }

    if (htmlUrl) {
        keyboard.url("👉 Open Discussion in Canvas", htmlUrl);
    }

    if (courseId) {
        keyboard.row().text("« Back to Course Menu", `course:${courseId}`);
    } else {
        keyboard.row().text("« Back to Discussions", "refresh_discussions");
    }

    return keyboard;
}

/**
 * Builds a notification keyboard for newly posted discussions.
 */
export function buildNewDiscussionNotificationKeyboard(
    htmlUrl: string,
    courseId: number,
    topicId: number
): InlineKeyboard {
    return new InlineKeyboard()
        .text("📖 View Prompt", `disc_view:${courseId}:${topicId}`)
        .text("🤖 AI Solution", `ai_answer_disc:${courseId}:${topicId}`)
        .row()
        .url("👉 Open in Canvas", htmlUrl);
}

/**
 * Builds a notification keyboard for newly posted announcements.
 */
export function buildNewAnnouncementNotificationKeyboard(
    htmlUrl: string,
    courseId?: number,
    announcementId?: number
): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    if (announcementId) {
        keyboard
            .text("📖 Full Content", `announce_view:${courseId || 0}:${announcementId}`)
            .text("🤖 AI Summarize", `ai_explain_announce:${courseId || 0}:${announcementId}`)
            .row();
    }
    if (htmlUrl) {
        keyboard.url("👉 Open in Canvas", htmlUrl);
    }
    return keyboard;
}

/**
 * Builds a back to courses button.
 */
export function buildBackToCoursesKeyboard(): InlineKeyboard {
    return new InlineKeyboard().text("« Back to All Courses", "back_courses");
}
