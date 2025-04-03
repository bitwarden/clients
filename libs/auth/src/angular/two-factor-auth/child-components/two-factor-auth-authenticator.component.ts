import { CommonModule } from "@angular/common";
import { Component, Input, Output, EventEmitter } from "@angular/core";
import { ReactiveFormsModule, FormsModule, FormControl } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DialogModule,
  ButtonModule,
  LinkModule,
  TypographyModule,
  FormFieldModule,
  AsyncActionsModule,
} from "@bitwarden/components";

@Component({
  standalone: true,
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
