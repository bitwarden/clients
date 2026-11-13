import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from "@angular/core";
import { outputFromObservable, toSignal } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  BitIconButtonComponent,
  ChipActionComponent,
  IconTileComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NotPremiumDirective } from "../../directives/not-premium.directive";

type ComponentMode = "premiumChip" | "premiumIcon" | "premiumLabel" | "upgradeIcon" | "upgradeChip";

@Component({
  selector: "app-premium-badge",
  template: `
    @switch (mode()) {
      @case ("premiumChip") {
        <button
          type="button"
          *appNotPremium
          bit-chip-action
          class="!tw-rounded-3xl"
          startIcon="bwi-premium"
          [variant]="'accent-primary'"
          (click)="handleClick($event)"
          [label]="'premium' | i18n"
        ></button>
      }
      @case ("premiumIcon") {
        <bit-icon-tile
          *appNotPremium
          icon="bwi-premium"
          variant="teal"
          size="sm"
          [ariaLabel]="'premium' | i18n"
        />
      }
      @case ("premiumLabel") {
        <span
          *appNotPremium
          class="tw-inline-flex tw-items-center tw-gap-2 tw-text-main tw-text-lg"
        >
          <bit-icon-tile icon="bwi-premium" variant="teal" size="sm" />
          {{ "premium" | i18n }}
        </span>
      }
      @case ("upgradeIcon") {
        <button
          type="button"
          buttonType="side-nav"
          size="xsmall"
          *appNotPremium
          bitIconButton="bwi-premium"
          [label]="'upgradeToPremium' | i18n"
          (click)="promptForPremium($event)"
        ></button>
      }
      @case ("upgradeChip") {
        <button
          type="button"
          *appNotPremium
          bit-chip-action
          startIcon="bwi-premium"
          [variant]="'accent-primary'"
          (click)="promptForPremium($event)"
          [label]="'upgrade' | i18n"
        ></button>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    BitIconButtonComponent,
    ChipActionComponent,
    IconTileComponent,
    NotPremiumDirective,
  ],
})
export class PremiumBadgeComponent implements OnInit {
  readonly organizationId = input<string>();
  readonly iconOnly = input<boolean>(false);

  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private readonly configService = inject(ConfigService);

  protected readonly featureBasedUpgradePaths = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM42214_FeatureBasedUpgradePaths),
    { initialValue: false },
  );

  private readonly click$ = new Subject<Event>();
  /** Emitted on a flag-on click. The badge is a clickable chip only when a host binds this. */
  readonly clicked = outputFromObservable(this.click$);
  protected readonly isClickable = signal(false);

  /** The single visual state the template renders; flag-on states take precedence. */
  protected readonly mode = computed<ComponentMode>(() => {
    if (this.featureBasedUpgradePaths()) {
      if (this.isClickable()) {
        return "premiumChip";
      }
      return this.iconOnly() ? "premiumIcon" : "premiumLabel";
    }
    return this.iconOnly() ? "upgradeIcon" : "upgradeChip";
  });

  ngOnInit() {
    // click$.observed is accurate only after Angular wires the host's (clicked) binding.
    this.isClickable.set(this.click$.observed);
  }

  /** Flag-off path: open the upgrade prompt. Kept public — badge-instance sites call it until PM-44281. */
  async promptForPremium(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    await this.premiumUpgradePromptService.promptForPremium(this.organizationId());
  }

  /** Flag-on clickable path: emit only; the host owns the behavior. */
  protected handleClick(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.click$.next(event);
  }
}
