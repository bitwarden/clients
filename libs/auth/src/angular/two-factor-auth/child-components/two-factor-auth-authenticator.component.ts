import { CommonModule } from "@angular/common";
import { Component, Input, Output, EventEmitter } from "@angular/core";
import { ReactiveFormsModule, FormsModule, FormControl } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  DialogModule,
  ButtonModule,
  LinkModule,
  TypographyModule,
  FormFieldModule,
  AsyncActionsModule,
} from "@bitwarden/components";

@Component({
  selector: "app-two-factor-auth-authenticator",
  templateUrl: "two-factor-auth-authenticator.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    LinkModule,
    TypographyModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    FormsModule,
  ],
  providers: [],
})
export class TwoFactorAuthAuthenticatorComponent {
  @Input({ required: true }) tokenFormControl: FormControl | undefined = undefined;
  @Output() tokenChange = new EventEmitter<{ token: string }>();

  onTokenChange(event: Event) {
    const tokenValue = (event.target as HTMLInputElement).value || "";
    this.tokenChange.emit({ token: tokenValue });
  }
}
