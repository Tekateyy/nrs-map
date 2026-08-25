import pg from 'pg';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT_DIR, 'diff_report.md');

// ANSI Color helper for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/14LnRHKVt2F_BiKIOY6n-rVMXTIabJaoE72PZ00F4CF4/export?format=xlsx';

function cleanStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseCode(val) {
  const str = cleanStr(val);
  if (!str) return '';
  if (str.includes(' - ')) {
    return str.split(' - ')[0].trim();
  }
  return str;
}

function parseType(val) {
  const str = cleanStr(val).toLowerCase();
  if (str.includes('retail')) return 'Retail';
  if (str.includes('wholesale')) return 'Wholesale';
  if (str.includes('hyperscale')) return 'Hyperscale';
  if (str.includes('crypto')) return 'Crypto';
  if (str.includes('quantique')) return 'Quantique';
  if (str.includes('unkown') || str.includes('inconnu')) return 'Unknown';
  return cleanStr(val);
}

function normalizeUrl(url) {
  let str = cleanStr(url);
  if (!str || str === '-') return '';
  if (str.endsWith('/')) str = str.slice(0, -1);
  return str;
}

function parseBool(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  const str = String(val).trim().toLowerCase();
  return ['true', 'vrai', 'oui', '1', 'o', 'ia', 'equipe', 'équipé'].includes(str);
}

function parseNum(val) {
  if (val === null || val === undefined) return null;
  const num = parseFloat(cleanStr(val).replace(',', '.'));
  return isNaN(num) ? null : num;
}

function areNumsEqual(n1, n2) {
  if (n1 === null && n2 === null) return true;
  if (n1 === null || n2 === null) return false;
  return Math.abs(n1 - n2) < 0.001;
}

