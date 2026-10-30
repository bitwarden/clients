import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderUpdateRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-update.request";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { ProviderResponse } from "@bitwarden/common/admin-console/models/response/provider/provider.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccountComponent } from "./account.component";

const PROVIDER_ID = "provider-id";

type AccountComponentInternals = {
  formGroup: FormGroup;
  submit: () => Promise<void>;
  deleteProvider: (provider: ProviderResponse) => Promise<void>;
};

describe("AccountComponent", () => {
  let fixture: ComponentFixture<AccountComponent>;
  let params$: BehaviorSubject<Params>;
  let providerApiService: MockProxy<ProviderApiServiceAbstraction>;
  let apiService: MockProxy<ApiService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let logService: MockProxy<LogService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let router: MockProxy<Router>;

  const provider = new ProviderResponse({
    Id: PROVIDER_ID,
    Name: "Acme MSP",
    BusinessName: "Acme MSP",
    BillingEmail: "billing@acme.example",
  });

  const internals = () => fixture.componentInstance as unknown as AccountComponentInternals;
  const query = (selector: string) => fixture.nativeElement.querySelector(selector);

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render({ selfHosted = false } = {}) {
    platformUtilsService.isSelfHost.mockReturnValue(selfHosted);
    fixture = TestBed.createComponent(AccountComponent);
    await settle();
  }

  beforeEach(async () => {
    providerApiService = mock<ProviderApiServiceAbstraction>();
    apiService = mock<ApiService>();
    platformUtilsService = mock<PlatformUtilsService>();
    logService = mock<LogService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    router = mock<Router>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    // Observables must be assigned after mock(); mock({ params: of() }) never emits.
    params$ = new BehaviorSubject<Params>({ providerId: PROVIDER_ID });
    const route = mock<ActivatedRoute>();
    route.params = params$;

    providerApiService.getProvider.mockResolvedValue(provider);
    providerApiService.putProvider.mockResolvedValue(provider);

    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: ProviderApiServiceAbstraction, useValue: providerApiService },
        { provide: ApiService, useValue: apiService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: LogService, useValue: logService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: Router, useValue: router },
      ],
    })
      .overrideComponent(AccountComponent, {
        set: { imports: [ReactiveFormsModule, I18nPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads the provider from the route into the form", async () => {
    await render();

    expect(providerApiService.getProvider).toHaveBeenCalledWith(PROVIDER_ID);
    expect(internals().formGroup.getRawValue()).toEqual({
      providerName: "Acme MSP",
      providerBillingEmail: "billing@acme.example",
    });
    expect(query("form")).not.toBeNull();
  });

  it("reloads the form when the route switches to another provider", async () => {
    providerApiService.getProvider.mockImplementation(async (id: string) =>
      id === PROVIDER_ID
        ? provider
        : new ProviderResponse({ Id: id, Name: "Other MSP", BillingEmail: "other@msp.example" }),
    );
    await render();

    params$.next({ providerId: "other-provider-id" });
    await settle();

    expect(providerApiService.getProvider).toHaveBeenLastCalledWith("other-provider-id");
    expect(internals().formGroup.getRawValue()).toEqual({
      providerName: "Other MSP",
      providerBillingEmail: "other@msp.example",
    });
  });

  it("keeps the delete target on the displayed provider when the route switches during a save", async () => {
    providerApiService.getProvider.mockImplementation(async (id: string) =>
      id === PROVIDER_ID
        ? provider
        : new ProviderResponse({ Id: id, Name: "Other MSP", BillingEmail: "other@msp.example" }),
    );
    let finishSave!: () => void;
    providerApiService.putProvider.mockReturnValue(
      new Promise((resolve) => (finishSave = () => resolve(provider))),
    );
    apiService.getProviderClients.mockResolvedValue(
      new ListResponse({ Data: [{}] }, ProviderOrganizationOrganizationDetailsResponse),
    );
    await render();

    const saving = internals().submit();
    params$.next({ providerId: "other-provider-id" });
    await settle();
    finishSave();
    await saving;
    await settle();

    query("#provider-account_button_delete").click();
    await settle();

    expect(apiService.getProviderClients).toHaveBeenCalledWith("other-provider-id");
  });

  it("shows the saved values from the server after saving", async () => {
    await render();
    providerApiService.getProvider.mockResolvedValue(
      new ProviderResponse({ Id: PROVIDER_ID, Name: "New Name", BillingEmail: "new@acme.example" }),
    );
    internals().formGroup.patchValue({
      providerName: "New Name",
      providerBillingEmail: "NEW@acme.example",
    });

    await internals().submit();
    await settle();

    expect(internals().formGroup.getRawValue()).toEqual({
      providerName: "New Name",
      providerBillingEmail: "new@acme.example",
    });
  });

  it("keeps the form visible while it refreshes after saving", async () => {
    await render();
    providerApiService.getProvider.mockReturnValue(new Promise(() => {}));

    await internals().submit();
    await settle();

    expect(query("form")).not.toBeNull();
    expect(query("bit-spinner")).toBeNull();
  });

  it("does not submit when the provider name is empty", async () => {
    await render();
    internals().formGroup.patchValue({ providerName: "" });

    await internals().submit();

    expect(providerApiService.putProvider).not.toHaveBeenCalled();
  });

  it("does not submit when the billing email is invalid", async () => {
    await render();
    internals().formGroup.patchValue({ providerBillingEmail: "not-an-email" });

    await internals().submit();

    expect(providerApiService.putProvider).not.toHaveBeenCalled();
  });

  it("submits the name as both name and business name", async () => {
    await render();
    internals().formGroup.patchValue({
      providerName: "New Name",
      providerBillingEmail: "new@acme.example",
    });

    await internals().submit();

    expect(providerApiService.putProvider).toHaveBeenCalledWith(
      PROVIDER_ID,
      new ProviderUpdateRequest({
        name: "New Name",
        businessName: "New Name",
        billingEmail: "new@acme.example",
      }),
    );
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "providerUpdated",
    });
  });

  it("disables the form when self-hosted", async () => {
    await render({ selfHosted: true });

    expect(internals().formGroup.disabled).toBe(true);
  });

  it("renders neither the form nor the delete button when the provider fails to load", async () => {
    providerApiService.getProvider.mockRejectedValue(new Error("load failed"));

    await render();

    expect(logService.error).toHaveBeenCalledWith("Handled exception: Error: load failed");
    expect(query("form")).toBeNull();
    expect(query("app-danger-zone")).toBeNull();
  });

  it("warns with the provider name and does not delete when the provider has clients", async () => {
    apiService.getProviderClients.mockResolvedValue(
      new ListResponse({ Data: [{}] }, ProviderOrganizationOrganizationDetailsResponse),
    );
    await render();

    await internals().deleteProvider(provider);

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: { key: "deleteProviderName", placeholders: ["Acme MSP"] },
        content: { key: "deleteProviderWarningDescription", placeholders: ["Acme MSP"] },
      }),
    );
    expect(providerApiService.deleteProvider).not.toHaveBeenCalled();
  });

  it("deletes the provider and navigates home after the user verifies", async () => {
    apiService.getProviderClients.mockResolvedValue(
      new ListResponse({ Data: [] }, ProviderOrganizationOrganizationDetailsResponse),
    );
    jest
      .spyOn(UserVerificationDialogComponent, "open")
      .mockResolvedValue({ userAction: "confirm", verificationSuccess: true });
    await render();

    await internals().deleteProvider(provider);

    expect(providerApiService.deleteProvider).toHaveBeenCalledWith(PROVIDER_ID);
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "providerDeleted",
      message: "providerDeletedDesc",
    });
    expect(router.navigate).toHaveBeenCalledWith(["/"]);
  });

  it("does not delete when the user cancels verification", async () => {
    apiService.getProviderClients.mockResolvedValue(
      new ListResponse({ Data: [] }, ProviderOrganizationOrganizationDetailsResponse),
    );
    jest
      .spyOn(UserVerificationDialogComponent, "open")
      .mockResolvedValue({ userAction: "cancel", verificationSuccess: false });
    await render();

    await internals().deleteProvider(provider);

    expect(providerApiService.deleteProvider).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("shows the spinner and hides the form and delete button until the provider loads", async () => {
    providerApiService.getProvider.mockReturnValue(new Promise(() => {}));

    await render();

    expect(query("bit-spinner")).not.toBeNull();
    expect(query("form")).toBeNull();
    expect(query("app-danger-zone")).toBeNull();
  });
});
