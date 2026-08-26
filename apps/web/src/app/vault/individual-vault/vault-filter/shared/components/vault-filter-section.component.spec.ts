import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import {
  VaultFilterServiceAbstraction as VaultFilterService,
  VaultFilterSection,
  VaultFilterType,
} from "@bitwarden/vault";

import { CoachmarkService } from "../../../../components/coachmark";

import { VAULT_FILTER_GATED_COLLECTION_INDICATOR } from "./pam/vault-filter-gated-collection-indicator.token";
import { VaultFilterSectionComponent } from "./vault-filter-section.component";

@Component({
  selector: "app-test-gated-indicator",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span data-testid="gated-indicator">{{ collection()?.id }}</span>`,
})
class TestGatedIndicatorComponent {
  readonly collection = input<{ id?: string } | null>(null);
}

function collectionSection(): VaultFilterSection {
  const head = { id: "AllCollections", name: "collections" } as unknown as VaultFilterType;
  const headNode = new TreeNode<VaultFilterType>(head, null);
  const child = { id: "collection-1", name: "Engineering" } as unknown as VaultFilterType;
  headNode.children.push(new TreeNode<VaultFilterType>(child, headNode, "Engineering"));

  return {
    data$: of(headNode),
    header: { showHeader: false, isSelectable: false },
    action: jest.fn(),
  } as unknown as VaultFilterSection;
}

describe("VaultFilterSectionComponent", () => {
  let fixture: ComponentFixture<VaultFilterSectionComponent>;

  function create(options: { provideIndicator: boolean; isCollectionFilter: boolean }): void {
    TestBed.configureTestingModule({
      imports: [CommonModule, JslibModule],
      declarations: [VaultFilterSectionComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: VaultFilterService, useValue: vaultFilterService },
        { provide: CoachmarkService, useValue: mock<CoachmarkService>() },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" as UserId }) } },
        { provide: I18nService, useValue: { t: (key: string): string => key } },
        ...(options.provideIndicator
          ? [
              {
                provide: VAULT_FILTER_GATED_COLLECTION_INDICATOR,
                useValue: TestGatedIndicatorComponent,
              },
            ]
          : []),
      ],
    });

    fixture = TestBed.createComponent(VaultFilterSectionComponent);
    fixture.componentInstance.activeFilter = {} as never;
    fixture.componentInstance.isCollectionFilter = options.isCollectionFilter;
    fixture.componentRef.setInput("section", collectionSection());
    fixture.detectChanges();
  }

  function indicator(): HTMLElement | null {
    return fixture.nativeElement.querySelector("[data-testid='gated-indicator']");
  }

  const vaultFilterService = mock<VaultFilterService>();

  beforeEach(() => {
    TestBed.resetTestingModule();
    vaultFilterService.collapsedFilterNodes$ = of(new Set<string>());
  });

  it("mounts the provided indicator for each collection node", () => {
    create({ provideIndicator: true, isCollectionFilter: true });

    expect(indicator()?.textContent).toBe("collection-1");
  });

  it("mounts nothing when no host provides the indicator", () => {
    create({ provideIndicator: false, isCollectionFilter: true });

    expect(indicator()).toBeNull();
  });

  it("mounts nothing for a section that is not the collection filter", () => {
    create({ provideIndicator: true, isCollectionFilter: false });

    expect(indicator()).toBeNull();
  });
});
