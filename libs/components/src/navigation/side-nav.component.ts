import { CdkTrapFocus } from "@angular/cdk/a11y";
import { DragDropModule, CdkDragMove } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, input, OnDestroy, signal, viewChild } from "@angular/core";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { NavDividerComponent } from "./nav-divider.component";
import { SideNavService } from "./side-nav.service";

export type SideNavVariant = "primary" | "secondary";

const DEFAULT_OPEN_WIDTH = 275;
const DEFAULT_CLOSED_WIDTH = 64;
const MIN_OPEN_WIDTH = 240;
const MAX_OPEN_WIDTH = 384;

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
})
export class SideNavComponent implements OnDestroy {
  readonly variant = input<SideNavVariant>("primary");

  private readonly toggleButton = viewChild("toggleButton", { read: ElementRef });

  protected lastOpenWidth = DEFAULT_OPEN_WIDTH;
  protected currentWidth = signal(DEFAULT_OPEN_WIDTH);
  private readonly destroy$ = new Subject<void>();

  constructor(protected sideNavService: SideNavService) {
    sideNavService.open$.pipe(takeUntil(this.destroy$)).subscribe((isOpen) => {
      if (isOpen) {
        this.currentWidth.set(this.lastOpenWidth);
      } else {
        this.lastOpenWidth = this.currentWidth();
        this.currentWidth.set(DEFAULT_CLOSED_WIDTH);
      }
    });
  }

  ngOnDestroy(): void {
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

  protected onDragMoved(event: CdkDragMove) {
    this.currentWidth.set(
      Math.min(Math.max(event.pointerPosition.x, MIN_OPEN_WIDTH), MAX_OPEN_WIDTH),
    );
    const element = event.source.element.nativeElement;
    element.style.transform = "none";
  }
}
