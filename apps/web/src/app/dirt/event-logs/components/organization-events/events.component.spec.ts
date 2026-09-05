import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

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

import { HeaderModule } from "../../../../layouts/header/header.module";
import { EventExportService } from "../../../../tools/event-export";
import {
  EventService,
  MEMBER_EVENTS_HREF_PREFIX,
  SEND_EVENTS_HREF_PREFIX,
} from "../../services/event.service";

import { EventsComponent } from "./events.component";

describe("EventsComponent Send access linking", () => {
  let component: any;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let router: ReturnType<typeof mock<Router>>;

  beforeEach(() => {
    const eventService = mock<EventService>();
    eventService.getDefaultDateFilters.mockReturnValue(["", ""]);
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((id: string) => id);
    dialogService = mock<DialogService>();
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
      dialogService,
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

  // A click whose target is a <code> inside an <a href="…">, mirroring the interactive-id links in messages.
  const clickOnHref = (href: string) => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", href);
    const code = document.createElement("code");
    anchor.appendChild(code);
    return { target: code, preventDefault: jest.fn() } as unknown as Event;
  };

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

    it("does NOT link non-Send events", () => {
      const e = { type: EventType.Cipher_Created, actingUserId: "member-user-id" } as EventView;
      expect(component.isSendAccessMemberLink(e)).toBe(false);
    });
  });

  describe("linkableMemberIds (gates the Send creator id link)", () => {
    it("returns the ids of confirmed members", () => {
      const ids = component.linkableMemberIds();
      expect(ids.has("member-user-id")).toBe(true);
      expect(ids.has("creator-user-id")).toBe(true);
    });

    it("excludes ids that do not resolve to a confirmed member", () => {
      expect(component.linkableMemberIds().has("unknown-id")).toBe(false);
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

  describe("interactive id clicks open a dialog in place", () => {
    it("opens a Send-scoped events dialog when a Send id is clicked (and does NOT navigate)", () => {
      component.onEventMessageClick(clickOnHref(SEND_EVENTS_HREF_PREFIX + "send-123"));

      expect(dialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ entity: "send", entityId: "send-123" }),
        }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("opens the member dialog and navigates to Members when a creator id is clicked", () => {
      component.onEventMessageClick(clickOnHref(MEMBER_EVENTS_HREF_PREFIX + "member-user-id"));

      expect(dialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            entity: "user",
            entityId: "org-user-1",
            showUser: true,
          }),
        }),
      );
      expect(router.navigate).toHaveBeenCalledWith(["/organizations", "org-1", "members"]);
    });

    it("opens the member dialog and navigates to Members when a member name is clicked", () => {
      component.memberNameClicked(
        { preventDefault: jest.fn() } as unknown as Event,
        "member-user-id",
      );

      expect(dialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ entity: "user", entityId: "org-user-1" }),
        }),
      );
      expect(router.navigate).toHaveBeenCalledWith(["/organizations", "org-1", "members"]);
    });

    it("does nothing when the clicked user id does not resolve to a member", () => {
      component.memberNameClicked({ preventDefault: jest.fn() } as unknown as Event, "unknown-id");

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-header",
  template: "<div></div>",
})
class MockHeaderComponent {}

describe("EventsComponent Export button", () => {
  let fixture: ComponentFixture<EventsComponent>;

  beforeEach(async () => {
    // The template-only assertions below don't need the data load; ngOnInit needs a live route
    // and org lookup, neither of which affect the Export button's rendering.
    jest.spyOn(EventsComponent.prototype, "ngOnInit").mockResolvedValue(undefined);

    const eventService = mock<EventService>();
    eventService.getDefaultDateFilters.mockReturnValue(["", ""]);
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((id: string) => id);
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = new BehaviorSubject(null);
    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));
    const activatedRoute = mock<ActivatedRoute>();
    activatedRoute.params = of({});
    activatedRoute.paramMap = of(convertToParamMap({}));
    // The component library's DialogModule providers are instantiated for real (they live in the
    // component's own environment injector), so the Router mock needs a usable url/events.
    const router = mock<Router>();
    router.url = "/";
    router.events = of();

    await TestBed.configureTestingModule({
      imports: [EventsComponent],
      providers: [
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: EventService, useValue: eventService },
        { provide: I18nService, useValue: i18nService },
        { provide: EventExportService, useValue: mock<EventExportService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: UserNamePipe, useValue: mock<UserNamePipe>() },
        { provide: OrganizationService, useValue: organizationService },
        { provide: OrganizationUserApiService, useValue: mock<OrganizationUserApiService>() },
        {
          provide: OrganizationApiServiceAbstraction,
          useValue: mock<OrganizationApiServiceAbstraction>(),
        },
        { provide: ProviderService, useValue: mock<ProviderService>() },
        { provide: FileDownloadService, useValue: mock<FileDownloadService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: AccountService, useValue: accountService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: Router, useValue: router },
      ],
    })
      .overrideComponent(EventsComponent, {
        remove: { imports: [HeaderModule] },
        add: { imports: [MockHeaderComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EventsComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    // The ngOnInit spy is installed on the shared prototype, so it has to be restored to keep it
    // from leaking into any describe block added below this one.
    jest.restoreAllMocks();
  });

  const exportButton = () =>
    fixture.debugElement
      .queryAll(By.css("button[bitButton]"))
      .find((button) => button.nativeElement.textContent.trim() === "exportVerb");

  it("renders the export (bwi-import) icon, not the sign-in icon", () => {
    const icon = exportButton().query(By.css("i.bwi"));

    expect(icon).not.toBeNull();
    expect(icon.nativeElement.classList).toContain("bwi-import");
    expect(icon.nativeElement.classList).not.toContain("bwi-sign-in");
  });
});
