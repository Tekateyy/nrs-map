import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.join(__dirname, '../working-data/Datacenters/Datacenters_2026_07_01.csv');
const WORKING_DIR = path.join(__dirname, '../working-data/Datacenters');

// Déterminer la date cible à partir du nom du fichier CSV (ex: Datacenters_2026_07_01.csv -> 2026-07-01)
const csvBasename = path.basename(CSV_FILE);
const csvDateMatch = csvBasename.match(/Datacenters_(\d{4})_(\d{2})_(\d{2})/i);
const targetDate = csvDateMatch ? `${csvDateMatch[1]}-${csvDateMatch[2]}-${csvDateMatch[3]}` : '2026-07-01';

const GEOJSON_OUTPUT_FILE = path.join(WORKING_DIR, `datacenters_${targetDate}.geojson`);

/**
 * Trouve le fichier GeoJSON source le plus récent antérieur à la date cible.
 * @param {string} targetDate
 * @returns {string|null}
 */
function getSourceGeojsonFile(targetDate) {
  if (!fs.existsSync(WORKING_DIR)) return null;
  const files = fs.readdirSync(WORKING_DIR);
  const pattern = /^datacenters_(\d{4}-\d{2}-\d{2})\.geojson$/;
  const matched = files
    .map(file => {
      const match = file.match(pattern);
      return match ? { filename: file, date: match[1] } : null;
    })
    .filter(Boolean)
    .filter(item => item.date < targetDate);

  if (matched.length === 0) return null;
  matched.sort((a, b) => b.date.localeCompare(a.date));
  return path.join(WORKING_DIR, matched[0].filename);
}

const sourceFile = getSourceGeojsonFile(targetDate) || path.join(__dirname, '../data/datacenters.geojson');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Normalise le type du datacenter pour correspondre aux clés existantes.
 * @param {string} csvType 
 * @returns {string}
 */
function normalizeType(csvType) {
  if (!csvType) return 'Unknown';
  const typeStr = csvType.toLowerCase();
  if (typeStr.includes('retail')) return 'Retail';
  if (typeStr.includes('wholesale')) return 'Wholesale';
  if (typeStr.includes('hyperscale')) return 'Hyperscale';
  if (typeStr.includes('crypto')) return 'Crypto';
  if (typeStr.includes('quantique')) return 'Quantique';
  return 'Unknown';
}

/**
 * Nettoie les clés d'un objet parsed par Papa.parse pour harmoniser les retours à la ligne et espaces.
 * @param {Object} row 
 * @returns {Object}
 */
function cleanRowKeys(row) {
  const cleaned = {};
  for (const [key, val] of Object.entries(row)) {
    const cleanKey = key.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    cleaned[cleanKey] = val;
  }
  return cleaned;
}

/**
 * Analyse et convertit les nombres du CSV (avec espaces ou virgules décimales).
 * @param {string} val 
 * @returns {number|null}
 */
