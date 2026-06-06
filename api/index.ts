// Vercel serverless entry point.
// Delegates every /api/* request to the real Express app in server/.
// The app's `app.listen(...)` is skipped on Vercel (guarded by process.env.VERCEL),
// and its default export is used as the serverless handler.
import app from "../server/src/index";

export default app;
