import test from 'node:test';
import assert from 'node:assert/strict';
import { knowledge } from '../src/knowledge.js';
import { fallbackAnswer, leadScore, leadTemperature, classifyLeadIntent, isOwner } from '../src/utils.js';
import { addMessage, createOrUpdateLead, getHistory, getUser, scheduleFollowUp, setUserState, getUserState, upsertUser } from '../src/db.js';

test('knowledge base contains approved JOSH-VIBES identity and portfolio', () => {
  assert.equal(knowledge.brand, 'JOSH-VIBES');
  assert.equal(knowledge.owner.email, 'joshuamultimediadesign@gmail.com');
  assert.equal(knowledge.portfolioLinks.main, 'https://joshuadesign1.vercel.app/');
  assert.ok(knowledge.services['Graphic Design'].includes('Logo design'));
});

test('lead intent is detected for hiring language but not ordinary greeting', () => {
  assert.equal(classifyLeadIntent('I want to hire you for a website'), true);
  assert.equal(classifyLeadIntent('Hello, what do you do?'), false);
});

test('lead scoring produces transparent temperature bands', () => {
  const score = leadScore({ message: 'ready to hire for a branding project', fields: { projectType: 'branding', businessName: 'Test Brand', deadline: 'next month', contact: 'email' } });
  assert.ok(score >= 70);
  assert.equal(leadTemperature(score), 'hot');
});

test('fallback never invents pricing', () => {
  const answer = fallbackAnswer('How much does a logo cost?', knowledge);
  assert.match(answer, /Pricing depends/);
  assert.match(answer, /do not have approved price packages/i);
});

test('owner check uses exact numeric identity', () => {
  assert.equal(isOwner('12345', '12345'), true);
  assert.equal(isOwner('12345', '123456'), false);
  assert.equal(isOwner('joshua', '12345'), false);
});

test('SQLite persists a user conversation state and lead record', () => {
  const telegramId = `test-${Date.now()}`;
  upsertUser({ telegramId, username: 'tester', displayName: 'Test User' });
  setUserState(telegramId, { flow: 'lead', index: 1, fields: { name: 'Test User' } });
  addMessage({ telegramId, direction: 'incoming', text: 'I need a logo' });
  addMessage({ telegramId, direction: 'outgoing', text: 'I can help with logo design', provider: 'fallback' });
  const lead = createOrUpdateLead({ telegramId, fields: { name: 'Test User', projectType: 'logo' }, summary: 'Logo request', message: 'I need a logo', score: 50, temperature: 'warm' });
  scheduleFollowUp({ leadId: lead.id, telegramId, dueAt: new Date(Date.now() + 86_400_000).toISOString() });
  assert.equal(getUser(telegramId).display_name, 'Test User');
  assert.equal(getUserState(telegramId).flow, 'lead');
  assert.equal(getHistory(telegramId).length, 2);
});
