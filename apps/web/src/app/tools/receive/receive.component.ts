import { Component, computed, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoResults, NoSendsIcon } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { buildReceiveUrl } from "@bitwarden/common/tools/receive/models/receive-url-data";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import { ReceiveService } from "@bitwarden/common/tools/receive/services/receive.service";
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
import { ReceiveListState } from "./receive-view";
import { ReceiveViewComponent } from "./receive-view.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-receive",
  templateUrl: "receive.component.html",
  imports: [
    FormsModule,
    I18nPipe,
    JslibModule,
    ButtonModule,
    SearchModule,
    NoItemsModule,
    SpinnerComponent,
    HeaderModule,
    ToggleGroupModule,
    ReceiveTableComponent,
  ],
})
export class ReceiveComponent {
  protected readonly noItemIcon = NoSendsIcon;
  protected readonly noResultsIcon = NoResults;
  protected readonly ReceiveListState = ReceiveListState;

  protected readonly loading = signal(true);
  protected readonly listState = signal<ReceiveListState | null>(null);
  protected readonly currentSearchText = signal("");
  protected readonly dataSource = new TableDataSource<ReceiveView>();

  protected readonly noSearchResults = computed(
    () => true, // TODO: Implement search and update this value based on results
  );

  private readonly baseReceiveUrl = toSignal(
    this.environmentService.environment$.pipe(map((env) => env.getWebVaultUrl() + "/#/receive")),
  );

  constructor(
    private readonly dialogService: DialogService,
    private readonly receiveService: ReceiveService,
    private readonly accountService: AccountService,
    private readonly environmentService: EnvironmentService,
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
  ) {
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => this.receiveService.receiveViews$(userId)),
        takeUntilDestroyed(),
      )
      .subscribe((receives) => {
        this.dataSource.data = receives;
        this.loading.set(false);
        this.listState.set(receives.length === 0 ? ReceiveListState.Empty : null);
      });
  }

  openNewReceiveDrawer(): void {
    this.dialogService.openDrawer(ReceiveAddEditComponent, { closeOnNavigation: true });
  }

  openViewReceiveDrawer(receive: ReceiveView): void {
    this.dialogService.openDrawer(ReceiveViewComponent, {
      data: receive,
      closeOnNavigation: true,
    });
  }

  searchTextChanged(newSearchText: string): void {
    this.currentSearchText.set(newSearchText);
  }

  protected copyReceiveLink(receive: ReceiveView): void {
    const baseUrl = this.baseReceiveUrl();
    if (!baseUrl) {
      return;
    }

    const receiveLink = buildReceiveUrl(receive, baseUrl);

    this.platformUtilsService.copyToClipboard(receiveLink);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("receiveLink")),
    });
  }
}
