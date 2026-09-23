import { PositionIdentifier } from "@bitwarden/components";

/** Identifies a specific step in the coachmark tour */
export type CoachmarkStepId = "importData" | "addItem" | "shareWithCollections" | "monitorSecurity";

/** Configuration for a single coachmark step */
export interface CoachmarkStep {
  /** Unique identifier for this step */
  id: CoachmarkStepId;

  /** Title displayed in the coachmark popover */
  titleKey: string;

  /** Title key used when the VFO1 shared-folder terminology flag is enabled */
  titleKeyVfo1?: string;

  /** Description/content displayed in the coachmark popover */
  descriptionKey: string;

  /** Description key used when the VFO1 shared-folder terminology flag is enabled */
  descriptionKeyVfo1?: string;

  /** Position of the popover relative to the anchor */
  position: PositionIdentifier;

  /** Optional URL for "Learn more" link */
  learnMoreUrl?: string;

  /** Whether this step is only shown to organizational users */
  requiresOrganization?: boolean;

  /** Whether this step is only shown to users with at least one collection */
  requiresCollections?: boolean;

  /** Route to navigate to before showing this step */
  route?: string;

  /** Route used instead of {@link route} when the VFO1 flag is on */
  routeVfo1?: string;

  /**
   * Whether this step anchors a side-nav entry. A collapsed rail renders none, so the tour opens
   * the nav before the step starts.
   */
  opensSideNav?: boolean;
}

/** All available coachmark steps in display order */
export const COACHMARK_STEPS: CoachmarkStep[] = [
  {
    id: "importData",
    titleKey: "coachmarkImportTitle",
    descriptionKey: "coachmarkImportDescription",
    position: "right-center",
    learnMoreUrl: "https://bitwarden.com/help/import-data/",
    route: "/tools/import",
    // VFO1 drops the Import nav entry — import is a dialog opened from the vault toolbar, so the
    // step anchors that button rather than the import page.
    routeVfo1: "/vault",
  },
  {
    id: "addItem",
    titleKey: "coachmarkAddItemTitle",
    descriptionKey: "coachmarkAddItemDescription",
    position: "below-center",
    learnMoreUrl: "https://bitwarden.com/help/managing-items/",
    route: "/vault",
  },
  {
    id: "shareWithCollections",
    titleKey: "coachmarkShareWithCollectionsTitle",
    descriptionKey: "coachmarkShareWithCollectionsDescription",
    descriptionKeyVfo1: "coachmarkShareWithSharedFoldersDescription",
    position: "right-center",
    learnMoreUrl: "https://bitwarden.com/help/about-collections/",
    requiresOrganization: true,
    requiresCollections: true,
    route: "/vault",
    opensSideNav: true,
  },
  {
    id: "monitorSecurity",
    titleKey: "coachmarkMonitorSecurityTitle",
    descriptionKey: "coachmarkMonitorSecurityDescription",
    position: "right-center",
    learnMoreUrl: "https://bitwarden.com/help/reports/",
    route: "/reports",
    opensSideNav: true,
  },
];
