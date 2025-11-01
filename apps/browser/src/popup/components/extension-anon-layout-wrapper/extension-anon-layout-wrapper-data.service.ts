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
  protected override anonLayoutWrapperDataSubject = new Subject<
    Partial<ExtensionAnonLayoutWrapperData>
  >();

  override setAnonLayoutWrapperData(data: Partial<ExtensionAnonLayoutWrapperData>): void {
    this.anonLayoutWrapperDataSubject.next(data);
  }

  override anonLayoutWrapperData$(): Observable<Partial<ExtensionAnonLayoutWrapperData>> {
    return this.anonLayoutWrapperDataSubject.asObservable();
  }
}
