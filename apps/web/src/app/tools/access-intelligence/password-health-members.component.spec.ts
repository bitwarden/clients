import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength/password-strength.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TableModule } from "@bitwarden/components";
import { TableBodyDirective } from "@bitwarden/components/src/table/table.component";

import { LooseComponentsModule } from "../../shared/loose-components.module";
import { PipesModule } from "../../vault/individual-vault/pipes/pipes.module";
// eslint-disable-next-line no-restricted-imports
import { cipherData } from "../reports/pages/reports-ciphers.mock";

import { PasswordHealthMembersComponent } from "./password-health-members.component";
import { PasswordHealthComponent } from "./password-health.component";

describe("PasswordHealthMembersComponent", () => {
  let component: PasswordHealthMembersComponent;
  let fixture: ComponentFixture<PasswordHealthMembersComponent>;
  let cipherServiceMock: MockProxy<CipherService>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;
  let organizationService: MockProxy<OrganizationService>;
  let auditServiceMock: MockProxy<AuditService>;
  const activeRouteParams = convertToParamMap({ organizationId: "orgId1" });

  beforeEach(async () => {
    passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
    auditServiceMock = mock<AuditService>();
    organizationService = mock<OrganizationService>({
      get: jest.fn().mockResolvedValue({ id: "orgId1" } as Organization),
    });
    cipherServiceMock = mock<CipherService>({
      getAllFromApiForOrganization: jest.fn().mockResolvedValue(cipherData),
    });

    await TestBed.configureTestingModule({
      imports: [PasswordHealthComponent, PipesModule, TableModule, LooseComponentsModule],
      declarations: [TableBodyDirective],
      providers: [
        { provide: CipherService, useValue: cipherServiceMock },
        { provide: PasswordStrengthServiceAbstraction, useValue: passwordStrengthService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: AuditService, useValue: auditServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(activeRouteParams),
            url: of([]),
          },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PasswordHealthMembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it("should format URIs to hostnames", () => {
    const ciphers = [
      {
        login: {
          uris: [{ uri: "https://example.com/path" }, { uri: "http://another-example.com" }],
        },
      },
      {
        login: {
          uris: [
            { uri: "ftp://ftp.example.com/resource" },
            { uri: "example.site.com" },
            { uri: "example site" },
          ],
        },
      },
    ];

    const formattedCiphers = component.formatUrisToHostnames(ciphers);

    expect(formattedCiphers[0].login.uris[0].uri).toBe("example.com");
    expect(formattedCiphers[0].login.uris[1].uri).toBe("another-example.com");
    expect(formattedCiphers[1].login.uris[0].uri).toBe("ftp.example.com");
    expect(formattedCiphers[1].login.uris[1].uri).toBe("example.site.com");
    expect(formattedCiphers[1].login.uris[2].uri).toBe("example site");
  });

  it("should handle ciphers with no URIs", () => {
    const ciphers = [
      {
        login: {
          uris: [] as { uri: string }[],
        },
      },
    ];

    const formattedCiphers = component.formatUrisToHostnames(ciphers);

    expect(formattedCiphers[0].login.uris.length).toBe(0);
  });

  it("should handle ciphers with null or undefined URIs", () => {
    const ciphers = [
      {
        login: {
          uris: null as { uri: string }[] | null,
        },
      },
      {
        login: {
          uris: undefined,
        },
      },
    ];

    const formattedCiphers = component.formatUrisToHostnames(ciphers);

    expect(formattedCiphers[0].login.uris).toBeNull();
    expect(formattedCiphers[1].login.uris).toBeUndefined();
  });
});
