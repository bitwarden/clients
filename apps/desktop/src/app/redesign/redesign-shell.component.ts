import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { ItemDetail, ItemKind } from "@klappstuhl/ui-bridge";

import { KlsDetailPanelComponent } from "./detail-panel.component";
import { KlsItemListComponent } from "./item-list.component";
import { MOCK_ITEMS } from "./mock-data";
import { NavCategory, NavItem, KlsSidebarNavComponent } from "./sidebar-nav.component";

const KIND_BY_CATEGORY: Record<"logins" | "cards" | "identities" | "notes", ItemKind> = {
  logins: "login",
  cards: "card",
  identities: "identity",
  notes: "note",
};

/**
 * Redesign preview shell: sidebar + split-pane (list + detail) wired to mock
 * data via signals. Mounted on the `/redesign` route so it can be viewed in
 * isolation without disturbing the production vault. The data source is swapped
 * for @klappstuhl/ui-bridge's VaultViewModelService in the bridge phase.
 */
@Component({
  selector: "kls-redesign-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KlsSidebarNavComponent, KlsItemListComponent, KlsDetailPanelComponent],
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
      (select)="selectedId.set($event)"
    />
    <kls-detail-panel [item]="selectedDetail()" />
  `,
})
export class KlsRedesignShellComponent {
  protected readonly activeCategory = signal<NavCategory>("all");
  protected readonly query = signal<string>("");
  protected readonly selectedId = signal<string | undefined>(MOCK_ITEMS[0]?.id);

  private readonly allItems = signal<ItemDetail[]>(MOCK_ITEMS);

  protected readonly navItems = computed<NavItem[]>(() => {
    const all = this.allItems();
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

  protected readonly filteredItems = computed<ItemDetail[]>(() => {
    const cat = this.activeCategory();
    const q = this.query().trim().toLowerCase();
    return this.allItems().filter((i) => {
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
        (i.subtitle?.toLowerCase().includes(q) ?? false) ||
        (i.username?.toLowerCase().includes(q) ?? false)
      );
    });
  });

  protected readonly selectedDetail = computed<ItemDetail | undefined>(() => {
    const id = this.selectedId();
    return this.filteredItems().find((i) => i.id === id) ?? this.filteredItems()[0];
  });

  protected onCategory(cat: NavCategory): void {
    this.activeCategory.set(cat);
    this.selectedId.set(this.filteredItems()[0]?.id);
  }
}
