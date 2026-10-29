# Audit et refonte tactile de l’administration — 28 octobre 2026

> La [seconde refonte du poste de travail iPad](2026-10-28-ipad-workspace.md)
> remplace la présentation tablette décrite ci-dessous par un agenda natif plus
> compact. Ce document conserve le diagnostic et les corrections de la première passe.

## Périmètre

Administration : navigation commune, salons, tableau de bord d’un salon,
calendrier général, prestations, clients, personnel, rendez-vous, cartes cadeaux,
packs, packs clients, statistiques et paramètres. Le site public et l’espace
employé ne font pas partie de cette intervention.

## Constats et corrections

| Constat dans le code | Conséquence | Correction |
| --- | --- | --- |
| Barre latérale permanente dès 768 px | Largeur utile réduite sur iPad | Navigation en panneau jusqu’à 1536 px, page sur toute la largeur |
| Déconnexion en position absolue au bas du menu | Risque de chevauchement avec les liens sur faible hauteur | Déconnexion après les liens, menu en colonne et défilable |
| Conteneur principal `h-screen` avec `overflow-auto` | Défilement imbriqué, hauteur liée à `vh` | Défilement natif du document, hauteur minimale en `dvh` |
| Panneau mobile sans gestion modale du focus | Navigation et fond pouvaient rester simultanément interactifs | Panneau Radix Dialog, fond bloqué seulement pendant son ouverture, fermeture au changement de rubrique et au passage sur grand écran |
| Animations de fermeture du panneau et de son voile | Risque d’interception transitoire d’un toucher | Ouverture et fermeture immédiates pour cette navigation |
| Calendrier étiré sur toute la carte | Cases trop hautes et fin du mois éloignée | Largeur plafonnée à 344 px, place réservée dans la grille, cellules tactiles de 44 px |
| Actions de 32–36 px et champs de 14 px | Touchers imprécis, risque de zoom Safari à la saisie | Cibles principales de 44 px minimum, liens de navigation de 48 px, champs de 16 px sur écran tactile |
| Icônes cloche et réglages de l’en-tête sans aucun gestionnaire ni lien | Boutons visibles qui ne font rien | Suppression de ces actions factices ; les paramètres restent accessibles dans le menu selon le rôle |
| PointerSensor et TouchSensor sur les cartes du planning | Glisser-déposer en concurrence avec le défilement au doigt | Déplacement à la souris, consultation/modification par toucher sur tablette |
| Quarts d’heure de 19 px en vue jour | Sélection difficile d’un horaire précis | Heures de 180 px sur écran tactile, soit au moins 44 px par quart d’heure ; positions et durées des cartes recalculées à la même échelle |
| Déplacement au doigt supprimé pour libérer le scroll | Besoin de conserver le changement d’horaire sur tablette | Action « Modifier la date ou l’heure » dans le salon, utilisant le formulaire et l’API de modification existants |
| Tableau Prestations de plus de 1 100 px dès 768 px, dans une carte masquée en débordement | Colonnes/actions coupées | Présentation en fiches jusqu’au grand écran, tableau conservé à partir de 1536 px |
| Barre de filtres Prestations sous l’en-tête fixe | Risque de masquage après changement du cadre de navigation | Position sticky adaptée à l’en-tête tablette |
| Formulaires limités en `90vh` | Hauteur ne suivant pas les barres Safari | Limites en `90dvh` dans les fenêtres de l’administration |
| Flou d’arrière-plan sur des surfaces défilantes | Coût de composition graphique évitable | Flou désactivé sur les surfaces de l’administration en mode tactile |

Les styles tactiles sont limités à l’administration et suivent `(pointer: coarse)`.
Ils couvrent également les fenêtres et menus rendus dans un portail. Les tailles
de planning suivent le changement de périphérique via `matchMedia` ; les valeurs
initiales serveur restent déterministes.

## Vérifications

- TypeScript : `node node_modules/typescript/bin/tsc --noEmit`.
- Tests existants : `npm run test:ui` (sélection de créneaux et présentation des paiements).
- Navigateur Chromium avec toucher émulé : 768 × 1024, 820 × 1180,
  1024 × 768, 1180 × 820, 1366 × 1024 et 390 × 844.
- Parcours : ouvrir le menu, toucher Salons, entrer dans un salon, atteindre
  novembre 2026, sélectionner le 29, vérifier la taille des cases, descendre
  dans la page, rouvrir le menu et atteindre la déconnexion sans chevauchement.
- Contrôle des douze rubriques en 820 × 1180 et 1180 × 820 : absence de
  débordement horizontal du document et absence de conteneur de scroll sur
  `main`. Vérification d’une fenêtre de modification de salon et de son onglet
  Horaires, ainsi que de la taille des champs.
- Geste tactile avec déplacement du doigt sur une carte du planning : le
  document descend et aucun rendez-vous ne s’ouvre accidentellement.
- Quart d’heure mesuré à au moins 44 px ; modification du rendez-vous simulé
  au 29 novembre à 14 h 30 : un seul PATCH, envoyé à 13 h 30 UTC conformément
  au fuseau Europe/Paris. Retour à la navigation ordinateur vérifié à 1536 px.
- Recette reproductible de ces derniers contrôles :
  `scripts/qa-ipad-admin.js`, à exécuter avec Playwright CLI `run-code --filename`
  et le serveur local sur le port 3190.
- Les appels API des vérifications de navigateur sont interceptés avec des
  données de démonstration. Aucun rendez-vous réel n’est créé ou modifié.

## Limites

L’émulation Chromium permet de vérifier les dimensions, les cibles et les
interactions. Elle ne mesure pas les performances de Safari sur un iPad réel,
le comportement du clavier logiciel ou l’inertie physique du défilement.
Une validation sur iPad/Safari reste nécessaire pour ces points ; aucun chiffre
de fluidité ou de fréquence d’image n’est annoncé.
