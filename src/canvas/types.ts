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
  };
  context_code: string; // e.g. "course_12345"
  read_state?: "read" | "unread";
}
