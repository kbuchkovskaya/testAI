import "dotenv/config";
import jsforce from "jsforce";

async function main() {
  const resp = await fetch(process.env.SFDC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SFDC_CLIENT_ID,
      client_secret: process.env.SFDC_CLIENT_SECRET,
    }),
  });

  if (!resp.ok) throw new Error(await resp.text());
  const { access_token, instance_url } = await resp.json();

  const conn = new jsforce.Connection({ instanceUrl: instance_url, accessToken: access_token });

  const id = await conn.identity();
  console.log("IDENTITY OK:", id.user_id, id.organization_id);

  const res = await conn.query("SELECT Id, Name FROM Account");
  console.log("SOQL OK:", res.records);
}

main().catch((e) => {
  console.error("SFDC TEST FAILED:", e);
  process.exit(1);
});
