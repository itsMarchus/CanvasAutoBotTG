import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export type NotificationType = "new_item" | "reminder_3h" | "reminder_1h";

export interface BotState {
    targetChatId: number | null;
    allowedUserId: number | null;
    seenAnnouncementIds: number[];
    seenAssignmentIds: number[];
    sentDueReminders: Record<string, { reminder_3h?: boolean; reminder_1h?: boolean }>;
    lastSyncAt: string | null;
    coursesCount: number;
}

export interface ChatMessage {
    role: "user" | "model" | "system";
    content: string;
    createdAt?: string;
}

export interface IStorageService {
    getState(): Promise<BotState>;
    saveState(state: BotState): Promise<void>;
    getTargetChatId(): Promise<number | null>;
    setTargetChatId(chatId: number): Promise<void>;
    getAllowedUserId(): Promise<number | null>;
    setAllowedUserId(userId: number): Promise<void>;
    isAnnouncementSeen(id: number): Promise<boolean>;
    markAnnouncementSeen(id: number): Promise<void>;
    isAssignmentSeen(id: number): Promise<boolean>;
    markAssignmentSeen(id: number): Promise<void>;
    getSentDueReminder(assignmentId: number): Promise<{ reminder_3h?: boolean; reminder_1h?: boolean } | undefined>;
    markDueReminderSent(assignmentId: number, type: "reminder_3h" | "reminder_1h"): Promise<void>;
    logNotification(itemType: "assignment" | "announcement", canvasId: number, notificationType: NotificationType): Promise<void>;
    updateSyncTimestamp(coursesCount?: number): Promise<void>;
    getChatHistory(chatId: number, limit?: number): Promise<ChatMessage[]>;
    appendChatMessage(chatId: number, role: "user" | "model" | "system", content: string): Promise<void>;
    clearChatHistory(chatId: number): Promise<void>;
}

const DEFAULT_STATE: BotState = {
    targetChatId: null,
    allowedUserId: null,
    seenAnnouncementIds: [],
    seenAssignmentIds: [],
    sentDueReminders: {},
    lastSyncAt: null,
    coursesCount: 0,
};

/**
 * Local JSON file storage service (Fallback).
 */
export class FileStorageService implements IStorageService {
    private filePath: string;
    private memoryCache: BotState | null = null;
    private memoryChatHistory: Map<number, ChatMessage[]> = new Map();
    private writePromise: Promise<void> = Promise.resolve();

    constructor(filePath = path.resolve(process.cwd(), "data", "state.json")) {
        this.filePath = filePath;
    }

