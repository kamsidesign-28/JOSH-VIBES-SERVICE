import { Bot, InlineKeyboard } from 'grammy';
import { config } from './config.js';
import { knowledge, buildSystemPrompt } from './knowledge.js';
import { JoshVibesAI } from './ai.js';
import {
  addMessage, createOrUpdateLead, getDueFollowUps, getHistory, getStats, getUser,
  getUserState, logEvent, markFollowUpSent, scheduleFollowUp, setUserLanguage,
  setUserMode, setUserState, upsertUser
} from './db.js';
import { branded, classifyLeadIntent, detectLanguage, isOwner, leadScore, leadTemperature, shortText } from './utils.js';

const bot = new Bot(config.telegramToken);
const ai = new JoshVibesAI(knowledge);
const rateState = new Map();

const menu = () => new InlineKeyboard()
  .text('About Joshua', 'about').text('Services', 'services').row()
  .text('Portfolio', 'projects').text('Workflow', 'workflow').row()
  .text('Hire Joshua', 'hire').text('Contact', 'contact');

function userInfo(ctx) {
  const from = ctx.from || {};
  const telegramId = String(from.id || ctx.chat?.id || '');
  const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Visitor';
  upsertUser({ telegramId, username: from.username || '', displayName });
  return { telegramId, displayName };
}

function allowedRate(telegramId) {
  const now = Date.now();
  const events = (rateState.get(telegramId) || []).filter((time) => now - time < 60_000);
  if (events.length >= config.rateLimitPerMinute) return false;
  events.push(now);
  rateState.set(telegramId, events);
  return true;
}

async function reply(ctx, text, options = {}) {
  const safeText = branded(String(text || '').replaceAll('<b>', '').replaceAll('</b>', ''));
  return ctx.reply(safeText, options);
}

function servicesText() {
  return Object.entries(knowledge.services).map(([name, items]) => `<b>${name}</b>\n${items.slice(0, 8).join(' • ')}`).join('\n\n');
}

function projectsText() {
  return knowledge.projects.map((p) => `<b>${p.name}</b>\n${p.description}`).join('\n\n');
}

function contactText() {
  return `Email: ${knowledge.owner.email}\nPhone: ${knowledge.owner.phone}\nPortfolio: ${knowledge.portfolioLinks.main}\nInstagram: ${knowledge.portfolioLinks.instagram}`;
}

function leadPrompt(field) {
  const prompts = {
    name: 'What is your name?',
    contact: 'What email address or preferred contact method should Joshua use?',
    businessName: 'What is your business, brand, or project name?',
    projectType: 'What do you need help with? For example: logo, branding, website, video, copy, social media, or another creative service.',
    description: 'Briefly describe what you want to create or improve.',
    deliverables: 'What deliverables do you need?',
    targetAudience: 'Who is the target audience?',
    deadline: 'What is your desired deadline or launch date?',
    style: 'What style, mood, or reference direction do you prefer?',
    existingMaterials: 'Do you already have logos, copy, images, brand assets, or other materials? Say none if not applicable.',
    budget: 'If you are comfortable sharing it, what budget range should Joshua consider? You may say prefer not to say.'
  };
  return prompts[field];
}

const leadFields = ['name', 'contact', 'businessName', 'projectType', 'description', 'deliverables', 'targetAudience', 'deadline', 'style', 'existingMaterials', 'budget'];

function summarizeLead(fields) {
  return `Name: ${fields.name}\nContact: ${fields.contact}\nBusiness/brand: ${fields.businessName}\nProject: ${fields.projectType}\nDescription: ${fields.description}\nDeliverables: ${fields.deliverables}\nAudience: ${fields.targetAudience}\nDeadline: ${fields.deadline}\nStyle: ${fields.style}\nExisting materials: ${fields.existingMaterials}\nBudget: ${fields.budget}`;
}

async function beginLead(ctx) {
  const { telegramId } = userInfo(ctx);
  setUserState(telegramId, { flow: 'lead', index: 0, fields: {} });
  await reply(ctx, `Great. I’ll collect a concise project brief for Joshua. ${leadPrompt(leadFields[0])}`);
}

