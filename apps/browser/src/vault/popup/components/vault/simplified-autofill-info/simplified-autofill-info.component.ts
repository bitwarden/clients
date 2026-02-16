import { AsyncPipe } from "@angular/common";
import {
  Component,
  ChangeDetectionStrategy,
  viewChild,
  ElementRef,
  inject,
  effect,
} from "@angular/core";
import { combineLatest, firstValueFrom } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { InfoFilledIcon } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PopoverModule, IconModule, ButtonModule, SvgModule } from "@bitwarden/components";
import { StateProvider, UserKeyDefinition, VAULT_AUTOFILL_SIMPLIFIED_ICON } from "@bitwarden/state";

const VAULT_AUTOFILL_SIMPLIFIED_ICON_KEY = new UserKeyDefinition<{
  hasSeen: boolean;
  hasDismissed: boolean;
}>(VAULT_AUTOFILL_SIMPLIFIED_ICON, "vaultAutofillSimplifiedIcon", {
  deserializer: (value) => value,
  clearOn: [],
});

@Component({
  selector: "app-simplified-autofill-info",
  templateUrl: "./simplified-autofill-info.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, PopoverModule, IconModule, ButtonModule, SvgModule, AsyncPipe],
})
export class SimplifiedAutofillInfoComponent {
  private configService = inject(ConfigService);
  private stateProvider = inject(StateProvider);
  private accountService = inject(AccountService);

  readonly pingElement = viewChild<ElementRef<HTMLSpanElement>>("pingElement");
  protected readonly InfoFilledIcon = InfoFilledIcon;

  private activeAccount$ = this.accountService.activeAccount$;

  private userId$ = this.activeAccount$.pipe(getUserId);

  private vaultAutofillSimplifiedIconState$ = this.userId$.pipe(
    switchMap((userId) =>
      this.stateProvider.getUserState$(VAULT_AUTOFILL_SIMPLIFIED_ICON_KEY, userId),
    ),
  );

  protected shouldShowPingAnimation$ = this.vaultAutofillSimplifiedIconState$.pipe(
    map((state) => !state?.hasSeen),
  );

  /** Emits true when the icon should be shown to the user */
  protected shouldShowIcon$ = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.PM31039ItemActionInExtension),
    this.vaultAutofillSimplifiedIconState$,
    this.activeAccount$,
  ]).pipe(
    map(([isFeatureEnabled, state, account]) => {
      if (!isFeatureEnabled || !account) {
        return false;
      }

      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const accountIsNew = account.creationDate > new Date(sevenDaysAgo);

      return !state?.hasDismissed && !accountIsNew;
    }),
  );

  constructor() {
    // Set up animation handler when ping element becomes available
    effect(() => {
      const pingElement = this.pingElement()?.nativeElement;
      if (!pingElement) {
        return;
      }

      const animation = pingElement
        .getAnimations()
        .find((a) => "animationName" in a && a.animationName === "tw-ping");
      if (animation) {
        animation.onfinish = () => {
          // Set the ping element to hidden after the animation finishes to avoid any alignment issues with the icon.
          pingElement.hidden = true;
          void this.updateUserState({ hasSeen: true });
        };
      }
    });
  }

  /** Update the user state when the popover closes */
  protected async onPopoverClose(): Promise<void> {
    await this.updateUserState({ hasDismissed: true, hasSeen: true });
  }

  /** Updates the user's state for the simplified autofill icon */
  private async updateUserState(
    newState: Partial<{ hasSeen: boolean; hasDismissed: boolean }>,
  ): Promise<void> {
    const userId = await firstValueFrom(this.userId$);

    const state = this.stateProvider.getUser(userId, VAULT_AUTOFILL_SIMPLIFIED_ICON_KEY);
    await state.update((oldState) => ({
      ...oldState,
      ...newState,
    }));
  }
}
