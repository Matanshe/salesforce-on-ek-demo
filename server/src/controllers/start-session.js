import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import sfAuthToken from "../utils/authToken.js";
import { getCustomerById } from "../utils/customerConfig.js";

const startSession = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 📥 - startSession - Request received...`);

    const sessionId = req.query.sessionId;
    const customerId = req.query.customerId || req.body.customerId;
    const accountName = req.query.accountName || (req.body && req.body.accountName);

    console.log(`${getCurrentTimestamp()} 🔑 - startSession - Using session ID: ${sessionId}, Customer ID: ${customerId || "default"}${accountName ? `, accountName: ${accountName}` : ""}`);

    // Get agent ID from customer config or fallback to env var (before auth so we can return 404 for unknown customer)
    let agentId;
    if (customerId) {
      try {
        const customer = getCustomerById(customerId);
        agentId = customer.agentforceAgentId || "";
        console.log(`${getCurrentTimestamp()} 🤖 - startSession - Customer: ${customerId}, Agent ID from config: ${customer.agentforceAgentId}, Using: ${agentId}`);
      } catch (err) {
        if (err.message && err.message.includes("not found")) {
          res.status(404).json({ error: "customer_not_found", message: err.message });
          return;
        }
        throw err;
      }
    } else {
      agentId = process.env.AGENTFORCE_AGENT_ID || "";
      console.log(`${getCurrentTimestamp()} 🤖 - startSession - Using Agent ID: ${agentId} from environment variable`);
    }

    const { accessToken, instanceUrl } = await sfAuthToken(customerId);

    if (!accessToken || !instanceUrl) {
      console.error(`${getCurrentTimestamp()} ❌ - startSession - Missing Salesforce token or instance URL. Check clientId/clientSecret for customer "${customerId || "default"}" in server config or .env.`);
      res.status(503).json({
        message: "Salesforce authentication failed or is not configured. Check server config (customers.json or .env) for CLIENT_ID, CLIENT_SECRET, and SALESFORCE_LOGIN_URL.",
      });
      return;
    }
    
    // Ensure agentId is set before calling Agentforce
    if (!agentId || !String(agentId).trim()) {
      console.error(`${getCurrentTimestamp()} ❌ - startSession - Agent ID is missing. Customer: ${customerId || "default"}. Set agentforceAgentId in server/config/customers.json or AGENTFORCE_AGENT_ID in .env.`);
      res.status(503).json({
        error: "start_session_failed",
        message: "Agent is not configured. Set agentforceAgentId for this customer in server/config/customers.json or AGENTFORCE_AGENT_ID in server/.env.",
      });
      return;
    }

    const body = {
      externalSessionKey: sessionId,
      instanceConfig: {
        endpoint: instanceUrl,
      },
      streamingCapabilities: {
        chunkTypes: ["Text"],
      },
      bypassUser: true,
    };
    if (accountName) {
      body.variables = [{ name: "accountName", type: "Text", value: accountName }];
    }

    const config = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    };

    console.log(`${getCurrentTimestamp()} 🤖 - startSession - Starting Agentforce session with Agent ID: ${agentId}...`);
    console.log(`${getCurrentTimestamp()} 📋 - startSession - Request body:`, JSON.stringify(body, null, 2));
    console.log(`${getCurrentTimestamp()} 📋 - startSession - Instance URL: ${instanceUrl}`);
    console.log(`${getCurrentTimestamp()} 📋 - startSession - Customer ID: ${customerId}`);

    const response = await fetch(`https://api.salesforce.com/einstein/ai-agent/v1/agents/${agentId}/sessions`, config);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${getCurrentTimestamp()} ❌ - startSession - API Error: ${response.status} ${response.statusText}`
      );
      console.error(`${getCurrentTimestamp()} ❌ - startSession - Response: ${errorText}`);
      let detail = response.statusText;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.message) detail = errJson.message;
        else if (errJson.error_description) detail = errJson.error_description;
        else if (errJson[0]?.message) detail = errJson[0].message;
      } catch {
        if (errorText && errorText.length < 200) detail = errorText;
      }
      const status = response.status >= 400 && response.status < 600 ? response.status : 502;
      res.status(status).json({
        error: "start_session_failed",
        message: `Agentforce error: ${detail}`,
      });
      return;
    }

    const data = await response.json();

    console.log(`${getCurrentTimestamp()} ✅ - startSession - Agentforce session started!`);
    console.log(`${getCurrentTimestamp()} 🔑 - startSession - Session ID from Agentforce: ${data.sessionId}`);
    console.log(`${getCurrentTimestamp()} 🤖 - startSession - Returning Agent ID: ${agentId} to client`);

    res.status(200).json({
      sessionId: data.sessionId, // Return the actual session ID from Agentforce
      messages: data.messages,
      agentId: agentId || null, // Include agent ID in response for client-side logging
    });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - startSession - Error occurred: ${error.message}`);
    const status = error.message?.includes("Salesforce") || error.message?.includes("authentication") ? 503 : 500;
    res.status(status).json({
      error: "start_session_failed",
      message: error.message,
    });
  }
};

export default startSession;
