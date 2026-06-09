import { PositionIdentifier } from "@bitwarden/components";

export const AccessIntelligenceCoachmarkStepId = Object.freeze({
  MonitorActivity: "monitorActivity",
  PrioritizeRisks: "prioritizeRisks",
  CriticalApplications: "criticalApplications",
  HelpMembers: "helpMembers",
  RunReport: "runReport",
} as const);
export type AccessIntelligenceCoachmarkStepId =
  (typeof AccessIntelligenceCoachmarkStepId)[keyof typeof AccessIntelligenceCoachmarkStepId];

export interface AccessIntelligenceCoachmarkStep {
  id: AccessIntelligenceCoachmarkStepId;
  titleKey: string;
  descriptionKey: string;
  position: PositionIdentifier;
  learnMoreUrl?: string;
  tabIndex?: number;
}

export const ACCESS_INTELLIGENCE_COACHMARK_STEPS: AccessIntelligenceCoachmarkStep[] = [
  {
    id: AccessIntelligenceCoachmarkStepId.MonitorActivity,
    titleKey: "aiCoachmarkMonitorActivityTitle",
    descriptionKey: "aiCoachmarkMonitorActivityDescription",
    position: "below-start",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/#activity",
    tabIndex: 0,
  },
  {
    id: AccessIntelligenceCoachmarkStepId.PrioritizeRisks,
    titleKey: "aiCoachmarkPrioritizeRisksTitle",
    descriptionKey: "aiCoachmarkPrioritizeRisksDescription",
    position: "above-center",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/#all-applications",
    tabIndex: 0,
  },
  {
    id: AccessIntelligenceCoachmarkStepId.CriticalApplications,
    titleKey: "aiCoachmarkCriticalApplicationsTitle",
    descriptionKey: "aiCoachmarkCriticalApplicationsDescription",
    position: "below-start",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/#all-applications",
    tabIndex: 2,
  },
  {
    id: AccessIntelligenceCoachmarkStepId.HelpMembers,
    titleKey: "aiCoachmarkHelpMembersTitle",
    descriptionKey: "aiCoachmarkHelpMembersDescription",
    position: "left-center",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/#requesting-password-changes",
    tabIndex: 2,
  },
  {
    id: AccessIntelligenceCoachmarkStepId.RunReport,
    titleKey: "aiCoachmarkRunReportTitle",
    descriptionKey: "aiCoachmarkRunReportDescription",
    position: "below-center",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/#run-the-report",
    tabIndex: 0,
  },
];
