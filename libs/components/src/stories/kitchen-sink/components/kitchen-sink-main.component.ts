import { DialogRef } from "@angular/cdk/dialog";
import { Component, inject } from "@angular/core";

import { DialogService } from "../../../dialog";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

import { KitchenSinkTourService } from "./kitchen-sink-tour.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
export class KitchenSinkDialogComponent {
  constructor(public dialogRef: DialogRef) {}
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <bit-dialog title="Dialog Title" dialogSize="small">
      <ng-container bitDialogContent>
        <bit-form-field>
          <bit-label>Username</bit-label>
          <input bitInput [appAutofocus]="true" />
        </bit-form-field>
      </ng-container>
      <ng-container bitDialogFooter>
        <button type="button" bitButton buttonType="primary" (click)="dialogRef.close()">
          Save
        </button>
        <button type="button" bitButton buttonType="secondary" bitDialogClose>Cancel</button>
      </ng-container>
    </bit-dialog>
  `,
  imports: [KitchenSinkSharedModule],
})
export class KitchenSinkDialogWithAutofocusComponent {
  constructor(public dialogRef: DialogRef) {}
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-tab-main",
  imports: [KitchenSinkSharedModule],
  template: `
    <bit-header title="Kitchen Sink" icon="bwi-collection">
      <bit-breadcrumbs slot="breadcrumbs">
        @for (item of navItems; track item) {
          <bit-breadcrumb [icon]="item.icon" [route]="[item.route]">
            {{ item.name }}
          </bit-breadcrumb>
        }
      </bit-breadcrumbs>
      <bit-search
        [bitPopoverAnchorFor]="tourStep1"
        [popoverOpen]="tourService.tourStep() === 1"
        [spotlight]="true"
        [spotlightPadding]="12"
        [position]="'below-center'"
      />
      <button
        bitLink
        [bitPopoverTriggerFor]="myPopover"
        #triggerRef="popoverTrigger"
        type="button"
        aria-label="Popover trigger link"
        slot="secondary"
      >
        <bit-icon name="bwi-question-circle" />
      </button>
      <bit-avatar text="BW"></bit-avatar>
      <bit-tab-nav-bar slot="tabs">
        <bit-tab-link [route]="['bitwarden']">Vault</bit-tab-link>
        <bit-tab-link [route]="['empty']">Empty</bit-tab-link>
      </bit-tab-nav-bar>
    </bit-header>

    <router-outlet></router-outlet>

    <bit-popover title="Educational Popover" #myPopover>
      <div>You can learn more things at:</div>
      <ul class="tw-mt-2 tw-mb-0 tw-ps-4">
        <li>Help center</li>
        <li>Support</li>
      </ul>
    </bit-popover>

    <!-- Tour Popovers -->
    <bit-popover [title]="'Step 1: Search'" (closed)="tourService.endTour()" #tourStep1>
      <div>Use the <strong>search bar</strong> to quickly find any item in your vault.</div>
      <p class="tw-mt-2 tw-mb-0">
        Search works across all fields including usernames, URLs, and notes.
      </p>
      <div class="tw-flex tw-gap-2 tw-mt-4">
        <button type="button" bitButton buttonType="primary" (click)="tourService.nextStep()">
          Next
        </button>
        <button type="button" bitButton buttonType="secondary" (click)="tourService.endTour()">
          Skip Tour
        </button>
      </div>
    </bit-popover>
  `,
})
export class KitchenSinkMainComponent {
  constructor(public dialogService: DialogService) {}

  protected readonly tourService = inject(KitchenSinkTourService);

  openDialog() {
    this.dialogService.open(KitchenSinkDialogComponent);
  }

  openDrawer() {
    this.dialogService.openDrawer(KitchenSinkDialogComponent);
  }

  navItems = [
    { icon: "bwi-collection-shared", name: "Password Managers", route: "/" },
    { icon: "bwi-collection-shared", name: "Favorites", route: "/" },
  ];
}
