import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getGoldQuote, getGoldCandles, getSymbolQuote, getMarketContext } from "./services/goldData";
import { analyze, indicatorSeries } from "./services/technical";
import { getDailyAnalysis } from "./services/aiAnalysis";
import { chatWithJarvis, toEnglishSpeech } from "./services/chat";
import { getApiHealth, geminiTts } from "./services/gemini";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  gold: router({
    quote: publicProcedure.query(() => getGoldQuote()),

    chart: publicProcedure
      .input(z.object({ timeframe: z.enum(["1h", "4h", "1d"]) }))
      .query(async ({ input }) => {
        const candles = await getGoldCandles(input.timeframe);
        const indicators = indicatorSeries(candles);
        const technical = analyze(candles, input.timeframe);
        return { candles, indicators, technical };
      }),

    marketContext: publicProcedure.query(() => getMarketContext()),

    symbolQuote: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(({ input }) => getSymbolQuote(input.symbol)),
  }),

  ai: router({
    dailyAnalysis: publicProcedure
      .input(z.object({ force: z.boolean().optional() }).optional())
      .query(({ input }) => getDailyAnalysis(input?.force ?? false)),

    chat: publicProcedure
      .input(
        z.object({
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().min(1).max(4000),
              })
            )
            .min(1)
            .max(30),
        })
      )
      .mutation(async ({ input }) => {
        const reply = await chatWithJarvis(input.messages);
        return { reply };
      }),

    /** Arabic reply → cleaned full Arabic text ready for TTS (no summarizing). */
    speechText: publicProcedure
      .input(z.object({ text: z.string().min(1).max(6000) }))
      .mutation(async ({ input }) => {
        const spoken = await toEnglishSpeech(input.text);
        return { spoken };
      }),

    /**
     * Premium JARVIS voice (Algenib) via Gemini TTS on the user's own key.
     * Returns base64 WAV. Client falls back to browser speechSynthesis on error.
     */
    tts: publicProcedure
      .input(z.object({ text: z.string().min(1).max(6000) }))
      .mutation(async ({ input }) => {
        const { audioBase64, mimeType } = await geminiTts(input.text);
        return { audioBase64, mimeType };
      }),

    /** Gemini API key health — lets the UI alert the owner when the key fails/quota runs out. */
    health: publicProcedure.query(() => getApiHealth()),
  }),
});

export type AppRouter = typeof appRouter;
