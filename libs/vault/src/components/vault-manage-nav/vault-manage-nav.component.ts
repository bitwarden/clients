import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, firstValueFrom, map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ChipActionComponent, NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { vaultScopeCommands, VaultScopeType } from "../../models/vault-scope";

/**
 * The vault's entries in the Password Manager side-nav Manage section — My folders, Archive, and
 * Trash.
 *
 * Hosts project this into their own `bit-nav-section`, alongside whatever else that section holds.
 */
@Component({
  selector: "vault-manage-nav",
  templateUrl: "./vault-manage-nav.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Matches `bit-nav-section`'s own item spacing
    class: "tw-flex tw-flex-col tw-gap-0.5",
  },
  imports: [ChipActionComponent, I18nPipe, NavigationModule],
})
export class VaultManageNavComponent {
  private readonly accountService = inject(AccountService);
  private readonly cipherArchiveService = inject(CipherArchiveService);
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private readonly router = inject(Router);

  protected readonly trashRoute = vaultScopeCommands({ type: VaultScopeType.Trash });

  private readonly archiveRoute = vaultScopeCommands({ type: VaultScopeType.Archive });

  private readonly userCanArchive = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId)),
    ),
    { initialValue: true },
  );

  protected readonly showArchivePremiumBadge = computed(() => !this.userCanArchive());

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Archive is a button rather than a link (see {@link selectArchive}), so it gets no
   * `routerLinkActive` and has to say for itself when it is the current page.
   *
   * `router.isActive` reads router state rather than a signal, so reading {@link currentUrl} is
   * what ties this to navigation — without it the answer would be computed once and kept.
   */
  protected readonly archiveActive = computed(() => {
    this.currentUrl();
    return this.router.isActive(this.router.createUrlTree(this.archiveRoute), {
      // Only this URL counts as the archive; a scoped vault route must not light it up.
      paths: "exact",
      queryParams: "ignored",
      fragment: "ignored",
      matrixParams: "ignored",
    });
  });

  /**
   * Stays a click handler rather than a `route` binding: a user without premium and without
   * anything archived is offered an upgrade instead of an empty archive.
   */
  protected async selectArchive() {
    if (!this.userCanArchive()) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const hasArchivedCiphers =
        (await firstValueFrom(this.cipherArchiveService.archivedCiphers$(userId))).length > 0;
      if (!hasArchivedCiphers) {
        await this.premiumUpgradePromptService.promptForPremium();
        return;
      }
    }
    await this.router.navigate(this.archiveRoute);
  }

  protected async promptForPremium() {
    await this.premiumUpgradePromptService.promptForPremium();
  }
}
