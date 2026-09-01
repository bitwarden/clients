import { ComponentFixture, TestBed } from "@angular/core/testing";
import { UntypedFormControl, UntypedFormGroup } from "@angular/forms";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Vfo1TerminologyService } from "@bitwarden/vault";

import { OrganizationCreateModule } from "./organization-create.module";
import { OrganizationInformationComponent } from "./organization-information.component";

describe("OrganizationInformationComponent", () => {
  let fixture: ComponentFixture<OrganizationInformationComponent>;
  let vfo1Enabled: boolean;

  async function setup(enabled: boolean) {
    vfo1Enabled = enabled;
    await TestBed.configureTestingModule({
      imports: [OrganizationCreateModule],
      providers: [
        {
          provide: AccountService,
          useValue: {
            activeAccount$: new BehaviorSubject({ id: "user-id", email: "test@example.com" }),
          },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: Vfo1TerminologyService,
          useValue: { iconClass: (icon: string) => icon, enabled: () => vfo1Enabled },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationInformationComponent);
    const component = fixture.componentInstance;
    component.nameOnly = false;
    component.createOrganization = true;
    component.formGroup = new UntypedFormGroup({
      name: new UntypedFormControl(""),
      billingEmail: new UntypedFormControl(""),
    });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it("renders the General information header when the VFO1 flag is off", async () => {
    await setup(false);
    expect(fixture.nativeElement.querySelector("h2")).not.toBeNull();
  });

  it("hides the General information header when the VFO1 flag is on", async () => {
    await setup(true);
    expect(fixture.nativeElement.querySelector("h2")).toBeNull();
  });
});
