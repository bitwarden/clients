import { CdkTrapFocus } from "@angular/cdk/a11y";
import { DragDropModule, CdkDragMove } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, input, OnDestroy, viewChild } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { map, takeUntil } from "rxjs/operators";

import { BIT_SIDE_NAV_DISK, GlobalStateProvider, KeyDefinition } from "@bitwarden/state";
import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { NavDividerComponent } from "./nav-divider.component";
import { SideNavService } from "./side-nav.service";

export type SideNavVariant = "primary" | "secondary";

const DEFAULT_OPEN_WIDTH = 288;
const MIN_OPEN_WIDTH = 240;
const MAX_OPEN_WIDTH = 384;
const BIT_SIDE_NAV_WIDTH_KEY_DEF = new KeyDefinition<number>(BIT_SIDE_NAV_DISK, "side-nav-width", {
  deserializer: (s) => s,
});

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
  private readonly state = inject(GlobalStateProvider).get(BIT_SIDE_NAV_WIDTH_KEY_DEF);
  readonly width$: Observable<number> = this.state.state$.pipe(
    map((state) => state ?? DEFAULT_OPEN_WIDTH),
  );

  async setWidth(width: number) {
    await this.state.update(() => width);
  }

  private readonly destroy$ = new Subject<void>();

  constructor(protected sideNavService: SideNavService) {
    this.width$.pipe(takeUntil(this.destroy$)).subscribe((width) => {
      if (this.sideNavService.open) {
        this.lastOpenWidth = width;
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
    void this.setWidth(Math.min(Math.max(event.pointerPosition.x, MIN_OPEN_WIDTH), MAX_OPEN_WIDTH));
    const element = event.source.element.nativeElement;
    element.style.transform = "none";
  }
}
