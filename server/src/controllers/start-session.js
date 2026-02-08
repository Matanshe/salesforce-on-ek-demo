import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import sfAuthToken from "../utils/authToken.js";
import { getCustomerById } from "../utils/customerConfig.js";

const startSession = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 📥 - startSession - Request received...`);

    const sessionId = req.query.sessionId;
    const customerId = req.query.customerId || req.body.customerId;

    console.log(`${getCurrentTimestamp()} 🔑 - startSession - Using session ID: ${sessionId}, Customer ID: ${customerId || "default"}`);

    const { accessToken, instanceUrl } = await sfAuthToken(customerId);
    
    // Get agent ID from customer config or fallback to env var
    let agentId;
    if (customerId) {
      const customer = getCustomerById(customerId);
      agentId = customer.agentforceAgentId || "";
      console.log(`${getCurrentTimestamp()} 🤖 - startSession - Customer: ${customerId}, Agent ID from config: ${customer.agentforceAgentId}, Using: ${agentId}`);
    } else {
      agentId = process.env.AGENTFORCE_AGENT_ID || "";
      console.log(`${getCurrentTimestamp()} 🤖 - startSession - Using Agent ID: ${agentId} from environment variable`);
    }
    
    // Ensure agentId is set
    if (!agentId) {
      console.warn(`${getCurrentTimestamp()} ⚠️ - startSession - Agent ID is empty! Customer ID: ${customerId || "none"}`);
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
      throw new Error(`There was an error while getting the Agentforce messages: ${response.statusText}`);
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
    res.status(500).json({
      message: error.message,
    });
  }
};

export default startSession;
