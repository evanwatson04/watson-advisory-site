export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!env.DB) return new Response("DB not configured", { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body) return new Response("Bad Request", { status: 400 });

  const password = String(body.password || "");
  const hash = String(body.hash || "");

  if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  // Optional Turnstile check (recommended)
  if (env.TURNSTILE_SECRET) {
    const token = String(body.turnstileToken || "");
    if (!token) return json({ ok: false, error: "Verification required" }, 400);

    const ok = await verifyTurnstile(token, env.TURNSTILE_SECRET);
    if (!ok) return json({ ok: false, error: "Verification failed" }, 403);
  }

  await env.DB.prepare(
    "INSERT OR IGNORE INTO featured_google_reviews (hash, added_at) VALUES (?, datetime('now'))"
  ).bind(hash).run();

  return json({ ok: true }, 200);
}

async function verifyTurnstile(token, secret) {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });

  const data = await resp.json().catch(() => null);
  return !!(data && data.success === true);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
