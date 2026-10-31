import { createConnectionProbe } from "../lib/connectionProbe.js";
import scope from "../deployment-scope.json" with { type: "json" };
const handle = createConnectionProbe({ environment: process.env, scope });
export { handle as GET, handle as POST, handle as HEAD, handle as OPTIONS,
  handle as PUT, handle as PATCH, handle as DELETE };
