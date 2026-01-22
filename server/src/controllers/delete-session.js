import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import sfAuthToken from "../utils/authToken.js";

const deleteSession = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 📥 - deleteSession - Request received...`);

    const sessionId = req.body.sessionId;

    console.log(`${getCurrentTimestamp()} 🗑️ - deleteSession - Session: ${sessionId}`);

    const { accessToken } = await sfAuthToken();

    const config = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-session-end-reason": "UserRequest",
      },
    };

    console.log(`${getCurrentTimestamp()} 🤖 - deleteSession - Sending Agentforce message...`);

    const response = await fetch(`https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}`, config);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${getCurrentTimestamp()} ❌ - deleteSession - API Error: ${response.status} ${response.statusText}`
      );
      console.error(`${getCurrentTimestamp()} ❌ - deleteSession - Response: ${errorText}`);
      throw new Error(`There was an error while deleting the Agentforce session: ${response.statusText}`);
    }

    console.log(`${getCurrentTimestamp()} ✅ - deleteSession - Agentforce session deleted!`);

    res.status(200).json({
      message: "Session successfully ended.",
    });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - deleteSession - Error occurred: ${error.message}`);
    res.status(500).json({
      message: error.message,
    });
  }
};

export default deleteSession;
