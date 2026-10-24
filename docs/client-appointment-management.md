# Gestion des rendez-vous par les clients

## Activation

1. Exécuter intégralement `database/migrations/2026-10-25_client_appointment_management.sql` dans le SQL Editor Supabase, avant de publier cette version.
2. Déployer l’application avec les variables Supabase serveur et les fournisseurs email/SMS déjà utilisés pour les confirmations. Vérifier que l’URL publique configurée pointe vers le domaine de production.
3. Vérifier un rendez-vous de test : réception du lien, consultation, déplacement, puis annulation. Aucun remboursement automatique n’est déclenché.

Les nouveaux messages de confirmation contiennent le lien personnel. Pour les rendez-vous existants, le bouton « Envoyer le lien de gestion au client » dans les détails permet de l’envoyer aux coordonnées enregistrées. L’accès à cet envoi est réservé aux administrateurs, responsables et réceptionnistes.

## Règles

- Modification et annulation jusqu’à la veille à 23 h 59, heure de Paris. Le serveur et la base contrôlent cette règle, même si la page reste ouverte après minuit.
- Le report conserve le salon, les prestations, la durée réelle, toute l’équipe et le paiement. Seuls les créneaux couvrant toute la prestation sont proposés.
- Une annulation conserve l’historique et le paiement ; elle libère le planning. Remboursement et éventuels crédits : contacter le salon.
- Un conflit de planning conserve l’ancien rendez-vous. Les mutations sont transactionnelles et les répétitions d’une même demande sont identifiées.

## Accès et suivi

Le secret aléatoire du lien est échangé contre un cookie HttpOnly de 30 minutes, puis retiré de l’adresse. Seule son empreinte est stockée dans la base. Le lien est personnel : ne pas le partager. Les tables et la fonction de mutation sont réservées au serveur.

`appointment_client_changes` conserve les changements et leur état de notification (`pending`, `sent`, `failed`). Une erreur d’envoi n’annule jamais un changement déjà confirmé. Contrôler les notifications `pending` ou `failed` et contacter le client si nécessaire ; aucune relance automatique n’est programmée.

Pour révoquer tous les liens d’un rendez-vous, remplacer l’UUID dans cette requête exécutée côté administration :

```sql
UPDATE public.appointment_management_links
SET revoked_at = now()
WHERE appointment_id = 'UUID_DU_RENDEZ_VOUS'::uuid;
```

La migration ne réécrit pas les rendez-vous existants. Elle ajoute aussi des gardes de conflits aux écritures de planning et d’affectations. Les conflits historiques éventuels ne sont pas corrigés automatiquement.

## Vérification locale

`npm run test:management` vérifie les routes avec fournisseurs simulés et exécute réellement la migration dans PostgreSQL embarqué (PGlite), sans toucher à la production. Compléter avec `npm run test:booking`, `npm run test:ui`, la vérification TypeScript et le build Next.js.
