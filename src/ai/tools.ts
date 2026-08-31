import { type FunctionDeclaration, Type } from "@google/genai";
import { getActiveCourses } from "../canvas/courses.js";
import {
    getUpcomingAssignments,
    getUnsubmittedAssignments,
    getAssignmentDetails,
    findAssignmentById,
    getAllAssignments,
} from "../canvas/assignments.js";
import { getLatestAnnouncements, getAnnouncementDetails, findAnnouncementById } from "../canvas/announcements.js";
import {
    getCourseDiscussions,
    getAllDiscussions,
    getDiscussionDetails,
    findDiscussionById,
} from "../canvas/discussions.js";
import {
    downloadCanvasFile,
    extractFileContent,
    extractStructuredAttachments,
    getCourseFiles,
} from "../canvas/files.js";
import { getCourseModules, getCoursePage } from "../canvas/modules.js";
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
        description: "Fetches full professor instructions, rubric, points, deadline, attached file links/IDs, and submission rules for a specific assignment.",
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
        name: "read_canvas_file",
        description: "Downloads and reads the full text, instructions, datasets, and visual graphs/diagrams from any Canvas file, assignment attachment, discussion topic dataset, or announcement document (PDF, Word .docx, PNG, JPG, code, CSV, Excel, text). Use this whenever questions, rubrics, datasets, or materials are inside an attached document or image.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                fileId: {
                    type: Type.INTEGER,
                    description: "The numeric Canvas file ID (e.g. 10423) if available.",
                },
                fileUrl: {
                    type: Type.STRING,
                    description: "The download URL of the attached file if numeric ID is not known.",
                },
                filename: {
                    type: Type.STRING,
                    description: "The filename of the attached document (e.g. 'Data.csv' or 'Prompt.pdf').",
                },
                assignmentId: {
                    type: Type.INTEGER,
                    description: "Optional assignment ID if reading a file attached to an assignment.",
                },
                topicId: {
                    type: Type.INTEGER,
                    description: "Optional discussion topic ID if reading a dataset or file attached to a discussion forum.",
                },
                announcementId: {
                    type: Type.INTEGER,
                    description: "Optional announcement ID if reading a file attached to an announcement.",
                },
                courseId: {
                    type: Type.INTEGER,
                    description: "Optional course ID if known.",
                },
            },
        },
    },
    {
        name: "read_assignment_file",
        description: "Alias for read_canvas_file. Downloads and reads attached assignment documents, datasets, or images.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                fileId: {
                    type: Type.INTEGER,
                    description: "The numeric Canvas file ID (e.g. 10423) if available.",
                },
                fileUrl: {
                    type: Type.STRING,
                    description: "The download URL of the attached file if numeric ID is not known.",
                },
                filename: {
                    type: Type.STRING,
                    description: "The filename of the attached document (e.g. 'Lab3_Instructions.pdf').",
                },
                assignmentId: {
                    type: Type.INTEGER,
                    description: "Optional assignment ID to find attached files for.",
                },
            },
        },
    },
    {
        name: "get_course_modules",
        description: "Lists all weekly learning modules, units, lecture pages, slides, and learning items for a specific Canvas course.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                courseId: {
                    type: Type.INTEGER,
                    description: "The numeric Canvas course ID (e.g. 523).",
                },
            },
            required: ["courseId"],
        },
    },
    {
        name: "get_course_files",
        description: "Lists or searches downloadable files, lecture slide decks, syllabus files, and documents in a Canvas course's Files repository.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                courseId: {
                    type: Type.INTEGER,
                    description: "The numeric Canvas course ID (e.g. 523).",
                },
                searchTerm: {
                    type: Type.STRING,
                    description: "Optional keyword to search for specific files (e.g. 'Lecture 3', 'Syllabus', 'Cheat Sheet').",
                },
                limit: {
                    type: Type.INTEGER,
                    description: "Maximum number of files to retrieve (default: 20).",
                },
            },
            required: ["courseId"],
        },
    },
    {
        name: "get_course_page",
        description: "Fetches full text, lecture notes, syllabus, or instructional content from a Canvas course wiki page.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                courseId: {
                    type: Type.INTEGER,
                    description: "The numeric Canvas course ID.",
                },
                pageUrl: {
                    type: Type.STRING,
                    description: "The page URL slug or ID (e.g. 'syllabus' or 'week-1-lecture-notes').",
                },
            },
            required: ["courseId", "pageUrl"],
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
        name: "get_announcement_details",
        description: "Fetches full content, professor announcement text, instructions, and date for a specific course announcement.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                announcementId: {
                    type: Type.INTEGER,
                    description: "The numeric Canvas announcement ID (e.g. 5822).",
                },
                announcementTitle: {
                    type: Type.STRING,
                    description: "The title or keyword of the announcement to search for if ID is unknown.",
                },
                courseId: {
                    type: Type.INTEGER,
                    description: "Optional course ID if known.",
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
                const structuredAttachments = extractStructuredAttachments(rawDesc);
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
                    has_attached_files: structuredAttachments.length > 0 || attachedFiles.length > 0,
                    attachments: structuredAttachments.map((att) => ({
                        id: att.id,
                        filename: att.filename,
                        name: att.displayName,
                        url: att.url,
                    })),
                    attached_files: attachedFiles,
                    instructions_text: markdownText || "(No written text instructions found)",
                    recommended_action: structuredAttachments.length > 0
                        ? "Assignment has attached document(s). Call read_assignment_file to read the questions or instructions from the attached file."
                        : undefined,
                    url: assignment.html_url,
                };
            }

            case "read_canvas_file":
            case "read_assignment_file": {
                let targetFileId: number | string | undefined = args.fileId;
                let targetUrl: string | undefined = args.fileUrl;
                let targetFilename: string | undefined = args.filename;

                // 1. If not directly provided, search via topicId or topicTitle (Discussion)
                if (!targetFileId && !targetUrl && (args.topicId || args.topicTitle)) {
                    let topic = null;
                    if (args.topicId) {
                        topic = args.courseId
                            ? await getDiscussionDetails(Number(args.courseId), Number(args.topicId))
                            : await findDiscussionById(Number(args.topicId));
                    } else if (args.topicTitle) {
                        const all = await getAllDiscussions();
                        const query = String(args.topicTitle).toLowerCase();
                        topic = all.find((t) => t.title.toLowerCase().includes(query)) || null;
                    }

                    if (topic) {
                        const attachments = extractStructuredAttachments(topic.message || "");
                        if (Array.isArray(topic.attachments)) {
                            for (const att of topic.attachments as any[]) {
                                const url = att.url;
                                const id = att.id;
                                const name = att.display_name || att.displayName || att.filename || "Attached File";
                                if (url && !attachments.some((a) => a.url === url || (id && a.id === id))) {
                                    attachments.push({
                                        id,
                                        filename: name,
                                        displayName: name,
                                        url,
                                    });
                                }
                            }
                        }

                        if (attachments.length > 0) {
                            if (targetFilename) {
                                const match = attachments.find(
                                    (att) =>
                                        att.filename.toLowerCase().includes(String(targetFilename).toLowerCase()) ||
                                        att.displayName.toLowerCase().includes(String(targetFilename).toLowerCase())
                                );
                                if (match) {
                                    targetFileId = match.id;
                                    targetUrl = match.url;
                                    targetFilename = match.filename;
                                }
                            }

                            if (!targetFileId && !targetUrl && attachments[0]) {
                                targetFileId = attachments[0].id;
                                targetUrl = attachments[0].url;
                                targetFilename = attachments[0].filename;
                            }
                        }
                    }
                }

                // 2. If not found, search via announcementId or announcementTitle
                if (!targetFileId && !targetUrl && (args.announcementId || args.announcementTitle)) {
                    let announcement = null;
                    if (args.announcementId) {
                        announcement = args.courseId
                            ? await getAnnouncementDetails(Number(args.courseId), Number(args.announcementId))
                            : await findAnnouncementById(Number(args.announcementId));
                    } else if (args.announcementTitle) {
                        const list = await getLatestAnnouncements(undefined, 25);
                        const query = String(args.announcementTitle).toLowerCase();
                        announcement = list.find((a) => a.title.toLowerCase().includes(query)) || null;
                    }

                    if (announcement) {
                        const attachments = extractStructuredAttachments(announcement.message || "");
                        if (Array.isArray(announcement.attachments)) {
                            for (const att of announcement.attachments as any[]) {
                                const url = att.url;
                                const id = att.id;
                                const name = att.display_name || att.displayName || att.filename || "Attached File";
                                if (url && !attachments.some((a) => a.url === url || (id && a.id === id))) {
                                    attachments.push({
                                        id,
                                        filename: name,
                                        displayName: name,
                                        url,
                                    });
                                }
                            }
                        }

                        if (attachments.length > 0) {
                            if (targetFilename) {
                                const match = attachments.find(
                                    (att) =>
                                        att.filename.toLowerCase().includes(String(targetFilename).toLowerCase()) ||
                                        att.displayName.toLowerCase().includes(String(targetFilename).toLowerCase())
                                );
                                if (match) {
                                    targetFileId = match.id;
                                    targetUrl = match.url;
                                    targetFilename = match.filename;
                                }
                            }

                            if (!targetFileId && !targetUrl && attachments[0]) {
                                targetFileId = attachments[0].id;
                                targetUrl = attachments[0].url;
                                targetFilename = attachments[0].filename;
                            }
                        }
                    }
                }

                // 3. If not found, search via assignmentId or assignmentTitle
                if (!targetFileId && !targetUrl && (args.assignmentId || args.assignmentTitle)) {
                    let assignment = null;
                    if (args.assignmentId) {
                        assignment = await findAssignmentById(Number(args.assignmentId));
                    } else if (args.assignmentTitle) {
                        const all = await getAllAssignments();
                        const query = String(args.assignmentTitle).toLowerCase();
                        assignment = all.find((a) => a.name.toLowerCase().includes(query)) || null;
                    }

                    if (assignment && assignment.description) {
                        const attachments = extractStructuredAttachments(assignment.description);
                        if (attachments.length > 0) {
                            if (targetFilename) {
                                const match = attachments.find(
                                    (att) =>
                                        att.filename.toLowerCase().includes(String(targetFilename).toLowerCase()) ||
                                        att.displayName.toLowerCase().includes(String(targetFilename).toLowerCase())
                                );
                                if (match) {
                                    targetFileId = match.id;
                                    targetUrl = match.url;
                                    targetFilename = match.filename;
                                }
                            }

                            if (!targetFileId && !targetUrl && attachments[0]) {
                                targetFileId = attachments[0].id;
                                targetUrl = attachments[0].url;
                                targetFilename = attachments[0].filename;
                            }
                        }
                    }
                }

                // 4. If not found, search course files repository if courseId and filename are provided
                if (!targetFileId && !targetUrl && args.courseId && targetFilename) {
                    const courseFiles = await getCourseFiles(Number(args.courseId), String(targetFilename));
                    if (courseFiles.length > 0 && courseFiles[0]) {
                        targetFileId = courseFiles[0].id;
                        targetUrl = courseFiles[0].url;
                        targetFilename = courseFiles[0].display_name || courseFiles[0].filename;
                    }
                }

                const lookupTarget = targetFileId || targetUrl;
                if (!lookupTarget) {
                    return {
                        error: "Could not locate the file to read. Please provide fileId, fileUrl, assignmentId, topicId, announcementId, or courseId with a filename.",
                    };
                }

                const downloaded = await downloadCanvasFile(lookupTarget);
                if (!downloaded) {
                    return {
                        error: `Failed to download file [${targetFilename || lookupTarget}] from Canvas. The file may be locked, deleted, or hosted on an external drive.`,
                    };
                }

                const extracted = await extractFileContent(
                    downloaded.buffer,
                    downloaded.mimeType,
                    downloaded.filename
                );

                return {
                    filename: downloaded.filename,
                    file_type: extracted.fileType,
                    num_pages: extracted.numPages,
                    character_count: extracted.charCount,
                    is_truncated: extracted.isTruncated,
                    file_content: extracted.text,
                };
            }

            case "get_course_modules": {
                const modules = await getCourseModules(Number(args.courseId));
                return modules.map((m) => ({
                    id: m.id,
                    name: m.name,
                    state: m.state,
                    items_count: m.items_count ?? m.items?.length ?? 0,
                    items: m.items?.map((it) => ({
                        id: it.id,
                        title: it.title,
                        type: it.type,
                        content_id: it.content_id,
                        page_url: it.page_url,
                        html_url: it.html_url || it.url,
                    })) || [],
                }));
            }

            case "get_course_files": {
                const limit = Number(args.limit) || 25;
                const files = await getCourseFiles(Number(args.courseId), args.searchTerm, limit);
                return files.map((f) => ({
                    id: f.id,
                    name: f.display_name || f.filename,
                    filename: f.filename,
                    size_bytes: f.size,
                    content_type: f["content-type"],
                    updated_at: f.updated_at,
                    url: f.url,
                }));
            }

            case "get_course_page": {
                const page = await getCoursePage(Number(args.courseId), String(args.pageUrl));
                if (!page) {
                    return { error: `Course page '${args.pageUrl}' not found for course #${args.courseId}.` };
                }

                const rawBody = page.body || "";
                const structuredAttachments = extractStructuredAttachments(rawBody);
                const markdownText = rawBody.trim() ? turndown.turndown(rawBody) : "";

                return {
                    title: page.title,
                    url: page.url,
                    html_url: page.html_url,
                    content_text: markdownText || "(Empty page)",
                    has_attached_files: structuredAttachments.length > 0,
                    attachments: structuredAttachments.map((att) => ({
                        id: att.id,
                        filename: att.filename,
                        name: att.displayName,
                        url: att.url,
                    })),
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

            case "get_announcement_details": {
                let announcement = null;
                if (args.announcementId) {
                    if (args.courseId) {
                        announcement = await getAnnouncementDetails(Number(args.courseId), Number(args.announcementId));
                    } else {
                        announcement = await findAnnouncementById(Number(args.announcementId));
                    }
                } else if (args.announcementTitle) {
                    const list = await getLatestAnnouncements(undefined, 25);
                    const query = String(args.announcementTitle).toLowerCase();
                    announcement = list.find((a) => a.title.toLowerCase().includes(query)) || null;
                }

                if (!announcement) {
                    return { error: `Announcement '${args.announcementTitle || args.announcementId}' not found.` };
                }

                const rawMsg = announcement.message || "";
                const structuredAttachments = extractStructuredAttachments(rawMsg);
                if (Array.isArray(announcement.attachments)) {
                    for (const att of announcement.attachments as any[]) {
                        const url = att.url;
                        const id = att.id;
                        const name = att.display_name || att.displayName || att.filename || "Attached File";
                        if (url && !structuredAttachments.some((a) => a.url === url || (id && a.id === id))) {
                            structuredAttachments.push({
                                id,
                                filename: name,
                                displayName: name,
                                url,
                            });
                        }
                    }
                }
                const markdownText = rawMsg.trim() ? turndown.turndown(rawMsg) : "";

                return {
                    id: announcement.id,
                    title: announcement.title,
                    course: announcement.courseName,
                    author: announcement.author?.display_name,
                    posted_at: announcement.posted_at || announcement.created_at,
                    has_attached_files: structuredAttachments.length > 0,
                    attachments: structuredAttachments.map((att) => ({
                        id: att.id,
                        filename: att.filename,
                        name: att.displayName,
                        url: att.url,
                    })),
                    content_text: markdownText || "(No message body)",
                    recommended_action: structuredAttachments.length > 0
                        ? "Announcement has attached file(s) or document(s). Call read_canvas_file to read the file contents."
                        : undefined,
                    url: announcement.html_url || announcement.url,
                };
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
                const structuredAttachments = extractStructuredAttachments(rawMsg);
                if (Array.isArray(topic.attachments)) {
                    for (const att of topic.attachments as any[]) {
                        const url = att.url;
                        const id = att.id;
                        const name = att.display_name || att.displayName || att.filename || "Attached File";
                        if (url && !structuredAttachments.some((a) => a.url === url || (id && a.id === id))) {
                            structuredAttachments.push({
                                id,
                                filename: name,
                                displayName: name,
                                url,
                            });
                        }
                    }
                }
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
                    has_attached_files: structuredAttachments.length > 0,
                    attachments: structuredAttachments.map((att) => ({
                        id: att.id,
                        filename: att.filename,
                        name: att.displayName,
                        url: att.url,
                    })),
                    instructions_text: markdownText || "(No prompt text provided)",
                    recommended_action: structuredAttachments.length > 0
                        ? "Discussion topic has attached file(s) or dataset(s). Call read_canvas_file to read the dataset or questions."
                        : undefined,
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

