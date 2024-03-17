import { Observable } from "rxjs";

export abstract class AppIdService {
  appId$: Observable<string>;
  anonymousAppId$: Observable<string>;
  getAppId: () => Promise<string>;
  getAnonymousAppId: () => Promise<string>;
}
