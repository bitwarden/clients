import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../../icon-button";
import { InputModule } from "../../input";
import { SelectModule } from "../../select";

import { PaginationModel } from "./pagination-model";

/**
 * Pagination footer for `bit-table-v2`, rendered by the table inside its chrome
 * below the rows when the model is configured with `pagination`. A stateless view
 * over the {@link PaginationModel} it's handed: the current row range on the left
 * and, on the right, a page-size select, previous/next controls, and a page input.
 *
 * Internal — the table renders it automatically; consumers configure it via
 * `pagination` on the {@link TableModel}, not by projecting this component.
 */
@Component({
  selector: "bit-table-paginator",
  templateUrl: "./bit-table-paginator.component.html",
  imports: [SelectModule, IconButtonModule, InputModule, FormsModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-border-0 tw-border-t tw-border-solid tw-border-border-base",
  },
})
export class BitTablePaginatorComponent {
  /** The model's pagination state this footer renders and drives. */
  readonly pagination = input.required<PaginationModel>();

  /** Sets the page size from the select's selected value. */
  protected setPageSize(size: number): void {
    this.pagination().setPageSize(Number(size));
  }

  /** Jumps to a 1-based page number entered in the page input. */
  protected goToPage(page: number | string): void {
    const value = Number(page);
    if (!Number.isFinite(value)) {
      return;
    }
    this.pagination().goTo(value - 1);
  }
}
