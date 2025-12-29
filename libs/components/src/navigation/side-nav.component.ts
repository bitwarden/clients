import { CdkTrapFocus } from "@angular/cdk/a11y";
import { DragDropModule, CdkDragMove } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { NavDividerComponent } from "./nav-divider.component";
import { SideNavService } from "./side-nav.service";

export type SideNavVariant = "primary" | "secondary";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-side-nav",
  templateUrl: "side-nav.component.html",
  imports: [
    CommonModule,
    CdkTrapFocus,
    NavDividerComponent,
    BitIconButtonComponent,
    I18nPipe,
    DragDropModule,
  ],
  host: {
    class: "tw-block tw-h-full",
  },
})
export class SideNavComponent {
  protected sideNavService = inject(SideNavService);

  readonly variant = input<SideNavVariant>("primary");

  private readonly toggleButton = viewChild("toggleButton", { read: ElementRef });

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.sideNavService.setClose();
      this.toggleButton()?.nativeElement.focus();
      return false;
    }

    return true;
  };

  protected onDragMoved(event: CdkDragMove) {
    const rectX = this.elementRef.nativeElement.getBoundingClientRect().x;
    const eventXPointer = event.pointerPosition.x;

    this.sideNavService.setWidthFromDrag(eventXPointer, rectX);

    // Fix for CDK applying a transform that can cause visual drifting
    const element = event.source.element.nativeElement;
    element.style.transform = "none";
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      this.sideNavService.setWidthFromKeys(event.key);
    }
  }
}
