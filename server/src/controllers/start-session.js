import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import sfAuthToken from "../utils/authToken.js";

const startSession = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 📥 - startSession - Request received...`);

    const sessionId = req.query.sessionId;

    console.log(`${getCurrentTimestamp()} 🔑 - startSession - Using session ID: ${sessionId}`);

    const { accessToken, instanceUrl } = await sfAuthToken();
    const agentId = process.env.AGENTFORCE_AGENT_ID || "";

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

    console.log(`${getCurrentTimestamp()} 🤖 - startSession - Starting Agentforce session...`);

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

    res.status(200).json({
      sessionId: data.sessionId, // Return the actual session ID from Agentforce
      messages: data.messages,
    });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - startSession - Error occurred: ${error.message}`);
    res.status(500).json({
      message: error.message,
    });
  }
};

export default startSession;
