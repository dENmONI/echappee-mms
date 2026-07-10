# L'Échappée M&Ms — site de planification

Site statique (aucun build, aucune dépendance npm) pour partager le parcours vélo
avec les participants : carte interactive + profil altimétrique à partir du GPX.

## Structure

- `index.html` — page unique
- `style.css` — style
- `app.js` — chargement du GPX, carte Leaflet, graphique Chart.js
- `data/route.gpx` — trace du parcours (remplacer ce fichier pour mettre à jour l'itinéraire)

## Tester en local

Un simple `open index.html` ne suffit pas (le `fetch` du GPX est bloqué par le navigateur
en `file://`). Lancer un petit serveur local :

```bash
cd echappee-mms-site
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Mettre à jour le parcours

Remplacer `data/route.gpx` par un nouvel export (Komoot, Strava, etc.), garder le même nom
de fichier, puis commit + push. Vercel redéploie automatiquement.

## Déploiement

Repo connecté à Vercel (import Git, framework "Other", aucune commande de build).
Chaque `git push` sur `main` redéploie automatiquement.

## À compléter

- Détail des étapes / jours (infos issues de la plaquette PDF v1, à adapter au nouveau tracé)
- Logistique : hébergements, ravitaillement, contacts
- Liste des participants
