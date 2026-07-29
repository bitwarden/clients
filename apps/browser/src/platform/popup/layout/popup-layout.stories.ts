import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  importProvidersFrom,
  input,
  signal,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import {
  GeneratorActive,
  GeneratorInactive,
  SendActive,
  SendInactive,
  SettingsActive,
  SettingsInactive,
  VaultActive,
  VaultInactive,
} from "@bitwarden/assets/svg";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import {
  AvatarModule,
  BannerModule,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitRowGroupComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ChipActionComponent,
  ButtonModule,
  type ColumnName,
  defineTable,
  FilterMenuModule,
  I18nMockService,
  IconButtonModule,
  ItemModule,
  NoItemsModule,
  SearchModule,
  SectionComponent,
  ScrollLayoutDirective,
} from "@bitwarden/components";

import { VaultLoadingSkeletonComponent } from "../../../vault/popup/components/vault-loading-skeleton/vault-loading-skeleton.component";
import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupFooterComponent } from "./popup-footer.component";
import { PopupHeaderComponent } from "./popup-header.component";
import { PopupPageComponent } from "./popup-page.component";
import { PopupTabNavigationComponent } from "./popup-tab-navigation.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "extension-container",
  template: `
    <div class="tw-h-[640px] tw-w-[480px] tw-border tw-border-solid tw-border-secondary-300">
      <ng-content></ng-content>
    </div>
  `,
})
class ExtensionContainerComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "extension-popped-container",
  template: `
    <div class="tw-h-[640px] tw-w-[900px] tw-border tw-border-solid tw-border-secondary-300">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
})
class ExtensionPoppedContainerComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-placeholder",
  template: /*html*/ `
    <bit-section>
      <bit-item-group>
        <bit-item *ngFor="let item of data; index as i">
          <button type="button" bit-item-content>
            <i slot="start" class="bwi bwi-globe tw-text-3xl tw-text-muted" aria-hidden="true"></i>
            {{ i }} of {{ data.length - 1 }}
            <span slot="secondary">Bar</span>
          </button>

          <ng-container slot="end">
            <bit-item-action>
              <button type="button" bit-chip-action variant="primary" label="Fill"></button>
            </bit-item-action>
            <bit-item-action>
              <button type="button" bitIconButton="bwi-clone" label="Copy item"></button>
            </bit-item-action>
            <bit-item-action>
              <button type="button" bitIconButton="bwi-ellipsis-v" label="More options"></button>
            </bit-item-action>
          </ng-container>
        </bit-item>
      </bit-item-group>
    </bit-section>
  `,
  imports: [CommonModule, ItemModule, ChipActionComponent, IconButtonModule, SectionComponent],
})
class VaultComponent {
  protected data = Array.from(Array(20).keys());
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-add-button",
  template: `
    <button bitButton size="small" buttonType="primary" type="button">
      <i class="bwi bwi-plus" aria-hidden="true"></i>
      Add
    </button>
  `,
  imports: [ButtonModule],
})
class MockAddButtonComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-popout-button",
  template: `
    <button bitIconButton="bwi-popout" size="small" type="button" label="Pop out"></button>
  `,
  imports: [IconButtonModule],
})
class MockPopoutButtonComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-current-account",
  template: `
    <button class="tw-bg-transparent tw-border-none tw-p-0 tw-me-1 tw-align-middle" type="button">
      <bit-avatar text="Ash Ketchum"></bit-avatar>
    </button>
  `,
  imports: [AvatarModule],
})
class MockCurrentAccountComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-search",
  template: ` <bit-search placeholder="Search"> </bit-search> `,
  imports: [SearchModule],
})
class MockSearchComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-banner",
  template: `
    <bit-banner variant="primary"> This is an important note about these ciphers </bit-banner>
  `,
  imports: [BannerModule],
})
class MockBannerComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-vault-page",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <mock-search slot="above-scroll-area"></mock-search>
      <vault-placeholder></vault-placeholder>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
    MockSearchComponent,
    VaultComponent,
  ],
})
class MockVaultPageComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-vault-page-popped",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <vault-placeholder></vault-placeholder>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockCurrentAccountComponent,
    VaultComponent,
  ],
})
class MockVaultPagePoppedComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-generator-page",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <div class="tw-text-main">Generator content here</div>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
  ],
})
class MockGeneratorPageComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-send-page",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <div class="tw-text-main">Send content here</div>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
  ],
})
class MockSendPageComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-settings-page",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <div class="tw-text-main">Settings content here</div>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
  ],
})
class MockSettingsPageComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-vault-subpage",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test" showBackButton>
        <ng-container slot="end">
          <mock-popout-button></mock-popout-button>
        </ng-container>
      </popup-header>
      <vault-placeholder></vault-placeholder>
      <popup-footer slot="footer">
        <button type="button" bitButton buttonType="primary">Save</button>
        <button type="button" bitButton buttonType="secondary">Cancel</button>
        <button
          slot="end"
          type="button"
          buttonType="dangerGhost"
          bitIconButton="bwi-trash"
          label="Delete"
        ></button>
      </popup-footer>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    ButtonModule,
    MockPopoutButtonComponent,
    VaultComponent,
    IconButtonModule,
  ],
})
class MockVaultSubpageComponent {}

// --- Table V2 list-presentation exploration -------------------------------------
// Duplicated from libs/components Table V2 "Filterable" story so we can iterate on
// the responsive table/list presentation inside the real extension popup chrome.

type TableVaultRow = {
  id: number;
  name: string;
  type: "login" | "card" | "note";
  vault: "mine" | "acme";
  collectionIds: string[];
  favorite: boolean;
};

const TABLE_VAULTS = [
  { id: "mine", name: "My vault" },
  { id: "acme", name: "Acme corporation" },
] as const;

const TABLE_COLLECTION_ORGS = [
  {
    name: "Acme corporation",
    collections: [
      { id: "eng", name: "Engineering" },
      { id: "ops", name: "Operations" },
      { id: "pm", name: "Project management" },
    ],
  },
  {
    name: "My vault",
    collections: [
      { id: "personal", name: "Personal" },
      { id: "finance", name: "Finance" },
    ],
  },
];

const TABLE_VAULT_ROWS: TableVaultRow[] = [
  { id: 1, name: "Acme", type: "login", vault: "acme", collectionIds: ["eng"], favorite: true },
  { id: 2, name: "Amazon", type: "login", vault: "mine", collectionIds: [], favorite: false },
  { id: 3, name: "Apple ID", type: "login", vault: "mine", collectionIds: [], favorite: true },
  {
    id: 4,
    name: "Chase Bank",
    type: "card",
    vault: "acme",
    collectionIds: ["ops"],
    favorite: false,
  },
  {
    id: 5,
    name: "Corporate amex",
    type: "card",
    vault: "acme",
    collectionIds: ["ops", "eng"],
    favorite: true,
  },
  { id: 6, name: "Datadog", type: "login", vault: "acme", collectionIds: ["eng"], favorite: false },
  {
    id: 7,
    name: "Docusign",
    type: "login",
    vault: "acme",
    collectionIds: ["ops"],
    favorite: false,
  },
  {
    id: 8,
    name: "Recovery codes",
    type: "note",
    vault: "mine",
    collectionIds: ["personal"],
    favorite: false,
  },
  {
    id: 9,
    name: "Wifi password",
    type: "note",
    vault: "acme",
    collectionIds: ["pm"],
    favorite: false,
  },
  { id: 10, name: "Dropbox", type: "login", vault: "mine", collectionIds: [], favorite: false },
  { id: 11, name: "Figma", type: "login", vault: "acme", collectionIds: ["eng"], favorite: true },
  {
    id: 12,
    name: "GitHub",
    type: "login",
    vault: "acme",
    collectionIds: ["eng", "ops"],
    favorite: true,
  },
  { id: 13, name: "Gmail", type: "login", vault: "mine", collectionIds: [], favorite: false },
  {
    id: 14,
    name: "Mastercard",
    type: "card",
    vault: "mine",
    collectionIds: ["finance"],
    favorite: false,
  },
  { id: 15, name: "Netflix", type: "login", vault: "mine", collectionIds: [], favorite: true },
  { id: 16, name: "Notion", type: "login", vault: "acme", collectionIds: ["pm"], favorite: false },
  {
    id: 17,
    name: "Passport scan",
    type: "note",
    vault: "mine",
    collectionIds: ["personal"],
    favorite: false,
  },
  { id: 18, name: "Slack", type: "login", vault: "acme", collectionIds: ["eng"], favorite: false },
  {
    id: 19,
    name: "Visa debit",
    type: "card",
    vault: "acme",
    collectionIds: ["ops"],
    favorite: true,
  },
];

type TableVaultFilters = {
  search?: string;
  type?: TableVaultRow["type"];
  vault?: string[];
  collection?: string[];
  favorite?: boolean;
};

@Component({
  selector: "mock-vault-table-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockCurrentAccountComponent,
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    BitRowGroupComponent,
    BitTableToolbarComponent,
    FilterMenuModule,
    SearchModule,
    ButtonModule,
    IconButtonModule,
    ChipActionComponent,
  ],
  template: `
    <popup-page hideOverflow>
      <popup-header slot="header" pageTitle="Vault">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>

      <!-- fill needs a bounded flex parent; popup-page's content slot isn't flex, so wrap it. -->
      <div class="tw-flex tw-h-full tw-min-h-0 tw-flex-col">
        <bit-table-v2
          [tableDef]="table"
          [filter]="filter"
          [presentation]="presentation()"
          [displayedColumns]="displayedColumns"
          fill
        >
          <bit-table-toolbar>
            <bit-search class="tw-flex-1" placeholder="Search" aria-label="Search"></bit-search>

            <bit-filter-menu key="type" placeholderText="Type" unsetLabel="All">
              @for (option of typeOptions(); track option.value) {
                <bit-filter-option [value]="option.value" [count]="option.count">
                  {{ option.label }}
                </bit-filter-option>
              }
            </bit-filter-menu>

            <bit-filter-divider></bit-filter-divider>

            <bit-filter-menu key="vault" placeholderText="Vault" multiple>
              @for (option of vaultOptions(); track option.value) {
                <bit-filter-option [value]="option.value" [count]="option.count">
                  {{ option.label }}
                </bit-filter-option>
              }
            </bit-filter-menu>

            <bit-filter-menu key="collection" placeholderText="Collections" multiple>
              @for (org of collectionOrgs(); track org.name) {
                <bit-filter-section [label]="org.name" collapsible>
                  @for (collection of org.collections; track collection.id) {
                    <bit-filter-option [value]="collection.id" [count]="collection.count">
                      {{ collection.name }}
                    </bit-filter-option>
                  }
                </bit-filter-section>
              }
            </bit-filter-menu>

            <bit-filter-toggle
              key="favorite"
              label="Favorites"
              icon="bwi-star"
              iconActive="bwi-star-f"
            ></bit-filter-toggle>
          </bit-table-toolbar>

          <bit-row-group [match]="isFavorite" collapsible>
            Favorites
            <!-- favorite logins/notes render flat first, then a "Cards" subgroup -->
            <bit-row-group [match]="isCard">Cards</bit-row-group>
          </bit-row-group>
          <bit-row-group [match]="all" collapsible>
            All items
            <bit-row-group [match]="isLogin">Logins</bit-row-group>
            <bit-row-group [match]="isCard">Cards</bit-row-group>
            <bit-row-group [match]="isNote">Notes</bit-row-group>
          </bit-row-group>

          <bit-column sortable defaultSort="asc">
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.name; let row">
              <i
                slot="start"
                class="bwi bwi-globe tw-text-3xl tw-text-muted"
                aria-hidden="true"
              ></i>
              {{ row.name }}
              <span slot="secondary">{{ vaultName(row.vault) }}</span>
            </bit-cell>
          </bit-column>
          <bit-column sortable width="120px">
            <bit-header-cell>Type</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.type; let row">{{ row.type }}</bit-cell>
          </bit-column>
          <bit-column width="160px">
            <bit-header-cell>Vault</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.vault; let row">{{
              vaultName(row.vault)
            }}</bit-cell>
          </bit-column>
          <bit-column width="auto">
            <bit-header-cell></bit-header-cell>
            <bit-cell *bitCellDef="table.columns.actions; let row">
              <button type="button" bit-chip-action variant="primary" label="Fill"></button>
              <button type="button" bitIconButton="bwi-clone" label="Copy item"></button>
              <button type="button" bitIconButton="bwi-ellipsis-v" label="More options"></button>
            </bit-cell>
          </bit-column>
        </bit-table-v2>
      </div>
    </popup-page>
  `,
})
class MockVaultTablePageComponent {
  readonly presentation = input<"table" | "list">("list");

  protected readonly data = signal(TABLE_VAULT_ROWS);
  protected readonly table = defineTable<TableVaultRow, "actions">(this.data);

  // Predicate groups: favorites first, then everything else subgrouped by type.
  protected readonly isFavorite = (row: TableVaultRow) => row.favorite;
  protected readonly all = () => true;
  protected readonly isLogin = (row: TableVaultRow) => row.type === "login";
  protected readonly isCard = (row: TableVaultRow) => row.type === "card";
  protected readonly isNote = (row: TableVaultRow) => row.type === "note";

  /** Shows only the rich name column and the trailing actions column; Type and Vault are hidden. */
  protected readonly displayedColumns: ColumnName<TableVaultRow, "actions">[] = ["name", "actions"];

  protected readonly filter = (row: TableVaultRow, f: Partial<TableVaultFilters>) =>
    (!f.search || row.name.toLowerCase().includes(f.search.toLowerCase())) &&
    (f.type == null || row.type === f.type) &&
    (!f.vault?.length || f.vault.includes(row.vault)) &&
    (!f.collection?.length || f.collection.some((c) => row.collectionIds.includes(c))) &&
    (!f.favorite || row.favorite);

  protected readonly typeOptions = computed(() =>
    (["login", "card", "note"] as const)
      .map((value) => ({
        value,
        label: value,
        count: this.data().filter((r) => r.type === value).length,
      }))
      .filter((option) => option.count > 0),
  );

  protected readonly vaultOptions = computed(() =>
    TABLE_VAULTS.map((vault) => ({
      value: vault.id,
      label: vault.name,
      count: this.data().filter((r) => r.vault === vault.id).length,
    })),
  );

  protected readonly collectionOrgs = computed(() => {
    const rows = this.data();
    return TABLE_COLLECTION_ORGS.map((org) => ({
      name: org.name,
      collections: org.collections.map((c) => ({
        ...c,
        count: rows.filter((r) => r.collectionIds.includes(c.id)).length,
      })),
    }));
  });

  protected vaultName(id: string): string {
    return TABLE_VAULTS.find((v) => v.id === id)?.name ?? id;
  }
}

// Shared so it can be provided at BOTH the module level (page content) and the
// application level — the responsive filter dialog opened via DialogService roots
// its injector at the app injector, so it needs I18nService provided there too.
const popupLayoutI18nProvider = {
  provide: I18nService,
  useFactory: () =>
    new I18nMockService({
      back: "Back",
      loading: "Loading",
      search: "Search",
      vault: "Vault",
      generator: "Generator",
      send: "Send",
      settings: "Settings",
      labelWithNotification: (label: string | undefined) => `${label}: New Notification`,
      // Table V2 + filter-menu keys for the list-presentation exploration.
      resetSearch: "Reset search",
      removeItem: (name) => `Remove ${name}`,
      viewItemsIn: (name) => `View items in ${name}`,
      backTo: (name) => `Back to ${name}`,
      selectPlaceholder: "-- Select --",
      clearFilters: "Clear all filters",
      filtersApplied: (count) => `${count} filters applied`,
      nothingToShow: "Nothing to show",
      noMatchingItems: "No matching items",
      selectAllRows: "Select all rows",
      selectRow: "Select row",
      itemCount: (count) => `${count} items`,
      all: "All",
      filter: "Filter",
      filters: "Filters",
      done: "Done",
      clearAll: "Clear all",
      filtersSelected: (count) => `${count} selected`,
    }),
};

export default {
  title: "Browser/Popup Layout",
  component: PopupPageComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-38889&t=k6OTDDPZOTtypRqo-11",
    },
  },
  decorators: [
    moduleMetadata({
      imports: [
        ScrollLayoutDirective,
        PopupTabNavigationComponent,
        PopupHeaderComponent,
        PopupPageComponent,
        PopupFooterComponent,
        CommonModule,
        RouterModule,
        ExtensionContainerComponent,
        ExtensionPoppedContainerComponent,
        MockBannerComponent,
        MockSearchComponent,
        MockVaultSubpageComponent,
        MockVaultPageComponent,
        MockSendPageComponent,
        MockGeneratorPageComponent,
        MockSettingsPageComponent,
        MockVaultPagePoppedComponent,
        MockVaultTablePageComponent,
        NoItemsModule,
        VaultComponent,
        ScrollingModule,
        ItemModule,
        SectionComponent,
        IconButtonModule,
        ChipActionComponent,
        VaultLoadingSkeletonComponent,
      ],
      providers: [
        popupLayoutI18nProvider,
        {
          provide: PolicyService,
          useFactory: () => {
            return {
              policyAppliesToActiveUser$: () => {
                return {
                  pipe: () => ({
                    subscribe: () => ({}),
                  }),
                };
              },
            };
          },
        },
        {
          provide: SendService,
          useFactory: () => {
            return {
              sends$: () => {
                return { pipe: () => ({}) };
              },
            };
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        popupLayoutI18nProvider,
        importProvidersFrom(
          RouterModule.forRoot(
            [
              { path: "", redirectTo: "tabs/vault", pathMatch: "full" },
              { path: "tabs/vault", component: MockVaultPageComponent },
              { path: "tabs/generator", component: MockGeneratorPageComponent },
              { path: "tabs/send", component: MockSendPageComponent },
              { path: "tabs/settings", component: MockSettingsPageComponent },
              // in case you are coming from a story that also uses the router
              { path: "**", redirectTo: "tabs/vault" },
            ],
            { useHash: true },
          ),
        ),
        {
          provide: PopupRouterCacheService,
          useValue: {
            back() {},
          } as Partial<PopupRouterCacheService>,
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<PopupPageComponent>;

type PopupTabNavigationStory = StoryObj<PopupTabNavigationComponent>;

const navButtons = (showBerry = false) => [
  {
    label: "vault",
    page: "/tabs/vault",
    icon: VaultInactive,
    iconActive: VaultActive,
  },
  {
    label: "generator",
    page: "/tabs/generator",
    icon: GeneratorInactive,
    iconActive: GeneratorActive,
  },
  {
    label: "send",
    page: "/tabs/send",
    icon: SendInactive,
    iconActive: SendActive,
  },
  {
    label: "settings",
    page: "/tabs/settings",
    icon: SettingsInactive,
    iconActive: SettingsActive,
    showBerry: showBerry,
  },
];

export const DefaultPopupTabNavigation: PopupTabNavigationStory = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <extension-container>
        <popup-tab-navigation [navButtons]="navButtons">
          <router-outlet></router-outlet>
        </popup-tab-navigation>
      </extension-container>`,
  }),
  args: {
    navButtons: navButtons(),
  },
};

