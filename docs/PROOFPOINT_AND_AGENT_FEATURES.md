# Proofpoint demo and Agentforce: API usage (primary)

Integration work centers on **calling this app’s backend HTTP API** with correct **HMAC-SHA256** signing. The UI is a reference client. This document leads with **request/response contracts**; product behavior and file references follow.

---

## Base URL and client config

- **Server:** e.g. `http://localhost:3000` (or your deployed host). No `/api` prefix beyond what is listed per route.
- **Browser client:** `VITE_API_URL` (optional); defaults to `http://localhost:3000` in code if unset.
- **Shared secret:** `API_SECRET` on the server, `VITE_API_SECRET` on the client (must match for HMAC).

---

## Authentication: HMAC (required for most write/session routes)

**Headers (all signed requests):**

| Header | Value |
|--------|--------|
| `X-Timestamp` | Current time in **milliseconds** (string), e.g. `Date.now().toString()` |
| `X-Signature` | Hex-encoded **HMAC-SHA256** |

**Message to sign:**

```text
${timestamp}${METHOD}${path}
```

- `METHOD` is uppercase: `GET`, `POST`, `DELETE`.
- **`path` must match the server’s `req.originalUrl` exactly** — including the query string for GET requests.

**Example:** Start session uses a path like:

```text
/api/v1/start-session?sessionId=<uuid>&customerId=proofpoint&accountName=Northbridge%20Data%20Security
```

If you sign `/api/v1/start-session` **without** the query string, validation **fails**.

**Clock skew:** Requests older than **5 minutes** from server time are rejected (`401`).

**Implementation:** Client `client/src/utils/requestSigner.ts`; server `server/src/middleware/validateSignature.js`.

---

## Endpoints overview

| Method | Path | Signature | Purpose |
|--------|------|-----------|---------|
| GET | `/api/v1/customers` | No | List customer ids / catalog |
| GET | `/api/v1/customers/:customerId` | No | Public customer config for UI (no secrets) |
| GET | `/api/v1/start-session` | **Yes** | Create Agentforce session; returns real `sessionId` |
| POST | `/api/v1/send-message` | **Yes** | Send user text to Agentforce |
| DELETE | `/api/v1/delete-session` | **Yes** | End Agentforce session |
| POST | `/api/v1/get-hudmo` | **Yes** | Load HUDMO article body/metadata by content id |
| POST | `/api/v1/get-chunks` | **Yes** | Chunk preview text for citations |
| GET | `/api/v1/query-dmo-relationship` | **Yes** | Relationship / DMO queries |
| GET | `/api/v1/article-versions` | **Yes** | Article version lookup |
| GET | `/api/v1/fast-search` | **Yes** | Fast search (registered on app in `server/index.js`) |

Routes are declared in `server/src/routes/catalog.js` (except `fast-search`).

---

## GET `/api/v1/customers/:customerId`

**Authentication:** None.

**Response (200):**

```json
{
  "customer": {
    "id": "proofpoint",
    "name": "Proofpoint",
    "objectApiName": "...",
    "tocUrl": "/data/....xml",
    "tocUrls": ["/data/foo.xml", "/data/bar.xml"],
    "proposedQuestion": "…",
    "urlBasedContent": { "/proofpoint/casb": ["<dccid>", "..."] },
    "ui": { "colors": {}, "labels": {} },
    "embedUi": null
  }
}
```

- Config file uses `url-based-content`; API exposes **`urlBasedContent`** (camelCase).
- **`tocUrls`:** If the JSON has only `tocUrl`, the API may return **`tocUrls`** as a single-element array for a consistent shape.

**Used by:** `useAgentChat` (object API name, TOCs), `useCustomerProposedQuestionAutoSend` (proposed question), URL-based article loading (read `urlBasedContent` + `objectApiName`).

---

## GET `/api/v1/start-session`

**Authentication:** HMAC. Sign the full path **with** query string.

**Query parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `sessionId` | Yes | **External** session key the app stores client-side; maps to Agentforce `externalSessionKey` |
| `customerId` | No | Selects `agentforceAgentId` and auth from `server/config/customers.json` |
| `accountName` | No | Passed to Agentforce as variable `accountName` (text) on session start |

**Response (200):**

```json
{
  "sessionId": "<agentforce-internal-session-id>",
  "messages": [ { … } ],
  "agentId": "<configured-agent-id>"
}
```

Use **`sessionId`** from this response for **`send-message`** and **`delete-session`** (this is the **internal** Agentforce session id, not the external key).

**Errors:** `404` unknown customer, `503` missing Salesforce auth or agent id, structured JSON with `error` / `message` on Agentforce failures.

**Salesforce side:** `POST .../einstein/ai-agent/v1/agents/{agentId}/sessions` with `externalSessionKey`, optional `variables: [{ name: "accountName", type: "Text", value: "..." }]`.

---

## POST `/api/v1/send-message`

**Authentication:** HMAC. Sign path **`/api/v1/send-message`** (no query).

**Headers:** `Content-Type: application/json`, `X-Timestamp`, `X-Signature`

**Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | **Internal** session id from `start-session` response |
| `message` | string | Yes | User message text |
| `sequenceId` | number | Yes | Monotonic per session (client increments) |
| `customerId` | string | No | Used to pick Salesforce token / org |
| `accountName` | string | No | Appends Agentforce message variable `accountName` for this turn |

**Response (200):**

```json
{ "messages": [ { … } ] }
```

First message is the agent reply; may include `citedReferences`, `result`, `message`, `messageParts`, etc. (Agentforce shape).

**Salesforce side:** `POST .../einstein/ai-agent/v1/sessions/{sessionId}/messages` with `message.type: "Text"`, optional `variables` for `accountName`.

