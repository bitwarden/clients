import {
  CdkVirtualScrollViewport,
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
} from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  AfterContentChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  TemplateRef,
  TrackByFunction,
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
export class BitRowDefDirective {
  constructor(public template: TemplateRef<any>) {}
}

/**
 * Scrollable table component.
 *
 * Utilizes virtual scrolling to render large datasets.
 */
@Component({
  selector: "bit-table-scroll",
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  protected readonly rowDef = contentChild(BitRowDefDirective);

  /**
   * Height of the thead element (in pixels).
   *
   * Used to increase the table's total height to avoid items being cut off.
   */
  protected readonly headerHeight = signal(0);

  /**
   * Observer for table header, applies padding on resize.
   */
  private readonly headerObserver = new ResizeObserver((entries) => {
    this.headerHeight.set(entries[0].contentRect.height);
  });

  private readonly el = inject(ElementRef);

  ngAfterViewInit(): void {
    this.headerObserver.observe(this.el.nativeElement.querySelector("thead"));
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();

    this.headerObserver.disconnect();
  }
}
