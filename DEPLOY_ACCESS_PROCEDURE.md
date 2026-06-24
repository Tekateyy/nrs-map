# Procédure de configuration d'un accès de déploiement restreint

Ce document décrit comment configurer un accès sécurisé pour votre ami afin qu'il puisse uniquement effectuer un `git pull` et reconstruire le conteneur Docker de l'application, sans avoir d'accès au reste de votre serveur Zimablade.

La solution la plus sécurisée consiste à utiliser une **restriction de commande SSH** associée à une clé publique. Lorsque votre ami se connectera en SSH, la commande s'exécutera automatiquement, puis la connexion se fermera, sans lui donner de terminal interactif (shell).

---

## 1. Configuration sur le serveur Zimablade (à faire par vous, `atheve`)

Connectez-vous à votre serveur en SSH :
```bash
ssh atheve@ssh.atheve.com
```

### Étape 1 : Créer un utilisateur et un groupe dédiés
Pour isoler les privilèges, nous allons créer un utilisateur dédié `deployer` et l'ajouter au groupe `docker` afin qu'il puisse exécuter Docker sans droits root complets :

```bash
# Créer le groupe de déploiement
sudo groupadd deployers

# Créer l'utilisateur système dédié (sans mot de passe pour forcer l'usage des clés SSH)
sudo useradd -m -g deployers -s /bin/bash deployer

# Ajouter l'utilisateur au groupe docker pour exécuter docker compose
sudo usermod -aG docker deployer
```

### Étape 2 : Configurer les permissions du dossier du projet
Il faut s'assurer que le nouvel utilisateur `deployer` a le droit de lire, écrire et modifier le contenu du dossier `/DATA/Projects/nrs-map` :

```bash
# Attribuer le dossier au groupe deployers
sudo chown -R atheve:deployers /DATA/Projects/nrs-map

# Donner les permissions de lecture/écriture au groupe et propager les permissions sur les nouveaux fichiers
sudo chmod -R 775 /DATA/Projects/nrs-map
sudo chmod g+s /DATA/Projects/nrs-map
```

### Étape 3 : Créer le script de déploiement sécurisé
Créez un script qui sera la seule commande autorisée pour cet utilisateur.

Créez le fichier `/usr/local/bin/deploy-nrs-map.sh` :
```bash
sudo nano /usr/local/bin/deploy-nrs-map.sh
```

Collez le contenu suivant :
```bash
#!/bin/bash
set -e

# Aller dans le répertoire du projet
cd /DATA/Projects/nrs-map

echo "=========================================="
echo "Début du déploiement de datacenter-map"
echo "=========================================="

echo "1. Récupération des dernières modifications (Git)..."
git pull

echo "2. Reconstruction et démarrage du conteneur (Docker)..."
docker compose up -d --build

echo "=========================================="
echo "Déploiement terminé avec succès !"
echo "=========================================="
```

Rendez le script exécutable :
```bash
sudo chmod +x /usr/local/bin/deploy-nrs-map.sh
```

### Étape 4 : Configurer la clé SSH de votre ami avec restriction
Demandez la clé publique SSH de votre ami (le contenu de son fichier `.pub`, par exemple `id_ed25519.pub`).

Créez le répertoire SSH pour l'utilisateur `deployer` :
```bash
sudo mkdir -p /home/deployer/.ssh
sudo chmod 700 /home/deployer/.ssh
```

Éditez le fichier `authorized_keys` :
```bash
sudo nano /home/deployer/.ssh/authorized_keys
```

Ajoutez la clé de votre ami en y préfixant la restriction `command` suivante (remplacez `ssh-ed25519 AAAA...` par sa vraie clé) :
```text
no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty,command="/usr/local/bin/deploy-nrs-map.sh" ssh-ed25519 AAAA... ami@ordinateur
```

Ajustez les permissions du fichier :
```bash
sudo chown -R deployer:deployers /home/deployer/.ssh
sudo chmod 600 /home/deployer/.ssh/authorized_keys
```

---

## 2. Procédure pour votre ami (à lui envoyer)

Pour mettre à jour et redéployer la carte des data centers, votre ami n'a qu'à lancer une simple commande SSH depuis son terminal local.

### Commande de déploiement
```bash
ssh deployer@ssh.atheve.com
```

### Ce qui va se passer :
1. La connexion SSH s'établit.
2. Le serveur exécute immédiatement le script de déploiement (effectue le `git pull` puis le `docker compose up -d --build`).
3. Le statut s'affiche en temps réel dans sa console.
4. Une fois le déploiement fini, la connexion SSH se ferme automatiquement.

> **Sécurité :** Votre ami n'aura aucun accès shell interactif. S'il tente de naviguer dans vos fichiers (`cd`, `ls`) ou d'exécuter d'autres commandes, la connexion sera immédiatement rejetée.
