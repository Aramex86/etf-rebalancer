// src/entities/prediction/index.ts — public API

export {
  savePrediction,
  getLatestPredictions,
  getUnverifiedPredictions,
  getPredictionsBySymbol,
  markVerified,
} from "./model/predictionRepository";
export type {
  PredictionRecord,
  VerificationResult,
  Direction,
  Signal,
} from "./model/predictionRepository";
export type { PredictionInput as PredictionSaveInput } from "./model/predictionRepository";

export {
  randomWalkBaseline,
  smaDriftBaseline,
} from "./model/predictionBaselines";

export type {
  PredictionInput,
  LLMResponse,
  PredictionResult,
  AccuracyStats,
} from "./model/predictionTypes";

export { calcAfterTaxReturn, type DistPolicy } from "./model/predictionTax";
export {
  calcSignal,
  getSignalColor,
  getSignalLabel,
} from "./model/predictionSignals";
export { predict } from "./model/predictionEngine";
export { findBestAlternative } from "./model/predictionAlternatives";
export {
  verifyPrediction,
  calcAccuracyStats,
  getAccuracyBySymbol,
} from "./model/predictionAccuracy";

// Mastra tools
export { predictionEngineTool } from "./model/predictionEngineTool";
export { predictionTaxTool } from "./model/predictionTaxTool";
export { predictionSignalTool } from "./model/predictionSignalTool";
