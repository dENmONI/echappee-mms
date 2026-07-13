// L'Échappée M&Ms — stats, points d'intérêt et profil altimétrique d'ensemble
// La carte et le profil interactif par étape sont gérés par les embeds Komoot (voir index.html) ;
// le graphique ci-dessous est une vue d'ensemble maison, colorée par jour, que Komoot ne propose pas.

const GPX_URL = "data/route.gpx";

// Bornes des 4 jours (km cumulés) et couleur associée à chacun
const DAY_BOUNDS = [0, 91.7, 223.4, 384.0, 513.6];
const DAY_COLORS = ["#1b4965", "#ee6c4d", "#b91c1c", "#2a9d8f"];

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

// Décime un tableau en gardant environ `target` points (premier/dernier conservés)
function decimate(arr, target) {
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[Math.floor(i)]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

function dayIndexForKm(km) {
  for (let i = 0; i < DAY_BOUNDS.length - 1; i++) {
    if (km <= DAY_BOUNDS[i + 1]) return i;
  }
  return DAY_BOUNDS.length - 2;
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

function renderOverviewChart(trkpts, cumDist) {
  const canvas = document.getElementById("overview-chart");
  if (!canvas || typeof Chart === "undefined") return;

  const idxs = decimate(trkpts.map((_, i) => i), 700);
  const points = idxs.map((i) => ({ x: cumDist[i], y: trkpts[i].ele }));

  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      datasets: [{
        data: points,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: true,
        tension: 0.1,
        segment: {
          borderColor: (ctx) => DAY_COLORS[dayIndexForKm((ctx.p0.parsed.x + ctx.p1.parsed.x) / 2)],
          backgroundColor: (ctx) => DAY_COLORS[dayIndexForKm((ctx.p0.parsed.x + ctx.p1.parsed.x) / 2)] + "33",
        },
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `km ${items[0].parsed.x.toFixed(0)}`,
            label: (item) => `${Math.round(item.parsed.y)} m`,
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Distance (km)" },
          ticks: { maxTicksLimit: 10 },
        },
        y: { title: { display: true, text: "Altitude (m)" } },
      },
    },
  });
}

async function init() {
  const { trkpts } = await loadGpx(GPX_URL);
  const cumDist = computeCumulativeDistance(trkpts);
  const stats = computeStats(trkpts);
  const totalDist = cumDist[cumDist.length - 1];

  document.getElementById("stat-distance").textContent = totalDist.toFixed(0);
  document.getElementById("stat-gain").textContent = stats.gain.toLocaleString("fr-FR");
  document.getElementById("stat-maxalt").textContent = stats.maxAlt.toLocaleString("fr-FR");
  document.getElementById("last-updated").textContent = new Date().toLocaleDateString("fr-FR");

  renderOverviewChart(trkpts, cumDist);
}

init().catch((err) => {
  console.error("Erreur de chargement du parcours:", err);
});
