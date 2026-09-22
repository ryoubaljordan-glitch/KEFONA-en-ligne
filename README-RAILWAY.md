# KEFONA en ligne — V5

## Déploiement Railway

Variables Railway (ne pas mettre les secrets dans GitHub) :
- PAPI_API_KEY = clé API Papi
- PAPI_TEST_MODE = true (sandbox) / false (production)
- PUBLIC_BASE_URL = https://kefona-en-ligne-production.up.railway.app
- PAPI_WEBHOOK_SECRET = secret de signature Papi, si utilisé par la version serveur

L'application utilise Papi côté serveur pour créer les liens de paiement et vérifier le statut d'un paiement via `/api/payment-status`.
