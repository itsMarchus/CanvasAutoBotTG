import { env } from "../config/env.js";
import type { CanvasUser } from "./types.js";

export type QueryParams = Record<string, string | number | boolean | Array<string | number> | undefined>;

export async function canvasFetch<T>(endpoint: string, params?: QueryParams): Promise<T> {
    const url = new URL(`${env.CANVAS_BASE_URL}/api/v1${endpoint}`);

    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const item of value) {
                    url.searchParams.append(key, String(item));
                }
            } else {
                url.searchParams.append(key, String(value));
            }
        }
    }

    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${env.CANVAS_ACCESS_TOKEN}`,
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        let errorDetail = "";
        try {
            const errorJson = (await response.json()) as { errors?: Array<{ message?: string }>; message?: string };
            if (errorJson.errors && errorJson.errors.length > 0) {
                errorDetail = errorJson.errors.map((e) => e.message || JSON.stringify(e)).join(", ");
            } else if (errorJson.message) {
                errorDetail = errorJson.message;
            }
        } catch {
            errorDetail = await response.text().catch(() => "");
        }

        const message = `Canvas API error [${response.status} ${response.statusText}] at ${endpoint}: ${errorDetail || "Unknown error"}`;
        throw new Error(message);
    }

    return (await response.json()) as T;
}

export function getCurrentUser(): Promise<CanvasUser> {
    return canvasFetch<CanvasUser>("/users/self");
}