    private async ensureDir(): Promise<void> {
        const dir = path.dirname(this.filePath);
        if (!existsSync(dir)) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    public async getState(): Promise<BotState> {
        if (this.memoryCache) {
            return this.memoryCache;
        }

        try {
            await this.ensureDir();
            if (existsSync(this.filePath)) {
                const raw = await fs.readFile(this.filePath, "utf-8");
                const parsed = JSON.parse(raw);
                this.memoryCache = { ...DEFAULT_STATE, ...parsed };
                return this.memoryCache!;
            }
        } catch (err) {
            console.warn("Could not read state file, initializing default state:", err);
        }

        this.memoryCache = { ...DEFAULT_STATE };
        await this.saveState(this.memoryCache);
        return this.memoryCache;
    }

    public async saveState(state: BotState): Promise<void> {
        this.memoryCache = state;
        this.writePromise = this.writePromise.then(async () => {
            await this.ensureDir();
            const tempPath = `${this.filePath}.tmp`;
            await fs.writeFile(tempPath, JSON.stringify(state, null, 2), "utf-8");
            await fs.rename(tempPath, this.filePath);
        });
        return this.writePromise;
    }

    public async getTargetChatId(): Promise<number | null> {
        const state = await this.getState();
        return state.targetChatId || env.TELEGRAM_ALLOWED_USER_ID || null;
    }

    public async setTargetChatId(chatId: number): Promise<void> {
        const state = await this.getState();
        state.targetChatId = chatId;
        await this.saveState(state);
    }

    public async getAllowedUserId(): Promise<number | null> {
        const state = await this.getState();
        return state.allowedUserId || env.TELEGRAM_ALLOWED_USER_ID || null;
    }

    public async setAllowedUserId(userId: number): Promise<void> {
        const state = await this.getState();
        state.allowedUserId = userId;
        await this.saveState(state);
    }

    public async isAnnouncementSeen(id: number): Promise<boolean> {
        const state = await this.getState();
        return state.seenAnnouncementIds.includes(id);
    }

    public async markAnnouncementSeen(id: number): Promise<void> {
        const state = await this.getState();
        if (!state.seenAnnouncementIds.includes(id)) {
            state.seenAnnouncementIds.push(id);
            if (state.seenAnnouncementIds.length > 500) {
                state.seenAnnouncementIds = state.seenAnnouncementIds.slice(-500);
            }
            await this.saveState(state);
        }
    }

    public async isAssignmentSeen(id: number): Promise<boolean> {
        const state = await this.getState();
        return state.seenAssignmentIds.includes(id);
    }

    public async markAssignmentSeen(id: number): Promise<void> {
        const state = await this.getState();
        if (!state.seenAssignmentIds.includes(id)) {
            state.seenAssignmentIds.push(id);
            if (state.seenAssignmentIds.length > 500) {
                state.seenAssignmentIds = state.seenAssignmentIds.slice(-500);
            }
            await this.saveState(state);
        }
    }

    public async getSentDueReminder(assignmentId: number): Promise<{ reminder_3h?: boolean; reminder_1h?: boolean } | undefined> {
        const state = await this.getState();
        return state.sentDueReminders[String(assignmentId)];
    }

    public async markDueReminderSent(assignmentId: number, type: "reminder_3h" | "reminder_1h"): Promise<void> {
        const state = await this.getState();
        const key = String(assignmentId);
        if (!state.sentDueReminders[key]) {
            state.sentDueReminders[key] = {};
        }
        state.sentDueReminders[key]![type] = true;
        await this.saveState(state);
    }

    public async logNotification(itemType: "assignment" | "announcement", canvasId: number, notificationType: NotificationType): Promise<void> {
        if (notificationType === "reminder_3h" || notificationType === "reminder_1h") {
            await this.markDueReminderSent(canvasId, notificationType);
        }
    }

    public async updateSyncTimestamp(coursesCount?: number): Promise<void> {
        const state = await this.getState();
        state.lastSyncAt = new Date().toISOString();
        if (coursesCount !== undefined) {
            state.coursesCount = coursesCount;
        }
        await this.saveState(state);
    }

    public async getChatHistory(chatId: number, limit = 12): Promise<ChatMessage[]> {
        const list = this.memoryChatHistory.get(chatId) || [];
        return list.slice(-limit);
    }

    public async appendChatMessage(chatId: number, role: "user" | "model" | "system", content: string): Promise<void> {
        const list = this.memoryChatHistory.get(chatId) || [];
        list.push({ role, content, createdAt: new Date().toISOString() });
        if (list.length > 50) {
            list.splice(0, list.length - 50);
        }
        this.memoryChatHistory.set(chatId, list);
    }

    public async clearChatHistory(chatId: number): Promise<void> {
        this.memoryChatHistory.delete(chatId);
    }
}

/**
 * Cloud PostgreSQL / Supabase storage service with Row-Level Security support.
 */
export class SupabaseStorageService implements IStorageService {
    private client: SupabaseClient;

