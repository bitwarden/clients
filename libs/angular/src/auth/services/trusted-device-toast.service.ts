import { Observable } from "rxjs";

export abstract class TrustedDeviceToastService {
  abstract setupListeners$: Observable<string>;
}
