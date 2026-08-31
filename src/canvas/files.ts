import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { env } from "../config/env.js";
import { canvasFetch } from "./client.js";
import type { CanvasFile, CanvasFileAttachment } from "./types.js";

/**
 * Fetches file metadata by ID from Canvas API.
 */
export async function getCanvasFileMetadata(fileId: number): Promise<CanvasFile | null> {
    try {
        return await canvasFetch<CanvasFile>(`/files/${fileId}`);
    } catch (err) {
        console.error(`Error fetching file metadata for file ${fileId}:`, err);
        return null;
    }
}

/**
 * Downloads a file from Canvas using its numeric ID or URL with proper authentication.
 */
export async function downloadCanvasFile(fileIdOrUrl: string | number): Promise<{
    filename: string;
    mimeType: string;
    buffer: Buffer;
    size: number;
} | null> {
    try {
        let downloadUrl = "";
        let filename = "document";
        let mimeType = "application/octet-stream";

        // Case 1: Numeric ID provided
        if (typeof fileIdOrUrl === "number" || /^\d+$/.test(String(fileIdOrUrl))) {
            const fileId = Number(fileIdOrUrl);
            const meta = await getCanvasFileMetadata(fileId);
            if (meta) {
                filename = meta.display_name || meta.filename || `file_${fileId}`;
                mimeType = meta["content-type"] || "application/octet-stream";
                if (meta.url) {
                    downloadUrl = meta.url;
                }
            }

            if (!downloadUrl) {
                downloadUrl = `${env.CANVAS_BASE_URL}/api/v1/files/${fileId}/public_url`;
            }
        } else {
            // Case 2: String URL provided
            const urlStr = String(fileIdOrUrl).trim();

            // Check if there's an embedded file ID in the URL
            const fileIdMatch = urlStr.match(/\/files\/(\d+)/i);
            if (fileIdMatch && fileIdMatch[1]) {
                const meta = await getCanvasFileMetadata(Number(fileIdMatch[1]));
                if (meta) {
                    filename = meta.display_name || meta.filename || filename;
                    mimeType = meta["content-type"] || mimeType;
                    if (meta.url) {
                        downloadUrl = meta.url;
                    }
                }
            }

            if (!downloadUrl) {
                if (urlStr.startsWith("/")) {
                    downloadUrl = `${env.CANVAS_BASE_URL}${urlStr}`;
                } else {
                    downloadUrl = urlStr;
                }
            }
        }

        // Determine if request needs Canvas Bearer token
        const headers: Record<string, string> = {};
        const isCanvasHost = downloadUrl.includes(new URL(env.CANVAS_BASE_URL).hostname);
        if (isCanvasHost) {
            headers["Authorization"] = `Bearer ${env.CANVAS_ACCESS_TOKEN}`;
        }

        const res = await fetch(downloadUrl, {
            headers,
            redirect: "follow",
        });

        if (!res.ok) {
            console.error(`Failed to download file from ${downloadUrl}: [${res.status}] ${res.statusText}`);
            return null;
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Detect mimeType & filename from headers if not resolved earlier
        const contentTypeHeader = res.headers.get("content-type");
        if (contentTypeHeader && mimeType === "application/octet-stream") {
            mimeType = contentTypeHeader.split(";")[0]?.trim() || mimeType;
        }

        const contentDisposition = res.headers.get("content-disposition");
        if (contentDisposition && filename === "document") {
            const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;"']+)['"]?/i);
            if (filenameMatch && filenameMatch[1]) {
                filename = decodeURIComponent(filenameMatch[1]);
            }
        }

        return {
            filename,
            mimeType,
            buffer,
            size: buffer.byteLength,
        };
    } catch (err) {
        console.error(`Error downloading Canvas file [${fileIdOrUrl}]:`, err);
        return null;
    }
}

/**
 * Extracts readable plain text or markdown from a document buffer.
 */
