import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { BitInputDirective, SectionHeaderComponent } from "@bitwarden/components";

import { ViewIdentitySectionsComponent } from "./view-identity-sections.component";

describe("ViewIdentitySectionsComponent", () => {
  let component: ViewIdentitySectionsComponent;
  let fixture: ComponentFixture<ViewIdentitySectionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewIdentitySectionsComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewIdentitySectionsComponent);
    component = fixture.componentInstance;
    component.cipher = { identity: new IdentityView() } as CipherView;
    fixture.detectChanges();
  });

  describe("personal details", () => {
    it("dynamically shows the section", () => {
      let personalDetailSection = fixture.debugElement.query(By.directive(SectionHeaderComponent));

      expect(personalDetailSection).toBeNull();

      component.cipher = {
        identity: {
          fullName: "Mr Ron Burgundy",
        },
      } as CipherView;

      component.ngOnInit();
      fixture.detectChanges();

      personalDetailSection = fixture.debugElement.query(By.directive(SectionHeaderComponent));

      expect(personalDetailSection).not.toBeNull();
      expect(personalDetailSection.nativeElement.textContent).toBe("personalDetails");
    });

    it("populates personal detail fields", () => {
      component.cipher = {
        identity: {
          fullName: "Mr Ron Burgundy",
          company: "Channel 4 News",
          username: "ron.burgundy",
        },
      } as CipherView;

      component.ngOnInit();
      fixture.detectChanges();

      const fields = fixture.debugElement.queryAll(By.directive(BitInputDirective));

      expect(fields[0].nativeElement.value).toBe("Mr Ron Burgundy");
      expect(fields[1].nativeElement.value).toBe("ron.burgundy");
      expect(fields[2].nativeElement.value).toBe("Channel 4 News");
    });
  });

  describe("identification details", () => {
    it("dynamically shows the section", () => {
      let identificationDetailSection = fixture.debugElement.query(
        By.directive(SectionHeaderComponent),
      );

      expect(identificationDetailSection).toBeNull();

      component.cipher = {
        identity: {
          ssn: "123-45-6789",
        },
      } as CipherView;

      component.ngOnInit();
      fixture.detectChanges();

      identificationDetailSection = fixture.debugElement.query(
        By.directive(SectionHeaderComponent),
      );

      expect(identificationDetailSection).not.toBeNull();
      expect(identificationDetailSection.nativeElement.textContent).toBe("identification");
    });

    it("populates identification detail fields", () => {
      component.cipher = {
        identity: {
          ssn: "123-45-6789",
          passportNumber: "998-765-4321",
          licenseNumber: "404-HTTP",
        },
      } as CipherView;

      component.ngOnInit();
      fixture.detectChanges();

      const fields = fixture.debugElement.queryAll(By.directive(BitInputDirective));

      expect(fields[0].nativeElement.value).toBe("123-45-6789");
      expect(fields[1].nativeElement.value).toBe("998-765-4321");
      expect(fields[2].nativeElement.value).toBe("404-HTTP");
    });
  });

  describe("contact details", () => {
    it("dynamically shows the section", () => {
      let contactDetailSection = fixture.debugElement.query(By.directive(SectionHeaderComponent));

      expect(contactDetailSection).toBeNull();

      component.cipher = {
        identity: {
          email: "jack@gnn.com",
        },
      } as CipherView;

      component.ngOnInit();
      fixture.detectChanges();

      contactDetailSection = fixture.debugElement.query(By.directive(SectionHeaderComponent));

      expect(contactDetailSection).not.toBeNull();
      expect(contactDetailSection.nativeElement.textContent).toBe("contactInfo");
    });

    it("populates contact detail fields", () => {
      component.cipher = {
        identity: {
          email: "jack@gnn.com",
          phone: "608-867-5309",
          address1: "2920 Zoo Dr",
          address2: "Exhibit 200",
          address3: "Tree 7",
          fullAddressPart2: "San Diego, CA 92101",
          country: "USA",
        },
      } as CipherView;

      component.ngOnInit();
      fixture.detectChanges();

      const fields = fixture.debugElement.queryAll(By.directive(BitInputDirective));

      expect(fields[0].nativeElement.value).toBe("jack@gnn.com");
      expect(fields[1].nativeElement.value).toBe("608-867-5309");
      expect(fields[2].nativeElement.value).toBe(
        "2920 Zoo Dr\nExhibit 200\nTree 7\nSan Diego, CA 92101\nUSA",
      );
    });

    it('returns the number of "rows" that should be assigned to the address textarea', () => {
      component.cipher = {
        identity: {
          address1: "2920 Zoo Dr",
          address2: "Exhibit 200",
          address3: "Tree 7",
          fullAddressPart2: "San Diego, CA 92101",
          country: "USA",
        },
      } as CipherView;

      component.ngOnInit();
      fixture.detectChanges();

      let textarea = fixture.debugElement.query(By.css("textarea"));

      expect(textarea.nativeElement.rows).toBe(5);

      component.cipher = {
        identity: {
          address1: "2920 Zoo Dr",
          country: "USA",
        },
      } as CipherView;

      fixture.detectChanges();

      textarea = fixture.debugElement.query(By.css("textarea"));

      expect(textarea.nativeElement.rows).toBe(2);
    });
  });
});
