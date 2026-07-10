// L'Échappée M&Ms — stats et points d'intérêt calculés à partir du GPX
// La carte + le profil altimétrique sont désormais gérés par l'embed Komoot (voir index.html)

const GPX_URL = "data/route.gpx";

// Distance haversine en km entre deux points lat/lon
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadGpx(url) {
  const res = await fetch(url);
  const text = await res.text();
  const xml = new DOMParser().parseFromString(text, "application/xml");

  const trkpts = Array.from(xml.getElementsByTagName("trkpt")).map((pt) => ({
    lat: parseFloat(pt.getAttribute("lat")),
    lon: parseFloat(pt.getAttribute("lon")),
    ele: parseFloat(pt.getElementsByTagName("ele")[0]?.textContent ?? "0"),
  }));

  const wpts = Array.from(xml.getElementsByTagName("wpt")).map((pt) => ({
    lat: parseFloat(pt.getAttribute("lat")),
    lon: parseFloat(pt.getAttribute("lon")),
    name: pt.getElementsByTagName("name")[0]?.textContent ?? "Point",
  }));

  return { trkpts, wpts };
}

// Calcule distance cumulée (km) pour chaque point de la trace
function computeCumulativeDistance(trkpts) {
  const cum = [0];
  for (let i = 1; i < trkpts.length; i++) {
    const d = haversineKm(
      trkpts[i - 1].lat, trkpts[i - 1].lon,
      trkpts[i].lat, trkpts[i].lon
    );
    cum.push(cum[i - 1] + d);
  }
  return cum;
}

function computeStats(trkpts) {
  let gain = 0, loss = 0, maxAlt = -Infinity;
  const SMOOTH_THRESHOLD = 1; // m, ignore le bruit GPS/altimétrique
  for (let i = 1; i < trkpts.length; i++) {
    const diff = trkpts[i].ele - trkpts[i - 1].ele;
    if (diff > SMOOTH_THRESHOLD) gain += diff;
    else if (diff < -SMOOTH_THRESHOLD) loss += -diff;
    if (trkpts[i].ele > maxAlt) maxAlt = trkpts[i].ele;
  }
  return { gain: Math.round(gain), loss: Math.round(loss), maxAlt: Math.round(maxAlt) };
}

function findNearestWaypointDistance(wpt, trkpts, cumDist) {
  let bestIdx = 0, bestD = Infinity;
  for (let i = 0; i < trkpts.length; i++) {
    const d = haversineKm(wpt.lat, wpt.lon, trkpts[i].lat, trkpts[i].lon);
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  return cumDist[bestIdx];
}

async function init() {
  const { trkpts, wpts } = await loadGpx(GPX_URL);
  const cumDist = computeCumulativeDistance(trkpts);
  const stats = computeStats(trkpts);
  const totalDist = cumDist[cumDist.length - 1];

  document.getElementById("stat-distance").textContent = totalDist.toFixed(0);
  document.getElementById("stat-gain").textContent = stats.gain.toLocaleString("fr-FR");
  document.getElementById("stat-loss").textContent = stats.loss.toLocaleString("fr-FR");
  document.getElementById("stat-maxalt").textContent = stats.maxAlt.toLocaleString("fr-FR");
  document.getElementById("last-updated").textContent = new Date().toLocaleDateString("fr-FR");

  const waypointsList = document.getElementById("waypoints-list");
  wpts.forEach((wp) => {
    const distAtWp = findNearestWaypointDistance(wp, trkpts, cumDist);
    const li = document.createElement("li");
    li.innerHTML = `<span class="wp-name">${wp.name}</span><span class="wp-dist">km ${distAtWp.toFixed(0)}</span>`;
    waypointsList.appendChild(li);
  });
}

init().catch((err) => {
  console.error("Erreur de chargement du parcours:", err);
  const wpSection = document.getElementById("waypoints-list");
  if (wpSection) {
    wpSection.innerHTML =
      '<li style="color:#b91c1c">Impossible de charger la trace GPX. Vérifie que data/route.gpx existe.</li>';
  }
});
