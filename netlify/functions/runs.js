const OWNER = process.env.GH_OWNER;
const REPO  = process.env.GH_REPO;
const TOKEN = process.env.GH_TOKEN;
const MAPS_KEY = process.env.GOOGLE_MAPS_KEY;
const PATH  = "runs.json";

const ghUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
const ghHeaders = {
  Authorization: `token ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
};

async function expandUrl(shortUrl) {
  try {
    const res = await fetch(shortUrl, { method: "HEAD", redirect: "follow" });
    return res.url;
  } catch {
    return shortUrl;
  }
}

function extractCoords(url) {
  const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) return `${coordMatch[1]},${coordMatch[2]}`;
  const qMatch = url.match(/[?&]q=([^&]+)/);
  if (qMatch) return qMatch[1];
  const placeMatch = url.match(/place\/([^/]+)/);
  if (placeMatch) return placeMatch[1];
  return null;
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors };
  }

  if (event.httpMethod === "GET") {
    const res = await fetch(ghUrl, { headers: ghHeaders });
    if (res.status === 404) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ runs: [], sha: null, mapsKey: MAPS_KEY }) };
    }
    const data = await res.json();
    const content = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
    const runs = content.runs || [];

    // Expand shortened map URLs and attach a staticMapUrl to each run
    const runsWithMaps = await Promise.all(runs.map(async (run) => {
      if (!run.mapLink || !MAPS_KEY) return run;
      const expanded = await expandUrl(run.mapLink);
      const center = extractCoords(expanded);
      if (!center) return run;
      const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=15&size=560x200&scale=2&markers=color:red%7C${center}&key=${MAPS_KEY}`;
      return { ...run, staticMapUrl };
    }));

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ runs: runsWithMaps, sha: data.sha, mapsKey: MAPS_KEY }),
    };
  }

  if (event.httpMethod === "PUT") {
    const { runs, sha } = JSON.parse(event.body);
    const content = Buffer.from(JSON.stringify({ runs }, null, 2)).toString("base64");
    const res = await fetch(ghUrl, {
      method: "PUT",
      headers: ghHeaders,
      body: JSON.stringify({ message: "update runs", content, ...(sha && { sha }) }),
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ sha: data.content.sha }),
    };
  }

  return { statusCode: 405, headers: cors, body: "Method not allowed" };
};
