import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  AfterViewInit,
  Component,
  inject,
  OnDestroy,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-reports-layout",
  templateUrl: "reports-layout.component.html",
  standalone: false,
})
export class ReportsLayoutComponent implements AfterViewInit, OnDestroy {
  private readonly backButtonTemplate =
    viewChild.required<TemplateRef<unknown>>("backButtonTemplate");

  private overlayRef: OverlayRef | null = null;
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private router = inject(Router);

  constructor() {
    this.router.events
      .pipe(
        takeUntilDestroyed(),
        filter((event) => event instanceof NavigationEnd),
      )
      .subscribe(() => this.updateOverlay());
  }

  ngAfterViewInit(): void {
    this.updateOverlay();
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
  }

  private updateOverlay(): void {
    if (this.router.url === "/reports") {
      this.overlayRef?.dispose();
      this.overlayRef = null;
    } else if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        positionStrategy: this.overlay.position().global().bottom("20px").right("32px"),
      });
      this.overlayRef.attach(new TemplatePortal(this.backButtonTemplate(), this.viewContainerRef));
    }
  }
}
