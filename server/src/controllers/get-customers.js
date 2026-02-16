import { getAllCustomers } from "../utils/customerConfig.js";
import { getCurrentTimestamp } from "../utils/loggingUtil.js";

const getCustomers = async (req, res) => {
  try {
    console.log(`${getCurrentTimestamp()} 📋 - getCustomers - Request received...`);

    const customers = getAllCustomers();

    console.log(`${getCurrentTimestamp()} ✅ - getCustomers - Returning ${customers.length} customers`);

    res.status(200).json({
      customers,
    });
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - getCustomers - Error occurred: ${error.message}`);
    res.status(500).json({
      errorCode: "CONFIG_ERROR",
      message: error.message,
    });
  }
};

export default getCustomers;
