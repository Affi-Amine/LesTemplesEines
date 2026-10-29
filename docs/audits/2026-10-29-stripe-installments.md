# Incident : forfaits en plusieurs fois et renouvellement Stripe

## Constats vérifiés

Le 29 octobre, lecture seule de Supabase : 13 forfaits ont un identifiant
d’abonnement Stripe. Les 13 indiquent une échéance enregistrée sur deux ;
3 sont marqués `cancelled` dans l’application. Ce n’est pas une preuve de
13 trop-perçus ni de 13 abonnements encore actifs chez Stripe.

Le code créait une souscription mensuelle sans fin prédéfinie pour un forfait
en deux ou trois paiements. Son arrêt dépendait exclusivement du compteur
incrémenté par `invoice.paid`. Le gestionnaire lisait seulement
`invoice.subscription`, alors que le format récent utilise
`invoice.parent.subscription_details.subscription`. Il accusait aussi réception
avec succès après certaines erreurs de traitement d’un Checkout.

Ces défauts sont reproduits par les tests. La cause exacte des événements
manqués chez chaque cliente doit encore être vérifiée dans Stripe Workbench.

La cliente signalée a acheté le 12 août un forfait en deux paiements. Le
propriétaire signale des débits les 12 août, septembre et octobre ; la base
reste à 1/2. Les montants, factures payées et remboursements restent à vérifier
directement dans Stripe : la clé Stripe n’est pas présente localement.

## Corrections préparées

- Achat public en 2/3 fois temporairement refusé avant toute création de compte
  ou appel Stripe. Options retirées de la page publique et message de contact.
  Paiement en une fois conservé lorsque le forfait l’autorise.
- Le parcours de création d’une nouvelle souscription mensuelle a été retiré
  de l’API publique. Les forfaits existants restent utilisables.
- Références d’abonnement anciennes, récentes et développées reconnues.
- Compteur recalculé depuis toutes les pages des factures de cycle réellement
  payées ; répétitions d’événements dédupliquées par identifiant de facture.
  Les factures manuelles et celles de montant nul ne sont pas des échéances.
- Date de fin Stripe fixée depuis l’ancre mensuelle et le nombre d’échéances,
  avec `proration_behavior: none`. Une annulation existante plus proche est
  conservée. Un abonnement déjà annulé n’est jamais rouvert. Un échéancier
  existant n’est accepté que s’il se termine par une annulation dans le délai.
- Pour les plans dont la fin théorique est passée, arrêt au terme de la période
  actuelle : ne génère pas de facture ni de prorata supplémentaire.
- Les compteurs ne peuvent pas régresser après un événement concurrent ancien.
  Les forfaits annulés dans l’application restent annulés.
- Les erreurs de traitement renvoient 500 pour permettre une nouvelle tentative ;
  les signatures invalides restent refusées en 400. Une reprise après insertion
  recherche le forfait par Checkout pour éviter une seconde création.
- Un ancien événement d’échec ne dégrade pas un forfait déjà entièrement payé.
- Détection explicite d’un nombre de factures supérieur au contrat, sans
  remboursement automatique.

## Traitement de la production

Ces changements ne sont pas déployés. Aucune annulation, écriture en base,
facturation ou opération de remboursement n’a été effectuée en production.
Aucune nouvelle migration SQL n’est nécessaire pour cette correction.

1. Déployer la correction pour arrêter les nouvelles ventes fractionnées et
   corriger le traitement des événements des forfaits existants.
2. Contrôler les abonnements existants sans attendre leur prochain prélèvement.
   La liste privée avec liens Stripe est dans
   `output/playwright/stripe-pack-audit-2026-10-29.md` (hors Git).
3. Pour chaque plan : rapprocher les factures réellement payées du contrat,
   contrôler les remboursements et l’état réel de la souscription. Annuler
   les renouvellements indus dans Stripe après validation du cas.
4. Traiter séparément les remboursements des échéances excédentaires vérifiées.
   Changer seulement `paid_installments` dans Supabase n’arrête pas Stripe.
5. Relancer les événements échoués ou manqués depuis Stripe Workbench après
   déploiement ; les compteurs sont recalculés depuis les factures Stripe.
6. Ne rétablir les nouvelles ventes fractionnées qu’avec un parcours créant
   un échéancier fini avant d’exposer une souscription à la cliente, vérifié
   dans un environnement Stripe de test, y compris sans webhook initial.

Audit en lecture seule :

```powershell
node --env-file=.env scripts/audit-pack-billing.cjs
```

Sans clé Stripe : uniquement les indices Supabase. Avec une clé Stripe
configurée dans l’environnement : lecture des abonnements et des factures
payées, écarts de compteurs et trop-perçus potentiels. Le script ne modifie rien.

## Validation

`npm run test:stripe-packs`, `npm run test:booking` et TypeScript passent.
Les tests Stripe utilisent des doubles isolés et vérifient les routes réelles ;
ils ne remplacent pas la validation avec un compte Stripe de test avant
réouverture des paiements fractionnés. Aucun débit de test réel effectué.

Références officielles :
[facture Stripe](https://docs.stripe.com/api/invoices/object),
[mise à jour d’un abonnement](https://docs.stripe.com/api/subscriptions/update),
[échéanciers finis](https://docs.stripe.com/billing/subscriptions/subscription-schedules).
