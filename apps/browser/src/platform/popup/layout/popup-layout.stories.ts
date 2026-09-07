import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  importProvidersFrom,
  inject,
  input,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import {
  GeneratorActive,
  GeneratorInactive,
  NoResults,
  SendActive,
  SendInactive,
  SettingsActive,
  SettingsInactive,
  VaultActive,
  VaultInactive,
} from "@bitwarden/assets/svg";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
  type ButtonType,
  type ColumnName,
  defineTable,
  FilterMenuModule,
  I18nMockService,
  IconButtonModule,
  ItemModule,
  StatusLockupComponent,
  SearchModule,
  SectionComponent,
  ScrollLayoutDirective,
  SvgComponent,
  IconTileComponent,
  TypographyModule,
} from "@bitwarden/components";
import { enabledFlags } from "@bitwarden/storybook";
import { I18nPipe } from "@bitwarden/ui-common";

import { VaultLoadingSkeletonComponent } from "../../../vault/popup/components/vault-loading-skeleton/vault-loading-skeleton.component";
import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupFooterComponent } from "./popup-footer.component";
import { PopupHeaderComponent } from "./popup-header.component";
import { PopupPageComponent } from "./popup-page.component";
import { PopupTabNavigationComponent } from "./popup-tab-navigation.component";

@Component({
  selector: "extension-container",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-h-[640px] tw-w-[480px] tw-border tw-border-solid tw-border-secondary-300">
      <ng-content></ng-content>
    </div>
  `,
})
class ExtensionContainerComponent {}

@Component({
  selector: "extension-popped-container",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-h-[640px] tw-w-[900px] tw-border tw-border-solid tw-border-secondary-300">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
})
class ExtensionPoppedContainerComponent {}

@Component({
  selector: "vault-placeholder",
  changeDetection: ChangeDetectionStrategy.OnPush,
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

@Component({
  selector: "mock-add-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button bitButton size="small" buttonType="primary" type="button">
      <i class="bwi bwi-plus" aria-hidden="true"></i>
      Add
    </button>
  `,
  imports: [ButtonModule],
})
class MockAddButtonComponent {}

/** Mirrors the real `app-pop-out` styling and label; the click is inert in Storybook. */
@Component({
  selector: "mock-popout-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      bitIconButton="bwi-popout"
      size="small"
      type="button"
      [buttonType]="buttonType()"
      label="{{ 'popOutNewWindow' | i18n }}"
      [title]="'popOutNewWindow' | i18n"
    ></button>
  `,
  imports: [I18nPipe, IconButtonModule],
})
class MockPopoutButtonComponent {
  /** Optional so the mock still renders if a story runs without the feature-flag addon. */
  private readonly configService = inject(ConfigService, { optional: true });

  private readonly vfo1Enabled = toSignal(
    this.configService?.getFeatureFlag$(FeatureFlag.VFO1Foundation) ?? of(false),
    { initialValue: false },
  );

  protected readonly buttonType = computed<ButtonType>(() =>
    this.vfo1Enabled() ? "side-nav" : "primaryGhost",
  );
}

@Component({
  selector: "mock-current-account",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- TODO: remove [class] binding and wrapperClasses when VFO1Foundation flag is removed -->
    <button
      [class]="wrapperClasses()"
      class="tw-bg-transparent tw-border-none tw-p-0 tw-align-middle"
      type="button"
    >
      <!-- TODO: remove size binding and lock to "sm" when VFO1Foundation flag is removed -->
      <bit-avatar text="Ash Ketchum" [size]="avatarSize()"></bit-avatar>
    </button>
  `,
  imports: [AvatarModule],
})
class MockCurrentAccountComponent {
  /** Optional so the mock still renders if a story runs without the feature-flag addon. */
  private readonly configService = inject(ConfigService, { optional: true });

  private readonly vfo1Enabled = toSignal(
    this.configService?.getFeatureFlag$(FeatureFlag.VFO1Foundation) ?? of(false),
    { initialValue: false },
  );

  protected readonly avatarSize = computed(() => (this.vfo1Enabled() ? "sm" : "base"));

  /** TODO: remove with the VFO1Foundation flag. Mirrors CurrentAccountComponent.wrapperClasses. */
  protected readonly wrapperClasses = computed(() => (this.vfo1Enabled() ? "" : "tw-me-2 tw-mt-1"));
}

