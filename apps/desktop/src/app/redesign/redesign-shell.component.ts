import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import {
  CollectionSummary,
  CopyBridgeService,
  FolderSummary,
  ItemDetail,
  ItemSummary,
  LockBridgeService,
  VaultViewModelService,
} from "@klappstuhl/ui-bridge";
import { map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  CipherFormConfigService,
  DefaultCipherFormConfigService,
  VaultItemDialogComponent,
} from "@bitwarden/vault";

import { AccountSwitcherV2Component } from "../../auth/components/account-switcher/account-switcher-v2.component";
import { ExportDesktopComponent } from "../tools/export/export-desktop.component";
import { CredentialGeneratorComponent } from "../tools/generator/credential-generator.component";
import { ImportDesktopComponent } from "../tools/import/import-desktop.component";

import { KlsCommandPaletteComponent, PaletteAction } from "./command-palette.component";
import { KlsDetailPanelComponent } from "./detail-panel.component";
import { KlsItemListComponent } from "./item-list.component";
import { MOCK_ITEMS } from "./mock-data";
import { QuickAccessRendererService } from "./quick-access-renderer.service";
import { NavCategory, NavItem, KlsSidebarNavComponent } from "./sidebar-nav.component";

type ItemKind = "login" | "card" | "identity" | "note" | "sshKey";

const KIND_BY_CATEGORY: Record<string, ItemKind> = {
  logins: "login",
  cards: "card",
  identities: "identity",
  notes: "note",
  sshKeys: "sshKey",
};

const CIPHER_TYPE_BY_CATEGORY: Record<string, CipherType> = {
  logins: CipherType.Login,
  cards: CipherType.Card,
  identities: CipherType.Identity,
  notes: CipherType.SecureNote,
  sshKeys: CipherType.SshKey,
};

