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
  const body = await context.request.json();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return new Response(response.body, {
    headers: { "Content-Type": "application/json" },
  });
}
