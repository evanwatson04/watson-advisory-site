export async function onRequest(context) {
  const { env } = context;

  // Required env vars:
  // GOOGLE_PLACES_API_KEY
  // GOOGLE_PLACE_ID
  // Optional:
  // GOOGLE_PROFILE_URL  (link to your Google profile / reviews listing)
  // GOOGLE_REVIEW_URL   (direct "leave a review" link)
  // DB (D1 binding) - required for moderation / approved list

  const apiKey = env.GOOGLE_PLACES_API_KEY;
  const placeId = env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 204,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Fetch up to 5 reviews (Google Places limit)
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total,reviews&reviews_sort=newest&key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url);
  const data = await resp.json().catch(() => null);

  if (!data || data.status !== "OK" || !data.result) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  const baseReviews = Array.isArray(data.result.reviews) ? data.result.reviews : [];
  const reviewsWithHash = await Promise.all(baseReviews.map(async (r) => {
    const author = r.author_name || "";
    const text = r.text || "";
    const rating = Number(r.rating || 0);
    const when = r.relative_time_description || "";
    const key = `${author}|${rating}|${when}|${text}`;
    const hash = await sha256hex(key);
    return {
      hash,
      author_name: author,
      rating,
      relative_time_description: when,
      text
    };
  }));

  const rating = (typeof data.result.rating === "number") ? data.result.rating : null;
  const userRatingsTotal = (typeof data.result.user_ratings_total === "number") ? data.result.user_ratings_total : null;

  // If no DB binding, return numbers but no featured reviews (moderation requirement).
  if (!env.DB) {
    return new Response(JSON.stringify({
      ok: true,
      rating,
      userRatingsTotal,
      reviews: [],
      googleProfileUrl: env.GOOGLE_PROFILE_URL || null,
      googleReviewUrl: env.GOOGLE_REVIEW_URL || null
    }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  // Only return approved/featured review hashes
  const rows = await env.DB.prepare("SELECT hash FROM featured_google_reviews").all();
  const approved = new Set((rows.results || []).map(r => r.hash));

  const featured = reviewsWithHash.filter(r => approved.has(r.hash));

  return new Response(JSON.stringify({
    ok: true,
    rating,
    userRatingsTotal,
    reviews: featured.slice(0, 3),
    googleProfileUrl: env.GOOGLE_PROFILE_URL || null,
    googleReviewUrl: env.GOOGLE_REVIEW_URL || null
  }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function sha256hex(input) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}
