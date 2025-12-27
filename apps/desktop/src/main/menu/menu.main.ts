import { app, Menu, MenuItemConstructorOptions } from "electron";
import { firstValueFrom } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import {
  APPLICATION_MENU_KEY,
  SerializableMenu,
  SerializableMenuItem,
} from "@bitwarden/desktop-ui";

import { VersionMain } from "../../platform/main/version.main";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { UpdaterMain } from "../updater.main";
import { WindowMain } from "../window.main";

import { MenuUpdateRequest } from "./menu.updater";
import { Menubar } from "./menubar";

const cloudWebVaultUrl = "https://vault.bitwarden.com";

export class MenuMain {
  private currentMenubar: Menubar | null = null;
  private menuState = this.globalStateProvider.get(APPLICATION_MENU_KEY);

  constructor(
    private i18nService: I18nService,
    private messagingService: MessagingService,
    private environmentService: EnvironmentService,
    private windowMain: WindowMain,
    private updaterMain: UpdaterMain,
    private desktopSettingsService: DesktopSettingsService,
    private versionMain: VersionMain,
    private globalStateProvider: GlobalStateProvider,
  ) {}

  async init() {
    this.initContextMenu();
    await this.setMenu();
  }

  async updateApplicationMenuState(updateRequest: MenuUpdateRequest) {
    await this.setMenu(updateRequest);
  }

  private async setMenu(updateRequest?: MenuUpdateRequest) {
    this.currentMenubar = new Menubar(
      this.i18nService,
      this.messagingService,
      this.desktopSettingsService,
      this.updaterMain,
      this.windowMain,
      await this.getWebVaultUrl(),
      app.getVersion(),
      await firstValueFrom(this.desktopSettingsService.hardwareAcceleration$),
      this.versionMain,
      updateRequest,
    );
    Menu.setApplicationMenu(this.currentMenubar.menu);

    // Update the state with the serialized menu structure
    const serializedMenus = this.currentMenubar.items.map((menu) => ({
      id: menu.id,
      label: menu.label,
      visible: menu.visible ?? true,
      items: this.convertMenuItems(menu.items),
    }));
    await this.menuState.update(() => serializedMenus);
  }

  private async getWebVaultUrl() {
    const env = await firstValueFrom(this.environmentService.environment$);
    return env.getWebVaultUrl() ?? cloudWebVaultUrl;
  }

  private initContextMenu() {
    if (this.windowMain.win == null) {
      return;
    }

    const selectionMenu = Menu.buildFromTemplate([
      {
        label: this.i18nService.t("copy"),
        role: "copy",
      },
      { type: "separator" },
      {
        label: this.i18nService.t("selectAll"),
        role: "selectAll",
      },
    ]);

    const inputMenu = Menu.buildFromTemplate([
      {
        label: this.i18nService.t("undo"),
        role: "undo",
      },
      {
        label: this.i18nService.t("redo"),
        role: "redo",
      },
      { type: "separator" },
      {
        label: this.i18nService.t("cut"),
        role: "cut",
        enabled: false,
      },
      {
        label: this.i18nService.t("copy"),
        role: "copy",
        enabled: false,
      },
      {
        label: this.i18nService.t("paste"),
        role: "paste",
      },
      { type: "separator" },
      {
        label: this.i18nService.t("selectAll"),
        role: "selectAll",
      },
    ]);

    const inputSelectionMenu = Menu.buildFromTemplate([
      {
        label: this.i18nService.t("cut"),
        role: "cut",
      },
      {
        label: this.i18nService.t("copy"),
        role: "copy",
      },
      {
        label: this.i18nService.t("paste"),
        role: "paste",
      },
      { type: "separator" },
      {
        label: this.i18nService.t("selectAll"),
        role: "selectAll",
      },
    ]);

    this.windowMain.win.webContents.on("context-menu", (e, props) => {
      const selected = props.selectionText && props.selectionText.trim() !== "";
      if (props.isEditable && selected) {
        inputSelectionMenu.popup({ window: this.windowMain.win });
      } else if (props.isEditable) {
        inputMenu.popup({ window: this.windowMain.win });
      } else if (selected) {
        selectionMenu.popup({ window: this.windowMain.win });
      }
    });
  }

  private convertMenuItems(items: MenuItemConstructorOptions[]): SerializableMenuItem[] {
    return items
      .map((item): SerializableMenuItem | null => {
        // Skip items that shouldn't be visible
        if (item.visible === false) {
          return null;
        }

        // Filter supported types, default to "normal"
        const supportedTypes = ["normal", "separator", "submenu", "checkbox", "radio"];
        const menuType =
          item.type && supportedTypes.includes(item.type) ? item.type : "normal";

        const serializedItem: SerializableMenuItem = {
          id: item.id,
          label: item.label,
          type: menuType as "normal" | "separator" | "submenu" | "checkbox" | "radio",
          enabled: item.enabled ?? true, // Default to true if not specified
          visible: item.visible ?? true, // Default to true if not specified
          checked: item.checked,
          accelerator: item.accelerator,
          role: item.role,
        };

        // Recursively convert submenu items
        if (item.submenu && Array.isArray(item.submenu)) {
          serializedItem.submenu = this.convertMenuItems(item.submenu);
        }

        return serializedItem;
      })
      .filter((item): item is SerializableMenuItem => item !== null);
  }
}
