import { OrganizationId } from "@bitwarden/common/types/guid";

import { ProcessingPhase, ProgressInfo, RiskInsightsItem } from "../types";

/**
 * Generic read-only signal interface for framework-agnostic abstraction.
 * Implementations can use Angular Signals or other reactive primitives.
 */
export interface ReadonlySignal<T> {
  (): T;
}

/**
 * Abstraction for the Risk Insights Prototype Orchestration Service.
 *
 * Coordinates progressive loading in phases:
 * - Phase 1: Load ciphers and display immediately
 * - Phase 2: Run health checks (weak + reused) if enabled
 * - Phase 3: Load member counts progressively
 * - Phase 4: Run HIBP checks last (if enabled)
 */
export abstract class RiskInsightsPrototypeOrchestrationServiceAbstraction {
  // Configuration flags (read-only signals)
  abstract readonly enableWeakPassword: ReadonlySignal<boolean>;
  abstract readonly enableHibp: ReadonlySignal<boolean>;
  abstract readonly enableReusedPassword: ReadonlySignal<boolean>;

  // Processing state (read-only signals)
  abstract readonly processingPhase: ReadonlySignal<ProcessingPhase>;
  abstract readonly progressMessage: ReadonlySignal<string>;

  // Progress tracking (read-only signals)
  abstract readonly cipherProgress: ReadonlySignal<ProgressInfo>;
  abstract readonly healthProgress: ReadonlySignal<ProgressInfo>;
  abstract readonly memberProgress: ReadonlySignal<ProgressInfo>;
  abstract readonly hibpProgress: ReadonlySignal<ProgressInfo>;

  // Results (read-only signal)
  abstract readonly items: ReadonlySignal<RiskInsightsItem[]>;

  // Error state (read-only signal)
  abstract readonly error: ReadonlySignal<string | null>;

  // Expose constants for template access
  abstract readonly ProcessingPhase: typeof ProcessingPhase;

  // Initialization
  abstract initializeForOrganization(organizationId: OrganizationId): void;

  // Configuration toggles
  abstract toggleEnableWeakPassword(): void;
  abstract toggleEnableHibp(): void;
  abstract toggleEnableReusedPassword(): void;
  abstract setEnableWeakPassword(enabled: boolean): void;
  abstract setEnableHibp(enabled: boolean): void;
  abstract setEnableReusedPassword(enabled: boolean): void;

  // Actions
  abstract startProcessing(): void;
  abstract resetState(): void;
}
