import { provideLocationMocks } from "@angular/common/testing";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableV2Component,
  defineTable,
  DialogService,
  FilterMenuModule,
} from "@bitwarden/components";

import {
  VAULT_FILTER_KEYS,
  VAULT_FILTER_NAMESPACE,
} from "../components/vault-items-table/vault-items-table.component";
import { VaultRemountOnDirective } from "../directives/remount-on.directive";
import {
  ALL_ITEMS_SCOPE,
  MY_VAULT_ROUTE,
  parseVaultScope,
  scopeKey,
  VaultScopeType,
} from "../models/vault-scope";

import { VaultFilterMemoryService } from "./vault-filter-memory.service";
import { vaultFilterRestoreGuard } from "./vault-filter-restore.guard";
import { type VaultScopeRouteData } from "./vault-filter-scope";

const ORGANIZATION_ID = "de7e92e5-8dd0-4e86-9c8d-b3a7015062ce" as OrganizationId;
const TESTING_FOLDER_ID = "b42fd980-430e-4e11-85cc-b3f4011c9ff5";
const NO_FOLDER = "noFolder";

const FOLDER_PARAM = `${VAULT_FILTER_NAMESPACE}.${VAULT_FILTER_KEYS.folder}`;

const organizationScope = {
  type: VaultScopeType.Organization,
  organizationId: ORGANIZATION_ID,
} as const;

type Row = { name: string };

/**
 * A stand-in for the web vault page: one component serving every `:vaultId`, with a filter chip
 * and a sort synced to the URL, remounted on the same scope key the memory records under.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    FilterMenuModule,
    VaultRemountOnDirective,
  ],
  template: `
    <bit-table-v2 *vaultRemountOn="remountKey()" [tableDef]="table" queryParam="vault">
      <!--
        Mirrors the vault table's Vault chip, which only exists in a scope that spans more than
        one vault. Its registration is what re-triggers the table's URL write-back on a scope
        switch — without a chip like it the effect has no changed dependency to run on.
      -->
      @if (spansVaults()) {
        <bit-filter-menu [key]="vaultKey" placeholderText="Vault" multiple>
          <bit-filter-option [value]="organizationId">Acme corporation</bit-filter-option>
        </bit-filter-menu>
      }

      <bit-filter-menu [key]="folderKey" placeholderText="Folder" multiple>
        <bit-filter-option [value]="noFolder">None</bit-filter-option>
        <bit-filter-option [value]="testingFolderId">Testing</bit-filter-option>
      </bit-filter-menu>

      <bit-column sortable defaultSort="asc">
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
class VaultPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly table = defineTable<Row>(signal<Row[]>([{ name: "Row" }]));
  protected readonly folderKey = VAULT_FILTER_KEYS.folder;
  protected readonly vaultKey = VAULT_FILTER_KEYS.vault;
  protected readonly organizationId = ORGANIZATION_ID;
  protected readonly noFolder = NO_FOLDER;
  protected readonly testingFolderId = TESTING_FOLDER_ID;

  protected readonly remountKey = toSignal(
    this.route.paramMap.pipe(
      map((params) => scopeKey(parseVaultScope(params.get("vaultId")) ?? ALL_ITEMS_SCOPE)),
    ),
  );

  protected readonly spansVaults = computed(() => this.remountKey() === ORGANIZATION_ID);
}

const inScope = { vaultFilterScope: true } satisfies VaultScopeRouteData;

describe("vault filter memory (router integration)", () => {
  const userId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let router: Router;
  let memory: VaultFilterMemoryService;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);

    TestBed.configureTestingModule({
      providers: [
        { provide: StateProvider, useValue: stateProvider },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogService, useValue: {} },
        provideLocationMocks(),
        provideRouter([
          {
            path: "vault/:vaultId",
            component: VaultPageComponent,
            data: inScope,
            canActivate: [vaultFilterRestoreGuard],
          },
        ]),
      ],
    });

    router = TestBed.inject(Router);
    // Constructed before the first navigation, so it records every one of them.
    memory = TestBed.inject(VaultFilterMemoryService);
    harness = await RouterTestingHarness.create();
  });

  /** Navigates and lets the table's effects and any write-back settle. */
  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  /** Picks a folder in the toolbar, the way a user does. */
  async function pickFolder(...values: string[]): Promise<void> {
    const table = harness.fixture.debugElement.query(By.directive(BitTableV2Component))
      .componentInstance as BitTableV2Component<Row>;
    table
      .filterControls()
      .find((control) => control.key() === VAULT_FILTER_KEYS.folder)!
      .setValue(values);
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  it("restores a scope's filters and keeps the table from overwriting them", async () => {
    await open(`/vault/${ORGANIZATION_ID}`);
    await pickFolder(NO_FOLDER);

    await open(`/vault/${MY_VAULT_ROUTE}`);
    await pickFolder(TESTING_FOLDER_ID);

    // Back to the organization with no filters of its own: the guard fills them in.
    await open(`/vault/${ORGANIZATION_ID}`);

    expect(router.url).toContain(`${FOLDER_PARAM}=${NO_FOLDER}`);
    expect(router.url).not.toContain(TESTING_FOLDER_ID);

    // And the recorded value is the restored one, so the corruption can't survive a reload.
    const remembered = await memory.paramsFor(organizationScope);
    // A multi-select chip records its value as a one-item array — the shape the write-back
    // navigation carries, which the snapshot reads back unparsed.
    expect(remembered[FOLDER_PARAM]).toEqual([NO_FOLDER]);
  });
});
