import { Observable, Subject } from "rxjs";

import {
  AnonLayoutWrapperDataService,
  DefaultAnonLayoutWrapperDataService,
} from "@bitwarden/components";

import { ExtensionAnonLayoutWrapperData } from "./extension-anon-layout-wrapper.component";

export class ExtensionAnonLayoutWrapperDataService
  extends DefaultAnonLayoutWrapperDataService
  implements AnonLayoutWrapperDataService
{
  protected override anonLayoutWrapperDataSubject = new Subject<ExtensionAnonLayoutWrapperData>();

  override setAnonLayoutWrapperData(data: ExtensionAnonLayoutWrapperData): void {
    this.anonLayoutWrapperDataSubject.next(data);
  }

  override anonLayoutWrapperData$(): Observable<ExtensionAnonLayoutWrapperData> {
    return this.anonLayoutWrapperDataSubject.asObservable();
  }
}
