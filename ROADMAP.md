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

## Phase 2 — Améliorations UX (à venir)

- [ ] Panneau liste latérale des sites (synchronisé avec la carte)
- [ ] Barre de recherche par nom de site
- [ ] Couleurs distinctes par Type (Hyperscale, Retail, Carrier Hotel…)
- [ ] Compteur de sites affichés / total après filtrage
- [ ] Légende des couleurs/types

---

## Phase 3 — Données & robustesse (à venir)

- [ ] Endpoint API Express (`/api/points`) avec filtrage côté serveur
- [ ] Validation et nettoyage du GeoJSON (champs manquants, encodage)
- [ ] Gestion des champs `null` dans l'UI (affichage conditionnel)
- [ ] Tests (unitaires serveur + intégration)

---

## Phase 4 — Déploiement (à venir)

- [ ] Choisir une plateforme d'hébergement (Railway, Fly.io, VPS…)
- [ ] Variables d'environnement pour le port et l'URL de prod
- [ ] CI/CD (GitHub Actions)
- [ ] Domaine custom
