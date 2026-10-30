import { AsyncPipe } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import {
  ProviderStatusType,
  ProviderType,
  ProviderUserStatusType,
  ProviderUserType,
} from "@bitwarden/common/admin-console/enums";
import { ProviderData } from "@bitwarden/common/admin-console/models/data/provider.data";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { I18nPipe } from "@bitwarden/ui-common";

import { ProviderWarningsService } from "../billing/providers/warnings/services";

import { ProvidersLayoutComponent } from "./providers-layout.component";

const PROVIDER_ID = "provider-id";

function makeProvider(overrides: Partial<ProviderData> = {}): Provider {
  return new Provider({
    id: PROVIDER_ID,
    name: "Acme MSP",
    status: ProviderUserStatusType.Confirmed,
    type: ProviderUserType.ProviderAdmin,
    enabled: true,
    userId: "user-id",
    useEvents: true,
    providerStatus: ProviderStatusType.Billable,
    providerType: ProviderType.Msp,
    ...overrides,
  } as ProviderData);
}

describe("ProvidersLayoutComponent", () => {
  let fixture: ComponentFixture<ProvidersLayoutComponent>;
  let providerService: MockProxy<ProviderService>;

  const query = (selector: string) => fixture.nativeElement.querySelector(selector);

  async function render(provider: Provider | undefined) {
    providerService.get$.mockReturnValue(of(provider));
    fixture = TestBed.createComponent(ProvidersLayoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    providerService = mock<ProviderService>();
    const providerWarningsService = mock<ProviderWarningsService>();
    providerWarningsService.showProviderSuspendedDialog$.mockReturnValue(of(undefined));
    providerWarningsService.getTaxIdWarning$.mockReturnValue(of(null));
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);
    const route = mock<ActivatedRoute>();
    route.params = of({ providerId: PROVIDER_ID });

    await TestBed.configureTestingModule({
      imports: [ProvidersLayoutComponent],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: AccountService, useValue: mockAccountServiceWith("user-id" as UserId) },
        { provide: ProviderService, useValue: providerService },
        { provide: ProviderWarningsService, useValue: providerWarningsService },
        { provide: I18nService, useValue: i18nService },
      ],
    })
      .overrideComponent(ProvidersLayoutComponent, {
        set: { imports: [AsyncPipe, I18nPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  it("renders no side nav or tax ID warning when the provider is not found", async () => {
    await render(undefined);

    expect(query("app-side-nav")).toBeNull();
    expect(query("app-tax-id-warning")).toBeNull();
  });

  it("labels the clients nav item as business units for business unit providers", async () => {
    await render(makeProvider({ providerType: ProviderType.BusinessUnit }));

    expect(query('bit-nav-item[route="clients"]').text).toBe("businessUnits");
  });

  it("hides the manage, billing and settings nav for non-admin providers", async () => {
    await render(makeProvider({ type: ProviderUserType.ServiceUser }));

    expect(query('bit-nav-item[route="clients"]')).not.toBeNull();
    expect(query('bit-nav-group[route="manage"]')).toBeNull();
    expect(query('bit-nav-group[route="billing"]')).toBeNull();
    expect(query('bit-nav-item[route="settings"]')).toBeNull();
  });
});
