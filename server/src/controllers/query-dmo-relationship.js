import sfAuthToken from "../utils/authToken.js";
import { getCurrentTimestamp } from "../utils/loggingUtil.js";

const queryDmoRelationship = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 🔍 - queryDmoRelationship - Request received...`);

    const customerId = req.query.customerId || req.body.customerId;

    // Query only sf_zooomin_api_tdta_apps__dlm DMO
    // We'll match by title__c on the frontend
    const soqlQuery = `SELECT title__c, product_name__c, major_version__c, minor_version__c, patch_version__c FROM sf_zooomin_api_tdta_apps__dlm`;

    console.log(`${getCurrentTimestamp()} 📝 - queryDmoRelationship - SOQL Query: ${soqlQuery}, Customer ID: ${customerId || "default"}`);

    const { accessToken, instanceUrl } = await sfAuthToken(customerId);

    // URL encode the query
    const encodedQuery = encodeURIComponent(soqlQuery);
    const apiUrl = `${instanceUrl}/services/data/v64.0/query/?q=${encodedQuery}`;

    console.log(`${getCurrentTimestamp()} 🌐 - queryDmoRelationship - API URL: ${apiUrl.replace(/q=[^&]+/, 'q={query}')}`);

    const config = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    console.log(`${getCurrentTimestamp()} 🤖 - queryDmoRelationship - Sending SOQL query to Salesforce API...`);

    const response = await fetch(apiUrl, config);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${getCurrentTimestamp()} ❌ - queryDmoRelationship - API Error: ${response.status} ${response.statusText}`);
      console.error(`${getCurrentTimestamp()} ❌ - queryDmoRelationship - Response: ${errorText}`);
      
      throw new Error(`Failed to execute SOQL query: ${response.statusText}`);
    }

    const data = await response.json();

    // Log the response
    console.log(`${getCurrentTimestamp()} 📄 - queryDmoRelationship - Query executed successfully`);
    console.log(`${getCurrentTimestamp()} 📊 - queryDmoRelationship - Total records: ${data.totalSize}`);
    
    // Handle pagination if needed (Salesforce returns done: false if there are more records)
    let allRecords = [...(data.records || [])];
    let nextRecordsUrl = data.nextRecordsUrl;
    
    // Fetch additional pages if needed
    while (nextRecordsUrl && !data.done) {
      const nextUrl = `${instanceUrl}${nextRecordsUrl}`;
      const nextResponse = await fetch(nextUrl, config);
      
      if (nextResponse.ok) {
        const nextData = await nextResponse.json();
        allRecords = [...allRecords, ...(nextData.records || [])];
        nextRecordsUrl = nextData.nextRecordsUrl;
        if (nextData.done) break;
      } else {
        break;
      }
    }

    console.log(`${getCurrentTimestamp()} ✅ - queryDmoRelationship - Query results received! Total records: ${allRecords.length}`);

    res.status(200).json({ 
      data: {
        totalSize: allRecords.length,
        records: allRecords,
        done: true
      },
      totalSize: allRecords.length,
      records: allRecords,
      done: true
    });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - queryDmoRelationship - Error occurred: ${error.message}`);
    res.status(500).json({
      errorCode: "QUERY_ERROR",
      message: error.message,
    });
  }
};

export default queryDmoRelationship;