export const PopupTabNavigationWithBerry: PopupTabNavigationStory = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <extension-container>
        <popup-tab-navigation [navButtons]="navButtons">
          <router-outlet></router-outlet>
        </popup-tab-navigation>
      </extension-container>`,
  }),
  args: {
    navButtons: navButtons(true),
  },
};

export const PopupPage: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <mock-vault-page></mock-vault-page>
      </extension-container>
    `,
  }),
};

/**
 * Table V2 in `list` presentation inside the real popup chrome. Duplicated from the
 * libs/components "Filterable" story; toggle `presentation` to compare table vs list.
 * The table uses `fill`, so its toolbar/header stay pinned while the rows scroll.
 */
export const FilterableTableList: StoryObj = {
  args: { presentation: "list", navButtons: navButtons() },
  argTypes: {
    presentation: { control: "inline-radio", options: ["table", "list"] },
  },
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation [navButtons]="navButtons">
          <mock-vault-table-page [presentation]="presentation"></mock-vault-table-page>
        </popup-tab-navigation>
      </extension-container>
    `,
  }),
};

export const PopupPageWithFooter: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <mock-vault-subpage></mock-vault-subpage>
      </extension-container>
    `,
  }),
};

export const RegularMode: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <div id="regular-example">
        <p>Relaxed</p>
        <p class="example-label"></p>
        <extension-container>
          <mock-vault-subpage></mock-vault-subpage>
        </extension-container>
      </div>
    `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const example = canvasEl.querySelector(
      `#regular-example [data-testid=popup-layout-scroll-region]`,
    );

    if (!example) {
      // eslint-disable-next-line
      console.error(`#regular-example [data-testid=popup-layout-scroll-region] not found`);
      return;
    }

    const label = canvasEl.querySelector(`#regular-example .example-label`);

    if (!label) {
      // eslint-disable-next-line
      console.error(`#regular-example .example-label not found`);
      return;
    }

    const percentVisible =
      100 -
      Math.round((100 * (example.scrollHeight - example.clientHeight)) / example.scrollHeight);
    label.textContent = `${percentVisible}% above the fold`;
  },
};

