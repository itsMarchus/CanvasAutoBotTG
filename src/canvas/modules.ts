import { canvasFetch } from "./client.js";
import type { CanvasModule, CanvasPage } from "./types.js";

/**
 * Fetches all modules and their learning items for a specific Canvas course.
 */
export async function getCourseModules(courseId: number): Promise<CanvasModule[]> {
    try {
        const modules = await canvasFetch<CanvasModule[]>(`/courses/${courseId}/modules`, {
            "include[]": ["items", "content_details"],
            per_page: 50,
        });
        return modules || [];
    } catch (error) {
        console.error(`Error fetching modules for course #${courseId}:`, error);
        return [];
    }
}

/**
 * Fetches a single wiki/lecture page from a Canvas course.
 */
export async function getCoursePage(
    courseId: number,
    pageUrlOrId: string
): Promise<CanvasPage | null> {
    try {
        return await canvasFetch<CanvasPage>(`/courses/${courseId}/pages/${pageUrlOrId}`);
    } catch (error) {
        console.error(`Error fetching page [${pageUrlOrId}] for course #${courseId}:`, error);
        return null;
    }
}

/**
 * Fetches the front page / home page of a Canvas course if set.
 */
export async function getCourseFrontPage(courseId: number): Promise<CanvasPage | null> {
    try {
        return await canvasFetch<CanvasPage>(`/courses/${courseId}/front_page`);
    } catch (error) {
        console.error(`Error fetching front page for course #${courseId}:`, error);
        return null;
    }
}
