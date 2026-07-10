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
          [bitPopoverAnchorFor]="tourStep4"
          [popoverOpen]="tourService.tourStep() === 4"
          [spotlight]="true"
          [position]="'right-center'"
        ></bit-nav-item>
        <bit-nav-group text="Examples" icon="bwi-cog" [open]="true">
          <bit-nav-item text="Virtual Scroll" route="virtual-scroll" icon="bwi-list"></bit-nav-item>
        </bit-nav-group>
      </bit-side-nav>
      <router-outlet></router-outlet>
    </bit-layout>

    <!-- Tour Popovers -->
    <bit-popover [title]="'Step 4: Side Nav'" (closed)="tourService.endTour()" #tourStep4>
      <div>The <strong>Home</strong> page will take you back to where you started.</div>
      <p class="tw-mt-2 tw-mb-0">It's a very cool and helpful page.</p>
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
export class KitchenSinkAppComponent {
  readonly tourService = inject(KitchenSinkTourService);

  protected readonly logo = PasswordManagerLogo;
}
