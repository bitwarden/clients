import { Observable, Subject } from "rxjs";

import {
  AnonLayoutWrapperDataService,
  BASE_LAYOUT_DEFAULTS,
  DefaultAnonLayoutWrapperDataService,
} from "@bitwarden/components";

import { EXTENSION_LAYOUT_DEFAULTS } from "./extension-anon-layout-defaults";
import { ExtensionAnonLayoutWrapperData } from "./extension-anon-layout-wrapper.component";

export class ExtensionAnonLayoutWrapperDataService
  extends DefaultAnonLayoutWrapperDataService
  implements AnonLayoutWrapperDataService
{
  protected override anonLayoutWrapperDataSubject = new Subject<
    Partial<ExtensionAnonLayoutWrapperData>
  >();

  override setAnonLayoutWrapperData(data: Partial<ExtensionAnonLayoutWrapperData>): void {
    this.anonLayoutWrapperDataSubject.next(data);
  }

  override anonLayoutWrapperData$(): Observable<Partial<ExtensionAnonLayoutWrapperData>> {
    return this.anonLayoutWrapperDataSubject.asObservable();
  }

  override resetToCachedRouteData(): void {
    // Spread defaults before the cached payload so the emitted object is complete across
    // both base and extension-only fields. Route-declared fields win where present; unset
    // fields fall back to the defaults, which clears stale imperative overrides for fields
    // the route didn't declare.
    this.anonLayoutWrapperDataSubject.next({
      ...BASE_LAYOUT_DEFAULTS,
      ...EXTENSION_LAYOUT_DEFAULTS,
      ...this.cachedRouteData,
    });
  }
}
