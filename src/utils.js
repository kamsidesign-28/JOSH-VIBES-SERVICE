import crypto from 'node:crypto';

export const BRAND_FOOTER = '\n\n— JOSH-VIBES';

export function branded(text) {
  const clean = String(text || '').trim();
  if (!clean) return 'JOSH-VIBES AI Assistant is ready to help.';
  return clean.endsWith('JOSH-VIBES') ? clean : `${clean}${BRAND_FOOTER}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function shortText(value, max = 1200) {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function normalizeTelegramId(id) {
  return String(id ?? '').trim();
}

export function isOwner(userId, ownerId) {
  return Boolean(ownerId) && normalizeTelegramId(userId) === normalizeTelegramId(ownerId);
}

export function safeJson(value) {
  try { return JSON.stringify(value); } catch { return '{}'; }
}

export function hashId(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function classifyLeadIntent(text) {
  const input = String(text || '').toLowerCase();
  const patterns = [
    /hire|work with|book|commission|quotation|quote|price|cost|budget|project|design for me|build for me|need a logo|need a website|collaborat/,
    /how much|available|availability|start date|deadline/
  ];
  return patterns.some((pattern) => pattern.test(input));
}

export function detectLanguage(text) {
  const input = String(text || '').toLowerCase();
  if (/\b(hau|ina|nawa|yaya|zan|aiki)\b/.test(input)) return 'Hausa';
  if (/\b(bawo|kedu|imela|ga|achoro)\b/.test(input)) return 'Igbo';
  if (/\b(bawo|se|mo|ni|fun)\b/.test(input)) return 'Yoruba';
  if (/\b(wetin|dey|abeg|una|naija)\b/.test(input)) return 'Nigerian Pidgin';
  return 'English';
}

export function leadScore({ message = '', fields = {}, sentiment = 'neutral' } = {}) {
  const text = String(message).toLowerCase();
  let score = 0;
  if (/hire|book|commission|work with|ready to start/.test(text)) score += 35;
  if (fields.projectType) score += 15;
  if (fields.businessName) score += 10;
  if (fields.deadline) score += 10;
  if (fields.budget) score += 10;
  if (fields.contact) score += 10;
  if (sentiment === 'urgent') score += 10;
  return Math.min(100, score);
}

export function leadTemperature(score) {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

export function fallbackAnswer(text, knowledge) {
  const input = String(text || '').toLowerCase();
  if (/price|cost|budget|how much/.test(input)) {
    return "Pricing depends on the project's scope, deliverables, timeline, and requirements. I do not have approved price packages in my current knowledge base, but I can collect your project details so Joshua can prepare the right quote.";
  }
  if (/service|what do you do|offer/.test(input)) {
    return `Joshua works across graphic design, branding, web design, copywriting, content, video production and editing, voice-over/audio, social media, creative direction, digital marketing support, AI-assisted creative workflows, and chatbot/digital automation concepts.`;
  }
  if (/about|who is|experience|background/.test(input)) {
    return `${knowledge.owner.name} is a Nigeria-based ${knowledge.owner.professionalTitle}. The approved profile confirms freelance multimedia design and content creation from 2021 to present and independent creative consulting from 2022 to present.`;
  }
  if (/portfolio|project|work|website/.test(input)) {
    return `You can explore the main Joshua Design portfolio here: ${knowledge.portfolioLinks.main}`;
  }
  return "I can help with Joshua's services, portfolio, workflow, project inquiries, and creative planning. I do not have that specific information yet, but I can help you contact Joshua about it.";
}
