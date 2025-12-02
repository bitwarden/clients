import { CdkTrapFocus } from "@angular/cdk/a11y";
import { DragDropModule, CdkDragMove } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, input, OnDestroy, signal, viewChild } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";
import { debounceTime, first, map, takeUntil } from "rxjs/operators";

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
})
export class SideNavComponent implements OnDestroy {
  protected sideNavService = inject(SideNavService);

  readonly variant = input<SideNavVariant>("primary");

  private readonly toggleButton = viewChild("toggleButton", { read: ElementRef });

  private elementRef = inject(ElementRef<HTMLElement>);
  protected lastOpenWidth = DEFAULT_OPEN_WIDTH;
  private readonly width = signal<number>(DEFAULT_OPEN_WIDTH);
  protected width$ = toObservable(this.width);

  private readonly widthState = inject(GlobalStateProvider).get(BIT_SIDE_NAV_WIDTH_KEY_DEF);
  readonly widthState$ = this.widthState.state$.pipe(map((width) => width ?? DEFAULT_OPEN_WIDTH));

  private readonly destroy$ = new Subject<void>();

  constructor() {
    this.width$.pipe(debounceTime(200), takeUntil(this.destroy$)).subscribe((width) => {
      // Store the last open width when the side nav is open
      if (this.sideNavService.open) {
        this.lastOpenWidth = width;
      }

      // Update the stored width state
      void this.widthState.update(() => width);
    });

    // Initialize the width from state
    this.widthState$.pipe(first(), takeUntil(this.destroy$)).subscribe((width: number) => {
      this.width.set(width);
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
    const rect = this.elementRef.nativeElement.getBoundingClientRect();

    const width = Math.min(
      Math.max(event.pointerPosition.x - rect.x, MIN_OPEN_WIDTH),
      MAX_OPEN_WIDTH,
    );
    this.width.set(width);

    const element = event.source.element.nativeElement;
    element.style.transform = "none";
  }
}
