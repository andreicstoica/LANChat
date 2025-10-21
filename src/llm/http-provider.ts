import type { LLMProvider, LLMMessage, LLMResponse, LLMGenerateOptions } from "./interface.ts";

export class HTTPProvider implements LLMProvider {
    private apiKey: string | null;
    private baseURL: string;
    private model: string;

    constructor(
        apiKey: string | null = null,
        baseURL: string = "https://openrouter.ai/api/v1",
        model: string = "deepseek/deepseek-v3.2-exp"
    ) {
        this.apiKey = apiKey;
        this.baseURL = baseURL;
        this.model = model;
    }

    async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResponse> {
        const messages: LLMMessage[] = [
            { role: "user", content: prompt }
        ];
        return this.chat(messages, options);
    }

    async chat(messages: LLMMessage[], options: LLMGenerateOptions = {}): Promise<LLMResponse> {
        const { temperature, max_tokens, format, model, responseFormat } = options;
        const payload: Record<string, unknown> = {
            model: model || this.model,
            messages,
        };

        if (temperature !== undefined) {
            payload.temperature = temperature;
        }

        if (max_tokens !== undefined) {
            payload.max_tokens = max_tokens;
        }

        if (responseFormat) {
            payload.response_format = responseFormat;
        } else if (format === "json") {
            // Default to response decision schema, but this could be made more flexible
            payload.response_format = {
                type: "json_schema",
                json_schema: {
                    name: "response_decision",
                    schema: {
                        type: "object",
                        properties: {
                            should_respond: {
                                type: "boolean",
                                description: "Whether the agent should respond to the message"
                            },
                            decision: {
                                type: "string",
                                description: "The decision made by the agent"
                            },
                            reason: {
                                type: "string",
                                description: "Brief explanation for the decision"
                            },
                            confidence: {
                                type: "number",
                                minimum: 0.0,
                                maximum: 1.0,
                                description: "Confidence level in the decision (0.0 to 1.0)"
                            },
                            query: {
                                type: "string",
                                description: "Search query if applicable"
                            },
                            target: {
                                type: "string",
                                description: "Target for dialectic if applicable"
                            },
                            question: {
                                type: "string",
                                description: "Question for dialectic if applicable"
                            }
                        },
                        required: ["reason", "confidence"],
                        additionalProperties: false
                    }
                }
            };
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }

        const isOpenRouter = this.baseURL.includes("openrouter.ai");

        if (isOpenRouter) {
            // OpenRouter requires identifying headers for rate-limiting and telemetry
            const siteUrl = process.env.OPENROUTER_SITE_URL || "https://github.com/andreistoica/LANChat";
            const siteName = process.env.OPENROUTER_SITE_NAME || "LANChat";
            headers["HTTP-Referer"] = siteUrl;
            headers["X-Title"] = siteName;

            const includeReasoningEnv = process.env.OPENROUTER_INCLUDE_REASONING;
            if (includeReasoningEnv !== undefined) {
                const includeReasoning = includeReasoningEnv.trim().toLowerCase();
                const reasoningEnabled = includeReasoning === "true" || includeReasoning === "1" || includeReasoning === "yes";
                const reasoningDisabled = includeReasoning === "false" || includeReasoning === "0" || includeReasoning === "no";

                if (reasoningEnabled) {
                    payload.include_reasoning = true;
                } else if (reasoningDisabled) {
                    payload.include_reasoning = false;
                    payload.reasoning = { exclude: true };
                }
            }
        }

        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let hint = "";

            if (response.status === 404 && !this.apiKey && this.baseURL.startsWith("http://localhost")) {
                hint =
                    " (hint: LM Studio could not find the requested model. Launch LM Studio and load the model you want, or set LMSTUDIO_MODEL to one of the models you have downloaded.)";
            }

            throw new Error(`HTTP API error: ${response.status} ${response.statusText} - ${errorText}${hint}`);
        }

        const data = await response.json() as {
            choices: Array<{ message: { content?: string } }>;
            usage?: {
                prompt_tokens: number;
                completion_tokens: number;
                total_tokens: number;
            };
        };

        const rawContent = data.choices[0]?.message?.content || "";

        return {
            content: stripHiddenReasoning(rawContent),
            usage: data.usage,
        };
    }
}

function stripHiddenReasoning(content: string | undefined): string {
    if (!content) return "";

    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    return cleaned.length > 0 ? cleaned : content.trim();
}
