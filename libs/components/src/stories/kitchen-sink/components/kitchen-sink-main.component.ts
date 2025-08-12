import { DialogRef } from "@angular/cdk/dialog";
import { Component, signal } from "@angular/core";

import { DialogService } from "../../../dialog";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

import { KitchenSinkForm } from "./kitchen-sink-form.component";
import { KitchenSinkTable } from "./kitchen-sink-table.component";
import { KitchenSinkToggleList } from "./kitchen-sink-toggle-list.component";

@Component({
  imports: [KitchenSinkSharedModule],
  template: `
    <bit-dialog title="Dialog Title" dialogSize="small">
      <ng-container bitDialogContent>
        <p bitTypography="body1">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
          sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum.
        </p>
        <bit-form-field>
          <bit-label>What did foo say to bar?</bit-label>
          <input bitInput value="Baz" />
        </bit-form-field>
        <p bitTypography="body1">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
          sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum.
        </p>
        <p bitTypography="body1">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
          sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum.
        </p>
        <p bitTypography="body1">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
          sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum.
        </p>
        <p bitTypography="body1">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
          sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum.
        </p>
        <p bitTypography="body1">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
          sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum.
        </p>
        <p bitTypography="body1">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
          sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum.
        </p>
      </ng-container>
      <ng-container bitDialogFooter>
        <button type="button" bitButton buttonType="primary" (click)="dialogRef.close()">OK</button>
        <button type="button" bitButton buttonType="secondary" bitDialogClose>Cancel</button>
      </ng-container>
    </bit-dialog>
  `,
})
class KitchenSinkDialog {
  constructor(public dialogRef: DialogRef) {}
}

@Component({
  selector: "bit-tab-main",
  imports: [KitchenSinkSharedModule, KitchenSinkTable, KitchenSinkToggleList, KitchenSinkForm],
  template: `
    <bit-banner bannerType="info" class="-tw-m-6 tw-flex tw-flex-col tw-pb-6">
      Kitchen Sink test zone
    </bit-banner>

    <p class="tw-mt-4">
      <bit-breadcrumbs>
        @for (item of navItems; track item) {
          <bit-breadcrumb [icon]="item.icon" [route]="[item.route]">
            {{ item.name }}
          </bit-breadcrumb>
        }
      </bit-breadcrumbs>
    </p>

    <div class="tw-my-6">
      <h1 bitTypography="h1">Bitwarden Kitchen Sink<bit-avatar text="Bit Warden"></bit-avatar></h1>
      <a bitLink linkType="primary" href="#">This is a link</a>
      <p bitTypography="body1" class="tw-inline">
        &nbsp;and this is a link button popover trigger:&nbsp;
      </p>
      <button
        bitLink
        linkType="primary"
        [bitPopoverTriggerFor]="myPopover"
        #triggerRef="popoverTrigger"
        type="button"
        slot="end"
        aria-label="Popover trigger link"
      >
        <i class="bwi bwi-question-circle"></i>
      </button>
    </div>

    <bit-callout type="info" title="About the Kitchen Sink">
      <p bitTypography="body1">
        The purpose of this story is to compose together all of our components. When snapshot tests
        run, we'll be able to spot-check visual changes in a more app-like environment than just the
        isolated stories. The stories for the Kitchen Sink exist to be tested by the Chromatic UI
        tests.
      </p>
    </bit-callout>

    <bit-tab-group label="Main content tabs" class="tw-text-main">
      <bit-tab label="Evaluation">
        <bit-section>
          <h2 bitTypography="h2" class="tw-mb-6">About</h2>
          <bit-kitchen-sink-table></bit-kitchen-sink-table>

          <button type="button" bitButton (click)="openDialog()">Open Dialog</button>
          <button type="button" bitButton (click)="openDrawer()">Open Drawer</button>
        </bit-section>
        <bit-section>
          <h2 bitTypography="h2" class="tw-mb-6">Companies using Bitwarden</h2>
          <bit-kitchen-sink-toggle-list></bit-kitchen-sink-toggle-list>
        </bit-section>
        <bit-section>
          <h2 bitTypography="h2" class="tw-mb-6">Survey</h2>
          <bit-kitchen-sink-form></bit-kitchen-sink-form>
        </bit-section>
      </bit-tab>

      <bit-tab label="Empty tab" data-testid="empty-tab">
        <bit-section>
          <h2 bitTypography="h2" class="tw-mb-6">Tab Number 2</h2>
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

    <bit-popover [title]="'Educational Popover'" #myPopover>
      <div>You can learn more things at:</div>
      <ul class="tw-mt-2 tw-mb-0 tw-ps-4">
        <li>Help center</li>
        <li>Support</li>
      </ul>
    </bit-popover>
  `,
})
export class KitchenSinkMainComponent {
  constructor(public dialogService: DialogService) {}

  protected drawerOpen = signal(false);

  openDialog() {
    this.dialogService.open(KitchenSinkDialog);
  }

  openDrawer() {
    this.dialogService.openDrawer(KitchenSinkDialog);
  }

  navItems = [
    { icon: "bwi-collection-shared", name: "Password Managers", route: "/" },
    { icon: "bwi-collection-shared", name: "Favorites", route: "/" },
  ];
}
