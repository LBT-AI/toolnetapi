import { createProviderConnection } from "./src/lib/db/repos/connectionsRepo.js";
import { initDb } from "./src/lib/db/index.js";

async function main() {
  await initDb();
  const res = await createProviderConnection({
    provider: "alims-intl",
    authType: "apikey",
    name: "Alibaba Studio",
    apiKey: "sk-ws-H.XHDLLX.TIca.MEQCICaNiwvpXjOLMvqc3g5zabGtZgslMyYr5J1Rvs7GHWhnAiBUfPiQ2QW8PfjjEikk0TMZt9YnbWL5ruGn4hwB1Nvp7Q"
  });
  console.log("Added connection:", res);
}
main().catch(console.error);
