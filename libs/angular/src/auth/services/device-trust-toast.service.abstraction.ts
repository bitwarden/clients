import { Observable } from "rxjs";

export abstract class DeviceTrustToastService {
  abstract setupListeners$: Observable<string>;
}
