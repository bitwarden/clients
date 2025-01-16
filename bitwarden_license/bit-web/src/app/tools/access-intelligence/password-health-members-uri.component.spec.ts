import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  MemberCipherDetailsApiService,
  PasswordHealthService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TableModule } from "@bitwarden/components";
import { LooseComponentsModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { PasswordHealthMembersURIComponent } from "./password-health-members-uri.component";

describe("PasswordHealthMembersUriComponent", () => {
  let component: PasswordHealthMembersURIComponent;
  let fixture: ComponentFixture<PasswordHealthMembersURIComponent>;
  let cipherServiceMock: MockProxy<CipherService>;
  const passwordHealthServiceMock = mock<PasswordHealthService>();

  const activeRouteParams = convertToParamMap({ organizationId: "orgId" });

  beforeEach(async () => {
    cipherServiceMock = mock<CipherService>();
    await TestBed.configureTestingModule({
      imports: [PasswordHealthMembersURIComponent, PipesModule, TableModule, LooseComponentsModule],
      providers: [
        { provide: CipherService, useValue: cipherServiceMock },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: AuditService, useValue: mock<AuditService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        {
          provide: PasswordStrengthServiceAbstraction,
          useValue: mock<PasswordStrengthServiceAbstraction>(),
        },
        { provide: PasswordHealthService, useValue: passwordHealthServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(activeRouteParams),
            url: of([]),
          },
        },
        {
          provide: MemberCipherDetailsApiService,
          useValue: mock<MemberCipherDetailsApiService>(),
        },
        {
          provide: ApiService,
          useValue: mock<ApiService>(),
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PasswordHealthMembersURIComponent);
    component = fixture.componentInstance;
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });
});
