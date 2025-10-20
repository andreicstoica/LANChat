import type { LLMProvider } from "./interface.js";
import { OllamaProvider } from "./ollama-provider.js";
import { HTTPProvider } from "./http-provider.js";

export type LLMProviderType = "ollama" | "openrouter" | "lmstudio";

type HTTPProviderConfig = {
    apiKey: string | null;
    baseURL: string;
    model: string;
};

const makeHTTPProvider = ({ apiKey, baseURL, model }: HTTPProviderConfig): LLMProvider => {
    return new HTTPProvider(apiKey, baseURL, model);
};

const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} environment variable is required for this provider`);
    }
    return value;
};

const PROVIDERS: Record<LLMProviderType, () => LLMProvider> = {
    ollama: () => {
        const host = process.env.OLLAMA_HOST || "http://localhost:11434";
        const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
        return new OllamaProvider(host, model);
    },
    openrouter: () => {
        const apiKey = requireEnv("OPENROUTER_API_KEY");
        const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
        const model = process.env.OPENROUTER_MODEL || "z-ai/glm-4.5-air:free";
        return makeHTTPProvider({ apiKey, baseURL, model });
    },
    lmstudio: () => {
        const baseURL = process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
        const model = process.env.LMSTUDIO_MODEL || "qwen/qwen3-4b-2507";
        return makeHTTPProvider({ apiKey: null, baseURL, model });
    },
};

export function createLLMProvider(provider: LLMProviderType): LLMProvider {
    const factory = PROVIDERS[provider];

    if (!factory) {
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    return factory();
}

export function getLLMProvider(): LLMProvider {
    const provider = (process.env.LLM_PROVIDER || "ollama") as LLMProviderType;
    return createLLMProvider(provider);
}
