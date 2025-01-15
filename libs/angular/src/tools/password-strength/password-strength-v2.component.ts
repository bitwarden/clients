// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, Output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { ProgressModule } from "@bitwarden/components";

export interface PasswordColorText {
  color: BackgroundTypes;
  text: string;
}
export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

type SizeTypes = "small" | "default" | "large";
type BackgroundTypes = "danger" | "primary" | "success" | "warning";

@Component({
  selector: "tools-password-strength",
  templateUrl: "password-strength-v2.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, ProgressModule],
})
export class PasswordStrengthV2Component implements OnChanges {
  /**
   * The size (height) of the password strength component.
   * Possible values are "default", "small" and "large".
   */
  @Input() size: SizeTypes = "default";
  /**
   * Determines whether to show the password strength score text on the progress bar or not.
   */
  @Input() showText = false;
  /**
   * Optional email address which can be used as input for the password strength calculation
   */
  @Input() email: string;
  /**
   * Optional name which can be used as input for the password strength calculation
   */
  @Input() name: string;
  /**
   * Sets the password value and updates the password strength.
   *
   * @param value - password provided by the hosting component
   */
  @Input() set password(value: string) {
    this.updatePasswordStrength(value);
  }
  /**
   * Emits the password strength score.
   *
   * @remarks
   * The password strength score represents the strength of a password.
   * It is emitted as an event when the password strength changes.
   */
  @Output() passwordStrengthScore = new EventEmitter<PasswordStrengthScore>();

  /**
   * Emits an event with the password score text and color.
   */
  @Output() passwordScoreTextWithColor = new EventEmitter<PasswordColorText>();

  passwordScore: PasswordStrengthScore;
  scoreWidth = 0;
  color: BackgroundTypes = "danger";
  text: string;

  private passwordStrengthTimeout: number | NodeJS.Timeout;

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

      this.passwordScoreTextWithColor.emit({
        color: this.color,
        text: this.text,
      } as PasswordColorText);
    }, 300);
  }

  updatePasswordStrength(password: string) {
    if (this.passwordStrengthTimeout != null) {
      clearTimeout(this.passwordStrengthTimeout);
    }

    const strengthResult = this.passwordStrengthService.getPasswordStrength(
      password,
      this.email,
      this.name?.trim().toLowerCase().split(" "),
    );
    this.passwordScore = strengthResult == null ? null : strengthResult.score;
    this.passwordStrengthScore.emit(this.passwordScore);
  }
}
