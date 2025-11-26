import { PortalModule } from "@angular/cdk/portal";
import { ChangeDetectionStrategy, Component, inject, OnDestroy } from "@angular/core";
import { RouterModule } from "@angular/router";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { LayoutComponent, NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopHeaderService } from "./desktop-header.service";
import { DesktopSideNavComponent } from "./desktop-side-nav.component";

@Component({
  selector: "app-layout",
  imports: [
    RouterModule,
    I18nPipe,
    LayoutComponent,
    NavigationModule,
    DesktopSideNavComponent,
    PortalModule,
  ],
  templateUrl: "./desktop-layout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopLayoutComponent implements OnDestroy {
  protected readonly logo = PasswordManagerLogo;
  protected readonly desktopHeaderService = inject(DesktopHeaderService);
  protected readonly headerPortal = this.desktopHeaderService.portal;

  protected onPortalAttached() {
    this.desktopHeaderService.setAttached(true);
  }

  protected onPortalDetached() {
    this.desktopHeaderService.setAttached(false);
  }

  ngOnDestroy() {
    this.desktopHeaderService.setAttached(false);
  }
}
