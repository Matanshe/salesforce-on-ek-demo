import { getCurrentTimestamp } from "./loggingUtil.js";
import { getCustomerById } from "./customerConfig.js";

// Token cache per customer
const tokenCacheMap = new Map();

const sfAuthToken = async (customerId = null) => {
  try {
    // Get customer config if customerId is provided, otherwise use env vars (backward compatibility)
    let clientId, clientSecret, salesforceLoginUrl;
    
    if (customerId) {
      const customer = getCustomerById(customerId);
      clientId = (customer.clientId && String(customer.clientId).trim()) || process.env.CLIENT_ID || "";
      clientSecret = (customer.clientSecret && String(customer.clientSecret).trim()) || process.env.CLIENT_SECRET || "";
      salesforceLoginUrl = (customer.salesforceLoginUrl && String(customer.salesforceLoginUrl).trim()) || process.env.SALESFORCE_LOGIN_URL || "";
    } else {
      clientId = process.env.CLIENT_ID || "";
      clientSecret = process.env.CLIENT_SECRET || "";
      salesforceLoginUrl = process.env.SALESFORCE_LOGIN_URL || "";
    }

    // Use customer-specific cache key
    const cacheKey = customerId || "default";
    const tokenCache = tokenCacheMap.get(cacheKey) || {
      accessToken: null,
      instanceUrl: null,
      expiresAt: null,
    };

    if (tokenCache.accessToken && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
      console.log(
        `${getCurrentTimestamp()} ♻️ - sfAuthToken - Using cached access token for ${cacheKey} (expires in ${Math.round(
          (tokenCache.expiresAt - Date.now()) / 1000
        )}s)`
      );
      return {
        accessToken: tokenCache.accessToken,
        instanceUrl: tokenCache.instanceUrl,
      };
    }

    console.log(`${getCurrentTimestamp()} 🧰 - sfAuthToken - Requesting new Salesforce access token for ${cacheKey}...`);

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString();

    const config = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    };

    const response = await fetch(`${salesforceLoginUrl}/services/oauth2/token`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`There was an error while getting the Salesforce Access Token: ${response.statusText}`);
    }

    const expiresIn = data.expires_in || 7200;
    const bufferTime = 300;
    const expiresAt = Date.now() + (expiresIn - bufferTime) * 1000;

    const newTokenCache = {
      accessToken: data.access_token,
      instanceUrl: data.instance_url,
      expiresAt,
    };

    tokenCacheMap.set(cacheKey, newTokenCache);

    console.log(
      `${getCurrentTimestamp()} ✅ - sfAuthToken - Successfully provided for ${cacheKey}! (valid for ${Math.round(
        (expiresAt - Date.now()) / 1000
      )}s)`
    );

    return { accessToken: data.access_token, instanceUrl: data.instance_url };
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - sfAuthToken - Error occurred: ${error.message}`);
    throw error;
  }
};

export default sfAuthToken;
