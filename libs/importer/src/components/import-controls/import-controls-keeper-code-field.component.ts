import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { ControlContainer, ReactiveFormsModule } from "@angular/forms";

import { InputVerbatimDirective } from "@bitwarden/angular/directives/input-verbatim.directive";
import { FormFieldModule, LinkModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** The verification code field, with Resend in its hint when the prompt allows it. The `keeperCode`
 *  control belongs to the login card's form; this only draws it. */
@Component({
  selector: "importer-controls-keeper-code-field",
  templateUrl: "./import-controls-keeper-code-field.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldModule, I18nPipe, InputVerbatimDirective, LinkModule, ReactiveFormsModule],
  // Registers the field with the card's form exactly as if it were written inline there.
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
  host: { class: "tw-contents" },
})
export class ImportControlsKeeperCodeFieldComponent {
  readonly canResend = input.required<boolean>();
  readonly resend = output<void>();
}
