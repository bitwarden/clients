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
