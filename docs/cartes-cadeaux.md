# Cartes cadeaux : visuel, générateur et cadeaux physiques

## Le visuel de la carte

La carte envoyée par email (acheteur et destinataire) est une image PNG 1400 × 900 générée par `lib/email/gift-card-attachment.tsx` : logo Les Temples, prestation offerte, « Offert par / Pour », code, mot personnel, validité, signature. Le logo est embarqué (`lib/email/assets/logo-les-temples.ts`) pour ne jamais dépendre du système de fichiers du serveur ; la police serif (Cormorant Garamond) est récupérée une fois par processus et, à défaut, la police intégrée prend le relais.

Son apparence se règle dans **Administration › Cartes cadeaux › Générateur de carte** :

- thème (Or sombre, Ivoire, Jade), titre, sous-titre, mention en bas de carte, signature ;
- logo affiché ou non, validité en mois (vide = sans limite), photo de fond optionnelle ;
- aperçu en direct sur un exemple modifiable, téléchargeable.

Les réglages sont dans `gift_card_design_settings` (une ligne). Tant que la migration n'est pas appliquée, les valeurs par défaut s'appliquent et l'enregistrement renvoie un message explicite.

Chaque carte vendue se télécharge (ou s'ouvre) depuis **Cartes vendues** : `GET /api/gift-cards/<id>/card` (`?inline=1` pour l'afficher).

## Cadeaux physiques

Un client qui achète une carte cadeau en ligne peut y joindre un cadeau physique (coffret, carte imprimée, bougie…). Le catalogue se gère dans **Administration › Cartes cadeaux › Cadeaux physiques** : nom, photo, description, prix, livraison (frais, ou retrait au salon), questions à poser au client (« Couleur du ruban », obligatoire ou non), ordre d'affichage, proposé ou masqué.

Sur la page `/gift`, après « Continuer », une fenêtre propose « Carte cadeau par email uniquement » ou l'un des cadeaux ; un cadeau livré demande l'adresse. Le total (carte + cadeau × quantité + livraison) est payé en une fois sur Stripe, avec une ligne par élément. La fenêtre n'apparaît pas si le catalogue est vide ; elle n'existe que pour les cartes cadeaux, jamais pour une réservation ou un pack.

Après paiement, le webhook Stripe crée la carte **et** une commande (`gift_card_addon_orders`) ; l'acheteur reçoit le détail du cadeau dans son email, les salons un email « cadeau physique à préparer ». L'onglet **Commandes** liste les commandes par statut (à préparer, expédié, livré, annulé) avec l'adresse, les réponses et une zone de notes (n° de suivi).

Prix et frais sont toujours relus dans le catalogue au moment du paiement, jamais pris du navigateur.

## Migration

`database/migrations/2026-11-20_gift_card_addons_and_design.sql` — à exécuter dans l'éditeur SQL Supabase. Sans elle : visuel par défaut, aucun cadeau proposé, et si une commande arrivait quand même l'email aux salons le signale pour une saisie manuelle.

## Tests

`npm run test:gift-cards` : tarification et validation des cadeaux physiques, réglages du design, retour à la ligne du nom de prestation sur la carte.
