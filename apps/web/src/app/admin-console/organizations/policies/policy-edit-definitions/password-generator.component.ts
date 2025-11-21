// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { BehaviorSubject, map } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BuiltIn, Profile } from "@bitwarden/generator-core";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class PasswordGeneratorPolicy extends BasePolicyEditDefinition {
  name = "passwordGenerator";
  description = "passwordGeneratorPolicyDesc";
  type = PolicyType.PasswordGenerator;
  component = PasswordGeneratorPolicyComponent;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "password-generator-policy-edit",
  templateUrl: "password-generator.component.html",
  imports: [SharedModule],
})
export class PasswordGeneratorPolicyComponent extends BasePolicyEditComponent {
  // these properties forward the application default settings to the UI
  // for HTML attribute bindings
  protected readonly minLengthMin =
    BuiltIn.password.profiles[Profile.account].constraints.default.length.min;
  protected readonly minLengthMax =
    BuiltIn.password.profiles[Profile.account].constraints.default.length.max;
  protected readonly minNumbersMin =
    BuiltIn.password.profiles[Profile.account].constraints.default.minNumber.min;
  protected readonly minNumbersMax =
    BuiltIn.password.profiles[Profile.account].constraints.default.minNumber.max;
  protected readonly minSpecialMin =
    BuiltIn.password.profiles[Profile.account].constraints.default.minSpecial.min;
  protected readonly minSpecialMax =
    BuiltIn.password.profiles[Profile.account].constraints.default.minSpecial.max;
  protected readonly minNumberWordsMin =
    BuiltIn.passphrase.profiles[Profile.account].constraints.default.numWords.min;
  protected readonly minNumberWordsMax =
    BuiltIn.passphrase.profiles[Profile.account].constraints.default.numWords.max;

  data = this.formBuilder.group({
    overridePasswordType: [null],
    minLength: [null, [Validators.min(this.minLengthMin), Validators.max(this.minLengthMax)]],
    useUpper: [null],
    useLower: [null],
    useNumbers: [null],
    useSpecial: [null],
    minNumbers: [null, [Validators.min(this.minNumbersMin), Validators.max(this.minNumbersMax)]],
    minSpecial: [null, [Validators.min(this.minSpecialMin), Validators.max(this.minSpecialMax)]],
    minNumberWords: [
      null,
      [Validators.min(this.minNumberWordsMin), Validators.max(this.minNumberWordsMax)],
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
