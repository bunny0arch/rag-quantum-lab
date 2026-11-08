import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { indexExtractedChunks, ingestFiles, queryWorkspace, removeDocument, snapshotWorkspace } from "./rag/service";

const workspaceId = z.string().min(8).max(80);

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
      embeddingModel: z.string().trim().max(120).optional(),
      chunkSize: z.number().int().min(160).max(4000).optional(),
      overlap: z.number().int().min(0).max(2000).optional(),
    })).mutation(({ input }) => ingestFiles(input)),
    query: publicProcedure.input(z.object({
      workspaceId,
      question: z.string().trim().min(2).max(1200),
      embeddingModel: z.string().trim().max(120).optional(),
      generationModel: z.string().trim().max(120).optional(),
      topK: z.number().int().min(1).max(10).optional(),
      fallbackChunks: z.array(z.object({
        id: z.string().min(1).max(120), documentId: z.string().min(1).max(80),
        sourceName: z.string().max(240), location: z.string().max(500),
        text: z.string().max(5000), charCount: z.number().int().nonnegative(),
        embeddingDimension: z.number().int().positive().optional(),
      })).max(10000).optional(),
      fallbackDocuments: z.array(z.object({
        id: z.string().min(1).max(80), name: z.string().max(240), mimeType: z.string().max(160),
        size: z.number().int().nonnegative(), status: z.enum(["processing", "ready", "extracted", "error"]),
        stage: z.enum(["queued", "validating", "extracting", "chunking", "embedding", "indexing", "ready", "error"]),
        extractedChars: z.number().int().nonnegative(), chunkCount: z.number().int().nonnegative(),
        indexedChunkCount: z.number().int().nonnegative(), createdAt: z.string(), error: z.string().max(2000).optional(),
      })).max(1000).optional(),
      fallbackPoints: z.array(z.object({
        chunkId: z.string().min(1).max(120), documentId: z.string().min(1).max(80),
        sourceName: z.string().max(240), location: z.string().max(500), excerpt: z.string().max(180),
        x: z.number(), y: z.number(), z: z.number(),
      })).max(10000).optional(),
    })).mutation(({ input }) => queryWorkspace(input)),
    indexExtracted: publicProcedure.input(z.object({ workspaceId, embeddingModel: z.string().trim().max(120).optional() })).mutation(({ input }) => indexExtractedChunks(input)),
    removeDocument: publicProcedure.input(z.object({ workspaceId, documentId: z.string().min(1).max(80) })).mutation(({ input }) => removeDocument(input.workspaceId, input.documentId)),
  }),
});

export type AppRouter = typeof appRouter;
