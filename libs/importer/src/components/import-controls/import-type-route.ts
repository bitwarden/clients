import { inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, CanActivateFn, Router } from "@angular/router";
import { map } from "rxjs";

import { ImportType } from "../../models";
import { isPickerVendor } from "../import-source-select/picker-vendor-data";

// Rejects an invalid importType route param before the lazy chunk/component ever construct —
// redirects to redirectTo instead.
export function canActivateImportType(redirectTo: string): CanActivateFn {
  return (route) => {
    const param = route.paramMap.get("importType");
    if (param && isPickerVendor(param)) {
      return true;
    }
    return inject(Router).createUrlTree([redirectTo]);
  };
}

// Reactive to paramMap changes, not a one-time snapshot — stays correct if Angular reuses this
// route's component across a params-only navigation between two vendors.
export function importTypeFromRoute(route: ActivatedRoute): Signal<ImportType> {
  return toSignal(route.paramMap.pipe(map((params) => params.get("importType") as ImportType)), {
    initialValue: route.snapshot.paramMap.get("importType") as ImportType,
  });
}
