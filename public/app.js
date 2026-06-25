// ---- Initialisation de la carte ----
const map = L.map('map', { zoomControl: false });
// ---- Contrôle Leaflet pour le bouton d'infos ----
const InfoControl = L.Control.extend({
  options: {
    position: 'bottomright'
  },
  onAdd: function (map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-info');
    container.innerHTML = `
      <a href="#" id="btn-about" title="À propos du projet" role="button" aria-label="À propos du projet">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align: middle;">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
      </a>
    `;
    L.DomEvent.disableClickPropagation(container);
    return container;
  }
});
map.addControl(new InfoControl());

L.control.zoom({ position: 'bottomright' }).addTo(map);

const tiles = {
  clair: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
  }),
  sombre: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
  }),
};

let modeActuel = 'sombre';
tiles.sombre.addTo(map);

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
let allMarkers = [];   // [{ marker, type, hebergeur, estimatedPower, surfaceSqFt, equipIA, uniqid }]
let selectedType = null;
let selectedHebergeur = null;
let filterAI = false;
let hqNodesVisible = true;
let hqGenVisible = true;
let connectionsLayer = null;
let connectionsGeojson = null;

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
    html: `<div class="marker-icon" style="background:${cfg.couleur};color:${cfg.texte};--marker-color:${cfg.couleur};--marker-color-glow:${cfg.couleur}40">${cfg.lettre}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function creerIconeGeneration(color) {
  return L.divIcon({
    className: '',
    html: `<div class="generation-icon" style="background:${color};--marker-color:${color};--marker-color-glow:${color}40">
             <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff" style="display: block;">
               <path d="M7 2v11h3v9l7-12h-4l4-8z" />
             </svg>
           </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
}

// ---- Groupe de clustering ----
const clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

// ---- Utilitaire : valeur ou tiret ----
function val(v) {
  return (v !== null && v !== undefined && v !== '') ? v : '—';
}

// ---- Extraction et nettoyage de la surface au sol ----
function parseSurfaceSqFt(surfValue) {
  if (surfValue === null || surfValue === undefined || surfValue === '') return null;
  const surf = parseInt(String(surfValue).replace(/\s/g, ''), 10);
  return isNaN(surf) ? null : surf;
}

// ---- Puissance estimée selon SurfBatimentPI2 × 50% × PowerDensity / 1 000 000 ----
function estimerPuissance(p, densityMap) {
  const surf = parseSurfaceSqFt(p.SurfBatimentPI2);
  if (surf === null) return null;
  const type = (p.Type || '').toLowerCase().trim();
  const entry = Object.entries(densityMap).find(([k]) => k.toLowerCase().trim() === type);
  if (!entry) return null;
  return (surf * 0.5 * entry[1].power_density_w_pi2) / 1_000_000;
}

