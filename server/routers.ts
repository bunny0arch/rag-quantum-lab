import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { indexExtractedChunks, ingestFiles, queryWorkspace, removeDocument, snapshotWorkspace } from "./rag/service";

const workspaceId = z.string().min(8).max(80);
const apiKey = z.string().trim().min(10).max(300).optional();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  rag: router({
    snapshot: publicProcedure.input(z.object({ workspaceId })).query(({ input }) => snapshotWorkspace(input.workspaceId)),
    ingest: publicProcedure.input(z.object({
      workspaceId,
      files: z.array(z.object({ name: z.string().min(1).max(240), mimeType: z.string().max(160), size: z.number().int().nonnegative(), contentBase64: z.string().max(16 * 1024 * 1024) })).min(1).max(12),
      apiKey,
      embeddingModel: z.string().trim().max(120).optional(),
      chunkSize: z.number().int().min(160).max(4000).optional(),
      overlap: z.number().int().min(0).max(2000).optional(),
    })).mutation(({ input }) => ingestFiles(input)),
    query: publicProcedure.input(z.object({
      workspaceId,
      question: z.string().trim().min(2).max(1200),
      apiKey: z.string().trim().min(10).max(300),
      embeddingModel: z.string().trim().max(120).optional(),
      generationModel: z.string().trim().max(120).optional(),
      topK: z.number().int().min(1).max(10).optional(),
    })).mutation(({ input }) => queryWorkspace(input)),
    indexExtracted: publicProcedure.input(z.object({ workspaceId, apiKey: z.string().trim().min(10).max(300), embeddingModel: z.string().trim().max(120).optional() })).mutation(({ input }) => indexExtractedChunks(input)),
    removeDocument: publicProcedure.input(z.object({ workspaceId, documentId: z.string().min(1).max(80) })).mutation(({ input }) => removeDocument(input.workspaceId, input.documentId)),
  }),
});

export type AppRouter = typeof appRouter;
