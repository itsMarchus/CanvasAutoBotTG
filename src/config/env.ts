import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
    CANVAS_BASE_URL: z
        .string()
        .url("CANVAS_BASE_URL must be a valid URL (e.g. https://canvas.instructure.com)")
        .transform((url) => url.replace(/\/+$/, "")), // Strip trailing slash
    CANVAS_ACCESS_TOKEN: z.string().min(1, "CANVAS_ACCESS_TOKEN is required"),
    TELEGRAM_ALLOWED_USER_ID: z
        .string()
        .optional()
        .transform((val) => (val && !isNaN(Number(val)) ? Number(val) : undefined)),
    POLL_INTERVAL_CRON: z.string().default("*/10 * * * *"), // Default: every 10 minutes
    TIMEZONE: z.string().default("Asia/Manila"),
    REMINDER_HOURS_BEFORE: z
        .string()
        .default("3,1")
        .transform((val) =>
            val
                .split(",")
                .map((n) => parseFloat(n.trim()))
                .filter((n) => !isNaN(n))
        ),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parseEnv = () => {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error("❌ Invalid environment variables:");
        for (const issue of result.error.issues) {
            console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
        }
        process.exit(1);
    }
    return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
