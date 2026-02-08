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

    // Return customer without sensitive data (or return all if needed)
    const customerResponse = {
      id: customer.id,
      name: customer.name,
      objectApiName: customer.objectApiName || null,
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
