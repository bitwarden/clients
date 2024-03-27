import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";

import { DialogService } from "../../../dialog";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

import { KitchenSinkForm } from "./kitchen-sink-form.component";
import { KitchenSinkTable } from "./kitchen-sink-table.component";
import { KitchenSinkToggleList } from "./kitchen-sink-toggle-list.component";

@Component({
  standalone: true,
  imports: [KitchenSinkSharedModule],
  template: `
    <bit-dialog title="Dialog Title" dialogSize="large">
      <span bitDialogContent> Dialog body text goes here. </span>
      <ng-container bitDialogFooter>
        <button bitButton buttonType="primary" (click)="dialogRef.close()">OK</button>
        <button bitButton buttonType="secondary" bitDialogClose>Cancel</button>
      </ng-container>
    </bit-dialog>
  `,
})
class KitchenSinkDialog {
  constructor(public dialogRef: DialogRef) {}
}

@Component({
  standalone: true,
  selector: "bit-tab-main",
  imports: [
    KitchenSinkSharedModule,
    KitchenSinkTable,
    KitchenSinkToggleList,
    KitchenSinkForm,
    KitchenSinkDialog,
  ],
  template: `
    <bit-banner bannerType="info" class="-tw-m-6 tw-flex tw-flex-col tw-pb-6">
      Kitchen Sink test zone
    </bit-banner>

    <p class="tw-mt-4">
      <bit-breadcrumbs>
        <bit-breadcrumb *ngFor="let item of navItems" [icon]="item.icon" [route]="[item.route]">
          {{ item.name }}
        </bit-breadcrumb>
      </bit-breadcrumbs>
    </p>

    <bit-callout type="info" title="About the Kitchen Sink">
      <p bitTypography="body1">
        The purpose of this story is to compose together all of our components. When snapshot tests
        run, we'll be able to spot-check visual changes in a more app-like environment than just the
        isolated stories. The stories for the Kitchen Sink exist to be tested by the Chromatic UI
        tests.
      </p>

      <p bitTypography="body1">
        NOTE: These stories will treat "Light & Dark" mode as "Light" mode. This is done to avoid a
        bug with the way that we render the same component twice in the same iframe and how that
        interacts with the <code>router-outlet</code>.
      </p>
    </bit-callout>

    <div class="tw-mb-6 tw-mt-6">
      <h1 bitTypography="h1" class="tw-text-main">
        Bitwarden <bit-avatar text="Bit Warden"></bit-avatar>
      </h1>
      <a bitLink linkType="primary" href="#">Learn more</a>
    </div>

    <bit-tab-group label="Main content tabs" class="tw-text-main">
      <bit-tab label="Evaluation">
        <bit-section>
          <h2 bitTypography="h2" class="tw-text-main tw-mb-6">About</h2>
          <bit-kitchen-sink-table></bit-kitchen-sink-table>

          <button bitButton (click)="openDefaultDialog()">Open Dialog</button>
        </bit-section>
        <bit-section>
          <h2 bitTypography="h2" class="tw-text-main tw-mb-6">Companies using Bitwarden</h2>
          <bit-kitchen-sink-toggle-list></bit-kitchen-sink-toggle-list>
        </bit-section>
        <bit-section>
          <h2 bitTypography="h2" class="tw-text-main tw-mb-6">Survey</h2>
          <bit-kitchen-sink-form></bit-kitchen-sink-form>
        </bit-section>
      </bit-tab>

      <bit-tab label="Empty tab" data-testid="empty-tab">
        <bit-section>
          <bit-no-items class="tw-text-main">
            <ng-container slot="title">This tab is empty</ng-container>
            <ng-container slot="description">
              <p bitTypography="body2">Try searching for what you are looking for:</p>
              <bit-search></bit-search>
              <p bitTypography="helper">Note that the search bar is not functional</p>
            </ng-container>
          </bit-no-items>
        </bit-section>
      </bit-tab>
    </bit-tab-group>
  `,
})
export class KitchenSinkMainComponent {
  constructor(public dialogService: DialogService) {}

  openDefaultDialog() {
    this.dialogService.open(KitchenSinkDialog);
  }

  navItems = [
    { icon: "bwi-collection", name: "Password Managers", route: "/" },
    { icon: "bwi-collection", name: "Favorites", route: "/" },
  ];
}
