# Renforcement des salons et réservations

## Changements préparés dans ce dépôt

Les salons sont identifiés par leur UUID. La normalisation des slugs est limitée à l'entrée publique ; une correspondance ambiguë est refusée. Une contrainte unique sur `lower(btrim(slug))` empêche l'apparition de nouveaux doublons de liens sans renommer les URL existantes.

Le calendrier utilise des requêtes indexées par salon et période avec signal d'annulation. Une réponse ancienne reste attachée à son ancienne clé et ne peut remplacer le nouveau planning. Les fenêtres de détail, de création et de déplacement se ferment au changement de salon. Une erreur affiche un état indisponible. Le composant de réservation est remonté avec l'UUID du nouveau salon. L'ancien écran `/admin/schedule`, fondé sur des exemples, redirige vers le calendrier réel.

Le serveur et les API de disponibilités appliquent des règles communes : praticien actif, rôle réservable, salon exact, prestation active et reliée au salon, qualifications par praticien, horaires en Europe/Paris, exceptions datées prioritaires, pauses conservées. Les conflits couvrent aussi les rendez-vous commencés la veille. Les dates reçues par l'API doivent comporter un fuseau. Un compte désactivé ne peut plus se connecter.

Convention conservée pour ne pas rendre 31 praticiens soudainement indisponibles : sans aucun planning hebdomadaire configuré, les horaires du salon s'appliquent. Dès qu'un planning hebdomadaire existe, les jours omis sont non travaillés. Une exception datée remplace les plages récurrentes de ce jour. Une exception sans plage valide ferme ce jour. Cette convention doit être expliquée à l'équipe ; l'édition complète des absences reste à construire.

Une liste de soins vide signifie « tous les soins du salon » pour CE praticien. Une liste non vide est restrictive pour CE praticien. Configurer une autre équipe ne change plus cette permission.

## Écriture atomique du planning

Migration : `supabase/migrations/20261024115214_salon_booking_integrity.sql`, créée par le CLI Supabase. Elle ajoute `save_appointment_schedule` et le contrôle SQL des horaires. Créations normales, blocages, modifications et réactivations passent par cette RPC via `lib/appointments/persist.ts`.

Dans une transaction, l'opération :

1. Charge et verrouille le rendez-vous existant, avec contrôle facultatif `expected_updated_at` pour éviter d'écraser une modification concurrente.
2. Verrouille les praticiens dans un ordre stable ; revalide salon, activité, soin, effectif, qualification et horaires.
3. Revérifie les chevauchements après acquisition des verrous, pour le principal et toutes les affectations.
4. Écrit le rendez-vous et toute son équipe ensemble. Une erreur annule l'ensemble de cette opération.

Les écritures de planning concurrentes utilisent ces mêmes verrous. L'opération exige READ COMMITTED pour lire un état frais après l'attente ; un autre niveau d'isolation est explicitement refusé. Aucun repli vers des INSERT/UPDATE séparés n'est permis si la migration manque.

Les deux fonctions RPC sont `SECURITY INVOKER`, accessibles seulement à `service_role`. Les droits INSERT/UPDATE/DELETE sur les deux tables de planning sont retirés à anon et authenticated. Un trigger empêche le transfert, la désactivation ou le passage à un rôle non réservable d'un praticien avec des rendez-vous bloquants à venir. L'API renvoie l'explication ; il faut réaffecter ces rendez-vous avant de modifier le praticien. Les données historiques sont conservées.

## Vérifications et limites

- `npm run test:booking` : tests des routes, des associations et de la migration SQL réelle exécutée sur PGlite (PostgreSQL isolé, sans réseau ni données clients). Scénarios : salons distincts, slugs ambigus, praticien inactif, principal divergent, pause, exception, conflit, annulation/réactivation, équipe duo, rollback d'une affectation échouée, modification périmée, permissions et transfert de praticien.
- `npx tsc --noEmit` : contrôle des types.
- Le build a besoin des polices Google. La vérification utilise la valeur locale SUPABASE_URL comme NEXT_PUBLIC_SUPABASE_URL dans le processus de build, sans modifier `.env`.
- Le moteur PGlite utilise une connexion sérialisée : les règles SQL et le rollback sont testés ; un test de contention multi-connexion sur PostgreSQL de préproduction reste requis. Aucun incident de navigation n'a été reproduit sur le navigateur de production.
- ESLint ne démarre pas avec la configuration actuelle : le dépôt ne fournit pas le paquet `eslint-config-next` demandé par `eslint.config.mjs`. Ce défaut préexistant est distinct de la vérification TypeScript.

Ce lot rend atomiques le rendez-vous et ses affectations. Les encaissements, consommations de forfaits, notifications et changements de catalogue restent des opérations séparées : leur idempotence et leur transactionnalité nécessitent un autre lot. La gestion des accès manager par salon et la révocation des sessions existantes ne sont pas refondues ici. Un compte désactivé peut encore posséder un ancien jeton valide ; ce chantier d'authentification reste nécessaire.

## Activation en préproduction puis production

Ne pas déployer uniquement le code : il dépend de la nouvelle RPC.

1. Vérifier le projet Supabase réellement utilisé par l'hébergeur et ses variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Le `.env` local n'est pas une preuve de la configuration de production.
2. Sauvegarder la base et tester cette migration sur une copie disposant du schéma courant, notamment `paid_at` et les colonnes Stripe. Ce dépôt contient des migrations historiques hors du répertoire du CLI ; ne pas lancer `db reset` ou un rattrapage global à l'aveugle.
3. Suspendre temporairement les nouvelles réservations et les modifications de planning, y compris les webhooks qui créent des rendez-vous. Attendre les écritures déjà en cours.
4. Appliquer uniquement cette migration additive avec la procédure de migration habituelle/SQL Editor. La transaction refuse des slugs normalisés dupliqués ; les examiner si cela arrive. Elle ne corrige et ne fusionne aucun historique.
5. Déployer le code correspondant, puis tester un solo, un duo, un blocage, une modification et une annulation. Vérifier un compte service-role et un compte utilisateur ordinaire. Depuis deux connexions PostgreSQL de préproduction, tenter le même créneau simultanément : une seule création doit aboutir. Vérifier aussi le chevauchement via un praticien secondaire.
6. Tester navigation A→B→A en ralentissant les réponses réseau, puis rouvrir les réservations. Contrôler les erreurs 400/409/500 et relancer le script d'audit en lecture seule.

Les rendez-vous historiques et les quelques écarts à venir identifiés dans l'audit ne sont pas réécrits. Ils restent à vérifier individuellement avec les responsables des salons.

Références : [fonctions et privilèges Supabase](https://supabase.com/docs/guides/database/functions), [pagination Supabase](https://supabase.com/docs/reference/javascript/using-modifiers-range).
