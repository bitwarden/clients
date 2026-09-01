import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  viewChild,
} from "@angular/core";

import {
  BannerModule,
  IconModule,
  LinkModule,
  ResizeObserverDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

const HEIGHT_PROPERTY = "--private-access-banner-height";

/** Marks the deployment as a private access environment on every route. */
@Component({
  selector: "app-private-access-banner",
  templateUrl: "private-access-banner.component.html",
  imports: [BannerModule, IconModule, LinkModule, I18nPipe, ResizeObserverDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateAccessBannerComponent implements AfterViewInit, OnDestroy {
  // TODO(PM-42874): point at the private preview user guide once it exists.
  protected readonly helpUrl = "https://bitwarden.com/help/private-preview-user-guide";

  private readonly container = viewChild.required<ElementRef<HTMLElement>>("container");

  ngAfterViewInit() {
    this.publishHeight();
  }

  ngOnDestroy() {
    document.documentElement.style.removeProperty(HEIGHT_PROPERTY);
  }

  protected publishHeight() {
    const height = `${this.container().nativeElement.getBoundingClientRect().height}px`;
    const root = document.documentElement;

    if (root.style.getPropertyValue(HEIGHT_PROPERTY) !== height) {
      root.style.setProperty(HEIGHT_PROPERTY, height);
    }
  }
}
