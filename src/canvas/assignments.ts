import { canvasFetch } from "./client.js";
import { getActiveCourses, getCourseById } from "./courses.js";
import type { CanvasAssignment, CanvasCourse } from "./types.js";

export interface EnrichedAssignment extends CanvasAssignment {
  courseName?: string | undefined;
  courseCode?: string | undefined;
}

/**
 * Fetches all assignments for a specific course including user submission data.
 */
export async function getCourseAssignments(courseId: number): Promise<CanvasAssignment[]> {
  try {
    const assignments = await canvasFetch<CanvasAssignment[]>(`/courses/${courseId}/assignments`, {
      "include[]": ["submission"],
      order_by: "due_at",
      per_page: 100,
    });
    return assignments.map((a) => ({ ...a, course_id: courseId }));
  } catch (error) {
    console.error(`Error fetching assignments for course ${courseId}:`, error);
    return [];
  }
}

/**
 * Fetches detailed info for a single assignment including full description and submission.
 */
export async function getAssignmentDetails(
  courseId: number,
  assignmentId: number
): Promise<EnrichedAssignment | null> {
  try {
    const [assignment, course] = await Promise.all([
      canvasFetch<CanvasAssignment>(`/courses/${courseId}/assignments/${assignmentId}`, {
        "include[]": ["submission"],
      }),
      getCourseById(courseId),
    ]);

    return {
      ...assignment,
      course_id: courseId,
      courseName: course?.name,
      courseCode: course?.course_code || course?.name,
    };
  } catch (error) {
    console.error(`Error fetching details for assignment ${assignmentId} in course ${courseId}:`, error);
    return null;
  }
}

/**
 * Searches across all active courses to find an assignment by its ID.
 */
export async function findAssignmentById(assignmentId: number): Promise<EnrichedAssignment | null> {
  const activeCourses = await getActiveCourses();

  for (const course of activeCourses) {
    try {
      const assignment = await canvasFetch<CanvasAssignment>(
        `/courses/${course.id}/assignments/${assignmentId}`,
        { "include[]": ["submission"] }
      );
      if (assignment && assignment.id === assignmentId) {
        return {
          ...assignment,
          course_id: course.id,
          courseName: course.name,
          courseCode: course.course_code || course.name,
        };
      }
    } catch {
      // Not in this course, continue checking
    }
  }

  return null;
}

/**
 * Checks whether an assignment has been submitted by the student.
 */
export function isAssignmentSubmitted(assignment: CanvasAssignment): boolean {
  if (assignment.has_submitted_submissions) return true;
  const sub = assignment.submission;
  if (!sub) return false;
  if (sub.workflow_state === "submitted" || sub.workflow_state === "graded") return true;
  if (sub.submitted_at) return true;
  return false;
}

/**
 * Fetches all assignments across all active courses, enriched with course details.
 */
export async function getAllAssignments(courses?: CanvasCourse[]): Promise<EnrichedAssignment[]> {
  const activeCourses = courses || (await getActiveCourses());
  const courseMap = new Map<number, CanvasCourse>(activeCourses.map((c) => [c.id, c]));

  const assignmentPromises = activeCourses.map(async (course) => {
    const assignments = await getCourseAssignments(course.id);
    return assignments.map((assignment) => {
      const c = courseMap.get(assignment.course_id);
      return {
        ...assignment,
        courseName: c?.name,
        courseCode: c?.course_code || c?.name,
      } as EnrichedAssignment;
    });
  });

  const results = await Promise.all(assignmentPromises);
  const flattened = results.flat();

  // Sort by due date (items with due dates first in ascending order, null due dates at the end)
  return flattened.sort((a, b) => {
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });
}

/**
 * Fetches only upcoming / active assignments (due in the future or within the last 12 hours).
 */
export async function getUpcomingAssignments(courses?: CanvasCourse[]): Promise<EnrichedAssignment[]> {
  const all = await getAllAssignments(courses);
  const cutoff = Date.now() - 12 * 60 * 60 * 1000; // Allow items due within the last 12 hours of today

  return all
    .filter((a) => a.due_at !== null && new Date(a.due_at).getTime() >= cutoff)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
}

/**
 * Fetches assignments that have no explicit due date (ongoing tasks, reading, projects).
 */
export async function getNoDueDateAssignments(courses?: CanvasCourse[]): Promise<EnrichedAssignment[]> {
  const all = await getAllAssignments(courses);
  return all.filter((a) => a.due_at === null);
}

/**
 * Fetches past assignments whose deadlines have already elapsed.
 */
export async function getPastAssignments(courses?: CanvasCourse[]): Promise<EnrichedAssignment[]> {
  const all = await getAllAssignments(courses);
  const now = Date.now();

  return all
    .filter((a) => a.due_at !== null && new Date(a.due_at).getTime() < now)
    .sort((a, b) => new Date(b.due_at!).getTime() - new Date(a.due_at!).getTime()); // Most recent past first
}

/**
 * Fetches pending/unsubmitted assignments across all active courses.
 */
export async function getUnsubmittedAssignments(courses?: CanvasCourse[]): Promise<EnrichedAssignment[]> {
  const all = await getAllAssignments(courses);
  const now = new Date();

  return all.filter((assignment) => {
    // Exclude submitted assignments
    if (isAssignmentSubmitted(assignment)) return false;

    // If it has a due date in the past (> 45 days ago), skip ancient semester backlog
    if (assignment.due_at) {
      const dueDate = new Date(assignment.due_at);
      const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
      if (dueDate < fortyFiveDaysAgo) return false;
    }

    return true;
  });
}

/**
 * Fetches recently submitted or graded assignments across all active courses.
 */
export async function getSubmittedAssignments(courses?: CanvasCourse[]): Promise<EnrichedAssignment[]> {
  const all = await getAllAssignments(courses);
  return all
    .filter((assignment) => isAssignmentSubmitted(assignment))
    .sort((a, b) => {
      const timeA = a.submission?.submitted_at ? new Date(a.submission.submitted_at).getTime() : 0;
      const timeB = b.submission?.submitted_at ? new Date(b.submission.submitted_at).getTime() : 0;
      return timeB - timeA;
    });
}
