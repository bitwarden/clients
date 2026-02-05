import { DialogRef } from "@angular/cdk/dialog";
import { Component, signal, WritableSignal } from "@angular/core";

import { DialogService } from "../../../dialog";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

import { KitchenSinkFormComponent } from "./kitchen-sink-form.component";
import { KitchenSinkTableComponent } from "./kitchen-sink-table.component";
import { KitchenSinkToggleListComponent } from "./kitchen-sink-toggle-list.component";

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
class KitchenSinkDialogComponent {
  constructor(public dialogRef: DialogRef) {}
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-tab-main",
  imports: [
    KitchenSinkSharedModule,
    KitchenSinkTableComponent,
    KitchenSinkToggleListComponent,
    KitchenSinkFormComponent,
  ],
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
        [bitPopoverAnchor]="tourStep1"
        [popoverOpen]="tourStep() === 1"
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
        <bit-tab-link [route]="['virtual-scroll']">Virtual Scroll</bit-tab-link>
      </bit-tab-nav-bar>
    </bit-header>

    <bit-section>
      <h2 bitTypography="h2" class="tw-mb-6">Table Example</h2>
      <bit-kitchen-sink-table></bit-kitchen-sink-table>

      <button
        type="button"
        bitButton
        (click)="openDialog()"
        [bitPopoverAnchor]="tourStep2"
        [popoverOpen]="tourStep() === 2"
        [spotlight]="true"
        [spotlightPadding]="12"
        [position]="'below-start'"
      >
        Open Dialog
      </button>
      <button type="button" bitButton (click)="openDrawer()">Open Drawer</button>
      <button bitButton type="button" (click)="startTour()">Start Tour</button>
    </bit-section>
    <bit-section>
      <h2 bitTypography="h2" class="tw-mb-6">Companies using Bitwarden</h2>
      <bit-kitchen-sink-toggle-list></bit-kitchen-sink-toggle-list>
    </bit-section>
    <bit-section
      [bitPopoverAnchor]="tourStep3"
      [popoverOpen]="tourStep() === 3"
      [spotlight]="true"
      [spotlightPadding]="12"
      [position]="'right-center'"
    >
      <h2 bitTypography="h2" class="tw-mb-6">Survey Form</h2>
      <bit-kitchen-sink-form></bit-kitchen-sink-form>
    </bit-section>

    <bit-popover title="Educational Popover" #myPopover>
      <div>You can learn more things at:</div>
      <ul class="tw-mt-2 tw-mb-0 tw-ps-4">
        <li>Help center</li>
        <li>Support</li>
      </ul>
    </bit-popover>

    <!-- Tour Popovers -->
    <bit-popover [title]="'Step 1: Search'" (closed)="skipTour()" #tourStep1>
      <div>Use the <strong>search bar</strong> to quickly find any item in your vault.</div>
      <p class="tw-mt-2 tw-mb-0">
        Search works across all fields including usernames, URLs, and notes.
      </p>
      <div class="tw-flex tw-gap-2 tw-mt-4">
        <button type="button" bitButton buttonType="primary" (click)="nextTourStep()">Next</button>
        <button type="button" bitButton buttonType="secondary" (click)="skipTour()">
          Skip Tour
        </button>
      </div>
    </bit-popover>

    <bit-popover [title]="'Step 2: Dialogs'" (closed)="skipTour()" #tourStep2>
      <div>Click buttons to <strong>open dialogs</strong> for important actions and forms.</div>
      <p class="tw-mt-2 tw-mb-0">
        Dialogs help focus user attention and collect input for critical operations.
      </p>
      <div class="tw-flex tw-gap-2 tw-mt-4">
        <button type="button" bitButton buttonType="primary" (click)="nextTourStep()">Next</button>
        <button type="button" bitButton buttonType="secondary" (click)="skipTour()">
          Skip Tour
        </button>
      </div>
    </bit-popover>

    <bit-popover [title]="'Step 3: Forms'" (closed)="skipTour()" #tourStep3>
      <div>Fill out <strong>forms</strong> to collect and manage user information.</div>
      <p class="tw-mt-2 tw-mb-0">
        Our form components provide consistent styling and validation patterns.
      </p>
      <div class="tw-flex tw-gap-2 tw-mt-4">
        <button type="button" bitButton buttonType="primary" (click)="nextTourStep()">
          Finish Tour
        </button>
        <button type="button" bitButton buttonType="secondary" (click)="skipTour()">
          Skip Tour
        </button>
      </div>
    </bit-popover>
  `,
})
export class KitchenSinkMainComponent {
  constructor(public dialogService: DialogService) {}

  protected readonly drawerOpen = signal(false);

  // Tour state
  protected readonly tourStep: WritableSignal<0 | 1 | 2 | 3> = signal(0);

  openDialog() {
    this.dialogService.open(KitchenSinkDialogComponent);
  }

  openDrawer() {
    this.dialogService.openDrawer(KitchenSinkDialogComponent);
  }

  protected startTour() {
    this.tourStep.set(1);
  }

  protected nextTourStep() {
    this.tourStep.update((prev) => (prev < 3 ? ((prev + 1) as 3) : 0));
  }

  protected skipTour() {
    this.tourStep.set(0);
  }

  navItems = [
    { icon: "bwi-collection-shared", name: "Password Managers", route: "/" },
    { icon: "bwi-collection-shared", name: "Favorites", route: "/" },
  ];
}
