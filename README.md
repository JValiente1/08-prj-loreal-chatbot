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
3. Add a `secrets.js` file in the project root.

## Add your API configuration

Create `secrets.js` with one of these options:

Option A: Direct OpenAI request

```js
const OPENAI_API_KEY = "YOUR_OPENAI_KEY";
```

Option B: Cloudflare Worker (recommended for production)

```js
const CHAT_API_URL = "https://your-worker-url.workers.dev";
```

If you use a Worker, keep API keys on the server side (not in client code).

## Important API format reminder

- Send `messages` in the request body (not `prompt`)
- Read the assistant reply from `data.choices[0].message.content`

## Suggested demo prompts

- Build me a morning skincare routine for oily skin
- Recommend a beginner makeup routine for work
- I have frizzy hair, suggest a full routine
- Suggest a fresh floral fragrance for daytime
