# nrs-map

Carte interactive des **data centers au Québec et au Canada**.

Application web single-page construite avec Node.js, Leaflet et OpenStreetMap.
Aucune clé API, aucun build requis.

## Fonctionnalités

- 🗺️ Carte interactive centrée sur le Québec (tuiles OpenStreetMap)
- 📍 49 sites affichés avec clustering automatique
- 🔍 Filtres par **Type** de site et par **Hébergeur**
- 💬 Popup au clic sur chaque marqueur avec les infos détaillées

## Prérequis

- [Node.js](https://nodejs.org/) ≥ 18

## Installation

```bash
git clone <repo-url>
cd nrs-map
npm install
```

## Lancement

```bash
npm start
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans le navigateur.

## Source des données

Les données proviennent du fichier `data/datacenters.geojson` (49 data centers, champs :
nom, type, hébergeur, adresse, puissance MW, surface bâtiment…).
