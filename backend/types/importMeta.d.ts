interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly VITE_AI_PROXY_URL?: string;
    readonly VITE_AI_PROXY_AUTH_TOKEN?: string;
    readonly VITE_AI_MODEL?: string;
    readonly VITE_ALLOW_INSECURE_DIRECT_AI?: string;
    readonly VITE_GROQ_API_KEY?: string;
    readonly VITE_OPENAI_API_KEY?: string;
    readonly VITE_OPENAI_MODEL?: string;
    readonly VITE_ANTHROPIC_API_KEY?: string;
    readonly VITE_ANTHROPIC_MODEL?: string;
    readonly VITE_AI_PROVIDER_ORDER?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
