import { CdkTrapFocus } from "@angular/cdk/a11y";
import { DragDropModule, CdkDragMove } from "@angular/cdk/drag-drop";
import { AsyncPipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
  inject,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { NavDividerComponent } from "./nav-divider.component";
import { SideNavService } from "./side-nav.service";

export type SideNavVariant = "primary" | "secondary";

/**
 * Side navigation component that provides a collapsible navigation menu.
 */
@Component({
  selector: "bit-side-nav",
  templateUrl: "side-nav.component.html",
  imports: [
    CdkTrapFocus,
    NavDividerComponent,
    BitIconButtonComponent,
    I18nPipe,
    DragDropModule,
    AsyncPipe,
  ],
  host: {
    // Grid placement: always col 1.  In overlay mode the element is also
    // switched to position:fixed so it escapes the grid's stacking context
    // and renders above the scrim (z-40) and the drawer.
    class: "tw-block tw-h-full tw-col-start-1 tw-row-start-1",
    "[class]":
      "sideNavService.isOverlay() ? 'tw-fixed tw-top-0 tw-bottom-0 tw-left-0 tw-z-50' : ''",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideNavComponent {
  protected readonly sideNavService = inject(SideNavService);

  /**
   * Visual variant of the side navigation
   *
   * @default "primary"
   */
  readonly variant = input<SideNavVariant>("primary");

  private readonly toggleButton = viewChild("toggleButton", { read: ElementRef });

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.sideNavService.open.set(false);
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
