export interface ScoreWeights {
  startingPitcher: number;
  opponentBatting: number;
  bullpen: number;
  offensiveForm: number;
  homeAway: number;
  injuries: number;
  restTravel: number;
  weather: number;
}

export interface SubScore {
  score: number;
  weight: number;
  dataQualityContribution: number;
  warnings: string[];
}
