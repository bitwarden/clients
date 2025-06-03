import { A11yModule, CdkTrapFocus } from "@angular/cdk/a11y";
import { PortalModule } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, viewChild } from "@angular/core";
import { RouterModule } from "@angular/router";

import { DrawerService } from "../drawer/drawer.service";
import { LinkModule } from "../link";
import { SideNavService } from "../navigation/side-nav.service";
import { SharedModule } from "../shared";

import { ScrollLayoutHostDirective } from "./scroll-layout.directive";

@Component({
  selector: "bit-layout",
  templateUrl: "layout.component.html",
  standalone: true,
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
    "(document:keydown)": "handleInitialTabPress($event)",
  },
})
export class LayoutComponent {
  protected sideNavService = inject(SideNavService);
  protected drawerPortal = inject(DrawerService).portal;

  private mainContent = viewChild.required<ElementRef<HTMLElement>>("main");
  protected focusMainContent() {
    this.mainContent().nativeElement.focus();
  }

  /**
   * Angular CDK's focus trap utility is silly and will not focus respect focus order.
   * This is a workaround to explicitly focus the skip link when tab is first pressed, if no other item already has focus.
   *
   * @see https://github.com/angular/components/issues/10247#issuecomment-384060265
   **/
  private skipLink = viewChild.required<ElementRef<HTMLElement>>("skipLink");
  private didInitialFocus = false;
  handleInitialTabPress(ev: KeyboardEvent) {
    if (this.didInitialFocus) {
      return;
    }

    if (isNothingFocused()) {
      ev.preventDefault();
      this.skipLink().nativeElement.focus();
    }
    this.didInitialFocus = true;
  }
}

const isNothingFocused = (): boolean => {
  return [document.documentElement, document.body, null].includes(
    document.activeElement as HTMLElement,
  );
};