export async function extractFileContent(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    maxChars: number = 60000
): Promise<{
    text: string;
    fileType: string;
    numPages?: number | undefined;
    charCount: number;
    isTruncated: boolean;
}> {
    const ext = filename.toLowerCase().split(".").pop() || "";
    let extractedText = "";
    let fileType = ext.toUpperCase() || "FILE";
    let numPages: number | undefined = undefined;

    try {
        // 1. PDF Documents
        if (ext === "pdf" || mimeType.includes("pdf")) {
            fileType = "PDF";
            const parser = new PDFParse({ data: buffer });
            const result = await parser.getText();
            extractedText = result.text || "";
            numPages = result.total;
        }
        // 2. Word Documents (.docx)
        else if (ext === "docx" || mimeType.includes("wordprocessingml")) {
            fileType = "DOCX";
            const docxData = await mammoth.extractRawText({ buffer });
            extractedText = docxData.value || "";
        }
        // 3. Text, Markdown, Code, CSV, JSON
        else if (
            [
                "txt", "md", "csv", "tsv", "json", "py", "java", "cpp", "c", "h", "cs",
                "js", "ts", "html", "css", "sql", "xml", "yml", "yaml", "r", "sh", "env",
            ].includes(ext) ||
            mimeType.startsWith("text/") ||
            mimeType.includes("json") ||
            mimeType.includes("javascript")
        ) {
            fileType = ext.toUpperCase() || "TEXT";
            extractedText = buffer.toString("utf-8");
        }
        // 4. Unsupported or binary formats
        else {
            fileType = ext.toUpperCase() || "BINARY";
            extractedText = `[Unsupported binary file type: .${ext} (${mimeType}). Only text, PDF, DOCX, and code files can be parsed directly.]`;
        }
    } catch (err: any) {
        console.error(`Error extracting text from ${filename}:`, err);
        extractedText = `[Error extracting text from document: ${err.message || String(err)}]`;
    }

    // Clean whitespace & handle truncation
    extractedText = extractedText.replace(/\r\n/g, "\n").trim();

    const isTruncated = extractedText.length > maxChars;
    if (isTruncated) {
        extractedText =
            extractedText.slice(0, maxChars) +
            `\n\n[... Document truncated: ${extractedText.length - maxChars} characters remaining. Total length: ${extractedText.length} chars ...]`;
    }

    return {
        text: extractedText,
        fileType,
        numPages,
        charCount: extractedText.length,
        isTruncated,
    };
}

/**
 * Parses all attachment links and file references from Canvas assignment or discussion HTML description.
 */
export function extractStructuredAttachments(html: string = ""): CanvasFileAttachment[] {
    const attachments: CanvasFileAttachment[] = [];
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    const seenUrls = new Set<string>();

    while ((match = linkRegex.exec(html)) !== null) {
        const url = match[1]?.trim() || "";
        const rawLabel = match[2]?.replace(/<[^>]+>/g, "").trim() || "";

        if (!url || seenUrls.has(url)) continue;

        const isCanvasFile =
            url.includes("/files/") ||
            url.includes("download_frd=1") ||
            /\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt|py|java|cpp|sql)$/i.test(rawLabel) ||
            /\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt|py|java|cpp|sql)(\?|$)/i.test(url);

        if (isCanvasFile) {
            seenUrls.add(url);

            // Extract numeric ID if present
            const idMatch = url.match(/\/files\/(\d+)/i);
            const id = idMatch && idMatch[1] ? Number(idMatch[1]) : undefined;

            let filename = rawLabel || "Attached Document";
            if (!filename.includes(".") && url.includes(".")) {
                const urlFilename = url.split("/").pop()?.split("?")[0];
                if (urlFilename && urlFilename.includes(".")) {
                    filename = decodeURIComponent(urlFilename);
                }
            }

            attachments.push({
                id,
                filename,
                displayName: rawLabel || filename,
                url,
            });
        }
    }

    return attachments;
}
