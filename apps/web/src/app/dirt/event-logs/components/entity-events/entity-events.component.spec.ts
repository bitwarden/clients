import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventLogApiService } from "@bitwarden/common/dirt/event-logs/services/event-log-api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";

import {
  EventService,
  MEMBER_EVENTS_HREF_PREFIX,
  SEND_EVENTS_HREF_PREFIX,
} from "../../services/event.service";

import { EntityEventsComponent, EntityEventsDialogParams } from "./entity-events.component";

// EntityEventsComponent injects no DialogService, so it can never open a second (stacked) dialog. The
// "no stacked dialogs" contract is that clicking an interactive id re-parameterizes the existing
// instance in place via switchEntity. These tests assert that in-place re-parameterization.
describe("EntityEventsComponent in-dialog navigation (no stacked dialogs)", () => {
  let component: any;
  let loadSpy: jest.SpyInstance;
  let router: ReturnType<typeof mock<Router>>;

  const params: EntityEventsDialogParams = {
    entity: "send",
    entityId: "initial-send",
    organizationId: "org-1",
    showUser: true,
    name: "Send initial",
  };

  beforeEach(() => {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((id: string) => id);
    const eventService = mock<EventService>();
    eventService.getDefaultDateFilters.mockReturnValue(["", ""]);
    router = mock<Router>();

    component = new EntityEventsComponent(
      params,
      mock<ApiService>(),
      mock<EventLogApiService>(),
      i18n,
      eventService,
      mock<UserNamePipe>(),
      mock<LogService>(),
      mock<OrganizationUserApiService>(),
      new FormBuilder(),
      mock<ValidationService>(),
      mock<ToastService>(),
      router,
      mock<ActivatedRoute>(),
      mock<AccountService>(),
      mock<OrganizationService>(),
    );
    component.entity = params.entity;
    component.entityId = params.entityId;
    component.orgUsersUserIdMap = new Map<string, any>([
      ["member-user-id", { name: "Jack Smith", organizationUserId: "org-user-1" }],
    ]);
    // Avoid hitting the API; switchEntity calls load().
    loadSpy = jest.spyOn(component, "load").mockResolvedValue(undefined);
  });

  const clickOnHref = (href: string) => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", href);
    const code = document.createElement("code");
    anchor.appendChild(code);
    return { target: code, preventDefault: jest.fn() } as unknown as Event;
  };

  it("re-parameterizes to the clicked Send in place (and does NOT navigate)", () => {
    component.onEventMessageClick(clickOnHref(SEND_EVENTS_HREF_PREFIX + "send-123"));

    expect(component.entity).toBe("send");
    expect(component.entityId).toBe("send-123");
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("re-focuses on the member in place AND replaces the background with the Members page", () => {
    component.onEventMessageClick(clickOnHref(MEMBER_EVENTS_HREF_PREFIX + "member-user-id"));

    expect(component.entity).toBe("user");
    expect(component.entityId).toBe("org-user-1");
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(["/organizations", "org-1", "members"]);
  });

  it("does nothing when the clicked user id does not resolve to a member", () => {
    component.onEventMessageClick(clickOnHref(MEMBER_EVENTS_HREF_PREFIX + "unknown-id"));

    expect(component.entity).toBe("send");
    expect(loadSpy).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
