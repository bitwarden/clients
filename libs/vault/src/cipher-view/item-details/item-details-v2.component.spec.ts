import { ComponentRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ClientType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ItemDetailsV2Component } from "./item-details-v2.component";

describe("ItemDetailsV2Component", () => {
  let component: ItemDetailsV2Component;
  let fixture: ComponentFixture<ItemDetailsV2Component>;
  let componentRef: ComponentRef<ItemDetailsV2Component>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let desktopMilestone3Flag$: BehaviorSubject<boolean>;

  const cipher = {
    id: "cipher1",
    collectionIds: ["col1", "col2"],
    organizationId: "org1",
    folderId: "folder1",
    name: "cipher name",
  } as CipherView;

  const organization = {
    id: "org1",
    name: "Organization 1",
  } as Organization;

  const collection = {
    id: "col1",
    name: "Collection 1",
  } as CollectionView;

  const collection2 = {
    id: "col2",
    name: "Collection 2",
  } as CollectionView;

  const folder = {
    id: "folder1",
    name: "Folder 1",
  } as FolderView;

  beforeEach(async () => {
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Web);
    desktopMilestone3Flag$ = new BehaviorSubject<boolean>(false);

    await TestBed.configureTestingModule({
      imports: [ItemDetailsV2Component],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: (flag: FeatureFlag) =>
              flag === FeatureFlag.DesktopUiMigrationMilestone3
                ? desktopMilestone3Flag$.asObservable()
                : of(false),
          },
        },
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.example.com" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ItemDetailsV2Component);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput("cipher", cipher);
    componentRef.setInput("organization", organization);
    componentRef.setInput("collections", [collection, collection2]);
    componentRef.setInput("folder", folder);
    jest.spyOn(component, "hasSmallScreen").mockReturnValue(false); // Mocking small screen check
    fixture.detectChanges();
  });

  it("displays all available fields", () => {
    const itemName = fixture.debugElement.query(By.css('[data-testid="item-name"]'));
    const itemDetailsList = fixture.debugElement.queryAll(
      By.css('[data-testid="item-details-list"]'),
    );

    expect(itemName.nativeElement.textContent.trim()).toEqual(cipher.name);
    expect(itemDetailsList.length).toBe(4); // Organization, Collection, Collection2, Folder
    expect(itemDetailsList[0].nativeElement.textContent.trim()).toContain(organization.name);
    expect(itemDetailsList[1].nativeElement.textContent.trim()).toContain(collection.name);
    expect(itemDetailsList[2].nativeElement.textContent.trim()).toContain(collection2.name);
    expect(itemDetailsList[3].nativeElement.textContent.trim()).toContain(folder.name);
  });

  it("does not render owner when `hideOwner` is true", () => {
    componentRef.setInput("hideOwner", true);
    fixture.detectChanges();

    const owner = fixture.debugElement.query(By.css('[data-testid="owner"]'));
    expect(owner).toBeNull();
  });

  describe("showArchiveBadge", () => {
    it("is true when cipher is archived on Desktop and DesktopUiMigrationMilestone3 is off", () => {
      mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);
      desktopMilestone3Flag$.next(false);
      componentRef.setInput("cipher", { ...cipher, isArchived: true });

      expect((component as any).showArchiveBadge()).toBe(true);
    });

    it("is false when DesktopUiMigrationMilestone3 is on (dialog renders its own badge)", () => {
      mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);
      desktopMilestone3Flag$.next(true);
      componentRef.setInput("cipher", { ...cipher, isArchived: true });

      expect((component as any).showArchiveBadge()).toBe(false);
    });

    it("is false when cipher is not archived", () => {
      mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);
      desktopMilestone3Flag$.next(false);
      componentRef.setInput("cipher", { ...cipher, isArchived: false });

      expect((component as any).showArchiveBadge()).toBe(false);
    });

    it("is false when client is not Desktop", () => {
      mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Web);
      desktopMilestone3Flag$.next(false);
      componentRef.setInput("cipher", { ...cipher, isArchived: true });

      expect((component as any).showArchiveBadge()).toBe(false);
    });
  });

  describe("showExpiredBadge", () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    function cardCipher(expMonth: string | undefined, expYear: string | undefined): CipherView {
      const card = new CardView();
      card.expMonth = expMonth;
      card.expYear = expYear;
      return { ...cipher, type: CipherType.Card, card } as CipherView;
    }

    it("is false for a non-card cipher", () => {
      componentRef.setInput("cipher", { ...cipher, type: CipherType.Login });
      expect((component as any).showExpiredBadge()).toBe(false);
    });

    it("is false when card has no expiry fields", () => {
      componentRef.setInput("cipher", cardCipher(undefined, undefined));
      expect((component as any).showExpiredBadge()).toBe(false);
    });

    it("is false for expMonth=0 and current year (malformed month should not flag as expired)", () => {
      componentRef.setInput("cipher", cardCipher("0", String(currentYear)));
      expect((component as any).showExpiredBadge()).toBe(false);
    });

    it("is true when card expired in a past year", () => {
      componentRef.setInput("cipher", cardCipher("1", "2020"));
      expect((component as any).showExpiredBadge()).toBe(true);
    });

    it("is true when card expired earlier in the current year", () => {
      const pastMonth = currentMonth === 1 ? null : String(currentMonth - 1);
      if (pastMonth === null) {
        // January — no earlier month in the current year to test; skip via past year
        componentRef.setInput("cipher", cardCipher("12", String(currentYear - 1)));
      } else {
        componentRef.setInput("cipher", cardCipher(pastMonth, String(currentYear)));
      }
      expect((component as any).showExpiredBadge()).toBe(true);
    });

    it("is false when card expires in a future year", () => {
      componentRef.setInput("cipher", cardCipher("1", String(currentYear + 1)));
      expect((component as any).showExpiredBadge()).toBe(false);
    });

    it("is false when card expiry is the current year and month", () => {
      componentRef.setInput("cipher", cardCipher(String(currentMonth), String(currentYear)));
      expect((component as any).showExpiredBadge()).toBe(false);
    });
  });
});
