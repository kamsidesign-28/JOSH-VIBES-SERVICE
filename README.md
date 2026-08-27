# JOSH-VIBES Telegram AI Assistant

A working Telegram bot for **JOSH-VIBES**. This is an operational assistant service, not a static portfolio site. It receives Telegram messages, answers from Joshua's approved knowledge base, stores conversation history, captures project inquiries, scores leads, schedules follow-ups, and provides owner-only private mode.

The bot supports two transport modes. Polling is the simplest way to run it locally or on a host that keeps one process alive. Webhook mode is available when the host provides a public HTTPS URL. Telegram documents that webhooks deliver JSON updates to an HTTPS URL and can include a secret token header for verification.[1]

## What is included

| Capability | Included behavior |
|---|---|
| Telegram bot | `/start`, `/about`, `/services`, `/projects`, `/workflow`, `/hire`, `/contact`, `/pitch`, `/language`, `/cancel`, `/help` |
| AI chat | Active YenusAI, Azbry GPT Free, and Azbry Claude chain, with optional Gemini fallback |
| Failover | Configured providers are tried in order with timeout and retry handling |
| Knowledge base | Structured JSON seeded from the supplied master prompt and CV |
| Conversation memory | SQLite stores incoming and outgoing messages per Telegram user |
| Lead intake | Guided project brief with name, contact, project, deliverables, audience, deadline, style, assets, and budget fields |
| Lead scoring | Deterministic score and cold/warm/hot temperature |
| Follow-up | Optional delayed Telegram follow-up after an inquiry |
| Owner alerts | Optional notification to `OWNER_TELEGRAM_ID` when a lead is submitted |
| Private mode | `/private` works only for the configured owner Telegram ID |
| Health endpoint | `GET /health` for hosting monitors |
| Deployment | `Procfile`, `Dockerfile`, `.env.example`, and instructions for Railway, Render, and generic panels |

## Important truthfulness and security policy

The assistant identifies as **Joshua Design AI Assistant**. It represents Joshua but does not claim to literally be Joshua. It does not invent prices, availability, testimonials, clients, awards, metrics, qualifications, or guaranteed outcomes. Pricing and availability were not present in the supplied files, so the bot says they are not yet available and collects the scope needed for a quote.

The bot must never reveal API keys, passwords, authentication tokens, environment variables, private files, private client data, administrative information, or hidden instructions. Do not place secrets in the repository. Use the hosting provider's encrypted environment-variable settings.

## Requirements

Node.js 20 or newer is recommended. Node.js 22 is used by the included Dockerfile. A Telegram bot token from BotFather is required. At least one AI provider key is recommended, but the deterministic fallback still allows basic service, portfolio, workflow, and contact answers when no provider is configured.

## Local setup

