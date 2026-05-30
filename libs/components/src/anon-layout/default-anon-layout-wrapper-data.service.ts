import { Observable, Subject } from "rxjs";

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
    this.anonLayoutWrapperDataSubject.next(this.cachedRouteData);
  }
}
