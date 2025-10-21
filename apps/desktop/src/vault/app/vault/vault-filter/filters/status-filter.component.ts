import { Component, ViewChild } from "@angular/core";
import { combineLatest, firstValueFrom, map, switchMap } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { StatusFilterComponent as BaseStatusFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/status-filter.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";

@Component({
  selector: "app-status-filter",
  templateUrl: "status-filter.component.html",
  standalone: false,
})
export class StatusFilterComponent extends BaseStatusFilterComponent {
  @ViewChild(PremiumBadgeComponent) private premiumBadgeComponent?: PremiumBadgeComponent;

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

  protected async handleArchiveFilter() {
    const [canArchive, hasArchivedCiphers] = await firstValueFrom(
      combineLatest([this.canArchive$, this.hasArchivedCiphers$]),
    );

    if (canArchive || hasArchivedCiphers) {
      this.applyFilter("archive");
    } else {
      await this.premiumBadgeComponent?.promptForPremium();
    }
  }
}
