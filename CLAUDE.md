# CLAUDE.md — nrs-map

Contexte permanent du projet, lu automatiquement par Claude à chaque session.
Mettre ce fichier à jour si la stack, les conventions ou le périmètre évoluent.

---

## But du projet
Application web **single-page** affichant une carte interactive des **data centers
au Québec/Canada**. Les données proviennent du fichier `data/datacenters.geojson` (49 points)
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
npm install   # installe Express et papaparse
npm run build # traite et copie les données les plus récentes (datacenters et Hydro-Québec)
npm start     # démarre le serveur sur http://localhost:3000

# Docker / Zimablade
docker compose up -d --build  # Construit et lance le conteneur en arrière-plan (exécute npm run build)
docker compose down           # Arrête le conteneur
```

## Structure du projet
```
nrs-map/
├─ CLAUDE.md            ← ce fichier
├─ README.md            ← doc humaine
├─ ROADMAP.md           ← avancement par phases
├─ DEPLOY_ACCESS_PROCEDURE.md ← configuration d'accès restreint pour ami
├─ Dockerfile           ← définition de l'image Docker
├─ docker-compose.yml   ← orchestration du conteneur
├─ .dockerignore        ← exclusion de fichiers pour Docker
├─ .gitignore
├─ server.js            ← serveur Express (fichiers statiques)
├─ package.json
├─ data/
│  ├─ datacenter_types.json ← densité de puissance (W/pi²) par Type de site
│  ├─ datacenters.geojson  ← données brutes (49 features)
│  └─ DCbati_poly.geojson  ← empreintes polygonales des bâtiments (18 features)
├─ scripts/
│  └─ process-working-data.js ← script pour copier les GeoJSON les plus récents de working-data vers data
└─ public/
   ├─ index.html        ← page unique
   ├─ style.css         ← mise en page
   └─ app.js            ← logique Leaflet
```

## Données — DCbati_poly.geojson
Fichier GeoJSON `FeatureCollection` de `Polygon` features représentant les
empreintes réelles des bâtiments de data centers. Situé dans `data/DCbati_poly.geojson`.

| Champ | Type | Description |
|-------|------|-------------|
| `dcbat_id` | number | Identifiant interne du polygone |
| `dcbat_dcid` | string | Clé de jointure avec `datacenters.geojson` (`properties.dci_id`) |
| `dcbat_areasqm` | number | Surface en m² |
| `dcbat_areapi2` | number | Surface en pi² |
| `dcbat_nbetage` | number | Nombre d'étages |

> Servi à `/DCbati_poly.geojson` par Express.
> Affiché dans `app.js` via `L.geoJSON` dans l'`overlayPane` (z-index 400),
> naturellement en dessous des marqueurs (`markerPane`, z-index 600).
> Les polygones sont colorés par type via la table `dci_id → dci_type` construite
> au chargement depuis `datacenters.geojson`.

## Données — datacenter_types.json
Table de correspondance `Type → power_density_w_pi2` utilisée par `app.js` pour
calculer la puissance estimée à la volée. Situé dans `data/datacenter_types.json`. Servi à `/datacenter_types.json` par Express.

Types couverts : `Retail`, `Wholesale`, `Hyperscale`, `Crypto`,
`Quantique`, `Unknown`. La correspondance est insensible à la casse (toLowerCase).

## Données — datacenters.geojson
Fichier GeoJSON `FeatureCollection` de 72 `Point` features. Situé dans `data/datacenters.geojson`.
Champs `properties` utiles (structure révisée 2026-08-07) :

| Champ | Type | Description |
|-------|------|-------------|
| `dci_id` | string | Identifiant unique du centre de données |
| `dci_nomsite` | string | Nom du site (toujours présent) |
| `dci_type` | string | Catégorie : `Hyperscale`, `Retail`, `Wholesale`, `Crypto`, `Quantique` |
| `dci_statut` | string | Statut : `en opération`, `en projet`, `en construction` |
| `dci_iaready` | string\|null | `"IA"` si équipé pour l'intelligence artificielle |
| `dci_puiss_annoncee` | number\|null | Puissance annoncée en MW |
| `dci_nomville` | string | Ville |
| `dci_adresse` | string | Adresse postale |
| `dci_an_mise_service` | string\|null | Année de mise en service (ex. `"2025"`, `"2027"`, `"NC"`) |
| `dci_hebergeur` | string | Nom de l'hébergeur (ex. Amazon, Cologix, QScale...) |
| `dci_siegesocial_loc` | string\|null | Emplacement du siège social |
| `dc_hebwebsite` | string\|null | URL du site web de l'hébergeur |
| `dci_shareholder_majoritaire` | string\|null | Actionnaire(s) majoritaire(s) |
| `dci_shareholder_majo_nationalite` | string\|null | Nationalité des actionnaires majoritaires |

> Les coordonnées GeoJSON sont exprimées en WGS84 `[longitude, latitude]`. Le script `process-working-data.js` assure la conversion depuis EPSG:3857 (Web Mercator) vers WGS84 si les données sources sont en mètres.

**Champs calculés** : 
- **Puissance estimée (popup)** = `Surface batiment / 2 × densité énergétique du Type / 1 000 000`. Calculée uniquement pour les sites en opération (affichera `"—"` pour les sites en projet ou en construction).
- **Puissance totale (statistiques)** = cumul de la puissance effective par datacenter (prend la puissance annoncée en priorité, et la puissance estimée depuis la surface en second ressort).

## Règles de Développement Impératives
Respecter impérativement les règles suivantes :
- Ne jamais écrire de code JavaScript ou css directement dans les attributs HTML, toujours dans les fichiers .js et .css
- Lorsque les fonctions javascript deviennent trop volumineuses, proceder à un découpage par logique de fonctions unitaires.
- Lorsque les fichiers javascript deviennent trop volumineux, proceder à un découpage par logique de modules.
- Privilegier les solutions, framework, libraries les plus légères possibles et les moins énergivores.
- Privilegier le code simple, lisible et maintenable, dans une logique d'artisanat du code (software craftmanship).
- Documenter rigoureusement toute modification du code, des données, des scripts et de l'architecture.

## Conventions de code
- **ES modules** partout (`import`/`export`), jamais `require`.
- JS vanilla côté client : pas de classes, fonctions simples, commentaires en
  français si utile.
- Les valeurs `null` dans les properties doivent être gérées gracieusement dans
  les popups (afficher "—" ou ne pas afficher la ligne).
- Pas d'inline style dans le HTML ; tout dans `style.css`.

## Avancement
Voir `ROADMAP.md` pour l'état des phases.
