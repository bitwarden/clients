/**
 * Re-export types from libs/common for backwards compatibility
 * Types are defined in libs/common so they can be imported by the web vault
 */
export {
  RiskInsightsItemStatus,
  ProcessingPhase,
  ProgressInfo,
  RiskInsightsItem,
  createRiskInsightsItem,
  calculateRiskStatus,
} from "@bitwarden/common/dirt/reports/risk-insights/types";
