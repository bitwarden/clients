import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, Output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { ProgressModule } from "@bitwarden/components";

export interface PasswordColorText {
  color: string;
  text: string;
}
type SizeTypes = "small" | "default" | "large";
type BackgroundTypes = "danger" | "primary" | "success" | "warning";

@Component({
  selector: "tools-password-strength",
  templateUrl: "password-strength-v2.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, ProgressModule],
})
export class PasswordStrengthV2Component implements OnChanges {
  @Input() size: SizeTypes = "default";
  @Input() showText = false;
  @Input() email: string;
  @Input() name: string;
  @Input() set password(value: string) {
    this.updatePasswordStrength(value);
  }
  @Output() passwordStrengthResult = new EventEmitter<any>();
  @Output() passwordScoreColor = new EventEmitter<PasswordColorText>();

  passwordScore: number;
  scoreWidth = 0;
  color: BackgroundTypes = "danger";
  text: string;

  private passwordStrengthTimeout: any;

  constructor(
    private i18nService: I18nService,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
  ) {}

  ngOnChanges(): void {
    this.passwordStrengthTimeout = setTimeout(() => {
      this.scoreWidth = this.passwordScore == null ? 0 : (this.passwordScore + 1) * 20;

      switch (this.passwordScore) {
        case 4:
          this.color = "success";
          this.text = this.i18nService.t("strong");
          break;
        case 3:
          this.color = "primary";
          this.text = this.i18nService.t("good");
          break;
        case 2:
          this.color = "warning";
          this.text = this.i18nService.t("weak");
          break;
        default:
          this.color = "danger";
          this.text = this.passwordScore != null ? this.i18nService.t("weak") : null;
          break;
      }

      this.setPasswordScoreText(this.color, this.text);
    }, 300);
  }

  updatePasswordStrength(password: string) {
    const masterPassword = password;

    if (this.passwordStrengthTimeout != null) {
      clearTimeout(this.passwordStrengthTimeout);
    }

    const strengthResult = this.passwordStrengthService.getPasswordStrength(
      masterPassword,
      this.email,
      this.name?.trim().toLowerCase().split(" "),
    );
    this.passwordStrengthResult.emit(strengthResult);
    this.passwordScore = strengthResult == null ? null : strengthResult.score;
  }

  setPasswordScoreText(color: string, text: string) {
    color = color.slice(3);
    this.passwordScoreColor.emit({ color: color, text: text });
  }
}
