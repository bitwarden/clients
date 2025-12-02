// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy, ViewChild, NgZone, ChangeDetectorRef } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { mergeMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SendComponent as BaseSendComponent } from "@bitwarden/angular/tools/send/send.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { invokeMenu, RendererMenuItem } from "../../../utils";
import { SearchBarService } from "../../layout/search/search-bar.service";
import { AddEditComponent } from "../send/add-edit.component";

const Action = Object.freeze({
  /** No action is currently active. */
  None: "",
  /** The user is adding a new Send. */
  Add: "add",
  /** The user is editing an existing Send. */
  Edit: "edit",
} as const);

type Action = (typeof Action)[keyof typeof Action];

const BroadcasterSubscriptionId = "SendV2Component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send-v2",
  imports: [CommonModule, JslibModule, FormsModule, AddEditComponent],
  templateUrl: "./send-v2.component.html",
})
export class SendV2Component extends BaseSendComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(AddEditComponent) addEditComponent: AddEditComponent;

  // The ID of the currently selected Send item being viewed or edited
  sendId: string;

  // Tracks the current UI state: viewing list (None), adding new Send (Add), or editing existing Send (Edit)
  action: Action = Action.None;

  constructor(
    sendService: SendService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    private broadcasterService: BroadcasterService,
    ngZone: NgZone,
    searchService: SearchService,
    policyService: PolicyService,
    private searchBarService: SearchBarService,
    logService: LogService,
    sendApiService: SendApiService,
    dialogService: DialogService,
    toastService: ToastService,
    accountService: AccountService,
    private cdr: ChangeDetectorRef,
  ) {
    super(
      sendService,
      i18nService,
      platformUtilsService,
      environmentService,
      ngZone,
      searchService,
      policyService,
      logService,
      sendApiService,
      dialogService,
      toastService,
      accountService,
    );

    // Listen to search bar changes and update the Send list filter
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.searchBarService.searchText$.subscribe((searchText) => {
      this.searchText = searchText;
      this.searchTextChanged();
      setTimeout(() => this.cdr.detectChanges(), 250);
    });
  }

  // Initialize the component: enable search bar, subscribe to sync events, and load Send items
  async ngOnInit() {
    this.searchBarService.setEnabled(true);
    this.searchBarService.setPlaceholderText(this.i18nService.t("searchSends"));

    await super.ngOnInit();

    // Listen for sync completion events to refresh the Send list
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            await this.load();
            break;
        }
      });
    });
    await this.load();
  }

  // Clean up subscriptions and disable search bar when component is destroyed
  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.searchBarService.setEnabled(false);
  }

  // Load Send items from the service and display them in the list.
  // Subscribes to sendViews$ observable to get updates when Sends change.
  // Manually triggers change detection to ensure UI updates immediately.
  // Note: The filter parameter is ignored in this implementation for desktop-specific behavior.
  async load(filter: (send: SendView) => boolean = null) {
    this.loading = true;
    this.sendService.sendViews$
      .pipe(
        mergeMap(async (sends) => {
          this.sends = sends;
          await this.search(null);
          // Trigger change detection after data updates
          this.cdr.detectChanges();
        }),
      )
      // eslint-disable-next-line rxjs-angular/prefer-takeuntil
      .subscribe();
    if (this.onSuccessfulLoad != null) {
      await this.onSuccessfulLoad();
    } else {
      // Default action
      this.selectAll();
    }
    this.loading = false;
    this.loaded = true;
  }

  // Open the add Send form to create a new Send item
  async addSend() {
    this.action = Action.Add;
    if (this.addEditComponent != null) {
      await this.addEditComponent.resetAndLoad();
    }
  }

  // Close the add/edit form and return to the list view
  cancel(s: SendView) {
    this.action = Action.None;
    this.sendId = null;
  }

  // Handle when a Send is deleted: refresh the list and close the edit form
  async deletedSend(s: SendView) {
    await this.refresh();
    this.action = Action.None;
    this.sendId = null;
  }

  // Handle when a Send is saved: refresh the list and re-select the saved Send
  async savedSend(s: SendView) {
    await this.refresh();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.selectSend(s.id);
  }

  // Select a Send from the list and open it in the edit form.
  // If the same Send is already selected and in edit mode, do nothing to avoid unnecessary reloads.
  async selectSend(sendId: string) {
    if (sendId === this.sendId && this.action === Action.Edit) {
      return;
    }
    this.action = Action.Edit;
    this.sendId = sendId;
    if (this.addEditComponent != null) {
      this.addEditComponent.sendId = sendId;
      await this.addEditComponent.refresh();
    }
  }

  // Get the type (text or file) of the currently selected Send for the edit form
  get selectedSendType() {
    return this.sends.find((s) => s.id === this.sendId)?.type;
  }

  // Show the right-click context menu for a Send with options to copy link, remove password, or delete
  viewSendMenu(send: SendView) {
    const menu: RendererMenuItem[] = [];
    menu.push({
      label: this.i18nService.t("copyLink"),
      click: () => this.copy(send),
    });
    if (send.password && !send.disabled) {
      menu.push({
        label: this.i18nService.t("removePassword"),
        click: async () => {
          await this.removePassword(send);
          if (this.sendId === send.id) {
            this.sendId = null;
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.selectSend(send.id);
          }
        },
      });
    }
    menu.push({
      label: this.i18nService.t("delete"),
      click: async () => {
        await this.delete(send);
        await this.deletedSend(send);
      },
    });

    invokeMenu(menu);
  }
}
