import { Observable } from "rxjs";

export abstract class TrustedDeviceToastService {
  adminLoginApproved$: Observable<string>;
  deviceTrusted$: Observable<string>;

  setupListeners$: Observable<string>;
}
