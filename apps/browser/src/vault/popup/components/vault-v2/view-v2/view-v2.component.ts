// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, Observable, switchMap, of, map } from "rxjs";

import { CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  AUTOFILL_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATION_CODE_ID,
  SHOW_AUTOFILL_BUTTON,
  UPDATE_PASSWORD,
} from "@bitwarden/common/autofill/constants";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogService,
  IconButtonModule,
  SearchModule,
  ToastService,
} from "@bitwarden/components";
import {
  ChangeLoginPasswordService,
  CipherViewComponent,
  CopyCipherFieldService,
  DefaultChangeLoginPasswordService,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { sendExtensionMessage } from "../../../../../autofill/utils/index";
import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { PopOutComponent } from "../../../../../platform/popup/components/pop-out.component";
import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";
import { BrowserPremiumUpgradePromptService } from "../../../services/browser-premium-upgrade-prompt.service";
import { BrowserViewPasswordHistoryService } from "../../../services/browser-view-password-history.service";
import { VaultPopupScrollPositionService } from "../../../services/vault-popup-scroll-position.service";
import { closeViewVaultItemPopout, VaultPopoutType } from "../../../utils/vault-popout-window";

import { PopupFooterComponent } from "./../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "./../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "./../../../../../platform/popup/layout/popup-page.component";
import { VaultPopupAutofillService } from "./../../../services/vault-popup-autofill.service";

/**
 * The types of actions that can be triggered when loading the view vault item popout via the
 * extension ContextMenu. See context-menu-clicked-handler.ts for more information.
 */
type LoadAction =
  | typeof AUTOFILL_ID
  | typeof SHOW_AUTOFILL_BUTTON
  | typeof COPY_USERNAME_ID
  | typeof COPY_PASSWORD_ID
  | typeof COPY_VERIFICATION_CODE_ID
  | typeof UPDATE_PASSWORD;

@Component({
  selector: "app-view-v2",
  templateUrl: "view-v2.component.html",
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    IconButtonModule,
    CipherViewComponent,
    AsyncActionsModule,
    PopOutComponent,
    CalloutModule,
  ],
  providers: [
    { provide: ViewPasswordHistoryService, useClass: BrowserViewPasswordHistoryService },
    { provide: PremiumUpgradePromptService, useClass: BrowserPremiumUpgradePromptService },
    { provide: ChangeLoginPasswordService, useClass: DefaultChangeLoginPasswordService },
  ],
})
export class ViewV2Component {
  private activeUserId: UserId;

  headerText: string;
  cipher: CipherView;
  organization$: Observable<Organization>;
  canDeleteCipher$: Observable<boolean>;
  collections$: Observable<CollectionView[]>;
  loadAction: LoadAction;
  senderTabId?: number;

  protected showFooter$: Observable<boolean>;

  constructor(
    private passwordRepromptService: PasswordRepromptService,
    private route: ActivatedRoute,
    private router: Router,
    private i18nService: I18nService,
    private cipherService: CipherService,
    private dialogService: DialogService,
    private logService: LogService,
    private toastService: ToastService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private accountService: AccountService,
    private eventCollectionService: EventCollectionService,
    private popupRouterCacheService: PopupRouterCacheService,
    protected cipherAuthorizationService: CipherAuthorizationService,
    private copyCipherFieldService: CopyCipherFieldService,
    private popupScrollPositionService: VaultPopupScrollPositionService,
  ) {
    this.subscribeToParams();
  }

