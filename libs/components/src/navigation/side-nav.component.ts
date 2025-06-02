import { CdkTrapFocus } from "@angular/cdk/a11y";
import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, OnInit, OnDestroy, input, viewChild } from "@angular/core";
import { Subject } from "rxjs";
import { takeUntil, distinctUntilChanged } from "rxjs/operators";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { NavDividerComponent } from "./nav-divider.component";
import { SideNavService } from "./side-nav.service";

export type SideNavVariant = "primary" | "secondary";

@Component({
  selector: "bit-side-nav",
  templateUrl: "side-nav.component.html",
  imports: [CommonModule, CdkTrapFocus, NavDividerComponent, BitIconButtonComponent, I18nPipe],
})
export class SideNavComponent implements OnInit, OnDestroy {
  readonly variant = input<SideNavVariant>("primary");

  private readonly toggleButton = viewChild("toggleButton", { read: ElementRef });

  private destroy$ = new Subject<void>();

  constructor(
    protected sideNavService: SideNavService,
    private breakpointObserver: BreakpointObserver,
  ) {}

  ngOnInit() {
    // Monitor breakpoint changes and close nav when switching to small viewport
    this.breakpointObserver
      .observe([Breakpoints.Small, Breakpoints.XSmall])
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((result) => {
        if (result.matches) {
          this.sideNavService.setClose();
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.sideNavService.setClose();
      this.toggleButton()?.nativeElement.focus();
      return false;
    }

    return true;
  };
}
