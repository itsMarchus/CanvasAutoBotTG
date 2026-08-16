import { canvasFetch } from "./client.js";
import { getActiveCourses } from "./courses.js";
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
 * Fetches assignments across all active courses, enriched with course details.
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
 * Fetches pending/unsubmitted assignments across all active courses.
 */
export async function getUnsubmittedAssignments(courses?: CanvasCourse[]): Promise<EnrichedAssignment[]> {
  const all = await getAllAssignments(courses);
  const now = new Date();

  return all.filter((assignment) => {
    // Exclude submitted assignments
    if (isAssignmentSubmitted(assignment)) return false;

    // If it has a due date in the past (> 30 days ago), we can skip old historical backlog
    if (assignment.due_at) {
      const dueDate = new Date(assignment.due_at);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (dueDate < thirtyDaysAgo) return false;
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
