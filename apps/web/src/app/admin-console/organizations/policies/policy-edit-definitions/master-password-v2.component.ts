import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { map } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  CalloutComponent,
  CheckboxModule,
  FormControlModule,
  FormFieldModule,
  SelectModule,
  SwitchComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent } from "../base-policy-edit.component";

@Component({
  selector: "master-password-policy-v2-edit",
  templateUrl: "master-password-v2.component.html",
  imports: [
    AsyncPipe,
    CalloutComponent,
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
export class MasterPasswordPolicyV2Component extends BasePolicyEditComponent {
  readonly MinPasswordLength = Utils.minimumPasswordLength;
  readonly MaxPasswordLength = Utils.maximumPasswordLength;

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly i18nService = inject(I18nService);

  readonly data: FormGroup<ControlsOf<MasterPasswordPolicyOptions>> = this.formBuilder.group({
    minComplexity: [0],
    minLength: [
      this.MinPasswordLength,
      [Validators.min(Utils.minimumPasswordLength), Validators.max(this.MaxPasswordLength)],
    ],
    requireUpper: [false],
    requireLower: [false],
    requireNumbers: [false],
    requireSpecial: [false],
    enforceOnLogin: [false],
  });

  readonly showKeyConnectorInfo$ = this.organization$.pipe(
    map((org) => org?.keyConnectorEnabled ?? false),
  );

  readonly passwordScores: { name: string; value: number | null }[] = [
    { name: "-- " + this.i18nService.t("select") + " --", value: null },
    { name: this.i18nService.t("weak") + " (0)", value: 0 },
    { name: this.i18nService.t("weak") + " (1)", value: 1 },
    { name: this.i18nService.t("weak") + " (2)", value: 2 },
    { name: this.i18nService.t("good") + " (3)", value: 3 },
    { name: this.i18nService.t("strong") + " (4)", value: 4 },
  ];
}
