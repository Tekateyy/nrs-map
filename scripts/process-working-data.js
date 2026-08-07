import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKING_DIR = path.join(__dirname, '../working-data/Datacenters');
const DEST_DIR = path.join(__dirname, '../data');

/**
 * Convertit des coordonnées EPSG:3857 (Web Mercator en mètres) en EPSG:4326 (WGS84 en degrés [lon, lat]).
 */
function convert3857To4326(coords) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const x = coords[0];
    const y = coords[1];
    if (Math.abs(x) > 180 || Math.abs(y) > 90) {
      const lon = (x / 6378137.0) * (180 / Math.PI);
      const lat = (Math.atan(Math.exp(y / 6378137.0)) - Math.PI / 4) * 2 * (180 / Math.PI);
      return [lon, lat];
    }
    return [x, y];
  }
  return coords.map(convert3857To4326);
}

/**
 * Trouve le fichier le plus récent correspondant au motif regex fourni.
 * @param {RegExp} pattern 
 * @returns {string|null} Le nom du fichier le plus récent, ou null si aucun match
 */
function getMostRecentFile(pattern) {
  if (!fs.existsSync(WORKING_DIR)) {
    console.error(`Dossier source introuvable : ${WORKING_DIR}`);
    return null;
  }

  const files = fs.readdirSync(WORKING_DIR);
  
  const matchedFiles = files
    .map(file => {
      const match = file.match(pattern);
      if (match) {
        // Remplacer les tirets bas par des tirets hauts dans la date pour un tri uniforme
        const normalizedDate = match[1].replace(/_/g, '-');
        return {
          filename: file,
          date: normalizedDate
        };
      }
      return null;
    })
    .filter(Boolean);

  if (matchedFiles.length === 0) {
    return null;
  }

  // Tri par date décroissante
  matchedFiles.sort((a, b) => b.date.localeCompare(a.date));

  return matchedFiles[0].filename;
}

/**
 * Lit un fichier geojson, reprojette les coordonnées en WGS84 si nécessaire,
 * ajoute la date de collecte (à la racine et dans les propriétés de chaque entité),
 * et l'écrit dans le dossier de destination.
 * @param {string} srcName 
 * @param {string} destName 
 * @param {string} date 
 * @param {string} sourceName
 */
function processAndCopyGeojson(srcName, destName, date, sourceName) {
  const srcPath = path.join(WORKING_DIR, srcName);
  const destPath = path.join(DEST_DIR, destName);
  
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
  }

  const rawData = fs.readFileSync(srcPath, 'utf8');
  const geojson = JSON.parse(rawData);

  // Vérifier si une conversion EPSG:3857 -> EPSG:4326 est nécessaire
  const is3857 = geojson.crs?.properties?.name?.includes('3857');

  if (geojson.features && Array.isArray(geojson.features)) {
    geojson.features.forEach(feature => {
      if (!feature.properties) {
        feature.properties = {};
      }
      feature.properties.date_collecte = date;

      if (is3857 && feature.geometry && feature.geometry.coordinates) {
        feature.geometry.coordinates = convert3857To4326(feature.geometry.coordinates);
      }
    });
  }

  // Supprimer la clé crs si on a reprojeté en WGS84 standard
  if (is3857) {
    delete geojson.crs;
  }

  // Ajouter les métadonnées
  geojson.metadata = {
    date: date,
    source: sourceName
  };

  fs.writeFileSync(destPath, JSON.stringify(geojson, null, 2), 'utf8');
  console.log(`Traité et copié : ${srcName} -> ${destName} avec date ${date}${is3857 ? ' (reprojeté en WGS84)' : ''}`);
}

