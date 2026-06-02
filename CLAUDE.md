# CLAUDE.md — nrs-map

Contexte permanent du projet, lu automatiquement par Claude à chaque session.
Mettre ce fichier à jour si la stack, les conventions ou le périmètre évoluent.

---

## But du projet
Application web **single-page** affichant une carte interactive des **data centers
au Québec/Canada**. Les données proviennent du fichier `points.geojson` (49 points)
inclus dans le dépôt. Pas de base de données, pas d'authentification.

## Stack technique (figée)
| Couche | Choix | Notes |
|--------|-------|-------|
| Runtime | **Node.js** | ES modules (`"type": "module"`) |
| Serveur | **Express** | Sert uniquement les fichiers statiques |
| Frontend | **Vanilla JS** | Zéro build, zéro framework |
| Carte | **Leaflet** + tuiles **OpenStreetMap** | Via CDN, sans clé API |
| Clustering | **leaflet.markercluster** | Via CDN |

> Aucun bundler (Webpack/Vite/etc.), aucun transpileur, aucune clé API externe.

## Commandes
```bash
npm install   # installe Express
npm start     # démarre le serveur sur http://localhost:3000

# Docker / Zimablade
docker compose up -d --build  # Construit et lance le conteneur en arrière-plan
docker compose down           # Arrête le conteneur
```

## Structure du projet
```
nrs-map/
├─ CLAUDE.md            ← ce fichier
├─ README.md            ← doc humaine
├─ ROADMAP.md           ← avancement par phases
├─ .gitignore
├─ server.js            ← serveur Express (fichiers statiques)
├─ package.json
├─ points.geojson       ← données brutes (49 features)
├─ density.json         ← densité de puissance (W/pi²) par Type de site
└─ public/
   ├─ index.html        ← page unique
   ├─ style.css         ← mise en page
   └─ app.js            ← logique Leaflet
```

## Données — density.json
Table de correspondance `Type → power_density_w_pi2` utilisée par `app.js` pour
calculer la puissance estimée à la volée. Servi à `/density.json` par Express.

Types couverts : `Retail`, `Wholesale`, `Hyperscale`, `Carrier Hotel`, `Crypto`,
`Quantique`, `Unknown`. La correspondance est insensible à la casse (toLowerCase).

## Données — points.geojson
Fichier GeoJSON `FeatureCollection` de 49 `Point` features.
Champs `properties` utiles (certains peuvent être `null`) :

| Champ | Type | Description |
|-------|------|-------------|
| `NomSite` | string | Nom du site (toujours présent) |
| `Type` | string | Catégorie : `Hyperscale`, `Retail`, `Carrier Hotel`, `Enterprise`… |
| `Hebergeur` | string | Nom de l'hébergeur (ex. Amazon, Cologix…) |
| `Adresse` | string | Adresse postale |
| `ville` | string | Ville |
| `state` | string | Province |
| `PuissanceAnnMW` | number\|null | Puissance annoncée en MW |
| `Siteweb` | string\|null | URL du site (peut être null) |
| `NombreBatiments` | number\|null | Nombre de bâtiments |
| `SurfBatimentPI2` | string\|null | Surface en pieds² (ex. `"310 000"` avec espace) |

> Les coordonnées GeoJSON sont `[longitude, latitude]`.
> 5 features ont `coordinates: []` (non géocodées) — ignorées au chargement dans `app.js`.

**Champ calculé (non stocké)** : `PuissanceEstiméeMW = SurfBatimentPI2 × 50 % × PowerDensity / 1 000 000`.
Affiché dans le popup si `SurfBatimentPI2` et le Type sont connus, sinon `"—"`.

## Conventions de code
- **ES modules** partout (`import`/`export`), jamais `require`.
- JS vanilla côté client : pas de classes, fonctions simples, commentaires en
  français si utile.
- Les valeurs `null` dans les properties doivent être gérées gracieusement dans
  les popups (afficher "—" ou ne pas afficher la ligne).
- Pas d'inline style dans le HTML ; tout dans `style.css`.

## Avancement
Voir `ROADMAP.md` pour l'état des phases.