---

## DELETE `/api/v1/delete-session`

**Authentication:** HMAC. Sign path **`/api/v1/delete-session`**.

**Body (JSON):** `{ "sessionId": "<internal-session-id>" }`

**Response (200):** `{ "message": "Session successfully ended." }` (not `success: true`).

---

## POST `/api/v1/get-hudmo`

**Authentication:** HMAC. Sign path **`/api/v1/get-hudmo`**.

**Body (JSON):**

| Field | Required | Description |
|-------|----------|-------------|
| `hudmoName` | Yes | HUDMO object API name (from customer `objectApiName`) |
| `dccid` | Yes | Data Cloud content id (same as citation / content id) |
| `customerId` | No | Selects org token and login URL for the HUDMO request |

**Response (200):** Salesforce HUDMO payload (includes attributes such as title, content, summary — shape per Salesforce EK API).

**Used by:** Article/citation modal, and **URL-based article cards** (one request per content id in `urlBasedContent` for the current pathname).

---

## Proofpoint flow: typical API sequence

1. **`GET /api/v1/customers/proofpoint`** — UI theme, `objectApiName`, `tocUrls`, `proposedQuestion`, `urlBasedContent`.
2. **`GET /api/v1/start-session?sessionId=…&customerId=proofpoint`** (optional **`&accountName=…`**) — signed; store **`sessionId`** from JSON.
3. **`POST /api/v1/send-message`** — signed; repeat for each user message; increment **`sequenceId`**.
4. **`POST /api/v1/get-hudmo`** — signed; for each sidebar content id and for citation opens.
5. **`DELETE /api/v1/delete-session`** — signed; when ending the chat.

For **URL-based sidebar articles**, step 1 + 2 run, then the client issues **one `get-hudmo` per** content id listed for the **browser pathname** (e.g. `/proofpoint/casb` must match keys in `urlBasedContent`).

---

## Optional: `accountName` and session scoping

- **API:** `accountName` on **start-session** (query) and **send-message** (body) only affects the Agentforce **variable** `accountName`.
- **Client:** `useAgentChat` also folds `customerId`, **pathname**, and **accountName** into a **session storage key** so different routes/accounts do not share the same external `sessionId` or chat history.

---

## UI and configuration (secondary)

### Proofpoint routes (browser)

| Route | Component |
|-------|-----------|
| `/proofpoint` | `ProofpointDummyPage` |
| `/proofpoint/casb` | `ProofpointCASBPage` |
| `/proofpoint/websecurity` | `ProofpointWebSecurityPage` |
| `/proofpoint/npre` | `ProofpointNprePage` |

### `server/config/customers.json` (proofpoint)

- **`url-based-content`:** path → content id list (drives `get-hudmo` calls after session init).
- **`tocUrls`:** multiple TOC XML paths under `server/public/data/`.
- **`proposedQuestion`:** used when auto-propose is enabled (`GET customer` or `location.state`).

### Agent message rendering (client-only)

- **`getAgentMessageText` / `extractAgentSuggestedReplies`** merge main text with suggestions that appear only in `result` / rich parts — no extra API.

### Auto-proposed questions

- Toggle on → after **`start-session`** completes, client may **`send-message`** once with `proposedQuestion` from customer API or navigation state — still the same **`send-message`** contract.

### Multi-TOC

- **`TOC`** component loads one or more XML URLs; **not** a backend API.

---

## Data ingestion

*(Add content here: e.g. source systems, batch or streaming load into Data Cloud, chunking, and how raw content is staged before harmonization.)*

---

## Metadata ingestion

*(Add content here: e.g. titles, languages, product tags, relationship/DMO fields, search facets, and how metadata joins canonical content ids for citations and toc routing.)*

---

## Harmonization

*(Add content here: e.g. harmonized unstructured model (HUDMO/HUDLO), rules and transforms from source to canonical records, mapping to Data Cloud content ids, and readiness for Agentforce RAG and `get-hudmo`.)*

---

## Indexing

*(Add content here: e.g. vectorization and chunk indexes for semantic search, refresh cadence, and how artifacts feed the retriever at query time.)*

---

## Retriever

*(Add content here: e.g. query-time retrieval (top-k chunks, hybrid search), grounding Agentforce / EK responses, citation IDs / HUDMO links passed back in agent messages, and interaction with `get-hudmo` for full articles.)*

---

## Prompt template

*(Add content here: e.g. Agentforce topic/agent instructions, system and developer prompts, dynamic variables such as `accountName`, tone and citation rules, and how prompts pair with retrieved chunks.)*

---

## Product entitlements

*(Add content here: e.g. which products, editions, or SKUs the account may use, how that gates documentation or agent topics, and mapping to `accountName` or customer config in the demo.)*

---

## Agentforce

*(Add content here: e.g. how Agentforce hosts this demo’s agent—`agentforceAgentId` in `customers.json`, connection to Data Cloud / EK for RAG, session and message APIs (see **API usage** at the top of this doc), tool and topic configuration, and where org limits or trust settings apply.)*

---

## Data preparations

*(Add content here: e.g. TOC XML, content ID mapping, harmonized object names, and wiring into `customers.json` for the demo.)*

---

## Related source files

| Concern | Location |
|---------|----------|
| Routes / middleware | `server/src/routes/catalog.js`, `server/src/middleware/validateSignature.js` |
| Controllers | `server/src/controllers/get-customer.js`, `start-session.js`, `send-message.js`, `get-hudmo.js` |
| Client signing | `client/src/utils/requestSigner.ts` |
| Chat integration | `client/src/hooks/useAgentChat.ts` |

Embed-specific HTTP usage (iframe, loader) is described in **`EMBED.md`** and the root **`README.md`** (API Specification section).
