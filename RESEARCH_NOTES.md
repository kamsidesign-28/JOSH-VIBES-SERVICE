# Deployment verification notes

## Telegram Bot API

The official Telegram Bot API documentation states that `setWebhook` sends JSON-serialized updates to an HTTPS URL via POST. It supports a `secret_token` that Telegram sends in the `X-Telegram-Bot-Api-Secret-Token` header, which is useful for verifying webhook requests. Source: https://core.telegram.org/bots/api

The bot implementation therefore supports a webhook mode with an HTTPS `WEBHOOK_URL` and a secret path/header configuration, while polling remains the simpler default for local development.

## Railway

Railway's official Express guide supports deploying an existing Express application from GitHub, through the CLI, or with a Dockerfile. The project is therefore packaged with a standard `package.json`, `npm start`, environment variables, and an optional Dockerfile. Source: https://docs.railway.com/guides/express

## Render

Render's official Node/Express quickstart uses a Web Service connected to a Git repository, with Node as the language and an application-specific build/start command such as `npm install` and `npm start`. Render provides an `onrender.com` URL and automatic redeploys for later pushes. Source: https://render.com/docs/deploy-node-express-app