// ---- Config couleurs réseau électrique par niveau de tension (kV) ----
function getHqStyleParams(pole) {
  const match = (pole || '').match(/(\d+)\s*kV/);
  const kv = match ? parseInt(match[1], 10) : 0;

  let color = '#00bcd4'; // 120 - 161 kV
  let weight = 0.8;
  let opacity = 0.2;
  let dashArray = '3, 4';

  if (kv >= 735) {
    color = '#e91e63'; // 735 kV
    weight = 1.8;
    opacity = 0.4;
    dashArray = '6, 5';
  } else if (kv >= 315) {
    color = '#9c27b0'; // 315 - 450 kV
    weight = 1.3;
    opacity = 0.3;
    dashArray = '5, 4';
  } else if (kv >= 230) {
    color = '#3f51b5'; // 230 kV
    weight = 1.0;
    opacity = 0.25;
    dashArray = '4, 4';
  }

  return { color, weight, opacity, dashArray };
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
    <div class="popup-row"><span class="popup-label">Équipé pour l'IA</span><span class="popup-value">${p.ÉquipIA === 'IA' ? 'Oui ✅' : 'Non'}</span></div>
    <div class="popup-row"><span class="popup-label">Site web</span><span class="popup-value">${lien}</span></div>
  `;
}

// ---- Génération des boutons de filtrage à clic unique (Chips) ----
function buildClickFilters(containerId, values, isTypeCategory) {
  const container = document.getElementById(containerId);
  [...values].sort().forEach(v => {
    const el = document.createElement('div');
    el.className = 'filter-item';
    el.textContent = v;
    el.dataset.value = v;

    el.addEventListener('click', () => {
      if (isTypeCategory) {
        selectedType = selectedType === v ? null : v;
        updateFilterUI('filters-type', selectedType);
      } else {
        selectedHebergeur = selectedHebergeur === v ? null : v;
        updateFilterUI('filters-hebergeur', selectedHebergeur);
      }
      applyFilters();
    });

    container.appendChild(el);
  });
}

function updateFilterUI(containerId, selectedValue) {
  const container = document.getElementById(containerId);
  const items = container.querySelectorAll('.filter-item');
  items.forEach(el => {
    if (selectedValue === null) {
      el.classList.remove('active');
      el.classList.remove('inactive');
    } else {
      if (el.dataset.value === selectedValue) {
        el.classList.add('active');
        el.classList.remove('inactive');
      } else {
        el.classList.remove('active');
        el.classList.add('inactive');
      }
    }
  });
}

// ---- Formatage des nombres en français canadien ----
const numberFormatter = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 });

// ---- Mise à jour des statistiques ----
function updateStatsUI(countVisible, totalPower, countWithPower, totalSurfaceSqFt, countWithSurface) {
  const countEl = document.getElementById('stats-count');
  const powerEl = document.getElementById('stats-power');
  const detailsEl = document.getElementById('stats-power-details');
  const surfaceEl = document.getElementById('stats-surface');
  const surfaceDetailsEl = document.getElementById('stats-surface-details');

  if (countEl) countEl.textContent = countVisible;
  if (powerEl) powerEl.textContent = totalPower > 0 ? totalPower.toFixed(1) + ' MW' : '0.0 MW';
  if (detailsEl) {
    detailsEl.textContent = `Calculée sur ${countWithPower} / ${countVisible} site${countVisible > 1 ? 's' : ''}`;
  }

  if (surfaceEl) {
    if (totalSurfaceSqFt > 0) {
      const surfaceM2 = totalSurfaceSqFt * 0.09290304;
      surfaceEl.textContent = numberFormatter.format(surfaceM2) + ' m²';
    } else {
      surfaceEl.textContent = '0 m²';
    }
  }
  if (surfaceDetailsEl) {
    const formattedSqFt = totalSurfaceSqFt > 0 ? numberFormatter.format(totalSurfaceSqFt) + ' pi²' : '0 pi²';
    surfaceDetailsEl.textContent = `${formattedSqFt} — sur ${countWithSurface} / ${countVisible} site${countVisible > 1 ? 's' : ''}`;
  }
}

// ---- Mise à jour de la répartition par hébergeur ----
function updateHostBreakdownUI(hostCounts) {
  const container = document.getElementById('host-breakdown');
  if (!container) return;
  container.innerHTML = '';

  // Trier par nombre décroissant de sites
  const sortedHosts = Object.entries(hostCounts).sort((a, b) => b[1] - a[1]);

  sortedHosts.forEach(([hostName, count]) => {
    const row = document.createElement('div');
    row.className = 'host-row';
    
    // Appliquer les classes active/inactive
    if (selectedHebergeur !== null) {
      if (hostName === selectedHebergeur) {
        row.classList.add('active');
      } else {
        row.classList.add('inactive');
      }
    }

    row.innerHTML = `
      <span class="host-name" title="${hostName}">${hostName}</span>
      <span class="host-count">${count}</span>
    `;

    row.addEventListener('click', () => {
      selectedHebergeur = selectedHebergeur === hostName ? null : hostName;
      applyFilters();
    });

    container.appendChild(row);
  });
}

// ---- Application des filtres ----
function applyFilters() {
  clusterGroup.clearLayers();
  let countVisible = 0;
  let totalPower = 0;
  let countWithPower = 0;
  let totalSurfaceSqFt = 0;
  let countWithSurface = 0;
  const hostCounts = {};
  const visibleDatacenterIds = new Set();

  for (const { marker, type, hebergeur, estimatedPower, surfaceSqFt, equipIA, uniqid } of allMarkers) {
    const matchType = !selectedType || type === selectedType;
    const matchHebergeur = !selectedHebergeur || hebergeur === selectedHebergeur;
    const matchAI = !filterAI || equipIA === 'IA';
    
    // Affichage sur la carte (tient compte de tous les filtres)
    if (matchType && matchHebergeur && matchAI) {
      clusterGroup.addLayer(marker);
      countVisible++;
      if (estimatedPower !== null && estimatedPower !== undefined) {
        totalPower += estimatedPower;
        countWithPower++;
      }
      if (surfaceSqFt !== null && surfaceSqFt !== undefined) {
        totalSurfaceSqFt += surfaceSqFt;
        countWithSurface++;
      }
      if (uniqid) {
        visibleDatacenterIds.add(uniqid);
      }
    }

    // Répartition par hébergeur (indépendante du filtre hébergeur actif pour éviter de vider la liste)
    if (matchType && matchAI) {
      hostCounts[hebergeur] = (hostCounts[hebergeur] || 0) + 1;
    }
  }

  updateStatsUI(countVisible, totalPower, countWithPower, totalSurfaceSqFt, countWithSurface);
  updateHostBreakdownUI(hostCounts);
  updateConnections(visibleDatacenterIds);
}

// ---- Mise à jour des lignes de connexion datacenters -> postes ----
function updateConnections(visibleDatacenterIds) {
  if (!connectionsLayer || !connectionsGeojson) return;

  connectionsLayer.clearLayers();

  if (hqNodesVisible) {
    const filteredFeatures = connectionsGeojson.features.filter(f => 
      visibleDatacenterIds.has(f.properties.datacenter_id)
    );
    connectionsLayer.addData(filteredFeatures);
  }
}

// ---- Chargement des données ----
const fetchJSON = url => fetch(url).then(r => {
  if (!r.ok) throw new Error(`Erreur HTTP ${r.status} (${url})`);
  return r.json();
});

Promise.all([
  fetchJSON('/datacenters.geojson'),
  fetchJSON('/datacenter_types.json'),
  fetchJSON('/DCbati_poly.geojson'),
  fetchJSON('/Hydro-Quebec.geojson'),
  fetchJSON('/connections.geojson')
])
  .then(([geojson, densityMap, polysGeojson, hqGeojson, loadedConnectionsGeojson]) => {
    connectionsGeojson = loadedConnectionsGeojson;
    // Remplir les dates de collecte dans le tableau du À Propos
    const dateDatacentersEl = document.getElementById('date-datacenters');
    const dateBatiEl = document.getElementById('date-bati');
    const dateHqEl = document.getElementById('date-hq');

    if (dateDatacentersEl && geojson.metadata?.date) dateDatacentersEl.textContent = geojson.metadata.date;
    if (dateBatiEl && polysGeojson.metadata?.date) dateBatiEl.textContent = polysGeojson.metadata.date;
    if (dateHqEl && hqGeojson.metadata?.date) dateHqEl.textContent = hqGeojson.metadata.date;

    const types = new Set();
    const hebergeurs = new Set();
    const bounds = [];

    // Table UNIQID → Type pour coloriser les polygones
    const uniqidToType = {};
    for (const f of geojson.features) {
      if (f.properties.UNIQID) uniqidToType[f.properties.UNIQID] = f.properties.Type || 'Inconnu';
    }

    // Couche polygones (overlayPane z-400, sous les marqueurs markerPane z-600)
    let polysVisible = true;
    const polyLayer = L.geoJSON(polysGeojson, {
      style: feature => {
        const type = uniqidToType[feature.properties.UNIQID] || 'Inconnu';
        const cfg = ICON_CONFIG[type] || ICON_CONFIG['Inconnu'];
        return { color: cfg.couleur, fillColor: cfg.couleur, fillOpacity: 0.25, weight: 1.5, opacity: 0.7 };
      },
      interactive: false,
    }).addTo(map);

    // Couche des liaisons électriques (overlayPane) - ajoutée sous les lignes de transport
    connectionsLayer = L.geoJSON(connectionsGeojson, {
      style: feature => {
        const type = feature.properties.datacenter_type || 'Inconnu';
        const cfg = ICON_CONFIG[type] || ICON_CONFIG['Inconnu'];
        return {
          color: cfg.couleur,
          weight: 1.5,
          opacity: 0.6,
          dashArray: '4, 6'
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-title">Liaison électrique</div>
          <div class="popup-row"><span class="popup-label">Datacenter</span><span class="popup-value">${val(p.datacenter_name)}</span></div>
          <div class="popup-row"><span class="popup-label">Poste Hydro-Québec</span><span class="popup-value">${val(p.substation_name)}</span></div>
          <div class="popup-row"><span class="popup-label">Distance</span><span class="popup-value">${p.distance_km !== undefined ? p.distance_km.toFixed(2) + ' km' : '—'}</span></div>
        `, { maxWidth: 280 });

        layer.on({
          mouseover: e => {
            const l = e.target;
            l.setStyle({
              weight: 3.5,
              opacity: 0.9,
              dashArray: ''
            });
          },
          mouseout: e => {
            const l = e.target;
            connectionsLayer.resetStyle(l);
          }
        });
      }
    }).addTo(map);

    // Couche des lignes Hydro-Québec (overlayPane, sous les postes et marqueurs)
    const hqLinesLayer = L.geoJSON(hqGeojson, {
      filter: feature => feature.properties.isLine === true,
      style: feature => {
        const { color, weight, opacity, dashArray } = getHqStyleParams(feature.properties.pole);
        return { color, weight, opacity, dashArray };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-title">Ligne haute tension</div>
          <div class="popup-row"><span class="popup-label">Numéro/ID</span><span class="popup-value">${val(p.id)}</span></div>
          <div class="popup-row"><span class="popup-label">Tension</span><span class="popup-value">${val(p.pole)}</span></div>
        `, { maxWidth: 280 });
      }
    }).addTo(map);

    // Couche des postes électriques et centrales Hydro-Québec (rendus différemment)
    const hqNodesLayer = L.geoJSON(hqGeojson, {
      filter: feature => {
        if (feature.properties.isPoint !== true) return false;
        
        // N'afficher que les très grosses centrales de 735 kV
        const p = feature.properties;
        const isGen = p.node_type === 'Generation' || (p.pole && p.pole.startsWith('Generation'));
        if (isGen) {
          const match = (p.pole || '').match(/(\d+)\s*kV/);
          const kv = match ? parseInt(match[1], 10) : 0;
          if (kv !== 735) return false;
        }
        return true;
      },
      pointToLayer: (feature, latlng) => {
        const p = feature.properties;
        const isGen = p.node_type === 'Generation' || (p.pole && p.pole.startsWith('Generation'));
        const { color, opacity } = getHqStyleParams(p.pole);
        if (isGen) {
          return L.marker(latlng, { icon: creerIconeGeneration(color) });
        } else {
          return L.circleMarker(latlng, {
            radius: 2.5,
            fillColor: color,
            stroke: false,
            fillOpacity: opacity * 1.5
          });
        }
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const isGen = p.node_type === 'Generation' || (p.pole && p.pole.startsWith('Generation'));
        const popupTitle = isGen ? 'Centrale de production' : 'Poste électrique';
        layer.bindPopup(`
          <div class="popup-title">${popupTitle}</div>
          <div class="popup-row"><span class="popup-label">Nom</span><span class="popup-value">${val(p.id)}</span></div>
          <div class="popup-row"><span class="popup-label">Tension max</span><span class="popup-value">${val(p.pole)}</span></div>
        `, { maxWidth: 280 });
      }
    }).addTo(map);

    // Mise à jour de la taille et de la visibilité des postes électriques selon le zoom
    function updateNodesRadius() {
      const zoom = map.getZoom();
      let radius = 2.0;
      let hasStroke = false;
      let fillOpacityCoeff = 1.5;

      if (zoom >= 15) {
        radius = 6.0;
        hasStroke = true;
        fillOpacityCoeff = 2.2;
      } else if (zoom >= 13) {
        radius = 4.0;
        hasStroke = true;
        fillOpacityCoeff = 1.8;
      } else if (zoom >= 11) {
        radius = 2.8;
      } else {
        radius = 2.0;
      }

      hqNodesLayer.eachLayer(layer => {
        if (layer.setRadius) {
          layer.setRadius(radius);
          const p = layer.feature.properties;
          const { opacity } = getHqStyleParams(p.pole);

          if (hasStroke) {
            // Affichage contrasté en très gros plan (zoom important)
            layer.setStyle({
              fillOpacity: Math.min(opacity * fillOpacityCoeff, 0.9),
              stroke: true,
              color: '#ffffff',
              weight: 0.8,
              opacity: 0.7
            });
          } else {
            // Rendu fondu et sans contour en plan moyen/large
            layer.setStyle({
              fillOpacity: opacity * fillOpacityCoeff,
              stroke: false
            });
          }
        }
      });
    }
    map.on('zoomend', updateNodesRadius);

    // Gestion du filtrage par niveau de tension
    let selectedVoltage = null;

    function getHqVoltageCategory(pole) {
      const match = (pole || '').match(/(\d+)\s*kV/);
      const kv = match ? parseInt(match[1], 10) : 0;
      if (kv >= 735) return '735';
      if (kv >= 315) return '315';
      if (kv >= 230) return '230';
      return '120';
    }

    function applyHqFilters() {
      hqLinesLayer.clearLayers();
      hqNodesLayer.clearLayers();

      const filteredFeatures = hqGeojson.features.filter(f => {
        if (!selectedVoltage) return true;
        return getHqVoltageCategory(f.properties.pole) === selectedVoltage;
      });

      // Lignes
      if (hqLinesVisible) {
        const lineFeatures = filteredFeatures.filter(f => f.properties.isLine === true);
        hqLinesLayer.addData(lineFeatures);
      }

      // Points (Postes et Centrales)
      const pointFeatures = filteredFeatures.filter(f => {
        if (f.properties.isPoint !== true) return false;
        
        const isGen = f.properties.node_type === 'Generation' || (f.properties.pole && f.properties.pole.startsWith('Generation'));
        if (isGen) {
          if (!hqGenVisible) return false;
          
          // N'afficher que les très grosses centrales de 735 kV
          const match = (f.properties.pole || '').match(/(\d+)\s*kV/);
          const kv = match ? parseInt(match[1], 10) : 0;
          if (kv !== 735) return false;
        } else {
          if (!hqNodesVisible) return false;
        }
        
        return true;
      });
      hqNodesLayer.addData(pointFeatures);

      // Ré-appliquer la taille dynamique des postes
      updateNodesRadius();
    }

    // Cabler le clic sur la légende pour filtrer les tensions
    document.querySelectorAll('.hq-legend-item').forEach(el => {
      el.addEventListener('click', () => {
        const val = el.dataset.voltage;
        selectedVoltage = selectedVoltage === val ? null : val;

        // Mettre à jour l'UI de la légende
        document.querySelectorAll('.hq-legend-item').forEach(item => {
          if (selectedVoltage === null) {
            item.classList.remove('active');
            item.classList.remove('inactive');
          } else {
            if (item.dataset.voltage === selectedVoltage) {
              item.classList.add('active');
              item.classList.remove('inactive');
            } else {
              item.classList.remove('active');
              item.classList.add('inactive');
            }
          }
        });

        applyHqFilters();
      });
    });

    // Gestion des boutons Hydro-Québec
    let hqLinesVisible = true;
    let hqGenVisible = true;

    const btnLines = document.getElementById('btn-hq-lines');
    if (btnLines) {
      btnLines.addEventListener('click', () => {
        hqLinesVisible = !hqLinesVisible;
        btnLines.classList.toggle('active', hqLinesVisible);
        btnLines.classList.toggle('inactive', !hqLinesVisible);
        applyHqFilters();
      });
    }

    const btnNodes = document.getElementById('btn-hq-nodes');
    if (btnNodes) {
      btnNodes.addEventListener('click', () => {
        hqNodesVisible = !hqNodesVisible;
        btnNodes.classList.toggle('active', hqNodesVisible);
        btnNodes.classList.toggle('inactive', !hqNodesVisible);
        applyHqFilters();
        applyFilters();
      });
    }

    const btnGen = document.getElementById('btn-hq-gen');
    if (btnGen) {
      btnGen.addEventListener('click', () => {
        hqGenVisible = !hqGenVisible;
        btnGen.classList.toggle('active', hqGenVisible);
        btnGen.classList.toggle('inactive', !hqGenVisible);
        applyHqFilters();
      });
    }

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

      const puissEst = estimerPuissance(p, densityMap);
      const surfaceSqFt = parseSurfaceSqFt(p.SurfBatimentPI2);

      allMarkers.push({ marker, type, hebergeur, estimatedPower: puissEst, surfaceSqFt, equipIA: p.ÉquipIA, uniqid: p.UNIQID });
    }

    if (ignorés > 0) console.info(`ℹ️ ${ignorés} site(s) sans coordonnées ignoré(s)`);

    // Générer les filtres dynamiquement
    buildClickFilters('filters-type', types, true);

    // Bouton "Équipé pour l'IA"
    const btnFilterIA = document.getElementById('btn-filter-ia');
    if (btnFilterIA) {
      btnFilterIA.addEventListener('click', () => {
        filterAI = !filterAI;
        if (filterAI) {
          btnFilterIA.classList.add('active');
          btnFilterIA.classList.remove('inactive');
        } else {
          btnFilterIA.classList.remove('active');
          btnFilterIA.classList.remove('inactive');
        }
        applyFilters();
      });
    }

    // Bouton "Empreinte bâtiments"
    const btnPoly = document.createElement('div');
    btnPoly.className = 'filter-item active';
    btnPoly.textContent = 'Empreinte bâtiments';
    btnPoly.addEventListener('click', () => {
      polysVisible = !polysVisible;
      btnPoly.classList.toggle('active', polysVisible);
      btnPoly.classList.toggle('inactive', !polysVisible);
      polysVisible ? polyLayer.addTo(map) : map.removeLayer(polyLayer);
    });
    document.getElementById('filters-polygones').appendChild(btnPoly);

    // Ajouter les points colorés devant chaque type
    document.querySelectorAll('#filters-type .filter-item').forEach(el => {
      const val = el.dataset.value;
      const cfg = ICON_CONFIG[val];
      if (!cfg) return;
      const dot = document.createElement('span');
      dot.className = 'filter-dot';
      dot.style.background = cfg.couleur;
      el.insertBefore(dot, el.firstChild);
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

// ---- Gestion de la Modal À Propos ----
const aboutModal = document.getElementById('about-modal');
const btnAbout = document.getElementById('btn-about');
const btnCloseAbout = document.getElementById('btn-close-about');

if (btnAbout && aboutModal) {
  btnAbout.addEventListener('click', (e) => {
    e.preventDefault();
    aboutModal.classList.add('visible');
  });
}

if (btnCloseAbout && aboutModal) {
  btnCloseAbout.addEventListener('click', () => {
    aboutModal.classList.remove('visible');
  });
}

if (aboutModal) {
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
      aboutModal.classList.remove('visible');
    }
  });
}

// ---- Gestion de la Navigation Mobile (Bottom Sheets) ----
const infoPanel = document.getElementById('info-panel');
const filtersPanel = document.getElementById('filters');
const btnMobileInfo = document.getElementById('btn-mobile-info');
const btnMobileFilters = document.getElementById('btn-mobile-filters');
const btnCloseInfo = document.getElementById('btn-close-info');
const btnCloseFilters = document.getElementById('btn-close-filters');
const mobileNav = document.getElementById('mobile-nav');

function closeAllMobilePanels() {
  if (infoPanel) infoPanel.classList.remove('open');
  if (filtersPanel) filtersPanel.classList.remove('open');
  if (btnMobileInfo) btnMobileInfo.classList.remove('active');
  if (btnMobileFilters) btnMobileFilters.classList.remove('active');
}

if (btnMobileInfo && infoPanel) {
  btnMobileInfo.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = infoPanel.classList.contains('open');
    closeAllMobilePanels();
    if (!isOpen) {
      infoPanel.classList.add('open');
      btnMobileInfo.classList.add('active');
    }
  });
}

if (btnMobileFilters && filtersPanel) {
  btnMobileFilters.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = filtersPanel.classList.contains('open');
    closeAllMobilePanels();
    if (!isOpen) {
      filtersPanel.classList.add('open');
      btnMobileFilters.classList.add('active');
    }
  });
}

if (btnCloseInfo) {
  btnCloseInfo.addEventListener('click', (e) => {
    e.stopPropagation();
    if (infoPanel) infoPanel.classList.remove('open');
    if (btnMobileInfo) btnMobileInfo.classList.remove('active');
  });
}

if (btnCloseFilters) {
  btnCloseFilters.addEventListener('click', (e) => {
    e.stopPropagation();
    if (filtersPanel) filtersPanel.classList.remove('open');
    if (btnMobileFilters) btnMobileFilters.classList.remove('active');
  });
}

// Fermer les panneaux lors d'un clic sur la carte
map.on('click', () => {
  if (window.innerWidth <= 768) {
    closeAllMobilePanels();
  }
});

// Éviter la propagation du clic pour ne pas fermer les panneaux en interagissant avec
if (infoPanel) L.DomEvent.disableClickPropagation(infoPanel);
if (filtersPanel) L.DomEvent.disableClickPropagation(filtersPanel);
if (mobileNav) L.DomEvent.disableClickPropagation(mobileNav);
