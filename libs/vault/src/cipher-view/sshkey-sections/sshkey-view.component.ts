// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import {
  CardComponent,
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";

@Component({
  selector: "app-sshkey-view",
  templateUrl: "sshkey-view.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    CardComponent,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
  ],
})
export class SshKeyViewComponent {
  @Input() sshKey: SshKeyView;
}