    constructor() {
        this.client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false },
        });
    }

    public async getState(): Promise<BotState> {
        const [userRes, seenAnnouncementsRes, seenAssignmentsRes, remindersRes, syncRes] = await Promise.all([
            this.client.from("bot_users").select("telegram_chat_id, telegram_user_id").limit(1).maybeSingle(),
            this.client.from("seen_items").select("canvas_id").eq("item_type", "announcement"),
            this.client.from("seen_items").select("canvas_id").eq("item_type", "assignment"),
            this.client.from("notification_logs").select("canvas_id, notification_type").eq("item_type", "assignment"),
            this.client.from("system_sync_state").select("last_sync_at, courses_count").eq("id", 1).maybeSingle(),
        ]);

        const sentDueReminders: Record<string, { reminder_3h?: boolean; reminder_1h?: boolean }> = {};
        if (remindersRes.data) {
            for (const row of remindersRes.data) {
                const key = String(row.canvas_id);
                if (!sentDueReminders[key]) sentDueReminders[key] = {};
                if (row.notification_type === "reminder_3h" || row.notification_type === "reminder3h") sentDueReminders[key]!.reminder_3h = true;
                if (row.notification_type === "reminder_1h" || row.notification_type === "reminder1h") sentDueReminders[key]!.reminder_1h = true;
            }
        }

        return {
            targetChatId: userRes.data?.telegram_chat_id ? Number(userRes.data.telegram_chat_id) : (env.TELEGRAM_ALLOWED_USER_ID || null),
            allowedUserId: userRes.data?.telegram_user_id ? Number(userRes.data.telegram_user_id) : (env.TELEGRAM_ALLOWED_USER_ID || null),
            seenAnnouncementIds: seenAnnouncementsRes.data ? seenAnnouncementsRes.data.map((r) => Number(r.canvas_id)) : [],
            seenAssignmentIds: seenAssignmentsRes.data ? seenAssignmentsRes.data.map((r) => Number(r.canvas_id)) : [],
            sentDueReminders,
            lastSyncAt: syncRes.data?.last_sync_at || null,
            coursesCount: syncRes.data?.courses_count || 0,
        };
    }

    public async saveState(_state: BotState): Promise<void> {
        // Supabase handles atomic individual updates
    }

    public async getTargetChatId(): Promise<number | null> {
        const { data } = await this.client.from("bot_users").select("telegram_chat_id").limit(1).maybeSingle();
        if (data?.telegram_chat_id) {
            return Number(data.telegram_chat_id);
        }
        return env.TELEGRAM_ALLOWED_USER_ID || null;
    }

    public async setTargetChatId(chatId: number): Promise<void> {
        const existing = await this.client.from("bot_users").select("id").limit(1).maybeSingle();
        if (existing.data?.id) {
            await this.client.from("bot_users").update({ telegram_chat_id: chatId, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
        } else {
            await this.client.from("bot_users").insert({ telegram_chat_id: chatId, telegram_user_id: chatId });
        }
    }

    public async getAllowedUserId(): Promise<number | null> {
        const { data } = await this.client.from("bot_users").select("telegram_user_id").limit(1).maybeSingle();
        if (data?.telegram_user_id) {
            return Number(data.telegram_user_id);
        }
        return env.TELEGRAM_ALLOWED_USER_ID || null;
    }

    public async setAllowedUserId(userId: number): Promise<void> {
        const existing = await this.client.from("bot_users").select("id").limit(1).maybeSingle();
        if (existing.data?.id) {
            await this.client.from("bot_users").update({ telegram_user_id: userId, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
        } else {
            await this.client.from("bot_users").insert({ telegram_chat_id: userId, telegram_user_id: userId });
        }
    }

    public async isAnnouncementSeen(id: number): Promise<boolean> {
        const { data } = await this.client
            .from("seen_items")
            .select("id")
            .eq("item_type", "announcement")
            .eq("canvas_id", id)
            .maybeSingle();
        return Boolean(data);
    }

    public async markAnnouncementSeen(id: number): Promise<void> {
        await this.client.from("seen_items").upsert(
            { item_type: "announcement", canvas_id: id },
            { onConflict: "item_type, canvas_id" }
        );
    }

    public async isAssignmentSeen(id: number): Promise<boolean> {
        const { data } = await this.client
            .from("seen_items")
            .select("id")
            .eq("item_type", "assignment")
            .eq("canvas_id", id)
            .maybeSingle();
        return Boolean(data);
    }

    public async markAssignmentSeen(id: number): Promise<void> {
        await this.client.from("seen_items").upsert(
            { item_type: "assignment", canvas_id: id },
            { onConflict: "item_type, canvas_id" }
        );
    }

    public async getSentDueReminder(assignmentId: number): Promise<{ reminder_3h?: boolean; reminder_1h?: boolean } | undefined> {
        const { data, error } = await this.client
            .from("notification_logs")
            .select("notification_type")
            .eq("item_type", "assignment")
            .eq("canvas_id", assignmentId);

        if (error) {
            console.error(`[Storage] Error fetching notification_logs for assignment #${assignmentId}:`, error.message);
        }

        if (!data || data.length === 0) return undefined;

        const result: { reminder_3h?: boolean; reminder_1h?: boolean } = {};
        for (const row of data) {
            if (row.notification_type === "reminder_3h" || row.notification_type === "reminder3h") result.reminder_3h = true;
            if (row.notification_type === "reminder_1h" || row.notification_type === "reminder1h") result.reminder_1h = true;
        }
        return result;
    }

    public async markDueReminderSent(assignmentId: number, type: "reminder_3h" | "reminder_1h"): Promise<void> {
        await this.logNotification("assignment", assignmentId, type);
    }

    public async logNotification(itemType: "assignment" | "announcement", canvasId: number, notificationType: NotificationType): Promise<void> {
        const { error } = await this.client.from("notification_logs").upsert(
            { item_type: itemType, canvas_id: canvasId, notification_type: notificationType, sent_at: new Date().toISOString() },
            { onConflict: "item_type, canvas_id, notification_type" }
        );
        if (error) {
            console.error(`[Storage] Error recording notification_log (${itemType} #${canvasId}, ${notificationType}):`, error.message);
        }
    }

    public async updateSyncTimestamp(coursesCount?: number): Promise<void> {
        await this.client.from("system_sync_state").upsert(
            {
                id: 1,
                last_sync_at: new Date().toISOString(),
                courses_count: coursesCount ?? 0,
            },
            { onConflict: "id" }
        );
    }

    public async getChatHistory(chatId: number, limit = 12): Promise<ChatMessage[]> {
        try {
            const { data, error } = await this.client
                .from("chat_history")
                .select("role, content, created_at")
                .eq("telegram_chat_id", chatId)
                .order("created_at", { ascending: false })
                .limit(limit);

            if (error || !data) return [];

            return data
                .reverse()
                .map((row) => ({
                    role: row.role as "user" | "model" | "system",
                    content: row.content,
                    createdAt: row.created_at,
                }));
        } catch (err) {
            console.error("Error fetching chat history from Supabase:", err);
            return [];
        }
    }

    public async appendChatMessage(chatId: number, role: "user" | "model" | "system", content: string): Promise<void> {
        try {
            await this.client.from("chat_history").insert({
                telegram_chat_id: chatId,
                role,
                content,
            });
        } catch (err) {
            console.error("Error saving chat message to Supabase:", err);
        }
    }

    public async clearChatHistory(chatId: number): Promise<void> {
        try {
            await this.client.from("chat_history").delete().eq("telegram_chat_id", chatId);
        } catch (err) {
            console.error("Error clearing chat history in Supabase:", err);
        }
    }
}

// Automatically choose Supabase if credentials are provided, else fallback to file storage
const useSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
if (useSupabase) {
    console.log("🗄️ Storage Engine: Cloud Supabase PostgreSQL (RLS Enabled)");
} else {
    console.log("📁 Storage Engine: Local File System (data/state.json)");
}

export const storage: IStorageService = useSupabase ? new SupabaseStorageService() : new FileStorageService();
