import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  IconButtonModule,
  MenuModule,
  TableDataSource,
} from "@bitwarden/components";

import { VaultColumn, VaultRowBase } from "./vault-row";

/**
 * Per-row actions menu for the individual (personal) vault. The action *set* is
 * defined here (a per-table concern); each item emits the row for the consumer
 * to act on, and items are gated by the row's resolved capability flags.
 */
@Component({
  selector: "vault-individual-actions-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    MenuModule,
    IconButtonModule,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
  ],
  template: `
    <bit-column width="3.5rem">
      <bit-header-cell></bit-header-cell>
      <bit-cell *bitCellDef="ds().synthetic(actionsKey); let row">
        <button
          bitIconButton="bwi-ellipsis-v"
          size="small"
          type="button"
          [bitMenuTriggerFor]="menu"
          [label]="'options' | i18n"
        ></button>
        <bit-menu #menu>
          @if (row.canEdit) {
            <button type="button" bitMenuItem (click)="edit.emit(row)">{{ "edit" | i18n }}</button>
          }
          @if (row.cipher) {
            <button type="button" bitMenuItem (click)="archive.emit(row)">
              {{ "archiveVerb" | i18n }}
            </button>
          }
          @if (row.canDelete) {
            <button type="button" bitMenuItem (click)="delete.emit(row)">
              {{ "delete" | i18n }}
            </button>
          }
        </bit-menu>
      </bit-cell>
    </bit-column>
  `,
})
export class VaultIndividualActionsColumnComponent<T extends VaultRowBase> {
  readonly ds = input.required<TableDataSource<T>>();

  readonly edit = output<T>();
  readonly archive = output<T>();
  readonly delete = output<T>();

  protected readonly actionsKey = VaultColumn.Actions;
}
