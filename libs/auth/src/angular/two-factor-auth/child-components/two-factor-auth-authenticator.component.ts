import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { ReactiveFormsModule, FormsModule, FormControl } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
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
  @Input() tokenFormControl: FormControl | undefined = undefined;
}
