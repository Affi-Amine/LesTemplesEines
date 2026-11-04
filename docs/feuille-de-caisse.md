# Feuille de caisse journalière

Pour chaque salon et chaque jour, l’application produit la « Feuille de caisse journalière » : les prestations de la journée avec leur encaissement par moyen de paiement, le récapitulatif des encaissements, les compteurs (cartes cadeaux, forfaits, cartes tampon, absences) et la signature du responsable. Le PDF reprend la mise en page du document utilisé en salon.

## Où

Administration › **Feuille de caisse** (`/admin/caisse`), accessible aux rôles `admin` et `manager`. Les paramètres de clôture automatique ne sont modifiables que par un `admin`.

## Comment une feuille est construite

Pour le salon et la date choisis (jour de Paris) :

- une ligne par rendez-vous `confirmed`, `in_progress`, `completed` ou `no_show` ; les blocages, annulations et demandes non confirmées n’y figurent pas ;
- **client** : nom de la fiche client, ou « Passage » sans fiche ;
- **prestation** : la ou les prestations du rendez-vous ;
- **colonnes d’encaissement** : CB (`card`), Esp. (`cash`), T/W (`treatwell`), En ligne (`stripe`), Autre (`check`, `other`, `on_site` sans précision, `mixed` sans détail). Si des paiements ont été enregistrés dans la table `payments`, ce sont eux qui alimentent les colonnes (un paiement mixte donne une ligne par moyen) ; sinon le moyen et le montant du rendez-vous ;
- **CC / Abo.** : « Carte cadeau » (`gift_card`), « Forfait » (`pack`), « Carte tampon » (`loyalty`). Ces règlements ne comptent pas dans les montants en euros, ils sont comptés en nombre de personnes ;
- **masseuse** : nom(s) de l’équipe du rendez-vous ;
- **heure** : durée au format du document (`1.30` = 1 h 30) ;
- une absence (`no_show`) reste listée, sans montant ; son prix va dans « Montant non encaissé » ;
- une prestation non réglée reste listée, sans montant ; elle est comptée dans « Prestations non réglées » et n’entre pas dans les totaux.

Référence : `FC-AAAAMMJJ-<SALON>` (par exemple `FC-20261101-NUAD`).

## Clôture

**Clôturer** fige la journée : les lignes et les totaux sont copiés dans `cash_sheet_closures` avec la date et l’heure de clôture, le nom du responsable et qui a clôturé. Le PDF est ensuite toujours produit depuis cette copie, même si des rendez-vous sont modifiés après coup. Une journée clôturée ne peut pas être clôturée une seconde fois ; pour la refaire, supprimer la ligne dans `cash_sheet_closures`.

Avant la clôture, la page et le PDF affichent un **aperçu** (« Aperçu — non clôturée » dans la case Clôture), que l’on peut télécharger à tout moment, pour n’importe quelle date passée.

**Clôturer et envoyer** envoie le PDF par e-mail aux destinataires du salon. **Renvoyer** le réexpédie plus tard. L’envoi est noté sur la clôture (date, destinataires).

### Destinataires

Dans l’ordre : les adresses saisies dans les paramètres du salon ; sinon l’e-mail du salon ; sinon `NOTIFICATIONS_ADMIN_EMAIL`. L’envoi passe par Resend (`RESEND_API_KEY`), comme les autres e-mails.

## Clôture automatique

Désactivée par défaut. Pour chaque salon, un administrateur peut l’activer et régler :

- l’**heure de clôture** (heure de Paris). Une heure avant 05:00 clôture la veille, pour les salons qui ferment après minuit ;
- le **responsable** dont le nom signe la feuille ;
- les **destinataires**.

La tâche planifiée `GET /api/cron/cash-sheet` (toutes les 15 minutes dans `vercel.json`, jeton `CRON_SECRET`) clôture et envoie chaque salon activé dès que son heure est passée, une seule fois par jour. Un créneau manqué est rattrapé au passage suivant du même jour. Une journée déjà clôturée à la main n’est pas reclôturée. Les clôtures automatiques portent `closed_by = 'auto'`.

## Mise en place

1. Exécuter `database/migrations/2026-11-04_cash_sheets.sql` dans le SQL Editor Supabase.
2. Déployer. `CRON_SECRET` et `RESEND_API_KEY` sont déjà requis par ailleurs.
3. Dans la page, régler le responsable et les destinataires de chaque salon ; activer l’automatique si souhaité.

## Vérification

`npm run test:cash-sheet` vérifie l’agrégation (colonnes, paiements mixtes, bons, absences, non réglés, durée, référence) sans base de données et produit un PDF d’exemple dans le dossier temporaire indiqué par le script.
