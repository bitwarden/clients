import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventType, EventView } from "@bitwarden/common/dirt/event-logs";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { EventExportService } from "../../../../tools/event-export";
import { EventService } from "../../services/event.service";

import { EventsComponent } from "./events.component";

describe("EventsComponent Send access member linking", () => {
  let component: any;
  let router: ReturnType<typeof mock<Router>>;

  beforeEach(() => {
    const eventService = mock<EventService>();
    eventService.getDefaultDateFilters.mockReturnValue(["", ""]);
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((id: string) => id);
    router = mock<Router>();

    component = new EventsComponent(
      mock<ApiService>(),
      mock<ActivatedRoute>(),
      eventService,
      i18n,
      mock<EventExportService>(),
      mock<PlatformUtilsService>(),
      mock<LogService>(),
      mock<UserNamePipe>(),
      mock<OrganizationService>(),
      mock<OrganizationUserApiService>(),
      mock<OrganizationApiServiceAbstraction>(),
      mock<ProviderService>(),
      mock<FileDownloadService>(),
      mock<ToastService>(),
      mock<AccountService>(),
      mock<DialogService>(),
      mock<ConfigService>(),
      mock<ActivatedRoute>(),
      router,
    );

    component.organizationId = "org-1";
    component.orgUsersUserIdMap = new Map<string, any>([
      [
        "member-user-id",
        { name: "Jack Smith", email: "jack@org.com", organizationUserId: "org-user-1" },
      ],
      [
        "creator-user-id",
        { name: "Pat Owner", email: "pat@org.com", organizationUserId: "org-user-2" },
      ],
    ]);
  });

  const sendAccess = (over: Partial<EventView>): EventView =>
    ({ type: EventType.Send_Accessed_Text, ...over }) as EventView;

  describe("isSendAccessMemberLink", () => {
    it("links when the accessor is a confirmed member", () => {
      const e = sendAccess({ actingUserId: "member-user-id", userId: "member-user-id" });
      expect(component.isSendAccessMemberLink(e)).toBe(true);
    });

    it("does NOT link an external access even when the creator is a member (regression)", () => {
      // External accessor: actingUserId is null; EventView.userId falls back to the creator (a member).
      const e = sendAccess({ actingUserId: null, userId: "creator-user-id" });
      expect(component.isSendAccessMemberLink(e)).toBe(false);
    });

    it("does NOT link a claimed-domain (non-member) access", () => {
      const e = sendAccess({ actingUserId: null, userId: "creator-user-id" });
      expect(component.isSendAccessMemberLink(e)).toBe(false);
    });

    it("does NOT link non-Send events", () => {
      const e = { type: EventType.Cipher_Created, actingUserId: "member-user-id" } as EventView;
      expect(component.isSendAccessMemberLink(e)).toBe(false);
    });
  });

  describe("getUserName (Send access Member column)", () => {
    it("returns the member for a confirmed-member accessor", () => {
      const user = component.getUserName(
        { type: EventType.Send_Accessed_Text, actingUserId: "member-user-id" },
        "member-user-id",
      );
      expect(user.name).toBe("Jack Smith");
    });

    it("returns the claimed-domain label when not a member but domain is present", () => {
      const user = component.getUserName(
        { type: EventType.Send_Accessed_Text, actingUserId: null, domainName: "acme.com" },
        "creator-user-id",
      );
      expect(user.name).toBe("sendAccessExternalDomain");
    });

    it("returns the generic External label otherwise", () => {
      const user = component.getUserName(
        { type: EventType.Send_Accessed_File, actingUserId: null, domainName: null },
        "creator-user-id",
      );
      expect(user.name).toBe("sendAccessExternal");
    });
  });

  describe("navigateToMember", () => {
    it("navigates to the member's events using the resolved organization user id", async () => {
      await component.navigateToMember("member-user-id");
      expect(router.navigate).toHaveBeenCalledWith(["/organizations", "org-1", "members"], {
        queryParams: { search: "org-user", viewEvents: "org-user-1" },
      });
    });

    it("does nothing when the platform user id does not resolve to a member", async () => {
      await component.navigateToMember("unknown-user-id");
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
