import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { FormControlModule, SwitchComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent } from "../base-policy-edit.component";

@Component({
  selector: "app-simple-toggle-policy-edit",
  template: `
    <bit-form-control>
      <bit-switch [formControl]="enabled"></bit-switch>
      <bit-label>{{ "enablePolicy" | i18n }}</bit-label>
    </bit-form-control>
  `,
  imports: [ReactiveFormsModule, FormControlModule, SwitchComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimpleTogglePolicyComponent extends BasePolicyEditComponent {}
