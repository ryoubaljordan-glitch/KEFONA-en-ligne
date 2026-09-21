# KEFONA en ligne — V5

Cette archive est reconstruite à partir du fichier V5 fourni dans la conversation.

## Déploiement Railway
1. Importer ce dossier/projet dans Railway.
2. Le projet démarre avec `npm start`.
3. Ajouter les variables d'environnement dans Railway:
   - `PAPI_API_KEY` = votre clé API Papi (ne pas la mettre dans index.html)
   - `PAPI_TEST_MODE` = `true` pour les essais, puis `false` en production
   - `PUBLIC_BASE_URL` = URL publique Railway, avec https://
4. Redéployer après modification des variables.

## Paiement
Le frontend V5 conserve les choix: MVOLA, ORANGE_MONEY, AIRTEL_MONEY et CARD.
Pour CARD, le backend ne force pas de provider Papi afin de laisser Papi afficher le paiement carte disponible.

## Important
Le V5 d'origine est une preview frontend avec localStorage. Les comptes, adresses, favoris et commandes ne sont donc pas encore une vraie base de données serveur. Le webhook Papi est présent comme point d'entrée mais doit être sécurisé et relié à une base de données avant une mise en production complète.
