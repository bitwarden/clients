import { Observable, Subject } from "rxjs";

import { AnonLayoutWrapperDataService } from "./anon-layout-wrapper-data.service";
import { AnonLayoutWrapperData } from "./anon-layout-wrapper.component";

export class DefaultAnonLayoutWrapperDataService implements AnonLayoutWrapperDataService {
  protected anonLayoutWrapperDataSubject = new Subject<AnonLayoutWrapperData>();

  setAnonLayoutWrapperData(data: AnonLayoutWrapperData): void {
    this.anonLayoutWrapperDataSubject.next(data);
  }

  anonLayoutWrapperData$(): Observable<AnonLayoutWrapperData> {
    return this.anonLayoutWrapperDataSubject.asObservable();
  }
}
