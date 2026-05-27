import { PositionIdentifier } from "@bitwarden/components";

export type AccessIntelligenceCoachmarkStepId =
  | "monitorActivity"
  | "prioritizeRisks"
  | "criticalApplications"
  | "helpMembers"
  | "runReport";

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
    id: "monitorActivity",
    titleKey: "aiCoachmarkMonitorActivityTitle",
    descriptionKey: "aiCoachmarkMonitorActivityDescription",
    position: "below-start",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/",
    tabIndex: 0,
  },
  {
    id: "prioritizeRisks",
    titleKey: "aiCoachmarkPrioritizeRisksTitle",
    descriptionKey: "aiCoachmarkPrioritizeRisksDescription",
    position: "above-center",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/",
    tabIndex: 0,
  },
  {
    id: "criticalApplications",
    titleKey: "aiCoachmarkCriticalApplicationsTitle",
    descriptionKey: "aiCoachmarkCriticalApplicationsDescription",
    position: "below-start",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/",
    tabIndex: 2,
  },
  {
    id: "helpMembers",
    titleKey: "aiCoachmarkHelpMembersTitle",
    descriptionKey: "aiCoachmarkHelpMembersDescription",
    position: "left-center",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/",
    tabIndex: 2,
  },
  {
    id: "runReport",
    titleKey: "aiCoachmarkRunReportTitle",
    descriptionKey: "aiCoachmarkRunReportDescription",
    position: "below-center",
    learnMoreUrl: "https://bitwarden.com/help/access-intelligence/",
    tabIndex: 0,
  },
];
