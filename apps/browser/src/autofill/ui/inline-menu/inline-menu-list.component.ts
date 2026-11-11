import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ColorPasswordModule,
  IconButtonModule,
  IconComponent,
  ItemModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { InlineMenuCipherData } from "../../background/abstractions/overlay.background";

import { InlineMenuActionComponent } from "./inline-menu-action.component";
import { InlineMenuCipherItemComponent } from "./inline-menu-cipher-item.component";
import { InlineMenuListState, InlineMenuNewItemKind } from "./inline-menu.types";

const newItemKeys: Record<InlineMenuNewItemKind, { text: string; ariaLabel: string }> = {
  login: { text: "newLogin", ariaLabel: "addNewLoginItemAria" },
  card: { text: "newCard", ariaLabel: "addNewCardItemAria" },
  identity: { text: "newIdentity", ariaLabel: "addNewIdentityItemAria" },
  item: { text: "newItem", ariaLabel: "addNewVaultItem" },
};

/**
 * The inline menu list page. Renders whichever view `state` describes.
 */
@Component({
  selector: "autofill-inline-menu-list",
  imports: [
    ColorPasswordModule,
    I18nPipe,
    IconButtonModule,
    IconComponent,
    InlineMenuActionComponent,
    InlineMenuCipherItemComponent,
    ItemModule,
  ],
  templateUrl: "inline-menu-list.component.html",
  host: {
    class:
      "tw-bit-compact tw-block tw-w-full tw-overflow-hidden tw-rounded-lg tw-bg-bg-primary tw-text-fg-body",
    "[attr.data-testid]": "testId()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineMenuListComponent {
  private readonly i18nService = inject(I18nService);

  readonly state = input.required<InlineMenuListState>();

  readonly unlock = output<void>();
  readonly addNewItem = output<void>();
  readonly saveLogin = output<void>();
  readonly fillCipher = output<InlineMenuCipherData>();
  readonly viewCipher = output<InlineMenuCipherData>();
  /** A TOTP period rolled over; fresh codes are needed. */
  readonly totpPeriodElapsed = output<void>();
  readonly fillPassword = output<void>();
  readonly regeneratePassword = output<void>();

  protected readonly testId = computed(() => {
    switch (this.state().view) {
      case "locked":
        return "inline-menu-locked-state";
      case "noResults":
        return "inline-menu-empty-state";
      case "saveLogin":
        return "inline-menu-save-login";
      case "authenticating":
        return "inline-menu-passkey-authenticating";
      case "ciphers":
        return "inline-menu-cipher-list";
      case "passwordGenerator":
        return "inline-menu-password-generator";
    }
  });

  protected readonly cipherState = computed(() => {
    const state = this.state();
    return state.view === "ciphers" ? state : undefined;
  });

  protected readonly generatorState = computed(() => {
    const state = this.state();
    return state.view === "passwordGenerator" ? state : undefined;
  });

  protected readonly newItem = computed(() => {
    const state = this.state();
    const kind =
      state.view === "noResults" || state.view === "ciphers" ? state.newItemKind : undefined;
    if (!kind) {
      return undefined;
    }
    const keys = newItemKeys[kind];
    return { text: this.i18nService.t(keys.text), ariaLabel: this.i18nService.t(keys.ariaLabel) };
  });

  protected readonly saveLoginAriaLabel = computed(
    () => `${this.i18nService.t("saveToBitwarden")}, ${this.i18nService.t("opensInANewWindow")}`,
  );

  protected readonly generatorHeading = computed(
    () => this.generatorState()?.heading ?? this.i18nService.t("fillGeneratedPassword"),
  );

  protected viewLabel(cipher: InlineMenuCipherData) {
    return `${this.i18nService.t("view")} ${cipher.name}, ${this.i18nService.t("opensInANewWindow")}`;
  }
}
