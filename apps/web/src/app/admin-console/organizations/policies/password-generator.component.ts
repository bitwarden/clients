import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { BehaviorSubject, map } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DefaultPassphraseBoundaries, DefaultPasswordBoundaries } from "@bitwarden/generator-core";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class PasswordGeneratorPolicy extends BasePolicy {
  name = "passwordGenerator";
  description = "passwordGeneratorPolicyDesc";
  type = PolicyType.PasswordGenerator;
  component = PasswordGeneratorPolicyComponent;
}

@Component({
  selector: "policy-password-generator",
  templateUrl: "password-generator.component.html",
})
export class PasswordGeneratorPolicyComponent extends BasePolicyComponent {
  data = this.formBuilder.group({
    overridePasswordType: [null],
    minLength: [
      null,
      [
        Validators.min(DefaultPasswordBoundaries.length.min),
        Validators.max(DefaultPasswordBoundaries.length.max),
      ],
    ],
    useUpper: [null],
    useLower: [null],
    useNumbers: [null],
    useSpecial: [null],
    minNumbers: [
      null,
      [
        Validators.min(DefaultPasswordBoundaries.minDigits.min),
        Validators.max(DefaultPasswordBoundaries.minDigits.max),
      ],
    ],
    minSpecial: [
      null,
      [
        Validators.min(DefaultPasswordBoundaries.minSpecialCharacters.min),
        Validators.max(DefaultPasswordBoundaries.minSpecialCharacters.max),
      ],
    ],
    minNumberWords: [
      null,
      [
        Validators.min(DefaultPassphraseBoundaries.numWords.min),
        Validators.max(DefaultPassphraseBoundaries.numWords.max),
      ],
    ],
    capitalize: [null],
    includeNumber: [null],
  });

  overridePasswordTypeOptions: { name: string; value: string }[];

  // These subjects cache visibility of the sub-options for passwords
  // and passphrases; without them policy controls don't show up at all.
  private showPasswordPolicies = new BehaviorSubject<boolean>(true);
  private showPassphrasePolicies = new BehaviorSubject<boolean>(true);

  /** Emits `true` when the password policy options should be displayed */
  get showPasswordPolicies$() {
    return this.showPasswordPolicies.asObservable();
  }

  /** Emits `true` when the passphrase policy options should be displayed */
  get showPassphrasePolicies$() {
    return this.showPassphrasePolicies.asObservable();
  }

  constructor(
    private formBuilder: UntypedFormBuilder,
    i18nService: I18nService,
  ) {
    super();

    this.overridePasswordTypeOptions = [
      { name: i18nService.t("userPreference"), value: null },
      { name: i18nService.t("password"), value: PASSWORD_POLICY_VALUE },
      { name: i18nService.t("passphrase"), value: "passphrase" },
    ];

    this.data.valueChanges
      .pipe(isEnabled(PASSWORD_POLICY_VALUE), takeUntilDestroyed())
      .subscribe(this.showPasswordPolicies);
    this.data.valueChanges
      .pipe(isEnabled(PASSPHRASE_POLICY_VALUE), takeUntilDestroyed())
      .subscribe(this.showPassphrasePolicies);
  }
}

const PASSWORD_POLICY_VALUE = "password";
const PASSPHRASE_POLICY_VALUE = "passphrase";

function isEnabled(enabledValue: string) {
  return map((d: { overridePasswordType: string }) => {
    const type = d?.overridePasswordType ?? enabledValue;
    return type === enabledValue;
  });
}
