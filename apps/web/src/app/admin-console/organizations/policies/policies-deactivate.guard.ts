import { Injectable, signal } from "@angular/core";
import { CanDeactivate } from "@angular/router";

// `import type` avoids a circular runtime dependency: the guard only needs
// PoliciesComponent as a TypeScript type (for the CanDeactivate generic and
// the canDeactivate() parameter), never as a runtime value.
import type { PoliciesComponent } from "./policies.component";

@Injectable({ providedIn: "root" })
export class PoliciesDeactivateGuard implements CanDeactivate<PoliciesComponent> {
  private readonly canDeactivateFn = signal<(() => Promise<boolean>) | null>(null);

  /** Called by PoliciesComponent on construction to register its canDeactivate callback. */
  register(fn: () => Promise<boolean>): void {
    this.canDeactivateFn.set(fn);
  }

  /** Called by PoliciesComponent on destroy to clear the registered callback. */
  deregister(): void {
    this.canDeactivateFn.set(null);
  }

  /**
   * Checks whether the currently active PoliciesComponent (if any) can be deactivated.
   * Used by AppComponent before starting the logout process so that canDeactivate
   * runs while the app is still fully functional — before any state is cleared.
   */
  async checkCurrentComponent(): Promise<boolean> {
    const fn = this.canDeactivateFn();
    return fn ? fn() : true;
  }

  canDeactivate(component: PoliciesComponent): Promise<boolean> {
    return component.canDeactivate();
  }
}
