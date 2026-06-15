export type AIProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  models: { id: string; name: string; contextWindow: number; pricing?: { input: number; output: number } }[];
  requiresApiKey: boolean;
};

// Registry of supported providers
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, pricing: { input: 2.5, output: 10 } },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, pricing: { input: 0.15, output: 0.6 } },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, pricing: { input: 10, output: 30 } },
      { id: 'o1', name: 'o1', contextWindow: 200000, pricing: { input: 15, output: 60 } },
      { id: 'o1-mini', name: 'o1 Mini', contextWindow: 128000, pricing: { input: 3, output: 12 } },
    ],
    requiresApiKey: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, pricing: { input: 3, output: 15 } },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, pricing: { input: 0.8, output: 4 } },
    ],
    requiresApiKey: true,
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    // Gemini exposes an OpenAI-compatible surface, so it routes through the
    // shared OpenAI-compatible adapter in provider.ts.
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', contextWindow: 1000000 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000 },
    ],
    requiresApiKey: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [],
    requiresApiKey: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', contextWindow: 64000 },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', contextWindow: 64000 },
    ],
    requiresApiKey: true,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    models: [],
    requiresApiKey: true,
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: [],
    requiresApiKey: true,
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    models: [],
    requiresApiKey: true,
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    models: [{ id: 'grok-3', name: 'Grok 3', contextWindow: 131072 }],
    requiresApiKey: true,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    models: [],
    requiresApiKey: false,
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    baseUrl: '',
    models: [],
    requiresApiKey: true,
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    models: [],
    requiresApiKey: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, pricing: { input: 0.59, output: 0.79 } },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, pricing: { input: 0.24, output: 0.24 } },
    ],
    requiresApiKey: true,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000 },
      { id: 'codellama', name: 'Code Llama', contextWindow: 16384 },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', contextWindow: 128000 },
    ],
    requiresApiKey: false,
  },
];

/** Look up a provider config by id. */
export function getProviderConfig(providerId: string): AIProviderConfig | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId);
}
