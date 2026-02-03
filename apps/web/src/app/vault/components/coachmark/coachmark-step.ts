/** Identifies a specific step in the coachmark tour */
export type CoachmarkStepId = "importData" | "addItem" | "shareWithCollections" | "monitorSecurity";

/** Configuration for a single coachmark step */
export interface CoachmarkStep {
  /** Unique identifier for this step */
  id: CoachmarkStepId;

  /** Title displayed in the coachmark popover */
  titleKey: string;

  /** Description/content displayed in the coachmark popover */
  descriptionKey: string;

  /** CSS selector to find the anchor element for this coachmark */
  anchorSelector: string;

  /** Position of the popover relative to the anchor */
  position: "above-center" | "below-center" | "left-center" | "right-center";

  /** Optional URL for "Learn more" link */
  learnMoreUrl?: string;

  /** Whether this step is only shown to organizational users */
  requiresOrganization?: boolean;

  /**
   * Optional CSS selector for a parent nav group that needs to be expanded
   * before this step's anchor element is visible.
   */
  parentGroupSelector?: string;
}

/** All available coachmark steps in display order */
export const COACHMARK_STEPS: CoachmarkStep[] = [
  {
    id: "importData",
    titleKey: "coachmarkImportTitle",
    descriptionKey: "coachmarkImportDescription",
    anchorSelector: 'bit-nav-item[route="tools/import"]',
    position: "right-center",
    learnMoreUrl: "https://bitwarden.com/help/import-data/",
    parentGroupSelector: 'bit-nav-group[route="tools"]',
  },
  {
    id: "addItem",
    titleKey: "coachmarkAddItemTitle",
    descriptionKey: "coachmarkAddItemDescription",
    anchorSelector: "#newItemDropdown",
    position: "below-center",
    learnMoreUrl: "https://bitwarden.com/help/managing-items/",
  },
  {
    id: "shareWithCollections",
    titleKey: "coachmarkShareWithCollectionsTitle",
    descriptionKey: "coachmarkShareWithCollectionsDescription",
    anchorSelector: "#collections-filters",
    position: "right-center",
    learnMoreUrl: "https://bitwarden.com/help/about-collections/",
    requiresOrganization: true,
  },
  {
    id: "monitorSecurity",
    titleKey: "coachmarkMonitorSecurityTitle",
    descriptionKey: "coachmarkMonitorSecurityDescription",
    anchorSelector: 'bit-nav-item[route="reports"]',
    position: "right-center",
    learnMoreUrl: "https://bitwarden.com/help/reports/",
  },
];
