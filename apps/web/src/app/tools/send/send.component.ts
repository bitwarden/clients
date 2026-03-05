import { Component, OnDestroy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { EMPTY, lastValueFrom, Observable, switchMap } from "rxjs";

import { SendComponent as BaseSendComponent } from "@bitwarden/angular/tools/send/send.component";
import { NoSendsIcon } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendFilterType } from "@bitwarden/common/tools/send/types/send-filter-type";
import { SendId } from "@bitwarden/common/types/guid";
import {
  DialogRef,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  SpinnerComponent,
} from "@bitwarden/components";
import {
  DefaultSendFormConfigService,
  SendFormConfig,
  SendAddEditDialogComponent,
  SendItemDialogResult,
  SendTableComponent,
  SendListComponent,
} from "@bitwarden/send-ui";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

import { NewSendDropdownComponent } from "./new-send/new-send-dropdown.component";
import { SendSuccessDrawerDialogComponent } from "./shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send",
  imports: [
    SharedModule,
    SearchModule,
    NoItemsModule,
    HeaderModule,
    NewSendDropdownComponent,
    SendTableComponent,
    SpinnerComponent,
    SendListComponent,
  ],
  templateUrl: "send.component.html",
  providers: [DefaultSendFormConfigService],
})
export class SendComponent extends BaseSendComponent implements OnDestroy {
  private sendItemDialogRef?: DialogRef<SendItemDialogResult> | undefined;
  SendFilterType = SendFilterType;

  // These should be removed once the Send UI refresh is live
  protected dataSource = new TableDataSource<SendView>();
  selectedSendFilter: SendFilterType = SendFilterType.All;
  noItemIcon = NoSendsIcon;
  SendUIRefresh$: Observable<boolean>;

  constructor(
    private addEditFormConfigService: DefaultSendFormConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
  ) {
    super();
    this.SendUIRefresh$ = this.configService.getFeatureFlag$(FeatureFlag.SendUIRefresh);

    // Ensure the component filters react to changes in query params
    this.SendUIRefresh$.pipe(
      switchMap((sendUiRefreshEnabled) => {
        if (sendUiRefreshEnabled) {
          return this.route.queryParamMap;
        }
        return EMPTY;
      }),
      takeUntilDestroyed(),
    ).subscribe((params) => {
      const typeParam = params.get("type");
      const sendType = this.sendFilterTypeToSendType(typeParam as SendFilterType);
      this.sendListFiltersService.filterForm.patchValue({ sendType });
    });
    // Ensure that query params are updated when the component changes filters
    this.sendListFiltersService.filters$.pipe(takeUntilDestroyed()).subscribe((value) => {
      const type = this.sendTypeToSendFilterType(value.sendType);
      this.router
        .navigate([], {
          relativeTo: this.route,
          queryParams: { type },
          queryParamsHandling: "merge",
        })
        .catch((err) => {
          this.logService.error("Failed to update route query params:", err);
        });
    });
    // Pre-refresh data setup. Can be removed once Send UI refresh is live.
    this.sendItemsService.filteredAndSortedSends$.pipe(takeUntilDestroyed()).subscribe((sends) => {
      this.dataSource.data = sends;
    });
  }

  ngOnDestroy() {
    this.dialogService.closeAll();
    this.dialogService.closeDrawer();
  }

  async editSend(send: SendView) {
    const config = await this.addEditFormConfigService.buildConfig(
      send == null ? "add" : "edit",
      send == null ? null : (send.id as SendId),
      send.type,
    );

    await this.openSendItemDialog(config);
  }

  /**
   * Opens the send item dialog.
   * @param formConfig The form configuration.
   * */
  async openSendItemDialog(formConfig: SendFormConfig) {
    const useRefresh = await this.configService.getFeatureFlag(FeatureFlag.SendUIRefresh);
    // Prevent multiple dialogs from being opened but allow drawers since they will prevent multiple being open themselves
    if (this.sendItemDialogRef && !useRefresh) {
      return;
    }

    if (useRefresh) {
      this.sendItemDialogRef = SendAddEditDialogComponent.openDrawer(this.dialogService, {
        formConfig,
      });
    } else {
      this.sendItemDialogRef = SendAddEditDialogComponent.open(this.dialogService, {
        formConfig,
      });
    }

    const result: SendItemDialogResult = await lastValueFrom(this.sendItemDialogRef.closed);
    this.sendItemDialogRef = undefined;

    if (
      result?.result === SendItemDialogResult.Saved &&
      result?.send &&
      (await this.configService.getFeatureFlag(FeatureFlag.SendUIRefresh))
    ) {
      this.dialogService.openDrawer(SendSuccessDrawerDialogComponent, {
        data: result.send,
      });
    }
  }

  /** Pre-Refresh methods. Can be removed once Send UI refresh is live */
  searchTextChanged(event: Event) {
    if (event instanceof InputEvent) {
      this.sendItemsService.applyFilter(event.data ?? "");
    }
  }

  selectType(type: SendFilterType) {
    this.selectedSendFilter = type;
    const sendType = this.sendFilterTypeToSendType(type);
    this.sendListFiltersService.filterForm.patchValue({ sendType });
  }
}
