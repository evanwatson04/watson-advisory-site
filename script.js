(function () {
  // Update scroll progress bar
  const progress = document.getElementById("scroll-progress");
  function updateProgress() {
    if (!progress) return;
    const h = document.documentElement;
    const scrolled = h.scrollTop || document.body.scrollTop;
    const height = (h.scrollHeight || document.body.scrollHeight) - h.clientHeight;
    const pct = height > 0 ? (scrolled / height) * 100 : 0;
    progress.style.width = pct.toFixed(2) + "%";
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  // Quote form: prefill + set FormSubmit _next and subject
  const quoteForm = document.getElementById("quoteForm");
  if (quoteForm) {
    const params = new URLSearchParams(window.location.search);
    const service = (params.get("service") || "").trim();
    const pkg = (params.get("package") || "").trim();
    const starting = (params.get("starting") || "").trim();

    const serviceSelect = document.getElementById("serviceSelect");
    const packageInput = document.getElementById("packageInput");
    const messageInput = document.getElementById("messageInput");
    const subjectInput = document.getElementById("subjectInput");
    const nextInput = document.getElementById("nextInput");

    // Set redirect AFTER submit to our branded thank-you page
    if (nextInput) {
      nextInput.value = `${window.location.origin}/thanks.html`;
    }

    // Prefill service/package from pricing clicks
    if (service && serviceSelect) {
      const opt = Array.from(serviceSelect.options).find(o => o.value === service);
      if (opt) serviceSelect.value = service;
    }
    if (pkg && packageInput) packageInput.value = pkg;

    // Prefill message when package chosen
    if (pkg && messageInput) {
      const line = starting ? `Package: ${pkg} (starting at $${starting})` : `Package: ${pkg}`;
      messageInput.value = `${line}\n\nWhat I need help with:\n`;
      messageInput.focus();
      messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
    }

    // Show “request received” banner if using ?sent=1 (optional)
    const quoteSentNotice = document.getElementById("quoteSentNotice");
    if (quoteSentNotice && params.get("sent") === "1") {
      quoteSentNotice.hidden = false;
    }

    // Build strong subject line at submit time
    quoteForm.addEventListener("submit", () => {
      if (!subjectInput) return;

      const serviceLabel = serviceSelect
        ? (serviceSelect.options[serviceSelect.selectedIndex]?.text || "Service")
        : "Service";

      const pkgVal = (packageInput?.value || "").trim();
      subjectInput.value = pkgVal
        ? `Quote request: ${serviceLabel} — ${pkgVal}`
        : `Quote request: ${serviceLabel}`;
    }, { passive: true });
  }

  // Google reviews (hidden unless configured)
  async function loadFeaturedGoogleReviews() {
    const section = document.querySelector("[data-google-reviews]");
    if (!section) return;

    try {
      const res = await fetch("/api/reviews/featured", { headers: { "Accept": "application/json" } });
      if (!res.ok) return;

      const data = await res.json().catch(() => null);
      if (!data || data.ok !== true) return;

      // Must have at least rating/count or a link to show section
      const hasNumbers = (typeof data.rating === "number") || (typeof data.userRatingsTotal === "number");
      const hasLinks = !!data.googleProfileUrl || !!data.googleReviewUrl;
      const reviews = Array.isArray(data.reviews) ? data.reviews : [];

      if (!hasNumbers && !hasLinks && reviews.length === 0) return;

      section.hidden = false;

      const line = document.getElementById("googleRatingLine");
      if (line && hasNumbers) {
        const r = (data.rating != null) ? data.rating.toFixed(1) : "";
        const c = (data.userRatingsTotal != null) ? data.userRatingsTotal : "";
        line.textContent = (r && c) ? `Rated ${r} on Google (${c} reviews)` : "";
      }

      const profileBtn = document.querySelector("[data-google-profile]");
      if (profileBtn && data.googleProfileUrl) {
        profileBtn.href = data.googleProfileUrl;
        profileBtn.hidden = false;
      }

      const reviewBtn = document.querySelector("[data-google-review]");
      if (reviewBtn && data.googleReviewUrl) {
        reviewBtn.href = data.googleReviewUrl;
        reviewBtn.hidden = false;
      }

      const grid = document.getElementById("featuredReviews");
      if (grid) {
        grid.innerHTML = "";
        for (const r of reviews.slice(0, 3)) {
          const author = r.author_name || "Client";
          const stars = "★★★★★".slice(0, r.rating || 5) + "☆☆☆☆☆".slice(0, 5 - (r.rating || 5));
          const when = r.relative_time_description || "";
          const text = r.text || "";

          const card = document.createElement("div");
          card.className = "review-card";
          card.innerHTML = `
            <div class="review-top">
              <div class="review-author">${escapeHtml(author)}</div>
              <div class="review-stars" aria-label="${r.rating} out of 5 stars">${stars}</div>
            </div>
            <div class="review-meta">${escapeHtml(when)}</div>
            <div class="review-text">${escapeHtml(text)}</div>
          `;
          grid.appendChild(card);
        }
      }

    } catch {
      // fail silently; keep section hidden
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
    }[c]));
  }

  loadFeaturedGoogleReviews();
})();
