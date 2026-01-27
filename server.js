import "dotenv/config";
console.log("SFDC_TOKEN_URL set:", process.env.SFDC_TOKEN_URL);
console.log("SFDC_CLIENT_ID set:", !!process.env.SFDC_CLIENT_ID);
console.log("SFDC_CLIENT_SECRET set:", !!process.env.SFDC_CLIENT_SECRET);
import express from "express";
import jsforce from "jsforce";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { statelessHandler } from "express-mcp-handler";

const app = express();
app.use(express.json());

// ---- Salesforce connection (keep your existing auth helper here) ----
async function getConnClientCredentials() {
  const resp = await fetch(process.env.SFDC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SFDC_CLIENT_ID,
      client_secret: process.env.SFDC_CLIENT_SECRET,
    }),
  });
  if (!resp.ok) throw new Error(`Salesforce token error: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();

  return new jsforce.Connection({
    instanceUrl: data.instance_url,
    accessToken: data.access_token,
  });
}

async function getConn() {
  return getConnClientCredentials();
}

// ---- MCP server factory: new server per request (stateless) ----
function serverFactory() {
  const server = new McpServer({ name: "sfdc-mcp", version: "0.1.0" });

  server.tool(
    "soql_query",
    "Run a SOQL query and return records",
    { soql: z.string().min(1) },
    async ({ soql }) => {
      const conn = await getConn();
      const res = await conn.query(soql);
      return { content: [{ type: "text", text: JSON.stringify(res.records, null, 2) }] };
    }
  );

  server.tool(
    "get_case",
    "Fetch a Case by Id",
    { caseId: z.string().min(10) },
    async ({ caseId }) => {
      const conn = await getConn();
      const rec = await conn.sobject("Case").retrieve(caseId);
      return { content: [{ type: "text", text: JSON.stringify(rec, null, 2) }] };
    }
  );

  server.tool(
    "sfdc_whoami",
    "Verify Salesforce auth by calling the identity endpoint",
    {},
    async () => {
      const conn = await getConn();     // uses your token flow
      const id = await conn.identity(); // calls Salesforce identity endpoint
      return { content: [{ type: "text", text: JSON.stringify(id, null, 2) }] };
    }
  );

  return server;

}



// Mount MCP endpoint
app.post("/mcp", statelessHandler(serverFactory)); // per docs :contentReference[oaicite:2]{index=2}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`MCP server running on http://localhost:${port}/mcp`));

app.get("/healthz", (req, res) => res.status(200).send("ok"));

function requireApiKey(req, res, next) {
  const key = req.header("x-api-key");
  if (!key || key !== process.env.MCP_API_KEY) return res.status(401).send("Unauthorized");
  next();
}
app.use("/mcp", requireApiKey);


