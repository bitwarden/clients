import {
  CdkFixedSizeVirtualScroll,
  FixedSizeVirtualScrollStrategy,
  VIRTUAL_SCROLL_STRATEGY,
} from "@angular/cdk/scrolling";
import { Directive, forwardRef } from "@angular/core";

// Custom virtual scroll strategy for cdk-virtual-scroll
// Uses a sample list item to set the itemSize for FixedSizeVirtualScrollStrategy
// The use case is the same as FixedSizeVirtualScrollStrategy, but it avoids locking in pixel sizes in the template.
export class CipherListVirtualScrollStrategy extends FixedSizeVirtualScrollStrategy {
  private checkItemSizeCallback: any;
  private timeout: any;

  constructor(
    itemSize: number,
    minBufferPx: number,
    maxBufferPx: number,
    checkItemSizeCallback: any,
  ) {
    super(itemSize, minBufferPx, maxBufferPx);
    this.checkItemSizeCallback = checkItemSizeCallback;
  }

  onContentRendered() {
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(this.checkItemSizeCallback, 500);
  }
}

export function _cipherListVirtualScrollStrategyFactory(cipherListDir: CipherListVirtualScroll) {
  return cipherListDir._scrollStrategy;
}

@Directive({
  selector: "cdk-virtual-scroll-viewport[itemSize]",
  providers: [
    {
      provide: VIRTUAL_SCROLL_STRATEGY,
      useFactory: _cipherListVirtualScrollStrategyFactory,
      deps: [forwardRef(() => CipherListVirtualScroll)],
    },
  ],
})
export class CipherListVirtualScroll extends CdkFixedSizeVirtualScroll {
  _scrollStrategy: CipherListVirtualScrollStrategy;

  constructor() {
    super();
    this._scrollStrategy = new CipherListVirtualScrollStrategy(
      this.itemSize,
      this.minBufferPx,
      this.maxBufferPx,
      this.checkAndUpdateItemSize,
    );
  }

  checkAndUpdateItemSize = () => {
    const sampleItem = document.querySelector(
      "cdk-virtual-scroll-viewport .virtual-scroll-item",
    ) as HTMLElement;
    const newItemSize = sampleItem?.offsetHeight;

    if (newItemSize != null && newItemSize !== this.itemSize) {
      this.itemSize = newItemSize;
      this._scrollStrategy.updateItemAndBufferSize(
        this.itemSize,
        this.minBufferPx,
        this.maxBufferPx,
      );
    }
  };
}