export const CompactMode: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <div id="compact-example" class="tw-bit-compact">
        <p>Compact</p>
        <p class="example-label"></p>
        <extension-container>
          <mock-vault-subpage></mock-vault-subpage>
        </extension-container>
      </div>
    `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const example = canvasEl.querySelector(
      `#compact-example [data-testid=popup-layout-scroll-region]`,
    );

    if (!example) {
      // eslint-disable-next-line
      console.error(`#compact-example [data-testid=popup-layout-scroll-region] not found`);
      return;
    }

    const label = canvasEl.querySelector(`#compact-example .example-label`);

    if (!label) {
      // eslint-disable-next-line
      console.error(`#compact-example .example-label not found`);
      return;
    }

    const percentVisible =
      100 -
      Math.round((100 * (example.scrollHeight - example.clientHeight)) / example.scrollHeight);
    label.textContent = `${percentVisible}% above the fold`;
  },
};

export const PoppedOut: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-popped-container>
        <mock-vault-page-popped></mock-vault-page-popped>
      </extension-popped-container>
    `,
  }),
};

export const CenteredContent: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation>
          <popup-page>
            <popup-header slot="header" pageTitle="Centered Content"></popup-header>
            <div
              class="tw-h-full tw-flex tw-items-center tw-justify-center tw-text-main tw-flex-col"
            >
              <h2 bitTypography="h2" class="tw-mb-6">Page with no content</h2>
              <bit-no-items>
                <ng-container slot="title">Before centering a div</ng-container>
                <ng-container slot="description">One must first center oneself</ng-container>
              </bit-no-items>
            </div>
          </popup-page>
        </popup-tab-navigation>
      </extension-container>
    `,
  }),
};

