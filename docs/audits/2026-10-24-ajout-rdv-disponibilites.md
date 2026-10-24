# Ajout de rendez-vous : créneau avant masseuse

Les formulaires administratifs du tableau de bord salon et du calendrier utilisent désormais le même composant `QuickCreateModal`.

Le parcours devient : soin → jour et créneau → masseuses disponibles sur toute la durée → client et paiement. Il n'est plus nécessaire de choisir une masseuse pour obtenir les créneaux. Chaque horaire indique le nombre de personnes disponibles. Pour un duo, seules les heures permettant de mobiliser deux personnes simultanément sont proposées. Quand il n'y a qu'une équipe possible, elle est présélectionnée ; sinon l'utilisateur choisit les personnes ou utilise « Choisir pour moi ».

Tous les créneaux sont accessibles, regroupés en matin, après-midi et soir. La limite des 25 premiers horaires a été supprimée. Une journée vide propose « Voir le lendemain » et les erreurs réseau proposent une nouvelle tentative. Sur mobile, le corps du formulaire défile entre le titre et les boutons fixes.

## Garde-fous

- La sélection est liée au salon, au soin, à la date, à la durée et au nombre de personnes requis. Elle devient immédiatement invalide si ce contexte change.
- Les personnes proposées sont actives, réservables et qualifiées dans ce salon. Leur identifiant doit aussi être présent dans le créneau renvoyé par le serveur.
- Les heures sont stockées en ISO et affichées en Europe/Paris. Les créneaux passés, d'une autre journée, trop courts, mal formés ou avec une équipe insuffisante sont exclus.
- Les requêtes de disponibilité ne sont plus filtrées par une masseuse présélectionnée. Leur clé comprend le contexte du soin et elles peuvent être annulées lorsqu'on change de choix.
- Les disponibilités sont actualisées périodiquement, à la demande, puis une dernière fois juste avant l'envoi avec relecture de l'équipe. Un changement de durée ou d'effectif du soin impose un nouveau choix.
- Une réponse ancienne ne remplace pas le contexte courant. Une équipe devenue indisponible est retirée de la sélection.
- En cas de conflit avant l'envoi ou de réponse serveur 409, les informations client restent saisies et le formulaire propose les disponibilités actualisées.
- Un verrou local empêche les doubles envois. Le formulaire ne peut pas être fermé pendant l'enregistrement.
- Le client et le serveur partagent le même schéma de validation des coordonnées. Les erreurs de téléphone/email sont expliquées dans le formulaire.
- Le blocage de créneau conserve son parcours séparé et ne crée pas de client.

Le contrôleur partagé est `lib/hooks/use-appointment-schedule.ts`. Ses règles de sélection sont isolées dans `lib/calendar/slot-selection.ts` et testées par `scripts/test-slot-selection.cjs`. Le composant d'affichage est `components/calendar/appointment-schedule-picker.tsx`.

## Vérifications

`npm run test:booking` couvre les règles de sélection et la validation commune des coordonnées, en plus des régressions métier et SQL existantes. `npx tsc --noEmit` vérifie les types.

Le parcours a été exercé avec le CLI Playwright dans Chrome local, en remplaçant toutes les routes API par des fixtures : solo, duo, choix de l'équipe, changement de date/soin, erreur réseau et nouvelle tentative, journée vide et lendemain, réponse retardée, créneau pris avant envoi, conflit serveur 409, conservation du client, double clic, créneau du soir, calendrier et blocage sans client. Les dimensions 1365×1000 et 390×844 ont été contrôlées, y compris le défilement sans déplacement du titre ni des boutons. Les captures locales sont dans `output/playwright/slot-first-desktop.png` et `slot-first-mobile.png`.

Aucune création réelle n'a été effectuée. Un avertissement de réhydratation préexistant dans `app/admin/layout.tsx` (authentification initialisée depuis localStorage) a été observé durant les accès directs de test. Le lint reste bloqué par la configuration préexistante qui référence `eslint-config-next` absent du dépôt.

Ce lot concerne l'ajout administratif. Le parcours public de réservation n'a pas été réorganisé. Il bénéficie uniquement des améliorations communes de récupération des disponibilités et de validation client.

## Mise en service

Pas de nouvelle migration pour cette interface. Le lot dépend cependant de l'opération atomique `save_appointment_schedule` préparée précédemment : la migration `supabase/migrations/20261024115214_salon_booking_integrity.sql` doit être appliquée avant le déploiement de l'ensemble des changements du dépôt. La vérification finale côté serveur demeure obligatoire entre l'affichage d'une disponibilité et son enregistrement.
