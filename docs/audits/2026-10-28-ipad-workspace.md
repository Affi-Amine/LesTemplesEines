# Poste de travail iPad — seconde refonte

> Le [contrôle des mécaniques du 29 octobre](2026-10-29-booking-mechanics.md)
> rétablit le glisser-déposer dans un mode explicite et fiabilise son enregistrement.

## Objectif

Ouvrir directement le planning et laisser le navigateur faire défiler la page
au doigt, sans traverser un tableau de bord, un calendrier mensuel ou une surface
qui capte le déplacement horizontal.

La référence d’usage est l’[agenda professionnel Planity](https://support.planity.com/hc/fr/articles/28111333640850-Comment-naviguer-et-g%C3%A9rer-l-affichage-de-mon-agenda) :
navigation par dates, agendas des collaborateurs et précision d’affichage.
L’implémentation conserve les services, règles de réservation et paiements
propres aux Temples.

## Changements

- Nouvelle vue `TabletAgenda`, partagée entre la fiche salon et l’agenda général.
  Elle s’active sous 1536 px ou avec un pointeur tactile.
- Planning visible à l’arrivée. Calendrier mensuel et statistiques à la demande.
- Les vues d’ensemble mois/semaine restent accessibles depuis le résumé de
  l’agenda général, avec un bouton de retour à la grille tactile.
- Commandes et noms des masseuses dans un seul en-tête sticky, opaque.
- Navigation permanente de 80 px sur tablette : Agenda, Salons, Clients et RDV.
  Le menu complet reste accessible. Le retour du focus ne déplace pas la page.
- Correction du 29 octobre à la demande du propriétaire : palette sombre et dorée
  d’origine conservée sur téléphone et tablette, y compris dans les fenêtres.
- Une seule grille native sur tablette. En mode normal, aucun `useDraggable` ou
  `useDroppable` dans les cellules et aucun listener de scroll. Le mode Déplacer
  active temporairement ces éléments pour un geste volontaire, puis se désactive.
- Aucun conteneur de défilement horizontal dans la grille tablette. Toutes les
  masseuses sont visibles côte à côte par défaut, sans pagination, sur téléphone
  et tablette. Le filtre individuel reste disponible. Les rendez-vous multi-masseuses
  restent représentés dans chaque colonne concernée.
- Mode 30 minutes par défaut, avec des cellules d’environ 48 px. Mode 15 minutes
  disponible, avec des cellules d’au moins 44 px. La durée et la position des
  rendez-vous suivent la même échelle ; aucune modification des disponibilités.
- Cartes de rendez-vous positionnées dans la colonne entière : elles peuvent
  traverser les lignes horaires sans être coupées.
- Rendez-vous regroupés une fois par masseuse, au lieu de filtrer toute la journée
  dans chaque ligne de chaque colonne.
- Les formulaires de création et modification de la fiche salon sont montés
  uniquement à l’ouverture. La liste des créneaux ne possède plus sa propre
  zone de scroll dans les formulaires de l’admin sur tablette.
- Les rafraîchissements de fond ne réinsèrent pas de message de chargement au
  milieu du planning. Les requêtes devenues inutiles après changement de date
  peuvent être annulées.
- Métadonnées des salons conservées en cache une minute, avec invalidations
  existantes ; les disponibilités et rendez-vous conservent leur actualisation.
- Clients et listes de rendez-vous en fiches sur tablette, pour éviter les
  tableaux à défilement horizontal. Cartes salons plus compactes et bouton
  « Ouvrir le planning ».

## Vérification et limites

Les vérifications utilisent des API de démonstration interceptées ; aucune
réservation réelle n’est modifiée. Elles couvrent la visibilité initiale de la
grille, la sélection du 29 novembre, la vue complète de l’équipe et sa palette d’origine, les deux
précisions, la modification d’horaire, les accès rapides et la rotation.

Le geste est vérifié par des événements tactiles de début, déplacement et fin,
sur une carte de rendez-vous : le document doit commencer à descendre dans les
80 premiers pixels du déplacement et aucun rendez-vous ne doit s’ouvrir.
Les ancêtres des cellules sont contrôlés pour exclure les zones de scroll
imbriquées. Le changement d’heure simulé conserve le fuseau Europe/Paris.

Résultats : six formats validés (768 × 1024, 820 × 1180, 1024 × 768,
1180 × 820, 1366 × 1024, 390 × 844). Pour chaque format : grille visible à
l’arrivée, pas de surface de scroll imbriquée dans ses ancêtres, équipe complète visible, palette d’origine
et 29 novembre sélectionnable. Le geste de 200 px fait descendre le
document de 185 px dans cette émulation, sans ouvrir un rendez-vous. Modification
d’horaire, précision 15 minutes, agenda général et retour ordinateur validés.

TypeScript et `npm run test:ui` passent. La recette principale est conservée dans
`scripts/qa-ipad-admin.js` (Playwright CLI `run-code --filename`, serveur local
sur le port 3190). Les captures sont dans `output/playwright/ipad-workspace-*.png`.

L’émulation Chromium ne mesure ni la fréquence d’image ni l’inertie de Safari
sur un iPad physique. Une validation sur l’appareil reste nécessaire pour ces
deux aspects. Cette intervention ne comprend pas le déploiement.
