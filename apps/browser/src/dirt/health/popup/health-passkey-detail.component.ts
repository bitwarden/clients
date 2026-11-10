import { CdkVirtualScrollViewport, ScrollingModule } from "@angular/cdk/scrolling";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { map, of, switchMap } from "rxjs";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { ReportBreach, SecurityKeyIcon } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  PASSKEY_OPPORTUNITIES_IDLE,
  PasskeyOpportunity,
  VaultHealthReportStatus,
} from "@bitwarden/common/dirt/vault-health/models";
import { PasskeyOpportunityService } from "@bitwarden/common/dirt/vault-health/services";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  BadgeModule,
  ButtonModule,
  CompactModeService,
  ItemModule,
  ScrollLayoutDirective,
  SectionComponent,
  SectionHeaderComponent,
  StatusLockupComponent,
  SvgComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordRepromptService } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { HealthScanningComponent } from "./components/health-scanning/health-scanning.component";
import { HealthPasskeyScanService } from "./services/health-passkey-scan.service";

type PasskeyRow = { opportunity: PasskeyOpportunity; cipher: CipherView };

/**
 * Lists the logins whose sites support passkeys and have none saved yet, with
 * what each site supports and a link to its setup instructions. Opening a row
 * views the item, where the user can go on to the site and save a passkey.
 *
 * A sibling of the risk-category detail rather than another category in it: a
 * passkey opportunity is not a risk, its result comes from a separate stream,
 * and its rows have different actions.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-health-passkey-detail",
  templateUrl: "./health-passkey-detail.component.html",
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    AppVaultIconComponent,
    HealthScanningComponent,
    ItemModule,
    BadgeModule,
    ButtonModule,
    SectionComponent,
    SectionHeaderComponent,
    StatusLockupComponent,
    SvgComponent,
    TypographyModule,
    ScrollingModule,
    CdkVirtualScrollViewport,
    ScrollLayoutDirective,
    I18nPipe,
  ],
})
export class HealthPasskeyDetailComponent {
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly passkeyOpportunityService = inject(PasskeyOpportunityService);
  private readonly healthPasskeyScanService = inject(HealthPasskeyScanService);
  private readonly compactModeService = inject(CompactModeService);

  protected readonly emptyIcon = SecurityKeyIcon;
  protected readonly errorIcon = ReportBreach;

  protected readonly rowSize = toSignal<number>(
    this.compactModeService.enabled$.pipe(map((enabled) => (enabled ? 53 : 59))),
  );

  private readonly userId = toSignal(
    this.accountService.activeAccount$.pipe(map((account) => account?.id)),
  );

  private readonly state = toSignal(
    toObservable(this.userId).pipe(
      switchMap((userId) =>
        userId
          ? this.passkeyOpportunityService.getPasskeyOpportunities$(userId)
          : of(PASSKEY_OPPORTUNITIES_IDLE),
      ),
    ),
    { initialValue: PASSKEY_OPPORTUNITIES_IDLE },
  );

  /** The last successful result, kept on screen through a failed background refresh. */
  protected readonly opportunities = computed(() => this.state().opportunities);

  protected readonly failed = computed(
    () => this.state().status === VaultHealthReportStatus.Error && this.opportunities() == null,
  );

  private readonly cipherMap = toSignal(
    toObservable(this.userId).pipe(
      filterOutNullish(),
      switchMap((userId) => this.cipherService.cipherViews$(userId)),
      filterOutNullish(),
      map((ciphers) => new Map(ciphers.map((cipher) => [cipher.id, cipher]))),
    ),
    { initialValue: new Map<string, CipherView>() },
  );

  /** Opportunities joined to their ciphers; one deleted since the last check drops out. */
  protected readonly rows = computed<PasskeyRow[]>(() => {
    const cipherMap = this.cipherMap();
    return (this.opportunities() ?? []).flatMap((opportunity) => {
      const cipher = cipherMap.get(opportunity.id);
      return cipher ? [{ opportunity, cipher }] : [];
    });
  });

  constructor() {
    // Checks on arrival (the page can be opened directly or restored by the
    // popup) and on every vault change, so a login drops off the list once a
    // passkey is saved to it.
    toObservable(this.userId)
      .pipe(
        filterOutNullish(),
        switchMap((userId) => this.healthPasskeyScanService.keepPasskeysCurrent$(userId)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected readonly trackById = (_: number, row: PasskeyRow) => row.opportunity.id;

  protected readonly handleRetry = () => {
    const userId = this.userId();
    if (userId) {
      this.healthPasskeyScanService.retry(userId);
    }
  };

  /** Views the item, behind the master password reprompt like the other Health lists. */
  protected readonly onItemClick = async (cipher: CipherView) => {
    if (!(await this.passwordRepromptService.passwordRepromptCheck(cipher))) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: cipher.id, type: cipher.type },
    });
  };

  /** Opens the site's passkey setup instructions; only http(s) links reach this point. */
  protected readonly onOpenInstructions = (opportunity: PasskeyOpportunity) => {
    if (opportunity.instructions) {
      this.platformUtilsService.launchUri(opportunity.instructions);
    }
  };
}
