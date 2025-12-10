import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoResults, NoSendsIcon } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { ButtonModule, NoItemsModule, TableDataSource } from "@bitwarden/components";

import { SendSearchComponent } from "../send-search/send-search.component";
import { SendTableComponent } from "../send-table/send-table.component";

/** A state of the Send list UI. */
export const SendListState = Object.freeze({
  /** No sends exist for the current filter (file or text). */
  Empty: "Empty",
  /** Sends exist, but none match the current filter/search. */
  NoResults: "NoResults",
} as const);

/** A state of the Send list UI. */
export type SendListState = (typeof SendListState)[keyof typeof SendListState];

/**
 * A container component for displaying the Send list with search, table, and empty states.
 * Handles the presentation layer while delegating data management to services.
 */
@Component({
  selector: "tools-send-list",
  templateUrl: "./send-list.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    NoItemsModule,
    SendSearchComponent,
    SendTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendListComponent {
  protected readonly noItemIcon = NoSendsIcon;
  protected readonly noResultsIcon = NoResults;
  protected readonly sendListState = SendListState;

  private i18nService = inject(I18nService);

  readonly sends = input.required<SendView[]>();
  readonly loading = input<boolean>(false);
  readonly disableSend = input<boolean>(false);
  readonly listState = input<SendListState | null>(null);

  // Computed data source for the table component.
  protected readonly dataSource = computed(() => {
    const source = new TableDataSource<SendView>();
    source.data = this.sends();
    return source;
  });

  readonly addSend = output<void>();
  readonly editSend = output<SendView>();
  readonly copySend = output<SendView>();
  readonly removePassword = output<SendView>();
  readonly deleteSend = output<SendView>();

  protected onAddSend(): void {
    this.addSend.emit();
  }

  protected onEditSend(send: SendView): void {
    this.editSend.emit(send);
  }

  protected onCopySend(send: SendView): void {
    this.copySend.emit(send);
  }

  protected onRemovePassword(send: SendView): void {
    this.removePassword.emit(send);
  }

  protected onDeleteSend(send: SendView): void {
    this.deleteSend.emit(send);
  }
}
