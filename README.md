# Salesforce Help Portal - Agentforce on Enterprise Knowledge Demo

A demonstration of Salesforce Help Portal powered by **Agentforce on Enterprise Knowledge (EK)**, showcasing how harmonized unstructured data from Salesforce Data Cloud can be queried through natural language conversations with instant article access.

# Table of Contents

- [Salesforce Help Portal - Agentforce on Enterprise Knowledge Demo](#salesforce-help-portal---agentforce-on-enterprise-knowledge-demo)
- [Table of Contents](#table-of-contents)
  - [What does it do?](#what-does-it-do)
  - [How does it work?](#how-does-it-work)
  - [Features](#features)
  - [API Specification](#api-specification)
  - [Technologies used](#technologies-used)
- [Configuration](#configuration)
  - [Requirements](#requirements)
  - [Setup](#setup)
    - [Local environment configuration](#local-environment-configuration)
  - [Deployment](#deployment)
    - [Heroku Deployment](#heroku-deployment)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## What does it do?

This application demonstrates a **Salesforce Help Portal** interface powered by **Agentforce on Enterprise Knowledge**. It provides an interactive chat experience where users can:

- Ask natural language questions about Salesforce products, features, and best practices
- Receive AI-powered responses with citations from harmonized unstructured data
- Instantly view full articles from cited sources with a single click
- Experience a seamless, responsive interface designed to match help.salesforce.com

The demo showcases how **Salesforce Data Cloud** and **Agentforce** work together to:

- Process and vectorize unstructured knowledge base content
- Store vectorized data as HTML objects with semantic search capabilities
- Enable Agentforce to retrieve relevant information with proper citations
- Provide instant access to source articles through pre-fetched content

## How does it work?

**Data Processing Pipeline:**

1. **Data Ingestion**: Unstructured knowledge base content is uploaded to Data Cloud
2. **Chunking**: Data is split into manageable chunks for processing
3. **Harmonization**: Each chunk is converted into a Harmonized Unstructured Data Lake Object (HUDLO)
4. **Storage**: Vectorized data is stored as HTML objects in Data Cloud and mapped to Harmonized Unstructured Data Model Object (HUDMO)
5. **Retrieval**: Agentforce uses RAG (Retrieval-Augmented Generation) to query relevant HUDMO

**User Interaction Flow:**

1. User opens the portal and the Agentforce chat session initializes automatically
2. User sends natural language queries about Salesforce topics
3. Frontend generates HMAC-SHA256 signature for API authentication
4. Backend validates the request and forwards it to Agentforce
5. Agentforce retrieves relevant data using RAG and returns answers with citations
6. Citation details are pre-fetched in the background for instant access
7. User clicks on a citation to view the full article instantly
8. Article view opens on the main page with minimized chat sidebar

## Features

- **Auto-initialized Chat**: Chat widget opens automatically when the page loads
- **Pre-fetching**: Citation articles are fetched in the background for instant viewing
- **Article View**: Click any citation to view the full article on the main page
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Salesforce Branding**: Design matches help.salesforce.com with Salesforce colors and styling
- **Real-time Indicators**: Visual feedback for article loading and readiness status

## API Specification

The application exposes four RESTful endpoints, all protected by HMAC-SHA256 signature validation:

**GET /api/v1/start-session**

- Initializes a new Agentforce session. On Heroku, use `https://<your-app>.herokuapp.com/api/v1/start-session?...` (no `:3000` in the URL).
- Query Parameters: `sessionId` (external session key)
- Headers: `X-Timestamp`, `X-Signature`
- Returns: `{ sessionId, messages }` (Agentforce internal session ID and welcome message)

**POST /api/v1/send-message**

- Sends a message to an active Agentforce session
- Headers: `X-Timestamp`, `X-Signature`, `Content-Type: application/json`
- Body: `{ sessionId, message, sequenceId }`
- Returns: `{ messages }` (Array containing Agentforce response with metadata and citations)

**DELETE /api/v1/delete-session**

- Terminates an active Agentforce session
- Headers: `X-Timestamp`, `X-Signature`, `Content-Type: application/json`
- Body: `{ sessionId }`
- Returns: `{ success: true }`

**POST /api/v1/get-hudmo**

- Retrieves harmonized unstructured data model object (HUDMO) content
- Headers: `X-Timestamp`, `X-Signature`, `Content-Type: application/json`
- Body: `{ hudmoName, dccid }` (HUDMO name and Data Cloud Content ID)
- Returns: `{ data }` (Harmonized HTML content with metadata and source URL)

**Authentication:**
All requests require HMAC-SHA256 signature in headers:

- `X-Timestamp`: Current timestamp in milliseconds
- `X-Signature`: HMAC-SHA256(API_SECRET, timestamp + method + path)

## Technologies used

**Client**

- [React](https://react.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Build tool and dev server
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Crypto) - HMAC-SHA256 signature generation

**Server**

- [Node.js](https://nodejs.org/en) - JavaScript runtime
- [Express](https://expressjs.com/) - Web framework
- [Salesforce Einstein Agentforce API v1](https://developer.salesforce.com/docs/einstein/genai/guide/agent-api.html) - AI agent integration
- [OAuth 2.0 Client Credentials Flow](https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_oauth_client_credentials_flow.htm&type=5) - Salesforce authentication
- [HMAC-SHA256](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options) - Request signature validation

For a more detailed overview of the development & production dependencies, please check server [`package.json`](./server/package.json) or client [`package.json`](./client/package.json).

# Configuration

## Requirements

To run this application locally, you will need the following:

- An active Salesforce account with Data Cloud
- Node.js version 20 or later installed (type `node -v` in your terminal to check). Follow [instructions](https://nodejs.org/en/download) if you don't have node installed
- npm version 10.0.0 or later installed (type `npm -v` in your terminal to check). Node.js includes `npm`
- git installed. Follow the instructions to [install git](https://git-scm.com/downloads)
- A [Salesforce](https://www.salesforce.com) account enabled with [Agentforce](https://www.salesforce.com/agentforce/)

## Setup

### Local environment configuration

1. **Clone the repository**

   ```bash
   git clone git@github.com:Matanshe/salesforce-on-ek-demo.git
   cd salesforce-on-ek-demo
   ```

2. **Configure Server Environment Variables**

   Copy the example file and fill in your Salesforce credentials:

   ```bash
   cd server
   cp .env.example .env
   ```

   Edit `server/.env` with your values:

   ```bash
   SALESFORCE_LOGIN_URL=https://your-instance.my.salesforce.com
   CLIENT_ID=your_salesforce_client_id
   CLIENT_SECRET=your_salesforce_client_secret
   AGENTFORCE_AGENT_ID=your_agentforce_agent_id
   API_SECRET=your_generated_secret_key
   PORT=3000
   ```

   Generate a secure API secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Configure Client Environment Variables**

   ```bash
   cd ../client
   cp .env.example .env
   ```

   Edit `client/.env` with the **same** API secret and local API URL:

   ```bash
   VITE_API_URL=http://localhost:3000
   VITE_API_SECRET=your_generated_secret_key
   ```

   ⚠️ **Important**: The `API_SECRET` on the server must match `VITE_API_SECRET` on the client.

4. **Install Dependencies**

   Install server dependencies:

   ```bash
   cd ../server
   npm install
   ```

   Install client dependencies:

   ```bash
   cd ../client
   npm install
   ```

5. **Start the Application**

   Start the server (from the `server` directory):

   ```bash
   npm run dev
   ```

   In a new terminal, start the client (from the `client` directory):

   ```bash
   npm run dev
   ```

6. **Access the Application**

   Open your browser and navigate to `http://localhost:5173`

   The Salesforce Help Portal will open with the Agentforce chat interface ready for questions.

## Deployment

### Heroku Deployment

Once you are happy with your application, you can deploy it to Heroku!

**Prerequisites:**

- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- Heroku account created

**Deployment Steps:**

0. **Validate environment (optional)**  
   Ensure `server/.env` exists and has all required vars before using the scripts:
   ```bash
   npm run validate-env
   ```

1. **Create a Heroku App**

   ```bash
   heroku create your-app-name
   ```

2. **Set Environment Variables**

   Configure all required environment variables in Heroku. You can run the script that reads from `server/.env` (it also sets `VITE_API_SECRET` and `VITE_API_URL` so the client build during dyno start succeeds):

   ```bash
   node scripts/set-heroku-config.js
   ```

   **If you already configured Heroku before:** run this script again so `VITE_API_SECRET` and `VITE_API_URL` are set; otherwise the app will crash on start with "VITE_API_SECRET is required for production builds".

   Or set them manually:

   ```bash
   heroku config:set SALESFORCE_LOGIN_URL=https://your-instance.my.salesforce.com
   heroku config:set CLIENT_ID=your_salesforce_client_id
   heroku config:set CLIENT_SECRET=your_salesforce_client_secret
   heroku config:set AGENTFORCE_AGENT_ID=your_agentforce_agent_id
   heroku config:set API_SECRET=your_generated_secret_key
   ```

   **Note:** Do not set `PORT` on Heroku — Heroku sets it automatically. When calling the API, use the app URL **without** a port (e.g. `https://your-app.herokuapp.com/api/v1/start-session?...`), not `https://your-app.herokuapp.com:3000/...`. The `VITE_API_URL` (and thus the client build) must use the **exact** Heroku app URL where the app is deployed (e.g. `https://ek-ht-poc-8a80d9816745.herokuapp.com`), otherwise the browser will treat API calls as cross-origin and CORS will block them.

3. **Build and Deploy Client**

   Build the client with production environment variables (API URL and API secret). You can use the script that reads `API_SECRET` from `server/.env`:

   ```bash
   npm run build-client:heroku -- your-app-name
   ```

   Or pass the full Heroku URL:

   ```bash
   node scripts/build-client-for-heroku.js https://your-app-name.herokuapp.com
   ```

   Or set env vars manually:

   ```bash
   cd client
   VITE_API_URL=https://your-app-name.herokuapp.com VITE_API_SECRET=your_generated_secret_key npm run build
   ```

   The built files will be in `client/dist/` and should be served by your server.

   **Note:** Make sure the `VITE_API_URL` points to your Heroku app URL and the `VITE_API_SECRET` matches the `API_SECRET` you set in step 2.

4. **Deploy to Heroku**

   You can use the script to build the client, move it to `server/public`, commit, and push in one go (requires [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and a `heroku` git remote, e.g. `heroku git:remote -a your-app-name`):

   ```bash
   npm run push-heroku -- your-app-name
   ```

   Or with an explicit branch (default is `main`):

   ```bash
   node scripts/push-to-heroku.js your-app-name main
   ```

   Or deploy manually after building and moving the client:

   ```bash
   git add server/public
   git commit -m "Deploy: build client for Heroku"
   git push heroku main
   ```

5. **Open Your App**
   ```bash
   heroku open
   ```

For more detailed deployment instructions, please follow the [official Heroku documentation](https://devcenter.heroku.com/articles/git).

**Troubleshooting: "API_SECRET is not configured" in the browser**

This error means the client bundle running in the browser was built without `VITE_API_SECRET` (Vite inlines env vars at build time). Fix it by rebuilding the client with the secret and redeploying:

1. Ensure `server/.env` has `API_SECRET` and run `npm run validate-env`.
2. Rebuild and push in one step (use your real Heroku app name):
   ```bash
   npm run push-heroku -- your-heroku-app-name
   ```
   The build script will verify the secret is inlined; if verification fails, the deploy is aborted.
3. After pushing, do a **hard refresh** so the browser doesn’t use a cached bundle: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac), or open the app in an incognito/private window.
4. If it still fails: run `npm run build-client:heroku -- your-heroku-app-name` and confirm the log shows "Verified: API_SECRET is inlined in client/dist/assets/", then run `npm run move-build`, commit `server/public`, and `git push heroku main`.

**Security Note:** When deploying publicly, be aware that the `API_SECRET` will be visible in the client bundle. For production use with external users, consider implementing additional security measures such as user authentication or IP whitelisting.

# License

[MIT](http://www.opensource.org/licenses/mit-license.html)

# Disclaimer

This software is to be considered "sample code", a Type B Deliverable, and is delivered "as-is" to the user. Salesforce bears no responsibility to support the use or implementation of this software.
