export const MLB_FIXTURE_SCHEDULE = {
  totalItems: 1,
  dates: [
    {
      date: '2026-06-26',
      games: [
        {
          gamePk: 100001,
          gameType: 'R',
          gameNumber: 1,
          gameDate: '2026-06-26T22:10:00Z',
          officialDate: '2026-06-26',
          status: {
            abstractGameState: 'Preview',
            codedGameState: 'P',
            detailedState: 'Pre-Game',
            startTimeTBD: false,
          },
          teams: {
            away: {
              team: { id: 100101, name: 'Fixture Team Alpha' },
              probablePitcher: { id: 100201, fullName: 'Fixture Pitcher Alpha' },
              leagueRecord: { wins: 50, losses: 40, pct: '.556' },
            },
            home: {
              team: { id: 100102, name: 'Fixture Team Beta' },
              probablePitcher: { id: 100202, fullName: 'Fixture Pitcher Beta' },
              leagueRecord: { wins: 45, losses: 45, pct: '.500' },
            },
          },
          venue: { id: 1001, name: 'Fixture Stadium' },
          dayNight: 'day',
          scheduledInnings: 9,
          doubleHeader: 'N',
          seriesGameNumber: 1,
          gamesInSeries: 3,
          seriesDescription: 'Regular',
        },
      ],
    },
  ],
} as const;

export const MLB_FIXTURE_FEED = {
  gamePk: 100001,
  gameData: {
    status: {
      abstractGameState: 'Preview',
      codedGameState: 'P',
      detailedState: 'Pre-Game',
    },
    datetime: {
      dateTime: '2026-06-26T22:10:00Z',
      dayNight: 'day',
    },
    teams: {
      away: { id: 100101, name: 'Fixture Team Alpha' },
      home: { id: 100102, name: 'Fixture Team Beta' },
    },
    probablePitchers: {
      away: { id: 100201, fullName: 'Fixture Pitcher Alpha' },
      home: { id: 100202, fullName: 'Fixture Pitcher Beta' },
    },
  },
} as const;

export const MLB_FIXTURE_VENUE = {
  venues: [
    {
      id: 1001,
      name: 'Fixture Stadium',
      timeZone: { id: 'UTC' },
    },
  ],
} as const;

export const MLB_FIXTURE_TEAM_HITTING = {
  people: [{ id: 100101, fullName: 'Fixture Team Alpha' }],
  stats: [
    {
      type: { displayName: 'Team' },
      group: { displayName: 'hitting' },
      splits: [
        {
          season: '2026',
          stat: {
            gamesPlayed: 60,
            runs: 180,
            hits: 480,
            homeRuns: 70,
            rbi: 220,
            avg: '.260',
            obp: '.335',
            slg: '.440',
            ops: '.775',
            strikeOuts: 420,
            baseOnBalls: 200,
            stolenBases: 35,
            caughtStealing: 10,
            leftOnBase: 380,
          },
          team: { id: 100101, name: 'Fixture Team Alpha' },
        },
      ],
    },
  ],
} as const;

export const MLB_FIXTURE_TEAM_PITCHING = {
  people: [{ id: 100102, fullName: 'Fixture Team Beta' }],
  stats: [
    {
      type: { displayName: 'Team' },
      group: { displayName: 'pitching' },
      splits: [
        {
          season: '2026',
          stat: {
            gamesPlayed: 60,
            gamesStarted: 60,
            inningsPitched: '540.0',
            era: '3.55',
            whip: '1.25',
            strikeOuts: 480,
            baseOnBalls: 190,
            homeRuns: 55,
            hits: 480,
            earnedRuns: 212,
            wins: 32,
            losses: 28,
            saves: 20,
            holds: 18,
            blownSaves: 4,
            avg: '.248',
          },
          team: { id: 100102, name: 'Fixture Team Beta' },
        },
      ],
    },
  ],
} as const;

export const MLB_FIXTURE_PITCHER_SEASON = {
  people: [{ id: 100201, fullName: 'Fixture Pitcher Alpha' }],
  stats: [
    {
      type: { displayName: 'Pitcher' },
      group: { displayName: 'pitching' },
      splits: [
        {
          season: '2026',
          stat: {
            age: 28,
            gamesPlayed: 20,
            gamesStarted: 20,
            inningsPitched: '120.0',
            era: '3.00',
            whip: '1.10',
            strikeOuts: 85,
            baseOnBalls: 35,
            homeRuns: 10,
            hits: 98,
            wins: 11,
            losses: 4,
            saves: 0,
            holds: 0,
            blownSaves: 0,
            earnedRuns: 38,
          },
          team: { id: 100101, name: 'Fixture Team Alpha' },
          player: { id: 100201, fullName: 'Fixture Pitcher Alpha' },
        },
      ],
    },
  ],
} as const;

export const MLB_FIXTURE_PITCHER_GAME_LOG = {
  people: [{ id: 100201, fullName: 'Fixture Pitcher Alpha' }],
  stats: [
    {
      type: { displayName: 'gameLog' },
      group: { displayName: 'pitching' },
      splits: [
        {
          date: '2026-06-24',
          season: '2026',
          stat: {
            inningsPitched: 6,
            earnedRuns: 2,
            strikeOuts: 7,
            baseOnBalls: 1,
            numberOfPitches: 95,
            homeRuns: 1,
            hits: 4,
          },
          opponent: { id: 100102, name: 'Fixture Opponent X' },
          game: { gamePk: 900100 },
        },
        {
          date: '2026-06-17',
          season: '2026',
          stat: {
            inningsPitched: 5,
            earnedRuns: 1,
            strikeOuts: 8,
            baseOnBalls: 0,
            numberOfPitches: 88,
            homeRuns: 0,
            hits: 3,
          },
          opponent: { id: 100103, name: 'Fixture Opponent Y' },
          game: { gamePk: 900101 },
        },
        {
          date: '2026-06-10',
          season: '2026',
          stat: {
            inningsPitched: 7,
            earnedRuns: 3,
            strikeOuts: 6,
            baseOnBalls: 2,
            numberOfPitches: 102,
            homeRuns: 2,
            hits: 5,
          },
          opponent: { id: 100104, name: 'Fixture Opponent Z' },
          game: { gamePk: 900102 },
        },
      ],
    },
  ],
} as const;
