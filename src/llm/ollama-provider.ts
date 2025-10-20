import { Ollama } from "ollama";
import type { LLMProvider, LLMMessage, LLMResponse, LLMGenerateOptions } from "./interface.js";

export class OllamaProvider implements LLMProvider {
    private ollama: Ollama;
    private model: string;

    constructor(host: string = "http://localhost:11434", model: string = "llama3.1:8b") {
        this.ollama = new Ollama({ host });
        this.model = model;
    }

    async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResponse> {
        const response = await this.ollama.generate({
            model: this.model,
            prompt,
            format: options.format || "text",
            options: {
                temperature: options.temperature || 0.7,
                num_predict: options.max_tokens || 100,
            },
        });

        return {
            content: response.response,
        };
    }

    async chat(messages: LLMMessage[], options: LLMGenerateOptions = {}): Promise<LLMResponse> {
        const response = await this.ollama.chat({
            model: this.model,
            messages: messages,
            options: {
                temperature: options.temperature || 0.7,
                num_predict: options.max_tokens || 100,
            },
        });

        return {
            content: response.message?.content || "",
        };
    }
}
