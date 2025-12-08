// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { render } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { I18n } from "../../../content/components/common-types";
import { AtRiskNotification } from "../../../content/components/notification/at-risk-password/container";
import { NotificationConfirmationContainer } from "../../../content/components/notification/confirmation/container";
import { NotificationContainer } from "../../../content/components/notification/container";
import { selectedCipher as selectedCipherSignal } from "../../../content/components/signals/selected-cipher";
import { selectedFolder as selectedFolderSignal } from "../../../content/components/signals/selected-folder";
import { selectedVault as selectedVaultSignal } from "../../../content/components/signals/selected-vault";
import {
  NotificationBarIframeInitData,
  NotificationTaskInfo,
  NotificationType,
  NotificationTypes,
} from "../../../notification/abstractions/notification-bar";
import {
  getConfirmationHeaderMessage,
  getNotificationHeaderMessage,
  getNotificationTestId,
  getResolvedTheme,
  resolveNotificationType,
} from "../../../notification/notification-bar-helpers";
import { sendExtensionMessage, setElementStyles } from "../../../utils";
import {
  NotificationsExtensionMessage,
  OverlayNotificationsContentService as OverlayNotificationsContentServiceInterface,
  OverlayNotificationsExtensionMessageHandlers,
} from "../abstractions/overlay-notifications-content.service";

const notificationBarContainerStyles: Partial<CSSStyleDeclaration> = {
  height: "400px",
  width: "430px",
  maxWidth: "calc(100% - 20px)",
  minHeight: "initial",
  top: "10px",
  right: "0px",
  padding: "0",
  position: "fixed",
  zIndex: "2147483647",
  visibility: "visible",
  borderRadius: "4px",
  border: "none",
  backgroundColor: "transparent",
  overflow: "hidden",
  transition: "box-shadow 0.15s ease, transform 0.15s ease-out, opacity 0.15s ease",
  transitionDelay: "0.15s",
  transform: "translateX(100%)",
  opacity: "0",
};

const emotionStyleSelctor = "style[data-emotion], style[data-emotion-css]";
const validNotificationTypes = new Set([
  NotificationTypes.Add,
  NotificationTypes.Change,
  NotificationTypes.Unlock,
  NotificationTypes.AtRiskPassword,
]);

