import { CommonModule } from "@angular/common";
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { Observable, map, tap } from "rxjs";

import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { TotpInfo } from "@bitwarden/common/vault/services/totp.service";
import { TypographyModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "[bitTotpCountdown]",
  templateUrl: "totp-countdown.component.html",
  imports: [CommonModule, TypographyModule],
})
export class BitTotpCountdownComponent implements OnInit, OnChanges {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) cipher!: CipherView;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() sendCopyCode = new EventEmitter();

  /**
   * Represents TOTP information including display formatting and timing
   */
  totpInfo$: Observable<TotpInfo> | undefined;

  constructor(protected totpService: TotpService) {}

  async ngOnInit() {
    this.setTotpInfo();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["cipher"]) {
      this.setTotpInfo();
    }
  }

  private setTotpInfo(): void {
    this.totpInfo$ = this.cipher?.login?.totp
      ? this.totpService.getCode$(this.cipher.login.totp).pipe(
          map((response) => {
            const epoch = Math.round(new Date().getTime() / 1000.0);
            const mod = epoch % response.period;

            return {
              totpCode: response.code,
              totpCodeFormatted: this.formatTotpCode(response.code),
              totpSec: response.period - mod,
              totpDash: +(Math.round(((60 / response.period) * mod + "e+2") as any) + "e-2"),
              totpLow: response.period - mod <= 7,
            } as TotpInfo;
          }),
          tap((totpInfo) => {
            if (totpInfo.totpCode && totpInfo.totpCode.length > 4) {
              this.sendCopyCode.emit({
                totpCode: totpInfo.totpCode,
                totpCodeFormatted: totpInfo.totpCodeFormatted,
              });
            }
          }),
        )
      : undefined;
  }

  private formatTotpCode(code: string): string {
    if (code.length > 4) {
      const half = Math.floor(code.length / 2);
      return code.substring(0, half) + " " + code.substring(half);
    }
    return code;
  }
}
