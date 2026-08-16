import { Bot, type NextFunction, type Context } from "grammy";
import { env } from "../config/env.js";
import { storage } from "../services/storage.js";
import {
    handleStart,
    handleHelp,
    handleCourses,
    handleAssignments,
    handleNoDueDate,
    handlePast,
    handleAllAssignments,
    handleAssignmentDetail,
    handleTodo,
    handleCompleted,
    handleAnnouncements,
    handleStatus,
} from "./commands.js";
import { handleCallbackQuery } from "./callbacks.js";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

/**
 * Security middleware: Ensures only authorized Telegram user can interact with the bot.
 */
bot.use(async (ctx: Context, next: NextFunction) => {
    const fromId = ctx.from?.id;
    if (!fromId) return next();

    // If env specifies a strict user ID, enforce it
    if (env.TELEGRAM_ALLOWED_USER_ID && fromId !== env.TELEGRAM_ALLOWED_USER_ID) {
        console.warn(`[Security] Blocked unauthorized access attempt from Telegram ID: ${fromId}`);
        if (ctx.chat?.type === "private") {
            await ctx.reply("⛔ <b>Access Denied:</b> This bot is configured as a private personal assistant.", {
                parse_mode: "HTML",
            });
        }
        return;
    }

    // Otherwise check stored owner ID
    const allowedId = await storage.getAllowedUserId();
    if (allowedId && allowedId !== fromId) {
        console.warn(`[Security] Blocked unauthorized access attempt from Telegram ID: ${fromId}`);
        if (ctx.chat?.type === "private") {
            await ctx.reply("⛔ <b>Access Denied:</b> This bot is configured as a private personal assistant.", {
                parse_mode: "HTML",
            });
        }
        return;
    }

    return next();
});

/**
 * Register command list with Telegram Bot API menu.
 */
export async function setupBotCommands(): Promise<void> {
    await bot.api.setMyCommands([
        { command: "assignments", description: "View active & upcoming assignments" },
        { command: "todo", description: "View pending tasks needing action" },
        { command: "noduedate", description: "View assignments with no fixed deadline" },
        { command: "completed", description: "View submitted & graded work" },
        { command: "past", description: "View past / overdue assignments archive" },
        { command: "allassignments", description: "View master list of all assignments" },
        { command: "courses", description: "View active courses with interactive menu" },
        { command: "announcements", description: "View latest course announcements" },
        { command: "status", description: "View bot & Canvas sync status" },
        { command: "help", description: "Show help and command list" },
    ]);
}

// Register command handlers
bot.command("start", handleStart);
bot.command("help", handleHelp);
bot.command("courses", handleCourses);

// Assignment command variants
bot.command("assignments", handleAssignments);
bot.command("upcoming", handleAssignments);
bot.command("noduedate", handleNoDueDate);
bot.command("undated", handleNoDueDate);
bot.command("past", handlePast);
bot.command("overdue", handlePast);
bot.command("allassignments", handleAllAssignments);
bot.command("all", handleAllAssignments);
bot.command("assignment", handleAssignmentDetail);
bot.command("task", handleAssignmentDetail);
bot.command("todo", handleTodo);
bot.command("unsubmitted", handleTodo);
bot.command("completed", handleCompleted);
bot.command("submitted", handleCompleted);

// Announcements & system commands
bot.command("announcements", handleAnnouncements);
bot.command("status", handleStatus);
bot.command("sync", handleStatus);

// Register inline keyboard callback queries
bot.on("callback_query:data", handleCallbackQuery);

// Error boundary
bot.catch((err) => {
    console.error("❌ Grammy Bot Error:", err.error || err);
});
