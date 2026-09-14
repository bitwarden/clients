import { Observable, Subject } from "rxjs";

import { ANON_LAYOUT_DEFAULTS } from "./anon-layout-defaults";
import { AnonLayoutWrapperDataService } from "./anon-layout-wrapper-data.service";
import { AnonLayoutWrapperData } from "./anon-layout-wrapper.component";

export class DefaultAnonLayoutWrapperDataService implements AnonLayoutWrapperDataService {
  protected anonLayoutWrapperDataSubject = new Subject<Partial<AnonLayoutWrapperData>>();
  protected cachedRouteData: Partial<AnonLayoutWrapperData> = {};

  setAnonLayoutWrapperData(data: Partial<AnonLayoutWrapperData>): void {
    this.anonLayoutWrapperDataSubject.next(data);
  }

  anonLayoutWrapperData$(): Observable<Partial<AnonLayoutWrapperData>> {
    return this.anonLayoutWrapperDataSubject.asObservable();
  }

  cacheRouteData(data: Partial<AnonLayoutWrapperData>): void {
    this.cachedRouteData = data;
  }

  resetToCachedRouteData(): void {
    // Spread defaults before the cached payload so the emitted object is complete:
    // route-declared fields win where present; unset fields fall back to ANON_LAYOUT_DEFAULTS,
    // which clears stale imperative overrides for fields the route didn't declare.
    this.anonLayoutWrapperDataSubject.next({
      ...ANON_LAYOUT_DEFAULTS,
      ...this.cachedRouteData,
    });
  }
}