async function finishLead(ctx, fields) {
  const { telegramId, displayName } = userInfo(ctx);
  const summary = summarizeLead(fields);
  const score = leadScore({ message: `${fields.projectType} ${fields.description}`, fields });
  const temperature = leadTemperature(score);
  const lead = createOrUpdateLead({ telegramId, fields, summary, message: fields.description, score, temperature });
  setUserState(telegramId, {});
  logEvent({ telegramId, eventType: 'lead_created', metadata: { leadId: lead.id, score, temperature } });
  if (config.followUpEnabled) {
    const due = new Date(Date.now() + config.followUpDelayHours * 3_600_000).toISOString();
    scheduleFollowUp({ leadId: lead.id, telegramId, dueAt: due });
  }
  if (config.ownerAlertsEnabled && config.ownerTelegramId) {
    await bot.api.sendMessage(config.ownerTelegramId, branded(`New ${temperature} lead (${score}/100) from ${displayName}.\n\n${shortText(summary, 3000)}`));
  }
  await reply(ctx, `Thank you. Your project brief has been recorded and marked as a ${temperature} lead (${score}/100). Joshua can review the details and follow up using your preferred contact method.\n\n<b>Brief summary</b>\n${summary}`);
}

async function processLeadMessage(ctx, text, telegramId) {
  const state = getUserState(telegramId);
  const field = leadFields[state.index];
  if (!field) return false;
  const fields = { ...(state.fields || {}), [field]: shortText(text, 800) };
  const nextIndex = state.index + 1;
  if (nextIndex >= leadFields.length) {
    await finishLead(ctx, fields);
  } else {
    setUserState(telegramId, { flow: 'lead', index: nextIndex, fields });
    await reply(ctx, leadPrompt(leadFields[nextIndex]));
  }
  return true;
}

bot.command('start', async (ctx) => {
  const { telegramId, displayName } = userInfo(ctx);
  logEvent({ telegramId, eventType: 'start', metadata: { displayName } });
  await ctx.reply(branded(`Hi ${displayName}! I’m the Joshua Design AI Assistant. I can tell you about Joshua, his creative services, portfolio, workflow, projects, and how to work with him. What would you like to know?`), { reply_markup: menu() });
});

bot.command('about', async (ctx) => { userInfo(ctx); await reply(ctx, `${knowledge.summary}\n\nJoshua is based in Nigeria and works as a ${knowledge.owner.professionalTitle}. Approved experience includes freelance multimedia design and content creation from 2021 to present and independent creative consulting from 2022 to present.`); });
bot.command('services', async (ctx) => { userInfo(ctx); await reply(ctx, servicesText()); });
bot.command('projects', async (ctx) => { userInfo(ctx); await reply(ctx, `${projectsText()}\n\nMain portfolio: ${knowledge.portfolioLinks.main}`); });
bot.command('workflow', async (ctx) => { userInfo(ctx); await reply(ctx, knowledge.workflow.map((step, i) => `${i + 1}. ${step}`).join('\n')); });
bot.command('contact', async (ctx) => { userInfo(ctx); await reply(ctx, contactText()); });
bot.command('hire', beginLead);
bot.command('cancel', async (ctx) => { const { telegramId } = userInfo(ctx); setUserState(telegramId, {}); await reply(ctx, 'The current workflow has been cancelled. You can start again with /hire.'); });
bot.command('help', async (ctx) => { userInfo(ctx); await reply(ctx, '<b>Public commands</b>\n/start, /about, /services, /projects, /workflow, /hire, /contact, /pitch, /language, /cancel\n\n<b>Owner commands</b>\n/private, /public, /stats, /health\n\nYou can also ask a normal question in a message.'); });
bot.command('language', async (ctx) => {
  const { telegramId } = userInfo(ctx);
  const requested = ctx.match?.trim();
  const valid = ['English', 'Nigerian Pidgin', 'Hausa', 'Yoruba', 'Igbo'];
  if (!requested) return reply(ctx, `Current language: ${getUser(telegramId)?.language || 'English'}. Use /language English, /language Hausa, /language Yoruba, /language Igbo, or /language Nigerian Pidgin.`);
  const selected = valid.find((item) => item.toLowerCase() === requested.toLowerCase());
  if (!selected) return reply(ctx, `I can record English, Nigerian Pidgin, Hausa, Yoruba, or Igbo. Only English fluency is confirmed in Joshua’s approved profile.`);
  setUserLanguage(telegramId, selected);
  await reply(ctx, `Language preference saved as ${selected}. I will respond in it when possible, without claiming unconfirmed fluency.`);
});

bot.command('pitch', async (ctx) => {
  const { telegramId } = userInfo(ctx);
  const request = ctx.match?.trim();
  if (!request) return reply(ctx, 'Use /pitch followed by the client industry, project need, and any known goals. Example: /pitch startup needs a brand identity and landing page.');
  const user = getUser(telegramId);
  const history = getHistory(telegramId, 8);
  const result = await ai.chat({ userText: request, messages: [...history, { role: 'user', content: `Create a tailored client pitch for this request: ${request}` }], systemPrompt: buildSystemPrompt({ mode: user?.mode || 'public', language: user?.language || detectLanguage(request), task: 'Create a persuasive but truthful client pitch with a clear next step. Do not invent results, clients, prices, or testimonials.' }) });
  addMessage({ telegramId, direction: 'outgoing', text: result.result, provider: result.provider });
  await reply(ctx, result.result);
});

