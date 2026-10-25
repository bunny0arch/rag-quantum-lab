// The production build bundles the Express app into dist/index.js so Vercel
// does not need to resolve TypeScript source files at runtime.
// @ts-ignore generated build artifact
import { createApp } from "../dist/index.js";

const appPromise = createApp({ serveClient: false });

export default async function handler(req: any, res: any) {
  const { app } = await appPromise;
  return app(req, res);
}
