import type { Context } from "grammy";
import { env } from "../config/env.js";
import { getCurrentUser } from "../canvas/client.js";
import { extractFileContent } from "../canvas/files.js";
import { askGeminiAgent } from "../ai/agent.js";
import { replyAiChunksSafe } from "./commands.js";

/**
 * Handles incoming photo messages sent directly by the student in Telegram chat.
 * Uses Gemini Multimodal Vision to extract text, diagrams, and formulas from the image.
 */
export async function handleIncomingPhoto(ctx: Context): Promise<void> {
    const photos = ctx.message?.photo;
    if (!photos || photos.length === 0 || !ctx.chat) return;

    // Pick highest resolution photo
    const bestPhoto = photos[photos.length - 1]!;

    await ctx.replyWithChatAction("typing");

    try {
        const file = await ctx.getFile();
        if (!file.file_path) {
            await ctx.reply("❌ <b>Could not retrieve photo from Telegram.</b> Please try sending it again.", {
                parse_mode: "HTML",
            });
            return;
        }

        const downloadUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const res = await fetch(downloadUrl);
        if (!res.ok) {
            await ctx.reply("❌ <b>Failed to download photo from Telegram servers.</b>", { parse_mode: "HTML" });
            return;
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Run Gemini Vision analysis
        const extracted = await extractFileContent(buffer, "image/jpeg", "telegram_photo.jpg");

        const userCaption = ctx.message?.caption?.trim() || "";
        let prompt = "";

        if (userCaption) {
            prompt = `The student sent a photo with the following question/caption:\n` +
                `"${userCaption}"\n\n` +
                `Here is the automated visual extraction and diagram analysis of the photo:\n` +
                `---\n${extracted.text}\n---\n\n` +
                `Please answer the student's question thoroughly with step-by-step logic, formulas, or code.`;
        } else {
            prompt = `The student sent a photo of their academic material / problem / notes without a caption.\n\n` +
                `Here is the automated visual extraction and diagram analysis of the photo:\n` +
                `---\n${extracted.text}\n---\n\n` +
                `Please provide a comprehensive explanation of this material, solve any visible homework/worksheet questions step-by-step, explain graphs/charts, and summarize the key takeaways.`;
        }

        const user = await getCurrentUser().catch(() => undefined);
        const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
        await replyAiChunksSafe(ctx, response);
    } catch (err: any) {
        console.error("Error in handleIncomingPhoto:", err);
        await ctx.reply(`❌ <b>AI Error:</b> ${err.message || "Failed to process photo."}`, {
            parse_mode: "HTML",
        });
    }
}

/**
 * Handles incoming document messages (PDFs, Word docs, code files, CSV/Excel datasets, text files).
 */
export async function handleIncomingDocument(ctx: Context): Promise<void> {
    const doc = ctx.message?.document;
    if (!doc || !ctx.chat) return;

    // Telegram Bot API 20MB limit check
    if (doc.file_size && doc.file_size > 20 * 1024 * 1024) {
        await ctx.reply(
            "⚠️ <b>File exceeds 20MB limit:</b> Telegram Bot API restricts file downloads to 20MB. Please upload a smaller file or copy-paste text directly.",
            { parse_mode: "HTML" }
        );
        return;
    }

    await ctx.replyWithChatAction("upload_document");

    try {
        const file = await ctx.getFile();
        if (!file.file_path) {
            await ctx.reply("❌ <b>Could not retrieve document from Telegram.</b> Please try again.", {
                parse_mode: "HTML",
            });
            return;
        }

        const downloadUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const res = await fetch(downloadUrl);
        if (!res.ok) {
            await ctx.reply("❌ <b>Failed to download document from Telegram servers.</b>", { parse_mode: "HTML" });
            return;
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = doc.file_name || "uploaded_file";
        const mimeType = doc.mime_type || "application/octet-stream";

        const extracted = await extractFileContent(buffer, mimeType, filename);

        if (!extracted.text || extracted.text.trim().length === 0) {
            await ctx.reply(
                `⚠️ <b>Unable to extract readable text from <code>${filename}</code>.</b>\n\n` +
                `Supported formats include: PDF, Word (<code>.docx</code>), Code (<code>.py, .js, .sql, .java</code>), Data (<code>.csv, .json, .txt</code>), and Images (<code>.png, .jpg</code>).`,
                { parse_mode: "HTML" }
            );
            return;
        }

        const userCaption = ctx.message?.caption?.trim() || "";
        let prompt = "";

        if (userCaption) {
            prompt = `The student uploaded a document (${filename}, type: ${extracted.fileType}) with the following request:\n` +
                `"${userCaption}"\n\n` +
                `Here is the extracted document content:\n` +
                `---\n${extracted.text}\n---\n\n` +
                `Please address the student's request, referencing the document content directly.`;
        } else {
            prompt = `The student uploaded a document (${filename}, type: ${extracted.fileType}) without a specific caption.\n\n` +
                `Here is the extracted document content:\n` +
                `---\n${extracted.text}\n---\n\n` +
                `Please analyze this document, summarize its core concepts, break down any questions or exercises, and provide structured academic feedback or solutions.`;
        }

        const user = await getCurrentUser().catch(() => undefined);
        const response = await askGeminiAgent(ctx.chat.id, prompt, user?.name);
        await replyAiChunksSafe(ctx, response);
    } catch (err: any) {
        console.error("Error in handleIncomingDocument:", err);
        await ctx.reply(`❌ <b>AI Error:</b> ${err.message || "Failed to process document."}`, {
            parse_mode: "HTML",
        });
    }
}
