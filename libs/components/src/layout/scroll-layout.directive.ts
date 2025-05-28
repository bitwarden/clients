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
