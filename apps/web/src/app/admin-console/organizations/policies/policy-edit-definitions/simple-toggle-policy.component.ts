import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { CalloutComponent, FormFieldModule, SwitchComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent } from "../base-policy-edit.component";

@Component({
  selector: "app-simple-toggle-policy-edit",
  template: `
    @if (policy()?.warningKey) {
      <bit-callout type="warning">{{ policy()!.warningKey! | i18n }}</bit-callout>
    }
    <bit-switch [formControl]="enabled">
      <bit-label>{{ "turnOn" | i18n }}</bit-label>
    </bit-switch>
  `,
  imports: [ReactiveFormsModule, CalloutComponent, FormFieldModule, SwitchComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimpleTogglePolicyComponent extends BasePolicyEditComponent {}
