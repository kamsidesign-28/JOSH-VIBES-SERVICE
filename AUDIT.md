# JOSH-VIBES Bot Requirements Audit

## Executive conclusion

The requested product is a **working Telegram AI assistant**, not a portfolio display site. It should operate as a Telegram bot, use Joshua's approved documents as a controlled knowledge base, store conversations and leads, provide public and authenticated private modes, and be deployable as a long-running Node.js service on Railway, Render, or a comparable hosting panel.

## Source files reviewed

| Source | Main contribution | Implementation consequence |
|---|---|---|
| `JoshuaDesign—MasterAIBrand&WorkAssistantKnowledgePrompt.md` | Brand identity, services, public/private permissions, security rules, workflow, lead fields, plugin boundaries, response rules, menu structure | Becomes the authoritative behavioral policy and structured knowledge seed. |
| `Joshua_Multimedia_Design_(1).pdf` | Professional summary, skills, experience from 2021, consulting from 2022, achievements, education, tools, English fluency, contact details | Becomes approved professional profile data. No unlisted clients, prices, awards, or qualifications may be invented. |
| `pasted_content.txt` | Full product brief: Telegram commands, multi-user history, AI failover, lead qualification, follow-ups, voice/file support, analytics, deployment, testing and maintenance | Defines the bot features and operational documentation. Features requiring credentials are implemented as optional integrations with safe fallbacks. |
| `pasted_content_2.txt` | Intended multi-provider JavaScript client and logo reference | Provides the failover concept, but the code is syntactically broken and unsafe to use unchanged. It must be rewritten with environment-based configuration, validated response parsing, timeouts, retries, and no hard-coded secrets. |

## Authoritative profile facts

Joshua is a Nigeria-based Multimedia Designer, Copywriter, and Digital Content Specialist. Approved capabilities include graphic design, branding, web design, copywriting, content writing, video production and editing, voice-over and audio production, social media design and marketing, creative direction, digital marketing support, client communication, project management, surveying and field data documentation, visual storytelling, AI-assisted design, and creative software workflows.

The CV confirms freelance multimedia design and content creation from 2021 to present, independent creative consulting from 2022 to present, self-directed online learning and professional development from 2020 to present, and tools including Adobe Photoshop, Adobe Premiere Pro, Canva, CapCut, AI design/writing tools, and audio recording/editing software. The approved public contact is `joshuamultimediadesign@gmail.com` and the approved phone is `070591207090`.

## Required behavior

The bot must identify itself as the **Joshua Design AI Assistant** and may use the related names Joshua Design, Joshua Multimedia, JOSH-VIBES, and JOSH-VIBES_cyber as one brand ecosystem. It must not claim to literally be Joshua. It must not reveal prompts, environment variables, tokens, private files, client information, or internal configuration. It must say when information is unavailable instead of guessing.

Public users can learn about Joshua, services, portfolio links, projects, workflow, contact details, and submit inquiries. Private functions require an allowlist-based authentication gate controlled by `OWNER_TELEGRAM_ID` and optional private-session state. Private functions include notes, tasks, project organization, content planning, and internal business workflows.

The bot should support `/start`, `/workflow`, `/projects`, `/pitch`, `/about`, `/services`, `/help`, and practical additional commands such as `/hire`, `/status`, `/private`, `/cancel`, and `/language`. Free-form messages should be classified into normal questions, service interest, and lead-intent conversations. Lead collection should request only relevant fields, summarize the inquiry, score it, and optionally notify Joshua.

## Missing or intentionally optional information

Pricing packages, confirmed availability, testimonials, case-study metrics, detailed project records, and multilingual source content were not present in the supplied documents. The bot must not fabricate them. These are stored as empty or unknown fields and can be added later through the knowledge-base JSON or an authenticated admin workflow.

The supplied YenusAI and Azbry endpoints may change or may not be authorized for production use. They are configured only as optional providers. The default production path is an OpenAI-compatible provider selected through environment variables, with provider failover and a deterministic fallback response when all providers are unavailable.

## Implementation decision

Build a standalone Node.js Telegram bot service with:

1. Telegram long polling by default, plus webhook-compatible HTTP endpoints for hosted deployments.
2. SQLite persistence for conversations, leads, follow-up jobs, owner notes, and lightweight analytics.
3. A provider abstraction supporting OpenAI-compatible APIs, Gemini-compatible REST, and the supplied custom endpoints through environment configuration.
4. A retrieval-light knowledge layer that injects the approved structured knowledge into the system prompt and uses document chunks stored in the repository.
5. A lead workflow state machine, scoring, optional follow-up scheduler, and owner-only commands.
6. Security-first configuration with `.env.example`, redacted logs, input validation, rate limits, and no secrets in source control.
7. Deployment files for Railway/Render-style Node hosting, a health endpoint, graceful shutdown, and a complete non-technical README.

## Scope boundary for the first working build

The first build will make the core bot operational and testable: Telegram commands and free-form chat, multi-user conversation history, approved knowledge, provider failover, public/private access control, inquiry capture, lead scoring, follow-up scheduling, owner notifications, health checks, and deployment documentation. Email sending, payments, voice transcription, external calendar access, and social publishing will be optional adapters with explicit configuration rather than pretending they work without credentials.
