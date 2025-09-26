import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  A11yTitleDirective,
  AnchorLinkDirective,
  ButtonComponent,
  CalloutModule,
  DialogModule,
  DialogRef,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  imports: [
    DialogModule,
    I18nPipe,
    CalloutModule,
    ButtonComponent,
    A11yTitleDirective,
    AnchorLinkDirective,
    JslibModule,
    TypographyModule,
  ],
  templateUrl: "./session-timeout-confirmation-never.component.html",
})
export class SessionTimeoutConfirmationNeverComponent {
  constructor(public dialogRef: DialogRef) {}
}
