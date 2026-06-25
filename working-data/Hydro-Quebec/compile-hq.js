import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
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

console.log("Loading HQ Transmission Lines and Nodes CSV data...");

const nodesPath = path.join(__dirname, 'nodes_2026-06-17.csv');
const linesPath = path.join(__dirname, 'transmission_lines_2026-06-17.csv');

// Extracted date for metadata (from nodes file date if available, or today)
const dateMatch = path.basename(nodesPath).match(/_(\d{4}-\d{2}-\d{2})/);
const fileDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

if (!fs.existsSync(nodesPath) || !fs.existsSync(linesPath)) {
    console.error("Error: CSV source files not found.");
    process.exit(1);
}

// Read and parse nodes CSV
const nodesRaw = fs.readFileSync(nodesPath, 'utf8');
const parsedNodes = Papa.parse(nodesRaw, { header: true, skipEmptyLines: true });
const nodesMap = new Map();

parsedNodes.data.forEach((row, idx) => {
    const nodeCode = (row.node_code || '').trim();
    const nodeName = (row.node_name || '').trim();
    const nodeType = (row.node_type || '').trim();
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    const province = (row.province || '').trim();

    if (nodeCode && !isNaN(lat) && !isNaN(lng)) {
        nodesMap.set(nodeCode, {
            code: nodeCode,
            name: nodeName || nodeCode,
            type: nodeType || 'Unknown',
            lat,
            lng,
            province
        });
    }
});

console.log(`Loaded ${nodesMap.size} valid nodes.`);

// Read and parse transmission lines CSV
const linesRaw = fs.readFileSync(linesPath, 'utf8');
const parsedLines = Papa.parse(linesRaw, { header: true, skipEmptyLines: true });

const compiledFeatures = [];
const referencedNodes = new Set();
const nodeMaxVoltage = {};

console.log("Processing transmission lines...");
let lineFeaturesCount = 0;

parsedLines.data.forEach((row, index) => {
    const voltageVal = parseInt(row.voltage, 10);

    const startCode = (row.network_node_code_starting || '').trim();
    const endCode = (row.network_node_code_ending || '').trim();

    if (!startCode || !endCode) {
        return; // Skip if nodes are missing
    }

    const startNode = nodesMap.get(startCode);
    const endNode = nodesMap.get(endCode);

    if (!startNode || !endNode) {
        // Warning if referenced nodes are missing coordinates
        console.warn(`Warning line index ${index}: missing node details for ${startCode} or ${endCode}`);
        return;
    }

    // Keep track of referenced nodes and their max voltage
    referencedNodes.add(startCode);
    referencedNodes.add(endCode);
    nodeMaxVoltage[startCode] = Math.max(nodeMaxVoltage[startCode] || 0, voltageVal);
    nodeMaxVoltage[endCode] = Math.max(nodeMaxVoltage[endCode] || 0, voltageVal);

    const pathCoords = [
        [startNode.lat, startNode.lng],
        [endNode.lat, endNode.lng]
    ];

    const nodes = [];
    nodes.push(pathCoords[0]);
    nodes.push(pathCoords[1]);

    const currentType = (row.current_type || '').trim().toLowerCase();
    const poleString = currentType === 'dc' ? `${voltageVal} kV CC` : `${voltageVal} kV`;
    const circuitId = (row.transmission_circuit_id || '').trim() || `Ligne_${row.transmission_line_id || index}`;

    compiledFeatures.push({
        type: "Feature",
        properties: {
            id: circuitId,
            pole: poleString,
            nodes: nodes,
            isLine: true,
            isPoint: false,
            date_collecte: fileDate
        },
        geometry: {
            type: "LineString",
            coordinates: pathCoords.map(coord => [coord[1], coord[0]]) // GeoJSON requires [lon, lat]
        }
    });
    lineFeaturesCount++;
});

console.log(`Processed ${lineFeaturesCount} high-voltage lines.`);

// Generate Point features for referenced nodes
console.log(`Generating Point features for ${referencedNodes.size} referenced nodes...`);
referencedNodes.forEach(nodeCode => {
    const node = nodesMap.get(nodeCode);
    if (!node) return;

    const maxVoltage = nodeMaxVoltage[nodeCode] || 0;
    const poleString = maxVoltage > 0 ? `${node.type} (${maxVoltage} kV)` : node.type;

    compiledFeatures.push({
        type: "Feature",
        properties: {
            id: node.name,
            pole: poleString,
            node_type: node.type,
            nodes: [[node.lat, node.lng]],
            isLine: false,
            isPoint: true,
            date_collecte: fileDate
        },
        geometry: {
            type: "Point",
            coordinates: [node.lng, node.lat] // GeoJSON requires [lon, lat]
        }
    });
});

const outputPath = process.argv[2] || path.join(__dirname, './Hydro-Quebec.geojson');
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const geojson = {
    type: "FeatureCollection",
    metadata: {
        date: fileDate,
        source: "Lignes haute tension Hydro-Québec"
    },
    features: compiledFeatures
};

fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2), 'utf8');
console.log(`Successfully compiled ${compiledFeatures.length} features (lines & nodes) and saved as GeoJSON to ${outputPath}`);