export const Loading: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation>
          <popup-page [loading]="true">
            <popup-header slot="header" pageTitle="Page Header"></popup-header>
            Content would go here
          </popup-page>
        </popup-tab-navigation>
      </extension-container>
    `,
  }),
};

export const SkeletonLoading: Story = {
  render: (args) => ({
    props: { ...args, data: Array(8) },
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation>
          <popup-page hideOverflow>
            <popup-header slot="header" pageTitle="Page Header"></popup-header>
            <vault-loading-skeleton></vault-loading-skeleton>
          </popup-page>
        </popup-tab-navigation>
      </extension-container>
    `,
  }),
};

export const TransparentHeader: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-page>
          <popup-header slot="header" background="alt">
            <span class="tw-italic tw-text-main">🤠 Custom Content</span>
          </popup-header>
          <vault-placeholder></vault-placeholder>
        </popup-page>
      </extension-container>
    `,
  }),
};

export const Notice: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-page>
          <popup-header slot="header" pageTitle="Page Header"></popup-header>
          <mock-banner slot="full-width-notice"></mock-banner>
          <mock-search slot="above-scroll-area"></mock-search>
          <vault-placeholder></vault-placeholder>
        </popup-page>
      </extension-container>
    `,
  }),
};

export const NarrowWidth: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <div class="tw-h-[640px] tw-w-[380px] tw-border tw-border-solid tw-border-secondary-300">
        <mock-vault-page></mock-vault-page>
      </div>
    `,
  }),
};

export const DefaultWidth: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <div class="tw-h-[640px] tw-w-[480px] tw-border tw-border-solid tw-border-secondary-300">
        <mock-vault-page></mock-vault-page>
      </div>
    `,
  }),
};

