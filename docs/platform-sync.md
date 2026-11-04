# Synchronisation Planity / Treatwell

Les trois agendas (site, Planity, Treatwell) se mettent à jour mutuellement : une réservation prise sur l’un apparaît sur les deux autres, un déplacement ou une annulation est reporté dans la direction où il a été fait. Ni Planity ni Treatwell n’exposent d’API publique : le code dialogue avec les mêmes points d’entrée que leurs applications web professionnelles (`lib/sync/planity.ts`, `lib/sync/treatwell.ts`).

## Ce que fait la synchronisation

À chaque passage, pour chaque plateforme :

1. **Lecture.** Les réservations de la plateforme sur la fenêtre (aujourd’hui + `PLATFORM_SYNC_DAYS`, 60 jours par défaut) et celles du site sur la même période.
2. **Paires déjà reliées.** Chaque rendez-vous relié est comparé, des deux côtés, à l’état enregistré au dernier passage (`snapshot`). Le côté qui a changé est reporté sur l’autre. Si les deux ont changé, l’annulation l’emporte, sinon la modification la plus récente.
3. **Réservations connues de la plateforme seulement.** Elles sont importées sur le site (client retrouvé par téléphone ou e-mail, sinon créé). Avant d’importer, la synchro cherche un jumeau saisi à la main des deux côtés (même salon, même heure, même client ou même masseuse) et relie les deux au lieu de doubler.
4. **Rendez-vous connus du site seulement.** Ils sont envoyés sur la plateforme pour bloquer le créneau.

Une réservation Treatwell arrive donc sur Planity en deux temps dans le même passage : importée sur le site, puis envoyée sur Planity comme n’importe quel rendez-vous du site. Un rendez-vous n’est jamais renvoyé vers la plateforme d’où il vient (`appointments.source`).

### Ce qui est écrit sur chaque plateforme

| Plateforme | Création | Déplacement / annulation d’une réservation client de la plateforme |
|---|---|---|
| Planity | Un vrai rendez-vous dans l’agenda (service associé si trouvé, sinon un titre), signé « Les Temples » | Reporté dans Planity |
| Treatwell | Un **blocage** sur la colonne de la masseuse, nommé prestation · client, étiqueté `[LT-…]` | **Jamais modifié** : paiement, remboursement et messages au client passent par Treatwell Connect. La synchro le signale dans le rapport pour que le salon le fasse à la main |

Les blocages Treatwell ne créent ni client Treatwell, ni vente dans la caisse, ni message.

### Correspondances salons / masseuses / prestations

Les salons sont appariés aux établissements par leur nom, les masseuses aux colonnes d’agenda par leur nom (le nom affiché est `last_name`, « Madame » étant dans `first_name`), les prestations par durée identique puis similarité de nom. Une colonne qui ne correspond à aucune masseuse du site (une cabine de hammam, par exemple) est ignorée.

Quand le nom diffère, l’association se règle dans le back-office (voir plus bas) ou directement dans la table `platform_mappings`. `external_id` à NULL signifie « ne jamais synchroniser cet élément ».

### Limites connues

- Au plus 120 créations (imports + envois) par plateforme et par passage ; un gros historique se rattrape en quelques passages.
- Un conflit de créneau (la masseuse est déjà prise) n’est pas résolu : le rendez-vous est quand même envoyé pour que le chevauchement soit visible, et le rapport le signale comme double réservation à régler à la main.
- Un client de la plateforme sans téléphone n’a pas de fiche client sur le site (le téléphone est obligatoire) : son nom est gardé dans la note interne du rendez-vous.
- Les rendez-vous terminés ne sont plus comparés.

## Mise en place

1. **Base de données.** Exécuter dans l’ordre, dans le SQL Editor Supabase :
   - `database/migrations/2026-10-30_platform_sync.sql` (liens, associations, sessions, historique des passages) ;
   - `database/migrations/2026-11-01_platform_sync_admin.sql` (identifiants gérés depuis le back-office).
   Les deux peuvent être relancées sans risque.
