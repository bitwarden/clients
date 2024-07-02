import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  SearchModule,
  ButtonModule,
  CardComponent,
  SectionComponent,
  SectionHeaderComponent,
} from "@bitwarden/components";

@Component({
  selector: "app-item-history-v2",
  templateUrl: "item-history-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    RouterModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
  ],
})
export class ItemHistoryV2Component {
  @Input() cipher: CipherView;

  constructor() {}
}
