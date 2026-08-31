import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ai } from "../ai/client.js";
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
 * Extracts readable plain text, markdown, or vision analysis from a document buffer.
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
        // 3. Images (PNG, JPG, JPEG, WEBP, GIF, BMP, SVG) -> Gemini Multimodal Vision Extraction
        else if (
            ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext) ||
            mimeType.startsWith("image/")
        ) {
            fileType = "IMAGE";
            if (ai) {
                try {
                    const model = env.GEMINI_MODEL || "gemini-flash-latest";
                    let effectiveMime = mimeType.startsWith("image/") ? mimeType : `image/${ext === "jpg" ? "jpeg" : ext}`;
                    if (effectiveMime === "image/svg+xml" || ext === "svg") {
                        // SVGs can also be read as raw XML/text
                        extractedText = buffer.toString("utf-8");
                    } else {
                        const visionResp = await ai.models.generateContent({
                            model,
                            contents: [
                                {
                                    role: "user",
                                    parts: [
                                        {
                                            text: `You are an academic visual analyzer extracting content for a college student and tutor.
Thoroughly examine this assignment/course image and extract all information:
1. **Text & Labels**: Transcribe all visible text, questions, titles, legends, headings, and numbers verbatim.
2. **Graph / Diagram Analysis**: If this is a chart/graph/diagram, describe:
   - Chart type (e.g. line chart, bar graph, scatter plot, flowchart).
   - X-axis and Y-axis labels, units, and ranges.
   - All plotted data series, trends (increasing/decreasing/peaks/troughs), key data points with numeric coordinates/values.
3. **Key Observations**: Highlight any specific data patterns, anomalies, or relationships shown in the visual.
Be precise and thorough so an academic question can be answered completely from your transcription.`
                                        },
                                        {
                                            inlineData: {
                                                mimeType: effectiveMime,
                                                data: buffer.toString("base64")
                                            }
                                        }
                                    ]
                                }
                            ]
                        });
                        extractedText = visionResp.text || "[Image was analyzed, but no visual text was returned.]";
                    }
                } catch (vErr: any) {
                    console.error(`Gemini vision extraction failed for ${filename}:`, vErr);
                    extractedText = `[Image attached: ${filename}. Vision analysis error: ${vErr.message || String(vErr)}]`;
                }
            } else {
                extractedText = `[Image attached: ${filename}. Gemini AI client not initialized to parse visual content.]`;
            }
        }
        // 4. Text, Markdown, Code, CSV, JSON
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
        // 5. Unsupported or other binary formats
        else {
            fileType = ext.toUpperCase() || "BINARY";
            extractedText = `[Unsupported binary file type: .${ext} (${mimeType}). Only text, PDF, DOCX, images, and code files can be parsed directly.]`;
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
    const seenUrls = new Set<string>();

    const fileExtPattern = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt|py|java|cpp|sql|png|jpe?g|webp|gif|svg)(\?|$)/i;
    const fileLabelPattern = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt|py|java|cpp|sql|png|jpe?g|webp|gif|svg)$/i;

    // 1. Check anchor <a> tags
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
        const url = match[1]?.trim() || "";
        const rawLabel = match[2]?.replace(/<[^>]+>/g, "").trim() || "";

        if (!url || seenUrls.has(url)) continue;

        const isCanvasFile =
            url.includes("/files/") ||
            url.includes("download_frd=1") ||
            url.includes("/preview") ||
            fileLabelPattern.test(rawLabel) ||
            fileExtPattern.test(url);

        if (isCanvasFile) {
            seenUrls.add(url);

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

    // 2. Check embedded <img> tags (graphs, charts, diagrams)
    const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;

    while ((imgMatch = imgRegex.exec(html)) !== null) {
        const fullTag = imgMatch[0] || "";
        const src = imgMatch[1]?.trim() || "";

        if (!src || seenUrls.has(src)) continue;

        // Check if image is a Canvas file or common image extension
        if (src.includes("/files/") || src.includes("/preview") || fileExtPattern.test(src)) {
            seenUrls.add(src);

            const idMatch = src.match(/\/files\/(\d+)/i);
            const id = idMatch && idMatch[1] ? Number(idMatch[1]) : undefined;

            // Extract alt or title if present
            const altMatch = fullTag.match(/alt=["']([^"']+)["']/i);
            const titleMatch = fullTag.match(/title=["']([^"']+)["']/i);
            const label = altMatch?.[1] || titleMatch?.[1] || "image.png";

            let filename = label;
            if (!filename.includes(".") && src.includes(".")) {
                const urlFilename = src.split("/").pop()?.split("?")[0];
                if (urlFilename && urlFilename.includes(".")) {
                    filename = decodeURIComponent(urlFilename);
                }
            }

            attachments.push({
                id,
                filename: filename.includes(".") ? filename : `${filename}.png`,
                displayName: label,
                url: src,
            });
        }
    }

    return attachments;
}
