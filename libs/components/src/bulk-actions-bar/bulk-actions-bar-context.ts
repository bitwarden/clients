import { InjectionToken, Signal } from "@angular/core";

/**
 * Context shared by `BulkActionsBarComponent` with its descendant
 * `BulkActionComponent`s. Defined in its own file so the action can read the
 * parent's state without importing the bar (which would create a cycle).
 */
export interface BulkActionsBarContext {
  /** True when the bar is rendering in icon-only / compact layout. */
  readonly compact: Signal<boolean>;
  /**
   * The bar's internal additional-actions menu trigger, if rendered. Typed as
   * `unknown` so consumers of this token can identity-compare without pulling
   * in a circular import on `BulkActionComponent`.
   */
  readonly additionalActionsTrigger: Signal<unknown>;
}

export const BULK_ACTIONS_BAR_CONTEXT = new InjectionToken<BulkActionsBarContext>(
  "BULK_ACTIONS_BAR_CONTEXT",
);
