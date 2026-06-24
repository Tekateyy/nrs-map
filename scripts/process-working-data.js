import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKING_DIR = path.join(__dirname, '../working-data/Datacenters');
const DEST_DIR = path.join(__dirname, '../data');

/**
 * Trouve le fichier le plus récent correspondant au motif regex fourni.
 * Le motif doit capturer la date au format YYYY-MM-DD dans son premier groupe de capture.
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
        return {
          filename: file,
          date: match[1] // Date YYYY-MM-DD
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
 * Copie un fichier du dossier working-data vers le dossier data
 * @param {string} srcName 
 * @param {string} destName 
 */
function copyFile(srcName, destName) {
  const srcPath = path.join(WORKING_DIR, srcName);
  const destPath = path.join(DEST_DIR, destName);
  
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
  }

  fs.copyFileSync(srcPath, destPath);
  console.log(`Copié : ${srcName} -> ${destName}`);
}

function main() {
  console.log('--- Traitement des données des Datacenters ---');
  
  // Fichiers datacenters_*.geojson
  const datacentersPattern = /^datacenters_(\d{4}-\d{2}-\d{2})\.geojson$/;
  const recentDatacenters = getMostRecentFile(datacentersPattern);
  
  if (recentDatacenters) {
    copyFile(recentDatacenters, 'datacenters.geojson');
  } else {
    console.warn('Aucun fichier datacenters_*.geojson trouvé.');
  }

  // Fichiers DCbati_poly_*.geojson
  const batiPattern = /^DCbati_poly_(\d{4}-\d{2}-\d{2})\.geojson$/;
  const recentBati = getMostRecentFile(batiPattern);
  
  if (recentBati) {
    copyFile(recentBati, 'DCbati_poly.geojson');
  } else {
    console.warn('Aucun fichier DCbati_poly_*.geojson trouvé.');
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
}

main();
