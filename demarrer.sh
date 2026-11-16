#!/bin/bash
# Script de lancement rapide de la plateforme BUNEC (Backend + Frontend)

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=========================================================="
echo "  DÉMARRAGE DE LA PLATEFORME BUNEC (SUIVI DE DOSSIER)     "
echo "=========================================================="

# Vérification des dépendances
if [ ! -d "backend/node_modules" ]; then
  echo "Installation des dépendances backend..."
  (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "Installation des dépendances frontend..."
  (cd frontend && npm install)
fi

# Arrêt propre en cas d'interruption
cleanup() {
  echo ""
  echo "Arrêt des serveurs..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Démarrage de l'API Backend sur le port 3000
echo "🚀 [1/2] Lancement de l'API Backend MVC sur http://localhost:3000..."
(cd backend && npm run dev) &

# Attente que le backend réponde
sleep 2

# 2. Démarrage du Frontend sur le port 5173
echo "💻 [2/2] Lancement de l'Interface Frontend sur http://localhost:5173..."
(cd frontend && npm run dev) &

echo ""
echo "✅ Plateforme active :"
echo "   - Interface Citoyenne : http://localhost:5173"
echo "   - API Backend MVC     : http://localhost:3000"
echo "   - Test API Health     : http://localhost:3000/api/v1/health"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter."
wait
