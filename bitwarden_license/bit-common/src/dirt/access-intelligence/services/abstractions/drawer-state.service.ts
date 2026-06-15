import { Signal } from "@angular/core";

/**
 * Manages drawer UI state for Access Intelligence.
 *
 * This is a presentational service that only handles drawer open/close state.
 * Drawer CONTENT is computed by components from report$ observable and view model query methods.
 *
 * @remarks
 * - Angular-only service (uses Signals per ADR-0027)
 * - No domain logic or data fetching
 * - Components derive content via: combineLatest([toObservable(drawerState), report$]).pipe(...)
 */
export abstract class DrawerStateService {
  /**
   * Current drawer state (open, type, invokerId).
   * Components derive content from report$ + view methods, not from this service.
   */
  abstract drawerState: Signal<DrawerState>;

  /**
   * Opens a drawer of the specified type.
   * @param type - Type of drawer (OrgAtRiskMembers, AppAtRiskMembers, etc.)
   * @param invokerId - Identifier for what triggered the drawer (e.g., card ID, app hostname)
   */
  abstract openDrawer(type: DrawerType, invokerId: string): void;

  /**
   * Closes the currently open drawer.
   */
  abstract closeDrawer(): void;

  /**
   * Toggles drawer - closes if already open with same type/invoker, opens otherwise.
   * @param type - Type of drawer
   * @param invokerId - Identifier for invoker
   */
  abstract toggleDrawer(type: DrawerType, invokerId: string): void;

  /**
   * Checks if a specific drawer type is currently active.
   * @param type - The drawer type to check
   */
  abstract isActiveDrawerType(type: DrawerType): boolean;

  /**
   * Checks if drawer is open for a specific invoker.
   * @param invokerId - The invoker ID to check
   */
  abstract isDrawerOpenForInvoker(invokerId: string): boolean;
}

/**
 * Drawer types for Access Intelligence drawers.
 */
export const DrawerType = Object.freeze({
  None: 0,
  OrgAtRiskMembers: 1,
  AppAtRiskMembers: 2,
  OrgAtRiskApps: 3,
  CriticalAtRiskMembers: 4,
  CriticalAtRiskApps: 5,
} as const);
export type DrawerType = (typeof DrawerType)[keyof typeof DrawerType];

/**
 * State object for drawer.
 * Includes open status, type, and invoker ID (what triggered the drawer).
 */
export interface DrawerState {
  open: boolean;
  type: DrawerType;
  invokerId: string;
}
