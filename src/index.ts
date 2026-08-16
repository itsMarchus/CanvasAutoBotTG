// import "dotenv/config";
// import { Bot } from "grammy";

// const token = process.env.TELEGRAM_BOT_TOKEN;

// if (!token) {
//     throw new Error("TELEGRAM_BOT_TOKEN is missing");
// }

// const bot = new Bot(token);

// async function setupCommands() {
//     await bot.api.setMyCommands([
//         {
//             command: "start",
//             description: "Start the bot",
//         },
//         {
//             command: "help",
//             description: "Show available commands",
//         },
//         {
//             command: "courses",
//             description: "View your Canvas courses",
//         },
//         {
//             command: "assignments",
//             description: "View your assignments",
//         },
//     ]);
// }

// bot.command("start", async (ctx) => {
//     await ctx.reply(
//         "Hello! Your Canvas Telegram Bot is working! 🚀\n\n" +
//         "Use /help to see what I can do."
//     );
// });

// bot.command("help", async (ctx) => {
//     await ctx.reply(
//         "📚 Canvas Assistant Commands\n\n" +
//         "/start - Start the bot\n" +
//         "/help - Show available commands\n" +
//         "/courses - View your Canvas courses\n" +
//         "/assignments - View your assignments"
//     );
// });

// bot.on("message:text", async (ctx) => {
//     await ctx.reply(`You said: ${ctx.message.text}`);
// });

// async function main() {
//     await setupCommands();

//     console.log("🤖 Telegram bot is running...");

//     bot.start();
// }

// main();
// import { getCurrentUser } from "./canvas/client.js";

// async function main() {
//   try {
//     const user = await getCurrentUser();

//     console.log("Canvas user:");
//     console.log(user);
//   } catch (error) {
//     console.error("Failed to connect to Canvas:", error);
//   }
// }

// main();
import { getCourses } from "./canvas/client.js";

async function main() {
  try {
    const courses = await getCourses();

    console.log("My Canvas courses:");
    console.log(courses);
  } catch (error) {
    console.error("Failed to connect to Canvas:", error);
  }
}

main();