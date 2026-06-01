FROM node:20-alpine

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances de production uniquement
RUN npm ci --omit=dev

# Copier le reste de l'application (en respectant le fichier .dockerignore)
COPY . .

# Exposer le port par défaut de l'application
EXPOSE 3000

# Variables d'environnement par défaut
ENV PORT=3000
ENV NODE_ENV=production

# Démarrer le serveur Express
CMD ["npm", "start"]
