import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

/**
 * Cipher Health analysis results
 *
 * Contains password health metrics computed by CipherHealthService.
 *
 */
export class CipherHealthView implements View {
  cipherId: string = "";
  hasWeakPassword: boolean = false;
  hasReusedPassword: boolean = false;
  hasExposedPassword: boolean = false;
  exposedCount: number = 0;
  weakPasswordScore?: number;

  constructor(init?: {
    cipherId: string;
    hasWeakPassword: boolean;
    hasReusedPassword: boolean;
    hasExposedPassword: boolean;
    exposedCount: number;
    weakPasswordScore?: number;
  }) {
    if (init == null) {
      return;
    }

    this.cipherId = init.cipherId;
    this.hasWeakPassword = init.hasWeakPassword;
    this.hasReusedPassword = init.hasReusedPassword;
    this.hasExposedPassword = init.hasExposedPassword;
    this.exposedCount = init.exposedCount;
    this.weakPasswordScore = init.weakPasswordScore;
  }

  toJSON() {
    return {
      cipherId: this.cipherId,
      hasWeakPassword: this.hasWeakPassword,
      hasReusedPassword: this.hasReusedPassword,
      hasExposedPassword: this.hasExposedPassword,
      exposedCount: this.exposedCount,
      weakPasswordScore: this.weakPasswordScore,
    };
  }

  static fromJSON(obj: Partial<Jsonify<CipherHealthView>> | undefined): CipherHealthView {
    if (obj == null) {
      return new CipherHealthView();
    }

    const view = new CipherHealthView();
    view.cipherId = obj.cipherId ?? "";
    view.hasWeakPassword = obj.hasWeakPassword ?? false;
    view.hasReusedPassword = obj.hasReusedPassword ?? false;
    view.hasExposedPassword = obj.hasExposedPassword ?? false;
    view.exposedCount = obj.exposedCount ?? 0;
    view.weakPasswordScore = obj.weakPasswordScore;

    return view;
  }

  /**
   * Determines if the cipher is "at risk" based on any health issue
   */
  isAtRisk(): boolean {
    return this.hasWeakPassword || this.hasReusedPassword || this.hasExposedPassword;
  }

  /**
   * Gets a human-readable description of the password strength
   * Based on zxcvbn score (0-4)
   */
  getPasswordStrengthLabel(): string {
    if (this.weakPasswordScore == null) {
      return "unknown";
    }

    switch (this.weakPasswordScore) {
      case 4:
        return "strong";
      case 3:
        return "good";
      case 2:
        return "weak";
      default:
        return "veryWeak";
    }
  }

  /**
   * Gets a severity level for UI badge styling
   */
  getPasswordStrengthBadgeVariant(): "success" | "primary" | "warning" | "danger" {
    if (this.weakPasswordScore == null) {
      return "warning";
    }

    switch (this.weakPasswordScore) {
      case 4:
        return "success";
      case 3:
        return "primary";
      case 2:
        return "warning";
      default:
        return "danger";
    }
  }
}
