import express from 'express';
import { webhookCallback } from 'grammy';
import { config, validateConfig } from './config.js';

const errors = validateConfig();
if (errors.length) {
  console.error('[JOSH-VIBES] Configuration error:', errors.join(' '));
  process.exit(1);
}

const { bot, processDueFollowUps } = await import('./bot.js');
const { closeDatabase } = await import('./db.js');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.get('/', (_req, res) => res.json({ brand: config.brand, service: 'Telegram AI Assistant', status: 'online' }));
app.get('/health', async (_req, res) => {
  const health = await bot.api.getMe().then((me) => ({ status: 'ok', bot: me.username })).catch(() => ({ status: 'degraded' }));
  res.status(health.status === 'ok' ? 200 : 503).json({ brand: config.brand, ...health, mode: config.botMode });
});

let server;
let followUpTimer;

async function start() {
  server = app.listen(config.port, '0.0.0.0', () => console.log(`[JOSH-VIBES] HTTP service listening on port ${config.port}`));
  followUpTimer = setInterval(() => processDueFollowUps().catch((error) => console.error('[JOSH-VIBES] scheduler:', error.message)), 60 * 60 * 1000);
  await processDueFollowUps();

  if (config.botMode === 'webhook') {
    const route = `/telegram/${config.webhookSecret}`;
    app.post(route, (req, res, next) => {
      if (req.get('X-Telegram-Bot-Api-Secret-Token') !== config.webhookSecret) return res.sendStatus(401);
      return webhookCallback(bot, 'express')(req, res, next);
    });
    await bot.api.setWebhook(`${config.webhookUrl.replace(/\/$/, '')}${route}`, { secret_token: config.webhookSecret });
    console.log('[JOSH-VIBES] Telegram webhook configured.');
  } else {
    await bot.api.deleteWebhook();
    bot.start({ onStart: (info) => console.log(`[JOSH-VIBES] @${info.username} is running in polling mode.`) });
  }
}

async function shutdown(signal) {
  console.log(`[JOSH-VIBES] Shutting down after ${signal}.`);
  clearInterval(followUpTimer);
  await bot.stop();
  if (server) await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
start().catch((error) => {
  console.error('[JOSH-VIBES] Startup failed:', error.message);
  process.exit(1);
});