@Component({
  selector: "kls-redesign-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlsSidebarNavComponent,
    KlsItemListComponent,
    KlsDetailPanelComponent,
    KlsCommandPaletteComponent,
    AccountSwitcherV2Component,
  ],
  // FORK (klappstuhl): the redesign shell replaces /vault, so it must supply the
  // same cipher-form config service the vault used to provide for the add dialog.
  providers: [{ provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService }],
  host: {
    class: "tw-flex tw-h-screen tw-w-screen tw-flex-col tw-overflow-hidden tw-bg-bg-primary",
    style: "font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11'",
  },
  styles: [
    `
      :host {
        --scrollbar-thumb: rgb(255 255 255 / 0.12);
        --scrollbar-track: transparent;
      }
      :host ::ng-deep ::-webkit-scrollbar {
        width: 6px;
      }
      :host ::ng-deep ::-webkit-scrollbar-track {
        background: var(--scrollbar-track);
      }
      :host ::ng-deep ::-webkit-scrollbar-thumb {
        background: var(--scrollbar-thumb);
        border-radius: 3px;
      }
      :host ::ng-deep ::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.2);
      }
    `,
  ],
  template: `
    <!-- Window drag region (blends with native menu bar) -->
    <div
      class="tw-flex tw-h-8 tw-w-full tw-shrink-0 tw-items-center tw-justify-end tw-px-3"
      style="-webkit-app-region: drag; background-color: var(--fk-sidebar-bg); border-bottom: var(--fk-glass-border)"
    ></div>

    <div class="tw-flex tw-min-h-0 tw-flex-1">
      <kls-sidebar-nav
        [items]="navItems()"
        [active]="activeCategory()"
        [folders]="folders()"
        [collections]="collections()"
        [activeFolder]="activeFolder()"
        [activeCollection]="activeCollection()"
        (select)="onCategory($event)"
        (selectFolder)="onFolder($event)"
        (selectCollection)="onCollection($event)"
        (newItem)="onNewItem()"
        (openGenerator)="onOpenGenerator()"
        (openImport)="onOpenImport()"
        (openExport)="onOpenExport()"
        (openSettings)="onOpenSettings()"
      >
        <app-account-switcher-v2 account-switcher />
      </kls-sidebar-nav>
      <kls-item-list
        [items]="filteredItems()"
        [selectedId]="selectedId()"
        [query]="query()"
        (queryChange)="query.set($event)"
        (select)="onSelectItem($event)"
        (quickCopyTotp)="onQuickCopyTotp($event)"
      />
      <kls-detail-panel [item]="selectedDetail()" (saved)="onDetailSaved()" />

      @if (paletteOpen()) {
        <kls-command-palette (close)="paletteOpen.set(false)" (execute)="onPaletteAction($event)" />
      }
    </div>
  `,
})
export class KlsRedesignShellComponent {
  private readonly vaultService = inject(VaultViewModelService);
  private readonly accountService = inject(AccountService);
  private readonly copyService = inject(CopyBridgeService);
  private readonly lockService = inject(LockBridgeService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly messagingService = inject(MessagingService);
  private readonly cipherFormConfigService = inject(CipherFormConfigService);
  private readonly quickAccess = inject(QuickAccessRendererService);
  private readonly logService = inject(LogService);
  private readonly toastService = inject(ToastService);

  private readonly hasUser = toSignal(this.accountService.activeAccount$.pipe(map((a) => !!a)), {
    initialValue: false,
  });

  protected readonly activeCategory = signal<NavCategory>("all");
  protected readonly activeFolder = signal<string | undefined>(undefined);
  protected readonly activeCollection = signal<string | undefined>(undefined);
  protected readonly query = signal<string>("");
  protected readonly selectedId = signal<string | undefined>(undefined);
  protected readonly selectedDetail = signal<ItemDetail | undefined>(undefined);
  protected readonly paletteOpen = signal(false);

  private readonly liveItems = computed<readonly ItemSummary[]>(() => {
    if (this.hasUser()) {
      return this.vaultService.items();
    }
    return MOCK_ITEMS;
  });

  protected readonly folders = computed<readonly FolderSummary[]>(() => {
    if (this.hasUser()) {
      return this.vaultService.folders();
    }
    return [];
  });

  protected readonly collections = computed<readonly CollectionSummary[]>(() => {
    if (this.hasUser()) {
      return this.vaultService.collections();
    }
    return [];
  });

  protected readonly trashedItems = computed<readonly ItemSummary[]>(() => {
    if (this.hasUser()) {
      return this.vaultService.trashedItems();
    }
    return [];
  });

  protected readonly navItems = computed<NavItem[]>(() => {
    const all = this.liveItems();
    const count = (k: ItemKind) => all.filter((i) => i.kind === k).length;
    return [
      { key: "all", label: this.i18n.t("allItems") || "All items", count: all.length },
      { key: "logins", label: this.i18n.t("logins") || "Logins", count: count("login") },
      { key: "cards", label: this.i18n.t("cards") || "Cards", count: count("card") },
      {
        key: "identities",
        label: this.i18n.t("identities") || "Identities",
        count: count("identity"),
      },
      { key: "notes", label: this.i18n.t("secureNotes") || "Secure notes", count: count("note") },
      { key: "sshKeys", label: this.i18n.t("sshKeys") || "SSH Keys", count: count("sshKey") },
      {
        key: "favorites",
        label: this.i18n.t("favorites") || "Favorites",
        count: all.filter((i) => i.favorite).length,
      },
      {
        key: "trash",
        label: this.i18n.t("trash") || "Trash",
        count: this.trashedItems().length,
      },
    ];
  });

  protected readonly filteredItems = computed<readonly ItemSummary[]>(() => {
    const cat = this.activeCategory();
    const folderId = this.activeFolder();
    const collectionId = this.activeCollection();
    const q = this.query().trim().toLowerCase();

    if (cat === "trash") {
      return this.trashedItems().filter((i) => {
        if (!q) {
          return true;
        }
        return (
          i.title.toLowerCase().includes(q) || (i.subtitle?.toLowerCase().includes(q) ?? false)
        );
      });
    }

    return this.liveItems().filter((i) => {
      if (collectionId) {
        if (!i.tagIds.includes(collectionId)) {
          return false;
        }
      } else if (folderId) {
        if (i.folderId !== folderId) {
          return false;
        }
      } else {
        const matchesCat =
          cat === "all"
            ? true
            : cat === "favorites"
              ? i.favorite
              : i.kind === KIND_BY_CATEGORY[cat];
        if (!matchesCat) {
          return false;
        }
      }
      if (!q) {
        return true;
      }
      return i.title.toLowerCase().includes(q) || (i.subtitle?.toLowerCase().includes(q) ?? false);
    });
  });

  constructor() {
    effect(() => {
      const items = this.filteredItems();
      if (items.length > 0 && !this.selectedId()) {
        this.selectedId.set(items[0].id);
        void this.loadDetail(items[0].id);
      }
    });

    // Quick Access spotlight: the standalone Ctrl/Cmd+Shift+Space window (managed
    // by the main process) searches/copies through this renderer, since the
    // decrypted vault lives here. Wiring it up from the shell keeps it bound to
    // the logged-in session.
    this.quickAccess.init();
  }

  @HostListener("document:keydown.meta.k", ["$event"])
  @HostListener("document:keydown.control.k", ["$event"])
  protected onOpenPalette(event: Event): void {
    event.preventDefault();
    this.paletteOpen.set(true);
  }

  @HostListener("document:keydown.arrowdown", ["$event"])
  protected onArrowDown(event: Event): void {
    if (this.paletteOpen()) {
      return;
    }
    event.preventDefault();
    this.moveSelection(1);
  }

  @HostListener("document:keydown.arrowup", ["$event"])
  protected onArrowUp(event: Event): void {
    if (this.paletteOpen()) {
      return;
    }
    event.preventDefault();
    this.moveSelection(-1);
  }

  @HostListener("document:keydown.control.c", ["$event"])
  @HostListener("document:keydown.meta.c", ["$event"])
  protected onCopyPassword(event: Event): void {
    if (this.paletteOpen() || !this.selectedId()) {
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      return;
    }
    event.preventDefault();
    void this.copyService.copyPassword(this.selectedId()!);
  }

  @HostListener("document:keydown.control.shift.c", ["$event"])
  @HostListener("document:keydown.meta.shift.c", ["$event"])
  protected onCopyUsername(event: Event): void {
    if (this.paletteOpen() || !this.selectedId()) {
      return;
    }
    event.preventDefault();
    void this.copyService.copyUsername(this.selectedId()!);
  }

  @HostListener("document:keydown./")
  protected onFocusSearch(): void {}

  protected onCategory(cat: NavCategory): void {
    this.activeCategory.set(cat);
    this.activeFolder.set(undefined);
    this.activeCollection.set(undefined);
    this.selectedId.set(undefined);
    this.selectedDetail.set(undefined);
  }

  protected onFolder(folderId: string): void {
    this.activeFolder.set(folderId);
    this.activeCollection.set(undefined);
    this.activeCategory.set("all");
    this.selectedId.set(undefined);
    this.selectedDetail.set(undefined);
  }

  protected onCollection(collectionId: string): void {
    this.activeCollection.set(collectionId);
    this.activeFolder.set(undefined);
    this.activeCategory.set("all");
    this.selectedId.set(undefined);
    this.selectedDetail.set(undefined);
  }

  protected onSelectItem(id: string): void {
    this.selectedId.set(id);
    void this.loadDetail(id);
  }

  protected onPaletteAction(action: PaletteAction): void {
    if (action.id.startsWith("nav:")) {
      const cat = action.id.replace("nav:", "") as NavCategory;
      this.onCategory(cat);
    } else if (action.id === "act:lock") {
      void this.lockService.lock();
    } else if (action.id === "act:generator") {
      this.onOpenGenerator();
    }
  }

  protected onQuickCopyTotp(cipherId: string): void {
    void this.copyService.copyTotp(cipherId);
  }

  protected onDetailSaved(): void {
    const id = this.selectedId();
    if (id) {
      void this.loadDetail(id);
    }
  }

  protected onNewItem(): void {
    void this.openAddDialog();
  }

  // Opens the standard add-cipher drawer (same path the old vault used). All
  // persistence still flows through core's CipherService via the dialog — the
  // shell never builds API payloads or touches crypto. Errors are surfaced
  // (logged + toast) so the button never silently does nothing.
  private async openAddDialog(): Promise<void> {
    try {
      const cipherType = CIPHER_TYPE_BY_CATEGORY[this.activeCategory()] ?? CipherType.Login;
      const formConfig = await this.cipherFormConfigService.buildConfig(
        "add",
        undefined,
        cipherType,
      );
      await VaultItemDialogComponent.openDrawer(this.dialogService, {
        mode: "form",
        formConfig,
      });
    } catch (e) {
      this.logService.error("Quick add: failed to open the add-item dialog", e);
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18n.t("unexpectedError") || "Could not open the new item form.",
      });
    }
  }

  protected onOpenGenerator(): void {
    this.dialogService.open(CredentialGeneratorComponent);
  }

  protected onOpenImport(): void {
    this.dialogService.open(ImportDesktopComponent);
  }

  protected onOpenExport(): void {
    this.dialogService.open(ExportDesktopComponent);
  }

  protected onOpenSettings(): void {
    this.messagingService.send("openSettings");
  }

  private moveSelection(delta: number): void {
    const items = this.filteredItems();
    const currentIdx = items.findIndex((i) => i.id === this.selectedId());
    const nextIdx = Math.max(0, Math.min(items.length - 1, currentIdx + delta));
    const nextId = items[nextIdx]?.id;
    if (nextId && nextId !== this.selectedId()) {
      this.onSelectItem(nextId);
    }
  }

  private async loadDetail(id: string): Promise<void> {
    if (this.hasUser()) {
      try {
        const detail = await this.vaultService.getDetail(id);
        this.selectedDetail.set(detail);
      } catch {
        this.selectedDetail.set(undefined);
      }
    } else {
      const mock = MOCK_ITEMS.find((i) => i.id === id);
      this.selectedDetail.set(mock);
    }
  }
}
