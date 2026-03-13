import { Injectable, signal, Signal } from "@angular/core";

import {
  DrawerState,
  DrawerStateService,
  DrawerType,
} from "../../abstractions/drawer-state.service";

/**
 * Default implementation of DrawerStateService using Angular Signals.
 *
 * This is an Angular-only service that manages drawer UI state.
 * Drawer content is derived in components from report$ observable, not stored here.
 */
@Injectable()
export class DefaultDrawerStateService implements DrawerStateService {
  private readonly _drawerState = signal<DrawerState>({
    open: false,
    type: DrawerType.None,
    invokerId: "",
  });

  readonly drawerState: Signal<DrawerState> = this._drawerState.asReadonly();

  openDrawer(type: DrawerType, invokerId: string): void {
    this._drawerState.set({
      open: true,
      type,
      invokerId,
    });
  }

  closeDrawer(): void {
    this._drawerState.set({
      open: false,
      type: DrawerType.None,
      invokerId: "",
    });
  }

  toggleDrawer(type: DrawerType, invokerId: string): void {
    const current = this._drawerState();

    if (current.open && current.type === type && current.invokerId === invokerId) {
      // Already open with same type and invoker - close it
      this.closeDrawer();
    } else {
      // Open with new type/invoker
      this.openDrawer(type, invokerId);
    }
  }

  isActiveDrawerType(type: DrawerType): boolean {
    const current = this._drawerState();
    return current.open && current.type === type;
  }

  isDrawerOpenForInvoker(invokerId: string): boolean {
    const current = this._drawerState();
    return current.open && current.invokerId === invokerId;
  }
}
