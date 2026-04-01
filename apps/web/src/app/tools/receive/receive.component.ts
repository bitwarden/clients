import { Component, computed, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoResults, NoSendsIcon } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import { ReceiveService } from "@bitwarden/common/tools/receive/services/receive.service";
import {
  ButtonModule,
  DialogService,
  NoItemsModule,
  SearchModule,
  SpinnerComponent,
  TableDataSource,
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
export class ReceiveComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly accountService = inject(AccountService);
  private readonly receiveService = inject(ReceiveService);
  private readonly dialogService = inject(DialogService);

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

  ngOnInit(): void {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) => this.receiveService.receiveViews$(account!.id)),
        takeUntilDestroyed(this.destroyRef),
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
}
