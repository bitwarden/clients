import { CdkTrapFocus } from "@angular/cdk/a11y";
import { DragDropModule, CdkDragMove } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, input, OnDestroy, signal, viewChild } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";
import { debounceTime, map, takeUntil } from "rxjs/operators";

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

  private elementRef = inject(ElementRef<HTMLElement>);
  protected lastOpenWidth = DEFAULT_OPEN_WIDTH;
  private width = signal<number>(DEFAULT_OPEN_WIDTH);
  protected width$ = toObservable(this.width);

  private readonly widthState = inject(GlobalStateProvider).get(BIT_SIDE_NAV_WIDTH_KEY_DEF);
  readonly widthState$ = this.widthState.state$.pipe(map((width) => width ?? DEFAULT_OPEN_WIDTH));
  private debouncedWidthStateSubject = new Subject<number>();

  private readonly destroy$ = new Subject<void>();

  constructor(protected sideNavService: SideNavService) {
    this.width$.pipe(takeUntil(this.destroy$)).subscribe((width) => {
      // Store the last open width when the side nav is open
      if (this.sideNavService.open) {
        this.lastOpenWidth = width;
      }
    });

    // Initialize the width from state
    void this.widthState$.forEach((width) => {
      this.width.set(width);
    });

    // Debounce storing the width to avoid excessive writes to storage
    this.debouncedWidthStateSubject
      .pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe((width) => {
        void this.widthState.update(() => width);
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
    void this.debouncedWidthStateSubject.next(width);

    const element = event.source.element.nativeElement;
    element.style.transform = "none";
  }
}
