import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import sfAuthToken from "../utils/authToken.js";

const sendMessage = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 📥 - sendMessage - Request received...`);

    const sessionId = req.body.sessionId;
    const message = req.body.message;
    const sequenceId = req.body.sequenceId;

    console.log(`${getCurrentTimestamp()} 🔑 - sendMessage - Session: ${sessionId}, Sequence: ${sequenceId}`);

    const { accessToken } = await sfAuthToken();

    const body = {
      message: {
        sequenceId: sequenceId,
        type: "Text",
        text: message,
      },
    };

    const config = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    };

    console.log(`${getCurrentTimestamp()} 🤖 - sendMessage - Sending Agentforce message...`);

    const response = await fetch(
      `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}/messages`,
      config
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${getCurrentTimestamp()} ❌ - sendMessage - API Error: ${response.status} ${response.statusText}`);
      console.error(`${getCurrentTimestamp()} ❌ - sendMessage - Response: ${errorText}`);
      throw new Error(`There was an error while sending the Agentforce message: ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`${getCurrentTimestamp()} ✅ - sendMessage - Message sent!`);

    res.status(200).json({
      messages: data.messages,
    });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - sendMessage - Error occurred: ${error.message}`);
    res.status(500).json({
      message: error.message,
    });
  }
};

export default sendMessage;
