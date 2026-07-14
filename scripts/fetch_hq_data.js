import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger la clé API depuis .env
let apiKey = process.env.CODERS_API_KEY;
if (!apiKey) {
  try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^CODERS_API_KEY\s*=\s*([^\s#]+)/m);
      if (match) {
        apiKey = match[1].trim();
      }
    }
  } catch (err) {
    console.error('Erreur lors de la lecture du fichier .env:', err.message);
  }
}

if (!apiKey) {
  console.error('❌ Erreur : Clé CODERS_API_KEY introuvable dans le fichier .env ou l\'environnement.');
  process.exit(1);
}

const baseUrl = 'https://api.sesit.ca';
const outputDir = path.join(__dirname, '../working-data/Hydro-Quebec');

// Obtenir la date du jour au format YYYY-MM-DD
const today = new Date().toISOString().slice(0, 10);
const nodesOutFile = path.join(outputDir, `nodes_${today}.csv`);
const linesOutFile = path.join(outputDir, `transmission_lines_${today}.csv`);

async function run() {
  console.log('🚀 Début de la récupération des données Hydro depuis l\'API CODERS...');

  try {
    // 1. Récupérer les lignes de transmission pour le Québec (QC)
    console.log('Fetching transmission lines for QC...');
    const linesUrl = `${baseUrl}/transmission_lines?province=QC&key=${apiKey}`;
    const linesRes = await fetch(linesUrl);
    if (!linesRes.ok) {
      throw new Error(`Erreur API lignes : ${linesRes.status} ${linesRes.statusText}`);
    }
    const linesData = await linesRes.json();
    console.log(`✓ Récupéré ${linesData.length} lignes de transmission pour le Québec.`);

    // 2. Récupérer tous les nœuds et filtrer pour le Québec (QC)
    console.log('Fetching all nodes...');
    const nodesUrl = `${baseUrl}/nodes?key=${apiKey}`;
    const nodesRes = await fetch(nodesUrl);
    if (!nodesRes.ok) {
      throw new Error(`Erreur API nœuds : ${nodesRes.status} ${nodesRes.statusText}`);
    }
    const allNodes = await nodesRes.json();
    const qcNodes = allNodes.filter(node => node.province === 'QC');
    console.log(`✓ Récupéré ${qcNodes.length} nœuds pour le Québec (sur un total de ${allNodes.length} au Canada).`);

    // 3. Formater les nœuds sous format CSV similaire à l'original
    console.log('Formatting and saving nodes...');
    const formattedNodes = qcNodes.map(node => {
      return {
        node_name: node.node_name,
        node_name_source: 'API',
        node_code: node.node_code,
        node_code_source: 'API',
        node_type: node.node_type,
        node_type_source: 'API',
        owner: node.owner,
        owner_source: 'API',
        latitude: node.latitude,
        latitude_source: 'API',
        longitude: node.longitude,
        longitude_source: 'API',
        elevation: node.elevation,
        elevation_source: 'API',
        province: node.province,
        province_source: 'API',
        operating_region: node.operating_region,
        operating_region_source: 'API',
        copper_balancing_area: node.copper_balancing_area,
        copper_balancing_area_source: 'API',
        notes: node.notes || 'NULL',
        notes_source: 'API'
      };
    });

    const nodesCsv = Papa.unparse(formattedNodes);
    fs.writeFileSync(nodesOutFile, nodesCsv, 'utf8');
    console.log(`✓ Sauvegardé : ${nodesOutFile}`);

    // 4. Formater les lignes sous format CSV similaire à l'original
    console.log('Formatting and saving transmission lines...');
    const formattedLines = linesData.map(line => {
      return {
        transmission_line_id: line.transmission_line_id,
        transmission_line_id_source: 'API',
        transmission_circuit_id: line.transmission_circuit_id,
        transmission_circuit_id_source: 'API',
        owner: line.owner,
        owner_source: 'API',
        province: line.province,
        province_source: 'API',
        operating_region: line.operating_region,
        operating_region_source: 'API',
        number_of_circuits: line.number_of_circuits,
        number_of_circuits_source: 'API',
        current_type: line.current_type,
        current_type_source: 'API',
        line_segment_length_km: line.line_segment_length_km,
        line_segment_length_km_source: 'API',
        line_segment_length_mi: line.line_segment_length_mi,
        line_segment_length_mi_source: 'API',
        line_length_km: line.line_length_km,
        line_length_km_source: 'API',
        line_length_mi: line.line_length_mi,
        line_length_mi_source: 'API',
        voltage: line.voltage,
        voltage_source: 'API',
        Transmission_Line_Reactance: line.Transmission_Line_Reactance,
        Transmission_Line_Reactance_source: 'API',
        Transmission_Line_Segment_Reactance: line.Transmission_Line_Segment_Reactance,
        Transmission_Line_Segment_Reactance_source: 'API',
        ttc_summer: line.ttc_summer,
        ttc_summer_source: 'API',
        ttc_winter: line.ttc_winter,
        ttc_winter_source: 'API',
        network_node_name_starting: line.network_node_name_starting,
        network_node_name_starting_source: 'API',
        network_node_code_starting: line.network_node_code_starting,
        network_node_code_starting_source: 'API',
        network_node_name_ending: line.network_node_name_ending,
        network_node_name_ending_source: 'API',
        network_node_code_ending: line.network_node_code_ending,
        network_node_code_ending_source: 'API',
        notes: line.notes || 'NULL',
        notes_source: 'API'
      };
    });

    const linesCsv = Papa.unparse(formattedLines);
    fs.writeFileSync(linesOutFile, linesCsv, 'utf8');
    console.log(`✓ Sauvegardé : ${linesOutFile}`);

    console.log('🎉 Terminé avec succès !');

  } catch (error) {
    console.error('❌ Une erreur est survenue lors de la récupération des données :', error.message);
    process.exit(1);
  }
}

run();