export class OverlayNotificationsContentService
  implements OverlayNotificationsContentServiceInterface
{
  private notificationBarRootElement: HTMLElement | null = null;
  private notificationBarElement: HTMLElement | null = null;
  private notificationBarShadowRoot: ShadowRoot | null = null;
  private currentNotificationBarType: NotificationType | null = null;
  private currentNotificationBarInitData: NotificationBarIframeInitData | null = null;
  private mutationObserver: MutationObserver | null = null;
  private foreignMutationsCount = 0;
  private mutationObserverIterations = 0;
  private mutationObserverIterationsResetTimeout: number | NodeJS.Timeout | null = null;
  private expectedContainerStyles: Partial<CSSStyleDeclaration> = {};
  private readonly defaultNotificationBarAttributes: Record<string, string> = {
    id: "bit-notification-bar",
  };

  private readonly extensionMessageHandlers: OverlayNotificationsExtensionMessageHandlers = {
    openNotificationBar: ({ message }) => this.handleOpenNotificationBarMessage(message),
    closeNotificationBar: ({ message }) => this.handleCloseNotificationBarMessage(message),
    saveCipherAttemptCompleted: ({ message }) =>
      this.handleSaveCipherAttemptCompletedMessage(message),
  };

  constructor() {
    void sendExtensionMessage("checkNotificationQueue");
  }

  /**
   * Returns the message handlers for the content script.
   */
  get messageHandlers() {
    return this.extensionMessageHandlers;
  }

  /**
   * Opens the notification bar with the provided init data. Will trigger a closure
   * of the notification bar if the type of the notification bar changes.
   *
   * @param message - The message containing the initialization data for the notification bar.
   */
  private async handleOpenNotificationBarMessage(message: NotificationsExtensionMessage) {
    if (message.command !== "openNotificationBar" || !message.data) {
      return;
    }
    const { type, typeData, params } = message.data;

    if (!validNotificationTypes.has(type as NotificationType)) {
      return;
    }

    if (this.currentNotificationBarType && type !== this.currentNotificationBarType) {
      this.closeNotificationBar();
    }

    const initData: NotificationBarIframeInitData = {
      type: type as NotificationType,
      isVaultLocked: typeData.isVaultLocked,
      theme: typeData.theme,
      removeIndividualVault: typeData.removeIndividualVault,
      importType: typeData.importType,
      launchTimestamp: typeData.launchTimestamp,
      params,
    };

    if (globalThis.document.readyState === "loading") {
      globalThis.document.addEventListener(
        "DOMContentLoaded",
        () => this.openNotificationBar(initData),
        { once: true },
      );
      return;
    }

    this.openNotificationBar(initData);
  }

  /**
   * Closes the notification bar. If the message contains a flag to fade out the notification,
   * the notification bar will fade out before being removed from the DOM.
   *
   * @param message - The message containing the data for closing the notification bar.
   */
  private handleCloseNotificationBarMessage(message: NotificationsExtensionMessage) {
    if (message.command !== "closeNotificationBar") {
      return;
    }
    const closedByUser =
      typeof message.data?.closedByUser === "boolean" ? message.data.closedByUser : true;
    if (message.data?.fadeOutNotification) {
      this.setContainerStyles({ opacity: "0" });
      globalThis.setTimeout(() => this.closeNotificationBar(closedByUser), 150);
      return;
    }

    this.closeNotificationBar(closedByUser);
  }

  private handleSaveCipherAttemptCompletedMessage(message: NotificationsExtensionMessage) {
    if (message.command !== "saveCipherAttemptCompleted") {
      return;
    }

    const { error, cipherId, task, itemName } = message.data || {};
    const validatedTask = this.validateTaskInfo(task);
    this.renderSaveCipherConfirmation(error, { cipherId, task: validatedTask, itemName });
  }

  private validateTaskInfo(
    task: NotificationTaskInfo | undefined,
  ): NotificationTaskInfo | undefined {
    if (!task || typeof task !== "object") {
      return undefined;
    }

    const orgName = typeof task.orgName === "string" ? task.orgName : undefined;
    const remainingTasksCount =
      typeof task.remainingTasksCount === "number" &&
      Number.isFinite(task.remainingTasksCount) &&
      task.remainingTasksCount >= 0
        ? task.remainingTasksCount
        : undefined;

    if (orgName === undefined || remainingTasksCount === undefined) {
      return undefined;
    }

    return { orgName, remainingTasksCount };
  }

  private openNotificationBar(initData: NotificationBarIframeInitData) {
    if (
      !this.notificationBarRootElement ||
      !globalThis.document.body.contains(this.notificationBarRootElement)
    ) {
      if (this.notificationBarRootElement) {
        this.closeNotificationBar();
      }
      this.createNotificationBarElement();
      globalThis.document.body.appendChild(this.notificationBarRootElement);
    }

    this.currentNotificationBarType = initData.type as NotificationType;
    this.prepareNotificationBarEntrance(initData);
    void this.renderNotificationBarContent(initData);
  }

  private async renderNotificationBarContent(initData: NotificationBarIframeInitData) {
    if (!this.notificationBarElement) {
      return;
    }

    this.currentNotificationBarInitData = initData;
    const { i18n, resolvedTheme, notificationType, headerMessage, notificationTestId } =
      this.getNotificationConfig(initData);
    const personalVaultDisallowed = Boolean(initData.removeIndividualVault);

    if (initData.isVaultLocked) {
      this.renderLockedNotification({
        initData,
        notificationType,
        headerMessage,
        notificationTestId,
        resolvedTheme,
        personalVaultDisallowed,
        i18n,
      });
      return;
    }

    if (initData.type === NotificationTypes.AtRiskPassword) {
      this.renderContent(
        AtRiskNotification({
          ...initData,
          type: notificationType,
          theme: resolvedTheme,
          i18n,
          notificationTestId,
          params: initData.params,
          handleCloseNotification: this.handleCloseNotification,
        }),
      );
      return;
    }

    const orgId = selectedVaultSignal.get();
    const [organizations, folders, ciphers, collections] = await Promise.all([
      sendExtensionMessage("bgGetOrgData"),
      sendExtensionMessage("bgGetFolderData"),
      sendExtensionMessage("bgGetDecryptedCiphers"),
      sendExtensionMessage("bgGetCollectionData", { orgId }),
    ]);

    this.currentNotificationBarInitData = {
      ...initData,
      organizations,
      folders,
      ciphers,
      collections,
    };

    this.renderContent(
      NotificationContainer({
        ...this.currentNotificationBarInitData,
        headerMessage,
        type: notificationType,
        theme: resolvedTheme,
        notificationTestId,
        personalVaultIsAllowed: !personalVaultDisallowed,
        handleCloseNotification: this.handleCloseNotification,
        handleSaveAction: this.handleSaveAction,
        handleEditOrUpdateAction: this.handleEditOrUpdateAction,
        i18n,
      }),
    );
  }

  private renderContent(template: Parameters<typeof render>[0]) {
    if (!this.notificationBarElement) {
      return;
    }
    render(template, this.notificationBarElement);
    this.syncEmotionStyles();
  }

  private getNotificationConfig(initData: NotificationBarIframeInitData) {
    const i18n = this.getI18n();
    const resolvedTheme = getResolvedTheme((initData.theme ?? ThemeTypes.Light) as Theme);
    const notificationType = resolveNotificationType(initData);
    const headerMessage = getNotificationHeaderMessage(i18n, notificationType);
    const notificationTestId = getNotificationTestId(notificationType);
    return { i18n, resolvedTheme, notificationType, headerMessage, notificationTestId };
  }

  private renderLockedNotification({
    initData,
    notificationType,
    headerMessage,
    notificationTestId,
    resolvedTheme,
    personalVaultDisallowed,
    i18n,
  }: {
    initData: NotificationBarIframeInitData;
    notificationType: NotificationType;
    headerMessage?: string;
    notificationTestId: string;
    resolvedTheme: Theme;
    personalVaultDisallowed: boolean;
    i18n: I18n;
  }) {
    if (!this.notificationBarElement) {
      return;
    }

    const notificationConfig = {
      ...initData,
      headerMessage,
      type: notificationType,
      theme: resolvedTheme,
      notificationTestId,
      personalVaultIsAllowed: !personalVaultDisallowed,
      handleCloseNotification: this.handleCloseNotification,
      handleEditOrUpdateAction: this.handleEditOrUpdateAction,
      i18n,
    };

    const handleSaveAction = () => {
      this.sendSaveCipherMessage(null, true);
      this.renderContent(
        NotificationContainer({
          ...notificationConfig,
          handleSaveAction: () => {},
          isLoading: true,
        }),
      );
    };

    this.renderContent(
      NotificationContainer({
        ...notificationConfig,
        handleSaveAction,
      }),
    );
  }

  private renderSaveCipherConfirmation(
    error?: string,
    data?: { cipherId?: string; task?: NotificationTaskInfo; itemName?: string },
  ) {
    if (!this.notificationBarElement || !this.currentNotificationBarInitData) {
      return;
    }

    const { i18n, resolvedTheme } = this.getNotificationConfig(this.currentNotificationBarInitData);
    const resolvedType = resolveNotificationType(this.currentNotificationBarInitData);
    const headerMessage = getConfirmationHeaderMessage(i18n, resolvedType, error);
    const notificationTestId = getNotificationTestId(resolvedType, true);

    globalThis.setTimeout(() => {
      void sendExtensionMessage("bgCloseNotificationBar");
    }, 5000);

    this.renderContent(
      NotificationConfirmationContainer({
        ...this.currentNotificationBarInitData,
        error,
        headerMessage,
        theme: resolvedTheme,
        notificationTestId,
        task: data?.task,
        itemName: data?.itemName ?? i18n.typeLogin,
        handleCloseNotification: this.handleCloseNotification,
        handleOpenTasks: () => {
          void sendExtensionMessage("bgOpenAtRiskPasswords");
        },
        handleOpenVault: (event: Event) => {
          if (data?.cipherId) {
            this.openViewVaultItemPopout(data.cipherId);
            return;
          }
          this.openAddEditVaultItemPopout(event);
        },
        i18n,
        type: this.currentNotificationBarInitData.type as NotificationType,
      }),
    );
  }

  private createNotificationBarElement() {
    this.notificationBarRootElement = globalThis.document.createElement(
      "bit-notification-bar-root",
    );
    this.notificationBarShadowRoot = this.notificationBarRootElement.attachShadow({
      mode: "closed",
      delegatesFocus: true,
    });

    this.notificationBarElement = globalThis.document.createElement("div");
    this.notificationBarElement.id = "bit-notification-bar";
    this.expectedContainerStyles = { ...notificationBarContainerStyles };
    this.updateElementStyles(this.notificationBarElement, this.expectedContainerStyles);
    this.notificationBarShadowRoot.appendChild(this.notificationBarElement);
    this.mutationObserver = new MutationObserver(this.handleMutations);
    this.observeNotificationBar();
    this.syncEmotionStyles();
  }

  private syncEmotionStyles() {
    if (!this.notificationBarShadowRoot) {
      return;
    }

    const existingStyle = this.notificationBarShadowRoot.querySelector(
      "style[data-bit-notification-styles]",
    );
    if (existingStyle) {
      existingStyle.remove();
    }

    const emotionStyles = globalThis.document.head.querySelectorAll(emotionStyleSelctor);
    const combinedCSS = Array.from(emotionStyles)
      .map((styleElement) => styleElement.textContent)
      .filter((text): text is string => Boolean(text))
      .join("\n");

    if (combinedCSS) {
      const combinedStyle = globalThis.document.createElement("style");
      combinedStyle.setAttribute("data-bit-notification-styles", "true");
      combinedStyle.textContent = combinedCSS;
      this.notificationBarShadowRoot.prepend(combinedStyle);
    }
  }

  private prepareNotificationBarEntrance(initData: NotificationBarIframeInitData) {
    const isFresh = Boolean(
      initData.launchTimestamp && Date.now() - initData.launchTimestamp < 250,
    );

    if (isFresh) {
      this.setContainerStyles({ transform: "translateX(100%)", opacity: "1" });
      requestAnimationFrame(() => this.setContainerStyles({ transform: "translateX(0)" }));
      return;
    }

    this.setContainerStyles({ transform: "translateX(0)", opacity: "1" });
  }

  private setContainerStyles(styles: Partial<CSSStyleDeclaration>) {
    if (!this.notificationBarElement) {
      return;
    }

    this.expectedContainerStyles = { ...this.expectedContainerStyles, ...styles };
    this.updateElementStyles(this.notificationBarElement, this.expectedContainerStyles);
  }

  private updateElementStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
    if (!element) {
      return;
    }

    this.unobserveNotificationBar();
    setElementStyles(element, styles, true);
    this.observeNotificationBar();
  }

  private handleMutations = (mutations: MutationRecord[]) => {
    if (this.isTriggeringExcessiveMutationObserverIterations() || !this.notificationBarElement) {
      return;
    }

    for (const mutation of mutations) {
      if (mutation.type !== "attributes") {
        continue;
      }

      const element = mutation.target as HTMLElement;
      if (mutation.attributeName === "style") {
        this.notificationBarElement.removeAttribute("style");
        this.updateElementStyles(this.notificationBarElement, this.expectedContainerStyles);
      } else {
        this.handleElementAttributeMutation(element);
      }
    }
  };

  private handleElementAttributeMutation(element: HTMLElement) {
    if (!this.notificationBarElement || this.foreignMutationsCount >= 10) {
      if (this.foreignMutationsCount >= 10) {
        this.forceCloseNotificationBar();
      }
      return;
    }

    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name === "style") {
        continue;
      }

      const expected = this.defaultNotificationBarAttributes[attribute.name];
      if (!expected) {
        this.notificationBarElement.removeAttribute(attribute.name);
        this.foreignMutationsCount++;
      } else if (attribute.value !== expected) {
        this.notificationBarElement.setAttribute(attribute.name, expected);
        this.foreignMutationsCount++;
      }
    }
  }

  private observeNotificationBar() {
    if (!this.mutationObserver || !this.notificationBarElement) {
      return;
    }

    this.mutationObserver.observe(this.notificationBarElement, { attributes: true });
  }

  private unobserveNotificationBar() {
    this.mutationObserver?.disconnect();
  }

  private isTriggeringExcessiveMutationObserverIterations() {
    if (this.mutationObserverIterationsResetTimeout) {
      clearTimeout(this.mutationObserverIterationsResetTimeout);
    }

    this.mutationObserverIterations++;
    this.mutationObserverIterationsResetTimeout = globalThis.setTimeout(() => {
      this.mutationObserverIterations = 0;
      this.foreignMutationsCount = 0;
    }, 2000);

    if (this.mutationObserverIterations > 20) {
      clearTimeout(this.mutationObserverIterationsResetTimeout);
      this.mutationObserverIterations = 0;
      this.foreignMutationsCount = 0;
      this.forceCloseNotificationBar();
      return true;
    }

    return false;
  }

  private forceCloseNotificationBar() {
    this.closeNotificationBar(true);
  }

  private handleCloseNotification = (event?: Event) => {
    event?.preventDefault();
    void sendExtensionMessage("bgCloseNotificationBar", { fadeOutNotification: true });
  };

  private handleEditOrUpdateAction = (event: Event) => {
    event.preventDefault();
    const currentType = this.currentNotificationBarInitData
      ? resolveNotificationType(this.currentNotificationBarInitData)
      : NotificationTypes.Change;
    this.sendSaveCipherMessage(selectedCipherSignal.get(), currentType === NotificationTypes.Add);
  };

  private handleSaveAction = (event: Event) => {
    const selectedCipher = selectedCipherSignal.get();
    const selectedVault = selectedVaultSignal.get();
    const selectedFolder = selectedFolderSignal.get();

    if (selectedVault.length > 1) {
      this.openAddEditVaultItemPopout(event, {
        organizationId: selectedVault,
        ...(selectedFolder?.length > 1 ? { folder: selectedFolder } : {}),
      });
      this.handleCloseNotification(event);
      return;
    }

    event.preventDefault();
    const disallowPersonalVault = Boolean(
      this.currentNotificationBarInitData?.removeIndividualVault,
    );
    this.sendSaveCipherMessage(selectedCipher, disallowPersonalVault, selectedFolder);
    if (disallowPersonalVault) {
      return;
    }
  };

  private sendSaveCipherMessage(cipherId: string | null, edit: boolean, folder?: string) {
    void sendExtensionMessage("bgSaveCipher", {
      cipherId,
      folder,
      edit,
    });
  }

  private openAddEditVaultItemPopout(
    event: Event,
    options: { cipherId?: string; organizationId?: string; folder?: string } = {},
  ) {
    event.preventDefault();
    void sendExtensionMessage("bgOpenAddEditVaultItemPopout", options);
  }

  private openViewVaultItemPopout(cipherId: string) {
    void sendExtensionMessage("bgOpenViewVaultItemPopout", { cipherId });
  }

  private closeNotificationBar(closedByUserAction: boolean = false) {
    if (!this.notificationBarRootElement) {
      return;
    }

    const removableNotificationTypes = new Set([
      NotificationTypes.Add,
      NotificationTypes.Change,
      NotificationTypes.AtRiskPassword,
    ] as NotificationType[]);
    const shouldNotifyQueue =
      closedByUserAction && removableNotificationTypes.has(this.currentNotificationBarType);

    this.unobserveNotificationBar();
    this.mutationObserver = null;

    if (this.mutationObserverIterationsResetTimeout) {
      clearTimeout(this.mutationObserverIterationsResetTimeout);
      this.mutationObserverIterationsResetTimeout = null;
    }

    this.notificationBarElement?.remove();
    this.notificationBarElement = null;
    this.notificationBarShadowRoot = null;
    this.notificationBarRootElement.remove();
    this.notificationBarRootElement = null;
    this.currentNotificationBarInitData = null;
    this.expectedContainerStyles = {};

    if (shouldNotifyQueue) {
      void sendExtensionMessage("bgRemoveTabFromNotificationQueue");
    }

    this.currentNotificationBarType = null;
  }

  destroy() {
    this.closeNotificationBar(true);
  }

  private getI18n(): I18n {
    return {
      atRiskPassword: chrome.i18n.getMessage("atRiskPassword"),
      changePassword: chrome.i18n.getMessage("changePassword"),
      close: chrome.i18n.getMessage("close"),
      collection: chrome.i18n.getMessage("collection"),
      folder: chrome.i18n.getMessage("folder"),
      loginSaveSuccess: chrome.i18n.getMessage("loginSaveSuccess"),
      loginUpdateSuccess: chrome.i18n.getMessage("loginUpdateSuccess"),
      myVault: chrome.i18n.getMessage("myVault"),
      newItem: chrome.i18n.getMessage("newItem"),
      nextSecurityTaskAction: chrome.i18n.getMessage("nextSecurityTaskAction"),
      notificationLoginSaveConfirmation: chrome.i18n.getMessage(
        "notificationLoginSaveConfirmation",
      ),
      notificationLoginUpdatedConfirmation: chrome.i18n.getMessage(
        "notificationLoginUpdatedConfirmation",
      ),
      notificationNewItemAria: chrome.i18n.getMessage("notificationNewItemAria"),
      notificationUnlock: chrome.i18n.getMessage("notificationUnlock"),
      notificationUpdate: chrome.i18n.getMessage("notificationChangeSave"),
      saveAction: chrome.i18n.getMessage("notificationAddSave"),
      saveFailure: chrome.i18n.getMessage("saveFailure"),
      saveFailureDetails: chrome.i18n.getMessage("saveFailureDetails"),
      saveLogin: chrome.i18n.getMessage("saveLogin"),
      typeLogin: chrome.i18n.getMessage("typeLogin"),
      unlockToSave: chrome.i18n.getMessage("unlockToSave"),
      updateLogin: chrome.i18n.getMessage("updateLogin"),
      vault: chrome.i18n.getMessage("vault"),
      view: chrome.i18n.getMessage("view"),
    };
  }
}
