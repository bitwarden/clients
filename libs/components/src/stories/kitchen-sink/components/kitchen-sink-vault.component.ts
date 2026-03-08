import { Component } from "@angular/core";

import { DialogService } from "../../../dialog";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

import { KitchenSinkFormComponent } from "./kitchen-sink-form.component";
import { KitchenSinkDialogComponent } from "./kitchen-sink-main.component";
import { KitchenSinkTableComponent } from "./kitchen-sink-table.component";
import { KitchenSinkToggleListComponent } from "./kitchen-sink-toggle-list.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-kitchen-sink-vault",
  imports: [
    KitchenSinkSharedModule,
    KitchenSinkTableComponent,
    KitchenSinkToggleListComponent,
    KitchenSinkFormComponent,
  ],
  template: `
    <bit-section>
      <h2 bitTypography="h2" class="tw-mb-6">Table Example</h2>
      <bit-kitchen-sink-table></bit-kitchen-sink-table>

      <button type="button" bitButton (click)="openDialog()">Open Dialog</button>
      <button type="button" bitButton (click)="openDrawer()">Open Drawer</button>
    </bit-section>
    <bit-section>
      <h2 bitTypography="h2" class="tw-mb-6">Companies using Bitwarden</h2>
      <bit-kitchen-sink-toggle-list></bit-kitchen-sink-toggle-list>
    </bit-section>
    <bit-section>
      <h2 bitTypography="h2" class="tw-mb-6">Survey Form</h2>
      <bit-kitchen-sink-form></bit-kitchen-sink-form>
    </bit-section>
  `,
})
export class KitchenSinkVaultComponent {
  constructor(public dialogService: DialogService) {}

  openDialog() {
    this.dialogService.open(KitchenSinkDialogComponent);
  }

  openDrawer() {
    this.dialogService.openDrawer(KitchenSinkDialogComponent);
  }
}
