import { A11yModule, CdkTrapFocus } from "@angular/cdk/a11y";
import { PortalModule } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter, map } from "rxjs";

import { DrawerHostDirective } from "../drawer/drawer-host.directive";
import { DrawerService } from "../drawer/drawer.service";
import { LinkModule } from "../link";
import { SideNavService } from "../navigation/side-nav.service";
import { SharedModule } from "../shared";

import { ScrollLayoutHostDirective } from "./scroll-layout.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-layout",
  templateUrl: "layout.component.html",
  imports: [
    CommonModule,
    SharedModule,
    LinkModule,
    RouterModule,
    PortalModule,
    A11yModule,
    CdkTrapFocus,
    ScrollLayoutHostDirective,
  ],
  host: {
    "(document:keydown.tab)": "handleKeydown($event)",
  },
  hostDirectives: [DrawerHostDirective],
})
export class LayoutComponent {
  protected sideNavService = inject(SideNavService);
  protected drawerPortal = inject(DrawerService).portal;

  private readonly mainContent = viewChild.required<ElementRef<HTMLElement>>("main");
  protected focusMainContent() {
    this.mainContent().nativeElement.focus();
  }

  protected router: Router = inject(Router);

  constructor() {
    this.router.events
      .pipe(
        takeUntilDestroyed(),
        filter((navEvent) => navEvent instanceof NavigationEnd),
        map((navEvent) => {
          const currentNavData = this.router.getCurrentNavigation()?.extras;

          const info = currentNavData?.info as { focusElAfterNav?: string } | undefined;

          return {
            navEvent,
            currentNavInfo: info,
          };
        }),
        filter((navEventAndData) => {
          const info = navEventAndData.currentNavInfo;

          return !!info?.focusElAfterNav;
        }),
      )
      .subscribe((eventShouldFocusElAfterNav) => {
        const focusElAfterNav = eventShouldFocusElAfterNav.currentNavInfo?.focusElAfterNav;

        if (!focusElAfterNav) {
          return;
        }

        const focusEl = document.querySelector<HTMLElement>(focusElAfterNav);

        if (focusEl) {
          focusEl.focus();
        }
      });
  }

  /**
   * Angular CDK's focus trap utility is silly and will not respect focus order.
   * This is a workaround to explicitly focus the skip link when tab is first pressed, if no other item already has focus.
   *
   * @see https://github.com/angular/components/issues/10247#issuecomment-384060265
   **/
  private readonly skipLink = viewChild.required<ElementRef<HTMLElement>>("skipLink");
  handleKeydown(ev: KeyboardEvent) {
    if (isNothingFocused()) {
      ev.preventDefault();
      this.skipLink().nativeElement.focus();
    }
  }
}

const isNothingFocused = (): boolean => {
  return [document.documentElement, document.body, null].includes(
    document.activeElement as HTMLElement,
  );
};
