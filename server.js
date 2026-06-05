import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Servir les fichiers statiques du dossier public/
app.use(express.static(join(__dirname, 'public')));

// Exposer les fichiers de données à la racine du domaine
app.use('/points.geojson', express.static(join(__dirname, 'points.geojson')));
app.use('/density.json', express.static(join(__dirname, 'density.json')));
app.use('/DCbati_poly.geojson', express.static(join(__dirname, 'DCbati_poly.geojson')));

app.listen(PORT, () => {
  console.log(`✅  nrs-map — http://localhost:${PORT}`);
});
