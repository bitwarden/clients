import {
  CdkVirtualScrollViewport,
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
} from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  AfterContentChecked,
  Component,
  OnDestroy,
  TemplateRef,
  Directive,
  NgZone,
  AfterViewInit,
  ElementRef,
  TrackByFunction,
  input,
  contentChild,
} from "@angular/core";

import { ScrollLayoutDirective } from "../layout";

import { RowDirective } from "./row.directive";
import { TableComponent } from "./table.component";

/**
 * Helper directive for defining the row template.
 *
 * ```html
 * <ng-template bitRowDef let-row>
 *   <td bitCell>{{ row.id }}</td>
 * </ng-template>
 * ```
 */
@Directive({
  selector: "[bitRowDef]",
})
export class BitRowDef {
  constructor(public template: TemplateRef<any>) {}
}

/**
 * Scrollable table component.
 *
 * Utilizes virtual scrolling to render large datasets.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-table-scroll",
  templateUrl: "./table-scroll.component.html",
  providers: [{ provide: TableComponent, useExisting: TableScrollComponent }],
  imports: [
    CommonModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    RowDirective,
    ScrollLayoutDirective,
  ],
})
export class TableScrollComponent
  extends TableComponent
  implements AfterContentChecked, AfterViewInit, OnDestroy
{
  /** The size of the rows in the list (in pixels). */
  readonly rowSize = input.required<number>();

  /** Optional trackBy function. */
  readonly trackBy = input<TrackByFunction<any> | undefined>();

  protected readonly rowDef = contentChild(BitRowDef);

  /**
   * Height of the thead element (in pixels).
   *
   * Used to increase the table's total height to avoid items being cut off.
   */
  protected headerHeight = 0;

  /**
   * Observer for table header, applies padding on resize.
   */
  private headerObserver?: ResizeObserver;

  constructor(
    private zone: NgZone,
    private el: ElementRef,
  ) {
    super();
  }

  ngAfterViewInit(): void {
    this.headerObserver = new ResizeObserver((entries) => {
      this.zone.run(() => {
        this.headerHeight = entries[0].contentRect.height;
      });
    });

    this.headerObserver.observe(this.el.nativeElement.querySelector("thead"));
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();

    if (this.headerObserver) {
      this.headerObserver.disconnect();
    }
  }
}
