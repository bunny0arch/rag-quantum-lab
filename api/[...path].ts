import { createApp } from "../server/_core/index.ts";

const appPromise = createApp({ serveClient: false });

export default async function handler(req: any, res: any) {
  const { app } = await appPromise;
  return app(req, res);
}