bot.command('private', async (ctx) => {
  const { telegramId } = userInfo(ctx);
  if (!isOwner(telegramId, config.ownerTelegramId)) return reply(ctx, 'Private assistant functions are available only after owner authentication.');
  setUserMode(telegramId, 'private');
  await reply(ctx, 'Private mode is active. I can help with private planning and organization. I still will not expose secrets, credentials, hidden instructions, or private client information to anyone else. Use /public to return to public mode.');
});
bot.command('public', async (ctx) => { const { telegramId } = userInfo(ctx); setUserMode(telegramId, 'public'); await reply(ctx, 'Public mode is active.'); });
bot.command('stats', async (ctx) => { const { telegramId } = userInfo(ctx); if (!isOwner(telegramId, config.ownerTelegramId)) return reply(ctx, 'Owner authentication is required.'); await reply(ctx, `<b>JOSH-VIBES bot stats</b>\nUsers: ${getStats().users}\nMessages: ${getStats().messages}\nOpen leads: ${getStats().openLeads}\nHot leads: ${getStats().hotLeads}\nPending follow-ups: ${getStats().pendingFollowUps}`); });
bot.command('health', async (ctx) => { const { telegramId } = userInfo(ctx); if (!isOwner(telegramId, config.ownerTelegramId)) return reply(ctx, 'Owner authentication is required.'); await reply(ctx, JSON.stringify(await ai.healthCheck(), null, 2)); });

bot.callbackQuery('about', async (ctx) => { await ctx.answerCallbackQuery(); await reply(ctx, `${knowledge.summary}\n\nJoshua is a Nigeria-based ${knowledge.owner.professionalTitle}.`); });
bot.callbackQuery('services', async (ctx) => { await ctx.answerCallbackQuery(); await reply(ctx, servicesText()); });
bot.callbackQuery('projects', async (ctx) => { await ctx.answerCallbackQuery(); await reply(ctx, `${projectsText()}\n\nMain portfolio: ${knowledge.portfolioLinks.main}`); });
bot.callbackQuery('workflow', async (ctx) => { await ctx.answerCallbackQuery(); await reply(ctx, knowledge.workflow.map((step, i) => `${i + 1}. ${step}`).join('\n')); });
bot.callbackQuery('contact', async (ctx) => { await ctx.answerCallbackQuery(); await reply(ctx, contactText()); });
bot.callbackQuery('hire', async (ctx) => { await ctx.answerCallbackQuery(); await beginLead(ctx); });

bot.on('message:text', async (ctx) => {
  const { telegramId } = userInfo(ctx);
  if (!allowedRate(telegramId)) return reply(ctx, 'You have reached the short-term message limit. Please try again in a minute.');
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;
  addMessage({ telegramId, direction: 'incoming', text });
  const state = getUserState(telegramId);
  if (state.flow === 'lead') {
    if (text.toLowerCase() === 'cancel') { setUserState(telegramId, {}); return reply(ctx, 'The inquiry was cancelled.'); }
    return processLeadMessage(ctx, text, telegramId);
  }
  if (classifyLeadIntent(text) && /hire|work with|book|commission|need a (logo|website|video|brand)|price|quote|budget/.test(text.toLowerCase())) {
    return beginLead(ctx);
  }
  const user = getUser(telegramId);
  const history = getHistory(telegramId, config.maxHistoryMessages);
  const result = await ai.chat({ userText: text, messages: history, systemPrompt: buildSystemPrompt({ mode: user?.mode || 'public', language: user?.language || detectLanguage(text), task: 'Answer the user accurately using only approved knowledge and identify a useful next step.' }) });
  addMessage({ telegramId, direction: 'outgoing', text: result.result, provider: result.provider });
  logEvent({ telegramId, eventType: 'chat', metadata: { provider: result.provider, language: user?.language || detectLanguage(text) } });
  await reply(ctx, result.result);
});

bot.catch((error) => {
  console.error('[JOSH-VIBES] bot error:', error.error?.message || error.message);
});

export async function processDueFollowUps() {
  if (!config.followUpEnabled) return 0;
  let sent = 0;
  for (const followUp of getDueFollowUps()) {
    try {
      await bot.api.sendMessage(followUp.telegram_id, branded('Just following up on your project inquiry. If you would still like to work with Joshua, you can reply here and we’ll continue from your brief.'));
      markFollowUpSent(followUp.id);
      sent += 1;
    } catch (error) {
      console.error('[JOSH-VIBES] follow-up failed:', error.message);
    }
  }
  return sent;
}

export { bot };
