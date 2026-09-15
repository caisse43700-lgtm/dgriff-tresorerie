# D'Griff Trésorerie

Application de trésorerie et de budget achats pour le commerce D'Griff. PWA autonome, sans dépendance ni build — HTML/CSS/JS pur, installable sur l'écran d'accueil d'un iPhone (puis Android).

Ce dossier est indépendant du reste du dépôt (ImmatConnect Pro) : aucun fichier partagé, aucune dépendance croisée.

## Lancer en local

```
cd dgriff-tresorerie
python3 -m http.server 8842
```

Puis ouvrir `http://localhost:8842` dans le navigateur. Sur iPhone : ouvrir l'URL de déploiement dans Safari, bouton Partager → "Sur l'écran d'accueil".

## Fichiers

- `index.html` — structure de la page, squelette des 5 vues (Accueil, Saisir, Simuler, Historique, Réglages)
- `styles.css` — palette et mise en page, clair/sombre automatique
- `app.js` — modèle de données, calculs financiers (solde bancaire dérivé des mouvements, encours carte différée en deux cycles, réserve URSSAF, charges du mois, disponible réel, simulateur d'achat)
- `ui.js` — rendu des vues et gestion des formulaires
- `manifest.json`, `service-worker.js`, `icons/` — installabilité PWA et fonctionnement hors-ligne

## Modèle de données

Tout est stocké dans `localStorage` (clé `dgriff_tresorerie_v1`) : réglages (soldes, taux URSSAF, objectif, dates carte différée), liste des charges récurrentes (pro/perso), échéances annuelles (CFE...), et l'historique des mouvements (CA, achats, dépenses, retraits, injections, paiements de charges, corrections de solde).

## Règle centrale (disponible réel)

```
Disponible réel =
    (solde compte courant + solde compte de dépôt)
  − encours carte différée déjà engagé (cycle à venir + cycle suivant)
  − réserve URSSAF (taux × CA du mois)
  − charges du mois à couvrir (pro + perso, recalculées chaque mois)
```

Un achat en carte différée réduit immédiatement le disponible réel au moment de la saisie ; il n'est jamais recompté une seconde fois lorsque la banque prélève réellement (la transaction bascule automatiquement du "encours différé" vers le "solde bancaire" à sa date de prélèvement calculée).

## Prochaine étape suggérée : sauvegarde cloud

Les données ne vivent aujourd'hui que dans le navigateur de l'appareil (localStorage). Pour la sauvegarde automatique en ligne évoquée en cadrage (ne jamais perdre l'historique en cas de perte/changement de téléphone), l'étape suivante recommandée est de brancher un backend léger de type Supabase (base Postgres + authentification par e-mail, offre gratuite suffisante pour cet usage) : création d'un compte, puis synchronisation de l'état local vers ce compte. Cette étape nécessite un compte créé par l'utilisatrice ; elle peut être ajoutée sans changer le reste de l'application.

## Points encore "à confirmer" (cahier des charges)

- Date exacte de fin de l'échéancier ancien loyer boutique
- Durée exacte de l'échéancier de dette URSSAF
- Montant exact de la CFE (estimé à 600 €)
- Date de clôture exacte de la carte à débit différé (réglable dans Réglages, estimée à J-7 du prélèvement)
- Périodicité des frais de dépassement bancaire
