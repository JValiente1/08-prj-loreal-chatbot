// Cloudflare Worker that proxies chat requests to OpenAI.
// Store the key securely in Worker Secrets as OPENAI_API_KEY.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // /api/chat endpoint — proxies to OpenAI
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        if (!env.OPENAI_API_KEY) {
          return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500, headers: jsonHeaders });
        }
        const payload = await request.json();
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: payload.model || "gpt-4o",
            messages: payload.messages,
            max_completion_tokens: payload.max_completion_tokens || 350
          })
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers: jsonHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
      }
    }

    // Serve static assets (your chatbot UI)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};
