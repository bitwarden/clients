import { CanDeactivateFn } from "@angular/router";

import { PoliciesComponent } from "./policies.component";

export const policiesCanDeactivateGuard: CanDeactivateFn<PoliciesComponent> = (component) =>
  component.canDeactivate();
