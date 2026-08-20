import { inject, Injectable } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

@Injectable({
  providedIn: "root",
})
export class PremiumUpsellService {
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);
  private billingAccountService = inject(BillingAccountProfileStateService);
  private cipherService = inject(CipherService);

  private activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);
  private readonly activeUserId = toSignal(this.activeUserId$, { requireSync: true });
  private hasPremium$ = this.activeUserId$.pipe(
    switchMap((userId) => {
      return this.billingAccountService.hasPremiumFromAnySource$(userId);
    }),
  );
  private ciphers$ = this.cipherService.ciphers$(this.activeUserId());

  private readonly ciphers = toSignal(this.ciphers$, { initialValue: {} });
  private readonly hasPremium = toSignal(this.hasPremium$, { initialValue: true });
  private readonly accountAgeFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32180PremiumUpsellAccountAge),
    { initialValue: 7 },
  );

  private accountAgeInDays$ = this.accountService.activeAccount$.pipe(
    map((account) => {
      if (!account || !account.creationDate) {
        return 0;
      }
      const creationDate = account.creationDate;
      const ageInMilliseconds = Date.now() - creationDate.getTime();
      return Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24)); //1000 ms * 60 seconds * 60 minutes * 24 hours for milliseconds to days
    }),
  );
  private readonly accountAgeInDays = toSignal(this.accountAgeInDays$, { initialValue: -1 });

  showUpsell() {
    const cipherCount = Object.keys(this.ciphers()).length;

    return (
      this.accountAgeInDays() >= this.accountAgeFeatureFlag() &&
      cipherCount >= 5 &&
      !this.hasPremium()
    );
  }
}
