import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

// bit-dialog and the form field use browser observers not available in jsdom
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

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ProviderUserInviteRequest,
  ProviderUserType,
  ProviderUserUpdateRequest,
  ProviderUserUserDetailsResponse,
} from "@bitwarden/common/provider";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import {
  AddEditMemberDialogComponent,
  AddEditMemberDialogParams,
  AddEditMemberDialogResultType,
} from "./add-edit-member-dialog.component";

describe("AddEditMemberDialogComponent", () => {
  const providerId = "provider-id";
  const user = new ProviderUserUserDetailsResponse({
    Id: "provider-user-id",
    UserId: "user-id",
    Name: "Alice Smith",
    Email: "alice@example.com",
    Type: ProviderUserType.ProviderAdmin,
  });

  let fixture: ComponentFixture<AddEditMemberDialogComponent>;
  let apiService: MockProxy<ApiService>;
  let dialogRef: MockProxy<DialogRef<AddEditMemberDialogResultType>>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(() => {
    apiService = mock();
    dialogRef = mock();
    // A mock proxy answers every property with a (truthy) function; the dialog reads these as flags.
    Object.assign(dialogRef, { disableClose: false, isDrawer: false });
    dialogService = mock();
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

  async function render(params: AddEditMemberDialogParams) {
    await TestBed.configureTestingModule({
      imports: [AddEditMemberDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: ApiService, useValue: apiService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        UserNamePipe,
      ],
    })
      // DialogModule provides its own DialogService inside the component's standalone injector,
      // which would shadow a module-level mock.
      .overrideProvider(DialogService, { useValue: dialogService })
      .compileComponents();

    fixture = TestBed.createComponent(AddEditMemberDialogComponent);
    await settle();
  }

  const element = (): HTMLElement => fixture.nativeElement;
  const visibleText = () => element().textContent?.replace(/\s+/g, " ") ?? "";
  const emailInput = () =>
    element().querySelector<HTMLInputElement>("#add-edit-member-dialog_input_emails");
  const saveButton = () =>
    element().querySelector<HTMLButtonElement>("#add-edit-member-dialog_button_save");
  const cancelButton = () =>
    element().querySelector<HTMLButtonElement>("#add-edit-member-dialog_button_cancel");
  const removeButton = () =>
    element().querySelector<HTMLButtonElement>("#add-edit-member-dialog_button_delete");
  const roleOption = (labelKey: string) =>
    Array.from(element().querySelectorAll("bit-radio-button"))
      .find((option) => option.textContent?.includes(labelKey))
      ?.querySelector<HTMLInputElement>("input[type=radio]");

  function rendered<T>(value: T | null | undefined, what: string): T {
    if (value == null) {
      throw new Error(`${what} is not rendered`);
    }
    return value;
  }

  async function typeEmails(value: string) {
    const input = rendered(emailInput(), "email input");
    input.value = value;
    input.dispatchEvent(new Event("input"));
    await settle();
  }

  async function chooseRole(labelKey: string) {
    rendered(roleOption(labelKey), `${labelKey} option`).click();
    await settle();
  }

  describe("inviting a member", () => {
    it("shows the invite title with an email field and no remove button", async () => {
      await render({ providerId });

      expect(visibleText()).toContain("INVITEMEMBER");
      expect(emailInput()).not.toBeNull();
      expect(removeButton()).toBeNull();
    });

    it("tells the user how many emails can be entered at once", async () => {
      await render({ providerId });

      expect(visibleText()).toContain("inviteMultipleEmailsNoSeatLimit 20");
    });

    it("defaults the new member to a service user", async () => {
      await render({ providerId });

      expect(rendered(roleOption("serviceUser"), "service user option").checked).toBe(true);
      expect(rendered(roleOption("providerAdmin"), "provider admin option").checked).toBe(false);
    });

    it("asks for an email when the field is left empty", async () => {
      await render({ providerId });

      rendered(emailInput(), "email input").dispatchEvent(new Event("blur"));
      await settle();

      expect(visibleText()).toContain("inputRequired");
    });

    it("invites every entered email with the chosen role and closes the dialog", async () => {
      await render({ providerId });
      await typeEmails("  alice@example.com, bob@example.com ,carol@example.com  ");
      await chooseRole("providerAdmin");

      rendered(saveButton(), "save button").click();
      await settle();

      expect(apiService.postProviderUserInvite).toHaveBeenCalledWith(
        providerId,
        new ProviderUserInviteRequest({
          emails: ["alice@example.com", "bob@example.com", "carol@example.com"],
          type: ProviderUserType.ProviderAdmin,
        }),
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "invitedUsers" }),
      );
      expect(dialogRef.close).toHaveBeenCalledWith(AddEditMemberDialogResultType.Saved);
    });

    it("invites with the service user role when no role is chosen", async () => {
      await render({ providerId });
      await typeEmails("alice@example.com");

      rendered(saveButton(), "save button").click();
      await settle();

      expect(apiService.postProviderUserInvite).toHaveBeenCalledWith(
        providerId,
        new ProviderUserInviteRequest({
          emails: ["alice@example.com"],
          type: ProviderUserType.ServiceUser,
        }),
      );
    });

    it("keeps the dialog open without a success toast when the invite fails", async () => {
      await render({ providerId });
      await typeEmails("alice@example.com");
      apiService.postProviderUserInvite.mockRejectedValue(new Error("invite failed"));

      rendered(saveButton(), "save button").click();
      await settle();

      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("closes without inviting when the user cancels", async () => {
      await render({ providerId });
      await typeEmails("alice@example.com");

      rendered(cancelButton(), "cancel button").click();
      await settle();

      expect(apiService.postProviderUserInvite).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledWith(AddEditMemberDialogResultType.Closed);
    });
  });

  describe("editing a member", () => {
    it("shows the edit title with the member's name, no email field and a remove button", async () => {
      await render({ providerId, user });

      expect(visibleText()).toContain("EDITMEMBER");
      expect(visibleText()).toContain("Alice Smith");
      expect(emailInput()).toBeNull();
      expect(removeButton()).not.toBeNull();
    });

    it("preselects the member's current role", async () => {
      await render({ providerId, user });

      expect(rendered(roleOption("providerAdmin"), "provider admin option").checked).toBe(true);
      expect(rendered(roleOption("serviceUser"), "service user option").checked).toBe(false);
    });

    it("updates the member's role and closes the dialog", async () => {
      await render({ providerId, user });
      await chooseRole("serviceUser");

      rendered(saveButton(), "save button").click();
      await settle();

      expect(apiService.putProviderUser).toHaveBeenCalledWith(
        providerId,
        user.id,
        new ProviderUserUpdateRequest({ type: ProviderUserType.ServiceUser }),
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "editedUserId Alice Smith" }),
      );
      expect(dialogRef.close).toHaveBeenCalledWith(AddEditMemberDialogResultType.Saved);
    });

    it("closes without saving when the user cancels", async () => {
      await render({ providerId, user });
      await chooseRole("serviceUser");

      rendered(cancelButton(), "cancel button").click();
      await settle();

      expect(apiService.putProviderUser).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledWith(AddEditMemberDialogResultType.Closed);
    });
  });

  describe("removing a member", () => {
    it("removes the member after the user confirms", async () => {
      await render({ providerId, user });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      rendered(removeButton(), "remove button").click();
      await settle();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Alice Smith",
          content: { key: "removeUserConfirmation" },
          type: "warning",
        }),
      );
      expect(apiService.deleteProviderUser).toHaveBeenCalledWith(providerId, user.id);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "removedUserId Alice Smith" }),
      );
      expect(dialogRef.close).toHaveBeenCalledWith(AddEditMemberDialogResultType.Deleted);
    });

    it("keeps the member when the user cancels the confirmation", async () => {
      await render({ providerId, user });
      dialogService.openSimpleDialog.mockResolvedValue(false);

      rendered(removeButton(), "remove button").click();
      await settle();

      expect(apiService.deleteProviderUser).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
