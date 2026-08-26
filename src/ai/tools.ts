import { type FunctionDeclaration, Type } from "@google/genai";
import { getActiveCourses } from "../canvas/courses.js";
import {
    getUpcomingAssignments,
    getUnsubmittedAssignments,
    getAssignmentDetails,
    findAssignmentById,
    getAllAssignments,
} from "../canvas/assignments.js";
import { getLatestAnnouncements } from "../canvas/announcements.js";
import {
    getCourseDiscussions,
    getAllDiscussions,
    getDiscussionDetails,
    findDiscussionById,
} from "../canvas/discussions.js";
import { cleanHtmlSnippet, turndown } from "../bot/formatters.js";

/**
 * Tool Declarations for Gemini Function Calling
 */
export const canvasToolDeclarations: FunctionDeclaration[] = [
    {
        name: "get_upcoming_assignments",
        description: "Retrieves active and upcoming assignments across all enrolled Canvas courses, sorted by due date.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                courseId: {
                    type: Type.INTEGER,
                    description: "Optional Canvas course ID to filter assignments for a specific course.",
                },
            },
        },
    },
    {
        name: "get_pending_tasks",
        description: "Retrieves unsubmitted / incomplete assignments that require the student's attention.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "get_assignment_details",
        description: "Fetches full professor instructions, rubric, points, deadline, and submission rules for a specific assignment.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                assignmentId: {
                    type: Type.INTEGER,
                    description: "The numeric Canvas assignment ID (e.g. 2614).",
                },
                assignmentTitle: {
                    type: Type.STRING,
                    description: "The title or keyword of the assignment to search for if ID is unknown.",
                },
            },
        },
    },
    {
        name: "get_course_announcements",
        description: "Fetches recent announcements posted by professors across enrolled courses.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                limit: {
                    type: Type.INTEGER,
                    description: "Maximum number of announcements to retrieve (default: 8).",
                },
            },
        },
    },
    {
        name: "get_course_discussions",
        description: "Retrieves active discussion topics, forum activities, and practice exercises across enrolled Canvas courses.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                courseId: {
                    type: Type.INTEGER,
                    description: "Optional Canvas course ID to filter discussions for a specific course.",
                },
                limit: {
                    type: Type.INTEGER,
                    description: "Maximum number of discussion topics to retrieve (default: 10).",
                },
            },
        },
    },
    {
        name: "get_discussion_details",
        description: "Fetches full prompt instructions, questions, professor requirements, author, and attached files for a specific discussion topic or forum activity.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                topicId: {
                    type: Type.INTEGER,
                    description: "The numeric Canvas discussion topic ID (e.g. 6096).",
                },
                topicTitle: {
                    type: Type.STRING,
                    description: "The title or keyword of the discussion to search for if ID is unknown.",
                },
                courseId: {
                    type: Type.INTEGER,
                    description: "Optional course ID if known.",
                },
            },
        },
    },
    {
        name: "get_active_courses",
        description: "Lists all currently active enrolled Canvas courses with course IDs, codes, and term names.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
];

function extractAttachedFiles(html: string = ""): string[] {
    const fileLinks: string[] = [];
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        const url = match[1] || "";
        const label = match[2]?.replace(/<[^>]+>/g, "").trim() || "";
        if (
            url.includes("/files/") ||
            url.includes("download_frd=1") ||
            /\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt|py|java|cpp|sql)$/i.test(label) ||
            /\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt|py|java|cpp|sql)(\?|$)/i.test(url)
        ) {
            fileLinks.push(`${label || "Attached File"} (${url})`);
        }
    }
    return fileLinks;
}

/**
 * Executes a tool function called by Gemini and returns structured data.
 */
