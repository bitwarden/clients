import { Directionality } from "@angular/cdk/bidi";
import { CdkVirtualScrollable, ScrollDispatcher, VIRTUAL_SCROLLABLE } from "@angular/cdk/scrolling";
import {
  Directive,
  ElementRef,
  Injectable,
  NgZone,
  OnDestroy,
  OnInit,
  Optional,
  inject,
} from "@angular/core";

/**
 * A service is needed because we can't inject a directive defined in the template of a parent component. The parent's template is initialized after projected content.
 **/
@Injectable({ providedIn: "root" })
export class ScrollLayoutService {
  private _scrollableRef: ElementRef<HTMLElement> | null = null;

  get scrollableRef(): ElementRef<HTMLElement> | null {
    if (!this._scrollableRef) {
      // eslint-disable-next-line no-console
      console.error("No scrollable ref provided by ScrollLayoutHostDirective.");
    }
    return this._scrollableRef;
  }

  set scrollableRef(value: ElementRef<HTMLElement> | null) {
    this._scrollableRef = value;
  }
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
    this.service.scrollableRef = this.ref as ElementRef<HTMLElement>;
  }

  ngOnDestroy(): void {
    this.service.scrollableRef = null;
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
  constructor(
    scrollDispatcher: ScrollDispatcher,
    ngZone: NgZone,
    @Optional() dir: Directionality,
    private service: ScrollLayoutService,
  ) {
    super(service.scrollableRef!, scrollDispatcher, ngZone, dir);
  }

  override getElementRef(): ElementRef<HTMLElement> {
    return this.service.scrollableRef!;
  }

  override measureBoundingClientRectWithScrollOffset(
    from: "left" | "top" | "right" | "bottom",
  ): number {
    return (
      this.service.scrollableRef!.nativeElement.getBoundingClientRect()[from] -
      this.measureScrollOffset(from)
    );
  }
}
