import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    language TEXT DEFAULT 'English',
    mode TEXT DEFAULT 'public',
    state_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
    text TEXT NOT NULL,
    provider TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_messages_user_time ON messages(telegram_id, created_at);
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    score INTEGER NOT NULL DEFAULT 0,
    temperature TEXT NOT NULL DEFAULT 'cold',
    fields_json TEXT NOT NULL DEFAULT '{}',
    summary TEXT,
    last_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, updated_at);
  CREATE TABLE IF NOT EXISTS follow_ups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    telegram_id TEXT NOT NULL,
    due_at TEXT NOT NULL,
    sent_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_followups_due ON follow_ups(status, due_at);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT,
    event_type TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();

export function upsertUser({ telegramId, username = '', displayName = '' }) {
  const timestamp = now();
  db.prepare(`INSERT INTO users (telegram_id, username, display_name, created_at, updated_at)
    VALUES (@telegramId, @username, @displayName, @createdAt, @updatedAt)
    ON CONFLICT(telegram_id) DO UPDATE SET username=@username, display_name=@displayName, updated_at=@updatedAt`).run({
    telegramId: String(telegramId), username: username || '', displayName: displayName || '', createdAt: timestamp, updatedAt: timestamp
  });
}

export function setUserLanguage(telegramId, language) {
  db.prepare('UPDATE users SET language = ?, updated_at = ? WHERE telegram_id = ?').run(language, now(), String(telegramId));
}

export function getUser(telegramId) {
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
}

export function setUserMode(telegramId, mode) {
  db.prepare('UPDATE users SET mode = ?, updated_at = ? WHERE telegram_id = ?').run(mode, now(), String(telegramId));
}

export function getUserState(telegramId) {
  const user = getUser(telegramId);
  try { return JSON.parse(user?.state_json || '{}'); } catch { return {}; }
}

export function setUserState(telegramId, state) {
  db.prepare('UPDATE users SET state_json = ?, updated_at = ? WHERE telegram_id = ?').run(JSON.stringify(state || {}), now(), String(telegramId));
}

export function addMessage({ telegramId, direction, text, provider = null }) {
  db.prepare('INSERT INTO messages (telegram_id, direction, text, provider, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(String(telegramId), direction, String(text || ''), provider, now());
}

export function getHistory(telegramId, limit = config.maxHistoryMessages) {
  const rows = db.prepare(`SELECT direction, text, provider FROM messages WHERE telegram_id = ? ORDER BY id DESC LIMIT ?`)
    .all(String(telegramId), Math.max(1, Math.min(limit, 100)));
  return rows.reverse().map((row) => ({ role: row.direction === 'incoming' ? 'user' : 'assistant', content: row.text }));
}

export function createOrUpdateLead({ telegramId, fields = {}, summary = '', message = '', score = 0, temperature = 'cold' }) {
  const existing = db.prepare(`SELECT * FROM leads WHERE telegram_id = ? AND status NOT IN ('closed','converted') ORDER BY id DESC LIMIT 1`).get(String(telegramId));
  const timestamp = now();
  if (existing) {
    const merged = { ...JSON.parse(existing.fields_json || '{}'), ...fields };
    db.prepare(`UPDATE leads SET score=?, temperature=?, fields_json=?, summary=?, last_message=?, updated_at=? WHERE id=?`)
      .run(score, temperature, JSON.stringify(merged), summary || existing.summary || '', message, timestamp, existing.id);
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(existing.id);
  }
  const result = db.prepare(`INSERT INTO leads (telegram_id, status, score, temperature, fields_json, summary, last_message, created_at, updated_at)
    VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?)`).run(String(telegramId), score, temperature, JSON.stringify(fields), summary, message, timestamp, timestamp);
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
}

export function scheduleFollowUp({ leadId, telegramId, dueAt }) {
  return db.prepare('INSERT INTO follow_ups (lead_id, telegram_id, due_at) VALUES (?, ?, ?)')
    .run(leadId, String(telegramId), dueAt).lastInsertRowid;
}

export function getDueFollowUps() {
  return db.prepare(`SELECT * FROM follow_ups WHERE status='pending' AND due_at <= ? ORDER BY due_at ASC LIMIT 50`).all(now());
}

export function markFollowUpSent(id) {
  db.prepare(`UPDATE follow_ups SET status='sent', sent_at=? WHERE id=?`).run(now(), id);
}

export function logEvent({ telegramId = null, eventType, metadata = {} }) {
  db.prepare('INSERT INTO events (telegram_id, event_type, metadata_json, created_at) VALUES (?, ?, ?, ?)')
    .run(telegramId ? String(telegramId) : null, eventType, JSON.stringify(metadata), now());
}

export function getStats() {
  return {
    users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    messages: db.prepare('SELECT COUNT(*) AS count FROM messages').get().count,
    openLeads: db.prepare("SELECT COUNT(*) AS count FROM leads WHERE status NOT IN ('closed','converted')").get().count,
    hotLeads: db.prepare("SELECT COUNT(*) AS count FROM leads WHERE temperature='hot' AND status NOT IN ('closed','converted')").get().count,
    pendingFollowUps: db.prepare("SELECT COUNT(*) AS count FROM follow_ups WHERE status='pending'").get().count
  };
}

export function closeDatabase() { db.close(); }
