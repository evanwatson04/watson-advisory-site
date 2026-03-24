export async function onRequest(context) {
  const { request, env } = context;

  // You must bind a D1 database in Cloudflare Pages Settings > Bindings
  // Name it DB.
  const DB = env.DB;

  if (!DB) {
    return new Response(JSON.stringify({ ok: false, error: "D1 not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(request.url);

  if (request.method === "GET") {
    const service = url.searchParams.get("service");
    let stmt;

    if (service && service !== "all") {
      stmt = DB.prepare(
        "SELECT id, created_at, name, rating, service, message FROM reviews WHERE service = ? ORDER BY created_at DESC LIMIT 10"
      ).bind(service);
    } else {
      stmt = DB.prepare(
        "SELECT id, created_at, name, rating, service, message FROM reviews ORDER BY created_at DESC LIMIT 10"
      );
    }

    const { results } = await stmt.all();

    return new Response(JSON.stringify({ ok: true, reviews: results || [] }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Basic validation
    const name = String(body.name || "").trim().slice(0, 60);
    const message = String(body.message || "").trim().slice(0, 800);
    const service = String(body.service || "").trim().slice(0, 80);
    const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));

    if (!name || !message || !service) {
      return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Optional Turnstile verification:
    // Set TURNSTILE_SECRET in Pages project environment variables.
    if (env.TURNSTILE_SECRET) {
      const token = String(body.turnstileToken || "").trim();
      if (!token) {
        return new Response(JSON.stringify({ ok: false, error: "Verification required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const formData = new FormData();
      formData.append("secret", env.TURNSTILE_SECRET);
      formData.append("response", token);

      const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: formData
      }).then(r => r.json()).catch(() => null);

      if (!verify || verify.success !== true) {
        return new Response(JSON.stringify({ ok: false, error: "Verification failed" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString().slice(0, 10);

    await DB.prepare(
      "INSERT INTO reviews (id, created_at, name, rating, service, message) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, createdAt, name, rating, service, message).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
