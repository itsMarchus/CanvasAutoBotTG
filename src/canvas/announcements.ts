import { canvasFetch } from "./client.js";
import { getActiveCourses } from "./courses.js";
import type { CanvasAnnouncement } from "./types.js";

export interface EnrichedAnnouncement extends CanvasAnnouncement {
  courseId?: number | undefined;
  courseName?: string | undefined;
}

/**
 * Fetches recent announcements across the provided course IDs (or all active courses).
 */
export async function getLatestAnnouncements(
  courseIds?: number[],
  limit = 10
): Promise<EnrichedAnnouncement[]> {
  let ids = courseIds;
  const activeCourses = await getActiveCourses();
  const courseMap = new Map(activeCourses.map((c) => [c.id, c.name]));

  if (!ids || ids.length === 0) {
    ids = activeCourses.map((c) => c.id);
  }

  if (ids.length === 0) return [];

  const contextCodes = ids.map((id) => `course_${id}`);

  try {
    const announcements = await canvasFetch<CanvasAnnouncement[]>("/announcements", {
      "context_codes[]": contextCodes,
      per_page: limit,
      active_only: true,
    });

    return announcements.map((announcement) => {
      const match = announcement.context_code.match(/course_(\d+)/);
      const cId = match && match[1] ? parseInt(match[1], 10) : undefined;
      return {
        ...announcement,
        courseId: cId,
        courseName: cId ? courseMap.get(cId) : undefined,
      };
    });
  } catch (error) {
    console.error("Error fetching Canvas announcements:", error);
    return [];
  }
}
