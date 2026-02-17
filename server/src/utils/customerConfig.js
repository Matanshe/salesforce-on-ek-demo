import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getCurrentTimestamp } from "./loggingUtil.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let customerConfigCache = null;

export const loadCustomerConfig = () => {
  if (customerConfigCache) {
    return customerConfigCache;
  }

  try {
    const configPath = join(__dirname, "../../config/customers.json");
    const configFile = readFileSync(configPath, "utf8");
    customerConfigCache = JSON.parse(configFile);
    console.log(`${getCurrentTimestamp()} ✅ - loadCustomerConfig - Loaded ${customerConfigCache.customers.length} customer configurations`);
    return customerConfigCache;
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - loadCustomerConfig - Error loading customer config: ${error.message}`);
    throw new Error(`Failed to load customer configuration: ${error.message}`);
  }
};

export const getCustomerById = (customerId) => {
  const config = loadCustomerConfig();
  const customer = config.customers.find((c) => c.id === customerId);
  
  if (!customer) {
    throw new Error(`Customer with ID "${customerId}" not found`);
  }
  
  return customer;
};

export const getAllCustomers = () => {
  const config = loadCustomerConfig();
  return config.customers.map((c) => ({
    id: c.id,
    name: c.name,
    primaryColor: c.ui?.colors?.primary ?? "#0176D3",
    primaryHoverColor: c.ui?.colors?.primaryHover ?? "#014486",
    logoUrl: c.logoUrl ?? null,
  }));
};
