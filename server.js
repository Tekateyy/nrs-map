import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Servir les fichiers statiques du dossier public/
app.use(express.static(join(__dirname, 'public')));

// Exposer les fichiers de données à la racine du domaine depuis le dossier data
app.use('/datacenters.geojson', express.static(join(__dirname, 'data', 'datacenters.geojson')));
app.use('/datacenter_types.json', express.static(join(__dirname, 'data', 'datacenter_types.json')));
app.use('/DCbati_poly.geojson', express.static(join(__dirname, 'data', 'DCbati_poly.geojson')));

app.listen(PORT, () => {
  console.log(`✅  nrs-map — http://localhost:${PORT}`);
});
