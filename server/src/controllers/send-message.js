import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import sfAuthToken from "../utils/authToken.js";

const sendMessage = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 📥 - sendMessage - Request received...`);

    const sessionId = req.body.sessionId;
    const message = req.body.message;
    const sequenceId = req.body.sequenceId;
    const customerId = req.body.customerId || req.query.customerId;

    console.log(`${getCurrentTimestamp()} 🔑 - sendMessage - Session: ${sessionId}, Sequence: ${sequenceId}, Customer ID: ${customerId || "default"}`);

    const { accessToken } = await sfAuthToken(customerId);

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
    console.log(`${getCurrentTimestamp()} 📋 - sendMessage - Request body:`, JSON.stringify(body, null, 2));
    console.log(`${getCurrentTimestamp()} 📋 - sendMessage - Session ID: ${sessionId}`);
    console.log(`${getCurrentTimestamp()} 📋 - sendMessage - Customer ID: ${customerId || "default"}`);

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
    console.log(`${getCurrentTimestamp()} 📤 - sendMessage - Agent response:`, JSON.stringify(data.messages, null, 2));

    // Inspect first message shape for chunks table, chunk record id, citation metadata
    const first = data.messages?.[0];
    if (first) {
      console.log(`${getCurrentTimestamp()} 🔍 - sendMessage - [Shape] Top-level keys:`, Object.keys(first));
      if (Array.isArray(first.citedReferences) && first.citedReferences.length > 0) {
        console.log(`${getCurrentTimestamp()} 🔍 - sendMessage - [Shape] citedReferences count:`, first.citedReferences.length);
        console.log(`${getCurrentTimestamp()} 🔍 - sendMessage - [Shape] First ref keys:`, Object.keys(first.citedReferences[0]));
        console.log(`${getCurrentTimestamp()} 🔍 - sendMessage - [Shape] First citedReference:`, JSON.stringify(first.citedReferences[0], null, 2));
      }
      if (first.result != null) {
        console.log(`${getCurrentTimestamp()} 🔍 - sendMessage - [Shape] result (first 500 chars):`, JSON.stringify(first.result).slice(0, 500));
      }
    }

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