2. **Variables d’environnement** (voir `.env.example`) :
   - `CRON_SECRET` : jeton attendu par `/api/cron/platform-sync` (`Authorization: Bearer …`) ;
   - `PLATFORM_SYNC_MODE` : `live` pour écrire, toute autre valeur = simulation (rapport seulement). C’est l’interrupteur général ; le back-office ne peut pas le contourner ;
   - `PLATFORM_SYNC_DAYS` : profondeur de la fenêtre en jours (60 par défaut) ;
   - `PLATFORM_SYNC_SECRET` : clé de chiffrement des sessions et identifiants stockés en base (à défaut `JWT_SECRET` est utilisé). La changer rend les sessions illisibles : il faut alors se reconnecter ;
   - `PLANITY_USERNAME` / `PLANITY_PASSWORD` : repli si aucun identifiant n’a été saisi dans le back-office.
3. **Planification.** Appeler `GET /api/cron/platform-sync` à intervalle régulier avec le jeton. Sur Vercel, déclarer la tâche dans `vercel.json` (`crons`), par exemple toutes les 10 minutes ; la route accepte `?mode=dry-run` pour forcer une simulation et `?platform=planity` pour ne traiter qu’une plateforme. Un passage dure de quelques secondes à quelques minutes (`maxDuration` 300 s).
4. **Première exécution.** Laisser le déploiement en simulation, lancer un passage depuis le back-office, lire le rapport (associations, avertissements, actions prévues), corriger les associations, puis passer `PLATFORM_SYNC_MODE=live`.

### Connexion aux plateformes

**Planity** se connecte seul avec l’identifiant et le mot de passe du compte Planity Pro (Firebase). Le jeton de rafraîchissement est conservé chiffré ; une reconnexion complète n’a lieu que s’il expire.

**Treatwell** ne peut pas être connecté par le serveur : la page de connexion de Treatwell Connect impose une vérification Cloudflare qu’une personne doit passer. La session (cookies « Rester connecté », valables environ trois mois) vient donc toujours d’un navigateur :

- soit le bouton **Connecter Treatwell** du back-office : il ouvre Treatwell Connect dans un onglet et guide en trois étapes (connexion, « Copier en tant que cURL » dans l’onglet Réseau, coller) ;
- soit `npm run sync:login -- treatwell` sur un poste : une fenêtre Chrome s’ouvre, on se connecte en cochant « Rester connecté », on ferme la fenêtre et la session est enregistrée en base (et dans `.sync/treatwell-session.enc`) ;
- soit l’import direct dans le back-office (voir ci-dessous).

Les cookies sont rafraîchis automatiquement à chaque passage, tant que la session est valide.

> **Pourquoi pas une capture automatique ?** Un navigateur n’autorise jamais une page à lire les cookies d’un autre site (politique d’origine), et les cookies de connexion Treatwell sont `httpOnly` : même un script exécuté sur la page de Treatwell ne les verrait pas. Une capture entièrement automatique supposerait un navigateur hébergé côté serveur, impossible sur Vercel (fonctions sans état) et donc écartée. L’assistant guidé est la solution retenue.

## Espace back-office : Administration › Synchronisation

Réservé au rôle `admin`. La page regroupe :

- **État** : mode du déploiement (simulation ou réel), fenêtre, présence du jeton cron, clé de chiffrement utilisée, migrations appliquées.
- **Planity** : source des identifiants (saisis ici ou variables d’environnement), date de la session, dernier résultat. Boutons : *Enregistrer les identifiants* (la connexion est testée immédiatement), *Se reconnecter* (nouvelle session avec les identifiants en place), *Tester la connexion* (liste les établissements et montre les associations), *Oublier la session*.
- **Treatwell** : état de la session (nombre de cookies, expiration, établissement courant), dernier résultat. Boutons : *Connecter Treatwell* (assistant guidé), *Importer la session*, *Tester la connexion*, *Oublier la session*.
- **Lancer un passage** : simulation à tout moment ; exécution réelle seulement si le déploiement est en `live`. Le rapport s’affiche avec les actions et les avertissements.
- **Historique** : les vingt derniers passages (déclencheur, mode, durée, compteurs par plateforme) et le rapport complet de chacun.
- **Associations** : pour chaque plateforme, les établissements, colonnes et prestations lus en direct, les appariements automatiques, les éléments non appariés, et les associations manuelles (ajout, retrait, « ne pas synchroniser »).

### Importer une session Treatwell depuis le back-office

