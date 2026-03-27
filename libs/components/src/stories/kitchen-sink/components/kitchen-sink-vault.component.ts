import { Component, inject } from "@angular/core";

import { DialogService } from "../../../dialog";
import { ToastService } from "../../../toast";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

import { KitchenSinkFormComponent } from "./kitchen-sink-form.component";
import { KitchenSinkDialogComponent } from "./kitchen-sink-main.component";
import { KitchenSinkTableComponent } from "./kitchen-sink-table.component";
import { KitchenSinkToggleListComponent } from "./kitchen-sink-toggle-list.component";
import { KitchenSinkTourService } from "./kitchen-sink-tour.service";

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

      <button
        type="button"
        bitButton
        (click)="openDialog()"
        [bitPopoverAnchorFor]="tourStep2"
        [popoverOpen]="tourService.tourStep() === 2"
        [spotlight]="true"
        [spotlightPadding]="12"
        [position]="'below-start'"
      >
        Open Dialog
      </button>
      <button type="button" bitButton (click)="openDrawer()">Open Drawer</button>
      <button bitButton type="button" (click)="tourService.startTour()">Start Tour</button>
      <button type="button" bitButton (click)="showToast()">Show Toast</button>
    </bit-section>
    <bit-section>
      <h2 bitTypography="h2" class="tw-mb-6">Companies using Bitwarden</h2>
      <bit-kitchen-sink-toggle-list></bit-kitchen-sink-toggle-list>
    </bit-section>
    <bit-section
      [bitPopoverAnchorFor]="tourStep3"
      [popoverOpen]="tourService.tourStep() === 3"
      [spotlight]="true"
      [spotlightPadding]="12"
      [position]="'right-center'"
    >
      <h2 bitTypography="h2" class="tw-mb-6">Survey Form</h2>
      <bit-kitchen-sink-form></bit-kitchen-sink-form>
    </bit-section>

    <!-- Tour Popovers -->
    <bit-popover [title]="'Step 2: Dialogs'" (closed)="tourService.endTour()" #tourStep2>
      <div>Click buttons to <strong>open dialogs</strong> for important actions and forms.</div>
      <p class="tw-mt-2 tw-mb-0">
        Dialogs help focus user attention and collect input for critical operations.
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

    <bit-popover [title]="'Step 3: Forms'" (closed)="tourService.endTour()" #tourStep3>
      <div>Fill out <strong>forms</strong> to collect and manage user information.</div>
      <p class="tw-mt-2 tw-mb-0">
        Our form components provide consistent styling and validation patterns.
      </p>
      <div class="tw-flex tw-gap-2 tw-mt-4">
        <button type="button" bitButton buttonType="primary" (click)="tourService.endTour()">
          Finish Tour
        </button>
        <button type="button" bitButton buttonType="secondary" (click)="tourService.endTour()">
          Skip Tour
        </button>
      </div>
    </bit-popover>
  `,
})
export class KitchenSinkVaultComponent {
  constructor(
    public dialogService: DialogService,
    private toastService: ToastService,
  ) {}

  protected readonly tourService = inject(KitchenSinkTourService);

  openDialog() {
    this.dialogService.open(KitchenSinkDialogComponent);
  }

  openDrawer() {
    this.dialogService.openDrawer(KitchenSinkDialogComponent);
  }

  showToast() {
    this.toastService.showToast({ variant: "success", message: "Action completed successfully." });
  }
}
