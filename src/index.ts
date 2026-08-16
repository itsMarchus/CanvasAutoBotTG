import http from "node:http";
import { env } from "./config/env.js";
import { getCurrentUser } from "./canvas/client.js";
import { bot, setupBotCommands } from "./bot/bot.js";
import { notifier } from "./services/notifier.js";

async function main() {
    console.log("🚀 Initializing Canvas Telegram Assistant Bot...");

    // 1. Start lightweight HTTP health server for Cloud / Render health checks
    const port = Number(process.env.PORT) || 3000;
    const server = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
            JSON.stringify({
                status: "healthy",
                bot: "online",
                service: "canvas-telegram-agent",
                timestamp: new Date().toISOString(),
            })
        );
    });

    server.listen(port, () => {
        console.log(`🌐 HTTP Health Check Server listening on port ${port}`);
    });

    // 2. Validate Canvas connection
    try {
        const user = await getCurrentUser();
        console.log(`🎓 Canvas Connection: Authenticated as "${user.name}" (ID: ${user.id})`);
    } catch (err) {
        console.error("⚠️ Warning: Failed to connect to Canvas API during startup:", err);
        console.error("Please verify that CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN are valid in your .env");
    }

    // 3. Register Telegram bot command menu
    try {
        await setupBotCommands();
        console.log("📋 Telegram bot commands menu registered.");
    } catch (err) {
        console.warn("Could not register bot commands menu with Telegram:", err);
    }

    // 4. Start the background notifier
    notifier.start();

    // 5. Handle graceful shutdown
    const shutdown = async (signal: string) => {
        console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
        notifier.stop();
        await bot.stop();
        server.close();
        console.log("👋 Assistant bot stopped. Goodbye!");
        process.exit(0);
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));

    // 6. Start Telegram bot long-polling
    console.log("🤖 Telegram bot is now polling for messages...");
    bot.start({
        drop_pending_updates: true,
        onStart: (botInfo) => {
            console.log(`✨ Bot @${botInfo.username} is online and running! (Timezone: ${env.TIMEZONE})`);
        },
    });
}

main().catch((err) => {
    console.error("Fatal error during bot initialization:", err);
    process.exit(1);
});