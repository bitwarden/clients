import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { CalloutComponent, CheckboxModule, FormFieldModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent } from "../base-policy-edit.component";

@Component({
  selector: "app-simple-toggle-policy-edit",
  template: `
    @if (policy()?.warningKey) {
      <bit-callout type="warning">{{ policy()!.warningKey! | i18n }}</bit-callout>
    }
    <bit-form-control>
      <input type="checkbox" bitCheckbox [formControl]="enabled" id="enabled" />
      <bit-label>{{ "turnOn" | i18n }}</bit-label>
    </bit-form-control>
  `,
  imports: [ReactiveFormsModule, CalloutComponent, CheckboxModule, FormFieldModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimpleTogglePolicyComponent extends BasePolicyEditComponent {}