export const WideWidth: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <div class="tw-h-[640px] tw-w-[600px] tw-border tw-border-solid tw-border-secondary-300">
        <mock-vault-page></mock-vault-page>
      </div>
    `,
  }),
};

export const WithVirtualScrollChild: Story = {
  render: (args) => ({
    props: { ...args, data: Array.from(Array(20).keys()) },
    template: /* HTML */ `
      <extension-popped-container>
        <popup-page>
          <popup-header slot="header" pageTitle="Test"> </popup-header>
          <mock-search slot="above-scroll-area"></mock-search>
          <bit-section>
            @defer (on immediate) {
            <bit-item-group>
              <cdk-virtual-scroll-viewport itemSize="59" bitScrollLayout>
                <bit-item *cdkVirtualFor="let item of data; index as i">
                  <button type="button" bit-item-content>
                    <i
                      slot="start"
                      class="bwi bwi-globe tw-text-3xl tw-text-muted"
                      aria-hidden="true"
                    ></i>
                    {{ i }} of {{ data.length - 1 }}
                    <span slot="secondary">Bar</span>
                  </button>

                  <ng-container slot="end">
                    <bit-item-action>
                      <button type="button" bit-chip-action variant="primary" label="Fill"></button>
                    </bit-item-action>
                    <bit-item-action>
                      <button type="button" bitIconButton="bwi-clone" label="Copy item"></button>
                    </bit-item-action>
                    <bit-item-action>
                      <button
                        type="button"
                        bitIconButton="bwi-ellipsis-v"
                        label="More options"
                      ></button>
                    </bit-item-action>
                  </ng-container>
                </bit-item>
              </cdk-virtual-scroll-viewport>
            </bit-item-group>
            }
          </bit-section>
        </popup-page>
      </extension-popped-container>
    `,
  }),
};
