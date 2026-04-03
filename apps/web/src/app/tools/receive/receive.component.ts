import { ChangeDetectionStrategy, Component, computed, effect, inject, model } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { firstValueFrom, switchMap } from "rxjs";

import { NoResults, NoSendsIcon } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import {
  InternalReceiveService,
  ReceiveService,
} from "@bitwarden/common/tools/receive/services/receive.service";
import {
  ButtonModule,
  DialogService,
  NoItemsModule,
  SearchModule,
  SpinnerComponent,
  TableDataSource,
  ToastService,
  ToggleGroupModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { ReceiveAddEditComponent } from "./receive-add-edit.component";
import { ReceiveTableComponent } from "./receive-table.component";
import { ReceiveViewComponent } from "./receive-view.component";

export type ReceiveRow = ReceiveView & { expired: boolean };

export const ReceiveListState = Object.freeze({
  Empty: "Empty",
  NoSearchResults: "NoSearchResults",
} as const);
export type ReceiveListState = (typeof ReceiveListState)[keyof typeof ReceiveListState];

@Component({
  selector: "app-receive",
  templateUrl: "receive.component.html",
  imports: [
    FormsModule,
    I18nPipe,
    ButtonModule,
    SearchModule,
    NoItemsModule,
    SpinnerComponent,
    HeaderModule,
    ToggleGroupModule,
    ReceiveTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveComponent {
  protected readonly noItemIcon = NoSendsIcon;
  protected readonly noResultsIcon = NoResults;
  protected readonly ReceiveListState = ReceiveListState;

  private readonly dialogService = inject(DialogService);
  private readonly receiveService = inject(InternalReceiveService);
  private readonly accountService = inject(AccountService);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly receiveUrlService = inject(ReceiveService);

  protected readonly searchText = model("");
  protected readonly dataSource = new TableDataSource<ReceiveRow>();

  private readonly receives = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.receiveService.receiveViews$(userId)),
    ),
  );

  protected readonly loading = computed(() => this.receives() == null);

  protected readonly listState = computed<ReceiveListState | null>(() => {
    const receives = this.receives();
    if (receives == null) {
      return null;
    }
    if (receives.length === 0) {
      return ReceiveListState.Empty;
    }
    if (this.searchText().length > 0 && this.dataSource.filteredData?.length === 0) {
      return ReceiveListState.NoSearchResults;
    }
    return null;
  });

  constructor() {
    effect(() => {
      const receives = this.receives();
      if (receives != null) {
        const now = new Date();
        this.dataSource.data = receives.map((r) => ({
          ...r,
          expired: r.expirationDate != null && r.expirationDate < now,
        }));
      }
    });

    effect(() => {
      this.dataSource.filter = this.receiveFilter(this.searchText());
    });
  }

  protected openNewReceiveDrawer(): void {
    this.dialogService.openDrawer(ReceiveAddEditComponent, { closeOnNavigation: true });
  }

  protected openViewReceiveDrawer(receive: ReceiveView): void {
    this.dialogService.openDrawer(ReceiveViewComponent, {
      data: receive,
      closeOnNavigation: true,
    });
  }

  private receiveFilter(query: string): (receive: ReceiveRow) => boolean {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return () => true;
    }
    return (receive: ReceiveRow) => {
      if (receive.name?.toLowerCase().includes(normalizedQuery)) {
        return true;
      }
      if (receive.fileData?.some((f) => f.fileName?.toLowerCase().includes(normalizedQuery))) {
        return true;
      }
      return false;
    };
  }

  protected async copyReceiveLink(receive: ReceiveView): Promise<void> {
    const receiveLink = await firstValueFrom(this.receiveUrlService.buildReceiveUrl$(receive));
    if (!receiveLink) {
      return;
    }

    this.platformUtilsService.copyToClipboard(receiveLink);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("receiveLink")),
    });
  }

  async confirmDeleteReceive($event: ReceiveView) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteReceive" },
      content: { key: "deleteReceivePermanentConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.receiveService.delete($event.id, userId);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("receiveDeleted"),
    });
  }
}
