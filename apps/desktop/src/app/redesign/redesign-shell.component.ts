import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ItemDetail, ItemSummary, VaultViewModelService } from "@klappstuhl/ui-bridge";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { map } from "rxjs";

import { KlsCommandPaletteComponent, PaletteAction } from "./command-palette.component";
import { KlsDetailPanelComponent } from "./detail-panel.component";
import { KlsItemListComponent } from "./item-list.component";
import { MOCK_ITEMS } from "./mock-data";
import { NavCategory, NavItem, KlsSidebarNavComponent } from "./sidebar-nav.component";

type ItemKind = "login" | "card" | "identity" | "note";

const KIND_BY_CATEGORY: Record<"logins" | "cards" | "identities" | "notes", ItemKind> = {
  logins: "login",
  cards: "card",
  identities: "identity",
  notes: "note",
};

@Component({
  selector: "kls-redesign-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlsSidebarNavComponent, KlsItemListComponent, KlsDetailPanelComponent, KlsCommandPaletteComponent],
  host: {
    class: "tw-flex tw-h-screen tw-w-screen tw-overflow-hidden tw-bg-bg-primary theme_dark",
    style: "font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11'",
  },
  template: `
    <kls-sidebar-nav
      [items]="navItems()"
      [active]="activeCategory()"
      (select)="onCategory($event)"
    />
    <kls-item-list
      [items]="filteredItems()"
      [selectedId]="selectedId()"
      [query]="query()"
      (queryChange)="query.set($event)"
      (select)="onSelectItem($event)"
    />
    <kls-detail-panel [item]="selectedDetail()" />

    @if (paletteOpen()) {
      <kls-command-palette
        (close)="paletteOpen.set(false)"
        (execute)="onPaletteAction($event)"
      />
    }
  `,
})
export class KlsRedesignShellComponent {
  private readonly vaultService = inject(VaultViewModelService);
  private readonly accountService = inject(AccountService);

  private readonly hasUser = toSignal(
    this.accountService.activeAccount$.pipe(map((a) => !!a)),
    { initialValue: false },
  );

  protected readonly activeCategory = signal<NavCategory>("all");
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

  protected readonly navItems = computed<NavItem[]>(() => {
    const all = this.liveItems();
    const count = (k: ItemKind) => all.filter((i) => i.kind === k).length;
    return [
      { key: "all", label: "All items", count: all.length },
      { key: "logins", label: "Logins", count: count("login") },
      { key: "cards", label: "Cards", count: count("card") },
      { key: "identities", label: "Identities", count: count("identity") },
      { key: "notes", label: "Secure notes", count: count("note") },
      { key: "favorites", label: "Favorites", count: all.filter((i) => i.favorite).length },
    ];
  });

  protected readonly filteredItems = computed<readonly ItemSummary[]>(() => {
    const cat = this.activeCategory();
    const q = this.query().trim().toLowerCase();
    return this.liveItems().filter((i) => {
      const matchesCat =
        cat === "all" ? true : cat === "favorites" ? i.favorite : i.kind === KIND_BY_CATEGORY[cat];
      if (!matchesCat) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        i.title.toLowerCase().includes(q) ||
        (i.subtitle?.toLowerCase().includes(q) ?? false)
      );
    });
  });

  constructor() {
    const firstId = this.filteredItems()[0]?.id;
    if (firstId) {
      this.selectedId.set(firstId);
      void this.loadDetail(firstId);
    }
  }

  @HostListener("document:keydown.meta.k", ["$event"])
  @HostListener("document:keydown.control.k", ["$event"])
  protected onOpenPalette(event: Event): void {
    event.preventDefault();
    this.paletteOpen.set(true);
  }

  protected onCategory(cat: NavCategory): void {
    this.activeCategory.set(cat);
    const firstId = this.filteredItems()[0]?.id;
    this.selectedId.set(firstId);
    if (firstId) {
      void this.loadDetail(firstId);
    } else {
      this.selectedDetail.set(undefined);
    }
  }

  protected onSelectItem(id: string): void {
    this.selectedId.set(id);
    void this.loadDetail(id);
  }

  protected onPaletteAction(action: PaletteAction): void {
    if (action.id.startsWith("nav:")) {
      const cat = action.id.replace("nav:", "") as NavCategory;
      this.onCategory(cat);
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
