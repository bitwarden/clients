import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { ColorPasswordComponent } from "@bitwarden/components";
import { BitTotpCountdownComponent, CreditCardNumberPipe } from "@bitwarden/vault";

import { SharedModule } from "../../../shared";

import { SendAccessItemFieldComponent } from "./send-access-item-field.component";

type TotpCodeValues = {
  totpCode: string;
  totpCodeFormatted?: string;
};

@Component({
  selector: "app-send-access-item",
  templateUrl: "send-access-item.component.html",
  imports: [
    SharedModule,
    ColorPasswordComponent,
    BitTotpCountdownComponent,
    SendAccessItemFieldComponent,
    CreditCardNumberPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendAccessItemComponent {
  readonly FieldType = FieldType;

  readonly send = input.required<SendAccessView>();
  readonly cipher = computed(() => this.send().data.data);
  readonly passwordRevealed = signal(false);

  // Turning this into a signal introduces a small but noticeable delay in between the
  // TOTP countdown expiring and the code updating. For now, simply set the object
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  totpCodeCopyObj: TotpCodeValues | undefined;

  protected readonly CipherType = CipherType;

  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected subtitle(cipher: CipherView): string | undefined {
    return CipherViewLikeUtils.subtitle(cipher, this.i18nService);
  }

  async pwToggleValue(passwordVisible: boolean) {
    this.passwordRevealed.set(passwordVisible);
  }

  setTotpCopyCode(e: TotpCodeValues) {
    this.totpCodeCopyObj = e;
  }

  async openWebsite(selectedUri: string) {
    this.platformUtilsService.launchUri(selectedUri);
  }
}
