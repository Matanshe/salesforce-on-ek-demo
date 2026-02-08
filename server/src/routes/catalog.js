import { Router } from "express";
import startSession from "../controllers/start-session.js";
import sendMessage from "../controllers/send-message.js";
import deleteSession from "../controllers/delete-session.js";
import getHudmo from "../controllers/get-hudmo.js";
import queryDmoRelationship from "../controllers/query-dmo-relationship.js";
import getCustomers from "../controllers/get-customers.js";
import getCustomer from "../controllers/get-customer.js";
import { validateSignature } from "../middleware/validateSignature.js";

const catalogRoutes = Router();

catalogRoutes.get("/api/v1/customers", getCustomers);
catalogRoutes.get("/api/v1/customers/:customerId", getCustomer);
catalogRoutes.get("/api/v1/start-session", validateSignature, startSession);
catalogRoutes.post("/api/v1/send-message", validateSignature, sendMessage);
catalogRoutes.delete("/api/v1/delete-session", validateSignature, deleteSession);
catalogRoutes.post("/api/v1/get-hudmo", validateSignature, getHudmo);
catalogRoutes.get("/api/v1/query-dmo-relationship", validateSignature, queryDmoRelationship);
// fast-search is registered on app in index.js so it always matches

export default catalogRoutes;
