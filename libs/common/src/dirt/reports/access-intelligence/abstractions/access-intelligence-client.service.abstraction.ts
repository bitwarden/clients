import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  AccessIntelligenceProgress,
  AccessIntelligenceResult,
  AccessIntelligenceState,
  ReadonlySignal,
} from "../types";

/**
 * Abstraction for the Access Intelligence Client service.
 *
 * This service provides a simplified approach to gathering access intelligence:
 * - Loads all data upfront
 * - Runs health checks (weak, reused, HIBP) in parallel as soon as ciphers are retrieved
 * - Loads organization data (collections, users, groups) in parallel with health checks
 * - Maps ciphers to members once base data is loaded
 */
export abstract class AccessIntelligenceClientServiceAbstraction {
  /**
   * Current state of the access intelligence processing
   */
  abstract readonly state: ReadonlySignal<AccessIntelligenceState>;

  /**
   * Error message if processing failed
   */
  abstract readonly error: ReadonlySignal<string | null>;

  /**
   * Progress of cipher loading
   */
  abstract readonly cipherProgress: ReadonlySignal<AccessIntelligenceProgress>;

  /**
   * Progress of health checks (weak, reused, HIBP combined)
   */
  abstract readonly healthProgress: ReadonlySignal<AccessIntelligenceProgress>;

  /**
   * Progress of member mapping
   */
  abstract readonly memberProgress: ReadonlySignal<AccessIntelligenceProgress>;

  /**
   * Final result of access intelligence analysis
   */
  abstract readonly result: ReadonlySignal<AccessIntelligenceResult | null>;

  /**
   * Start access intelligence processing for an organization.
   * This will load ciphers, run health checks, and map members.
   *
   * @param organizationId - The organization to analyze
   */
  abstract start(organizationId: OrganizationId): void;

  /**
   * Reset the service to its initial state.
   * Call this before starting a new analysis or when leaving the page.
   */
  abstract reset(): void;
}
