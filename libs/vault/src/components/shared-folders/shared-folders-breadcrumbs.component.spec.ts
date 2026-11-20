import { DebugElement } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { BehaviorSubject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { IconTileComponent } from "@bitwarden/components";

import { SharedFoldersBreadcrumbsComponent } from "./shared-folders-breadcrumbs.component";

/** A guid, because `parseVaultScope` only reads a `:vaultId` segment that is one. */
const ORGANIZATION_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa" as OrganizationId;

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORGANIZATION_ID,
    name: "Acme",
    productTierType: ProductTierType.Enterprise,
    ...overrides,
  } as Organization;
}

type SetupOptions = {
  organizations?: Organization[];
  /** Query params on the shared folders URL, as the table writes when a filter is applied. */
  query?: string;
};

/**
 * A crumb is projected into `bit-breadcrumbs` as a template rather than an element, so the
 * `bit-breadcrumb` hosts never reach the DOM — these assert on what each crumb renders as instead:
 * a link for a crumb pointing elsewhere, and the `aria-current="page"` element for the active one.
 */
describe("SharedFoldersBreadcrumbsComponent", () => {
  let harness: RouterTestingHarness;

  async function setup(options: SetupOptions = {}): Promise<void> {
    const { organizations = [organization()], query = "" } = options;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: "vault/:vaultId/shared-folders",
            component: SharedFoldersBreadcrumbsComponent,
          },
        ]),
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "user-1" as UserId }) },
        },
        {
          provide: OrganizationService,
          useValue: { organizations$: () => new BehaviorSubject(organizations) },
        },
      ],
    });

    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/vault/${ORGANIZATION_ID}/shared-folders${query}`);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function links(): DebugElement[] {
    return harness.fixture.debugElement.queryAll(By.css("a[href]"));
  }

  function activeCrumb(): DebugElement {
    return harness.fixture.debugElement.query(By.css('[aria-current="page"]'));
  }

  function organizationTile(): IconTileComponent {
    return harness.fixture.debugElement.query(By.directive(IconTileComponent))
      .componentInstance as IconTileComponent;
  }

  it("links the organization crumb to the vault's all-items page", async () => {
    await setup();

    const [vault] = links();
    expect(vault.nativeElement.getAttribute("href")).toBe(`/vault/${ORGANIZATION_ID}`);
    expect(vault.nativeElement.textContent).toContain("Acme");
  });

  it("gives the organization crumb the side nav's tile for the vault's tier", async () => {
    await setup({ organizations: [organization({ productTierType: ProductTierType.Families })] });

    const tile = organizationTile();
    expect(tile.icon()).toBe("bwi-family");
    expect(tile.variant()).toBe("teal");
  });

  it("marks the shared folders crumb active, so it stands in for the page heading", async () => {
    await setup();

    const active = activeCrumb();
    expect(active.nativeElement.textContent).toContain("sharedFolders");
    expect(active.query(By.css(".bwi-shared-folder"))).not.toBeNull();
  });

  it("keeps the shared folders crumb active once the table writes its filters to the URL", async () => {
    await setup({ query: "?sharedFolders=search" });

    expect(activeCrumb().nativeElement.textContent).toContain("sharedFolders");
  });

  it("renders only the shared folders crumb for a vault the account is not a member of", async () => {
    await setup({ organizations: [] });

    expect(links()).toHaveLength(0);
    expect(activeCrumb().nativeElement.textContent).toContain("sharedFolders");
  });
});
