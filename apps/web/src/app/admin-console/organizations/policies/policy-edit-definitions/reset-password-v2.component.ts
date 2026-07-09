import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { map } from "rxjs";

import {
  CalloutComponent,
  CheckboxModule,
  FormControlModule,
  LinkComponent,
  SwitchComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent } from "../base-policy-edit.component";

@Component({
  selector: "reset-password-policy-v2-edit",
  templateUrl: "reset-password-v2.component.html",
  imports: [
    AsyncPipe,
    CalloutComponent,
    CheckboxModule,
    FormControlModule,
    LinkComponent,
    ReactiveFormsModule,
    SwitchComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPolicyV2Component extends BasePolicyEditComponent {
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
