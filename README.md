# Project 8: L'Oreal Chatbot

Build a beginner-friendly AI chatbot that helps users explore L'Oreal products across:

- Makeup
- Skincare
- Haircare
- Fragrance

The chatbot can also create personalized routines and recommendations.

## What this version includes

- Conversational chat UI with user and assistant bubbles
- Personalization from user details (skin type, hair concerns, fragrance style, budget)
- Guided quick-prompt buttons for faster discovery
- OpenAI Chat Completions request using a `messages` array
- Response parsing from `data.choices[0].message.content`

## Run in Codespaces

1. Open this repository in GitHub Codespaces.
2. Open `index.html` with Live Preview.
3. Copy `secrets.example.js` to `secrets.js` in the project root only if you want to override the default API path.

## Add your API configuration

By default, the app sends chat requests to a separate Cloudflare Worker API at:

```
https://loreal-chatbot-api.jackie-valiente1.workers.dev
```

If you want to point the frontend at a different API endpoint, create `secrets.js` from `secrets.example.js` and set:

```js
const CHAT_API_URL = "https://your-api-url.example.com";
```

**Do not place your OpenAI API key in `secrets.js` or any browser-side file.**

## Cloudflare Worker API setup

This project includes a Cloudflare Worker handler in `cloudflare-worker.js` for standalone API deployment.

Steps:

1. Log in to Cloudflare:

   ```bash
   npx wrangler login
   ```

2. Add your OpenAI API key as a Worker secret:

   ```bash
   npx wrangler secret put OPENAI_API_KEY --name loreal-chat-api
   ```

   Paste your OpenAI API key when prompted.

3. Deploy the Worker:

   ```bash
   npx wrangler deploy cloudflare-worker.js --name loreal-chat-api
   ```

   Wrangler prints your Worker URL after deployment.

4. Update `secrets.js` (if it exists) with your Worker URL:
   ```js
   const CHAT_API_URL = "https://loreal-chat-api.<your-subdomain>.workers.dev";
   ```

## Test your Worker API URL

Replace `YOUR_WORKER_URL` with the URL from deployment.

```bash
curl -i -X POST YOUR_WORKER_URL \
   -H "Content-Type: application/json" \
   --data '{"model":"gpt-4o","messages":[{"role":"user","content":"Say hello"}],"max_completion_tokens":20}'
```

Expected: HTTP 200 with JSON containing assistant message or OpenAI error.

## Alternative: Cloudflare Pages with same-domain API

If you prefer to deploy frontend and API together on the same domain, use `functions/api/chat.js`:

```bash
npx wrangler login
npx wrangler pages project create 08-prj-loreal-chatbot --production-branch main
npx wrangler pages secret put OPENAI_API_KEY --project-name 08-prj-loreal-chatbot
npx wrangler pages deploy . --project-name 08-prj-loreal-chatbot
```

Then update `secrets.js` to use same-site API:

```js
const CHAT_API_URL = "/api/chat";
```

## Important API format reminder

- Send `messages` in the request body (not `prompt`)
- Read the assistant reply from `data.choices[0].message.content`

## Suggested demo prompts

- Build me a morning skincare routine for oily skin
- Recommend a beginner makeup routine for work
- I have frizzy hair, suggest a full routine
- Suggest a fresh floral fragrance for daytime
