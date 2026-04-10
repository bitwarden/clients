import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class MagnifyNavigationService {
  private readonly viewInBitwardenSubject = new Subject<string>();
  readonly viewInBitwarden$ = this.viewInBitwardenSubject.asObservable();

  requestViewInBitwarden(itemId: string): void {
    this.viewInBitwardenSubject.next(itemId);
  }
}
