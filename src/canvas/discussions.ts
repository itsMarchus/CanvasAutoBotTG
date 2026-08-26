import { canvasFetch } from "./client.js";
import { getActiveCourses } from "./courses.js";
import type { CanvasCourse, CanvasDiscussionTopic } from "./types.js";

export interface EnrichedDiscussionTopic extends CanvasDiscussionTopic {
    courseId?: number | undefined;
    courseName?: string | undefined;
    courseCode?: string | undefined;
}

/**
 * Fetches recent discussion topics for a specific course.
 */
export async function getCourseDiscussions(
    courseId: number,
    limit = 20
): Promise<EnrichedDiscussionTopic[]> {
    try {
        const topics = await canvasFetch<CanvasDiscussionTopic[]>(
            `/courses/${courseId}/discussion_topics`,
            {
                per_page: limit,
                order_by: "recent_activity",
            }
        );

        return topics
            .filter((t) => !t.is_announcement) // Filter out announcements if any leak through
            .map((t) => ({
                ...t,
                courseId,
            }));
    } catch (error) {
        console.error(`Error fetching discussions for course #${courseId}:`, error);
        return [];
    }
}

/**
 * Fetches active discussion topics across all provided courses (or all active enrolled courses).
 */
export async function getAllDiscussions(
    courses?: CanvasCourse[],
    limitPerCourse = 10
): Promise<EnrichedDiscussionTopic[]> {
    const activeCourses = courses || (await getActiveCourses());
    if (activeCourses.length === 0) return [];

    const courseMap = new Map(activeCourses.map((c) => [c.id, c]));

    const fetchPromises = activeCourses.map(async (course) => {
        try {
            const topics = await canvasFetch<CanvasDiscussionTopic[]>(
                `/courses/${course.id}/discussion_topics`,
                {
                    per_page: limitPerCourse,
                    order_by: "recent_activity",
                }
            );

            return topics
                .filter((t) => !t.is_announcement)
                .map((t) => ({
                    ...t,
                    courseId: course.id,
                    courseName: course.name,
                    courseCode: course.course_code || course.name,
                }));
        } catch (error) {
            console.error(`Error fetching discussions for course ${course.name} (#${course.id}):`, error);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);
    const allTopics = results.flat();

    // Sort topics by posted_at / created_at descending (newest first)
    allTopics.sort((a, b) => {
        const timeA = new Date(a.posted_at || a.created_at).getTime();
        const timeB = new Date(b.posted_at || b.created_at).getTime();
        return timeB - timeA;
    });

    return allTopics;
}

/**
 * Fetches full details for a specific discussion topic.
 */
export async function getDiscussionDetails(
    courseId: number,
    topicId: number
): Promise<EnrichedDiscussionTopic | null> {
    try {
        const topic = await canvasFetch<CanvasDiscussionTopic>(
            `/courses/${courseId}/discussion_topics/${topicId}`
        );

        const courses = await getActiveCourses();
        const course = courses.find((c) => c.id === courseId);

        return {
            ...topic,
            courseId,
            courseName: course?.name,
            courseCode: course?.course_code || course?.name,
        };
    } catch (error) {
        console.error(`Error fetching discussion #${topicId} for course #${courseId}:`, error);
        return null;
    }
}

/**
 * Searches across all active courses to find a discussion topic by its ID.
 */
export async function findDiscussionById(
    topicId: number
): Promise<EnrichedDiscussionTopic | null> {
    const allTopics = await getAllDiscussions(undefined, 25);
    const match = allTopics.find((t) => t.id === topicId);
    if (match && match.courseId) {
        return getDiscussionDetails(match.courseId, topicId);
    }
    return match || null;
}
