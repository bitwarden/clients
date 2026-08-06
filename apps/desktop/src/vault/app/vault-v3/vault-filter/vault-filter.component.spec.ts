import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { DialogService, SideNavService } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";
import {
  VaultFilter,
  VaultFilterServiceAbstraction,
  RoutedVaultFilterBridgeService,
} from "@bitwarden/vault";

import { CollectionFilterComponent } from "./filters/collection-filter.component";
import { FolderFilterComponent } from "./filters/folder-filter.component";
import { OrganizationFilterComponent } from "./filters/organization-filter.component";
import { StatusFilterComponent } from "./filters/status-filter.component";
import { TypeFilterComponent } from "./filters/type-filter.component";
import { VaultFilterComponent } from "./vault-filter.component";

@Component({
  selector: "app-organization-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class OrganizationFilterStubComponent {
  readonly activeFilter = input<unknown>();
  readonly organizations = input<unknown>();
  readonly activeOrganizationDataOwnership = input<unknown>();
  readonly activeSingleOrganizationPolicy = input<unknown>();
}

@Component({
  selector: "app-type-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TypeFilterStubComponent {
  readonly activeFilter = input<unknown>();
  readonly cipherTypes = input<unknown>();
}

@Component({
  selector: "app-status-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StatusFilterStubComponent {
  readonly activeFilter = input<unknown>();
}

@Component({
  selector: "app-collection-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CollectionFilterStubComponent {
  readonly activeFilter = input<unknown>();
  readonly collection = input<unknown>();
}

@Component({
  selector: "app-folder-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FolderFilterStubComponent {
  readonly activeFilter = input<unknown>();
  readonly folder = input<unknown>();
  readonly onEditFolder = output<unknown>();
}

describe("VaultFilterComponent", () => {
  let fixture: ComponentFixture<VaultFilterComponent>;

  const treeOf = (...children: { id: string; name: string; enabled?: boolean }[]) => {
    const root = new TreeNode<any>({ id: "root", name: "root" }, null);
    root.children = children.map((child) => new TreeNode<any>(child, root));
    return root;
  };

  const setup = async (vfo1Enabled: boolean) => {
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      imports: [VaultFilterComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(vfo1Enabled) } },
        {
          provide: VaultFilterServiceAbstraction,
          useValue: {
            organizationTree$: of(treeOf({ id: "org-1", name: "Acme", enabled: true })),
            collectionTree$: of(treeOf({ id: "collection-1", name: "Marketing" })),
            folderTree$: of(treeOf({ id: "folder-1", name: "Receipts" })),
            cipherTypeTree$: of(treeOf()),
          },
        },
        {
          provide: RoutedVaultFilterBridgeService,
          useValue: { activeFilter$: of(new VaultFilter()) },
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "user-1" as UserId }) },
        },
        { provide: PolicyService, useValue: { policyAppliesToUser$: () => of(false) } },
        { provide: FolderService, useValue: mock<FolderService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    });

    TestBed.overrideComponent(VaultFilterComponent, {
      remove: {
        imports: [
          OrganizationFilterComponent,
          TypeFilterComponent,
          StatusFilterComponent,
          CollectionFilterComponent,
          FolderFilterComponent,
        ],
      },
      add: {
        imports: [
          OrganizationFilterStubComponent,
          TypeFilterStubComponent,
          StatusFilterStubComponent,
          CollectionFilterStubComponent,
          FolderFilterStubComponent,
        ],
      },
    });

    await TestBed.compileComponents();

    TestBed.inject(SideNavService).open.set(true);

    fixture = TestBed.createComponent(VaultFilterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Nav groups only project their children once expanded, and the vault group is collapsed by default.
    fixture.debugElement.query(By.css("bit-nav-group")).componentInstance.open.set(true);
    fixture.detectChanges();
  };

  const navGroupTitles = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll("bit-nav-group[title]") as NodeListOf<HTMLElement>,
    ).map((el) => el.title);

  it("labels the nav groups with collection terminology when the vfo1 flag is off", async () => {
    await setup(false);

    expect(navGroupTitles()).toEqual(["collections", "folders"]);
  });

  it("labels the nav groups with shared folder terminology when the vfo1 flag is on", async () => {
    await setup(true);

    expect(navGroupTitles()).toEqual(["sharedFolders", "myFolders"]);
  });
});
