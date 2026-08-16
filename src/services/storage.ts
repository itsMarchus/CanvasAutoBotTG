import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

export interface BotState {
  targetChatId: number | null;
  allowedUserId: number | null;
  seenAnnouncementIds: number[];
  seenAssignmentIds: number[];
  sentDueReminders: Record<string, { reminder3h?: boolean; reminder1h?: boolean }>;
  lastSyncAt: string | null;
  coursesCount: number;
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
  getSentDueReminder(assignmentId: number): Promise<{ reminder3h?: boolean; reminder1h?: boolean } | undefined>;
  markDueReminderSent(assignmentId: number, type: "reminder3h" | "reminder1h"): Promise<void>;
  updateSyncTimestamp(coursesCount?: number): Promise<void>;
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

export class FileStorageService implements IStorageService {
  private filePath: string;
  private memoryCache: BotState | null = null;
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
    // Chain writes to avoid concurrent write corruptions
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
    return state.targetChatId;
  }

  public async setTargetChatId(chatId: number): Promise<void> {
    const state = await this.getState();
    state.targetChatId = chatId;
    await this.saveState(state);
  }

  public async getAllowedUserId(): Promise<number | null> {
    const state = await this.getState();
    return state.allowedUserId;
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
      // Keep list within 500 items
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

  public async getSentDueReminder(assignmentId: number): Promise<{ reminder3h?: boolean; reminder1h?: boolean } | undefined> {
    const state = await this.getState();
    return state.sentDueReminders[String(assignmentId)];
  }

  public async markDueReminderSent(assignmentId: number, type: "reminder3h" | "reminder1h"): Promise<void> {
    const state = await this.getState();
    const key = String(assignmentId);
    if (!state.sentDueReminders[key]) {
      state.sentDueReminders[key] = {};
    }
    state.sentDueReminders[key]![type] = true;
    await this.saveState(state);
  }

  public async updateSyncTimestamp(coursesCount?: number): Promise<void> {
    const state = await this.getState();
    state.lastSyncAt = new Date().toISOString();
    if (coursesCount !== undefined) {
      state.coursesCount = coursesCount;
    }
    await this.saveState(state);
  }
}

export const storage = new FileStorageService();