function main() {
  console.log('--- Traitement des données des Datacenters ---');
  
  // Fichiers DCbati_poly_*.geojson
  const batiPattern = /^DCbati_poly[-_](\d{4}[-_]\d{2}[-_]\d{2})\.geojson$/i;
  const recentBati = getMostRecentFile(batiPattern);
  const dcSurfaceMap = {};

  if (recentBati) {
    const match = recentBati.match(batiPattern);
    const date = match[1].replace(/_/g, '-');
    processAndCopyGeojson(recentBati, 'DCbati_poly.geojson', date, 'Empreinte bâtiments');

    // Calcul de la surface cumulative en pi² par centre de données (dcbat_dcid)
    try {
      const batiPath = path.join(WORKING_DIR, recentBati);
      const batiGeojson = JSON.parse(fs.readFileSync(batiPath, 'utf8'));
      if (batiGeojson.features && Array.isArray(batiGeojson.features)) {
        batiGeojson.features.forEach(f => {
          const dcId = f.properties?.dcbat_dcid || f.properties?.UNIQID;
          const surfSqFt = f.properties?.dcbat_areapi2 || (f.properties?.dcbat_areasqm ? f.properties.dcbat_areasqm * 10.76391 : 0);
          if (dcId && surfSqFt) {
            dcSurfaceMap[dcId] = (dcSurfaceMap[dcId] || 0) + Math.round(surfSqFt);
          }
        });
      }
    } catch (e) {
      console.warn('Impossible de lire les surfaces depuis DCbati_poly :', e.message);
    }
  } else {
    console.warn('Aucun fichier DCbati_poly_*.geojson trouvé.');
  }

  // Fichiers datacenters_*.geojson
  const datacentersPattern = /^datacenters[-_](\d{4}[-_]\d{2}[-_]\d{2})\.geojson$/i;
  const recentDatacenters = getMostRecentFile(datacentersPattern);
  
  if (recentDatacenters) {
    const match = recentDatacenters.match(datacentersPattern);
    const date = match[1].replace(/_/g, '-');

    // Charger et injecter la surface calculée dans datacenters.geojson
    const srcPath = path.join(WORKING_DIR, recentDatacenters);
    const destPath = path.join(DEST_DIR, 'datacenters.geojson');
    const rawData = fs.readFileSync(srcPath, 'utf8');
    const geojson = JSON.parse(rawData);

    const is3857 = geojson.crs?.properties?.name?.includes('3857');
    if (geojson.features && Array.isArray(geojson.features)) {
      geojson.features.forEach(feature => {
        if (!feature.properties) feature.properties = {};
        feature.properties.date_collecte = date;

        const dcId = feature.properties.dci_id || feature.properties.UNIQID;
        if (dcId && dcSurfaceMap[dcId]) {
          feature.properties.SurfBatimentPI2 = String(dcSurfaceMap[dcId]);
          feature.properties.dcbat_areapi2 = dcSurfaceMap[dcId];
        }

        if (is3857 && feature.geometry && feature.geometry.coordinates) {
          feature.geometry.coordinates = convert3857To4326(feature.geometry.coordinates);
        }
      });
    }
    if (is3857) delete geojson.crs;
    geojson.metadata = { date, source: 'Centres de données du Québec' };

    fs.writeFileSync(destPath, JSON.stringify(geojson, null, 2), 'utf8');
    console.log(`Traité et copié : ${recentDatacenters} -> datacenters.geojson avec date ${date}${is3857 ? ' (reprojeté en WGS84)' : ''}`);
  } else {
    console.warn('Aucun fichier datacenters_*.geojson trouvé.');
  }

  console.log('\n--- Traitement des données Hydro-Québec ---');
  const compileHqScript = path.join(__dirname, '../working-data/Hydro-Quebec/compile-hq.js');
  const hqDestFile = path.join(DEST_DIR, 'Hydro-Quebec.geojson');

  try {
    execSync(`node "${compileHqScript}" "${hqDestFile}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Erreur lors de la compilation des données Hydro-Québec :', error.message);
    process.exit(1);
  }

  console.log('\n--- Génération des connexions Datacenter -> Hydro-Québec ---');
  const generateConnectionsScript = path.join(__dirname, 'generate-connections.js');
  try {
    execSync(`node "${generateConnectionsScript}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Erreur lors de la génération des connexions :', error.message);
    process.exit(1);
  }
}

main();

