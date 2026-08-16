import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

/**
 * Initializes the Google Gen AI client with the configured API key.
 * If GEMINI_API_KEY is not configured in .env, AI features will be disabled gracefully.
 */
export const ai = env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
    : null;

/**
 * Checks if Gemini AI is active and configured.
 */
export function isAiEnabled(): boolean {
    return Boolean(ai && env.GEMINI_API_KEY);
}
