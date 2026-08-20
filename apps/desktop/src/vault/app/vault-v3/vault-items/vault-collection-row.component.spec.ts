import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { VaultCollectionRowComponent } from "./vault-collection-row.component";

describe("VaultCollectionRowComponent", () => {
  let fixture: ComponentFixture<VaultCollectionRowComponent>;

  const setup = async (vfo1Enabled: boolean) => {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [VaultCollectionRowComponent],
      providers: [
        provideRouter([]),
        {
          provide: I18nService,
          useValue: { t: (key: string, ...params: string[]) => [key, ...params].join(" ") },
        },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(vfo1Enabled) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultCollectionRowComponent);
    fixture.componentRef.setInput(
      "collection",
      new CollectionView({
        id: "collection-1" as CollectionId,
        organizationId: "org-1" as OrganizationId,
        name: "Marketing",
      }),
    );
    fixture.componentRef.setInput("disabled", false);
    fixture.detectChanges();
  };

  const nameLinkTitle = () =>
    (fixture.nativeElement.querySelector("button[bitlink]") as HTMLButtonElement).title;

  it("titles the name link with collection terminology when the vfo1 flag is off", async () => {
    await setup(false);

    expect(nameLinkTitle()).toBe("viewCollectionWithName Marketing");
  });

  it("titles the name link with shared folder terminology when the vfo1 flag is on", async () => {
    await setup(true);

    expect(nameLinkTitle()).toBe("viewSharedFolderWithName Marketing");
  });
});
