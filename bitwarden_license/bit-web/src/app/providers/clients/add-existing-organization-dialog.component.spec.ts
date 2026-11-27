import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// bit-dialog uses browser observers not available in jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AddableOrganizationResponse,
  Provider,
  ProviderApiServiceAbstraction,
} from "@bitwarden/common/provider";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { WebProviderService } from "../services/web-provider.service";

import {
  AddExistingOrganizationDialogComponent,
  AddExistingOrganizationDialogResultType,
} from "./add-existing-organization-dialog.component";

describe("AddExistingOrganizationDialogComponent", () => {
  const userId = "user-id";
  const provider = { id: "provider-id", name: "Acme MSP" } as Provider;
  const acme = new AddableOrganizationResponse({
    id: "org-1",
    name: "Acme Inc",
    plan: "Teams (Monthly)",
    seats: 10,
    disabled: false,
  });
  const umbrella = new AddableOrganizationResponse({
    id: "org-2",
    name: "Umbrella Corp",
    plan: "Enterprise (Monthly)",
    seats: 500,
    disabled: true,
  });

  let fixture: ComponentFixture<AddExistingOrganizationDialogComponent>;
  let providerApiService: MockProxy<ProviderApiServiceAbstraction>;
  let webProviderService: MockProxy<WebProviderService>;
  let dialogRef: MockProxy<DialogRef<AddExistingOrganizationDialogResultType>>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(() => {
    providerApiService = mock();
    webProviderService = mock();
    dialogRef = mock();
    // A mock proxy answers every property with a (truthy) function; the dialog reads these as flags.
    Object.assign(dialogRef, { disableClose: false, isDrawer: false });
    toastService = mock();
    i18nService = mock();
    i18nService.t.mockImplementation((key: string, ...params: (string | number | undefined)[]) =>
      [key, ...params].filter((p) => p != null).join(" "),
    );
  });

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // The dialog opens before the organizations arrive, so the API promise is resolved by the test
  // only after the first render has settled, as it would be with a real HTTP response.
  let resolveOrganizations: (organizations: AddableOrganizationResponse[]) => void;

  async function render() {
    providerApiService.getProviderAddableOrganizations.mockReturnValue(
      new Promise((resolve) => {
        resolveOrganizations = resolve;
      }),
    );

    await TestBed.configureTestingModule({
      imports: [AddExistingOrganizationDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DIALOG_DATA, useValue: { provider } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: ProviderApiServiceAbstraction, useValue: providerApiService },
        { provide: WebProviderService, useValue: webProviderService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId }) } },
      ],
    })
      // DialogModule provides its own DialogService inside the component's standalone injector,
      // which would shadow a module-level mock.
      .overrideProvider(DialogService, { useValue: mock<DialogService>() })
      .compileComponents();

    fixture = TestBed.createComponent(AddExistingOrganizationDialogComponent);
    await settle();
  }

  async function renderWith(addableOrganizations: AddableOrganizationResponse[]) {
    await render();
    resolveOrganizations(addableOrganizations);
    await settle();
  }

  const element = (): HTMLElement => fixture.nativeElement;
  const visibleText = () => element().textContent?.replace(/\s+/g, " ") ?? "";
  const spinner = () => element().querySelector("bit-spinner");
  const nextButton = (organizationId: string) =>
    element().querySelector<HTMLButtonElement>(
      `#add-existing-organization-dialog_button_next-${organizationId}`,
    );
  const addButton = () =>
    element().querySelector<HTMLButtonElement>("#add-existing-organization-dialog_button_add");
  const closeButton = () =>
    element().querySelector<HTMLButtonElement>("#add-existing-organization-dialog_button_close");

  function rendered<T>(value: T | null | undefined, what: string): T {
    if (value == null) {
      throw new Error(`${what} is not rendered`);
    }
    return value;
  }

  async function chooseOrganization(organizationId: string) {
    rendered(nextButton(organizationId), `next button for ${organizationId}`).click();
    await settle();
  }

  it("replaces the spinner with the organization list once the organizations arrive", async () => {
    await render();
    expect(spinner()).not.toBeNull();

    resolveOrganizations([acme, umbrella]);
    await settle();

    expect(spinner()).toBeNull();
    expect(visibleText()).toContain("Acme Inc");
    expect(visibleText()).toContain("Umbrella Corp");
  });

  it("tells the user when there are no organizations to add", async () => {
    await renderWith([]);

    expect(visibleText()).toContain("noOrganizations");
    expect(element().querySelector("tr[bitRow]")).toBeNull();
  });

  it("disables Next and explains why for an organization that exceeds the available seats", async () => {
    await renderWith([acme, umbrella]);

    // bitButton disables through aria-disabled so the button stays focusable
    expect(rendered(nextButton(acme.id), "Acme next button").getAttribute("aria-disabled")).toBe(
      null,
    );
    expect(
      rendered(nextButton(umbrella.id), "Umbrella next button").getAttribute("aria-disabled"),
    ).toBe("true");
    expect(visibleText()).toContain("assignedExceedsAvailable");
  });

  it("does not offer to add an organization before one is chosen", async () => {
    await renderWith([acme, umbrella]);

    expect(addButton()).toBeNull();
    expect(closeButton()).not.toBeNull();
  });

  it("shows the confirmation details after choosing an organization", async () => {
    await renderWith([acme, umbrella]);
    await chooseOrganization(acme.id);

    expect(nextButton(acme.id)).toBeNull();
    expect(visibleText()).toContain("yourProviderSubscriptionCredit");
    expect(visibleText()).toContain("doYouWantToAddThisOrg Acme MSP");
    expect(visibleText()).toContain("organization: Acme Inc");
    expect(visibleText()).toContain("billingPlan: Teams (Monthly)");
    expect(visibleText()).toContain("assignedSeats: 10");
    expect(addButton()).not.toBeNull();
  });

  it("adds the chosen organization, shows the success toast and closes with submitted", async () => {
    await renderWith([acme, umbrella]);
    await chooseOrganization(acme.id);

    rendered(addButton(), "add button").click();
    await settle();

    expect(webProviderService.addOrganizationToProvider).toHaveBeenCalledWith(
      provider.id,
      acme.id,
      userId,
    );
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "addedExistingOrganization" }),
    );
    expect(dialogRef.close).toHaveBeenCalledWith(AddExistingOrganizationDialogResultType.Submitted);
  });

  it("does not add anything when the dialog is closed from the list", async () => {
    await renderWith([acme, umbrella]);

    rendered(closeButton(), "close button").click();
    await settle();

    expect(webProviderService.addOrganizationToProvider).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });
});
