/* ══════════════════════════════════════════════════════════
         RECENT WORK DATA
         ──────────────────────────────────────────────────────────
         To ADD a new slide:
           1. Copy one object { } from the array below
           2. Paste it at the top (or anywhere)
           3. Fill in the fields
           4. Save the file — done!

         Fields:
           type    → "paper" | "project" | "award"
           label   → small coloured label text
           title   → main heading
           desc    → short description
           tags    → array of keyword strings
           image   → path to image (use "" for a gradient placeholder)
           link    → URL for "Read More" button (use "" to hide button)
           linkLabel → button text (default "Read More")
           extra   → optional second button { label, href }
         ══════════════════════════════════════════════════════════ */
const recentWork = [
  {
    type: "paper",
    label: "New Publication · 2024",
    title:
      "Agricultural Intensification and Cropland Expansion in the Semi-Arid Foothills of Kirthar Range",
    desc: "Examines how agricultural expansion in Pakistan's semi-arid foothills affects water management and food security, using multi-temporal satellite data.",
    tags: [
      "Agriculture",
      "Remote Sensing",
      "Food Security",
      "Water Management",
    ],
    image: "./images/Agri_paper/Agri_intensification.png",
    link: "https://doi.org/10.1007/s41748-024-00548-0",
    linkLabel: "View Paper",
    extra: { label: "All Publications", href: "Research.html" },
  },
  {
    type: "paper",
    label: "Publication · 2023",
    title:
      "Sinking Delta: Quantifying the Impacts of Saltwater Intrusion in the Indus Delta of Pakistan",
    desc: "Investigates saltwater intrusion dynamics in the Indus Delta, quantifying ecological and socio-economic consequences for one of South Asia's most vulnerable coastal zones.",
    tags: [
      "Coastal Hydrology",
      "Remote Sensing",
      "Indus Delta",
      "Climate Change",
    ],
    image: "./images/Water_paper/Sinking_delta.jpg",
    link: "https://www.sciencedirect.com/science/article/pii/S0048969723019757",
    linkLabel: "View Paper",
    extra: {
      label: "Water & Hydrology Research",
      href: "Water_Hydrology.html",
    },
  },
  {
    type: "paper",
    label: "Publication",
    title:
      "Impacts of Urban Morphology on Sensible Heat Flux and Net Radiation Exchange",
    desc: "Analyses how city structure and form drive surface energy balance variations — key insights for designing heat-resilient urban environments.",
    tags: ["Urban Heat", "GIS", "Machine Learning", "Land Surface Temperature"],
    image: "./images/Urban Heat/Urban Morphology.jpg",
    link: "https://www.sciencedirect.com/science/article/pii/S2212095523001827",
    linkLabel: "View Paper",
    extra: { label: "Urban & Heat Research", href: "UH_SC.html" },
  },
  {
    type: "paper",
    label: "Publication",
    title:
      "A Comparison of Machine Learning Models for Mapping Tree Species Using WorldView-2 Imagery",
    desc: "Benchmarks Random Forest, SVM, and deep learning approaches for high-resolution tree species classification in the agroforestry landscapes of West Africa.",
    tags: ["Machine Learning", "WorldView-2", "Agroforestry", "West Africa"],
    image: "./images/GIS and RS/worlddview.jpg",
    link: "https://www.mdpi.com/2220-9964/12/4/142",
    linkLabel: "View Paper",
    extra: { label: "GIS & RS Research", href: "GIS_RS_SDS.html" },
  },
  {
    type: "project",
    label: "Active Project",
    title: "Drought Risk & Adaptation in Arid Ecosystems",
    desc: "Developing satellite-based early warning systems to monitor vegetation stress and rainfall deficits across Pakistan's agro-ecological zones, and evaluating adaptation strategies like water harvesting and dry afforestation.",
    tags: [
      "Drought Monitoring",
      "Vegetation Stress",
      "Water Harvesting",
      "Arid Ecosystems",
    ],
    image: "./images/drought.gif",
    link: "Projects.html",
    linkLabel: "Project Details",
    extra: null,
  },
  {
    type: "project",
    label: "Active Project",
    title: "Forest Restoration Monitoring in Mountain Regions of Pakistan",
    desc: "Using multi-temporal satellite and UAV imagery to track vegetation recovery, assess biodiversity, and evaluate the success of large-scale forest restoration programmes.",
    tags: ["Forest Restoration", "UAV", "Biodiversity", "Carbon Assessment"],
    image: "./images/Forest.gif",
    link: "Projects.html",
    linkLabel: "Project Details",
    extra: null,
  },
];

