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
    
    // Log full message structure to help debug
    console.log(`${getCurrentTimestamp()} 📋 - sendMessage - Full message structure:`, JSON.stringify(data.messages?.[0], null, 2));
    
    // Log citedReferences to help debug URL redaction
    if (data.messages?.[0]?.citedReferences) {
      console.log(`${getCurrentTimestamp()} 📚 - sendMessage - Cited References (${data.messages[0].citedReferences.length}):`, JSON.stringify(data.messages[0].citedReferences, null, 2));
    } else {
      console.log(`${getCurrentTimestamp()} ⚠️ - sendMessage - No citedReferences found in response`);
    }
    
    // Check if message contains URL_Redacted
    if (data.messages?.[0]?.message?.includes("URL_Redacted")) {
      console.log(`${getCurrentTimestamp()} ⚠️ - sendMessage - Message contains URL_Redacted`);
      console.log(`${getCurrentTimestamp()} 📝 - sendMessage - Message text:`, data.messages[0].message);
      if (data.messages[0].citedReferences && data.messages[0].citedReferences.length > 0) {
        console.log(`${getCurrentTimestamp()} ✅ - sendMessage - But citedReferences has ${data.messages[0].citedReferences.length} citation(s) with actual URLs`);
      } else {
        console.log(`${getCurrentTimestamp()} ❌ - sendMessage - And no citedReferences available - URLs are fully redacted`);
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
