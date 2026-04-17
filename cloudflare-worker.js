// Cloudflare Worker that proxies chat requests to OpenAI.
// Store the key securely in Worker Secrets as OPENAI_API_KEY.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { status: 405, headers: corsHeaders },
      );
    }

    try {
      if (!env.OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Missing OPENAI_API_KEY Worker secret." }),
          { status: 500, headers: corsHeaders },
        );
      }

      const payload = await request.json();

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: payload.model || "gpt-4o",
            messages: payload.messages,
            max_completion_tokens: payload.max_completion_tokens || 350,
          }),
        },
      );

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: corsHeaders,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Worker request failed",
          details: error.message,
        }),
        { status: 500, headers: corsHeaders },
      );
    }
  },
};


