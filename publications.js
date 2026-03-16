/**
 * Publications module — list-style entries, abstract modal, optional DOI fetch
 *
 * DYNAMIC FETCH FROM DOI:
 * When you have a DOI (e.g. "10.1016/j.rse.2024.01.047"), you can fetch metadata from Crossref:
 *   const meta = await Publications.fetchFromDoi("10.1016/j.rse.2024.01.047");
 *   // meta contains: title, authors, year, journal, volume, pages, abstract, doi, url
 *
 * NOTE: Fetching from arbitrary paper URLs (e.g. sciencedirect.com/...) does NOT work from the
 * browser due to CORS. You need the DOI. Many URLs contain the DOI—extract it and use fetchFromDoi.
 */

window.Publications = {
  /**
   * Aggregate citations by year from papers array.
   * @param {Array} papers - Array of paper objects with year and citations
   * @returns {{ labels: string[], data: number[] }}
   */
  aggregateCitationsByYear(papers) {
    const byYear = {};
    for (const p of papers) {
      const y = parseInt(p.year, 10);
      if (isNaN(y)) continue;
      const cites = typeof p.citations === "number" ? p.citations : parseInt(p.citations, 10) || 0;
      byYear[y] = (byYear[y] || 0) + cites;
    }
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    return {
      labels: years.map(String),
      data: years.map((y) => byYear[y]),
    };
  },

  /**
   * Render a bar chart: x-axis = years, total citations per year. Y-axis hidden.
   * @param {HTMLElement} container - DOM element for the chart canvas
   * @param {Array} papers - Array of paper objects
   */
  renderCitationsChart(container, papers) {
    if (!container || !Array.isArray(papers)) return;
    const { labels, data } = this.aggregateCitationsByYear(papers);
    if (labels.length === 0) {
      container.innerHTML = '<p class="citations-chart__empty">No publication years available for this section.</p>';
      return;
    }
    if (typeof Chart === "undefined") {
      container.innerHTML = '<p class="citations-chart__empty">Chart library not loaded.</p>';
      return;
    }
    const fontFamily = "Cambria, 'Hoefler Text', Georgia, 'Times New Roman', Times, serif";
    if (Chart.defaults) Chart.defaults.font.family = fontFamily;
    container.innerHTML = '<canvas id="citationsChartCanvas" role="img" aria-label="Bar chart of citations by year"></canvas>';
    const ctx = container.querySelector("#citationsChartCanvas").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Total citations",
            data,
            backgroundColor: "rgba(44, 82, 130, 0.7)",
            borderColor: "rgb(44, 82, 130)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => `Total: ${ctx.raw} citations`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Year" },
            grid: { display: false },
          },
          y: {
            display: false,
          },
        },
      },
    });
  },

  /**
   * Render publication entries into a container
   * @param {HTMLElement} container - DOM element to render into
   * @param {Array} papers - Array of paper objects
   */
  render(container, papers, opts = {}) {
    if (!container || !Array.isArray(papers)) return;
    const sorted = [...papers].sort((a, b) => {
      const ya = parseInt(a.year, 10) || 0;
      const yb = parseInt(b.year, 10) || 0;
      return yb - ya; // descending: latest first
    });
    container.innerHTML = sorted.map((p) => this.buildEntry(p)).join("");
    this.bindAbstractButtons(container);
    if (!opts.skipFetch) this.fetchAbstractsForDois(container, papers);
  },

  /**
   * Fetch abstracts from Semantic Scholar for papers with DOI.
   * Replaces abstract with the one from the paper when available.
   * Uses staggered requests to avoid rate limiting.
   */
  async fetchAbstractsForDois(container, papers) {
    const withDoi = papers.filter((p) => {
      const doi = (p.doi || "").replace(/^https?:\/\/doi\.org\//i, "").trim();
      return !!doi;
    });
    if (withDoi.length === 0) return;
    let updated = false;
    for (let i = 0; i < withDoi.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 400));
      const p = withDoi[i];
      const doi = (p.doi || "").replace(/^https?:\/\/doi\.org\//i, "").trim();
      let meta = await this.fetchAbstractFromSemanticScholar(doi);
      const crossref = await this.fetchFromDoi(doi);
      if (crossref) {
        if (crossref.abstract && !meta?.abstract) meta = { ...meta, abstract: crossref.abstract };
        if (!p.authors || p.authors === "Authors to be added.") { p.authors = crossref.authors || p.authors; updated = true; }
        if (!p.journal || p.journal === "Journal to be added.") { p.journal = crossref.journal || p.journal; updated = true; }
        if (!p.volume) { p.volume = crossref.volume || p.volume; updated = true; }
        if (!p.pages) { p.pages = crossref.pages || p.pages; updated = true; }
        if (!p.year || p.year === "—") { p.year = String(crossref.year || p.year || ""); updated = true; }
        if (crossref.url && !p.url) { p.url = crossref.url; updated = true; }
      }
      if (meta?.abstract) {
        p.abstract = meta.abstract;
        updated = true;
      }
      if (typeof meta?.citationCount === "number" && (p.citations == null || p.citations === "")) {
        p.citations = meta.citationCount;
        updated = true;
      }
    }
    if (updated) this.render(container, papers, { skipFetch: true });
  },

  /**
   * Fetch abstract and citation count from Semantic Scholar API by DOI.
   * @param {string} doi - e.g. "10.1016/j.scitotenv.2023.163356"
   * @returns {Promise<{abstract?: string, citationCount?: number}>} Object with abstract and/or citationCount or null
   */
  async fetchAbstractFromSemanticScholar(doi) {
    if (!doi || typeof doi !== "string") return null;
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "").trim();
    if (!cleanDoi) return null;
    const encodedDoi = encodeURIComponent(cleanDoi);
    try {
      const res = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodedDoi}?fields=abstract,citationCount`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const result = {};
      if (data?.abstract) result.abstract = data.abstract;
      if (typeof data?.citationCount === "number") result.citationCount = data.citationCount;
      return Object.keys(result).length ? result : null;
    } catch (e) {
      console.warn("Semantic Scholar fetch failed for", cleanDoi, e);
      return null;
    }
  },

  buildEntry(p) {
    const title = p.title || "Untitled";
    const titleLink = p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${this.escapeHtml(title)}</a>` : this.escapeHtml(title);
    const year = p.year || "—";
    const authors = p.authors || "Authors to be added.";
    const journal = p.journal || "Journal to be added.";
    const volume = p.volume || "";
    const pages = p.pages || "";
    const citations = p.citations != null ? `${p.citations} citations` : "";
    const abstract = p.abstract || "Abstract to be added.";
    const abstractShort = abstract.length > 200 ? abstract.slice(0, 200) + "…" : abstract;
    const keywords = Array.isArray(p.keywords) ? p.keywords : (p.keywords ? p.keywords.split(",").map((k) => k.trim()) : ["Keywords to be added"]);
    const doi = p.doi || "";
    const pdfUrl = p.pdf || p.url || "#";
    const status = p.status || "Published";

    const metaParts = [];
    if (volume || pages) metaParts.push(`Vol. ${volume}${volume && pages ? " · " : ""}${pages ? `pp. ${pages}` : ""}`);
    if (citations) metaParts.push(citations);

    return `
      <div class="publication-entry" data-abstract="${this.escapeAttr(abstract)}" data-title="${this.escapeAttr(title)}">
        <div class="publication-entry__header">
          <span class="publication-entry__bullet"></span>
          <div class="publication-entry__title-wrap">
            <h3 class="publication-entry__title">${titleLink}</h3>
          </div>
          <span class="publication-entry__year">${year}</span>
        </div>
        <p class="publication-entry__authors">${this.escapeHtml(authors)}</p>
        <div class="publication-entry__meta">
          <span class="publication-entry__journal">${this.escapeHtml(journal)}</span>
          ${metaParts.length ? metaParts.join(" · ") : ""}
          <i class="fas fa-clock ms-1"></i>
          ${status === "Published" ? '<i class="fas fa-lock ms-1" title="Published"></i>' : ""}
        </div>
        <p class="publication-entry__abstract">${this.escapeHtml(abstractShort)}</p>
        <div class="publication-entry__keywords">
          ${keywords.map((k) => `<span class="publication-entry__keyword">${this.escapeHtml(k)}</span>`).join("")}
        </div>
        <div class="publication-entry__actions">
          <div class="publication-entry__actions-left">
            <a href="${pdfUrl}" target="_blank" rel="noopener" class="publication-entry__btn-pdf">PDF</a>
            ${doi ? `<a href="https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, "")}" target="_blank" rel="noopener" class="publication-entry__doi">DOI: ${doi.replace(/^https?:\/\/doi\.org\//i, "")}</a>` : '<span class="publication-entry__doi">DOI: to be added</span>'}
          </div>
          <button type="button" class="publication-entry__btn-abstract" data-action="abstract">
            Read abstract <i class="fas fa-chevron-down ms-1"></i>
          </button>
        </div>
      </div>`;
  },

  escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  },

  escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },

  bindAbstractButtons(container) {
    if (!container) return;
    container.querySelectorAll('[data-action="abstract"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = btn.closest(".publication-entry");
        const abstract = entry?.dataset.abstract || "";
        const title = entry?.dataset.title || "Abstract";
        this.openAbstractModal(title, abstract);
      });
    });
  },

  openAbstractModal(title, abstract) {
    let modalEl = document.getElementById("abstractModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.className = "modal fade modal-abstract";
      modalEl.id = "abstractModal";
      modalEl.setAttribute("tabindex", "-1");
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-title" id="abstractModalTitle"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body pt-2"></div>
          </div>
        </div>`;
      document.body.appendChild(modalEl);
    }
    modalEl.querySelector("#abstractModalTitle").textContent = title;
    modalEl.querySelector(".modal-body").textContent = abstract || "No abstract available.";
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },

  /**
   * Fetch metadata from Crossref API by DOI.
   * Use when you have a DOI. Does NOT work with arbitrary paper URLs.
   * @param {string} doi - e.g. "10.1016/j.rse.2024.01.047"
   * @returns {Promise<Object>} Paper metadata or null
   */
  async fetchFromDoi(doi) {
    if (!doi || typeof doi !== "string") return null;
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "").trim();
    if (!cleanDoi) return null;
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const work = data?.message;
      if (!work) return null;
      const authors = work.author?.map((a) => `${a.given || ""} ${a.family || ""}`.trim()).join(", ");
      let abstract = work.abstract?.replace(/<[^>]+>/g, "").replace(/^\s*Abstract\s*/i, "").trim() || "";
      return {
        title: work.title?.[0] || "",
        authors: authors || "",
        year: work.published?.["date-parts"]?.[0]?.[0] || work["published-online"]?.["date-parts"]?.[0]?.[0] || work.created?.["date-parts"]?.[0]?.[0] || "",
        journal: work["container-title"]?.[0] || "",
        volume: work.volume || "",
        pages: work.page || work["article-number"] || "",
        doi: cleanDoi,
        abstract,
        url: work.URL || `https://doi.org/${cleanDoi}`,
      };
    } catch (e) {
      console.warn("Crossref fetch failed:", e);
      return null;
    }
  },
};