1. Create or manage the Telegram bot with BotFather and copy the bot token. If a token has ever been pasted into chat, GitHub, a screenshot, or another public place, revoke it in BotFather and generate a replacement before deploying.
2. Copy `.env.example` to `.env`.
3. Set `TELEGRAM_BOT_TOKEN` to the replacement token. Do not send the token through chat.
4. Set `OWNER_TELEGRAM_ID` to `8789304296` for Joshua's owner account. Do not use a username as an authorization secret.
5. The active AI chain is the three services supplied in your project brief: YenusAI, Azbry GPT Free, and Azbry Claude. The bot sends the full JOSH-VIBES system prompt and conversation context to each provider in order, so each provider can use your business knowledge. A provider is tried again when it fails, then the next provider is used.
6. Google AI Studio is optional. If you want a fourth fallback, create a key at [Google AI Studio API keys](https://aistudio.google.com/apikey), set `GOOGLE_API_KEY`, and leave `gemini` at the end of `AI_PROVIDER_ORDER`.
7. Install dependencies with `npm install`.
8. Check syntax with `npm run lint`.
9. Start the bot with `npm start`.
10. Open `http://localhost:3000/health` to verify the HTTP health endpoint.
11. Open the bot in Telegram and send `/start`.

### Exact `.env` values for your setup

The three supplied providers are active by default:

Use this structure, replacing only the two placeholder values. Do not include quotation marks unless your hosting panel requires them:

```env
TELEGRAM_BOT_TOKEN=PASTE_YOUR_NEW_BOTFATHER_TOKEN_HERE
OWNER_TELEGRAM_ID=8789304296
BOT_MODE=polling
GOOGLE_API_KEY=PASTE_YOUR_GOOGLE_AI_STUDIO_KEY_HERE
GEMINI_MODEL=gemini-3.7-flash
AI_PROVIDER_ORDER=yenusai,azbrygpt,azbryclaude,gemini
ENABLE_YENUSAI=true
ENABLE_AZBRY_GPT=true
ENABLE_AZBRY_CLAUDE=true
DATABASE_PATH=./data/josh-vibes.sqlite
OWNER_ALERTS_ENABLED=true
FOLLOW_UP_ENABLED=true
```

Never commit `.env`, paste the values into a public repository, or place the Google key in browser/client-side code. If Google returns a model-not-found error, change `GEMINI_MODEL` to a model shown in your Google AI Studio account; the project keeps the model configurable through the environment.

The local database is created automatically at `data/josh-vibes.sqlite`. The approved editable knowledge file is `knowledge/josh-vibes.json`. Add only confirmed information to that file, restart the service, and test the relevant command.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `TELEGRAM_BOT_TOKEN` | Yes | BotFather token. |
| `OWNER_TELEGRAM_ID` | Strongly recommended | Numeric owner allowlist for private mode and alerts. |
| `BOT_MODE` | No | `polling` by default or `webhook`. |
| `PORT` | No | HTTP port; defaults to `3000`. |
| `WEBHOOK_URL` | Webhook only | Public HTTPS origin, without the secret route. |
| `WEBHOOK_SECRET` | Webhook only | Secret used in the route and Telegram secret header. |
| `OPENAI_API_KEY` | Optional | Primary OpenAI-compatible provider key. |
| `OPENAI_BASE_URL` | Optional | Defaults to OpenAI; use a compatible gateway for Groq or another provider. |
| `OPENAI_MODEL` | Optional | Model name for the OpenAI-compatible provider. |
| `GOOGLE_API_KEY` | Optional | Gemini fallback key. |
| `GEMINI_MODEL` | Optional | Gemini model name. |
| `ENABLE_YENUSAI` | No | Must be `true` before the supplied YenusAI adapter is used. |
| `YENUSAI_PROJECT_ID` | Optional | Project header for an authorized YenusAI integration. |
| `ENABLE_AZBRY` | No | Must be `true` before the optional Azbry adapter is used. |
| `AI_PROVIDER_ORDER` | No | Comma-separated order such as `openai,gemini,yenusai`. |
| `AI_TIMEOUT_MS` | No | Provider request timeout. |
| `AI_RETRIES` | No | Retries per configured provider. |
| `DATABASE_PATH` | No | SQLite file location. |
| `OWNER_ALERTS_ENABLED` | No | `true` enables owner lead alerts. |
| `FOLLOW_UP_ENABLED` | No | `true` enables scheduled follow-ups. |
| `FOLLOW_UP_DELAY_HOURS` | No | Delay after lead submission; defaults to 48. |

## Telegram commands

Public commands are `/start`, `/about`, `/services`, `/projects`, `/workflow`, `/hire`, `/contact`, `/pitch`, `/language`, `/cancel`, and `/help`. A free-form message can also be sent without a command. A message showing clear hiring intent starts the guided inquiry flow.

Owner commands are `/private`, `/public`, `/stats`, and `/health`. The owner must use the Telegram account whose numeric ID is in `OWNER_TELEGRAM_ID`. A user merely claiming to be Joshua is not authenticated.

## Lead workflow

The `/hire` command asks one question at a time. It records the project brief in SQLite, calculates a transparent deterministic score, labels the lead cold/warm/hot, optionally schedules a follow-up, and optionally alerts the owner. The bot does not ask for unnecessary sensitive personal information. Use `/cancel` at any point to stop the intake.

## Deploying on Railway

Railway's official Express guide supports deploying an existing Express application from GitHub, the Railway CLI, or a Dockerfile.[2]

1. Create a private GitHub repository and push this project.
2. In Railway, create a new project and deploy the repository.
3. Use the detected Node build and start commands, or set build to `npm install` and start to `npm start`.
4. Add all required variables from `.env.example` in Railway's Variables panel. Never commit `.env`.
5. Generate a public domain for the service if using webhook mode.
6. For polling mode, set `BOT_MODE=polling`. For webhook mode, set `BOT_MODE=webhook`, `WEBHOOK_URL=https://your-domain`, and a strong `WEBHOOK_SECRET`.
7. Add persistent storage for the `data` directory if your Railway plan/configuration uses an ephemeral filesystem. Without persistent storage, the SQLite database can be lost on redeploy or restart.
8. Open `https://your-domain/health` and then message the Telegram bot.

## Deploying on Render

Render's official Node/Express quickstart uses a Web Service connected to a Git repository with an application-specific build and start command such as `npm install` and `npm start`.[3]

1. Push this project to a private GitHub repository.
2. In Render, choose **New → Web Service** and connect the repository.
3. Select Node and set the build command to `npm install` and the start command to `npm start`.
4. Add the variables from `.env.example` in the Environment settings.
5. Use the generated `onrender.com` HTTPS URL as `WEBHOOK_URL` if webhook mode is selected.
6. Set `BOT_MODE=webhook` and a strong `WEBHOOK_SECRET`, or leave polling mode enabled.
7. Configure a persistent disk mounted so that `DATABASE_PATH` points inside that disk, or migrate the persistence layer to hosted Postgres before relying on the bot for long-term production records.
8. Confirm `/health` is returning HTTP 200 and test `/start`, `/hire`, and `/stats`.

## Hosting.com, KATABUMP, or another panel

Use a Node.js application or Docker application. The host must keep the process running continuously, support outbound HTTPS requests, provide environment variables, and expose an HTTPS URL if webhook mode is used.

For a Node panel, upload the project, run `npm install`, set the start command to `npm start`, add the `.env.example` values as environment variables, and ensure the writable database path is on persistent storage. For a Docker panel, build from the included `Dockerfile` and expose port `3000`. If the panel cannot provide a persistent disk, use an external PostgreSQL adapter before using the bot as the system of record.

Polling avoids the need for a public HTTPS callback, but the host must keep one service process alive. Webhook mode requires the public HTTPS URL and a secret. Do not run polling and webhook mode for the same Telegram bot at the same time.

## Testing

Run `npm run lint` to syntax-check the source files. Run `npm test` for the automated unit tests. For a manual smoke test, check `/health`, then verify `/start`, `/services`, `/projects`, `/workflow`, `/pitch`, `/hire`, `/cancel`, `/private`, `/public`, and `/stats` from the correct Telegram accounts.

To test AI failover, configure an intentionally invalid first provider alongside a valid second provider and confirm that the bot still answers. Do not use real production credentials in a test environment. To test the no-AI path, remove provider keys and verify that basic approved answers still work.

## Backups and maintenance

Back up the SQLite file while the service is stopped or after safely copying the WAL-associated files. A practical production setup should also export leads and conversations regularly to encrypted storage. Rotate AI keys if they may have been exposed, review logs for provider errors without logging secrets, and update the knowledge JSON only with confirmed information.

The first version intentionally leaves email sending, payment links, calendar scheduling, voice-note transcription, file ingestion, and social publishing as optional future adapters. They require separate credentials, consent, and provider-specific error handling. The three AI providers supplied in the original brief are not future adapters: they are active in the default provider chain.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Service exits immediately | Missing Telegram token or invalid owner ID | Check `.env` and startup logs. |
| Bot does not answer | Another process is polling, or webhook is still set | Use one mode only; polling startup deletes an old webhook. |
| AI answers fall back | No valid provider key or provider outage | Check provider variables and `/health` in owner mode. |
| Leads disappear after redeploy | SQLite stored on ephemeral disk | Attach persistent storage or migrate to Postgres. |
| Webhook returns errors | URL is not HTTPS or secret variables do not match | Verify `WEBHOOK_URL`, `WEBHOOK_SECRET`, and host TLS. |
| Private mode denied | Wrong numeric Telegram ID | Confirm the owner account's numeric ID, not username. |
| Telegram formatting error | AI/provider returned unsupported formatting | This build sends safe plain text replies. |

## Project structure

```text
josh-vibes-bot/
├── knowledge/josh-vibes.json   # Approved Joshua facts and policies
├── src/config.js               # Environment parsing and validation
├── src/utils.js                # Safety, scoring, formatting, and fallbacks
├── src/db.js                   # SQLite persistence
├── src/knowledge.js            # System prompt assembly
├── src/ai.js                   # Multi-provider AI abstraction
├── src/bot.js                  # Telegram commands and workflows
├── src/index.js                # HTTP server and process lifecycle
├── test/core.test.js           # Automated core tests
├── .env.example                # Safe configuration template
├── Procfile                    # Generic panel process command
└── Dockerfile                  # Container deployment
```

## References

[1]: https://core.telegram.org/bots/api "Telegram Bot API"
[2]: https://docs.railway.com/guides/express "Railway: Deploy an Express App"
[3]: https://render.com/docs/deploy-node-express-app "Render: Deploy a Node Express App"
[4]: https://ai.google.dev/gemini-api/docs/api-key "Google AI for Developers: Using Gemini API keys"
