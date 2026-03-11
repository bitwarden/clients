import { Observable, from, map, shareReplay } from "rxjs";

import { PasswordPreloginApiService } from "./password-prelogin-api.service";
import { PasswordPreloginData } from "./password-prelogin.model";
import { PasswordPreloginRequest } from "./password-prelogin.request";
import { PasswordPreloginService } from "./password-prelogin.service";

export class DefaultPasswordPreloginService implements PasswordPreloginService {
  private currentEmail: string | null = null;
  private currentPreloginData$: Observable<PasswordPreloginData> | null = null;

  constructor(private passwordPreloginApiService: PasswordPreloginApiService) {}

  getPreloginData$(email: string): Observable<PasswordPreloginData> {
    const normalized = email.trim().toLowerCase();

    if (normalized === this.currentEmail && this.currentPreloginData$ !== null) {
      return this.currentPreloginData$;
    }

    this.currentEmail = normalized;
    this.currentPreloginData$ = from(
      this.passwordPreloginApiService.getPreloginData(new PasswordPreloginRequest(normalized)),
    ).pipe(map(PasswordPreloginData.fromResponse), shareReplay({ bufferSize: 1, refCount: false }));

    return this.currentPreloginData$;
  }
}
