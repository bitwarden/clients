import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";

import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

import { KitchenSinkTourService } from "./kitchen-sink-tour.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "bit-kitchen-sink-app",
  imports: [KitchenSinkSharedModule],
  template: `
    <bit-layout>
      <bit-side-nav>
        <bit-nav-logo [openIcon]="logo" route="." [label]="'Kitchen Sink'"></bit-nav-logo>
        <bit-nav-item
          text="Home"
          route="bitwarden"
          icon="bwi-vault"
          [bitPopoverAnchorFor]="tourStep2"
          [popoverOpen]="tourService.tourStep() === 2"
          [spotlight]="true"
          [spotlightPadding]="4"
          [position]="'right-center'"
        ></bit-nav-item>
        <bit-nav-group text="Examples" icon="bwi-cog" [open]="true">
          <bit-nav-item text="Virtual Scroll" route="virtual-scroll" icon="bwi-list"></bit-nav-item>
        </bit-nav-group>
      </bit-side-nav>
      <router-outlet></router-outlet>
    </bit-layout>

    <bit-popover [title]="'Step 2: Navigation'" (closed)="tourService.endTour()" #tourStep2>
      <div>Use the <strong>side navigation</strong> to move between sections of the app.</div>
      <p class="tw-mt-2 tw-mb-0">Nav items group related pages and surface the current location.</p>
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
export class KitchenSinkAppComponent {
  protected readonly logo = PasswordManagerLogo;
  protected readonly tourService = inject(KitchenSinkTourService);
}
