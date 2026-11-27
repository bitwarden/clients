import { OverlayContainer } from "@angular/cdk/overlay";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  signal,
  WritableSignal,
} from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Params } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  ProviderService,
  ProviderUserBulkResponse,
  ProviderUserStatusType,
  ProviderUserType,
  ProviderUserUserDetailsResponse,
} from "@bitwarden/common/provider";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { ProviderId, UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService, ScrollLayoutService, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { CloudBulkReinviteLimit } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";
import { BulkStatusComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-status.component";
import { MemberActionsService } from "@bitwarden/web-vault/app/admin-console/organizations/members/services/member-actions/member-actions.service";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  AddEditMemberDialogComponent,
  AddEditMemberDialogResultType,
} from "./dialogs/add-edit-member-dialog.component";
import { BulkConfirmDialogComponent } from "./dialogs/bulk-confirm-dialog.component";
import { BulkRemoveDialogComponent } from "./dialogs/bulk-remove-dialog.component";
import { MembersComponent } from "./members.component";
import { ProviderActionsService } from "./services/provider-actions/provider-actions.service";

// The real header pulls in the account menu and product switcher, which these tests don't cover.
@Component({
  selector: "app-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
})
class StubHeaderComponent {}

type MemberFixture = { id: string; name: string; status: ProviderUserStatusType };

const ada: MemberFixture = {
  id: "ada",
  name: "Ada Lovelace",
  status: ProviderUserStatusType.Confirmed,
};
const grace: MemberFixture = {
  id: "grace",
  name: "Grace Hopper",
  status: ProviderUserStatusType.Invited,
};
const alan: MemberFixture = {
  id: "alan",
  name: "Alan Turing",
  status: ProviderUserStatusType.Accepted,
};
const edsger: MemberFixture = {
  id: "edsger",
  name: "Edsger Dijkstra",
  status: ProviderUserStatusType.Invited,
};

const membersResponse = (members: MemberFixture[]) =>
  new ListResponse(
    {
      Data: members.map(({ id, name, status }) => ({
        Id: id,
        UserId: `${id}-user`,
        Type: ProviderUserType.ServiceUser,
        Status: status,
        Name: name,
        Email: `${id}@example.com`,
      })),
    },
    ProviderUserUserDetailsResponse,
  );

const closedWith = (result?: unknown) => ({ closed: of(result) }) as unknown as DialogRef;

describe("MembersComponent (providers)", () => {
  const providerId = "provider-id" as ProviderId;
  const userId = "user-id" as UserId;

  let fixture: ComponentFixture<MembersComponent>;
  let apiService: MockProxy<ApiService>;
  let dialogService: MockProxy<DialogService>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;
  let validationService: MockProxy<ValidationService>;
  let logService: MockProxy<LogService>;
  let memberActionsService: MockProxy<MemberActionsService>;
  let providerActionsService: MockProxy<ProviderActionsService>;
  let isProcessing: WritableSignal<boolean>;
  let route: MockProxy<ActivatedRoute>;

  beforeEach(() => {
    apiService = mock();
    dialogService = mock();
    i18nService = mock();
    toastService = mock();
    validationService = mock();
    logService = mock();
    memberActionsService = mock();
    isProcessing = signal(false);
    providerActionsService = Object.assign(mock<ProviderActionsService>(), { isProcessing });
    route = mock<ActivatedRoute>();
    route.params = of({ providerId });

    // Assertions use the i18n key, so no English text is assumed.
    i18nService.t.mockImplementation((key: string, ...params: (string | number | undefined)[]) =>
      [key, ...params].filter((p) => p != null).join(" "),
    );
    dialogService.open.mockReturnValue(closedWith());
    dialogService.openSimpleDialog.mockResolvedValue(true);
  });

  // whenStable() also waits out the 200 ms search debounce, so these tests need no fake timers.
  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // Pass a response (or a pending promise for one) when the test needs the loaded member objects.
  async function render({
    members = [],
    queryParams = {},
    untilDebounced = true,
    isCloud = false,
  }: {
    members?: MemberFixture[] | Promise<ListResponse<ProviderUserUserDetailsResponse>>;
    queryParams?: Params;
    untilDebounced?: boolean;
    isCloud?: boolean;
  } = {}) {
    route.queryParams = of(queryParams);
    apiService.getProviderUsers.mockReturnValue(
      Array.isArray(members) ? Promise.resolve(membersResponse(members)) : members,
    );

    await TestBed.configureTestingModule({
      imports: [MembersComponent],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: ApiService, useValue: apiService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
        { provide: ValidationService, useValue: validationService },
        { provide: LogService, useValue: logService },
        { provide: MemberActionsService, useValue: memberActionsService },
        { provide: ProviderActionsService, useValue: providerActionsService },
        { provide: ProviderService, useValue: mock<ProviderService>() },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        {
          provide: EnvironmentService,
          useValue: Object.assign(mock<EnvironmentService>(), {
            environment$: of({ isCloud: () => isCloud } as Environment),
          }),
        },
        UserNamePipe,
      ],
    })
      .overrideComponent(MembersComponent, {
        remove: { imports: [HeaderModule] },
        add: { imports: [StubHeaderComponent] },
      })
      .compileComponents();

    // The virtual scroll area looks for the layout's scroll host; without one it logs an error.
    TestBed.inject(ScrollLayoutService).scrollableRef.set(
      new ElementRef(document.createElement("div")),
    );

    fixture = TestBed.createComponent(MembersComponent);
    if (untilDebounced) {
      await settle();
    } else {
      // Let the load finish, but not the 200 ms search debounce.
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
  }

  const element = (): HTMLElement => fixture.nativeElement;
  const text = () => element().textContent?.replace(/\s+/g, " ") ?? "";
  const showsNoMembersMessage = () => text().includes("noMembersInList");
  const memberTable = () => element().querySelector("bit-table");

  function clickButton(label: string) {
    const button = Array.from(element().querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes(label),
    );
    if (button == null) {
      throw new Error(`the "${label}" button is not rendered`);
    }
    button.click();
  }

  // A real input event marks the component dirty the way a keystroke does in the app.
  function typeInSearch(value: string) {
    const input = element().querySelector<HTMLInputElement>("bit-search input");
    if (input == null) {
      throw new Error("the search input is not rendered");
    }
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }

  function chooseStatus(label: string) {
    const radio = Array.from(element().querySelectorAll("bit-toggle"))
      .find((toggle) => toggle.textContent?.includes(label))
      ?.querySelector<HTMLInputElement>('input[type="radio"]');
    if (radio == null) {
      throw new Error(`the "${label}" status toggle is not rendered`);
    }
    radio.click();
  }

  function selectAllMembers() {
    const checkbox = element().querySelector<HTMLInputElement>('input[aria-label="selectAll"]');
    if (checkbox == null) {
      throw new Error("the select-all checkbox is not rendered");
    }
    checkbox.click();
  }

  // The menu's items live in the overlay once its trigger is clicked.
  function optionsMenuItems() {
    const trigger = element().querySelector<HTMLButtonElement>('th button[aria-label="options"]');
    if (trigger == null) {
      throw new Error("the options menu trigger is not rendered");
    }
    trigger.click();
    fixture.detectChanges();
    return Array.from(
      TestBed.inject(OverlayContainer).getContainerElement().querySelectorAll("button"),
    );
  }

  const labelOf = (item: HTMLElement) => item.textContent?.replace(/\s+/g, " ").trim();
  const optionsMenuChoices = () => optionsMenuItems().map(labelOf);

  function chooseFromOptionsMenu(label: string) {
    const item = optionsMenuItems().find((choice) => labelOf(choice) === label);
    if (item == null) {
      throw new Error(`the "${label}" option is not offered`);
    }
    item.click();
  }

  describe("loading the list", () => {
    it("shows the loading indicator until the members have loaded", async () => {
      let resolveMembers!: (response: ListResponse<ProviderUserUserDetailsResponse>) => void;
      await render({ members: new Promise((resolve) => (resolveMembers = resolve)) });

      expect(text()).toContain("loading");

      resolveMembers(membersResponse([ada]));
      await settle();

      expect(text()).not.toContain("loading");
    });

    it("shows the member table once the members have loaded", async () => {
      await render({ members: [ada, grace] });

      expect(memberTable()).not.toBeNull();
      expect(showsNoMembersMessage()).toBe(false);
    });

    it("shows the no-members message when the provider has no members", async () => {
      await render({ members: [] });

      expect(showsNoMembersMessage()).toBe(true);
      expect(memberTable()).toBeNull();
    });
  });

  describe("filtering the list", () => {
    it("shows the no-members message when a search matches nobody, after the debounce", async () => {
      await render({ members: [ada, grace] });
      expect(memberTable()).not.toBeNull();

      typeInSearch("zzz");
      await settle();

      expect(showsNoMembersMessage()).toBe(true);
      expect(memberTable()).toBeNull();
    });

    it("shows the member table again when the search is cleared", async () => {
      await render({ members: [ada, grace] });
      typeInSearch("zzz");
      await settle();
      expect(showsNoMembersMessage()).toBe(true);

      typeInSearch("");
      await settle();

      expect(memberTable()).not.toBeNull();
      expect(showsNoMembersMessage()).toBe(false);
    });

    it("shows the no-members message when the chosen status has no members", async () => {
      await render({ members: [ada, grace] });
      expect(memberTable()).not.toBeNull();

      chooseStatus("needsConfirmation");
      await settle();

      expect(showsNoMembersMessage()).toBe(true);
      expect(memberTable()).toBeNull();
    });

    it("shows the member table again when the status is set back to all", async () => {
      await render({ members: [ada, grace] });
      chooseStatus("needsConfirmation");
      await settle();
      expect(showsNoMembersMessage()).toBe(true);

      chooseStatus("all");
      await settle();

      expect(memberTable()).not.toBeNull();
      expect(showsNoMembersMessage()).toBe(false);
    });

    it("applies a search from the ?search= query parameter on the first render", async () => {
      await render({
        members: [ada, grace],
        queryParams: { search: "zzz" },
        untilDebounced: false,
      });

      expect(showsNoMembersMessage()).toBe(true);
      expect(memberTable()).toBeNull();
    });
  });

  // jsdom renders no table rows, so row actions are called through the component's public methods.
  describe("acting on a member", () => {
    it("removes the member and confirms it with a toast", async () => {
      const response = membersResponse([ada]);
      await render({ members: Promise.resolve(response) });
      providerActionsService.deleteProviderUser.mockResolvedValue({ success: true });

      await fixture.componentInstance.remove(response.data[0], providerId);

      expect(providerActionsService.deleteProviderUser).toHaveBeenCalledWith(
        providerId,
        response.data[0],
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("shows the no-members message after the last member is removed", async () => {
      const response = membersResponse([ada]);
      await render({ members: Promise.resolve(response) });
      expect(memberTable()).not.toBeNull();
      providerActionsService.deleteProviderUser.mockResolvedValue({ success: true });

      await fixture.componentInstance.remove(response.data[0], providerId);
      await settle();

      expect(showsNoMembersMessage()).toBe(true);
    });

    it("hides the confirm callout once the accepted member is confirmed", async () => {
      const response = membersResponse([ada, alan]);
      await render({ members: Promise.resolve(response) });
      memberActionsService.getPublicKeyForConfirm.mockResolvedValue(new Uint8Array([1, 2, 3]));
      providerActionsService.confirmProvider.mockResolvedValue({ success: true });
      expect(text()).toContain("providerUsersNeedConfirmed");

      await fixture.componentInstance.confirm(response.data[1], providerId);
      await settle();

      expect(text()).not.toContain("providerUsersNeedConfirmed");
    });

    it("reports the error instead of a success toast when removal fails", async () => {
      const response = membersResponse([ada]);
      await render({ members: Promise.resolve(response) });
      providerActionsService.deleteProviderUser.mockResolvedValue({
        success: false,
        error: "removal failed",
      });

      await fixture.componentInstance.remove(response.data[0], providerId);

      expect(validationService.showError).toHaveBeenCalledWith("removal failed");
      expect(logService.error).toHaveBeenCalledWith("removal failed");
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("keeps the member in the list when removal fails", async () => {
      const response = membersResponse([ada]);
      await render({ members: Promise.resolve(response) });
      providerActionsService.deleteProviderUser.mockResolvedValue({
        success: false,
        error: "removal failed",
      });

      await fixture.componentInstance.remove(response.data[0], providerId);
      await settle();

      expect(memberTable()).not.toBeNull();
    });

    it("does not confirm when no public key comes back (cancelled or lookup failed)", async () => {
      const response = membersResponse([alan]);
      await render({ members: Promise.resolve(response) });
      memberActionsService.getPublicKeyForConfirm.mockResolvedValue(undefined);

      await fixture.componentInstance.confirm(response.data[0], providerId);

      expect(logService.warning).toHaveBeenCalledWith("Public key not found");
      expect(providerActionsService.confirmProvider).not.toHaveBeenCalled();
    });
  });

  describe("dialogs", () => {
    it("opens the add dialog from the invite button", async () => {
      await render({ members: [ada] });

      clickButton("inviteMember");
      await settle();

      expect(dialogService.open).toHaveBeenCalledWith(
        AddEditMemberDialogComponent,
        expect.objectContaining({ data: { providerId, user: undefined } }),
      );
    });

    it("reloads the list after the add dialog saves", async () => {
      await render({ members: [ada] });
      dialogService.open.mockReturnValue(closedWith(AddEditMemberDialogResultType.Saved));

      await fixture.componentInstance.edit(providerId);

      expect(apiService.getProviderUsers).toHaveBeenCalledTimes(2);
    });

    it("reloads the list after the edit dialog deletes", async () => {
      const response = membersResponse([ada]);
      await render({ members: Promise.resolve(response) });
      dialogService.open.mockReturnValue(closedWith(AddEditMemberDialogResultType.Deleted));

      await fixture.componentInstance.edit(providerId, response.data[0]);

      expect(apiService.getProviderUsers).toHaveBeenCalledTimes(2);
    });

    it("does not reload the list when the add/edit dialog is closed", async () => {
      const response = membersResponse([ada]);
      await render({ members: Promise.resolve(response) });
      dialogService.open.mockReturnValue(closedWith(AddEditMemberDialogResultType.Closed));

      await fixture.componentInstance.edit(providerId, response.data[0]);

      expect(apiService.getProviderUsers).toHaveBeenCalledTimes(1);
    });

    it("reloads the list after the bulk confirm dialog closes", async () => {
      await render({ members: [alan] });

      await fixture.componentInstance.bulkConfirm(providerId);

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkConfirmDialogComponent,
        expect.objectContaining({ data: expect.objectContaining({ providerId }) }),
      );
      expect(apiService.getProviderUsers).toHaveBeenCalledTimes(2);
    });

    it("reloads the list after the bulk remove dialog closes", async () => {
      await render({ members: [ada] });

      await fixture.componentInstance.bulkRemove(providerId);

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkRemoveDialogComponent,
        expect.objectContaining({ data: expect.objectContaining({ providerId }) }),
      );
      expect(apiService.getProviderUsers).toHaveBeenCalledTimes(2);
    });

    it("opens the events dialog for a confirmed member from ?viewEvents", async () => {
      await render({
        members: [ada, grace],
        queryParams: { viewEvents: ada.id },
      });

      expect(dialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            providerId,
            entityId: ada.id,
            entity: "user",
            showUser: false,
          }),
        }),
      );
    });
  });

  // jsdom renders no table rows, so these use the select-all checkbox and the header's options menu.
  describe("the options menu for selected members", () => {
    it("offers to resend the invitation when the only selected member is invited", async () => {
      await render({ members: [grace] });

      selectAllMembers();
      await settle();

      expect(optionsMenuChoices()).toEqual(["resendInvitation", "remove"]);
    });

    it("offers to re-invite them all when every selected member is invited", async () => {
      await render({ members: [grace, edsger] });

      selectAllMembers();
      await settle();

      expect(optionsMenuChoices()).toEqual(["reinviteSelected", "remove"]);
    });

    it("offers to confirm them when every selected member is awaiting confirmation", async () => {
      await render({ members: [alan] });

      selectAllMembers();
      await settle();

      expect(optionsMenuChoices()).toEqual(["confirmSelected", "remove"]);
    });

    it("offers only removal when the selected members have different statuses", async () => {
      await render({ members: [ada, grace, alan] });

      selectAllMembers();
      await settle();

      expect(optionsMenuChoices()).toEqual(["remove"]);
    });
  });

  describe("resending invitations", () => {
    // Which members are re-invited matters, not the order the table sends them in.
    const reinvitedIds = () =>
      [...apiService.postManyProviderUserReinvite.mock.calls[0][1].ids].sort();

    it("resends the invitation to a member and confirms it with a toast", async () => {
      const response = membersResponse([grace]);
      await render({ members: Promise.resolve(response) });
      providerActionsService.reinviteProvider.mockResolvedValue({ success: true });

      await fixture.componentInstance.reinvite(response.data[0], providerId);

      expect(providerActionsService.reinviteProvider).toHaveBeenCalledWith(
        providerId,
        response.data[0],
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "success",
          message: expect.stringContaining(grace.name),
        }),
      );
    });

    it("re-invites the selected members and shows the progress dialog on a self-hosted server", async () => {
      await render({ members: [grace, edsger] });
      apiService.postManyProviderUserReinvite.mockResolvedValue(
        new ListResponse({ Data: [] }, ProviderUserBulkResponse),
      );
      selectAllMembers();
      await settle();

      chooseFromOptionsMenu("reinviteSelected");
      await settle();

      expect(apiService.postManyProviderUserReinvite).toHaveBeenCalledWith(
        providerId,
        expect.anything(),
      );
      expect(reinvitedIds()).toEqual([edsger.id, grace.id]);
      expect(dialogService.open).toHaveBeenCalledWith(
        BulkStatusComponent,
        expect.objectContaining({
          data: expect.objectContaining({ successfulMessage: "bulkReinviteMessage" }),
        }),
      );
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("sends the invitations straight away and confirms with a toast in the cloud", async () => {
      await render({ members: [grace, edsger], isCloud: true });
      selectAllMembers();
      await settle();

      chooseFromOptionsMenu("reinviteSelected");
      await settle();

      expect(apiService.postManyProviderUserReinvite).toHaveBeenCalledWith(
        providerId,
        expect.anything(),
      );
      expect(reinvitedIds()).toEqual([edsger.id, grace.id]);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "bulkReinviteSentToast 2",
      });
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("confirms a single resent invitation with its own toast in the cloud", async () => {
      await render({ members: [grace], isCloud: true });
      selectAllMembers();
      await settle();

      chooseFromOptionsMenu("resendInvitation");
      await settle();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "reinviteSuccessToast",
      });
    });

    it("re-invites only up to the cloud limit and tells the user how many were left out", async () => {
      const crowd: MemberFixture[] = Array.from({ length: CloudBulkReinviteLimit + 1 }, (_, i) => ({
        id: `member-${i}`,
        name: `Member ${i}`,
        status: ProviderUserStatusType.Invited,
      }));
      const limit = CloudBulkReinviteLimit.toLocaleString();
      const total = crowd.length.toLocaleString();
      await render({ members: crowd, isCloud: true });
      selectAllMembers();
      await settle();

      chooseFromOptionsMenu("reinviteSelected");
      await settle();

      const [, request] = apiService.postManyProviderUserReinvite.mock.calls[0];
      expect(request.ids).toHaveLength(CloudBulkReinviteLimit);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: `bulkReinviteLimitedSuccessToast ${limit} ${total} 1`,
      });
    });

    it("tells the user when none of the selected members can be re-invited", async () => {
      await render({ members: [alan] });
      selectAllMembers();
      await settle();

      // The menu only offers a resend when every selected member is invited, so call it directly.
      await fixture.componentInstance.bulkReinvite(providerId);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "errorOccurred",
        message: "noSelectedUsersApplicable",
      });
      expect(apiService.postManyProviderUserReinvite).not.toHaveBeenCalled();
    });

    it("reports the error when sending the invitations fails", async () => {
      await render({ members: [grace], isCloud: true });
      const failure = new Error("invitations failed");
      apiService.postManyProviderUserReinvite.mockRejectedValue(failure);
      selectAllMembers();
      await settle();

      chooseFromOptionsMenu("resendInvitation");
      await settle();

      expect(validationService.showError).toHaveBeenCalledWith(failure);
      expect(toastService.showToast).not.toHaveBeenCalled();
    });
  });

  describe("the bulk actions in the options menu", () => {
    it("starts the chosen bulk action", async () => {
      await render({ members: [ada] });
      selectAllMembers();
      await settle();

      chooseFromOptionsMenu("remove");
      await settle();

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkRemoveDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            providerId,
            users: [expect.objectContaining({ id: ada.id })],
          }),
        }),
      );
    });

    it("ignores the chosen bulk action while another action is still processing", async () => {
      await render({ members: [ada] });
      selectAllMembers();
      isProcessing.set(true);
      await settle();

      chooseFromOptionsMenu("remove");
      await settle();

      expect(dialogService.open).not.toHaveBeenCalled();
    });
  });
});
