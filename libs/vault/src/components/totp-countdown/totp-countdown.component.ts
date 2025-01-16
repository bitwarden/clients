// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { TypographyModule } from "@bitwarden/components";

@Component({
  selector: "[bitTotpCountdown]",
  templateUrl: "totp-countdown.component.html",
  standalone: true,
  imports: [CommonModule, TypographyModule],
})
export class BitTotpCountdownComponent implements OnInit {
  @Input() cipher: CipherView;
  @Output() sendCopyCode = new EventEmitter();

  totpCode: string;
  totpCodeFormatted: string;
  totpDash: number;
  totpSec: number;
  totpLow: boolean;
  private totpInterval: any;

  constructor(protected totpService: TotpService) {}

  async ngOnInit() {
    await this.totpUpdateCode();
    const interval = this.totpService.getTimeInterval(this.cipher.login.totp);
    await this.totpTick(interval);

    this.totpInterval = setInterval(async () => {
      await this.totpTick(interval);
    }, 1000);
  }

  private async totpUpdateCode() {
    if (this.cipher.login.totp == null) {
      this.clearTotp();
      return;
    }

    this.totpCode = await this.totpService.getCode(this.cipher.login.totp);
    if (this.totpCode != null) {
      if (this.totpCode.length > 4) {
        this.totpCodeFormatted = this.formatTotpCode();
        this.sendCopyCode.emit({
          totpCode: this.totpCode,
          totpCodeFormatted: this.totpCodeFormatted,
        });
      } else {
        this.totpCodeFormatted = this.totpCode;
      }
    } else {
      this.totpCodeFormatted = null;
      this.sendCopyCode.emit({ totpCode: null, totpCodeFormatted: null });
      this.clearTotp();
    }
  }

  private async totpTick(intervalSeconds: number) {
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const mod = epoch % intervalSeconds;

    this.totpSec = intervalSeconds - mod;
    this.totpDash = +(Math.round(((60 / intervalSeconds) * mod + "e+2") as any) + "e-2");
    this.totpLow = this.totpSec <= 7;
    if (mod === 0) {
      await this.totpUpdateCode();
    }
  }

  private formatTotpCode(): string {
    const half = Math.floor(this.totpCode.length / 2);
    return this.totpCode.substring(0, half) + " " + this.totpCode.substring(half);
  }

  private clearTotp() {
    if (this.totpInterval) {
      clearInterval(this.totpInterval);
    }
  }
}
