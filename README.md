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

By default, the app sends chat requests to the same domain at `/api/chat`.

If you deploy the frontend and API together, you do not need to change anything in `script.js`.

If you want to point the frontend at a different deployed API, create `secrets.js` from `secrets.example.js` and set:

```js
const CHAT_API_URL = "https://your-api-url.example.com/api/chat";
```

Do not place your OpenAI API key in `secrets.js` or any browser-side file.

## Cloudflare Pages setup (same-domain API)

This project includes a Cloudflare Pages Function for the chat API:

- `functions/api/chat.js`

Steps:

1. Create a Cloudflare Pages project connected to this repository.
2. Deploy the project so your static files and the `functions/` folder are published together.
3. In Pages project settings, add a secret:
   - Name: `OPENAI_API_KEY`
   - Value: your OpenAI API key
4. Redeploy the project after adding the secret.
5. Open your deployed site.
6. The frontend will send requests to `/api/chat` on that same domain.

### Deploy with Wrangler (CLI)

If you use Wrangler in Codespaces, this minimal flow works for Pages:

```bash
npx wrangler login
npx wrangler pages secret put OPENAI_API_KEY
npx wrangler pages deploy .
```

After deploy, Wrangler prints your site URL.

## Test your same-domain API URL

Before testing, replace `YOUR_SITE_URL` in the commands below.

1. Run the GET request for the API path.
2. Run the POST request for the API path.

Expected result:

- GET should return JSON, not your website HTML.
- POST should return JSON.
- If your Pages secret is missing, you should still get a JSON error message.

```bash
curl -i YOUR_SITE_URL/api/chat
curl -i -X POST YOUR_SITE_URL/api/chat \
   -H "Content-Type: application/json" \
   --data '{"model":"gpt-4o","messages":[{"role":"user","content":"Say hello"}],"max_completion_tokens":20}'
```

If the GET request returns your page HTML, or the POST request returns HTML or an empty body, the API route is not deployed correctly yet.

## Alternative: separate Worker API

If you prefer to keep the API on a separate Worker domain, you can still use `cloudflare-worker.js` and point `CHAT_API_URL` at that deployed URL.

## Important API format reminder

- Send `messages` in the request body (not `prompt`)
- Read the assistant reply from `data.choices[0].message.content`

## Suggested demo prompts

- Build me a morning skincare routine for oily skin
- Recommend a beginner makeup routine for work
- I have frizzy hair, suggest a full routine
- Suggest a fresh floral fragrance for daytime
