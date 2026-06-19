// Modello Claude del chatbot clienti (Messages API). Override con env CHAT_MODEL.
export const CHAT_MODEL = process.env.CHAT_MODEL ?? 'claude-sonnet-4-6';
export const CHAT_MAX_TOKENS = 1536;
export const CHAT_HISTORY_LIMIT = 24;
export const CHAT_TOOL_LOOP_LIMIT = 5;
export const CHAT_BOT_IDLE_WARNING_MINUTES = 5;
export const CHAT_BOT_IDLE_CLOSE_MINUTES = 10;
