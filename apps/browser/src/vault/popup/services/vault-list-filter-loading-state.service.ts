import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({ providedIn: "root" })
export class VaultListFilterLoadingStateService {
  private _filtersLoaded = new Subject<boolean>();
  filtersLoaded$ = this._filtersLoaded.asObservable();

  emitFiltersLoaded() {
    this._filtersLoaded.next(true);
  }
}
