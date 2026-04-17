// Cloudflare Pages Function for the same-domain /api/chat endpoint.
// Store the key securely in Pages project secrets as OPENAI_API_KEY.

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    },
  });
}

export function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export function onRequestGet() {
  return jsonResponse(
    { error: "Method not allowed. Use POST at /api/chat." },
    405,
  );
}

export async function onRequestPost(context) {
  try {
    if (!context.env.OPENAI_API_KEY) {
      return jsonResponse(
        { error: "Missing OPENAI_API_KEY Pages secret." },
        500,
      );
    }

    const payload = await context.request.json();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: payload.model || "gpt-4o",
        messages: payload.messages,
        max_completion_tokens: payload.max_completion_tokens || 350,
      }),
    });

    const data = await response.json();

    return jsonResponse(data, response.status);
  } catch (error) {
    return jsonResponse(
      {
        error: "API request failed",
        details: error.message,
      },
      500,
    );
  }
}
