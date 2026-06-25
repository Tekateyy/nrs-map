import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Formule de Haversine pour calculer la distance entre deux coordonnées (en mètres)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function main() {
  console.log('--- Génération des connexions Datacenter -> Poste Hydro-Québec ---');

  const datacentersPath = path.join(__dirname, '../data/datacenters.geojson');
  const hqPath = path.join(__dirname, '../data/Hydro-Quebec.geojson');
  const outputPath = path.join(__dirname, '../data/connections.geojson');

  if (!fs.existsSync(datacentersPath)) {
    console.error(`Fichier datacenters introuvable : ${datacentersPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(hqPath)) {
    console.error(`Fichier Hydro-Québec introuvable : ${hqPath}`);
    process.exit(1);
  }

  const datacentersGeojson = JSON.parse(fs.readFileSync(datacentersPath, 'utf8'));
  const hqGeojson = JSON.parse(fs.readFileSync(hqPath, 'utf8'));

  // 1. Filtrer les datacenters avec coordonnées valides
  const datacenters = (datacentersGeojson.features || []).filter(feature => {
    const coords = feature.geometry?.coordinates;
    return feature.geometry?.type === 'Point' && Array.isArray(coords) && coords.length >= 2;
  });

  // 2. Filtrer les postes électriques Hydro-Québec (nœuds/points)
  const substations = (hqGeojson.features || []).filter(feature => {
    const coords = feature.geometry?.coordinates;
    return feature.properties?.isPoint === true && feature.geometry?.type === 'Point' && Array.isArray(coords) && coords.length >= 2;
  });

  console.log(`Nombre de datacenters à traiter : ${datacenters.length}`);
  console.log(`Nombre de postes électriques trouvés : ${substations.length}`);

  if (substations.length === 0) {
    console.error('Aucun poste électrique trouvé pour effectuer les connexions.');
    process.exit(1);
  }

  const connectionFeatures = [];

  // 3. Pour chaque datacenter, trouver le poste le plus proche
  datacenters.forEach(dc => {
    const dcCoords = dc.geometry.coordinates; // [lng, lat]
    const dcLng = dcCoords[0];
    const dcLat = dcCoords[1];

    let minDistance = Infinity;
    let closestSubstation = null;

    substations.forEach(sub => {
      const subCoords = sub.geometry.coordinates; // [lng, lat]
      const subLng = subCoords[0];
      const subLat = subCoords[1];

      const dist = haversine(dcLat, dcLng, subLat, subLng);
      if (dist < minDistance) {
        minDistance = dist;
        closestSubstation = sub;
      }
    });

    if (closestSubstation) {
      const subCoords = closestSubstation.geometry.coordinates;
      const distanceKm = minDistance / 1000.0;

      connectionFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [dcLng, dcLat],
            [subCoords[0], subCoords[1]]
          ]
        },
        properties: {
          datacenter_name: dc.properties?.NomSite || 'Inconnu',
          datacenter_id: dc.properties?.UNIQID,
          datacenter_type: dc.properties?.Type || 'Unknown',
          substation_name: closestSubstation.properties?.id || 'Inconnu',
          distance_km: distanceKm
        }
      });
    }
  });

  // 4. Générer le geojson final
  const outputGeojson = {
    type: 'FeatureCollection',
    metadata: {
      date: new Date().toISOString().slice(0, 10),
      source: 'Liaisons Datacenters -> Postes Hydro-Québec les plus proches'
    },
    features: connectionFeatures
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputGeojson, null, 2), 'utf8');
  console.log(`Succès : ${connectionFeatures.length} connexions générées et enregistrées dans ${outputPath}`);
}

main();
