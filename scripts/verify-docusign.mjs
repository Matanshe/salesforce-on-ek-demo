// Ad-hoc live-verify for the docusign agent. Mirrors the client's signed-request flow.
// Run from server/ so it picks up .env: `node --env-file=.env ../scripts/verify-docusign.mjs`
import crypto from "crypto";

const BASE = "http://localhost:3001";
const SECRET = process.env.API_SECRET;
const CUSTOMER = "docusign";
const QUERY = "What is the purpose of the new IAM Clause Library?";

function sign(method, path) {
  const timestamp = Date.now().toString();
  const message = `${timestamp}${method.toUpperCase()}${path}`;
  const signature = crypto.createHmac("sha256", SECRET).update(message).digest("hex");
  return { "X-Timestamp": timestamp, "X-Signature": signature };
}

async function main() {
  // 1. customer config
  const cust = await (await fetch(`${BASE}/api/v1/customers/${CUSTOMER}`)).json();
  const objectApiName = cust.customer.objectApiName;
  console.log("objectApiName:", objectApiName, "| tocUrl:", cust.customer.tocUrl);

  // 2. start session
  const key = crypto.randomUUID();
  const startPath = `/api/v1/start-session?sessionId=${key}&customerId=${CUSTOMER}`;
  const startRes = await fetch(`${BASE}${startPath}`, { headers: sign("GET", startPath) });
  if (!startRes.ok) {
    console.error("START-SESSION FAILED", startRes.status, await startRes.text());
    return;
  }
  const start = await startRes.json();
  console.log("sessionId:", start.sessionId, "| agentId:", start.agentId);

  // 3. send the test message
  const msgRes = await fetch(`${BASE}/api/v1/send-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sign("POST", "/api/v1/send-message") },
    body: JSON.stringify({ sessionId: start.sessionId, message: QUERY, sequenceId: 1, customerId: CUSTOMER }),
  });
  if (!msgRes.ok) {
    console.error("SEND-MESSAGE FAILED", msgRes.status, await msgRes.text());
    return;
  }
  const msg = await msgRes.json();
  const m0 = msg.messages?.[0] ?? {};
  console.log("\n=== AGENT RESPONSE ===\n", (m0.message || "").slice(0, 600));
  const refs = m0.citedReferences ?? [];
  console.log("\n=== CITED REFERENCES:", refs.length, "===");
  // Title lives in `label` in the live citation structure (matches client getCitationTitle: title || label || name).
  const citationTitleOf = (r) => (r?.title?.trim?.() || r?.label?.trim?.() || r?.name?.trim?.() || null);
  refs.forEach((r, i) => console.log(`ref[${i}] keys:`, Object.keys(r), "\n  title (label):", citationTitleOf(r), "\n  url:", (r.url || r.value || "").slice(0, 260)));

  if (!refs.length) { console.log("No citations returned."); return; }

  // 4. parse citation url
  const rawUrl = refs[0].url || refs[0].value || "";
  let dccid, hudmo, chunkObj, chunkIds, citationTitle = citationTitleOf(refs[0]);
  try {
    const u = new URL(rawUrl.replace(/[).,;!?]+$/, ""));
    dccid = u.searchParams.get("c__dccid") || u.searchParams.get("c__contentId");
    hudmo = u.searchParams.get("c__hudmo") || u.searchParams.get("c__objectApiName") || objectApiName;
    chunkObj = u.searchParams.get("c__chunkObjectApiName");
    chunkIds = u.searchParams.get("c__chunkRecordIds");
  } catch (e) { console.error("bad citation url", e); }
  console.log("\n=== PARSED CITATION ===\n dccid:", dccid, "\n hudmo:", hudmo, "\n chunkObj:", chunkObj, "\n citationTitle:", citationTitle);

  // 5. fetch the article
  if (dccid && hudmo) {
    const hres = await fetch(`${BASE}/api/v1/get-hudmo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sign("POST", "/api/v1/get-hudmo") },
      body: JSON.stringify({ hudmoName: hudmo, dccid, customerId: CUSTOMER }),
    });
    console.log("\n=== GET-HUDMO status:", hres.status, "===");
    if (hres.ok) {
      const h = await hres.json();
      const attrs = h.data?.attributes ?? {};
      console.log(" title:", attrs.title);
      console.log(" contentType:", attrs.metadata?.contentType);
      console.log(" sourceUrl:", attrs.metadata?.sourceUrl);
      const content = attrs.content || "";
      const imgs = [...content.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
      console.log(" content length:", content.length);
      console.log(" images found:", imgs.length);
      imgs.slice(0, 8).forEach((s) => console.log("   img src:", s));
    } else {
      console.log(" body:", (await hres.text()).slice(0, 300));
    }
  }
}
main().catch((e) => console.error(e));
