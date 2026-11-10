import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { EMPTY, map, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PASSKEY_OPPORTUNITIES_IDLE } from "@bitwarden/common/dirt/vault-health/models";
import { PasskeyOpportunityService } from "@bitwarden/common/dirt/vault-health/services";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { ItemModule, SectionHeaderComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { HealthPasskeyScanService } from "../../services/health-passkey-scan.service";
import { buildPasskeyListRows } from "../../services/passkey-list";
import { PasskeyOpportunityNavItemComponent } from "../passkey-opportunity-nav-item/passkey-opportunity-nav-item.component";

/**
 * The passkey section of the Health Overview: a heading and the passkey
 * opportunities row. Rendered by the Health tab root next to the overview
 * rather than inside it, because a passkey opportunity is not a risk: it is
 * left out of the at-risk score and the "Risks identified" list.
 *
 * Owns its own check, which runs only while it is on screen. Renders nothing
 * until the category is released (its flag and VFO1). A user without Premium sees the row locked,
 * like the other Health categories, and is never checked: the passkey
 * directory is a Premium report, so no directory request is made for them.
 */
@Component({
  selector: "dirt-health-passkey-section",
  templateUrl: "./health-passkey-section.component.html",
  imports: [
    PasskeyOpportunityNavItemComponent,
    ItemModule,
    SectionHeaderComponent,
    TypographyModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthPasskeySectionComponent {
  private readonly accountService = inject(AccountService);
  private readonly passkeyOpportunityService = inject(PasskeyOpportunityService);
  private readonly healthPasskeyScanService = inject(HealthPasskeyScanService);
  private readonly cipherService = inject(CipherService);

  /** Whether Health details are locked behind Premium. */
  readonly locked = input(true);

  /** The passkey report flag and VFO1, whose list the detail page builds on. */
  private readonly enabled = toSignal(this.healthPasskeyScanService.enabled$, {
    initialValue: false,
  });

  private readonly userId = toSignal(
    this.accountService.activeAccount$.pipe(map((account) => account?.id)),
  );

  protected readonly visible = computed(() => this.enabled());

  /** The user to check for, or undefined while the section is hidden or locked. */
  private readonly activeUserId = computed(() =>
    this.visible() && !this.locked() ? this.userId() : undefined,
  );

  protected readonly state = toSignal(
    toObservable(this.activeUserId).pipe(
      switchMap((userId) =>
        userId
          ? this.passkeyOpportunityService.getPasskeyOpportunities$(userId)
          : of(PASSKEY_OPPORTUNITIES_IDLE),
      ),
    ),
    { initialValue: PASSKEY_OPPORTUNITIES_IDLE },
  );

  private readonly ciphers = toSignal(
    toObservable(this.activeUserId).pipe(
      switchMap((userId) => (userId ? this.cipherService.cipherViews$(userId) : of([]))),
      filterOutNullish(),
      map((ciphers) => new Map(ciphers.map((cipher) => [cipher.id, cipher]))),
    ),
    { initialValue: new Map<string, CipherView>() },
  );

  /**
   * The logins the page lists: the same join, so a login deleted since the last check is not
   * counted here while the page has already dropped it.
   */
  protected readonly count = computed(() => {
    const opportunities = this.state().opportunities;
    return opportunities == null
      ? null
      : buildPasskeyListRows(opportunities, this.ciphers()).length;
  });

  constructor() {
    toObservable(this.activeUserId)
      .pipe(
        switchMap((userId) =>
          userId ? this.healthPasskeyScanService.keepPasskeysCurrent$(userId) : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected readonly handleRetry = () => {
    const userId = this.activeUserId();
    if (userId) {
      this.healthPasskeyScanService.retry(userId);
    }
  };
}
