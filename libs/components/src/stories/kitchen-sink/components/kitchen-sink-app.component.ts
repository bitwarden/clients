import { Component } from "@angular/core";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";

import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-kitchen-sink-app",
  imports: [KitchenSinkSharedModule],
  template: `
    <bit-layout>
      <bit-side-nav>
        <bit-nav-logo [openIcon]="logo" route="." [label]="'Kitchen Sink'"></bit-nav-logo>
        <bit-nav-item text="Home" route="bitwarden" icon="bwi-vault"></bit-nav-item>
        <bit-nav-group text="Examples" icon="bwi-cog" [open]="true">
          <bit-nav-item text="Virtual Scroll" route="virtual-scroll" icon="bwi-list"></bit-nav-item>
        </bit-nav-group>
      </bit-side-nav>
      <router-outlet></router-outlet>
    </bit-layout>
    <bit-toast-container></bit-toast-container>
  `,
})
export class KitchenSinkAppComponent {
  protected readonly logo = PasswordManagerLogo;
}
