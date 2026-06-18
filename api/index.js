/* Vercel serverless entry — re-exports the Express app.
   server/index.js skips app.listen() when process.env.VERCEL is set. */
import app from "../server/index.js";
export default app;
