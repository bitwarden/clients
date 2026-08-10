import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { BehaviorSubject, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CheckboxModule,
  FormControlModule,
  FormFieldModule,
  SelectModule,
  SwitchComponent,
  TypographyModule,
} from "@bitwarden/components";
import { BuiltIn, Profile } from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent } from "../base-policy-edit.component";

const PASSWORD_POLICY_VALUE = "password";
const PASSPHRASE_POLICY_VALUE = "passphrase";

@Component({
  selector: "password-generator-policy-v2-edit",
  templateUrl: "password-generator-v2.component.html",
  imports: [
    AsyncPipe,
    CheckboxModule,
    FormControlModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    SwitchComponent,
    TypographyModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordGeneratorPolicyV2Component extends BasePolicyEditComponent {
  protected readonly minLengthMin =
    BuiltIn.password.profiles[Profile.account]!.constraints.default.length!.min!;
  protected readonly minLengthMax =
    BuiltIn.password.profiles[Profile.account]!.constraints.default.length!.max!;
  protected readonly minNumbersMin =
    BuiltIn.password.profiles[Profile.account]!.constraints.default.minNumber!.min!;
  protected readonly minNumbersMax =
    BuiltIn.password.profiles[Profile.account]!.constraints.default.minNumber!.max!;
  protected readonly minSpecialMin =
    BuiltIn.password.profiles[Profile.account]!.constraints.default.minSpecial!.min!;
  protected readonly minSpecialMax =
    BuiltIn.password.profiles[Profile.account]!.constraints.default.minSpecial!.max!;
  protected readonly minNumberWordsMin =
    BuiltIn.passphrase.profiles[Profile.account]!.constraints.default.numWords!.min!;
  protected readonly minNumberWordsMax =
    BuiltIn.passphrase.profiles[Profile.account]!.constraints.default.numWords!.max!;

  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);

  readonly data = this.formBuilder.group({
    overridePasswordType: [null as string | null],
    minLength: [
      null as number | null,
      [Validators.min(this.minLengthMin), Validators.max(this.minLengthMax)],
    ],
    useUpper: [null as boolean | null],
    useLower: [null as boolean | null],
    useNumbers: [null as boolean | null],
    useSpecial: [null as boolean | null],
    minNumbers: [
      null as number | null,
      [Validators.min(this.minNumbersMin), Validators.max(this.minNumbersMax)],
    ],
    minSpecial: [
      null as number | null,
      [Validators.min(this.minSpecialMin), Validators.max(this.minSpecialMax)],
    ],
    minNumberWords: [
      null as number | null,
      [Validators.min(this.minNumberWordsMin), Validators.max(this.minNumberWordsMax)],
    ],
    capitalize: [null as boolean | null],
    includeNumber: [null as boolean | null],
  });

  readonly overridePasswordTypeOptions: { name: string; value: string | null }[] = [
    { name: this.i18nService.t("userPreference"), value: null },
    { name: this.i18nService.t("password"), value: PASSWORD_POLICY_VALUE },
    { name: this.i18nService.t("passphrase"), value: PASSPHRASE_POLICY_VALUE },
  ];

  private readonly showPasswordPolicies = new BehaviorSubject<boolean>(true);
  private readonly showPassphrasePolicies = new BehaviorSubject<boolean>(true);

  readonly showPasswordPolicies$ = this.showPasswordPolicies.asObservable();
  readonly showPassphrasePolicies$ = this.showPassphrasePolicies.asObservable();

  constructor() {
    super();
    this.data.valueChanges
      .pipe(isEnabled(PASSWORD_POLICY_VALUE), takeUntilDestroyed())
      .subscribe(this.showPasswordPolicies);
    this.data.valueChanges
      .pipe(isEnabled(PASSPHRASE_POLICY_VALUE), takeUntilDestroyed())
      .subscribe(this.showPassphrasePolicies);
  }
}

function isEnabled(enabledValue: string) {
  return map((d: { overridePasswordType?: string | null }) => {
    const type = d?.overridePasswordType ?? enabledValue;
    return type === enabledValue;
  });
}
