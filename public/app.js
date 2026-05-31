// ---- Initialisation de la carte ----
const map = L.map('map');

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// ---- État : marqueurs et filtres actifs ----
let allMarkers = [];   // [{ marker, type, hebergeur }]
const activeTypes = new Set();
const activeHebergeurs = new Set();

// ---- Groupe de clustering ----
const clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

// ---- Utilitaire : valeur ou tiret ----
function val(v) {
  return (v !== null && v !== undefined && v !== '') ? v : '—';
}

// ---- Construction du contenu popup ----
function buildPopup(p) {
  const lien = p.Siteweb
    ? `<a class="popup-link" href="${p.Siteweb}" target="_blank" rel="noopener">Voir le site</a>`
    : '—';

  return `
    <div class="popup-title">${val(p.NomSite)}</div>
    <div class="popup-row"><span class="popup-label">Type</span><span class="popup-value">${val(p.Type)}</span></div>
    <div class="popup-row"><span class="popup-label">Hébergeur</span><span class="popup-value">${val(p.Hebergeur)}</span></div>
    <div class="popup-row"><span class="popup-label">Adresse</span><span class="popup-value">${val(p.Adresse)}</span></div>
    <div class="popup-row"><span class="popup-label">Puissance</span><span class="popup-value">${p.PuissanceAnnMW !== null ? p.PuissanceAnnMW + ' MW' : '—'}</span></div>
    <div class="popup-row"><span class="popup-label">Bâtiments</span><span class="popup-value">${val(p.NombreBatiments)}</span></div>
    <div class="popup-row"><span class="popup-label">Site web</span><span class="popup-value">${lien}</span></div>
  `;
}

// ---- Génération des cases à cocher ----
function buildCheckboxes(containerId, values, activeSet) {
  const container = document.getElementById(containerId);
  [...values].sort().forEach(v => {
    activeSet.add(v);

    const label = document.createElement('label');
    label.className = 'filter-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.value = v;
    cb.addEventListener('change', () => {
      if (cb.checked) activeSet.add(v);
      else activeSet.delete(v);
      applyFilters();
    });

    label.append(cb, document.createTextNode(v));
    container.appendChild(label);
  });
}

// ---- Application des filtres ----
function applyFilters() {
  clusterGroup.clearLayers();
  for (const { marker, type, hebergeur } of allMarkers) {
    if (activeTypes.has(type) && activeHebergeurs.has(hebergeur)) {
      clusterGroup.addLayer(marker);
    }
  }
}

// ---- Chargement du GeoJSON ----
fetch('/points.geojson')
  .then(r => {
    if (!r.ok) throw new Error(`Erreur HTTP ${r.status}`);
    return r.json();
  })
  .then(geojson => {
    const types = new Set();
    const hebergeurs = new Set();
    const bounds = [];

    let ignorés = 0;
    for (const feature of geojson.features) {
      const coords = feature.geometry?.coordinates;
      // Ignorer les sites sans coordonnées (non géocodés)
      if (!Array.isArray(coords) || coords.length < 2) { ignorés++; continue; }

      const [lng, lat] = coords;
      const p = feature.properties;

      const type = p.Type || 'Inconnu';
      const hebergeur = (p.Hebergeur || 'Inconnu').trim();
      types.add(type);
      hebergeurs.add(hebergeur);
      bounds.push([lat, lng]);

      const marker = L.marker([lat, lng]);
      marker.bindPopup(buildPopup(p), { maxWidth: 280 });

      allMarkers.push({ marker, type, hebergeur });
    }

    if (ignorés > 0) console.info(`ℹ️ ${ignorés} site(s) sans coordonnées ignoré(s)`);

    // Générer les filtres dynamiquement
    buildCheckboxes('filters-type', types, activeTypes);
    buildCheckboxes('filters-hebergeur', hebergeurs, activeHebergeurs);

    // Afficher tous les marqueurs
    applyFilters();

    // Centrer la carte sur l'emprise des points
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  })
  .catch(err => {
    console.error('Impossible de charger points.geojson :', err);
  });
