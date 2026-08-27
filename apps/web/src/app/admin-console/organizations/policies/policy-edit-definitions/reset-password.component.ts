import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { map, of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  CalloutComponent,
  CheckboxModule,
  FormControlModule,
  LinkComponent,
  SwitchComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { Vfo1I18nPipe } from "@bitwarden/vault";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class ResetPasswordPolicy extends BasePolicyEditDefinition {
  name = "accountRecoveryPolicy";
  description = "accountRecoveryPolicyDescV2";
  descriptionVfo1 = "accountRecoveryPolicyDescVfo1";
  type = PolicyType.ResetPassword;
  category = PolicyCategory.Authentication;
  priority = 20;
  component = ResetPasswordPolicyComponent;
  showDescription = false;

  display$(organization: Organization, _configService: ConfigService) {
    return of(organization.useResetPassword);
  }
}

@Component({
  selector: "reset-password-policy-edit",
  templateUrl: "reset-password.component.html",
  imports: [
    AsyncPipe,
    CalloutComponent,
    CheckboxModule,
    FormControlModule,
    LinkComponent,
    ReactiveFormsModule,
    SwitchComponent,
    I18nPipe,
    Vfo1I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPolicyComponent extends BasePolicyEditComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly data = this.formBuilder.group({
    autoEnrollEnabled: [{ value: false, disabled: true }],
  });

  readonly showKeyConnectorInfo$ = this.organization$.pipe(
    map((org) => org?.keyConnectorEnabled ?? false),
  );

  constructor() {
    super();

    this.enabled.valueChanges.pipe(takeUntilDestroyed()).subscribe((enabled) => {
      if (enabled) {
        this.data.controls.autoEnrollEnabled.enable();
      } else {
        this.data.controls.autoEnrollEnabled.disable();
        this.data.controls.autoEnrollEnabled.setValue(false);
      }
    });
  }
}
