import { getCustomerById } from "../utils/customerConfig.js";
import { getCurrentTimestamp } from "../utils/loggingUtil.js";

const getCustomer = async (req, res) => {
  try {
    const customerId = req.params.customerId || req.query.customerId;
    
    if (!customerId) {
      return res.status(400).json({
        errorCode: "MISSING_PARAMETER",
        message: "customerId is required",
      });
    }

    console.log(`${getCurrentTimestamp()} 📋 - getCustomer - Request received for customer: ${customerId}`);

    const customer = getCustomerById(customerId);

    // Default UI theme (Salesforce) when customer has no ui config
    const defaultUi = {
      colors: { primary: "#0176D3", primaryHover: "#014486", accent: "#2E844A" },
      labels: {
        siteName: "Salesforce",
        helpLabel: "Help",
        welcomeBadge: "Salesforce Help Portal",
        welcomeTitle: "Welcome to Salesforce Help",
        welcomeSubtitle: "Salesforce Help on Enterprise Knowledge demo site",
        chatHeaderTitle: "Agentforce on EK",
        chatPlaceholder: "Ask any question about Salesforce products and features.",
        backToHelp: "← Back to Help",
        openInHelp: "Open in Help",
        footerCopyright: "© {year} salesforce.com, inc. All rights reserved. Various trademarks held by their respective owners.",
      },
      homeUrl: "https://www.salesforce.com",
      logoUrl: null,
      footerLinks: [
        { label: "Salesforce.com", href: "https://www.salesforce.com" },
        { label: "Help & Training", href: "https://help.salesforce.com" },
        { label: "Trailhead", href: "https://trailhead.salesforce.com" },
        { label: "Developer Center", href: "https://developer.salesforce.com" },
      ],
    };

    const ui = customer.ui
      ? { ...defaultUi, ...customer.ui, colors: { ...defaultUi.colors, ...customer.ui.colors }, labels: { ...defaultUi.labels, ...customer.ui.labels } }
      : defaultUi;

    // Return customer without sensitive data (or return all if needed)
    const customerResponse = {
      id: customer.id,
      name: customer.name,
      objectApiName: customer.objectApiName || null,
      tocUrl: customer.tocUrl || null,
      ui,
    };

    if (!customer.objectApiName) {
      console.warn(`${getCurrentTimestamp()} ⚠️ - getCustomer - Customer ${customerId} does not have objectApiName configured`);
    }

    console.log(`${getCurrentTimestamp()} ✅ - getCustomer - Returning customer: ${customerId} with objectApiName: ${customerResponse.objectApiName}`);

    res.status(200).json({
      customer: customerResponse,
    });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - getCustomer - Error occurred: ${error.message}`);
    res.status(404).json({
      errorCode: "NOT_FOUND",
      message: error.message,
    });
  }
};

export default getCustomer;