@Component({
  selector: "mock-search",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <bit-search placeholder="Search"> </bit-search> `,
  imports: [SearchModule],
})
class MockSearchComponent {}

@Component({
  selector: "mock-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-banner variant="primary"> This is an important note about these ciphers </bit-banner>
  `,
  imports: [BannerModule],
})
class MockBannerComponent {}

@Component({
  selector: "mock-vault-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
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

@Component({
  selector: "mock-vault-page-popped",
  changeDetection: ChangeDetectionStrategy.OnPush,
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

@Component({
  selector: "mock-generator-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
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

@Component({
  selector: "mock-send-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
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

@Component({
  selector: "mock-settings-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
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

@Component({
  selector: "mock-vault-subpage",
  changeDetection: ChangeDetectionStrategy.OnPush,
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

@Component({
  selector: "mock-vault-page-floating-action",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <popup-page [loading]="loading()">
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <mock-search slot="above-scroll-area"></mock-search>
      <vault-placeholder></vault-placeholder>
      <button
        slot="floating-action"
        bitButton
        buttonType="primary"
        type="button"
        startIcon="bwi-plus"
      >
        Add
      </button>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    ButtonModule,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
    MockSearchComponent,
    VaultComponent,
  ],
})
class MockVaultPageFloatingActionComponent {
  readonly loading = input(false);
}

@Component({
  selector: "mock-vault-subpage-floating-action",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test" showBackButton>
        <ng-container slot="end">
          <mock-popout-button></mock-popout-button>
        </ng-container>
      </popup-header>
      <vault-placeholder></vault-placeholder>
      <button
        slot="floating-action"
        bitButton
        buttonType="primary"
        type="button"
        startIcon="bwi-plus"
      >
        Add
      </button>
      <popup-footer slot="footer">
        <button type="button" bitButton buttonType="primary">Save</button>
        <button type="button" bitButton buttonType="secondary">Cancel</button>
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
  ],
})
class MockVaultSubpageFloatingActionComponent {}

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

/**
 * The VFO1 two-bar header: a branded app bar carrying the pop out button and account switcher, above
 * a page title bar carrying the leading icon tile, title, and item count.
 */
@Component({
  selector: "mock-send-page-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Send">
        <ng-container slot="end">
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
        <bit-icon-tile slot="title-start" icon="bwi-send" variant="brand" size="sm"></bit-icon-tile>
        <span slot="title-end" bitTypography="body2" class="tw-text-muted">3 Sends</span>
      </popup-header>
      <mock-search slot="above-scroll-area"></mock-search>
      <div class="tw-text-main">Send content here</div>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
    MockSearchComponent,
    IconTileComponent,
    TypographyModule,
  ],
})
class MockSendPageV2Component {}

/**
 * The two-bar header over enough content to overflow the popup, so the title bar's collapse-on-scroll
 * behavior is actually reachable.
 */
@Component({
  selector: "mock-scrolling-page-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Vault">
        <ng-container slot="end">
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
        <bit-icon-tile slot="title-start" icon="bwi-lock" variant="brand" size="sm"></bit-icon-tile>
        <span slot="title-end" bitTypography="body2" class="tw-text-muted">20 items</span>
      </popup-header>
      <mock-search slot="above-scroll-area"></mock-search>
      <vault-placeholder></vault-placeholder>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
    MockSearchComponent,
    IconTileComponent,
    TypographyModule,
    VaultComponent,
  ],
})
class MockScrollingPageV2Component {}

/**
 * The standard title plus a control that belongs to it — the vault switcher — projected into
 * `title-suffix`.
 */
@Component({
  selector: "mock-vault-page-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="My vault">
        <ng-container slot="end">
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
        <bit-icon-tile
          slot="title-start"
          icon="bwi-vault"
          variant="brand"
          size="sm"
        ></bit-icon-tile>
        <button
          slot="title-suffix"
          type="button"
          bitIconButton="bwi-angle-down"
          size="xsmall"
          label="Switch vault"
        ></button>
      </popup-header>
      <vault-placeholder></vault-placeholder>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
    VaultComponent,
    IconButtonModule,
    IconTileComponent,
  ],
})
class MockVaultPageV2Component {}

/** A subpage, where the back button sits at the leading edge of the title bar. */
@Component({
  selector: "mock-back-page-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Item details" showBackButton>
        <ng-container slot="end">
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <vault-placeholder></vault-placeholder>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
    VaultComponent,
  ],
})
class MockBackPageV2Component {}

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
      appLogoLabel: "Bitwarden",
      popOutNewWindow: "Pop out to a new window",
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
        MockVaultPageFloatingActionComponent,
        MockVaultSubpageFloatingActionComponent,
        MockVaultPageComponent,
        MockSendPageComponent,
        MockGeneratorPageComponent,
        MockSettingsPageComponent,
        MockVaultPagePoppedComponent,
        MockVaultTablePageComponent,
        MockSendPageV2Component,
        MockScrollingPageV2Component,
        MockVaultPageV2Component,
        MockBackPageV2Component,
        StatusLockupComponent,
        VaultComponent,
        ScrollingModule,
        ItemModule,
        SectionComponent,
        IconButtonModule,
        ChipActionComponent,
        VaultLoadingSkeletonComponent,
        SvgComponent,
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

/**
 * The `floating-action` slot pins a single action to the bottom of the content area. It is anchored to
 * the scroll viewport rather than the scrolled content, so it stays in place while the list scrolls,
 * and the scroll region gains extra bottom padding so the last row is never occluded.
 *
 * The slot is projected *before* the scroll region in DOM order, so keyboard and screen reader users
 * reach it right after the `above-scroll-area` controls instead of after every row. Tab from the top of
 * the page to verify.
 */
export const WithFloatingAction: StoryObj = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation [navButtons]="navButtons">
          <mock-vault-page-floating-action [loading]="loading"></mock-vault-page-floating-action>
        </popup-tab-navigation>
      </extension-container>
    `,
  }),
  args: { loading: false, navButtons: navButtons() },
};

/**
 * The floating action is anchored to the page content area, so it automatically clears
 * `popup-footer` and the bottom tab navigation. Pages configure nothing.
 */
export const WithFloatingActionAndFooter: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <mock-vault-subpage-floating-action></mock-vault-subpage-floating-action>
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
    props: {
      icon: NoResults,
      ...args,
    },
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation>
          <popup-page>
            <popup-header slot="header" pageTitle="Centered Content"></popup-header>
            <div
              class="tw-h-full tw-flex tw-items-center tw-justify-center tw-text-main tw-flex-col"
            >
              <h2 bitTypography="h2" class="tw-mb-6">Page with no content</h2>
              <bit-status-lockup>
                <bit-svg slot="graphic" [content]="icon"></bit-svg>
                <ng-container slot="title">Before centering a div</ng-container>
                <ng-container slot="description">One must first center oneself</ng-container>
              </bit-status-lockup>
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
          <popup-header slot="header" background="alt" pageTitle="">
            <span class="tw-italic tw-text-main">🤠 Custom Content</span>
          </popup-header>
          <vault-placeholder></vault-placeholder>
        </popup-page>
      </extension-container>
    `,
  }),
};

/**
 * Under the `vfo1-foundation` flag, `popup-header` renders two bars: a branded app bar carrying the
 * pop out button and account switcher, and a page title bar carrying the leading icon tile, title,
 * and item count. Toggle the flag in the Feature Flags addon panel to compare against v1.
 */
export const HeaderV2: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <mock-send-page-v2></mock-send-page-v2>
      </extension-container>
    `,
  }),
};

/**
 * The popup viewport is short, so the page title bar collapses while the user scrolls down and
 * returns as soon as they scroll back up. The app bar stays pinned. Scroll the list to see it — the
 * collapsed state can't be reached without interacting, so this story is excluded from snapshots.
 */
export const HeaderV2ScrollingTitleBar: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: { chromatic: { disableSnapshot: true } },
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <mock-scrolling-page-v2></mock-scrolling-page-v2>
      </extension-container>
    `,
  }),
};

/**
 * A control that belongs to the title itself — the vault switcher — goes in `title-suffix`, so the
 * page keeps the standard `pageTitle` rather than rebuilding the title region.
 */
export const HeaderV2TitleSuffix: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <mock-vault-page-v2></mock-vault-page-v2>
      </extension-container>
    `,
  }),
};

/** A subpage keeps its title bar, so the back button renders there, beside the title. */
export const HeaderV2BackButton: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <mock-back-page-v2></mock-back-page-v2>
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
              <cdk-virtual-scroll-viewport itemSize="60" bitScrollLayout>
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
