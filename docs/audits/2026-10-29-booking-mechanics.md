# Vérification des mécaniques de réservation et de déplacement

## Corrections

- Même moteur de déplacement pour le salon, l’agenda général et la vue semaine.
- Sur iPad : bouton **Déplacer**, maintien puis glissement, aperçu de la cible,
  confirmation explicite. Le mode est désactivé après dépôt ou annulation.
  Hors de ce mode, les cartes gardent le défilement natif et le toucher de consultation.
- Le calcul suit le début de la carte et conserve son point de prise : un simple
  maintien sans déplacement ne décale plus l’horaire d’une demi-heure.
- Chaque représentation d’un duo possède un identifiant de drag distinct.
  Les identifiants métier, la durée et les deux masseuses sont conservés.
- Horaires de Paris, date complète, durée réservée, créneau passé, fermeture,
  affectation active/qualifiée et conflits sur toute l’équipe revérifiés.
- Soins commencés/terminés, annulations, absences et blocages ne se déplacent pas
  par glisser-déposer. Une réactivation explicite reste contrôlée séparément.
- Confirmation avant toute mutation ; double appui verrouillé ; aucun déplacement
  optimiste affiché avant réponse du serveur. Les erreurs restent dans la fenêtre.
- Le voile d’une fenêtre fermée n’intercepte plus le geste suivant : les sorties
  animées de fenêtres de l’admin sont supprimées, sur ordinateur comme sur iPad.
- Version du rendez-vous transmise au serveur et contrôlée dans la transaction :
  une confirmation ancienne ne doit pas écraser un changement concurrent.
- Les conflits remontent en HTTP 409 pour permettre au formulaire de recharger
  les disponibilités, y compris lors d’une création.
- Le formulaire de modification conserve les affectations même si une relation
  n’est pas développée, n’envoie que les champs modifiés et évite les doubles envois.
  Les annulations n’exigent pas de revalider des champs de planning périmés.

## Correction serveur atomique

L’ancienne mise à jour pouvait affecter la nouvelle masseuse sur l’ancien horaire,
puis déplacer le rendez-vous alors que l’ancienne équipe était encore attachée.
Ces états intermédiaires provoquaient des faux conflits ou des écritures partielles.

La [nouvelle migration](../../database/migrations/20261028231017_admin_reschedule_appointment_atomic.sql)
enregistre l’horaire, l’équipe, les champs associés et les éventuels paiements de
cette opération dans une transaction. Les protections de chevauchement existantes
s’appliquent à l’état final ; toute erreur rétablit l’état initial. La fonction
utilise `SECURITY INVOKER` et n’est exécutable que par le rôle serveur, conformément
aux [recommandations Supabase sur les fonctions](https://supabase.com/docs/guides/database/functions).

**Déploiement requis** : appliquer d’abord la migration existante
`2026-10-25_client_appointment_management.sql`, puis la nouvelle migration, avant
de déployer ce code. La nouvelle migration refuse de s’installer sans les triggers
anti-chevauchement. L’API refuse les déplacements si la fonction manque ; elle ne
revient pas à l’ancienne écriture partielle. Aucune migration n’a été appliquée en ligne.

## Vérifications

| Domaine | Vérification |
| --- | --- |
| Déplacement pur | Changement de date et de masseuse, no-op, durée réelle conservée malgré un changement de catalogue, fermeture exacte, passé, créneaux malformés |
| Fuseaux | Heure de Paris en hiver/été ; navigateurs UTC, Los Angeles et Tokyo |
| Duo | Deux instances distinctes, équipe entière conservée, conflit de la seconde masseuse, remplacement implicite interdit |
| Tactile Chromium | 13 scénarios : maintien immobile, abandon du geste, annulation de confirmation, solo, duo, double confirmation, conflit HTTP 409, perte réseau, scroll natif, scroll automatique au bord, modification et annulation depuis la fiche |
| Souris Chromium | Déplacements dans la fiche salon et l’agenda général, cible réellement survolée, annulation sans écriture et enchaînement immédiat après fermeture du dialogue |
| API de modification | Un seul appel atomique avec version, absence d’écriture directe partielle, codes 409/503 et refus des états non déplaçables |
| Postgres isolé | Faux conflits ancien horaire/ancienne masseuse, conflits finaux, rollback complet si une affectation ou un paiement échoue, version périmée, permissions et migration répétable |
| Création/créneaux | Équipe active/qualifiée, salon, durée entière, plusieurs prestations, choix invalidé après changement du contexte |
| Annulation/absence | Libération des créneaux solo/duo, historique et paiement conservés, nouvelle réservation et réactivation concurrente contrôlées |
| Paiement affiché | Payé en ligne/sur place, acompte, impayé et soin effectué restent distincts |
| Fiche client et gestion client | Contacts, collisions, modifications concurrentes, jetons, délais, permissions et notifications simulées |

Commandes reproductibles : `npm run test:calendar`, `npm run test:booking`,
`npm run test:ui`, `npm run test:clients`, `npm run test:management`,
`node scripts/test-staff-salon-mapping.cjs`, `tsc --noEmit`.
Les recettes navigateur sont `scripts/qa-ipad-moves.js` et
`scripts/qa-desktop-moves.js`, avec Playwright CLI et le serveur local sur 3190.

Les données et appels externes des tests sont simulés. Postgres est exécuté dans
PGlite, sans connexion à la production. L’inertie et les performances physiques
de Safari/iPad, les paiements réels et les envois réels ne sont pas mesurés ici.
