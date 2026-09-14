import { DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { DialogService } from "../../../dialog";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

import { KitchenSinkTourService } from "./kitchen-sink-tour.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  protected readonly dialogRef = inject(DialogRef);
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  protected readonly dialogRef = inject(DialogRef);
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "bit-tab-main",
  imports: [KitchenSinkSharedModule],
  template: `
    <bit-page>
      @if (bannerVisible()) {
        <div>
          <bit-banner (dismiss)="hideBanner()">
            Bitwarden is the most trusted password manager.
            <a bitLink [linkType]="variant">Click me</a>
          </bit-banner>
        </div>
      }
      <bit-header title="Kitchen Sink" icon="bwi-collection">
        <bit-breadcrumbs slot="breadcrumbs">
          @for (item of navItems; track item) {
            <bit-breadcrumb [icon]="item.icon" [route]="[item.route]">
              {{ item.name }}
            </bit-breadcrumb>
          }
        </bit-breadcrumbs>
        @if (vfo1Enabled()) {
          <button
            bitLink
            [bitPopoverTriggerFor]="myPopover"
            #triggerRef="popoverTrigger"
            type="button"
            aria-label="Popover trigger link"
          >
            <bit-icon name="bwi-question-circle" />
          </button>
        } @else {
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
        }
        <bit-search
          [bitPopoverAnchorFor]="tourStep1"
          [popoverOpen]="tourService.tourStep() === 1"
          [spotlight]="true"
          [position]="'below-center'"
        />
        <bit-avatar text="BW"></bit-avatar>
        <bit-tab-nav-bar slot="tabs">
          <bit-tab-link [route]="['bitwarden']">Vault</bit-tab-link>
          <bit-tab-link [route]="['empty']">Empty</bit-tab-link>
        </bit-tab-nav-bar>
      </bit-header>

      <router-outlet></router-outlet>
    </bit-page>

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
  protected readonly dialogService = inject(DialogService);
  protected readonly tourService = inject(KitchenSinkTourService);
  protected readonly configService = inject(ConfigService);

  protected readonly bannerVisible = signal(true);

  hideBanner() {
    this.bannerVisible.set(false);
  }

  openDialog() {
    this.dialogService.open(KitchenSinkDialogComponent);
  }

  openDrawer() {
    void this.dialogService.openDrawer(KitchenSinkDialogComponent);
  }

  protected readonly navItems = [
    { icon: "bwi-collection-shared", name: "Password Managers", route: "/" },
    { icon: "bwi-collection-shared", name: "Favorites", route: "/" },
  ];

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );
}
