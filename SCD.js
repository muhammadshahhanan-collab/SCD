// ✅ Smooth scrolling for navigation links (only for in-page anchors like #about)
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href && href.startsWith("#") && href.length > 1) {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    // Close mobile menu when link is clicked
    const collapseEl = document.getElementById("navbarNav");
    if (collapseEl && typeof bootstrap !== "undefined" && bootstrap.Collapse) {
      const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
      bsCollapse.hide();
    }
  });
});

// ✅ Reset scroll to top when page loads
window.onload = function () {
  if (!window.location.hash) {
    window.scrollTo(0, 0);
  }
};

// ✅ Floating pill navbar — scroll effect (transparent → pill with blur)
(function () {
  const pill = document.getElementById("siteHeaderPill");
  const navbar = document.querySelector(".navbar");
  const SCROLL_THRESHOLD = 20;

  function handleScroll() {
    const scrolled = window.scrollY > SCROLL_THRESHOLD;
    if (pill) {
      pill.classList.toggle("site-header__pill--scrolled", scrolled);
    }
    // Legacy: Bootstrap navbar (other pages)
    if (navbar) {
      if (scrolled) {
        navbar.style.background =
          "linear-gradient(135deg, rgba(44, 82, 130, 0.95), rgba(56, 161, 105, 0.95))";
        navbar.style.backdropFilter = "blur(10px)";
      } else {
        navbar.style.backdropFilter = "none";
      }
    }
  }

  handleScroll();
  window.addEventListener("scroll", handleScroll, { passive: true });
})();

// ✅ Footer loader — loads footer.html into the page and updates the year
fetch("footer.html")
  .then((r) => r.text())
  .then((data) => {
    document.getElementById("footer").innerHTML = data;
    const yearSpan = document.getElementById("currentYear");
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  })
  .catch(() => {});

// ══════════════════════════════════════════════════════════════
//  NAV PILL — highlight active section link (per-pill style)
//  Works with both floating navbar (.site-header) and legacy .navbar
// ══════════════════════════════════════════════════════════════
(function () {
  const navContainer = document.querySelector(".site-header") || document.getElementById("mainNav");
  if (!navContainer) return;

  const links = Array.from(
    navContainer.querySelectorAll(".nav-pill-link[data-section]"),
  );

  // Set which link gets the active (green filled) pill
  function setActive(sectionId) {
    links.forEach((l) => {
      l.classList.toggle("nav-active", l.dataset.section === sectionId);
    });
  }

  
  // IntersectionObserver — tracks the most-visible section
  const ratioMap = new Map();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => ratioMap.set(e.target.id, e.intersectionRatio));

      let bestId = null,
        bestRatio = -1;
      ratioMap.forEach((ratio, id) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      });

      if (bestId) setActive(bestId);
    },
    {
      threshold: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0],
      rootMargin: "-80px 0px -25% 0px",
    },
  );

  links.forEach((l) => {
    const sec = document.getElementById(l.dataset.section);
    if (sec) observer.observe(sec);
  });

  // Default: activate first link on load
  requestAnimationFrame(() => {
    setTimeout(() => {
      if (links[0]) setActive(links[0].dataset.section);
    }, 100);
  });
})();

// ─────────────────────────────────────────────────────────────
// Inject "News & Events" into the pill navbar on all pages
// (works for both desktop and mobile nav lists)
// ─────────────────────────────────────────────────────────────
(function () {
  const href = "News_Events.html";
  const labelText = "News & Events";
  const currentPath = (window.location.pathname || "").toLowerCase();
  const isNewsPage =
    currentPath.endsWith("/news_events.html") || currentPath.endsWith("news_events.html");

  function hideMobileMenuOnClick() {
    const collapseEl = document.getElementById("navbarNav");
    if (collapseEl && typeof bootstrap !== "undefined" && bootstrap.Collapse) {
      const bsCollapse =
        bootstrap.Collapse.getInstance(collapseEl) ||
        new bootstrap.Collapse(collapseEl, { toggle: false });
      bsCollapse.hide();
    }
  }

  function ensureLinkInUl(ul) {
    if (!ul) return;
    if (ul.querySelector(`a.nav-pill-link[href="${href}"]`)) return;

    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "nav-pill-link";
    a.href = href;
    a.textContent = labelText;
    a.addEventListener("click", hideMobileMenuOnClick);

    li.appendChild(a);
    ul.appendChild(li);
  }

  // Avoid duplicates: patch only the desktop UL when available.
  // (Mobile UL is injected only on smaller screens.)
  const desktopUl = document.getElementById("mainNav");
  const mobileUl = document.querySelector("ul.nav-pill.nav-pill--mobile");
  const isDesktop = window.innerWidth >= 992;

  // Hard cleanup first: remove any existing injected links everywhere.
  // (Fixes cases where deployed HTML / cached JS already produced duplicates.)
  document
    .querySelectorAll(`a.nav-pill-link[href="${href}"]`)
    .forEach((link) => {
      const li = link.closest("li");
      if (li) li.remove();
      else link.remove();
    });

  if (isDesktop && desktopUl) {
    ensureLinkInUl(desktopUl);
    // Cleanup duplicates in other pill ULs (if both desktop+mobile are visible)
    document.querySelectorAll("ul.nav-pill").forEach((ul) => {
      if (ul === desktopUl) return;
      const links = Array.from(ul.querySelectorAll(`a.nav-pill-link[href="${href}"]`));
      links.forEach((link) => {
        const li = link.closest("li");
        if (li) li.remove();
        else link.remove();
      });
    });
  } else if (!isDesktop && mobileUl) {
    ensureLinkInUl(mobileUl);
    // Cleanup duplicates in other pill ULs on mobile
    document.querySelectorAll("ul.nav-pill").forEach((ul) => {
      if (ul === mobileUl) return;
      const links = Array.from(ul.querySelectorAll(`a.nav-pill-link[href="${href}"]`));
      links.forEach((link) => {
        const li = link.closest("li");
        if (li) li.remove();
        else link.remove();
      });
    });
  } else {
    // Fallback: patch all pill ULs if structure differs.
    const navUls = Array.from(document.querySelectorAll("ul.nav-pill"));
    navUls.forEach(ensureLinkInUl);
  }

  if (isNewsPage) {
    const link = document.querySelector(`a.nav-pill-link[href="${href}"]`);
    if (link) link.classList.add("nav-active");
  }
})();
