# Agent API – Example calls

Examples for calling the Agentforce agent: **start session** and **send message**.

Use either **A** (via the demo server) or **B** (directly to Salesforce). Replace placeholders with your values.

---

## A. Via the demo server (requires request signing)

Base URL: `http://localhost:3000` (or your `VITE_API_URL`).  
All requests need headers: `X-Timestamp`, `X-Signature` (HMAC-SHA256 of `timestamp + METHOD + path` with `API_SECRET`).

### 1. Start session

**Path:** `GET /api/v1/start-session?sessionId=<uuid>&customerId=<customerId>`

Example (Hexagon; replace `SESSION_ID` and get `TIMESTAMP` / `SIGNATURE` from the script below):

```bash
# Generate timestamp and signature (run in Node; requires API_SECRET in env or replace YOUR_API_SECRET)
node -e "
const crypto = require('crypto');
const path = '/api/v1/start-session?sessionId=SESSION_ID&customerId=hexagon';
const timestamp = Date.now().toString();
const message = timestamp + 'GET' + path;
const sig = crypto.createHmac('sha256', process.env.API_SECRET || 'YOUR_API_SECRET').update(message).digest('hex');
console.log('X-Timestamp:', timestamp);
console.log('X-Signature:', sig);
console.log('curl -X GET \"http://localhost:3000' + path + '\" -H \"X-Timestamp: ' + timestamp + '\" -H \"X-Signature: ' + sig + '\"');
"
```

Then run the printed `curl` (after replacing `SESSION_ID` with a UUID, e.g. `$(uuidgen)` or any UUID).

**Response:** `{ "sessionId": "<agentforce-session-id>", "messages": [], "agentId": "0XxHr000000IOglKAG" }`. Use `sessionId` for send-message.

### 2. Send message

**Path:** `POST /api/v1/send-message`  
**Body:** `{ "sessionId": "<from start-session>", "message": "Your question here", "sequenceId": 1, "customerId": "hexagon" }`

Generate signature for `POST` and path `/api/v1/send-message` (no query string), then:

```bash
curl -X POST 'http://localhost:3000/api/v1/send-message' \
  -H 'Content-Type: application/json' \
  -H 'X-Timestamp: TIMESTAMP' \
  -H 'X-Signature: SIGNATURE' \
  -d '{
    "sessionId": "AGENTFORCE_SESSION_ID_FROM_STEP_1",
    "message": "How do I translate content?",
    "sequenceId": 1,
    "customerId": "hexagon"
  }'
```

**Response:** `{ "messages": [ ... ] }` – agent reply and citations.

---

## B. Direct to Salesforce Agentforce (no demo server)

Use your Salesforce **Bearer token** (e.g. client credentials from `server/.env`: `CLIENT_ID`, `CLIENT_SECRET`, `SALESFORCE_LOGIN_URL`).

### 1. Get access token

```bash
# Replace with your server/.env values
export SF_URL="https://eheart-241222-495-demo.my.salesforce.com"
export CLIENT_ID="your_connected_app_client_id"
export CLIENT_SECRET="your_connected_app_client_secret"

TOKEN=$(curl -s -X POST "${SF_URL}/services/oauth2/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  | jq -r '.access_token')
```

### 2. Start session (Agentforce)

Agent ID for Hexagon (from `server/config/customers.json`): `0XxHr000000IOglKAG`. Use your org’s instance URL for `endpoint`.

```bash
export AGENT_ID="0XxHr000000IOglKAG"
export SESSION_KEY="test-session-$(date +%s)"

curl -s -X POST "https://api.salesforce.com/einstein/ai-agent/v1/agents/${AGENT_ID}/sessions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "externalSessionKey": "'"${SESSION_KEY}"'",
    "instanceConfig": { "endpoint": "'"${SF_URL}"'" },
    "streamingCapabilities": { "chunkTypes": ["Text"] },
    "bypassUser": true
  }' | jq .
```

From the response, set `AGENTFORCE_SESSION_ID` to `sessionId` (the one returned by Agentforce, not `SESSION_KEY`).

### 3. Send message to the agent

```bash
curl -s -X POST "https://api.salesforce.com/einstein/ai-agent/v1/sessions/${AGENTFORCE_SESSION_ID}/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "message": {
      "sequenceId": 1,
      "type": "Text",
      "text": "How do I translate content?"
    }
  }' | jq .
```

Response contains `messages` (agent reply, citations, etc.).

---

## Summary

| Step        | Via demo server                          | Direct to Salesforce                                                                 |
|------------|-------------------------------------------|---------------------------------------------------------------------------------------|
| Auth       | `X-Timestamp` + `X-Signature` (API_SECRET) | Bearer token (OAuth client credentials)                                              |
| Start      | GET `/api/v1/start-session?sessionId=...&customerId=...` | POST `.../agents/{agentId}/sessions` with `externalSessionKey`, `instanceConfig`, etc. |
| Send msg   | POST `/api/v1/send-message` with `sessionId`, `message`, `sequenceId`, `customerId` | POST `.../sessions/{sessionId}/messages` with `message: { sequenceId, type, text }`    |

Use the **sessionId** returned from start-session in the send-message request.
