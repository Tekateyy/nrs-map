# Rapport de Comparaison : Google Sheet vs PostgreSQL (v0)
*Généré le : 2026-08-25 14 h 02 min 36 s*

> [!NOTE]
> Ce rapport récapitule les divergences d'information entre le Google Sheet (source de vérité) et les tables du schéma `v0` de la base de données PostgreSQL.

## Synthèse Globale

- **Total des divergences de champs détectées (GS vs DB)** : `20`
- **Éléments manquants en Base de données (GS vs DB)** : `0`
- **Éléments manquants dans le Google Sheet** : `0`
- **Datacenters sans point géocodé (v0.datacenter sans v0.dcpt)** : `0`

### 1. Table `v0.datacenter` vs Onglet `Datacenters - colocation & Hype`
✓ Aucune divergence de champ détectée sur `v0.datacenter`.

### 2. Table `v0.hebergeur` vs Onglet `Hebergeurs`
| Code Hébergeur | Champ | Valeur Google Sheet | Valeur DB PostgreSQL |
|---|---|---|---|
| `KEEL` | `heb_majsh_name` | `Jane Street Group LLC / Jane Street Capital LLC / Jane Street Global Trading LLC` | `Jane Street Group LLC- Jane Street Capital LLC-Jane Street Global Trading LLC` |
| `CMPS` | `heb_majsh_name` | `Ontario Teachers' Pension Plan and Brookfield Infrastructure Partners` | `Ontario Teachers Pension Plan and Brookfield Infrastructure Partners` |
| `CMPS` | `heb_majsh_nat` | `Canada and USA (mixed PE ownership) / Canada (Brookfield listed Canada; OTPP Canada)` | `Canada and USA (mixed PE ownership) / Canada (Brookfield listed Canada - OTPP Canada)` |
| `DCEN` | `heb_siteweb` | `https://d-central.tech/mining-hosting` | `-` |
| `EVNM` | `heb_majsh_name` | `Bit Digital, Inc. (owner since 2024)` | `Bit Digital Inc. (owner since 2024)` |
| `FLUM` | `heb_siteweb` | `https://assets.lumen.com/is/content/Lumen/colocation-location-data-sheet` | `-` |
| `NRDK` | `heb_majsh_name` | `Innventure Inc. (Private ownership) (Peu d'info)` | `Innventure Inc. (Private ownership) (Peu dinfo)` |
| `TLUS` | `heb_majsh_name` | `No controlling shareholder :major canadian institutional investors (ex: Royal Bank Canada)` | `No controlling shareholder: major canadian institutional investors (ex: Royal Bank Canada)` |
| `UBCN` | `heb_majsh_name` | `Urbacon Group (private construction/services firm) / Fonds FTQ` | `Urbacon Group (private construction/services firm) Fonds FTQ` |
| `VNTG` | `heb_majsh_name` | `Consortium incl. DigitalBridge group/Silver Lake, AustralianSuper/ PSP Investments/ Howard Hugues Holdings` | `Consortium incl DigitalBridge group Silver Lake -AustralianSuper- PSP Investments- Howard Hugues Holdings` |

### 3. Table `v0.ville` vs Onglet `expCSV-Villes`
✓ Aucune divergence détectée sur `v0.ville`.

### 4. Table `v0.dcpt` vs Onglet `expCSV-pt_geocod`
| DC ID | Champ | Valeur Google Sheet | Valeur DB PostgreSQL |
|---|---|---|---|
| `FBLKMTL01` | `dcpt_adresse` | `xxx-onsaispasou Montreal QQQ QQQ` | `Non divulgée` |
| `FBLKMTL02` | `dcpt_adresse` | `xxx-onsaispasou Montreal QQQ QQQ` | `Non divulgée` |
| `FBLKMTL03` | `dcpt_adresse` | `secteur Louvain Est / rue Laverdure, Ahuntsic-Cartierville, Montreal, QC` | `Non dilvugée` |
| `FBLKMTL04` | `dcpt_adresse` | `adresse non publiee, Dollard-des-Ormeaux, QC` | `Non divulgée` |
| `FBLKQBC01` | `dcpt_adresse` | `adresse non publiee, Charlesbourg, Quebec, QC` | `Non divulgée` |
| `FBLKQBC02` | `dcpt_adresse` | `zzz-onsaispasvraimentou Duberger Queebec QQQ QQQ` | `Non divulgée` |
| `FBLKQBC03` | `dcpt_adresse` | `adresse non publiee, Sainte-Foy, Quebec, QC` | `Non divulgée` |
| `FBLKSHB01` | `dcpt_adresse` | `adresse non confirmee, Sherbrooke, QC` | `Non divulgée` |
| `FBLKTRV01` | `dcpt_adresse` | `adresse non confirmee,  700 rue Notre-Dame Est, Trois-Rivières, QC G8T 4H9, Canada` | `Non divulgée` |
| `FBLKXXX01` | `dcpt_adresse` | `adresse non publiee, region de l’Estrie, QC` | `Non divulgée` |

### 5. Cohérence interne Base de données : `v0.datacenter` vs `v0.dcpt`
#### ⚠️ Divergences de données entre `v0.datacenter` et `v0.dcpt` (12 sites impactés):
| DC ID | Nom du Datacenter | Type de divergence | Valeur liée à `v0.datacenter` | Valeur dans `v0.dcpt` |
|---|---|---|---|---|
| `CMPSMTL01` | Compass Montreal II | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `Baie-D'Urfe` |
| `CMPSMTL02` | Compass Montreal I | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `LaSalle` |
| `EQNXMTL01` | Equinix MTL 1 | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `Saint-Laurent` |
| `ESTRMTL04` | Estruxture MTL4 | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `Kirkland` |
| `HIVDMTL02` | Hive MTL-2 | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `Saint-Laurent` |
| `LSWBMTL01` | LeaseWeb MTL-01 | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `Verdun` |
| `LSWBMTL02` | LeaseWeb MTL-02 | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `LaSalle` |
| `LSWBMTL03` | LeaseWeb MTL-03 | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `Saint-Leonard` |
| `RDDCVAC01` | RDDc - quantique | Nom Ville (v0.ville vs dcpt_ville) | `Saint-Gabriel-de-Valcartier` | `Quebec` |
| `VNTGMTL01` | Vantage Data Centers Canada Montreal I QC1 | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `Saint-Laurent` |
| `VNTGMTL02` | Vantage Data Centers Canada Montreal II QC4 | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `Pointe-Claire` |
| `VNTGMTL03` | Vantage Data Centers Canada Montreal III QC6 | Nom Ville (v0.ville vs dcpt_ville) | `Montréal` | `Pointe-Claire` |
