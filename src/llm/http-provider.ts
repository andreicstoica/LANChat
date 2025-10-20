import type { LLMProvider, LLMMessage, LLMResponse, LLMGenerateOptions } from "./interface.js";

export class HTTPProvider implements LLMProvider {
    private apiKey: string;
    private baseURL: string;
    private model: string;

    constructor(
        apiKey: string,
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
            payload.response_format = { type: "json_object" };
        }

        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`HTTP API error: ${response.status} ${response.statusText}`);
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
