import { OpenAI } from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'node:url';
import ElectronStore from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new ElectronStore();

const SYSTEM_PROMPT = `
You are Apollo, a smart and capable assistant.
You were created by seventy7 - a team of passionate programmers and designers.
Provide helpful, accurate, and thoughtful responses in a concise, friendly, and professional manner.
Your replies will be fully spoken, so avoid formatting or text-based data, and use verbal representations for numbers.
User messages are converted through a speech-to-text model and they won\'t contain punctuation or capitalisation.
You will answer exclusively in Polish. Your answers will be spoken, so do not use formatting etc.
You will receive user input separated in quotes from some useful information passed automatically.
If asked for anything that would require multiple functions used (for example searching AND music), shortly decline the request and apologise without further explanation, if only one function is needed you may proceed.
When asked for controling music, use Spotify.
When talking about time, use a 24-hour clock. For example during explaining lessons.
You should address the user by their name if it's provided.
`;

const formatMessage = (message) => `User input: "${message}"\nCurrent date: ${new Date()}\n${store.get("settings.ai.name") ? `User's name: "${store.get("settings.ai.name", "<Not provided>")}"` : ""}`;

export default class Assistant {
    constructor(apiKey) {
        if (!apiKey || typeof apiKey !== "string" || apiKey === "") {
            throw new Error(
                "Invalid API key: API key must be a non-empty string"
            );
        }
        try {
            this.openai = new OpenAI({
                apiKey: apiKey,
            });
            this.validateApiKey();
        } catch (error) {
            throw new Error(
                `Failed to initialize OpenAI client: ${error.message}`
            );
        }
        this.conversations = new Map();
        this.tools = new Map();
        this.systemMessage = {
            role: "system",
            content: SYSTEM_PROMPT,
        };
        this.initializeTools();
    }

    async initializeTools() {
        try {
            const pluginsDir = path.join(__dirname, "plugins");
            const plugins = await this.loadPlugins(pluginsDir);

            for (const plugin of plugins) {
                this.tools.set(plugin.name, plugin);
            }
        } catch (error) {
            console.error("Error loading tools:", error);
        }
    }