  subscribeToParams(): void {
    this.route.queryParams
      .pipe(
        switchMap(async (params) => {
          this.loadAction = params.action;
          this.senderTabId = params.senderTabId ? parseInt(params.senderTabId, 10) : undefined;

          this.activeUserId = await firstValueFrom(
            this.accountService.activeAccount$.pipe(getUserId),
          );

          const cipher = await this.getCipherData(params.cipherId, this.activeUserId);
          this.headerText = this.setHeader(cipher.type);

          // Handling the load action needs to take place before setting `this.cipher`,
          // This is important for scenarios where the action requires a password re-prompt.
          // For those instances, no cipher details should be shown behind the re-prompt dialog until the password has been verified.
          if (this.loadAction) {
            const success = await this._handleLoadAction(this.loadAction, cipher, this.senderTabId);

            // When the action is not successful and the cipher has a reprompt enabled,
            // The cipher details can flash on the screen before the popout closes,
            // pass `null` to prevent this.
            if (
              [AUTOFILL_ID, COPY_PASSWORD_ID, COPY_VERIFICATION_CODE_ID].includes(
                this.loadAction,
              ) &&
              success === false &&
              cipher.reprompt !== CipherRepromptType.None
            ) {
              return null;
            }
          }

          return cipher;
        }),
        filterOutNullish(),
        switchMap(async (cipher) => {
          this.cipher = cipher;

          this.canDeleteCipher$ = this.cipherAuthorizationService.canDeleteCipher$(cipher);

          this.showFooter$ = of(
            cipher &&
              (!cipher.isDeleted ||
                (cipher.isDeleted && (cipher.permissions.restore || cipher.permissions.delete))),
          );

          await this.eventCollectionService.collect(
            EventType.Cipher_ClientViewed,
            cipher.id,
            false,
            cipher.organizationId,
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  setHeader(type: CipherType) {
    switch (type) {
      case CipherType.Login:
        return this.i18nService.t("viewItemHeader", this.i18nService.t("typeLogin"));
      case CipherType.Card:
        return this.i18nService.t("viewItemHeader", this.i18nService.t("typeCard"));
      case CipherType.Identity:
        return this.i18nService.t("viewItemHeader", this.i18nService.t("typeIdentity"));
      case CipherType.SecureNote:
        return this.i18nService.t("viewItemHeader", this.i18nService.t("note"));
      case CipherType.SshKey:
        return this.i18nService.t("viewItemHeader", this.i18nService.t("typeSshkey"));
    }
  }

  async getCipherData(id: string, userId: UserId) {
    return await firstValueFrom(
      this.cipherService.cipherViews$(userId).pipe(
        filterOutNullish(),
        map((ciphers) => ciphers.find((c) => c.id === id)),
      ),
    );
  }

  async editCipher() {
    if (this.cipher.isDeleted) {
      return false;
    }
    void this.router.navigate(["/edit-cipher"], {
      queryParams: { cipherId: this.cipher.id, type: this.cipher.type, isNew: false },
    });
    return true;
  }

  delete = async (): Promise<boolean> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: {
        key: this.cipher.isDeleted ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation",
      },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      await this.deleteCipher();
    } catch (e) {
      this.logService.error(e);
      return false;
    }

    this.popupScrollPositionService.stop(true);
    await this.popupRouterCacheService.back();

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(this.cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem"),
    });

    return true;
  };

  restore = async (): Promise<void> => {
    try {
      await this.cipherService.restoreWithServer(this.cipher.id, this.activeUserId);
    } catch (e) {
      this.logService.error(e);
    }

    await this.popupRouterCacheService.back();
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("restoredItem"),
    });
  };

  protected deleteCipher() {
    return this.cipher.isDeleted
      ? this.cipherService.deleteWithServer(this.cipher.id, this.activeUserId)
      : this.cipherService.softDeleteWithServer(this.cipher.id, this.activeUserId);
  }

  /**
   * Handles the load action for the view vault item popout. These actions are typically triggered
   * via the extension context menu. It is necessary to render the view for items that have password
   * reprompt enabled.
   * @param loadAction
   * @param cipher - The cipher being viewed, passed as a param because `this.cipher` may not be set yet.
   * @param senderTabId
   * @private
   */
  private async _handleLoadAction(
    loadAction: LoadAction,
    cipher: CipherView,
    senderTabId?: number,
  ): Promise<void | boolean> {
    let actionSuccess = false;

    switch (loadAction) {
      case SHOW_AUTOFILL_BUTTON:
        // This action simply shows the cipher view, no need to do anything.
        if (
          cipher.reprompt !== CipherRepromptType.None &&
          !(await this.passwordRepromptService.showPasswordPrompt())
        ) {
          await closeViewVaultItemPopout(`${VaultPopoutType.viewVaultItem}_${cipher.id}`);
        }
        return;
      case AUTOFILL_ID:
        actionSuccess = await this.vaultPopupAutofillService.doAutofill(cipher, false);
        break;
      case COPY_USERNAME_ID:
        actionSuccess = await this.copyCipherFieldService.copy(
          cipher.login.username,
          "username",
          cipher,
        );
        break;
      case COPY_PASSWORD_ID:
        actionSuccess = await this.copyCipherFieldService.copy(
          cipher.login.password,
          "password",
          cipher,
        );
        break;
      case COPY_VERIFICATION_CODE_ID:
        actionSuccess = await this.copyCipherFieldService.copy(cipher.login.totp, "totp", cipher);
        break;
      case UPDATE_PASSWORD: {
        const repromptSuccess = await this.passwordRepromptService.showPasswordPrompt();

        await sendExtensionMessage("bgHandleReprompt", {
          tab: await chrome.tabs.get(senderTabId),
          success: repromptSuccess,
        });

        await closeViewVaultItemPopout(`${VaultPopoutType.viewVaultItem}_${cipher.id}`);

        break;
      }
    }

    if (BrowserPopupUtils.inPopout(window)) {
      setTimeout(
        async () => {
          if (
            BrowserPopupUtils.inSingleActionPopout(window, VaultPopoutType.viewVaultItem) &&
            senderTabId
          ) {
            await BrowserApi.focusTab(senderTabId);
            await closeViewVaultItemPopout(`${VaultPopoutType.viewVaultItem}_${cipher.id}`);
          } else {
            await this.popupRouterCacheService.back();
          }
        },
        actionSuccess ? 1000 : 0,
      );
    }

    return actionSuccess;
  }
}
