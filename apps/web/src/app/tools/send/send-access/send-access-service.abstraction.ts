import { UrlTree } from "@angular/router";
import { Observable } from "rxjs";

export abstract class SendAccessService {
  abstract redirect$: (sendId: string) => Observable<UrlTree>;

  abstract setContext: (sendId: string, key: string) => Promise<void>;

  abstract clear: () => Promise<void>;
}
