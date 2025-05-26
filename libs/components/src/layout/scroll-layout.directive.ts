import { Directionality } from "@angular/cdk/bidi";
import {
  CdkVirtualScrollable,
  // CdkVirtualScrollViewport,
  ScrollDispatcher,
  VIRTUAL_SCROLLABLE,
} from "@angular/cdk/scrolling";
import {
  Directive,
  ElementRef,
  // forwardRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  Optional,
} from "@angular/core";
// import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { fromEvent, Observable, Observer, takeUntil } from "rxjs";
// import { fromEvent, Observable, Observer, takeUntil } from "rxjs";

@Directive({
  selector: "cdk-virtual-scroll-viewport[bitScrollLayout]",
  standalone: true,
  providers: [{ provide: VIRTUAL_SCROLLABLE, useExisting: ScrollLayoutDirective }],
})
export class ScrollLayoutDirective extends CdkVirtualScrollable implements OnInit, OnDestroy {
  private scrollableContainerRef: ElementRef<HTMLElement>;
  router = inject(Router);
  // viewport = inject(forwardRef(() => CdkVirtualScrollViewport));

  // protected override _elementScrolled = new Subject<Event>();
  // private _renderer = inject(Renderer2);
  // private _cleanupScroll: (() => void) | undefined;

  protected override _elementScrolled: Observable<Event> = new Observable(
    (observer: Observer<Event>) =>
      this.ngZone.runOutsideAngular(() =>
        fromEvent(
          document.querySelector<HTMLElement>(".bit-virtual-scrollable.cdk-virtual-scrollable")!,
          "scroll",
        )
          .pipe(takeUntil(this._destroyed))
          .subscribe(observer),
      ),
  );

  constructor(scrollDispatcher: ScrollDispatcher, ngZone: NgZone, @Optional() dir: Directionality) {
    const scrollableContainer = document.querySelector<HTMLElement>(
      ".bit-virtual-scrollable.cdk-virtual-scrollable",
    )!;
    if (!scrollableContainer) {
      // eslint-disable-next-line no-console
      console.error(
        "HTML element with [bitScrollableContainer] must be a descendant of .bit-virtual-scrollable.cdk-virtual-scrollable",
      );
    }
    const scrollableContainerRef = new ElementRef(scrollableContainer);
    super(scrollableContainerRef, scrollDispatcher, ngZone, dir);
    this.scrollableContainerRef = scrollableContainerRef;

    // this.router.events
    //   .pipe(filter((event) => event.type === EventType.NavigationEnd))
    //   .subscribe((event) => {
    //     //eslint-disable-next-line
    //     console.log("a thing has happened", event);
    //     // this.viewport.checkViewportSize();
    //     //eslint-disable-next-line
    //     console.log(this.getElementRef());
    //   });
  }

  // override ngOnInit() {
  //   this._cleanupScroll = this.ngZone.runOutsideAngular(() =>
  //     this._renderer.listen(
  //       document.querySelector<HTMLElement>(".bit-virtual-scrollable.cdk-virtual-scrollable"),
  //       "scroll",
  //       (event) => this._elementScrolled.next(event),
  //     ),
  //   );
  // }

  // override ngOnDestroy() {
  //   this._cleanupScroll?.();
  //   this._elementScrolled.complete();
  // }

  override getElementRef(): ElementRef<HTMLElement> {
    return this.scrollableContainerRef;
  }

  override measureBoundingClientRectWithScrollOffset(
    from: "left" | "top" | "right" | "bottom",
  ): number {
    return (
      this.scrollableContainerRef.nativeElement.getBoundingClientRect()[from] -
      this.measureScrollOffset(from)
    );
  }
}
