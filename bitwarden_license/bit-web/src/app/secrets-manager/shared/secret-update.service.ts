import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

export interface SecretUpdateEvent {
  secretId: string;
}

@Injectable({
  providedIn: "root",
})
export class SecretUpdateService {
  private secretUpdatedSubject = new Subject<SecretUpdateEvent>();

  notifySecretUpdated(secretId: string): void {
    this.secretUpdatedSubject.next({ secretId });
  }
}
