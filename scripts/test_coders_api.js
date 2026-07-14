import fs from 'fs';
import path from 'path';

/**
 * Script de test pour interroger l'API CODERS (sesit.ca)
 * Récupère les lignes et nœuds de transport.
 */
async function testAPI() {
  // Récupération de la clé API via l'environnement, un fichier .env local ou les arguments de ligne de commande
  let apiKey = process.env.CODERS_API_KEY || process.argv[2];

  if (!apiKey) {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/^CODERS_API_KEY\s*=\s*([^\s#]+)/m);
        if (match) {
          apiKey = match[1].trim();
        }
      }
    } catch (err) {
      // Silence
    }
  }

  if (!apiKey) {
    console.error('❌ Erreur : Clé API manquante.');
    console.log('\nUsage :');
    console.log('  export CODERS_API_KEY="votre_cle_api"');
    console.log('  node scripts/test_coders_api.js');
    console.log('OU :');
    console.log('  node scripts/test_coders_api.js <votre_cle_api>\n');
    console.log('Où trouver la clé API ?');
    console.log('1. Connectez-vous sur https://coders.cme-emh.ca/');
    console.log('2. Allez dans votre profil / paramètres utilisateur pour générer/récupérer votre clé API.');
    console.log('3. Assurez-vous d\'avoir accepté la licence d\'utilisation (EULA) pour accéder aux tables.');
    process.exit(1);
  }

  const baseUrl = 'https://api.sesit.ca';

  // 1. Tester la connexion
  console.log('--- 1. Test de connexion ---');
  try {
    const welcomeRes = await fetch(`${baseUrl}/?key=${apiKey}`);
    const welcomeText = await welcomeRes.text();
    console.log(`Statut welcome: ${welcomeRes.status}`);
    console.log(`Réponse welcome: ${welcomeText.trim()}`);
  } catch (err) {
    console.error('Erreur lors du test de connexion:', err.message);
  }

  // 2. Lister les tables disponibles
  console.log('\n--- 2. Liste des tables ---');
  let tables = [];
  try {
    const tablesRes = await fetch(`${baseUrl}/tables?key=${apiKey}`);
    if (tablesRes.ok) {
      tables = await tablesRes.json();
      console.log('Tables disponibles :', tables);
    } else {
      console.log(`Statut tables: ${tablesRes.status} - ${tablesRes.statusText}`);
    }
  } catch (err) {
    console.error('Erreur lors de la récupération des tables:', err.message);
  }

  // 3. Récupérer un extrait des lignes de transmission du Québec
  console.log('\n--- 3. Lignes de transmission (Québec - QC) ---');
  try {
    const linesRes = await fetch(`${baseUrl}/transmission_lines?province=QC&key=${apiKey}`);
    if (linesRes.ok) {
      const linesData = await linesRes.json();
      console.log(`Nombre de lignes récupérées : ${linesData.length}`);
      if (linesData.length > 0) {
        console.log('Exemple de ligne :', JSON.stringify(linesData[0], null, 2));
      }
    } else {
      console.log(`Statut lines: ${linesRes.status} - ${linesRes.statusText}`);
      const text = await linesRes.text();
      console.log('Réponse :', text.substring(0, 200));
    }
  } catch (err) {
    console.error('Erreur lignes de transmission:', err.message);
  }

  // 4. Détecter et interroger la table des nœuds/postes
  const tablesList = Array.isArray(tables) ? tables : (tables.coders || []);
  const nodesTableName = tablesList.find(t => t.toLowerCase().includes('node')) || 'nodes';
  console.log(`\n--- 4. Nœuds / Postes électriques (${nodesTableName}) ---`);
  
  // Essayons avec et sans le paramètre province
  for (const useProvince of [false, true]) {
    const url = useProvince 
      ? `${baseUrl}/${nodesTableName}?province=QC&key=${apiKey}`
      : `${baseUrl}/${nodesTableName}?key=${apiKey}`;
    
    console.log(`Essai avec url : ${url.replace(apiKey, '***')}`);
    try {
      const nodesRes = await fetch(url);
      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        console.log(`Réussite ! Nombre de nœuds récupérés : ${nodesData.length}`);
        if (nodesData.length > 0) {
          console.log('Exemple de nœud/poste :', JSON.stringify(nodesData[0], null, 2));
        }
        break; // Arrêter si succès
      } else {
        console.log(`Statut nœuds (province=${useProvince}): ${nodesRes.status} - ${nodesRes.statusText}`);
        const text = await nodesRes.text();
        console.log('Réponse :', text.substring(0, 200));
      }
    } catch (err) {
      console.error('Erreur nœuds:', err.message);
    }
  }
}

testAPI();
