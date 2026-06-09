import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { FormFieldModule, SwitchComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent } from "../base-policy-edit.component";

@Component({
  selector: "app-simple-toggle-policy-edit",
  template: `
    <bit-switch [formControl]="enabled" [reversed]="true">
      <bit-label>{{ "enablePolicy" | i18n }}</bit-label>
    </bit-switch>
  `,
  imports: [ReactiveFormsModule, FormFieldModule, SwitchComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimpleTogglePolicyComponent extends BasePolicyEditComponent {}
