export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    content: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface LLMGenerateOptions {
    temperature?: number;
    max_tokens?: number;
    format?: 'json' | 'text';
    model?: string;
    responseFormat?: Record<string, unknown>;
}

export interface LLMProvider {
    generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
    chat(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse>;
}
