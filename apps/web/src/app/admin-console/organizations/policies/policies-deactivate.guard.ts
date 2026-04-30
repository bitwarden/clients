import { Injectable } from "@angular/core";
import { CanDeactivate } from "@angular/router";

import { PoliciesComponent } from "./policies.component";

@Injectable({ providedIn: "root" })
export class PoliciesDeactivateGuard implements CanDeactivate<PoliciesComponent> {
  canDeactivate(component: PoliciesComponent): Promise<boolean> {
    return component.canDeactivate();
  }
}
