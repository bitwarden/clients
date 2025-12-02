import { Component, viewChild } from "@angular/core";
import { combineLatest, firstValueFrom, map, switchMap } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { StatusFilterComponent as BaseStatusFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/status-filter.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-status-filter",
  templateUrl: "status-filter.component.html",
  standalone: false,
})
export class StatusFilterComponent extends BaseStatusFilterComponent {
  private readonly premiumBadgeComponent = viewChild(PremiumBadgeComponent);

  private userId$ = this.accountService.activeAccount$.pipe(getUserId);
  protected canArchive$ = this.userId$.pipe(
    switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId)),
  );

  protected hasArchivedCiphers$ = this.userId$.pipe(
    switchMap((userId) =>
      this.cipherArchiveService.archivedCiphers$(userId).pipe(map((ciphers) => ciphers.length > 0)),
    ),
  );

  constructor(
    private accountService: AccountService,
    private cipherArchiveService: CipherArchiveService,
  ) {
    super();
  }

  protected async handleArchiveFilter(event: Event) {
    const [canArchive, hasArchivedCiphers] = await firstValueFrom(
      combineLatest([this.canArchive$, this.hasArchivedCiphers$]),
    );

    if (canArchive || hasArchivedCiphers) {
      this.applyFilter("archive");
    } else if (this.premiumBadgeComponent()) {
      // The `premiumBadgeComponent` should always be defined here, adding the
      // if to satisfy TypeScript.
      await this.premiumBadgeComponent().promptForPremium(event);
    }
  }
}
