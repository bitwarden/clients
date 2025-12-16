import { CommonModule } from "@angular/common";
import { Component, viewChild, input, inject, computed } from "@angular/core";
import { combineLatest, firstValueFrom, map, switchMap } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { NavigationModule, A11yTitleDirective } from "@bitwarden/components";
import { VaultFilter, CipherStatus, CipherTypeFilter } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-status-filter",
  templateUrl: "status-filter.component.html",
  imports: [CommonModule, A11yTitleDirective, NavigationModule, PremiumBadgeComponent],
})
export class StatusFilterComponent {
  private accountService: AccountService = inject(AccountService);
  private cipherArchiveService: CipherArchiveService = inject(CipherArchiveService);

  protected readonly hideTrash = input(false);
  protected readonly hideArchive = input(false);
  protected readonly activeFilter = input<VaultFilter>();
  protected readonly archiveFilter: CipherTypeFilter = {
    id: "archive",
    name: "archiveNoun",
    type: "archive",
    icon: "bwi-archive",
  };
  protected readonly trashFilter: CipherTypeFilter = {
    id: "trash",
    name: "trash",
    type: "trash",
    icon: "bwi-trash",
  };

  protected readonly show = computed(() => {
    return !(this.hideTrash() && this.hideArchive());
  });

  protected applyFilter(filterType: CipherStatus) {
    let filter: CipherTypeFilter = null;
    if (filterType === "archive") {
      filter = this.archiveFilter;
    } else if (filterType === "trash") {
      filter = this.trashFilter;
    }

    if (filter) {
      this.activeFilter().selectedCipherTypeNode = new TreeNode<CipherTypeFilter>(filter, null);
    }
  }

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
