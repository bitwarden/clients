import { inject, Injectable } from "@angular/core";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength/password-strength.service.abstraction";

@Injectable({ providedIn: "root" })
export class PasswordStrengthBridgeService {
  private readonly strengthService = inject(PasswordStrengthServiceAbstraction);

  score(password: string | undefined | null): number {
    if (!password) {
      return 0;
    }
    const result = this.strengthService.getPasswordStrength(password);
    return result.score;
  }
}