export async function executeCanvasTool(name: string, args: Record<string, any>): Promise<any> {
    try {
        switch (name) {
            case "get_upcoming_assignments": {
                const assignments = await getUpcomingAssignments();
                return assignments.map((a) => ({
                    id: a.id,
                    name: a.name,
                    course: a.courseCode || a.courseName,
                    due_at: a.due_at,
                    points_possible: a.points_possible,
                    is_submitted: a.has_submitted_submissions || a.submission?.workflow_state === "submitted",
                    url: a.html_url,
                }));
            }

            case "get_pending_tasks": {
                const pending = await getUnsubmittedAssignments();
                return pending.map((a) => ({
                    id: a.id,
                    name: a.name,
                    course: a.courseCode || a.courseName,
                    due_at: a.due_at,
                    points_possible: a.points_possible,
                    url: a.html_url,
                }));
            }

            case "get_assignment_details": {
                let assignment = null;
                if (args.assignmentId) {
                    assignment = await findAssignmentById(Number(args.assignmentId));
                } else if (args.assignmentTitle) {
                    const all = await getAllAssignments();
                    const query = String(args.assignmentTitle).toLowerCase();
                    assignment = all.find((a) => a.name.toLowerCase().includes(query)) || null;
                }

                if (!assignment) {
                    return { error: `Assignment '${args.assignmentTitle || args.assignmentId}' not found in active courses.` };
                }

                const rawDesc = assignment.description || "";
                const attachedFiles = extractAttachedFiles(rawDesc);
                const markdownText = rawDesc.trim() ? turndown.turndown(rawDesc) : "";
                const hasSubstantialText = markdownText.trim().length > 20;

                return {
                    id: assignment.id,
                    name: assignment.name,
                    course: assignment.courseName || assignment.courseCode,
                    due_at: assignment.due_at,
                    points_possible: assignment.points_possible,
                    grading_type: assignment.grading_type,
                    submission_types: assignment.submission_types,
                    submission_status: assignment.submission?.workflow_state || "unsubmitted",
                    score: assignment.submission?.score ?? assignment.submission?.grade ?? null,
                    has_text_instructions: hasSubstantialText,
                    has_attached_files: attachedFiles.length > 0,
                    attached_files: attachedFiles,
                    instructions_text: markdownText || "(No written text instructions found)",
                    url: assignment.html_url,
                };
            }

            case "get_course_announcements": {
                const limit = Number(args.limit) || 8;
                const announcements = await getLatestAnnouncements(undefined, limit);
                return announcements.map((ann) => ({
                    id: ann.id,
                    title: ann.title,
                    course: ann.courseName,
                    author: ann.author?.display_name,
                    posted_at: ann.posted_at || ann.created_at,
                    content_preview: cleanHtmlSnippet(ann.message, 500),
                    url: ann.html_url || ann.url,
                }));
            }

            case "get_course_discussions": {
                const limit = Number(args.limit) || 10;
                let discussions;
                if (args.courseId) {
                    discussions = await getCourseDiscussions(Number(args.courseId), limit);
                } else {
                    discussions = await getAllDiscussions(undefined, limit);
                }
                return discussions.map((d) => ({
                    id: d.id,
                    title: d.title,
                    course: d.courseName || d.courseCode,
                    author: d.author?.display_name || d.user_name,
                    posted_at: d.posted_at || d.created_at,
                    replies_count: d.discussion_subentry_count ?? 0,
                    content_preview: cleanHtmlSnippet(d.message || "", 400),
                    url: d.html_url || d.url,
                }));
            }

            case "get_discussion_details": {
                let topic = null;
                if (args.topicId) {
                    if (args.courseId) {
                        topic = await getDiscussionDetails(Number(args.courseId), Number(args.topicId));
                    } else {
                        topic = await findDiscussionById(Number(args.topicId));
                    }
                } else if (args.topicTitle) {
                    const all = await getAllDiscussions();
                    const query = String(args.topicTitle).toLowerCase();
                    topic = all.find((t) => t.title.toLowerCase().includes(query)) || null;
                }

                if (!topic) {
                    return { error: `Discussion topic '${args.topicTitle || args.topicId}' not found.` };
                }

                const rawMsg = topic.message || "";
                const attachedFiles = extractAttachedFiles(rawMsg);
                const markdownText = rawMsg.trim() ? turndown.turndown(rawMsg) : "";
                const hasSubstantialText = markdownText.trim().length > 20;

                return {
                    id: topic.id,
                    title: topic.title,
                    course: topic.courseName || topic.courseCode,
                    author: topic.author?.display_name || topic.user_name,
                    posted_at: topic.posted_at || topic.created_at,
                    locked: topic.locked ?? false,
                    require_initial_post: topic.require_initial_post ?? false,
                    replies_count: topic.discussion_subentry_count ?? 0,
                    has_text_instructions: hasSubstantialText,
                    has_attached_files: attachedFiles.length > 0,
                    attached_files: attachedFiles,
                    instructions_text: markdownText || "(No prompt text provided)",
                    url: topic.html_url || topic.url,
                };
            }

            case "get_active_courses": {
                const courses = await getActiveCourses();
                return courses.map((c) => ({
                    id: c.id,
                    name: c.name,
                    course_code: c.course_code,
                    term: c.term?.name,
                }));
            }

            default:
                return { error: `Unknown tool function: ${name}` };
        }
    } catch (err: any) {
        console.error(`Error executing tool '${name}':`, err);
        return { error: `Tool execution failed: ${err.message || String(err)}` };
    }
}
