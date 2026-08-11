# Rapport de Comparaison : Google Sheet vs PostgreSQL (v0)
*Généré le : 2026-08-07 13 h 52 min 47 s*

> [!NOTE]
> Ce rapport récapitule les divergences d'information entre le Google Sheet (source de vérité) et les tables du schéma `v0` de la base de données PostgreSQL.

## Synthèse Globale

- **Total des divergences de champs détectées** : `34`
- **Éléments manquants en Base de données** : `0`
- **Éléments manquants dans le Google Sheet** : `1`

### 1. Table `v0.datacenter` vs Onglet `Datacenters - colocation & Hype`
#### 🟡 Data centers présents en DB mais ABSENTS du Google Sheet (1):
- `VNTGQBC02`

✓ Aucune divergence de champ détectée sur `v0.datacenter`.

### 2. Table `v0.hebergeur` vs Onglet `Hebergeurs`
| Code Hébergeur | Champ | Valeur Google Sheet | Valeur DB PostgreSQL |
|---|---|---|---|
| `AWSD` | `heb_siegesoc_loc` | `Seattle, USA` | `Seattle` |
| `BNFD` | `heb_siegesoc_loc` | `Toronto, CA` | `Toronto` |
| `KEEL` | `heb_majsh_name` | `Jane Street Group LLC / Jane Street Capital LLC / Jane Street Global Trading LLC` | `Jane Street Group LLC- Jane Street Capital LLC-Jane Street Global Trading LLC` |
| `KEEL` | `heb_siegesoc_loc` | `NY, CA` | `NY` |
| `CLCQ` | `heb_siegesoc_loc` | `Montréal, CA` | `Montréal` |
| `CLGX` | `heb_siegesoc_loc` | `Denver, USA` | `Denver` |
| `CMPS` | `heb_majsh_name` | `Ontario Teachers' Pension Plan and Brookfield Infrastructure Partners` | `Ontario Teachers Pension Plan and Brookfield Infrastructure Partners` |
| `CMPS` | `heb_majsh_nat` | `Canada and USA (mixed PE ownership) / Canada (Brookfield listed Canada; OTPP Canada)` | `Canada and USA (mixed PE ownership) / Canada (Brookfield listed Canada - OTPP Canada)` |
| `CMPS` | `heb_siegesoc_loc` | `Dallas, USA` | `Dallas` |
| `DCEN` | `heb_siteweb` | `https://d-central.tech/mining-hosting` | `-` |
| `DIGH` | `heb_siegesoc_loc` | `Sherbrooke, CA` | `Sherbrooke` |
| `DSTQ` | `heb_siegesoc_loc` | `Sherbrooke, CA` | `Sherbrooke` |
| `EVNM` | `heb_majsh_name` | `Bit Digital, Inc. (owner since 2024)` | `Bit Digital Inc. (owner since 2024)` |
| `EVNM` | `heb_siegesoc_loc` | `Montréal, CAN` | `Montréal` |
| `EQNX` | `heb_siegesoc_loc` | `Redwood City, USA` | `Redwood City` |
| `ESTR` | `heb_siegesoc_loc` | `Montréal, CA` | `Montréal` |
| `EXIN` | `heb_siegesoc_loc` | `Neuilly-sur-seine, FRA` | `Neuilly-sur-seine` |
| `FLUM` | `heb_siteweb` | `https://assets.lumen.com/is/content/Lumen/colocation-location-data-sheet` | `-` |
| `HIVD` | `heb_siegesoc_loc` | `Vancouver, Canada` | `Vancouver` |
| `HYBT` | `heb_siegesoc_loc` | `Vancouver, Canada` | `Vancouver` |
| `IBMQ` | `heb_siegesoc_loc` | `Armonk, USA` | `Armonk` |
| `LSWB` | `heb_siegesoc_loc` | `Amsterdam, NL` | `Amsterdam` |
| `NRDK` | `heb_majsh_name` | `Innventure Inc. (Private ownership) (Peu d'info)` | `Innventure Inc. (Private ownership) (Peu dinfo)` |
| `NRDK` | `heb_siegesoc_loc` | `Québec, CA` | `Québec` |
| `OVHC` | `heb_siegesoc_loc` | `Roubaix, France` | `Roubaix` |
| `QSCL` | `heb_siegesoc_loc` | `Lévis, CA` | `Lévis` |
| `RDDC` | `heb_siegesoc_loc` | `Québec / Sherbrooke region, CA` | `Sherbrooke` |
| `SMRT` | `heb_siegesoc_loc` | `Capelle aan den IJssel, NL` | `Capelle aan den Ijssel` |
| `TLUS` | `heb_majsh_name` | `No controlling shareholder :major canadian institutional investors (ex: Royal Bank Canada)` | `No controlling shareholder: major canadian institutional investors (ex: Royal Bank Canada)` |
| `TLUS` | `heb_siegesoc_loc` | `Vancouver, CA` | `Vancouver` |
| `UBCN` | `heb_majsh_name` | `Urbacon Group (private construction/services firm) / Fonds FTQ` | `Urbacon Group (private construction/services firm) Fonds FTQ` |
| `UBCN` | `heb_siegesoc_loc` | `Toronto, CA` | `Toronto` |
| `VNTG` | `heb_majsh_name` | `Consortium incl. DigitalBridge group/Silver Lake, AustralianSuper/ PSP Investments/ Howard Hugues Holdings` | `Consortium incl DigitalBridge group Silver Lake -AustralianSuper- PSP Investments- Howard Hugues Holdings` |
| `VNTG` | `heb_siegesoc_loc` | `Denver, USA` | `Denver` |

### 3. Table `v0.ville` vs Onglet `expCSV-Villes`
✓ Aucune divergence détectée sur `v0.ville`.

### 4. Table `v0.dcpt` vs Onglet `expCSV-pt_geocod`
✓ Aucune divergence détectée sur `v0.dcpt`.