    async loadPlugins(dir) {
        const plugins = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const pluginDir = path.join(dir, entry.name);
                    const manifest = await this.loadManifest(pluginDir);

                    if (manifest) {
                        const implementation = await this.loadImplementation(
                            pluginDir
                        );
                        if (implementation) {
                            plugins.push({
                                name: manifest.name,
                                description: manifest.description,
                                parameters: manifest.parameters,
                                execute: implementation.execute,
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error reading plugins directory:", error);
        }
        return plugins;
    }

    async loadManifest(pluginDir) {
        try {
            const manifestPath = path.join(pluginDir, "manifest.json");
            const manifestContent = await fs.readFile(manifestPath, "utf-8");
            return JSON.parse(manifestContent);
        } catch (error) {
            console.error(`Error loading manifest from ${pluginDir}:`, error);
            return null;
        }
    }

    async loadImplementation(pluginDir) {
        try {
            const implementationPath = path.join(pluginDir, "index.js");
            const fileUrl = new URL(`file://${implementationPath}`);
            const implementation = await import(fileUrl);
            return implementation.default;
        } catch (error) {
            console.error(
                `Error loading implementation from ${pluginDir}:`,
                error
            );
            return null;
        }
    }

    async validateApiKey() {
        try {
            await this.openai.models.list({ limit: 1 });
        } catch (error) {
            if (error.status === 401) {
                throw new Error("Invalid API key: Authentication failed");
            }
            throw new Error(`API key validation failed: ${error.message}`);
        }
    }

    async sendMessage(message, conversationId = null, options = {}) {
        try {
            message = formatMessage(message);

            let messages = this.conversations.get(conversationId) || [
                this.systemMessage,
            ];
            messages.push({ role: "user", content: message });

            const tools = Array.from(this.tools.values()).map((tool) => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                },
            }));

            const completionOptions = {
                messages,
                model: options.model || "gpt-4.1-nano",
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 9999,
                presence_penalty: options.presencePenalty || 0,
                frequency_penalty: options.frequencyPenalty || 0,
                stream: options.stream || false,
            };

            if (tools.length > 0) {
                completionOptions.tools = tools;
                if (options.tool_choice) {
                    completionOptions.tool_choice = options.tool_choice;
                }
            }

            const completion = await this.openai.chat.completions.create(
                completionOptions
            );
            const assistantMessage = completion.choices[0].message;
            messages.push(assistantMessage);

            if (assistantMessage.tool_calls?.length > 0) {
                const toolResults = [];

                for (const toolCall of assistantMessage.tool_calls) {
                    if (toolCall.type === "function") {
                        const toolName = toolCall.function.name;
                        try {
                            const toolArgs = JSON.parse(
                                toolCall.function.arguments
                            );
                            const toolToCall = this.tools.get(toolName);

                            if (toolToCall) {
                                try {
                                    const toolResult = await toolToCall.execute(
                                        toolArgs
                                    );
                                    toolResults.push({
                                        toolCall,
                                        result: toolResult,
                                    });
                                } catch (error) {
                                    console.error(
                                        `Error executing tool ${toolName}:`,
                                        error
                                    );
                                    toolResults.push({
                                        toolCall,
                                        error: error.message,
                                    });
                                }
                            } else {
                                console.warn(`Tool ${toolName} not found`);
                                toolResults.push({
                                    toolCall,
                                    error: `Tool ${toolName} not found`,
                                });
                            }
                        } catch (error) {
                            console.error(
                                `Error parsing tool arguments for ${toolName}:`,
                                error
                            );
                            toolResults.push({
                                toolCall,
                                error: `Failed to parse tool arguments: ${error.message}`,
                            });
                        }
                    }
                }

                messages.push({
                    role: "tool",
                    content: JSON.stringify(toolResults),
                    tool_call_id: assistantMessage.tool_calls[0].id,
                });

                const completion2 = await this.openai.chat.completions.create(
                    completionOptions
                );
                const assistantMessage2 = completion2.choices[0].message;
                messages.push(assistantMessage2);

                if (conversationId) {
                    this.conversations.set(conversationId, messages);
                }

                return {
                    message: assistantMessage2.content,
                    conversationId,
                    usage: completion2.usage,
                    finishReason: completion2.choices[0].finish_reason,
                    toolCalls: assistantMessage2.tool_calls,
                };
            }

            messages.push({
                role: "assistant",
                content: assistantMessage.content,
            });

            if (conversationId) {
                this.conversations.set(conversationId, messages);
            }

            return {
                message: assistantMessage.content,
                conversationId,
                usage: completion.usage,
                finishReason: completion.choices[0].finish_reason,
                toolCalls: assistantMessage.tool_calls,
            };
        } catch (error) {
            console.error("Assistant Error:", error);
            throw error;
        }
    }
    async streamMessage(message, onChunk, conversationId = null, options = {}) {
        try {
            message = formatMessage(message);

            let messages = this.conversations.get(conversationId) || [
                this.systemMessage,
            ];
            messages.push({ role: "user", content: message });

            const tools = Array.from(this.tools.values()).map((tool) => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                },
            }));

            let fullResponse = "";
            let toolCalls = [];
            let currentToolCall = null;
            let functionBuffer = {
                name: "",
                arguments: "",
            };

            const stream = await this.openai.chat.completions.create({
                messages: messages,
                model: options.model || "gpt-4o-mini",
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 9999,
                presence_penalty: options.presencePenalty || 0,
                frequency_penalty: options.frequencyPenalty || 0,
                stream: true,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: options.tool_choice || "auto",
            });

            for await (const chunk of stream) {
                const delta = chunk.choices[0].delta;
                const content = delta?.content || "";
                const toolCallDelta = delta?.tool_calls?.[0];

                if (content) {
                    fullResponse += content;
                    onChunk({
                        type: "content",
                        content,
                        done: false,
                    });
                }

                if (toolCallDelta) {
                    if (!currentToolCall && toolCallDelta.index === 0) {
                        currentToolCall = {
                            id: toolCallDelta.id || "",
                            type: toolCallDelta.type || "",
                            function: {
                                name: "",
                                arguments: "",
                            },
                        };
                    }

                    if (toolCallDelta.function?.name) {
                        functionBuffer.name += toolCallDelta.function.name;
                        currentToolCall.function.name = functionBuffer.name;
                    }
                    if (toolCallDelta.function?.arguments) {
                        functionBuffer.arguments +=
                            toolCallDelta.function.arguments;
                        currentToolCall.function.arguments =
                            functionBuffer.arguments;
                    }

                    onChunk({
                        type: "tool_call_progress",
                        toolCall: { ...currentToolCall },
                        done: false,
                    });
                }

                if (
                    chunk.choices[0].finish_reason === "tool_calls" &&
                    currentToolCall
                ) {
                    toolCalls.push({ ...currentToolCall });
                    onChunk({
                        type: "tool_call_complete",
                        toolCall: { ...currentToolCall },
                        done: false,
                    });
                    currentToolCall = null;
                    functionBuffer = { name: "", arguments: "" };
                }
            }

            const assistantMessage = {
                role: "assistant",
                content: fullResponse,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            };
            messages.push(assistantMessage);

            if (toolCalls.length > 0) {
                const toolResults = [];

                for (const toolCall of toolCalls) {
                    if (toolCall.type === "function") {
                        const toolName = toolCall.function.name;
                        try {
                            const toolArgs = JSON.parse(
                                toolCall.function.arguments
                            );
                            const toolToCall = this.tools.get(toolName);

                            if (toolToCall) {
                                onChunk({
                                    type: "tool_execution_start",
                                    toolName,
                                    done: false,
                                });

                                const toolResult = await toolToCall.execute(
                                    toolArgs
                                );
                                toolResults.push({
                                    tool_call_id: toolCall.id,
                                    function: {
                                        name: toolName,
                                        arguments: toolCall.function.arguments,
                                    },
                                    result: toolResult,
                                });

                                onChunk({
                                    type: "tool_result",
                                    toolName,
                                    result: toolResult,
                                    done: false,
                                });
                            }
                        } catch (error) {
                            console.error(
                                `Error executing tool ${toolName}:`,
                                error
                            );
                            toolResults.push({
                                tool_call_id: toolCall.id, // Add the tool_call_id
                                function: {
                                    name: toolName,
                                    arguments: toolCall.function.arguments,
                                },
                                error: error.message,
                            });
                            onChunk({
                                type: "tool_error",
                                toolName,
                                error: error.message,
                                done: false,
                            });
                        }
                    }
                }

                // Add tool results as a separate message for each tool call
                for (const result of toolResults) {
                    messages.push({
                        role: "tool",
                        content: JSON.stringify(result.result || result.error),
                        tool_call_id: result.tool_call_id,
                    });
                }

                const finalStream = await this.openai.chat.completions.create({
                    messages: messages,
                    model: options.model || "gpt-4o-mini",
                    temperature: options.temperature || 0.7,
                    max_tokens: options.maxTokens || 9999,
                    presence_penalty: options.presencePenalty || 0,
                    frequency_penalty: options.frequencyPenalty || 0,
                    stream: true,
                });

                let finalResponse = "";
                for await (const chunk of finalStream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        finalResponse += content;
                        onChunk({
                            type: "content",
                            content,
                            done: chunk.choices[0].finish_reason === "stop",
                        });
                    }
                }

                messages.push({
                    role: "assistant",
                    content: finalResponse,
                });

                if (conversationId) {
                    this.conversations.set(conversationId, messages);
                }

                return {
                    message: finalResponse,
                    conversationId,
                    toolCalls,
                };
            }

            if (conversationId) {
                this.conversations.set(conversationId, messages);
            }

            onChunk({
                type: "content",
                content: "",
                done: true,
            });

            return {
                message: fullResponse,
                conversationId,
                toolCalls,
            };
        } catch (error) {
            console.error("Assistant Stream Error:", error);
            onChunk({
                type: "error",
                error: error.message,
                done: true,
            });
            throw error;
        }
    }

    clearConversation(conversationId) {
        this.conversations.delete(conversationId);
    }

    async listModels() {
        try {
            const models = await this.openai.models.list();
            return models.data;
        } catch (error) {
            console.error("Error fetching models:", error);
            throw error;
        }
    }

    getTools() {
        return Array.from(this.tools.values());
    }

    async createRealtimeSession(options = {}) {
        try {
            const tools = Array.from(this.tools.values()).map((tool) => ({
                type: "function",
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            }));

            const sessionConfig = {
                model: options.model || "gpt-4o-mini-realtime-preview",
                instructions: options.instructions || SYSTEM_PROMPT,
                voice: options.voice || "alloy",
                // input_audio_format: options.input_audio_format || "pcm16",
                // output_audio_format: options.output_audio_format || "pcm16",
                // input_audio_transcription:
                //     options.input_audio_transcription || null,
                input_audio_noise_reduction: options.input_audio_noise_reduction || { type: "far_field" },
                turn_detection: options.turn_detection || { type: "server_vad", threshold: 0.4, },
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: options.tool_choice || "auto",
                // temperature: options.temperature || 0.7,
                max_response_output_tokens:
                    options.max_response_output_tokens || 4096,
            };

            const response = await this.openai.beta.realtime.sessions.create(
                sessionConfig
            );

            return response.client_secret.value;
        } catch (error) {
            console.error("Error creating realtime session:", error);
            throw new Error(
                `Failed to create realtime session: ${error.message}`
            );
        }
    }
}