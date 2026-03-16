/**
 * Collaborators WebGIS Map
 * Interactive map showing partner/collaborator locations.
 * Add new collaborators to collaborators_data.json to show them on the map.
 */
(function () {
  "use strict";

  const CollaboratorsMap = {
    map: null,
    markers: [],
    homeBounds: null,

    init(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      fetch("collaborators_data.json")
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load collaborators");
          return r.json();
        })
        .then((data) => this.render(container, data.collaborators || []))
        .catch((err) => {
          console.warn("CollaboratorsMap:", err);
          container.innerHTML =
            '<p class="collaborators-map__error">Unable to load collaborators map. Please try again later.</p>';
        });
    },

    render(container, collaborators) {
      if (!collaborators.length) {
        container.innerHTML =
          '<p class="collaborators-map__empty">No collaborators to display.</p>';
        return;
      }

      container.innerHTML = '<div id="collaboratorsMapCanvas" class="collaborators-map__canvas"></div>';

      const canvas = document.getElementById("collaboratorsMapCanvas");
      if (!canvas) return;

      // Initialize Leaflet map
      this.map = L.map("collaboratorsMapCanvas", {
        scrollWheelZoom: true,
        zoomControl: true,
      }).setView([25, 60], 2);

      const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 20,
      });
      const streets = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      });
      satellite.addTo(this.map);
      const overlays = {};
      this.addCountryBoundaries().then((boundariesLayer) => {
        if (boundariesLayer) {
          boundariesLayer.addTo(this.map);
          overlays["Country boundaries"] = boundariesLayer;
        }
        L.control.layers(
          { "Satellite": satellite, "Streets": streets },
          overlays,
          { position: "topright" }
        ).addTo(this.map);
      }).catch(() => {
        L.control.layers({ "Satellite": satellite, "Streets": streets }, null, { position: "topright" }).addTo(this.map);
      });

      // Custom icon
      const defaultIcon = L.divIcon({
        className: "collaborators-marker",
        html: '<span class="collaborators-marker__pin"><i class="fas fa-map-marker-alt"></i></span>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      const bounds = [];
      collaborators.forEach((c) => {
        const marker = L.marker([c.lat, c.lng], { icon: defaultIcon })
          .addTo(this.map)
          .bindPopup(this.buildPopup(c));
        marker.on("dblclick", () => {
          this.map.setView([c.lat, c.lng], 16, { animate: true });
        });
        this.markers.push(marker);
        bounds.push([c.lat, c.lng]);
      });

      // Fit map to show all markers with padding and store bounds for home button
      const fitOpts = { padding: [40, 40], maxZoom: 12 };
      if (bounds.length > 1) {
        this.homeBounds = L.latLngBounds(bounds);
        this.map.fitBounds(this.homeBounds, fitOpts);
      } else if (bounds.length === 1) {
        this.homeBounds = L.latLngBounds([bounds[0], bounds[0]]);
        this.map.setView(bounds[0], 8);
      }

      // Add zoom control to bottom-right
      this.map.zoomControl.setPosition("bottomright");

      // Add home button to reset to original extent
      this.addHomeControl();

      // Bind zoom button in popups (works when popup overlaps marker)
      this.bindPopupZoomButtons();

      // Responsive: revalidate size on resize
      window.addEventListener("resize", () => this.map?.invalidateSize());
    },

    addCountryBoundaries() {
      const boundariesStyle = {
        color: "rgba(255, 255, 255, 0.6)",
        weight: 1,
        fillColor: "transparent",
        fillOpacity: 0,
      };
      return fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
        .then((r) => r.ok ? r.json() : null)
        .then((geojson) => {
          if (geojson && this.map) {
            return L.geoJSON(geojson, {
              style: boundariesStyle,
              interactive: false,
            });
          }
          return null;
        })
        .catch(() => null);
    },

    addHomeControl() {
      const self = this;
      const HomeControl = L.Control.extend({
        onAdd() {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "collaborators-map__home-btn";
          btn.title = "Reset to original extent";
          btn.setAttribute("aria-label", "Reset map to original extent");
          btn.innerHTML = '<i class="fas fa-home"></i>';
          btn.addEventListener("click", () => self.goHome());
          return btn;
        },
      });
      this.map.addControl(new HomeControl({ position: "topleft" }));
    },

    goHome() {
      if (this.map && this.homeBounds) {
        this.map.fitBounds(this.homeBounds, { padding: [40, 40], maxZoom: 12 });
      }
    },

    buildPopup(c) {
      const link = c.url
        ? `<a href="${c.url}" target="_blank" rel="noopener" class="collaborators-popup__link">Visit website <i class="fas fa-external-link-alt ms-1"></i></a>`
        : "";
      const zoomBtn = `<button type="button" class="collaborators-popup__zoom-btn" data-lat="${c.lat}" data-lng="${c.lng}" title="Zoom to view location"><i class="fas fa-search-plus me-1"></i>Zoom to view</button>`;
      return `
        <div class="collaborators-popup">
          <div class="collaborators-popup__header">
            ${c.logo ? `<img src="${c.logo}" alt="${c.name}" class="collaborators-popup__logo" onerror="this.style.display='none'">` : ""}
            <div>
              <strong class="collaborators-popup__name">${escapeHtml(c.name)}</strong>
              ${c.fullName && c.fullName !== c.name ? `<span class="collaborators-popup__full">${escapeHtml(c.fullName)}</span>` : ""}
            </div>
          </div>
          <p class="collaborators-popup__location"><i class="fas fa-map-pin me-1"></i>${escapeHtml(c.location)}</p>
          <div class="collaborators-popup__actions">
            ${zoomBtn}
            ${link}
          </div>
        </div>
      `;
    },

    bindPopupZoomButtons() {
      const self = this;
      this.map.getContainer().addEventListener("click", (e) => {
        const btn = e.target.closest(".collaborators-popup__zoom-btn");
        if (btn) {
          e.preventDefault();
          const lat = parseFloat(btn.dataset.lat);
          const lng = parseFloat(btn.dataset.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            self.map.setView([lat, lng], 16, { animate: true });
          }
        }
      });
    },
  };

  function escapeHtml(s) {
    if (!s) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  window.CollaboratorsMap = CollaboratorsMap;
})();
