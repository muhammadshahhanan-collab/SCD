/* News & Events module
   - Past events: list-style cards with a details modal (papers-like UX)
   - Upcoming events: bottom bulletin ticker (single-line slideshow)
*/

const NewsEvents = (() => {
  const DEFAULT_DATA = {
    pastEvents: [],
    upcomingEvents: [],
  };

  // Bulletin ticker engine state
  const tickerEngine = {
    rafId: null,
    running: false,
    lastTs: 0,
    offsetPx: 0,
    speedPxPerSec: 90,
    setWidthPx: 0,
    boundaries: [], // cumulative widths for one set (length = nItems + 1)
    visibleIndex: 0,
    lastVisibleEvent: null,
    entries: [],
    isBound: false,
  };

  let lastClickedEvent = null;
  let upcomingEventByKey = new Map();
  let lastTickerInput = null;

  function parseDateOnlyMs(dateStr) {
    // Expected: YYYY-MM-DD (no time zone). Create local midnight to avoid UTC shifts.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      return new Date(y, mo, d).getTime();
    }
    const d = new Date(dateStr || "");
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  function getEventDateStr(ev) {
    return ev?.date || ev?.startDate || "";
  }

  function getEventDateMs(ev) {
    return parseDateOnlyMs(getEventDateStr(ev));
  }

  function isEventPassed(ev, nowMs) {
    const evMs = getEventDateMs(ev);
    if (evMs == null) return false;
    const today = new Date(nowMs);
    const todayMs = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    return evMs <= todayMs;
  }

  function escapeHtml(s) {
    const str = s == null ? "" : String(s);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/`/g, "&#096;");
  }

  function formatDateHuman(isoDate) {
    if (!isoDate) return "";
    // Keep it deterministic even if locale differs: use a small set of formats.
    const ms = parseDateOnlyMs(isoDate);
    if (ms != null) {
      return new Date(ms).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    }

    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  function openDetailsModal(event) {
    const title = event?.title || "Event Details";
    const modalId = "newsEventsDetailsModal";

    let modalEl = document.getElementById(modalId);
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.className = "modal fade modal-abstract modal-news-events";
      modalEl.id = modalId;
      modalEl.setAttribute("tabindex", "-1");
      modalEl.setAttribute("aria-hidden", "true");
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-title"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body pt-2"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    const modalTitleEl = modalEl.querySelector(".modal-title");
    const bodyEl = modalEl.querySelector(".modal-body");
    modalTitleEl.textContent = title;

    const lines = [];
    const summary = event?.summary || "";
    const details = event?.details || "";

    if (summary) {
      lines.push(`<p>${escapeHtml(summary)}</p>`);
    }

    if (event?.time) {
      lines.push(
        `<p class="mb-2"><i class="fas fa-clock me-2 text-primary" aria-hidden="true"></i><strong>${escapeHtml(
          event.time
        )}</strong></p>`,
      );
    }
    if (event?.location) {
      lines.push(
        `<p class="mb-2"><i class="fas fa-location-dot me-2 text-primary" aria-hidden="true"></i>${escapeHtml(
          event.location
        )}</p>`,
      );
    }
    if (event?.organizer) {
      lines.push(
        `<p class="mb-2"><i class="fas fa-user me-2 text-primary" aria-hidden="true"></i>${escapeHtml(
          event.organizer
        )}</p>`,
      );
    }

    if (details) {
      // Convert newlines to paragraph breaks.
      const paragraphs = String(details)
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("");
      lines.push(paragraphs);
    }

    if (Array.isArray(event?.highlights) && event.highlights.length) {
      const items = event.highlights
        .map((h) => `<li>${escapeHtml(h)}</li>`)
        .join("");
      lines.push(`<ul class="mb-0">${items}</ul>`);
    }

    if (Array.isArray(event?.tags) && event.tags.length) {
      const tags = event.tags
        .map((t) => `<span class="publication-entry__keyword">${escapeHtml(t)}</span>`)
        .join("");
      lines.push(`<div class="d-flex flex-wrap gap-2 mt-3">${tags}</div>`);
    }

    bodyEl.innerHTML = lines.join("");

    // Bootstrap modal open
    if (window.bootstrap?.Modal) {
      const modal = new window.bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  function eventTypeColor(eventType) {
    // Used for the bullet dot color only.
    const t = (eventType || "").toLowerCase();
    if (t.includes("workshop")) return "#38a169";
    if (t.includes("webinar")) return "#4299e1";
    if (t.includes("seminar")) return "#2c5282";
    if (t.includes("training")) return "#ed8936";
    if (t.includes("roundtable")) return "#48bb78";
    if (t.includes("poster")) return "#ed8936";
    if (t.includes("open")) return "#2c5282";
    return "#38a169";
  }

  function renderPastEvents(pastEvents) {
    const container = document.getElementById("past-events");
    if (!container) return;

    if (!Array.isArray(pastEvents) || pastEvents.length === 0) {
      container.innerHTML = `<p class="text-muted mb-0">No past events available.</p>`;
      return;
    }

    // Latest first.
    const sorted = [...pastEvents].sort((a, b) => {
      const ya = getEventDateMs(a) || 0;
      const yb = getEventDateMs(b) || 0;
      return (yb || 0) - (ya || 0);
    });

    container.innerHTML = sorted
      .map((ev) => {
        const dateHuman = formatDateHuman(getEventDateStr(ev));
        const bulletColor = eventTypeColor(ev.type);
        const tagsHtml = Array.isArray(ev.tags)
          ? ev.tags.map((t) => `<span class="publication-entry__keyword">${escapeHtml(t)}</span>`).join("")
          : "";

        return `
          <article class="publication-entry news-event-entry" data-event-id="${escapeAttr(
            ev.id || ""
          )}">
            <div class="publication-entry__header">
              <span class="publication-entry__bullet" style="background:${bulletColor}"></span>
              <div class="publication-entry__title-wrap">
                <h3 class="publication-entry__title">${escapeHtml(ev.title || "Event")}</h3>
              </div>
              <span class="publication-entry__year">${escapeHtml(
                dateHuman || getEventDateStr(ev) || "—",
              )}</span>
            </div>

            ${ev.location ? `<p class="publication-entry__authors mb-1"><i class="fas fa-location-dot me-2 text-primary" aria-hidden="true"></i>${escapeHtml(ev.location)}</p>` : ""}

            <div class="publication-entry__meta">
              ${ev.organizer ? `<span class="publication-entry__journal"><i class="fas fa-user me-1" aria-hidden="true"></i>${escapeHtml(ev.organizer)}</span>` : ""}
              ${ev.type ? `<span><i class="fas fa-tag me-1" aria-hidden="true"></i>${escapeHtml(ev.type)}</span>` : ""}
              ${ev.time ? `<span><i class="fas fa-clock me-1" aria-hidden="true"></i>${escapeHtml(ev.time)}</span>` : ""}
            </div>

            <p class="publication-entry__abstract">${escapeHtml(ev.summary || "")}</p>

            ${tagsHtml ? `<div class="publication-entry__keywords">${tagsHtml}</div>` : ""}

            <div class="publication-entry__actions">
              <div class="publication-entry__actions-left">
                <button
                  type="button"
                  class="publication-entry__btn-abstract"
                  data-action="event-details"
                  data-title="${escapeAttr(ev.title || "Event")}"
                  data-event='${escapeAttr(JSON.stringify(ev))}'
                >
                  View details <i class="fas fa-chevron-down ms-1" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    // Delegate: read event from data-event JSON.
    container.querySelectorAll('[data-action="event-details"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-event") || "";
        try {
          const parsed = JSON.parse(raw);
          openDetailsModal(parsed);
        } catch {
          openDetailsModal({
            title: btn.getAttribute("data-title") || "Event Details",
          });
        }
      });
    });
  }

  function renderTicker(upcomingEvents) {
    const marqueeEl = document.getElementById("newsBulletinMarquee");
    const trackEl = document.getElementById("newsBulletinTrack");
    const detailsBtn = document.getElementById("newsBulletinDetailsBtn");
    if (!marqueeEl || !trackEl || !detailsBtn) return;

    lastTickerInput = upcomingEvents;

    // Pause / resume handlers (bind once)
    if (!tickerEngine.isBound) {
      tickerEngine.isBound = true;

      const pause = () => {
        if (!tickerEngine.running) return;
        tickerEngine.running = false;
        if (tickerEngine.rafId) window.cancelAnimationFrame(tickerEngine.rafId);
        tickerEngine.rafId = null;
      };

      const resume = () => {
        if (tickerEngine.running) return;
        if (!tickerEngine.setWidthPx) return;
        tickerEngine.running = true;
        tickerEngine.lastTs = performance.now();
        tickerEngine.rafId = window.requestAnimationFrame(step);
      };

      marqueeEl.addEventListener("mouseenter", pause, { passive: true });
      marqueeEl.addEventListener("mouseleave", resume, { passive: true });
      marqueeEl.addEventListener("focus", pause, { passive: true });
      marqueeEl.addEventListener("blur", resume, { passive: true });

      let resizeTimer = null;
      window.addEventListener("resize", () => {
        if (!lastTickerInput) return;
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          // Re-render to recalculate set width; keeps animation seamless via offset ratio.
          renderTicker(lastTickerInput);
        }, 180);
      });

      // Click to open details for the clicked item
      trackEl.addEventListener("click", (e) => {
        const item = e.target.closest(".news-bulletin__item");
        if (!item) return;
        const key = item.getAttribute("data-event-key") || "";
        const ev = upcomingEventByKey.get(key) || null;
        if (!ev) return;
        lastClickedEvent = ev;
        openDetailsModal(ev);
      });

      // Details button always opens the last clicked item (or first item)
      detailsBtn.addEventListener("click", () => {
        const ev =
          tickerEngine.lastVisibleEvent ||
          lastClickedEvent ||
          Array.from(upcomingEventByKey.values())[0] ||
          null;
        if (!ev) return;
        openDetailsModal(ev);
      });
    }

    const pauseNow = () => {
      tickerEngine.running = false;
      if (tickerEngine.rafId) window.cancelAnimationFrame(tickerEngine.rafId);
      tickerEngine.rafId = null;
    };

    pauseNow();
    trackEl.style.opacity = "0";

    // Support either events array OR array of strings
    const input = Array.isArray(upcomingEvents) ? upcomingEvents : [];
    if (input.length === 0) {
      trackEl.innerHTML = "";
      detailsBtn.disabled = true;
      tickerEngine.setWidthPx = 0;
      tickerEngine.offsetPx = 0;
      return;
    }

    // Latest requirements: keep dynamic update with smooth transition.
    const oldSetWidth = tickerEngine.setWidthPx || 0;
    const oldModuloRatio = oldSetWidth ? (tickerEngine.offsetPx % oldSetWidth) / oldSetWidth : 0;

    const eventKeyFor = (ev, idx) => {
      if (ev && typeof ev === "object") {
        const id = ev.id;
        if (id) return String(id);
        const d = ev?.startDate || ev?.date || "";
        const t = ev?.time || "";
        const title = ev?.title || "";
        return `${title}|${d}|${t}`;
      }
      return `string-${idx}`;
    };

    const getTextFor = (ev) => {
      if (typeof ev === "string") return ev;
      const type = ev?.type ? `${ev.type}: ` : "";
      const title = ev?.title || "Event";
      return `${type}${title}`;
    };

    const normalizeEvent = (ev, idx) => {
      if (typeof ev === "string") {
        return {
          key: eventKeyFor(ev, idx),
          text: ev,
          event: {
            title: ev,
            summary: ev,
            type: "Bulletin",
            date: "",
            time: "",
            location: "",
            organizer: "",
          },
        };
      }
      return {
        key: eventKeyFor(ev, idx),
        text: getTextFor(ev),
        event: ev,
      };
    };

    // Sort for objects; keep strings as-is.
    let sortedInput = input;
    if (typeof input[0] === "object") {
      sortedInput = [...input].sort((a, b) => {
        const ta = getEventDateMs(a) || 0;
        const tb = getEventDateMs(b) || 0;
        return (ta || 0) - (tb || 0);
      });
    }

    const entries = sortedInput.map((ev, idx) => normalizeEvent(ev, idx));
    tickerEngine.entries = entries;
    upcomingEventByKey = new Map(
      entries
        .filter((e) => e.event)
        .map((e) => [String(e.key), e.event]),
    );

    detailsBtn.disabled = upcomingEventByKey.size === 0;

    // Build two identical sets for seamless infinite scroll.
    const buildSet = () => {
      const setEl = document.createElement("div");
      setEl.className = "news-bulletin__set";
      entries.forEach((en) => {
        const span = document.createElement("span");
        span.className = "news-bulletin__item";
        span.setAttribute("data-event-key", String(en.key));
        span.textContent = en.text;
        setEl.appendChild(span);
      });
      return setEl;
    };

    trackEl.innerHTML = "";
    const set1 = buildSet();
    const set2 = buildSet();
    trackEl.appendChild(set1);
    trackEl.appendChild(set2);

    // Measure set width and resume with preserved offset ratio.
    window.requestAnimationFrame(() => {
      const rect = set1.getBoundingClientRect();
      const newSetWidth = rect.width;
      if (!newSetWidth) return;

      tickerEngine.setWidthPx = newSetWidth;
      tickerEngine.offsetPx = oldModuloRatio * newSetWidth;

      // Precompute boundaries (start offsets) so we can know which item is visible.
      // Important: use `offsetLeft` to include the flex `gap` spacing.
      const spans = Array.from(set1.querySelectorAll(".news-bulletin__item"));
      const boundaries = spans.map((s) => s.offsetLeft || 0);
      boundaries.push(set1.offsetWidth || newSetWidth);
      tickerEngine.boundaries = boundaries;
      tickerEngine.visibleIndex = 0;

      // Update lastVisibleEvent from current offset
      const offset = tickerEngine.offsetPx;
      let lo = 0;
      let hi = boundaries.length - 1; // number of items
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (boundaries[mid] <= offset) lo = mid + 1;
        else hi = mid;
      }
      const idx = Math.max(0, lo - 1);
      tickerEngine.visibleIndex = idx;
      tickerEngine.lastVisibleEvent =
        entries[idx]?.event ||
        (typeof entries[idx]?.text === "string"
          ? {
              title: entries[idx].text,
              summary: entries[idx].text,
              type: "Bulletin",
              date: "",
              time: "",
              location: "",
              organizer: "",
            }
          : null);

      trackEl.style.transform = `translateX(${-tickerEngine.offsetPx}px)`;
      trackEl.style.opacity = "1";

      tickerEngine.running = true;
      tickerEngine.lastTs = performance.now();
      tickerEngine.rafId = window.requestAnimationFrame(step);
    });
  }

  function step(ts) {
    if (!tickerEngine.running) return;
    const dt = (ts - tickerEngine.lastTs) / 1000;
    tickerEngine.lastTs = ts;

    if (!tickerEngine.setWidthPx) return;
    tickerEngine.offsetPx = (tickerEngine.offsetPx + tickerEngine.speedPxPerSec * dt) % tickerEngine.setWidthPx;
    const x = -tickerEngine.offsetPx;
    const trackEl = document.getElementById("newsBulletinTrack");
    if (trackEl) trackEl.style.transform = `translateX(${x}px)`;

    // Update currently visible item (approximate) so Details matches what users see.
    const boundaries = tickerEngine.boundaries;
    if (Array.isArray(boundaries) && boundaries.length >= 2) {
      const offset = tickerEngine.offsetPx;
      const nItems = boundaries.length - 1;
      let lo = 0;
      let hi = nItems;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (boundaries[mid] <= offset) lo = mid + 1;
        else hi = mid;
      }
      const idx = Math.max(0, lo - 1);
      if (idx !== tickerEngine.visibleIndex) {
        tickerEngine.visibleIndex = idx;
        tickerEngine.lastVisibleEvent = tickerEngine.entries[idx]?.event || null;
      }
    }

    tickerEngine.rafId = window.requestAnimationFrame(step);
  }

  async function loadData() {
    try {
      const res = await fetch("news-events-data.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data) return DEFAULT_DATA;
      return data;
    } catch {
      return DEFAULT_DATA;
    }
  }

  function init() {
    const pastContainer = document.getElementById("past-events");
    if (!pastContainer) return;

    let loadedData = null;
    let lastUpcomingKeys = new Set();

    const getUpcomingKeys = (arr) => {
      if (!Array.isArray(arr)) return new Set();
      return new Set(
        arr.map((ev) => {
          const key =
            ev?.id ||
            `${ev?.title || ""}|${ev?.startDate || ""}|${ev?.time || ""}`;
          return String(key);
        }),
      );
    };

    const partitionByDate = (data, nowMs) => {
      const basePast = Array.isArray(data?.pastEvents) ? data.pastEvents : [];
      const baseUpcoming = Array.isArray(data?.upcomingEvents)
        ? data.upcomingEvents
        : [];

      const passedFromUpcoming = baseUpcoming.filter((ev) =>
        isEventPassed(ev, nowMs),
      );
      const upcoming = baseUpcoming.filter((ev) => !isEventPassed(ev, nowMs));

      // Merge and de-dupe (by id if present).
      const map = new Map();
      basePast.forEach((ev) => {
        const key =
          ev?.id ||
          `${ev?.title || ""}|${ev?.date || ev?.startDate || ""}|${ev?.time || ""}`;
        map.set(String(key), ev);
      });

      passedFromUpcoming.forEach((ev) => {
        const key =
          ev?.id ||
          `${ev?.title || ""}|${ev?.date || ev?.startDate || ""}|${ev?.time || ""}`;
        // Don't overwrite an existing basePast entry (keeps richer details).
        if (!map.has(String(key))) map.set(String(key), ev);
      });

      return {
        past: Array.from(map.values()),
        upcoming,
      };
    };

    const applyAndRender = (nowMs) => {
      if (!loadedData) return;
      const { past, upcoming } = partitionByDate(loadedData, nowMs);

      const upcomingKeys = getUpcomingKeys(upcoming);
      const changed =
        upcomingKeys.size !== lastUpcomingKeys.size ||
        [...upcomingKeys].some((k) => !lastUpcomingKeys.has(k));

      if (!changed) return;

      renderPastEvents(past);
      renderTicker(upcoming);

      lastUpcomingKeys = upcomingKeys;
    };

    loadData().then((data) => {
      loadedData = data || DEFAULT_DATA;
      const nowMs = Date.now();
      applyAndRender(nowMs);

      // Poll occasionally so the UI updates without refresh.
      window.setInterval(() => {
        applyAndRender(Date.now());
      }, 60 * 1000);
    });
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => {
  NewsEvents.init();
});

