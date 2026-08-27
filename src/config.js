import 'dotenv/config';
import path from 'node:path';

const asBool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const asInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const root = process.cwd();

export const config = {
  brand: 'JOSH-VIBES',
  botName: 'Joshua Design AI Assistant',
  port: asInt(process.env.PORT, 3000),
  botMode: process.env.BOT_MODE || 'polling',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  ownerTelegramId: process.env.OWNER_TELEGRAM_ID || '',
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  databasePath: path.resolve(root, process.env.DATABASE_PATH || './data/josh-vibes.sqlite'),
  maxHistoryMessages: asInt(process.env.MAX_HISTORY_MESSAGES, 20),
  rateLimitPerMinute: asInt(process.env.RATE_LIMIT_PER_MINUTE, 30),
  aiTimeoutMs: asInt(process.env.AI_TIMEOUT_MS, 30000),
  aiRetries: asInt(process.env.AI_RETRIES, 2),
  aiProviderOrder: (process.env.AI_PROVIDER_ORDER || 'yenusai,azbrygpt,azbryclaude,gemini')
    .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini'
  },
  gemini: {
    apiKey: process.env.GOOGLE_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  },
  yenusai: {
    enabled: asBool(process.env.ENABLE_YENUSAI, true),
    baseUrl: (process.env.YENUSAI_BASE_URL || 'https://yenus.created.app').replace(/\/$/, ''),
    endpoint: process.env.YENUSAI_ENDPOINT || '/integrations/google-gemini-1-5-flash',
    projectId: process.env.YENUSAI_PROJECT_ID || '',
    apiKey: process.env.YENUSAI_API_KEY || ''
  },
  azbrygpt: {
    enabled: asBool(process.env.ENABLE_AZBRY_GPT, true),
    baseUrl: (process.env.AZBRY_BASE_URL || 'https://api.azbry.com').replace(/\/$/, ''),
    endpoint: process.env.AZBRY_GPT_ENDPOINT || '/api/ai/gptfree'
  },
  azbryclaude: {
    enabled: asBool(process.env.ENABLE_AZBRY_CLAUDE, true),
    baseUrl: (process.env.AZBRY_BASE_URL || 'https://api.azbry.com').replace(/\/$/, ''),
    endpoint: process.env.AZBRY_CLAUDE_ENDPOINT || '/api/ai/claude'
  },
  ownerAlertsEnabled: asBool(process.env.OWNER_ALERTS_ENABLED, true),
  followUpEnabled: asBool(process.env.FOLLOW_UP_ENABLED, true),
  followUpDelayHours: asInt(process.env.FOLLOW_UP_DELAY_HOURS, 48)
};

export function validateConfig({ requireTelegram = true } = {}) {
  const errors = [];
  if (requireTelegram && !config.telegramToken) errors.push('TELEGRAM_BOT_TOKEN is missing.');
  if (config.botMode === 'webhook' && !config.webhookSecret) errors.push('WEBHOOK_SECRET is required in webhook mode.');
  if (config.botMode === 'webhook' && !config.webhookUrl) errors.push('WEBHOOK_URL is required in webhook mode.');
  if (config.ownerTelegramId && !/^\d+$/.test(config.ownerTelegramId)) errors.push('OWNER_TELEGRAM_ID must be a numeric Telegram ID.');
  return errors;
}