async function fetchGoogleSheetWorkbook() {
  console.log(`${colors.cyan}📥 Téléchargement des données Google Sheet...${colors.reset}`);
  const response = await fetch(GOOGLE_SHEET_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!response.ok) {
    throw new Error(`Échec du téléchargement Google Sheet: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return XLSX.read(buffer, { type: 'buffer' });
}

async function runComparison() {
  const startTime = new Date();
  console.log(`\n${colors.bold}${colors.blue}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}  COMPARATEUR GOOGLE SHEET vs POSTGRESQL (Schéma v0)${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}====================================================${colors.reset}\n`);

  // 1. Connect DB
  const client = new pg.Client(DB_CONFIG);
  try {
    await client.connect();
    console.log(`${colors.green}✓ Connexion réussie à PostgreSQL (${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database})${colors.reset}`);
  } catch (err) {
    console.error(`${colors.red}❌ Erreur de connexion PostgreSQL:${colors.reset}`, err.message);
    process.exit(1);
  }

  // 2. Fetch Workbook
  let workbook;
  try {
    workbook = await fetchGoogleSheetWorkbook();
    console.log(`${colors.green}✓ Classeur Google Sheet chargé (${workbook.SheetNames.length} onglets)${colors.reset}\n`);
  } catch (err) {
    console.error(`${colors.red}❌ Erreur lors du chargement du Google Sheet:${colors.reset}`, err.message);
    await client.end();
    process.exit(1);
  }

  const reportSections = [];
  reportSections.push(`# Rapport de Comparaison : Google Sheet vs PostgreSQL (v0)`);
  reportSections.push(`*Généré le : ${startTime.toLocaleString('fr-CA')}*\n`);
  reportSections.push(`> [!NOTE]\n> Ce rapport récapitule les divergences d'information entre le Google Sheet (source de vérité) et les tables du schéma \`v0\` de la base de données PostgreSQL.\n`);

  let totalDiffCount = 0;
  let totalMissingGSCount = 0;
  let totalMissingDBCount = 0;

  // ---------------------------------------------------------
  // HEBERGEURS MAP BUILDING (for resolving names to heb_nomcourt)
  // ---------------------------------------------------------
  const hebSheet = workbook.Sheets['Hebergeurs'];
  const hebRows = XLSX.utils.sheet_to_json(hebSheet, { defval: null });
  const hebNameToCodeMap = new Map();
  hebRows.forEach(r => {
    const code = cleanStr(r['code pour ID']);
    const name = cleanStr(r['Nom hebergeur']);
    if (code && name) {
      hebNameToCodeMap.set(name.toLowerCase(), code);
      hebNameToCodeMap.set(code.toLowerCase(), code);
    }
  });

  // ---------------------------------------------------------
  // 1. TABLE v0.datacenter vs "Datacenters - colocation & Hype"
  // ---------------------------------------------------------
  console.log(`${colors.bold}${colors.yellow}🔍 1. Comparaison TABLE v0.datacenter${colors.reset}`);
  const dcSheet = workbook.Sheets['Datacenters - colocation & Hype'];
  const dcGSRows = XLSX.utils.sheet_to_json(dcSheet, { defval: null });
  
  const dbDCRes = await client.query('SELECT dc_id, dc_nom, dc_type, dc_hebid, dc_status, dc_ville, dc_an_meservice, dc_pui_annonc, dc_ia, dc_pue_annonc FROM v0.datacenter');
  const dbDCMap = new Map();
  dbDCRes.rows.forEach(r => {
    dbDCMap.set(cleanStr(r.dc_id), r);
  });

  const gsDCMap = new Map();
  dcGSRows.forEach(r => {
    const dc_id = cleanStr(r['dc UNIQID']);
    if (dc_id) gsDCMap.set(dc_id, r);
  });

  const dcDiffs = [];
  const dcMissingInDB = [];
  const dcMissingInGS = [];

  for (const [dc_id, gsRow] of gsDCMap.entries()) {
    if (!dbDCMap.has(dc_id)) {
      dcMissingInDB.push(dc_id);
      totalMissingDBCount++;
      continue;
    }

    const dbRow = dbDCMap.get(dc_id);
    const fieldDiffs = [];

    // dc_nom
    const gsNom = cleanStr(gsRow['Nom du site']);
    const dbNom = cleanStr(dbRow.dc_nom);
    if (gsNom !== dbNom) {
      fieldDiffs.push({ field: 'dc_nom', gs: gsNom, db: dbNom });
    }

    // dc_type
    const gsType = parseType(gsRow['Type']);
    const dbType = parseType(dbRow.dc_type);
    if (gsType.toLowerCase() !== dbType.toLowerCase()) {
      fieldDiffs.push({ field: 'dc_type', gs: gsType, db: dbType });
    }

    // dc_hebid
    const gsHebRaw = cleanStr(gsRow['Hebergeur']);
    let gsHebCode = hebNameToCodeMap.get(gsHebRaw.toLowerCase()) || parseCode(gsHebRaw);
    const dbHebCode = cleanStr(dbRow.dc_hebid);
    if (gsHebCode.toLowerCase() !== dbHebCode.toLowerCase()) {
      fieldDiffs.push({ field: 'dc_hebid', gs: gsHebCode, db: dbHebCode });
    }

    // dc_status
    const gsStatus = parseCode(gsRow['Status']);
    const dbStatus = cleanStr(dbRow.dc_status);
    if (gsStatus.toLowerCase() !== dbStatus.toLowerCase()) {
      fieldDiffs.push({ field: 'dc_status', gs: gsStatus, db: dbStatus });
    }

    // dc_ville
    const gsVille = parseCode(gsRow['Ville']);
    const dbVille = cleanStr(dbRow.dc_ville);
    if (gsVille.toLowerCase() !== dbVille.toLowerCase()) {
      fieldDiffs.push({ field: 'dc_ville', gs: gsVille, db: dbVille });
    }

    // dc_an_meservice
    const gsAn = cleanStr(gsRow['Mise en service']);
    const dbAn = cleanStr(dbRow.dc_an_meservice);
    if (gsAn && dbAn && gsAn !== dbAn) {
      fieldDiffs.push({ field: 'dc_an_meservice', gs: gsAn, db: dbAn });
    }

    // dc_pui_annonc
    const gsPui = parseNum(gsRow['Puissance annoncée (MW)']);
    const dbPui = parseNum(dbRow.dc_pui_annonc);
    if (!areNumsEqual(gsPui, dbPui)) {
      fieldDiffs.push({ field: 'dc_pui_annonc', gs: gsPui ?? 'NULL', db: dbPui ?? 'NULL' });
    }

    // dc_ia
    const gsIA = parseBool(gsRow["Équipé pour l'IA"]);
    const dbIA = parseBool(dbRow.dc_ia);
    if (gsIA !== dbIA) {
      fieldDiffs.push({ field: 'dc_ia', gs: gsIA, db: dbIA });
    }

    if (fieldDiffs.length > 0) {
      dcDiffs.push({ dc_id, fieldDiffs });
      totalDiffCount += fieldDiffs.length;
    }
  }

  for (const db_id of dbDCMap.keys()) {
    if (!gsDCMap.has(db_id)) {
      dcMissingInGS.push(db_id);
      totalMissingGSCount++;
    }
  }

  console.log(`  └─ Total Datacenters GS: ${gsDCMap.size} | DB: ${dbDCMap.size}`);
  console.log(`  └─ Manquants en DB: ${colors.red}${dcMissingInDB.length}${colors.reset} | Manquants dans GS: ${colors.yellow}${dcMissingInGS.length}${colors.reset} | Datacenters avec divergences: ${colors.magenta}${dcDiffs.length}${colors.reset}\n`);

  // Print DC diff details
  if (dcMissingInDB.length > 0) {
    console.log(`  ${colors.red}❌ Datacenters présents dans Google Sheet mais ABSENTS de la DB:${colors.reset}`);
    dcMissingInDB.forEach(id => console.log(`     • ${id}`));
  }
  if (dcDiffs.length > 0) {
    console.log(`  ${colors.yellow}⚠️ Divergences de métadonnées pour v0.datacenter:${colors.reset}`);
    dcDiffs.forEach(d => {
      console.log(`     [${colors.cyan}${d.dc_id}${colors.reset}]`);
      d.fieldDiffs.forEach(f => {
        console.log(`       - ${colors.bold}${f.field}${colors.reset}: GS = "${colors.green}${f.gs}${colors.reset}" vs DB = "${colors.red}${f.db}${colors.reset}"`);
      });
    });
  }

  // ---------------------------------------------------------
  // 2. TABLE v0.hebergeur vs "Hebergeurs"
  // ---------------------------------------------------------
  console.log(`\n${colors.bold}${colors.yellow}🔍 2. Comparaison TABLE v0.hebergeur${colors.reset}`);
  const dbHebRes = await client.query('SELECT heb_nomcourt, heb_nom, heb_siteweb, heb_majsh_name, heb_majsh_nat, heb_siegesoc_loc, heb_siegesoc_pays FROM v0.hebergeur');
  const dbHebMap = new Map();
  dbHebRes.rows.forEach(r => dbHebMap.set(cleanStr(r.heb_nomcourt), r));

  const gsHebMap = new Map();
  hebRows.forEach(r => {
    const code = cleanStr(r['code pour ID']);
    if (code) gsHebMap.set(code, r);
  });

  const hebDiffs = [];
  const hebMissingInDB = [];
  const hebMissingInGS = [];

  for (const [code, gsRow] of gsHebMap.entries()) {
    if (!dbHebMap.has(code)) {
      hebMissingInDB.push(code);
      totalMissingDBCount++;
      continue;
    }
    const dbRow = dbHebMap.get(code);
    const fieldDiffs = [];

    const gsNom = cleanStr(gsRow['Nom hebergeur']);
    const dbNom = cleanStr(dbRow.heb_nom);
    if (gsNom !== dbNom) fieldDiffs.push({ field: 'heb_nom', gs: gsNom, db: dbNom });

    const gsWeb = normalizeUrl(gsRow['Site web']);
    const dbWeb = normalizeUrl(dbRow.heb_siteweb);
    if (gsWeb !== dbWeb) fieldDiffs.push({ field: 'heb_siteweb', gs: gsWeb || '-', db: dbWeb || '-' });

    const gsShName = cleanStr(gsRow['Nom du shareholders majoritaire']);
    const dbShName = cleanStr(dbRow.heb_majsh_name);
    if (gsShName && dbShName && gsShName !== dbShName) fieldDiffs.push({ field: 'heb_majsh_name', gs: gsShName, db: dbShName });

    const gsShNat = cleanStr(gsRow['Nationalité des shareholders']);
    const dbShNat = cleanStr(dbRow.heb_majsh_nat);
    if (gsShNat && dbShNat && gsShNat !== dbShNat) fieldDiffs.push({ field: 'heb_majsh_nat', gs: gsShNat, db: dbShNat });

    const gsLoc = cleanStr(gsRow['Localisation du siège social']);
    const dbLoc = cleanStr(dbRow.heb_siegesoc_loc);
    if (gsLoc && dbLoc && gsLoc !== dbLoc) fieldDiffs.push({ field: 'heb_siegesoc_loc', gs: gsLoc, db: dbLoc });

    if (fieldDiffs.length > 0) {
      hebDiffs.push({ code, fieldDiffs });
      totalDiffCount += fieldDiffs.length;
    }
  }

  for (const code of dbHebMap.keys()) {
    if (!gsHebMap.has(code)) {
      hebMissingInGS.push(code);
      totalMissingGSCount++;
    }
  }

  console.log(`  └─ Total Hébergeurs GS: ${gsHebMap.size} | DB: ${dbHebMap.size}`);
  console.log(`  └─ Manquants en DB: ${colors.red}${hebMissingInDB.length}${colors.reset} | Hébergeurs avec divergences: ${colors.magenta}${hebDiffs.length}${colors.reset}\n`);

  if (hebDiffs.length > 0) {
    hebDiffs.forEach(d => {
      console.log(`     [${colors.cyan}${d.code}${colors.reset}]`);
      d.fieldDiffs.forEach(f => {
        console.log(`       - ${colors.bold}${f.field}${colors.reset}: GS = "${colors.green}${f.gs}${colors.reset}" vs DB = "${colors.red}${f.db}${colors.reset}"`);
      });
    });
  }

  // ---------------------------------------------------------
  // 3. TABLE v0.ville vs "expCSV-Villes"
  // ---------------------------------------------------------
  console.log(`\n${colors.bold}${colors.yellow}🔍 3. Comparaison TABLE v0.ville${colors.reset}`);
  const villeSheet = workbook.Sheets['expCSV-Villes'];
  const villeGSRows = XLSX.utils.sheet_to_json(villeSheet, { defval: null });
  const dbVilleRes = await client.query('SELECT ville_nomcourt, ville_name, ville_regionadm, ville_prov, ville_pays FROM v0.ville');
  const dbVilleMap = new Map();
  dbVilleRes.rows.forEach(r => dbVilleMap.set(cleanStr(r.ville_nomcourt), r));

  const gsVilleMap = new Map();
  villeGSRows.forEach(r => {
    const code = cleanStr(r['ville_nomcourt']);
    if (code) gsVilleMap.set(code, r);
  });

  const villeDiffs = [];
  for (const [code, gsRow] of gsVilleMap.entries()) {
    if (!dbVilleMap.has(code)) continue;
    const dbRow = dbVilleMap.get(code);
    const fieldDiffs = [];

    const gsName = cleanStr(gsRow['ville_name']);
    const dbName = cleanStr(dbRow.ville_name);
    if (gsName !== dbName) fieldDiffs.push({ field: 'ville_name', gs: gsName, db: dbName });

    const gsReg = cleanStr(gsRow['ville_regionadm']);
    const dbReg = cleanStr(dbRow.ville_regionadm);
    if (gsReg !== dbReg) fieldDiffs.push({ field: 'ville_regionadm', gs: gsReg, db: dbReg });

    if (fieldDiffs.length > 0) {
      villeDiffs.push({ code, fieldDiffs });
      totalDiffCount += fieldDiffs.length;
    }
  }

  console.log(`  └─ Total Villes GS: ${gsVilleMap.size} | DB: ${dbVilleMap.size}`);
  console.log(`  └─ Villes avec divergences: ${colors.magenta}${villeDiffs.length}${colors.reset}\n`);

  // ---------------------------------------------------------
  // 4. TABLE v0.dcpt vs "expCSV-pt_geocod"
  // ---------------------------------------------------------
  console.log(`${colors.bold}${colors.yellow}🔍 4. Comparaison TABLE v0.dcpt${colors.reset}`);
  const dcptSheet = workbook.Sheets['expCSV-pt_geocod'];
  const dcptGSRows = XLSX.utils.sheet_to_json(dcptSheet, { defval: null });
  const dbDcptRes = await client.query('SELECT dcpt_dcid, dcpt_adresse, dcpt_ville, dcpt_pays FROM v0.dcpt');
  const dbDcptMap = new Map();
  dbDcptRes.rows.forEach(r => dbDcptMap.set(cleanStr(r.dcpt_dcid), r));

  const gsDcptMap = new Map();
  dcptGSRows.forEach(r => {
    const dcid = cleanStr(r['dcpt_dcid']);
    if (dcid) gsDcptMap.set(dcid, r);
  });

  const dcptDiffs = [];
  for (const [dcid, gsRow] of gsDcptMap.entries()) {
    if (!dbDcptMap.has(dcid)) continue;
    const dbRow = dbDcptMap.get(dcid);
    const fieldDiffs = [];

    const gsAdr = cleanStr(gsRow['dcpt_adresse']);
    const dbAdr = cleanStr(dbRow.dcpt_adresse);
    if (gsAdr !== dbAdr) fieldDiffs.push({ field: 'dcpt_adresse', gs: gsAdr, db: dbAdr });

    if (fieldDiffs.length > 0) {
      dcptDiffs.push({ dcid, fieldDiffs });
      totalDiffCount += fieldDiffs.length;
    }
  }

  console.log(`  └─ Total Points GS: ${gsDcptMap.size} | DB: ${dbDcptMap.size}`);
  console.log(`  └─ Points avec divergences: ${colors.magenta}${dcptDiffs.length}${colors.reset}\n`);

  // ---------------------------------------------------------
  // 5. Comparaison INTERNE DB: v0.datacenter vs v0.dcpt
  // ---------------------------------------------------------
  console.log(`${colors.bold}${colors.yellow}🔍 5. Comparaison INTERNE DB: v0.datacenter vs v0.dcpt${colors.reset}`);
  const internalRes = await client.query(`
    SELECT 
      dc.dc_id,
      dc.dc_nom,
      dc.dc_hebid,
      dc.dc_status,
      dc.dc_ville AS dc_ville_code,
      v.ville_name AS dc_ville_nom,
      dcpt.dcpt_dcid,
      dcpt.dcpt_villecode,
      dcpt.dcpt_ville,
      dcpt.dcpt_adresse,
      dcpt.dcpt_adressefull,
      dcpt.dcpt_pays
    FROM v0.datacenter dc
    FULL OUTER JOIN v0.dcpt dcpt ON TRIM(dc.dc_id) = TRIM(dcpt.dcpt_dcid)
    LEFT JOIN v0.ville v ON TRIM(dc.dc_ville) = TRIM(v.ville_nomcourt)
    ORDER BY dc.dc_id, dcpt.dcpt_dcid
  `);

  const norm = (s) => cleanStr(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’\- ]/g, '');

  const dcMissingInDcpt = [];
  const dcptMissingInDC = [];
  const dcDcptDiffs = [];

  internalRes.rows.forEach(r => {
    const dcId = cleanStr(r.dc_id);
    const dcptId = cleanStr(r.dcpt_dcid);

    if (dcId && !dcptId) {
      dcMissingInDcpt.push({
        id: dcId,
        nom: cleanStr(r.dc_nom),
        hebid: cleanStr(r.dc_hebid),
        villeCode: cleanStr(r.dc_ville_code),
        villeNom: cleanStr(r.dc_ville_nom)
      });
      return;
    }

    if (!dcId && dcptId) {
      dcptMissingInDC.push({
        id: dcptId,
        adresse: cleanStr(r.dcpt_adresse),
        ville: cleanStr(r.dcpt_ville)
      });
      return;
    }

    // Present in both -> Compare data
    const diffs = [];
    const dcVCode = cleanStr(r.dc_ville_code);
    const ptVCode = cleanStr(r.dcpt_villecode);
    const dcVNom = cleanStr(r.dc_ville_nom);
    const ptVNom = cleanStr(r.dcpt_ville);

    if (ptVCode && dcVCode.toLowerCase() !== ptVCode.toLowerCase()) {
      diffs.push({
        field: 'Code Ville (dc_ville vs dcpt_villecode)',
        dcVal: dcVCode,
        dcptVal: ptVCode
      });
    }

    if (dcVNom && ptVNom && norm(dcVNom) !== norm(ptVNom)) {
      diffs.push({
        field: 'Nom Ville (v0.ville vs dcpt_ville)',
        dcVal: dcVNom,
        dcptVal: ptVNom
      });
    }

    if (diffs.length > 0) {
      dcDcptDiffs.push({
        dc_id: dcId,
        dc_nom: cleanStr(r.dc_nom),
        diffs
      });
    }
  });

  console.log(`  └─ Total Datacenters en DB: ${dbDCMap.size} | Points Géoloc en DB: ${dbDcptMap.size}`);
  console.log(`  └─ Présents dans datacenter mais ABSENTS de dcpt: ${colors.red}${dcMissingInDcpt.length}${colors.reset}`);
  console.log(`  └─ Présents dans dcpt mais ABSENTS de datacenter: ${colors.yellow}${dcptMissingInDC.length}${colors.reset}`);
  console.log(`  └─ Datacenters avec divergences de données (datacenter vs dcpt): ${colors.magenta}${dcDcptDiffs.length}${colors.reset}\n`);

  if (dcMissingInDcpt.length > 0) {
    console.log(`  ${colors.red}❌ Datacenters dans v0.datacenter mais ABSENTS de v0.dcpt:${colors.reset}`);
    dcMissingInDcpt.forEach(item => {
      console.log(`     • ${colors.bold}${item.id}${colors.reset} - ${item.nom} (${item.villeNom || item.villeCode})`);
    });
    console.log('');
  }

  if (dcDcptDiffs.length > 0) {
    console.log(`  ${colors.yellow}⚠️ Divergences de données entre v0.datacenter et v0.dcpt:${colors.reset}`);
    dcDcptDiffs.forEach(item => {
      console.log(`     [${colors.cyan}${item.dc_id}${colors.reset}] ${item.dc_nom}`);
      item.diffs.forEach(d => {
        console.log(`       - ${colors.bold}${d.field}${colors.reset}: datacenter = "${colors.green}${d.dcVal}${colors.reset}" vs dcpt = "${colors.red}${d.dcptVal}${colors.reset}"`);
      });
    });
    console.log('');
  }

  // ---------------------------------------------------------
  // WRITE MARKDOWN REPORT
  // ---------------------------------------------------------
  reportSections.push(`## Synthèse Globale\n`);
  reportSections.push(`- **Total des divergences de champs détectées (GS vs DB)** : \`${totalDiffCount}\``);
  reportSections.push(`- **Éléments manquants en Base de données (GS vs DB)** : \`${totalMissingDBCount}\``);
  reportSections.push(`- **Éléments manquants dans le Google Sheet** : \`${totalMissingGSCount}\``);
  reportSections.push(`- **Datacenters sans point géocodé (v0.datacenter sans v0.dcpt)** : \`${dcMissingInDcpt.length}\`\n`);

  reportSections.push(`### 1. Table \`v0.datacenter\` vs Onglet \`Datacenters - colocation & Hype\``);
  if (dcMissingInDB.length > 0) {
    reportSections.push(`#### 🔴 Data centers présents dans Google Sheet mais ABSENTS de la DB (${dcMissingInDB.length}):`);
    dcMissingInDB.forEach(id => reportSections.push(`- \`${id}\``));
    reportSections.push(``);
  }
  if (dcMissingInGS.length > 0) {
    reportSections.push(`#### 🟡 Data centers présents en DB mais ABSENTS du Google Sheet (${dcMissingInGS.length}):`);
    dcMissingInGS.forEach(id => reportSections.push(`- \`${id}\``));
    reportSections.push(``);
  }
  if (dcDiffs.length > 0) {
    reportSections.push(`#### ⚠️ Divergences de champs (${dcDiffs.length} sites impactés):`);
    reportSections.push(`| DC ID | Champ | Valeur Google Sheet | Valeur DB PostgreSQL |`);
    reportSections.push(`|---|---|---|---|`);
    dcDiffs.forEach(d => {
      d.fieldDiffs.forEach(f => {
        reportSections.push(`| \`${d.dc_id}\` | \`${f.field}\` | \`${f.gs}\` | \`${f.db}\` |`);
      });
    });
    reportSections.push(``);
  } else {
    reportSections.push(`✓ Aucune divergence de champ détectée sur \`v0.datacenter\`.\n`);
  }

  reportSections.push(`### 2. Table \`v0.hebergeur\` vs Onglet \`Hebergeurs\``);
  if (hebMissingInDB.length > 0) {
    reportSections.push(`#### 🔴 Hébergeurs dans Google Sheet mais ABSENTS de la DB (${hebMissingInDB.length}):`);
    hebMissingInDB.forEach(code => reportSections.push(`- \`${code}\``));
    reportSections.push(``);
  }
  if (hebMissingInGS.length > 0) {
    reportSections.push(`#### 🟡 Hébergeurs en DB mais ABSENTS du Google Sheet (${hebMissingInGS.length}):`);
    hebMissingInGS.forEach(code => reportSections.push(`- \`${code}\``));
    reportSections.push(``);
  }
  if (hebDiffs.length > 0) {
    reportSections.push(`| Code Hébergeur | Champ | Valeur Google Sheet | Valeur DB PostgreSQL |`);
    reportSections.push(`|---|---|---|---|`);
    hebDiffs.forEach(d => {
      d.fieldDiffs.forEach(f => {
        reportSections.push(`| \`${d.code}\` | \`${f.field}\` | \`${f.gs}\` | \`${f.db}\` |`);
      });
    });
    reportSections.push(``);
  } else {
    reportSections.push(`✓ Aucune divergence détectée sur \`v0.hebergeur\`.\n`);
  }

  reportSections.push(`### 3. Table \`v0.ville\` vs Onglet \`expCSV-Villes\``);
  if (villeDiffs.length > 0) {
    reportSections.push(`| Code Ville | Champ | Valeur Google Sheet | Valeur DB PostgreSQL |`);
    reportSections.push(`|---|---|---|---|`);
    villeDiffs.forEach(d => {
      d.fieldDiffs.forEach(f => {
        reportSections.push(`| \`${d.code}\` | \`${f.field}\` | \`${f.gs}\` | \`${f.db}\` |`);
      });
    });
    reportSections.push(``);
  } else {
    reportSections.push(`✓ Aucune divergence détectée sur \`v0.ville\`.\n`);
  }

  reportSections.push(`### 4. Table \`v0.dcpt\` vs Onglet \`expCSV-pt_geocod\``);
  if (dcptDiffs.length > 0) {
    reportSections.push(`| DC ID | Champ | Valeur Google Sheet | Valeur DB PostgreSQL |`);
    reportSections.push(`|---|---|---|---|`);
    dcptDiffs.forEach(d => {
      d.fieldDiffs.forEach(f => {
        reportSections.push(`| \`${d.dcid}\` | \`${f.field}\` | \`${f.gs}\` | \`${f.db}\` |`);
      });
    });
    reportSections.push(``);
  } else {
    reportSections.push(`✓ Aucune divergence détectée sur \`v0.dcpt\`.\n`);
  }

  reportSections.push(`### 5. Cohérence interne Base de données : \`v0.datacenter\` vs \`v0.dcpt\``);
  if (dcMissingInDcpt.length > 0) {
    reportSections.push(`#### 🔴 Datacenters présents dans \`v0.datacenter\` mais ABSENTS de \`v0.dcpt\` (non géolocalisés en DB) (${dcMissingInDcpt.length}):`);
    reportSections.push(`| DC ID | Nom du Datacenter | Hébergeur | Ville |`);
    reportSections.push(`|---|---|---|---|`);
    dcMissingInDcpt.forEach(item => {
      reportSections.push(`| \`${item.id}\` | ${item.nom} | \`${item.hebid}\` | ${item.villeNom || item.villeCode} (\`${item.villeCode}\`) |`);
    });
    reportSections.push(``);
  }

  if (dcptMissingInDC.length > 0) {
    reportSections.push(`#### 🟡 Points dans \`v0.dcpt\` sans datacenter parent dans \`v0.datacenter\` (${dcptMissingInDC.length}):`);
    dcptMissingInDC.forEach(item => {
      reportSections.push(`- \`${item.id}\` (${item.adresse}, ${item.ville})`);
    });
    reportSections.push(``);
  }

  if (dcDcptDiffs.length > 0) {
    reportSections.push(`#### ⚠️ Divergences de données entre \`v0.datacenter\` et \`v0.dcpt\` (${dcDcptDiffs.length} sites impactés):`);
    reportSections.push(`| DC ID | Nom du Datacenter | Type de divergence | Valeur liée à \`v0.datacenter\` | Valeur dans \`v0.dcpt\` |`);
    reportSections.push(`|---|---|---|---|---|`);
    dcDcptDiffs.forEach(item => {
      item.diffs.forEach(d => {
        reportSections.push(`| \`${item.dc_id}\` | ${item.dc_nom} | ${d.field} | \`${d.dcVal}\` | \`${d.dcptVal}\` |`);
      });
    });
    reportSections.push(``);
  } else if (dcMissingInDcpt.length === 0 && dcptMissingInDC.length === 0) {
    reportSections.push(`✓ Parfaite concordance entre \`v0.datacenter\` et \`v0.dcpt\`.\n`);
  }

  fs.writeFileSync(REPORT_PATH, reportSections.join('\n'), 'utf-8');
  console.log(`${colors.green}✓ Rapport Markdown généré avec succès dans : ${REPORT_PATH}${colors.reset}\n`);

  await client.end();
}

runComparison().catch(err => {
  console.error(`${colors.red}❌ Erreur inattendue:${colors.reset}`, err);
  process.exit(1);
});
