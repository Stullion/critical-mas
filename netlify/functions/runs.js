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
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ runs: content.runs || [], sha: data.sha, mapsKey: MAPS_KEY }),
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
