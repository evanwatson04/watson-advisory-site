function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[c]));
}

function stars(n) {
  const x = Math.max(1, Math.min(5, Number(n) || 0));
  return "★★★★★".slice(0, x) + "☆☆☆☆☆".slice(0, 5 - x);
}

/* Quote form: submits via fetch to FormSubmit AJAX endpoint */
async function initQuoteForms() {
  const forms = qsa('form[data-form="quote"]');
  for (const form of forms) {
    const status = qs(".form-status", form) || null;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (status) status.textContent = "Sending…";

      // Basic anti-spam: honeypot
      const honey = form.querySelector('input[name="_honey"]');
      if (honey && honey.value) {
        if (status) status.textContent = "Sent.";
        return;
      }

      const endpoint = form.getAttribute("data-endpoint");
      if (!endpoint) {
        if (status) status.textContent = "Form endpoint not configured.";
        return;
      }

      const fd = new FormData(form);

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Accept": "application/json" },
          body: fd
        });

        if (!res.ok) throw new Error("Bad response");

        form.reset();
        if (status) status.textContent = "Sent. Evan will reach out soon.";
      } catch {
        if (status) status.textContent = "Couldn’t send right now. Please call/text (205) 706-4910.";
      }
    });
  }
}

/* Reviews: loads from /api/reviews and renders */
async function loadReviews() {
  const blocks = qsa("[data-reviews]");
  for (const block of blocks) {
    const service = block.getAttribute("data-service") || "all";
    const url = service === "all"
      ? "/api/reviews"
      : `/api/reviews?service=${encodeURIComponent(service)}`;

    try {
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error("Bad response");
      const data = await res.json();

      const reviews = Array.isArray(data.reviews) ? data.reviews : [];
      if (!reviews.length) {
        block.innerHTML = `<p class="muted">No reviews yet. Be the first to leave one.</p>`;
        continue;
      }

      block.innerHTML = reviews.map((r) => {
        const name = escapeHtml(r.name || "Client");
        const msg = escapeHtml(r.message || "");
        const rating = Number(r.rating || 5);
        const svc = escapeHtml(r.service || "");
        const when = escapeHtml(r.created_at || "");
        return `
          <article class="review">
            <div class="review-top">
              <div>
                <span class="review-name">${name}</span>
                <span class="review-meta"> • ${svc}</span>
              </div>
              <div class="review-stars" aria-label="${rating} out of 5 stars">${stars(rating)}</div>
            </div>
            <div class="review-meta">${when}</div>
            <p class="review-msg">${msg}</p>
          </article>
        `;
      }).join("");

    } catch {
      // Fail gracefully: hide the section if API isn't configured yet.
      block.innerHTML = `<p class="muted">Reviews are not available right now.</p>`;
    }
  }
}

/* Review submission: POST to /api/reviews */
async function initReviewForms() {
  const forms = qsa('form[data-form="review"]');
  for (const form of forms) {
    const status = qs(".form-status", form) || null;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (status) status.textContent = "Submitting…";

      // Honeypot
      const hp = form.querySelector('input[name="company"]');
      if (hp && hp.value) {
        if (status) status.textContent = "Submitted.";
        return;
      }

      const payload = {
        name: (form.name?.value || "").trim(),
        service: form.service?.value || "",
        rating: Number(form.rating?.value || 5),
        message: (form.message?.value || "").trim(),
        turnstileToken: (form.querySelector('textarea[name="cf-turnstile-response"]')?.value || "").trim()
      };

      try {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept":"application/json" },
          body: JSON.stringify(payload)
        });

        const out = await res.json().catch(() => ({}));
        if (!res.ok || out.ok !== true) throw new Error("Submit failed");

        form.reset();
        if (status) status.textContent = "Thanks—your review is now live.";
        await loadReviews();
      } catch (err) {
        if (status) status.textContent = "Couldn’t submit right now. Please try again later.";
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await initQuoteForms();
  await initReviewForms();
  await loadReviews();
});
