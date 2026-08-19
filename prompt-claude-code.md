Lis le fichier logical-fixing.md à la racine du projet.

Il contient 6 tâches. Traite-les en 2 phases :

## PHASE 1 — Discussion obligatoire (2 points)

Ces 2 points nécessitent une vraie logique métier, donc AUCUN code avant validation :

1. "There is a form of Nouvelle demande in 'Congés & Absences' where there is the type and the 'Documents'. There is 'Demande congee payes' in the type of document. I want to link the info in Dossier Salaries with salarie so it take all the infos there and save it in the model so i can fill the info of user in a fast way."

2. "the 'Documents' There is 'Demande congee payes' u have to lock the Date de reprise and be automatically filled with Date de fin + 1 and if the Date fin is Friday Date de reprise will be Monday"

Pour ces 2 points :
- Explore le repo pour comprendre les modèles/composants concernés (Dossier Salariés, modèle Demande, form Nouvelle demande, logique de dates).
- Résume-moi la structure actuelle.
- Discute avec moi la logique du fix (ex: FK vs snapshot pour le point 1, gestion des jours fériés/weekends pour le point 2).
- Propose 1-2 solutions concrètes avec trade-offs.
- Attends ma validation avant de coder.
- Implémente seulement après mon accord.

## PHASE 2 — Implémentation directe (6 points, pas de discussion nécessaire)

Une fois les 2 points ci-dessus validés et implémentés, passe directement à ces 4 tâches, sans attendre ma validation à chaque fois — implémente-les et montre-moi le résultat au fur et à mesure :

3. Adding the input of the return date in the form of congé & absences
4. Edit / Delete Entreprise
5. Add a calendar view showing names of absent employees in the day
6. Delete the Demandes admin tab
7. Fix why demands in documents dont get to Director/Manager
8. auto fill the infos of the Documents's forms if the Fiche salarie already exist

Ne commence PAS la Phase 2 avant que la Phase 1 soit entièrement validée et codée.
