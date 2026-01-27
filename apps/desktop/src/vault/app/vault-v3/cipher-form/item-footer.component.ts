import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, IconButtonModule } from "@bitwarden/components";

import { ItemFooterComponent as BaseItemFooterComponent } from "../../vault/item-footer.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-item-footer",
  templateUrl: "item-footer.component.html",
  imports: [ButtonModule, IconButtonModule, CommonModule, JslibModule],
})
export class ItemFooterComponent extends BaseItemFooterComponent {
  async delete(): Promise<boolean> {
    this.onDelete.emit(this.cipher);
    return true;
  }

  async restore(): Promise<boolean> {
    this.onRestore.emit(this.cipher);
    return true;
  }
}