Le plus simple est le bouton **Connecter Treatwell** : il ouvre `connect.treatwell.fr/login` dans un onglet, puis demande de se connecter (« Rester connecté »), d’ouvrir l’onglet Réseau (F12), de recharger la page et de faire clic droit → Copier → **Copier en tant que cURL** sur la première requête, et enfin de coller le résultat. Une capture automatique depuis une iframe est impossible : un navigateur ne laisse jamais une page lire les cookies d’un autre site (et les cookies de connexion Treatwell sont `httpOnly`).

Le champ *Session Treatwell* (et l’assistant) acceptent indifféremment :

1. une requête copiée **en tant que cURL** depuis l’onglet Réseau (variantes bash et cmd), après une connexion avec « Rester connecté » ;
2. l’en-tête `Cookie` d’une requête vers `connect.treatwell.fr` (il doit contenir les cookies `ATKT`, `ITKT` et `extranet.currentVenueId`) ;
3. un export **HAR** de l’onglet Réseau ;
4. le contenu du fichier `.sync/treatwell-session.enc` produit par `npm run sync:login -- treatwell` (chiffré avec la même clé que le déploiement).

La session est vérifiée en listant les établissements ; si la vérification échoue, rien n’est conservé.

### Quand se reconnecter

| Symptôme dans le rapport | Cause | Action |
|---|---|---|
| « Session Treatwell expirée » ou « page de vérification au lieu de données » | Cookies expirés ou invalidés (changement de mot de passe, déconnexion dans Connect) | Importer une nouvelle session |
| « Aucune session Treatwell » | Aucune session enregistrée, ou clé de chiffrement changée | Importer une session |
| « Planity refuse l’identifiant ou le mot de passe » | Mot de passe changé côté Planity | Enregistrer les nouveaux identifiants |
| « Identifiants Planity manquants » | Ni saisie dans le back-office, ni variables d’environnement | Enregistrer les identifiants |
| « migration … appliquée ? » | Tables absentes | Exécuter les migrations ci-dessus |

## Données

| Table | Rôle |
|---|---|
| `appointments.source` | `site`, `planity` ou `treatwell` : où la réservation a été prise |
| `appointment_platform_links` | Une ligne par (rendez-vous, plateforme) : identifiant distant, référence d’écriture, `snapshot` de l’état convenu au dernier passage. `snapshot` NULL = envoi en cours (repris ou libéré au passage suivant) |
| `platform_mappings` | Associations manuelles salon / masseuse / prestation |
| `platform_sessions` | Sessions chiffrées (jeton Planity, cookies Treatwell) |
| `platform_credentials` | Identifiants Planity saisis dans le back-office, chiffrés |
| `platform_sync_runs` | Un passage par ligne : mode, statut, rapport complet, déclencheur. Sert aussi de verrou (un seul passage à la fois, 10 minutes) |

Ces tables sont réservées au rôle `service_role` ; le navigateur n’y a pas accès.

## Outils en ligne de commande

- `npm run sync:platforms` : lance un passage via la route cron et affiche le rapport (`-- --live`, `-- --platform=planity`, `-- --url=…`).
- `npm run sync:login -- treatwell` : connexion Treatwell assistée (Chrome).
- `npm run test:sync` : scénario complet site ↔ Planity ↔ Treatwell sur une base et deux agendas en mémoire, sans réseau.

## Déclenchement immédiat

En plus du passage planifié, chaque changement de rendez-vous sur le site lance aussitôt une synchronisation ciblée sur le ou les jours concernés (`lib/sync/trigger.ts`) : création par l'équipe ou par un client, déplacement, modification, annulation, et changement ou annulation par le client depuis son lien de gestion. Le travail se fait après la réponse HTTP, avec le même moteur que le cron ; le passage apparaît dans l'historique avec le déclencheur `event:<origine>`. Si un passage est déjà en cours, l'événement réessaie trois fois (5 s, 20 s, 45 s) puis laisse le cron faire. Rien ne part tant que `PLATFORM_SYNC_MODE` n'est pas `live` (sauf `PLATFORM_SYNC_EVENT_DRY_RUN=1`, qui enregistre des simulations pour vérifier le câblage).

La suppression d'un rendez-vous (et non son annulation) emporte ses liens avec elle : les copies sur les plateformes sont alors annulées directement, sinon le passage suivant les réimporterait.

Un salon sans établissement associé sur une plateforme est désormais signalé dans le rapport avec le nombre de rendez-vous qu'il aurait envoyés.
