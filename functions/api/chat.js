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
  return new Response(
    "L'Oreal Beauty Advisor API is online. Send your chat payload to /api/chat using method POST.",
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "text/plain; charset=UTF-8",
      },
    },
  );
}

export async function onRequestPost(context) {
  if (!context.env || !context.env.OPENAI_API_KEY) {
    return jsonResponse(
      {
        error:
          "Missing OPENAI_API_KEY Pages secret. Add it with: wrangler pages secret put OPENAI_API_KEY --project-name 08-prj-loreal-chatbot",
      },
      500,
    );
  }

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
