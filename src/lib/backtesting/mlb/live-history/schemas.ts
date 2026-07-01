import { z } from 'zod';

export const MLBScheduleGameSchema = z.object({
  gamePk: z.number(),
  officialDate: z.string(),
  gameDate: z.string(),
  status: z.object({
    abstractGameState: z.string(),
    detailedState: z.string(),
  }),
  teams: z.object({
    home: z.object({
      team: z.object({ id: z.number(), name: z.string() }),
      probablePitcher: z
        .object({
          id: z.number(),
          name: z.string().optional(),
          lastName: z.string().optional(),
        })
        .nullable()
        .optional(),
    }),
    away: z.object({
      team: z.object({ id: z.number(), name: z.string() }),
      probablePitcher: z
        .object({
          id: z.number(),
          name: z.string().optional(),
          lastName: z.string().optional(),
        })
        .nullable()
        .optional(),
    }),
  }),
  venue: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  doubleHeader: z.string().optional(),
  gameNumber: z.number().optional(),
  scheduledInnings: z.number().nullable().optional(),
  rescheduleDate: z.string().optional(),
  rescheduledFromGamePk: z.number().nullable().optional(),
  rescheduledFromDate: z.string().optional(),
});

export const MLBScheduleResponseSchema = z.object({
  dates: z.array(
    z.object({
      date: z.string(),
      games: z.array(MLBScheduleGameSchema),
    }),
  ),
});

const MLBPlayAboutSchema = z.object({
  isComplete: z.boolean().optional(),
  endTime: z.string().optional(),
});

const MLBPlaySchema = z.object({
  about: MLBPlayAboutSchema.optional(),
});

export const MLBOutcomeFeedSchema = z.object({
  gamePk: z.number(),
  gameData: z.object({
    status: z.object({
      abstractGameState: z.string(),
      codedGameState: z.string(),
      detailedState: z.string(),
    }),
    linescore: z.object({}).optional(),
  }),
  liveData: z
    .object({
      linescore: z.object({
        currentInning: z.number().optional(),
        teams: z.object({
          home: z.object({ runs: z.number() }).optional(),
          away: z.object({ runs: z.number() }).optional(),
        }).optional(),
      }).optional(),
      innings: z.array(
        z.object({
          num: z.number(),
          home: z.object({ runs: z.number() }),
          away: z.object({ runs: z.number() }),
        }),
      ).optional(),
      plays: z
        .object({
          allPlays: z.array(MLBPlaySchema).optional(),
        })
        .optional(),
    })
    .optional(),
});

const MLBPlayerPitchingStatsSchema = z.object({
  gamesPlayed: z.number().optional(),
  gamesStarted: z.number().optional(),
  runs: z.number().optional(),
  earnedRuns: z.number().optional(),
  hits: z.number().optional(),
  homeRuns: z.number().optional(),
  strikeOuts: z.number().optional(),
  baseOnBalls: z.number().optional(),
  battersFaced: z.number().optional(),
  outs: z.number().optional(),
  pitchesThrown: z.number().optional(),
  strikes: z.number().optional(),
}).optional();

const MLBPlayerBoxscoreEntrySchema = z.object({
  person: z.object({ id: z.number() }),
  stats: z.object({ pitching: MLBPlayerPitchingStatsSchema }).optional(),
});

export { MLBPlayerBoxscoreEntrySchema };

const MLBTeamBoxscoreSchema = z.object({
  players: z.record(z.string(), MLBPlayerBoxscoreEntrySchema).optional(),
}).optional();

export const MLBPitcherFeedSchema = z.object({
  gamePk: z.number(),
  gameData: z.object({
    status: z.object({
      abstractGameState: z.string(),
      codedGameState: z.string(),
      detailedState: z.string(),
    }),
    linescore: z.object({}).optional(),
  }),
  liveData: z
    .object({
      boxscore: z.object({
        teams: z.object({
          home: MLBTeamBoxscoreSchema,
          away: MLBTeamBoxscoreSchema,
        }),
      }),
      plays: z
        .object({
          allPlays: z.array(MLBPlaySchema).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const CacheEnvelopeSchema = <T>(dataShape: z.ZodType<T>) =>
  z.object({
    version: z.string(),
    endpoint: z.string(),
    params: z.record(z.unknown()),
    cachedAt: z.coerce.date(),
    data: dataShape,
    provenance: z.object({
      endpoint: z.string(),
      fetchedAt: z.coerce.date(),
      sourceTimestamp: z.coerce.date().nullable(),
    }),
  });

export const CacheStatsSchema = z.object({
  hits: z.number(),
  misses: z.number(),
  writes: z.number(),
  corruptions: z.number(),
  versionMismatches: z.number(),
});

export type MutableCacheStats = z.infer<typeof CacheStatsSchema>;
