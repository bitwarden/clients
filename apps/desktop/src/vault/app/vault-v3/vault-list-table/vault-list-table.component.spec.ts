import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherRowMenuService } from "@bitwarden/vault";

import { VaultListTableComponent } from "./vault-list-table.component";

function cipherView(overrides: Partial<CipherView> = {}): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.name = "Test";
  cipher.edit = true;
  cipher.favorite = false;
  Object.assign(cipher, overrides);
  return cipher;
}

describe("VaultListTableComponent", () => {
  let fixture: ComponentFixture<VaultListTableComponent<CipherViewLike>>;
  let component: VaultListTableComponent<CipherViewLike>;
  let mockGetRowActions: jest.Mock;

  async function setup(extraProviders: unknown[] = []) {
    mockGetRowActions = jest.fn(() => []);

    await TestBed.configureTestingModule({
      imports: [VaultListTableComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        { provide: CipherRowMenuService, useValue: { getRowActions: mockGetRowActions } },
        ...extraProviders,
      ],
    })
      .overrideComponent(VaultListTableComponent, {
        set: { imports: [I18nPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VaultListTableComponent) as ComponentFixture<
      VaultListTableComponent<CipherViewLike>
    >;
    component = fixture.componentInstance;
    fixture.componentRef.setInput("ciphers", []);
  }

  beforeEach(async () => {
    await setup();
  });

  describe("itemAction", () => {
    it("emits a viewCipher event for any cipher", () => {
      const cipher = cipherView();
      const emitted: unknown[] = [];
      component.onEvent.subscribe((e) => emitted.push(e));
      component["itemAction"](cipher);
      expect(emitted).toEqual([{ type: "viewCipher", item: cipher }]);
    });
  });

  describe("rowActions", () => {
    it("passes the collections input to CipherRowMenuService.getRowActions", () => {
      const col = { id: "col-1" } as CollectionView;
      fixture.componentRef.setInput("collections", [col]);

      component["rowActions"]();

      expect(mockGetRowActions).toHaveBeenCalledWith(
        [col],
        expect.objectContaining({
          edit: expect.any(Function),
          clone: expect.any(Function),
          assignToCollections: expect.any(Function),
        }),
      );
    });
  });

  describe("premium callout", () => {
    it("renders when showPremiumCallout is true", () => {
      fixture.componentRef.setInput("showPremiumCallout", true);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("bit-callout"))).not.toBeNull();
    });

    it("is absent when showPremiumCallout is false", () => {
      fixture.componentRef.setInput("showPremiumCallout", false);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("bit-callout"))).toBeNull();
    });
  });

  describe("add cipher button", () => {
    it("renders vault-new-cipher-menu when showAddCipherBtn is true", () => {
      fixture.componentRef.setInput("showAddCipherBtn", true);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("vault-new-cipher-menu"))).not.toBeNull();
    });

    it("is absent when showAddCipherBtn is false", () => {
      fixture.componentRef.setInput("showAddCipherBtn", false);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("vault-new-cipher-menu"))).toBeNull();
    });
  });
});