function parseNumber(val) {
  if (!val || val.trim() === '') return null;
  const cleaned = val.replace(/,/g, '.').replace(/[\s\u202f\u00a0]+/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normalise le format de la surface (remplace les espaces spéciaux par des espaces simples).
 * @param {string} val 
 * @returns {string|null}
 */
function formatSurface(val) {
  if (!val || val.trim() === '') return null;
  return val.replace(/[\s\u202f\u00a0]+/g, ' ').trim();
}

/**
 * Nettoie les noms de villes contenant des éléments parasites.
 * @param {string} name 
 * @returns {string}
 */
function cleanCityName(name) {
  if (!name) return '';
  if (name.toLowerCase().includes('escoumins')) return 'Les Escoumins';
  return name.trim();
}

/**
 * Nettoie un UNIQID en retirant les espaces et les points d'interrogation.
 * @param {string} id 
 * @returns {string}
 */
function cleanUniqId(id) {
  if (!id) return '';
  return id.replace(/\?+/g, '').trim();
}

/**
 * Effectue le géocodage d'une adresse à l'aide d'OpenStreetMap Nominatim.
 * @param {string} address 
 * @param {string} city 
 * @returns {Promise<Object|null>}
 */
async function geocodeAddress(address, city) {
  if (!address || address.trim() === '') {
    if (city && city.trim() !== '') {
      address = city;
    } else {
      return null;
    }
  }

  let query = address;
  if (city && !address.toLowerCase().includes(city.toLowerCase())) {
    query += `, ${city}`;
  }
  if (!query.toLowerCase().includes('quebec') && !query.toLowerCase().includes('québec')) {
    query += ', Québec';
  }
  if (!query.toLowerCase().includes('canada')) {
    query += ', Canada';
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'nrs-map-updater/1.0 (alexandre.theve@gmail.com)'
      }
    });

    if (!response.ok) {
      console.warn(`[Géocodage] Erreur HTTP ${response.status} pour la requête : "${query}"`);
      return null;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        display_name: result.display_name,
        postcode: result.address?.postcode || null
      };
    }

    // Essai de repli si l'adresse complète échoue, en cherchant uniquement par ville
    if (city && query !== `${city}, Québec, Canada`) {
      console.log(`[Géocodage] Adresse exacte non trouvée pour "${query}". Repli sur la ville : "${city}, Québec, Canada"...`);
      await sleep(1000);
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ', Québec, Canada')}&format=json&limit=1&addressdetails=1`;
      const fbResponse = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'nrs-map-updater/1.0 (alexandre.theve@gmail.com)'
        }
      });
      if (fbResponse.ok) {
        const fbData = await fbResponse.json();
        if (Array.isArray(fbData) && fbData.length > 0) {
          const result = fbData[0];
          return {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            display_name: result.display_name,
            postcode: result.address?.postcode || null
          };
        }
      }
    }

    console.warn(`[Géocodage] Aucun résultat trouvé pour la requête : "${query}"`);
    return null;
  } catch (error) {
    console.error(`[Géocodage] Erreur réseau/fetch pour "${query}":`, error.message);
    return null;
  }
}

async function main() {
  console.log('--- DÉBUT DE LA MISE À JOUR INC R É M E N T A L E ---');

  console.log(`Fichier source GeoJSON utilisé : ${sourceFile}`);
  // 1. Lire le GeoJSON actuel
  if (!fs.existsSync(sourceFile)) {
    console.error(`Fichier GeoJSON source introuvable : ${sourceFile}`);
    process.exit(1);
  }
  const geojson = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const features = geojson.features || [];

  // 2. Lire le CSV des nouveaux datacenters
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`Fichier CSV source introuvable : ${CSV_FILE}`);
    process.exit(1);
  }
  const csvData = fs.readFileSync(CSV_FILE, 'utf8');
  const parsed = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
  });
  const csvRows = parsed.data.map(cleanRowKeys);
  console.log(`Nombre de lignes lues depuis le CSV : ${csvRows.length}`);

  // Filtrer les features existantes pour ne garder que celles présentes dans le CSV (Option A)
  // On exclut également Hyper Bit Dogecoin Mining (HPBTQBC01) pour le moment.
  const csvUniqIds = new Set(csvRows.map(row => cleanUniqId(row["UNIQID (4code heb,3loc,2num)"])).filter(id => id && id !== 'HPBTQBC01'));
  const filteredFeatures = [];
  const seenUniqIds = new Set();

  features.forEach(f => {
    const cleanId = cleanUniqId(f.properties?.UNIQID);
    if (csvUniqIds.has(cleanId) && !seenUniqIds.has(cleanId)) {
      filteredFeatures.push(f);
      seenUniqIds.add(cleanId);
    } else {
      console.log(`[RETRAIT] Datacenter obsolète ou doublon retiré du GeoJSON : ${f.properties?.UNIQID} (${f.properties?.NomSite})`);
    }
  });
  geojson.features = filteredFeatures;

  // Créer un index des datacenters existants par UNIQID nettoyé et chercher l'OBJECTID max
  const featuresIndex = {};
  let maxObjectId = 0;
  filteredFeatures.forEach(f => {
    if (f.properties && f.properties.UNIQID) {
      featuresIndex[cleanUniqId(f.properties.UNIQID)] = f;
    }
    if (f.properties && typeof f.properties.OBJECTID === 'number') {
      if (f.properties.OBJECTID > maxObjectId) {
        maxObjectId = f.properties.OBJECTID;
      }
    }
  });

  console.log(`Nombre de datacenters existants dans le GeoJSON (après filtrage) : ${filteredFeatures.length}`);
  console.log(`OBJECTID max existant : ${maxObjectId}`);

  let updatedCoordsCount = 0;
  let addedCount = 0;

  const keys = csvRows.length > 0 ? Object.keys(csvRows[0]) : [];
  const shareholderNameKey = keys.find(k => k.toLowerCase().includes('shareholder') && k.toLowerCase().includes('nom')) || 'Nom du shareholders majoritaire';
  const shareholderNationKey = keys.find(k => k.toLowerCase().includes('shareholder') && k.toLowerCase().includes('nationalit')) || 'Nationalité des shareholders majoritaire';
  const siegeSocialKey = keys.find(k => k.toLowerCase().includes('siège social') || k.toLowerCase().includes('siege social')) || 'Localisation du siège social';

  // 3. Parcourir les lignes du CSV
  for (const row of csvRows) {
    const rawUniqId = row["UNIQID (4code heb,3loc,2num)"];
    if (!rawUniqId) {
      console.warn("Ligne CSV ignorée car UNIQID manquant:", row);
      continue;
    }
    const uniqId = cleanUniqId(rawUniqId);
    if (uniqId === 'HPBTQBC01') {
      console.log(`[EXCLUSION] Exclut Hyper Bit Dogecoin Mining (${uniqId})`);
      continue;
    }

    const existingFeature = featuresIndex[uniqId];
    if (existingFeature) {
      // Le datacenter existe déjà dans le GeoJSON
      const coords = existingFeature.geometry?.coordinates;
      const isEmptyCoords = !Array.isArray(coords) || coords.length < 2 || (coords[0] === null || coords[1] === null || coords[0] === undefined);

      if (isEmptyCoords) {
        console.log(`[EXISTANT] ${uniqId} (${existingFeature.properties.NomSite}) a des coordonnées vides. Géocodage en cours...`);
        const address = row["Adresse"] || existingFeature.properties.Adresse;
        const city = cleanCityName(row["Ville"] || existingFeature.properties.ville);

        await sleep(1000); // Respecter les limites Nominatim (1 req/sec)
        const geoResult = await geocodeAddress(address, city);
        if (geoResult) {
          existingFeature.geometry = {
            type: 'Point',
            coordinates: [geoResult.lon, geoResult.lat]
          };
          existingFeature.properties.display_na = geoResult.display_name;
          if (geoResult.postcode && (!existingFeature.properties.postcode || existingFeature.properties.postcode.trim() === '')) {
            existingFeature.properties.postcode = geoResult.postcode;
          }
          console.log(`[GÉOCODÉ] Coordonnées mises à jour pour ${uniqId} : [${geoResult.lon}, ${geoResult.lat}]`);
          updatedCoordsCount++;
        }
      }

      // Compléter les propriétés manquantes/nulles avec les données du CSV
      const props = existingFeature.properties;
      const updates = {
        NomSite: row["Nom du site"],
        Type: normalizeType(row["Type"]),
        Adresse: row["Adresse"] || row["Emplacement"],
        Pays: row["Pays"],
        PuissanceAnnMW: parseNumber(row["Puissance annoncée (MW)"]),
        ville: cleanCityName(row["Ville"]),
        Hebergeur: row["Hebergeur"],
        ÉquipIA: row["Équipé pour l'IA"] === 'IA' ? 'IA' : null,
        NombreBatiments: parseNumber(row["Nombre de batiments"]),
        SurfBatimentPI2: formatSurface(row["Surface - Batiment (PI2)"]),
        PUE: parseNumber(row["PUE"]),
        Siteweb: row["Site web"],
        FicheTechDocumentation: row["Fiche technique / documentation"],
        Source: row["Source"],
        ShareholderMaj: row[shareholderNameKey],
        NationaliteShareholder: row[shareholderNationKey],
        SiegeSocial: row[siegeSocialKey],
        Status: row["Status"] || "En opération"
      };

      for (const [key, newVal] of Object.entries(updates)) {
        props[key] = newVal;
      }
    } else {
      // Nouveau datacenter à ajouter
      console.log(`[NOUVEAU] Ajout du datacenter ${uniqId} (${row["Nom du site"]}). Géocodage de l'adresse...`);

      const address = row["Adresse"];
      const city = cleanCityName(row["Ville"]);

      await sleep(1000); // Respecter les limites Nominatim (1 req/sec)
      const geoResult = await geocodeAddress(address, city);

      let coordinates = [];
      let displayName = " ";
      let extractedPostcode = "";

      // Regex de repli pour extraire le code postal canadien de l'adresse si Nominatim ne le retourne pas
      const postcodeRegex = /[A-Z]\d[A-Z]\s?\d[A-Z]\d/i;
      const postcodeMatch = address ? address.match(postcodeRegex) : null;
      if (postcodeMatch) {
        extractedPostcode = postcodeMatch[0].toUpperCase();
      }

      if (geoResult) {
        coordinates = [geoResult.lon, geoResult.lat];
        displayName = geoResult.display_name;
        if (geoResult.postcode) {
          extractedPostcode = geoResult.postcode;
        }
      } else {
        console.warn(`[ATTENTION] Échec de géocodage pour le nouveau datacenter ${uniqId}`);
      }

      maxObjectId++;

      const newFeature = {
        type: "Feature",
        id: maxObjectId,
        geometry: {
          type: "Point",
          coordinates: coordinates
        },
        properties: {
          OBJECTID: maxObjectId,
          UNIQID: uniqId,
          NomSite: row["Nom du site"] || "Sans nom",
          Type: normalizeType(row["Type"]),
          Adresse: row["Adresse"] || row["Emplacement"] || "",
          Pays: row["Pays"] || "Canada",
          PuissanceAnnMW: parseNumber(row["Puissance annoncée (MW)"]),
          ville: cleanCityName(row["Ville"]),
          state: "Québec",
          country: row["Pays"] || "Canada",
          postcode: extractedPostcode,
          Hebergeur: row["Hebergeur"] || "Inconnu",
          ÉquipIA: row["Équipé pour l'IA"] === 'IA' ? 'IA' : null,
          NombreBatiments: parseNumber(row["Nombre de batiments"]),
          SurfBatimentPI2: formatSurface(row["Surface - Batiment (PI2)"]),
          NbServeursAnnoncé: null,
          PUE: parseNumber(row["PUE"]),
          Siteweb: row["Site web"] || null,
          FicheTechDocumentation: row["Fiche technique / documentation"] || null,
          Source: row["Source"] || null,
          display_na: displayName,
          date_collecte: targetDate,
          ShareholderMaj: row[shareholderNameKey] || null,
          NationaliteShareholder: row[shareholderNationKey] || null,
          SiegeSocial: row[siegeSocialKey] || null,
          Status: row["Status"] || "En opération"
        }
      };

      filteredFeatures.push(newFeature);
      featuresIndex[uniqId] = newFeature;
      console.log(`[NOUVEAU] Datacenter ${uniqId} créé avec l'OBJECTID : ${maxObjectId}`);
      addedCount++;
    }
  }

  // 4. Mettre à jour les métadonnées globales du GeoJSON
  if (!geojson.metadata) {
    geojson.metadata = {};
  }
  geojson.metadata.date = targetDate;
  geojson.metadata.source = `Mise à jour des centres de données de ${targetDate}`;

  // 5. Sauvegarder le fichier mis à jour
  console.log(`Sauvegarde du nouveau GeoJSON dans : ${GEOJSON_OUTPUT_FILE}`);
  fs.writeFileSync(GEOJSON_OUTPUT_FILE, JSON.stringify(geojson, null, 2), 'utf8');

  console.log('\n--- BILAN DE LA MISE À JOUR ---');
  console.log(`Nouveaux datacenters ajoutés : ${addedCount}`);
  console.log(`Datacenters existants géocodés : ${updatedCoordsCount}`);
  console.log(`Nombre total de datacenters : ${filteredFeatures.length}`);
}

main().catch(err => {
  console.error("Erreur inattendue :", err);
  process.exit(1);
});
