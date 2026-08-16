import { Cron } from "croner";
import { env } from "../config/env.js";
import { bot } from "../bot/bot.js";
import { storage } from "./storage.js";
import { getActiveCourses } from "../canvas/courses.js";
import { getAllAssignments, isAssignmentSubmitted } from "../canvas/assignments.js";
import { getLatestAnnouncements } from "../canvas/announcements.js";
import {
    formatNewAnnouncementNotification,
    formatNewAssignmentNotification,
    formatDueReminderNotification,
} from "../bot/formatters.js";

export class CanvasNotifier {
    private cronJob: Cron | null = null;
    private isSyncing = false;

    /**
     * Starts the periodic background cron monitor.
     */
    public start(): void {
        console.log(`⏱️ Canvas background notifier scheduled with pattern: "${env.POLL_INTERVAL_CRON}"`);

        // Run initial sync right away on startup
        this.runSyncCycle().catch((err) => {
            console.error("Initial background sync failed:", err);
        });

        // Schedule recurring runs
        this.cronJob = new Cron(env.POLL_INTERVAL_CRON, async () => {
            await this.runSyncCycle();
        });
    }

    /**
     * Stops the background monitor.
     */
    public stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log("🛑 Canvas background notifier stopped.");
        }
    }

    /**
     * Executes a single sync cycle: checks announcements, new assignments, and due-soon reminders.
     */
    public async runSyncCycle(): Promise<void> {
        if (this.isSyncing) {
            console.log("⏳ Previous sync cycle still in progress. Skipping duplicate run.");
            return;
        }

        this.isSyncing = true;
        const startTime = Date.now();

        try {
            const state = await storage.getState();
            const isInitialRun = state.lastSyncAt === null;
            const targetChatId = await storage.getTargetChatId();

            // 1. Fetch active courses
            const activeCourses = await getActiveCourses();
            const courseIds = activeCourses.map((c) => c.id);

            if (courseIds.length === 0) {
                console.log("ℹ️ No active Canvas courses found.");
                await storage.updateSyncTimestamp(0);
                return;
            }

            // 2. Check Announcements
            const announcements = await getLatestAnnouncements(courseIds, 20);
            for (const announcement of announcements) {
                const isSeen = await storage.isAnnouncementSeen(announcement.id);
                if (!isSeen) {
                    // Send notification if not initial cold start and target chat is registered
                    if (!isInitialRun && targetChatId) {
                        try {
                            const text = formatNewAnnouncementNotification(announcement);
                            await bot.api.sendMessage(targetChatId, text, {
                                parse_mode: "HTML",
                                link_preview_options: { is_disabled: true },
                            });
                            console.log(`📢 Dispatched announcement notification: "${announcement.title}"`);
                        } catch (sendErr) {
                            console.error(`Failed to send announcement notification #${announcement.id}:`, sendErr);
                        }
                    }
                    await storage.markAnnouncementSeen(announcement.id);
                }
            }

            // 3. Check Assignments & Due Reminders
            const assignments = await getAllAssignments(activeCourses);
            const now = new Date();

            for (const assignment of assignments) {
                const isSeen = await storage.isAssignmentSeen(assignment.id);

                // Notify if new assignment posted
                if (!isSeen) {
                    if (!isInitialRun && targetChatId && !isAssignmentSubmitted(assignment)) {
                        try {
                            const text = formatNewAssignmentNotification(assignment);
                            await bot.api.sendMessage(targetChatId, text, {
                                parse_mode: "HTML",
                                link_preview_options: { is_disabled: true },
                            });
                            console.log(`📝 Dispatched new assignment notification: "${assignment.name}"`);
                        } catch (sendErr) {
                            console.error(`Failed to send new assignment alert #${assignment.id}:`, sendErr);
                        }
                    }
                    await storage.markAssignmentSeen(assignment.id);
                }

                // Check Due Date Reminders (1 to 3 hours before due date)
                if (assignment.due_at && !isAssignmentSubmitted(assignment)) {
                    const dueDate = new Date(assignment.due_at);
                    const diffMs = dueDate.getTime() - now.getTime();
                    const diffHours = diffMs / (1000 * 60 * 60);

                    if (targetChatId && diffMs > 0) {
                        const sentReminders = (await storage.getSentDueReminder(assignment.id)) || {};

                        // 1-Hour Urgency Trigger (between 0 and 1.25 hours)
                        if (diffHours <= 1.25 && !sentReminders.reminder1h) {
                            try {
                                const text = formatDueReminderNotification(assignment, Math.max(1, Math.round(diffHours)));
                                await bot.api.sendMessage(targetChatId, text, {
                                    parse_mode: "HTML",
                                    link_preview_options: { is_disabled: true },
                                });
                                await storage.markDueReminderSent(assignment.id, "reminder1h");
                                console.log(`🚨 Dispatched 1-Hour deadline alert for "${assignment.name}"`);
                            } catch (sendErr) {
                                console.error(`Failed to send 1h deadline alert for #${assignment.id}:`, sendErr);
                            }
                        }
                        // 3-Hour Urgency Trigger (between 1.25 and 3.25 hours)
                        else if (diffHours <= 3.25 && diffHours > 1.25 && !sentReminders.reminder3h) {
                            try {
                                const text = formatDueReminderNotification(assignment, Math.round(diffHours));
                                await bot.api.sendMessage(targetChatId, text, {
                                    parse_mode: "HTML",
                                    link_preview_options: { is_disabled: true },
                                });
                                await storage.markDueReminderSent(assignment.id, "reminder3h");
                                console.log(`⏰ Dispatched 3-Hour deadline alert for "${assignment.name}"`);
                            } catch (sendErr) {
                                console.error(`Failed to send 3h deadline alert for #${assignment.id}:`, sendErr);
                            }
                        }
                    }
                }
            }

            await storage.updateSyncTimestamp(activeCourses.length);
            const elapsedMs = Date.now() - startTime;
            console.log(`✅ Canvas sync cycle complete (${elapsedMs}ms). Active courses: ${activeCourses.length}, Assignments: ${assignments.length}`);
        } catch (err) {
            console.error("❌ Error running Canvas sync cycle:", err);
        } finally {
            this.isSyncing = false;
        }
    }
}

export const notifier = new CanvasNotifier();
