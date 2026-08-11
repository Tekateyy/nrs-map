# ROADMAP — nrs-map

Suivi d'avancement entre les sessions. Mettre à jour les cases à cocher en fin
de session.

---

## Phase 1 — Socle & MVP carte ✅ (session 1)

- [x] `CLAUDE.md` — mémoire de projet pour Claude
- [x] `README.md` — documentation humaine
- [x] `ROADMAP.md` — ce fichier
- [x] `.gitignore`
- [x] `package.json` + `server.js` — serveur Express statique
- [x] `public/index.html` — page unique avec Leaflet + MarkerCluster via CDN
- [x] `public/style.css` — carte plein écran, panneau filtres en overlay
- [x] `public/app.js` — marqueurs, clustering, popups, filtres Type/Hébergeur

---

## Phase 2 — Améliorations données & UX (en cours)

- [x] Robustesse au chargement : sites sans coordonnées ignorés gracieusement
- [x] Puissance estimée (MW) calculée à la volée via `datacenter_types.json`
- [x] Polygones bâtiments (`DCbati_poly.geojson`) avec filtre on/off
- [x] Couleurs distinctes par Type (Hyperscale, Retail, Wholesale...)
- [x] Légende des couleurs/types
- [x] Compteur de sites affichés / total après filtrage
- [x] Crédits et licence
- [x] Titre 
- [x] Favicon
- [x] A propos
- [x] Permettre le téléchagement des geojson
- [x] Responsive design
- [x] Connecter les DC avec le poste électrique le plus proche 
- [x] Animation de flux
- [x] Faire un filtre IA
- [x] Afficher les centrales distinctement
- [x] Permettre de partager une fiche datacenter specifique via un lien
- [x] Ajouter les projets de datacenter en construction
- [x] Infos sur la nationalité des entreprises et de leurs actionnaires
- [x] Suprimmer la catégorie "Carrier Hotel"
- [ ] Internationnaliser (i18n)
- [ ] Ajouter date installation
- [ ] Afficher la puissance calculée (autre valeur que la puissance prise en compte dans le calcul final)

---

## Phase 3 — Qualité des données (à venir)

- [x] Ajout du bloc calculé "surface au sol" à partir des données des polygones
- [ ] Géocodage des 5 sites sans coordonnées (Enovum MTL01, Hive QC-1, Hyper Bit, Exaion/PINQ2, HIVE Canada 1.0)
- [ ] Nettoyage des champs manquants ou incohérents dans `datacenter_types.geojson`

---

## Phase 4 — Déploiement (à venir)

- [ ] Choisir une plateforme d'hébergement (Railway, Fly.io, VPS…)
- [ ] Domaine custom
- [ ] Scripter l'export vers un csv format Hubblo
- [ ] Ajouter nom des membres de l'équipe projet