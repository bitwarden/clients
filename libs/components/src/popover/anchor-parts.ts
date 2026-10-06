import { Directive, ElementRef, Injectable, effect, inject, input, signal } from "@angular/core";

/**
 * Named elements inside a component, for `[bitPopoverAnchorFor]`'s `anchor`. Provide it on the
 * component that owns the names; elements join with `bitAnchorPart`.
 */
@Injectable()
export class AnchorParts {
  private readonly parts = signal<ReadonlyMap<string, HTMLElement>>(new Map());

  /** The element registered as `name`, or `undefined` while it isn't rendered. */
  get(name: string): HTMLElement | undefined {
    return this.parts().get(name);
  }

  register(name: string, element: HTMLElement): void {
    this.parts.update((parts) => new Map(parts).set(name, element));
  }

  unregister(name: string, element: HTMLElement): void {
    // A newer element may have taken the name before this one was destroyed
    if (this.parts().get(name) !== element) {
      return;
    }
    this.parts.update((parts) => {
      const next = new Map(parts);
      next.delete(name);
      return next;
    });
  }
}

/** Registers the host element under a name in the nearest `AnchorParts`. */
@Directive({ selector: "[bitAnchorPart]" })
export class AnchorPartDirective {
  readonly name = input.required<string>({ alias: "bitAnchorPart" });

  private readonly parts = inject(AnchorParts, { optional: true });
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    effect((onCleanup) => {
      const name = this.name();
      this.parts?.register(name, this.element);
      onCleanup(() => this.parts?.unregister(name, this.element));
    });
  }
}