/* -- Slideshow engine (Firefox-style stacked carousel) -- */
let currentSlide = 0;
let autoTimer = null;

function renderSlides() {
  const container = document.getElementById("rw-slides-container");
  const dotsContainer = document.getElementById("rw-dots");
  if (!container || !dotsContainer) return;

  container.classList.add("rw-track");

  container.innerHTML = recentWork
    .map((item, i) => {
      const typeClass =
        {
          paper: "badge-paper",
          project: "badge-project",
          award: "badge-award",
        }[item.type] || "badge-paper";
      const typeLabel =
        { paper: "Publication", project: "Project", award: "Award" }[
          item.type
        ] || item.type;

      const imgHtml = item.image
        ? `<img src="${item.image}" alt="${item.title}" onerror="this.parentElement.style.background='linear-gradient(135deg,#2c5282,#38a169)'">`
        : "";

      const tagsHtml = item.tags
        .map((t) => `<span class="rw-tag">${t}</span>`)
        .join("");

      const primaryBtn = item.link
        ? `<a href="${item.link}" target="_blank" class="rw-btn-primary">${item.linkLabel || "Read More"}</a>`
        : "";

      const extraBtn = item.extra
        ? `<a href="${item.extra.href}" class="rw-btn-outline">${item.extra.label}</a>`
        : "";

      return `
      <article class="rw-slide" data-index="${i}">
        <div class="rw-card">
          <div class="rw-card-img">
            ${imgHtml}
            <span class="rw-type-badge ${typeClass}">${typeLabel}</span>
          </div>
          <div class="rw-card-body">
            <div class="rw-label">${item.label}</div>
            <h3>${item.title}</h3>
            <p>${item.desc}</p>
            <div class="rw-tags">${tagsHtml}</div>
            <div class="rw-actions">${primaryBtn}${extraBtn}</div>
          </div>
        </div>
      </article>`;
    })
    .join("");

  dotsContainer.innerHTML = recentWork
    .map(
      (_, i) =>
        `<button class="rw-dot ${i === 0 ? "active" : ""}" data-slide="${i}" aria-label="Slide ${i + 1}"></button>`,
    )
    .join("");

  dotsContainer.querySelectorAll(".rw-dot").forEach((btn) => {
    btn.addEventListener("click", () =>
      goToSlide(parseInt(btn.dataset.slide, 10)),
    );
  });

  updateSlideClasses();
}

function updateSlideClasses() {
  const slides = Array.from(document.querySelectorAll(".rw-slide"));
  const dots = Array.from(document.querySelectorAll(".rw-dot"));
  const len = slides.length;
  if (!len) return;

  slides.forEach((slide, i) => {
    const diff = (i - currentSlide + len) % len;
    slide.classList.remove("is-prev", "is-active", "is-next", "is-far");

    if (diff === 0) slide.classList.add("is-active");
    else if (diff === 1) slide.classList.add("is-next");
    else if (diff === len - 1) slide.classList.add("is-prev");
    else slide.classList.add("is-far");

    slide.setAttribute("aria-hidden", diff === 0 ? "false" : "true");
  });

  dots.forEach((dot, i) => dot.classList.toggle("active", i === currentSlide));
}

function goToSlide(n) {
  const len = recentWork.length;
  if (!len) return;
  currentSlide = (n + len) % len;
  updateSlideClasses();
  resetTimer();
}

function resetTimer() {
  clearInterval(autoTimer);
  if (recentWork.length <= 1) return;
  autoTimer = setInterval(() => goToSlide(currentSlide + 1), 1500);
}

const prevBtn = document.getElementById("rw-prev");
const nextBtn = document.getElementById("rw-next");
if (prevBtn)
  prevBtn.addEventListener("click", () => goToSlide(currentSlide - 1));
if (nextBtn)
  nextBtn.addEventListener("click", () => goToSlide(currentSlide + 1));

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") goToSlide(currentSlide - 1);
  if (e.key === "ArrowRight") goToSlide(currentSlide + 1);
});

const carouselWrap = document.querySelector(".rw-carousel-wrap");
if (carouselWrap) {
  carouselWrap.addEventListener("mouseenter", () => clearInterval(autoTimer));
  carouselWrap.addEventListener("mouseleave", resetTimer);
}

renderSlides();
resetTimer();
