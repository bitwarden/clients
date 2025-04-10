// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  AfterViewInit,
  ContentChildren,
  Directive,
  HostBinding,
  HostListener,
  Input,
  QueryList,
} from "@angular/core";

import type { A11yCellDirective } from "./a11y-cell.directive";
import { A11yRowDirective } from "./a11y-row.directive";

@Directive({
  selector: "bitA11yGrid",
  standalone: true,
})
export class A11yGridDirective implements AfterViewInit {
  @HostBinding("attr.role")
  role = "grid";

  @ContentChildren(A11yRowDirective)
  rows: QueryList<A11yRowDirective>;

  /** The number of pages to navigate on `PageUp` and `PageDown` */
  @Input() pageSize = 5;

  private grid: A11yCellDirective[][];

  /** The row that currently has focus */
  private activeRow = 0;

  /** The cell that currently has focus */
  private activeCol = 0;

  @HostListener("keydown", ["$event"])
  onKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case "ArrowUp":
        this.updateCellFocusByDelta(-1, 0);
        break;
      case "ArrowRight":
        this.updateCellFocusByDelta(0, 1);
        break;
      case "ArrowDown":
        this.updateCellFocusByDelta(1, 0);
        break;
      case "ArrowLeft":
        this.updateCellFocusByDelta(0, -1);
        break;
      case "Home":
        this.updateCellFocusByDelta(-this.activeRow, -this.activeCol);
        break;
      case "End":
        this.updateCellFocusByDelta(this.grid.length, this.grid[this.grid.length - 1].length);
        break;
      case "PageUp":
        this.updateCellFocusByDelta(-this.pageSize, 0);
        break;
      case "PageDown":
        this.updateCellFocusByDelta(this.pageSize, 0);
        break;
      default:
        return;
    }

    /** Prevent default scrolling behavior */
    event.preventDefault();
  }

  ngAfterViewInit(): void {
    this.initializeGrid();
  }

  private initializeGrid(): void {
    try {
      this.grid = this.rows.map((listItem) => {
        listItem.role = "row";
        return [...listItem.cells];
      });
      this.grid.flat().forEach((cell) => {
        cell.role = "gridcell";
        cell.getFocusTarget().tabIndex = -1;
      });

      this.getActiveCellContent().tabIndex = 0;
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Unable to initialize grid");
    }
  }

  /** Get the focusable content of the active cell */
  private getActiveCellContent(): HTMLElement {
    return this.grid[this.activeRow][this.activeCol].getFocusTarget();
  }

  /** Move focus via a delta against the currently active gridcell */
  private updateCellFocusByDelta(rowDelta: number, colDelta: number) {
    const prevActive = this.getActiveCellContent();

    this.activeCol += colDelta;
    this.activeRow += rowDelta;

    // Row upper bound
    if (this.activeRow >= this.grid.length) {
      this.activeRow = this.grid.length - 1;
    }

    // Row lower bound
    if (this.activeRow < 0) {
      this.activeRow = 0;
    }

    // Column upper bound
    if (this.activeCol >= this.grid[this.activeRow].length) {
      if (this.activeRow < this.grid.length - 1) {
        // Wrap to next row on right arrow
        this.activeCol = 0;
        this.activeRow += 1;
      } else {
        this.activeCol = this.grid[this.activeRow].length - 1;
      }
    }

    // Column lower bound
    if (this.activeCol < 0) {
      if (this.activeRow > 0) {
        // Wrap to prev row on left arrow
        this.activeRow -= 1;
        this.activeCol = this.grid[this.activeRow].length - 1;
      } else {
        this.activeCol = 0;
      }
    }

    const nextActive = this.getActiveCellContent();
    nextActive.tabIndex = 0;
    nextActive.focus();

    if (nextActive !== prevActive) {
      prevActive.tabIndex = -1;
    }
  }
}
