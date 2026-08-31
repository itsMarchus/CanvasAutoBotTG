export interface CanvasUser {
    id: number;
    name: string;
    short_name?: string;
    sortable_name?: string;
    avatar_url?: string;
    primary_email?: string;
    login_id?: string;
}

export interface CanvasTerm {
    id: number;
    name: string;
    start_at?: string | null;
    end_at?: string | null;
}

export interface CanvasCourse {
    id: number;
    name: string;
    course_code?: string;
    original_name?: string;
    workflow_state?: "unpublished" | "available" | "completed" | "deleted";
    start_at?: string | null;
    end_at?: string | null;
    enrollment_term_id?: number;
    term?: CanvasTerm;
    enrollments?: Array<{
        type: string;
        role: string;
        enrollment_state: "active" | "invited" | "creation_pending" | "completed" | "rejected";
    }>;
    total_students?: number;
    access_restricted_by_date?: boolean;
}

export interface CanvasSubmission {
    id: number;
    assignment_id: number;
    user_id: number;
    workflow_state: "submitted" | "unsubmitted" | "graded" | "pending_review";
    grade?: string | null;
    score?: number | null;
    submitted_at?: string | null;
    graded_at?: string | null;
    attempt?: number;
    late?: boolean;
    missing?: boolean;
    preview_url?: string;
}

export interface CanvasAssignment {
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at: string;
    due_at: string | null;
    lock_at: string | null;
    unlock_at: string | null;
    has_submitted_submissions?: boolean;
    points_possible?: number | null;
    grading_type?: string;
    submission_types?: string[];
    html_url: string;
    course_id: number;
    submission?: CanvasSubmission;
    has_overrides?: boolean;
    published?: boolean;
}

export interface CanvasAnnouncement {
    id: number;
    title: string;
    message: string;
    posted_at: string;
    created_at: string;
    url: string;
    html_url: string;
    author?: {
        id: number;
        display_name: string;
        avatar_image_url?: string;
    } | undefined;
    context_code: string; // e.g. "course_12345"
    read_state?: "read" | "unread" | undefined;
    attachments?: Array<CanvasFile | CanvasFileAttachment | Record<string, any>> | undefined;
}

export interface CanvasDiscussionTopic {
    id: number;
    title: string;
    message?: string | null | undefined;
    posted_at?: string | null | undefined;
    created_at: string;
    last_reply_at?: string | null | undefined;
    delayed_post_at?: string | null | undefined;
    lock_at?: string | null | undefined;
    todo_date?: string | null | undefined;
    assignment_id?: number | null | undefined;
    discussion_type?: "side_comment" | "threaded" | undefined;
    user_name?: string | undefined;
    discussion_subentry_count?: number | undefined;
    unread_count?: number | undefined;
    subscribed?: boolean | undefined;
    published?: boolean | undefined;
    locked?: boolean | undefined;
    author?: {
        id: number;
        display_name: string;
        avatar_image_url?: string;
        html_url?: string;
    } | undefined;
    html_url: string;
    url: string;
    pinned?: boolean | undefined;
    require_initial_post?: boolean | undefined;
    is_announcement?: boolean | undefined;
    attachments?: Array<CanvasFile | CanvasFileAttachment | Record<string, any>> | undefined;
}

export interface CanvasFile {
    id: number;
    folder_id?: number | undefined;
    display_name: string;
    filename: string;
    "content-type"?: string | undefined;
    url?: string | undefined;
    size?: number | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    unlock_at?: string | null | undefined;
    locked?: boolean | undefined;
    hidden?: boolean | undefined;
    thumbnail_url?: string | null | undefined;
    mime_class?: string | undefined;
}

export interface CanvasFileAttachment {
    id?: number | undefined;
    filename: string;
    displayName: string;
    url: string;
    size?: number | undefined;
    contentType?: string | undefined;
}


