import sfAuthToken from "../utils/authToken.js";
import { getCurrentTimestamp } from "../utils/loggingUtil.js";
import { getCustomerById } from "../utils/customerConfig.js";

const getHudmo = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 🗂️ - getHudmo - Request received...`);

    const hudmoName = req.body.hudmoName;
    const dccid = req.body.dccid;
    const customerId = req.body.customerId;

    // Validate required parameters
    if (!hudmoName || !dccid) {
      console.error(`${getCurrentTimestamp()} ❌ - getHudmo - Missing required parameters: hudmoName=${hudmoName}, dccid=${dccid}`);
      return res.status(400).json({
        errorCode: "MISSING_PARAMETERS",
        message: "Both hudmoName and dccid are required",
      });
    }

    console.log(`${getCurrentTimestamp()} 🔑 - getHudmo - HUDMO: ${hudmoName}, DCCID: ${dccid}, Customer ID: ${customerId || "default"}`);

    const { accessToken, instanceUrl } = await sfAuthToken(customerId);

    // Get Salesforce login URL from customer config or fallback to env var
    let salesforceLoginUrl;
    if (customerId) {
      const customer = getCustomerById(customerId);
      salesforceLoginUrl = customer.salesforceLoginUrl || instanceUrl;
    } else {
      salesforceLoginUrl = process.env.SALESFORCE_LOGIN_URL || instanceUrl;
    }

    // URL encode the parameters to handle special characters
    const encodedHudmoName = encodeURIComponent(hudmoName);
    const encodedDccid = encodeURIComponent(dccid);
    const apiUrl = `${salesforceLoginUrl}/services/data/v64.0/ssot/v1/ek/hudmo/${encodedHudmoName}/${encodedDccid}`;

    console.log(`${getCurrentTimestamp()} 🌐 - getHudmo - API URL: ${apiUrl.replace(/\/services\/data\/v\d+\.\d+\/ssot\/v1\/ek\/hudmo\/[^/]+\/[^/]+/, '/services/data/v64.0/ssot/v1/ek/hudmo/{hudmoName}/{dccid}')}`);

    const config = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    console.log(`${getCurrentTimestamp()} 🤖 - getHudmo - Sending request to Salesforce API...`);

    const response = await fetch(apiUrl, config);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${getCurrentTimestamp()} ❌ - getHudmo - API Error: ${response.status} ${response.statusText}`);
      console.error(`${getCurrentTimestamp()} ❌ - getHudmo - Response: ${errorText}`);
      
      // Handle 404 specifically
      if (response.status === 404) {
        return res.status(404).json({
          errorCode: "NOT_FOUND",
          message: `HUDMO record not found. HUDMO: ${hudmoName}, DCCID: ${dccid}. The record may not exist in your Salesforce org or the API endpoint may be incorrect.`,
        });
      }
      
      throw new Error(`Failed to retrieve HUDMO: ${response.statusText}`);
    }

    const data = await response.json();

    // Log the full response from Salesforce API
    console.log(`${getCurrentTimestamp()} 📄 - getHudmo - Full API Response:`, JSON.stringify(data, null, 2));
    console.log(`${getCurrentTimestamp()} 📄 - getHudmo - Response data:`, data);
    console.log(`${getCurrentTimestamp()} 📄 - getHudmo - Response attributes:`, data.attributes);
    
    // Log specific fields if they exist
    if (data.attributes) {
      console.log(`${getCurrentTimestamp()} 📄 - getHudmo - Content:`, data.attributes.content?.substring(0, 200) + "...");
      console.log(`${getCurrentTimestamp()} 📄 - getHudmo - Title:`, data.attributes.title);
      console.log(`${getCurrentTimestamp()} 📄 - getHudmo - Q&A:`, data.attributes.qa);
      console.log(`${getCurrentTimestamp()} 📄 - getHudmo - Summary:`, data.attributes.summary);
      console.log(`${getCurrentTimestamp()} 📄 - getHudmo - Metadata:`, data.attributes.metadata);
    }

    if (data.attributes && data.attributes.content) {
      data.attributes.content = data.attributes.content
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
    }

    console.log(`${getCurrentTimestamp()} ✅ - getHudmo - Harmonized UDMO received!`);

    res.status(200).json({ data });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - getHudmo - Error occurred: ${error.message}`);
    res.status(500).json({
      message: error.message,
    });
  }
};

export default getHudmo;
