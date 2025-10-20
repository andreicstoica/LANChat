import type { LLMProvider, LLMMessage, LLMResponse, LLMGenerateOptions } from "./interface.js";

export class HTTPProvider implements LLMProvider {
    private apiKey: string | null;
    private baseURL: string;
    private model: string;

    constructor(
        apiKey: string | null = null,
        baseURL: string = "https://openrouter.ai/api/v1",
        model: string = "z-ai/glm-4.5-air:free"
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
        const { temperature, max_tokens, format, model } = options;
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

        if (format === "json") {
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

        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json() as {
            choices: Array<{ message: { content?: string } }>;
            usage?: {
                prompt_tokens: number;
                completion_tokens: number;
                total_tokens: number;
            };
        };

        return {
            content: data.choices[0]?.message?.content || "",
            usage: data.usage,
        };
    }
}
