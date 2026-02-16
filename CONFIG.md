# Configuration checklist

Use this to ensure all required config exists and is correctly formatted.

---

## 1. Server: `server/.env`

**Location:** `server/.env` (create from `server/.env.example`)

**Required variables (non-empty):**

| Variable | Purpose | Missing? |
|----------|---------|----------|
| `SALESFORCE_LOGIN_URL` | Salesforce org URL (e.g. `https://yourorg.my.salesforce.com`) | If empty → OAuth token request fails (Bad Request) |
| `CLIENT_ID` | Salesforce Connected App Consumer Key | If empty → OAuth token request fails |
| `CLIENT_SECRET` | Salesforce Connected App Consumer Secret | If empty → OAuth token request fails |
| `API_SECRET` | Shared secret for client request signing; must match client `VITE_API_SECRET` | If empty → API requests rejected (401) |

**Optional:** `AGENTFORCE_AGENT_ID` (used when no customer is selected), `PORT`, `CORS_ORIGIN`.

**Format:** One `KEY=value` per line. No quotes needed unless the value contains spaces. Comments start with `#`.

---

## 2. Server: `server/config/customers.json`

**Location:** `server/config/customers.json`

**Required per customer:**

| Field | Purpose | Missing? |
|-------|---------|----------|
| `id` | Unique customer ID (e.g. `salesforce`, `stryker`) | Required |
| `salesforceLoginUrl` | Salesforce org URL for this customer | If empty → falls back to `SALESFORCE_LOGIN_URL` from `.env` |
| `clientId` | Connected App Client ID (optional per customer) | If empty → uses `CLIENT_ID` from `server/.env` |
| `clientSecret` | Connected App Client Secret (optional per customer) | If empty → uses `CLIENT_SECRET` from `server/.env` |
| `agentforceAgentId` | Agentforce agent ID for this customer | If empty → start-session fails for this customer |
| `objectApiName` | Data Cloud object API name for content | Required for get-hudmo |

**Format:** Valid JSON. Use 2-space indent. No trailing commas.

---

## 3. Client: `client/.env`

**Location:** `client/.env` (create from `client/.env.example`)

**Required:**

| Variable | Purpose | Missing? |
|----------|---------|----------|
| `VITE_API_URL` | Backend URL (e.g. `http://localhost:3000`) | If missing → client uses `http://localhost:3000` by default |
| `VITE_API_SECRET` | Must be the **same** value as server `API_SECRET` | If wrong/missing → signed requests fail (401) |

**Optional:** `VITE_CITATION_BEHAVIOR`, `VITE_EMBED_LAYOUT`.

**Format:** One `KEY=value` per line. Values are inlined at build time.

---

## Quick check

- **"Bad Request" / "Instance URL: undefined" / 404 on start-session**  
  → Set `SALESFORCE_LOGIN_URL`, `CLIENT_ID`, and `CLIENT_SECRET` in **server/.env** (or per customer in `server/config/customers.json`). Ensure the Connected App has Client Credentials flow enabled.

- **401 on API calls**  
  → `API_SECRET` in **server/.env** must equal `VITE_API_SECRET` in **client/.env**.

- **Customer not found**  
  → Customer `id` in `server/config/customers.json` must match the value the client sends (e.g. from CustomerSelector).
