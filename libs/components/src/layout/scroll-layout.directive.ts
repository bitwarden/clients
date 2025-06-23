import { CdkVirtualScrollable, VIRTUAL_SCROLLABLE } from "@angular/cdk/scrolling";
import {
  Directive,
  ElementRef,
  Injectable,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { filter, fromEvent, Observable, switchMap } from "rxjs";

/**
 * A service is needed because we can't inject a directive defined in the template of a parent component. The parent's template is initialized after projected content.
 **/
@Injectable({ providedIn: "root" })
export class ScrollLayoutService {
  scrollableRef = signal<ElementRef<HTMLElement> | null>(null);
  scrollableRef$ = toObservable(this.scrollableRef);
}

/**
 * Marks the primary scrollable area of a layout component.
 *
 * Stores the element reference in a global service so it can be referenced by `ScrollLayoutDirective` even when it isn't a direct child of this directive.
 **/
@Directive({
  selector: "[bitScrollLayoutHost]",
  standalone: true,
  host: {
    class: "cdk-virtual-scrollable",
  },
})
export class ScrollLayoutHostDirective implements OnDestroy {
  private ref = inject(ElementRef);
  private service = inject(ScrollLayoutService);

  constructor() {
    this.service.scrollableRef.set(this.ref as ElementRef<HTMLElement>);
  }

  ngOnDestroy(): void {
    this.service.scrollableRef.set(null);
  }
}

/**
 * Sets the scroll viewport to the element marked with `ScrollLayoutHostDirective`.
 *
 * `ScrollLayoutHostDirective` is set on the primary scrollable area of a layout component (`bit-layout`, `popup-page`, etc).
 *
 * @see "Virtual Scrolling" in Storybook.
 */
@Directive({
  selector: "[bitScrollLayout]",
  standalone: true,
  providers: [{ provide: VIRTUAL_SCROLLABLE, useExisting: ScrollLayoutDirective }],
})
export class ScrollLayoutDirective extends CdkVirtualScrollable implements OnInit {
  private service = inject(ScrollLayoutService);

  constructor() {
    super();

    effect(() => {
      const scrollableRef = this.service.scrollableRef();
      if (!scrollableRef) {
        // eslint-disable-next-line no-console
        console.error("ScrollLayoutDirective can't find scroll host");
        return;
      }

      this.elementRef = scrollableRef;
    });
  }

  override elementScrolled(): Observable<Event> {
    return this.service.scrollableRef$.pipe(
      filter((ref) => ref !== null),
      switchMap((ref) => fromEvent(ref.nativeElement, "scroll")),
    );
  }

  override getElementRef(): ElementRef<HTMLElement> {
    return this.service.scrollableRef()!;
  }

  override measureBoundingClientRectWithScrollOffset(
    from: "left" | "top" | "right" | "bottom",
  ): number {
    return (
      this.service.scrollableRef()!.nativeElement.getBoundingClientRect()[from] -
      this.measureScrollOffset(from)
    );
  }
}
