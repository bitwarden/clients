import { Observable } from "rxjs";

export abstract class TrustedDeviceToastService {
  setupListeners$: Observable<string>;
}
