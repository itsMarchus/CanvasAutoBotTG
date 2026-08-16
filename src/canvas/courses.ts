import { canvasFetch } from "./client.js";
import type { CanvasCourse } from "./types.js";

/**
 * Fetches all actively enrolled Canvas courses for the authenticated user.
 * Filters out placeholder/unnamed courses or courses restricted by date.
 */
export async function getActiveCourses(): Promise<CanvasCourse[]> {
    const courses = await canvasFetch<CanvasCourse[]>("/courses", {
        enrollment_state: "active",
        "include[]": ["term", "total_students"],
        per_page: 50,
    });

    return courses.filter((course) => {
        // Canvas occasionally returns empty or un-enrolled objects
        if (!course || !course.id || !course.name) return false;
        if (course.access_restricted_by_date) return false;
        if (course.workflow_state === "completed" || course.workflow_state === "deleted") return false;
        return true;
    });
}

/**
 * Fetches a single course by its ID.
 */
export async function getCourseById(courseId: number): Promise<CanvasCourse | null> {
    try {
        return await canvasFetch<CanvasCourse>(`/courses/${courseId}`, {
            "include[]": ["term", "total_students"],
        });
    } catch (error) {
        console.error(`Failed to fetch course ${courseId}:`, error);
        return null;
    }
}
