import { ai, isAiEnabled } from "./client.js";
import { env } from "../config/env.js";
import { storage } from "../services/storage.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import { canvasToolDeclarations, executeCanvasTool } from "./tools.js";

/**
 * Runs the Gemini conversational agent with multi-turn memory and Canvas tool calling.
 */
export async function askGeminiAgent(
    chatId: number,
    userPrompt: string,
    studentName?: string
): Promise<string> {
    if (!isAiEnabled() || !ai) {
        return (
            "🤖 <b>Gemini AI is not yet configured.</b>\n\n" +
            "To enable AI tutoring and Canvas-aware intelligence, please add your <code>GEMINI_API_KEY</code> from Google AI Studio to your <code>.env</code> file or cloud hosting environment."
        );
    }

    try {
        // 1. Fetch recent conversation history
        const history = await storage.getChatHistory(chatId, 10);

        // 2. Format history into Gemini content parts
        const contents: any[] = history.map((msg) => ({
            role: msg.role === "model" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        // Append the new incoming user prompt
        contents.push({
            role: "user",
            parts: [{ text: userPrompt }],
        });

        const model = env.GEMINI_MODEL || "gemini-2.5-flash";
        const systemInstruction = buildSystemPrompt(studentName);

        // 3. Agentic loop with tool calling support (max 5 iterations)
        let iterations = 0;
        const maxIterations = 5;

        while (iterations < maxIterations) {
            iterations++;

            const response = await ai.models.generateContent({
                model,
                contents,
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: canvasToolDeclarations }],
                    temperature: 0.7,
                },
            });

            const candidate = response.candidates?.[0];
            const content = candidate?.content;

            if (!content) {
                return "I'm sorry, I was unable to generate a response at this moment. Please try again.";
            }

            // Append model's response / tool call to contents
            contents.push(content);

            const functionCalls = content.parts?.filter((p: any) => p.functionCall)?.map((p: any) => p.functionCall);

            // If the model did not request any tool calls, we have the final text answer!
            if (!functionCalls || functionCalls.length === 0) {
                const text = response.text?.trim() || "";

                // Save this turn in chat memory
                await storage.appendChatMessage(chatId, "user", userPrompt);
                if (text) {
                    await storage.appendChatMessage(chatId, "model", text);
                }

                return text;
            }

            // If the model requested tool calls, execute them and feed results back
            const functionResponseParts: any[] = [];

            for (const call of functionCalls) {
                const toolName = call.name;
                const toolArgs = call.args || {};
                console.log(`🧠 [Gemini Tool Call] Executing: ${toolName}`, toolArgs);

                const result = await executeCanvasTool(toolName, toolArgs);

                functionResponseParts.push({
                    functionResponse: {
                        name: toolName,
                        response: {
                            output: result,
                        },
                    },
                });
            }

            // Append the tool results for the next iteration
            contents.push({
                role: "user",
                parts: functionResponseParts,
            });
        }

        return "I processed your request, but encountered too many tool cycles. Please try asking more specifically.";
    } catch (err: any) {
        console.error("Error in askGeminiAgent:", err);
        return `⚠️ <b>AI Error:</b> ${err.message || "An unexpected error occurred while communicating with Gemini."}`;
    }
}
