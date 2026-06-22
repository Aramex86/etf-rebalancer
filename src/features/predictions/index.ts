// src/features/predictions/index.ts — public API

export { PredictionsFeature } from "./ui/PredictionsFeature";
export { PredictionHeaderMolecule } from "./ui/PredictionHeaderMolecule";
export { PredictionTableMolecule } from "./ui/PredictionTableMolecule";
export { PredictionCardMolecule } from "./ui/PredictionCardMolecule";

// Client API wrappers
export {
  fetchPredictions,
  createPredictions,
  type PredictionWithAccuracy,
} from "./api/predictions";
export { verifyPredictions, type VerifyResponse } from "./api/verify";
export { fetchMarketData } from "./api/marketData";
