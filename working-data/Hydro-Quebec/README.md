# ⚡ Réseau de Transport d'Hydro-Québec

Ce dossier contient les scripts de compilation et les données sources pour le réseau de lignes de transport d'électricité à haute tension d'Hydro-Québec.

## Sources
- **Source principale** : [Carefour de la Modélisation Energétique - Transmission Lines Dashboard](https://coders.cme-emh.ca/dashboard/transmission_lines)
- **Fichiers sources** :
  - `nodes_2026-06-17.csv` : Liste des postes électriques et nœuds du réseau de transport, avec leur géolocalisation et types.
  - `transmission_lines_2026-06-17.csv` : Liste des lignes de transport reliant les postes, avec les tensions de service et types de courant.
  - `reseau-hydro-quebec.png` : Image d'illustration ou de référence du réseau haute tension.

## Scripts de compilation

Les données brutes au format CSV sont compilées en GeoJSON pour être affichées par la carte de l'application :

**`compile-hq.js`** :
   - Compile l'ensemble des nœuds et lignes de transmission sans filtre de tension.
   - Génère par défaut `Hydro-Quebec.geojson` dans ce dossier.

## Exécution manuelle

Pour compiler l'intégralité du réseau :
```bash
node working-data/Hydro-Quebec/compile-hq.js [chemin_de_sortie.geojson]
```

## Rôle dans l'application
Ces infrastructures électriques servent de support ou de tracé de référence pour modéliser le déploiement du réseau dorsal de fibre optique (souvent installé sur les pylônes de transport d'électricité via la technologie OPGW - Optical Ground Wire).
