// ---- Initialisation de la carte ----
const map = L.map('map');

const tiles = {
  clair: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }),
  sombre: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
  }),
};

let modeActuel = 'clair';
tiles.clair.addTo(map);

function basculerFond() {
  const ancien = modeActuel;
  modeActuel = ancien === 'sombre' ? 'clair' : 'sombre';
  map.removeLayer(tiles[ancien]);
  tiles[modeActuel].addTo(map);
  document.body.classList.toggle('theme-sombre', modeActuel === 'sombre');
  document.getElementById('btn-theme').textContent =
    modeActuel === 'sombre' ? '☀️ Carte claire' : '🌙 Carte sombre';
}

// ---- État : marqueurs et filtres actifs ----
let allMarkers = [];   // [{ marker, type, hebergeur }]
const activeTypes = new Set();
const activeHebergeurs = new Set();

// ---- Config icônes par type ----
const ICON_CONFIG = {
  'Hyperscale':    { couleur: '#FF6B35', lettre: 'H', texte: '#fff' },
  'Wholesale':     { couleur: '#4ECDC4', lettre: 'W', texte: '#fff' },
  'Retail':        { couleur: '#45B7D1', lettre: 'R', texte: '#fff' },
  'Carrier Hotel': { couleur: '#96CEB4', lettre: 'C', texte: '#fff' },
  'Crypto':        { couleur: '#FFD93D', lettre: '₿', texte: '#333' },
  'Quantique':     { couleur: '#C39BD3', lettre: 'Q', texte: '#fff' },
  'Unknown':       { couleur: '#888888', lettre: '?', texte: '#fff' },
  'Inconnu':       { couleur: '#888888', lettre: '?', texte: '#fff' },
};

function creerIcone(type) {
  const cfg = ICON_CONFIG[type] || ICON_CONFIG['Inconnu'];
  return L.divIcon({
    className: '',
    html: `<div class="marker-icon" style="background:${cfg.couleur};color:${cfg.texte}">${cfg.lettre}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

// ---- Groupe de clustering ----
const clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

// ---- Utilitaire : valeur ou tiret ----
function val(v) {
  return (v !== null && v !== undefined && v !== '') ? v : '—';
}

// ---- Puissance estimée selon SurfBatimentPI2 × 50% × PowerDensity / 1 000 000 ----
function estimerPuissance(p, densityMap) {
  if (!p.SurfBatimentPI2) return null;
  const surf = parseInt(String(p.SurfBatimentPI2).replace(/\s/g, ''), 10);
  if (isNaN(surf)) return null;
  const type = (p.Type || '').toLowerCase().trim();
  const entry = Object.entries(densityMap).find(([k]) => k.toLowerCase().trim() === type);
  if (!entry) return null;
  return (surf * 0.5 * entry[1].power_density_w_pi2) / 1_000_000;
}

// ---- Construction du contenu popup ----
function buildPopup(p, densityMap) {
  const lien = p.Siteweb
    ? `<a class="popup-link" href="${p.Siteweb}" target="_blank" rel="noopener">Voir le site</a>`
    : '—';

  const puissEst = estimerPuissance(p, densityMap);
  const puissEstStr = puissEst !== null ? puissEst.toFixed(2) + ' MW' : '—';

  return `
    <div class="popup-title">${val(p.NomSite)}</div>
    <div class="popup-row"><span class="popup-label">Type</span><span class="popup-value">${val(p.Type)}</span></div>
    <div class="popup-row"><span class="popup-label">Hébergeur</span><span class="popup-value">${val(p.Hebergeur)}</span></div>
    <div class="popup-row"><span class="popup-label">Adresse</span><span class="popup-value">${val(p.Adresse)}</span></div>
    <div class="popup-row"><span class="popup-label">Puissance annoncée</span><span class="popup-value">${p.PuissanceAnnMW !== null ? p.PuissanceAnnMW + ' MW' : '—'}</span></div>
    <div class="popup-row"><span class="popup-label">Puissance estimée</span><span class="popup-value">${puissEstStr}</span></div>
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

// ---- Chargement des données ----
const fetchJSON = url => fetch(url).then(r => {
  if (!r.ok) throw new Error(`Erreur HTTP ${r.status} (${url})`);
  return r.json();
});

Promise.all([fetchJSON('/points.geojson'), fetchJSON('/density.json')])
  .then(([geojson, densityMap]) => {
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

      const marker = L.marker([lat, lng], { icon: creerIcone(type) });
      marker.bindPopup(buildPopup(p, densityMap), { maxWidth: 280 });

      allMarkers.push({ marker, type, hebergeur });
    }

    if (ignorés > 0) console.info(`ℹ️ ${ignorés} site(s) sans coordonnées ignoré(s)`);

    // Générer les filtres dynamiquement
    buildCheckboxes('filters-type', types, activeTypes);
    buildCheckboxes('filters-hebergeur', hebergeurs, activeHebergeurs);

    // Ajouter les points colorés devant chaque type
    document.querySelectorAll('#filters-type .filter-item').forEach(label => {
      const cb = label.querySelector('input');
      const cfg = ICON_CONFIG[cb.value];
      if (!cfg) return;
      const dot = document.createElement('span');
      dot.className = 'filter-dot';
      dot.style.background = cfg.couleur;
      label.insertBefore(dot, label.firstChild);
    });

    // Afficher tous les marqueurs
    applyFilters();

    // Centrer la carte sur l'emprise des points
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  })
  .catch(err => {
    console.error('Erreur de chargement :', err);
  });
