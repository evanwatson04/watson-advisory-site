export async function onRequest(context) {
  const { request, env } = context;

  const apiKey = env.GOOGLE_PLACES_API_KEY;
  const placeId = env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) return new Response("Not configured", { status: 204 });

  const password = request.headers.get("X-Admin-Password") || "";
  if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=reviews&reviews_sort=newest&key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url);
  const data = await resp.json().catch(() => null);

  if (!data || data.status !== "OK" || !data.result) {
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { "Content-Type":"application/json" }});
  }

  const baseReviews = Array.isArray(data.result.reviews) ? data.result.reviews : [];
  const reviewsWithHash = await Promise.all(baseReviews.map(async (r) => {
    const author = r.author_name || "";
    const text = r.text || "";
    const rating = Number(r.rating || 0);
    const when = r.relative_time_description || "";
    const key = `${author}|${rating}|${when}|${text}`;
    const hash = await sha256hex(key);

    return { hash, author_name: author, rating, relative_time_description: when, text };
  }));

  return new Response(JSON.stringify({ ok: true, reviews: reviewsWithHash }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function sha256hex(input) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}
