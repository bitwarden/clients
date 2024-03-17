import { Observable } from "rxjs";

export abstract class SettingsService {
  disableFavicon$: Observable<boolean>;

  setDisableFavicon: (value: boolean) => Promise<any>;
  getDisableFavicon: () => boolean;
}
