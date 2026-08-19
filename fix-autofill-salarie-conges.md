# Fix — Auto-fill infos Salarié dans "Nouvelle demande" (Congés & Absences)

## Contexte
- Module : **Congés & Absences**
- Formulaire : **Nouvelle demande**
- Champs actuels : `Type` (dropdown) + `Documents`
- Type de document concerné : **"Demande congé payé"**

## Problème
Quand un salarié fait une "Demande congé payé", l'utilisateur doit remplir manuellement ses infos (nom, matricule, poste, etc.) alors qu'elles existent déjà dans **Dossier Salariés**. Perte de temps, risque d'erreurs de saisie, doublon de données.

## Objectif
Quand le salarié est sélectionné dans le formulaire "Nouvelle demande", récupérer automatiquement ses infos depuis **Dossier Salariés** et les injecter dans le modèle de la demande, pour un remplissage rapide (pré-rempli, éditable si besoin).

## Points à clarifier avant de coder (logique du fix)
1. **Relation FK vs snapshot** :
   - FK (référence live) → les infos suivent le salarié si son dossier change plus tard.
   - Snapshot (copie figée au moment de la demande) → garde une preuve historique fidèle à la date de la demande (utile pour un document légal type "Demande congé payé").
   - → À trancher : probablement **snapshot** pour ce cas (document RH/légal), mais à confirmer.
2. **Quels champs exactement** copier depuis Dossier Salariés (nom, prénom, matricule, poste, date d'embauche, solde congés, contrat, etc.) ?
3. **Où vit Dossier Salariés** dans le modèle de données actuel (même table Prisma ? relation existante avec le module Congés ?).
4. **Ce pattern doit-il être réutilisable** pour d'autres types de documents dans "Nouvelle demande", ou spécifique à "Demande congé payé" ?
5. **Comportement si le salarié change son dossier après la demande** : la demande déjà créée doit-elle se mettre à jour ou rester figée ?

## Résultat attendu
- Sélection du salarié → auto-fill immédiat des champs pertinents dans le formulaire.
- Champs pré-remplis restent modifiables manuellement si besoin.
- Données sauvegardées dans le modèle de la demande (Prisma) selon la décision FK/snapshot ci-dessus.

## Prochaines étapes (autres fixes en attente)
D'autres corrections/logiques sont à traiter après validation de celle-ci — à lister une fois ce fix discuté et validé.
