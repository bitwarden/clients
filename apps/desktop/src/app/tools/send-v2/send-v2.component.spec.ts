// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SendListFiltersService } from "@bitwarden/send-ui";

import * as utils from "../../../utils";
import { SearchBarService } from "../../layout/search/search-bar.service";
import { AddEditComponent } from "../send/add-edit.component";

import { SendV2Component } from "./send-v2.component";

// Mock the invokeMenu utility function
jest.mock("../../../utils", () => ({
  invokeMenu: jest.fn(),
}));

describe("SendV2Component", () => {
  let component: SendV2Component;
  let fixture: ComponentFixture<SendV2Component>;
  let sendService: MockProxy<SendService>;
  let searchBarService: MockProxy<SearchBarService>;
  let broadcasterService: MockProxy<BroadcasterService>;
  let accountService: MockProxy<AccountService>;
  let policyService: MockProxy<PolicyService>;
  let sendListFiltersService: SendListFiltersService;
  let changeDetectorRef: MockProxy<ChangeDetectorRef>;

  beforeEach(async () => {
    sendService = mock<SendService>();
    searchBarService = mock<SearchBarService>();
    broadcasterService = mock<BroadcasterService>();
    accountService = mock<AccountService>();
    policyService = mock<PolicyService>();
    changeDetectorRef = mock<ChangeDetectorRef>();

    // Create real SendListFiltersService with mocked dependencies
    const formBuilder = new FormBuilder();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);
    sendListFiltersService = new SendListFiltersService(i18nService, formBuilder);

    // Mock sendViews$ observable
    sendService.sendViews$ = of([]);
    searchBarService.searchText$ = new BehaviorSubject<string>("");

    // Mock activeAccount$ observable for parent class ngOnInit
    accountService.activeAccount$ = of({ id: "test-user-id" } as any);
    policyService.policyAppliesToUser$ = jest.fn().mockReturnValue(of(false));

    // Mock SearchService methods needed by base component
    const mockSearchService = mock<SearchService>();
    mockSearchService.isSearchable.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [SendV2Component],
      providers: [
        { provide: SendService, useValue: sendService },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: BroadcasterService, useValue: broadcasterService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: PolicyService, useValue: policyService },
        { provide: SearchBarService, useValue: searchBarService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: SendApiService, useValue: mock<SendApiService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: AccountService, useValue: accountService },
        { provide: SendListFiltersService, useValue: sendListFiltersService },
        { provide: ChangeDetectorRef, useValue: changeDetectorRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendV2Component);
    component = fixture.componentInstance;
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("initializes with correct default action", () => {
    expect(component.action).toBe("");
  });

  it("subscribes to broadcaster service on init", async () => {
    await component.ngOnInit();
    expect(broadcasterService.subscribe).toHaveBeenCalledWith(
      "SendV2Component",
      expect.any(Function),
    );
  });

  it("unsubscribes from broadcaster service on destroy", () => {
    component.ngOnDestroy();
    expect(broadcasterService.unsubscribe).toHaveBeenCalledWith("SendV2Component");
  });

  it("enables search bar on init", async () => {
    await component.ngOnInit();
    expect(searchBarService.setEnabled).toHaveBeenCalledWith(true);
  });

  it("disables search bar on destroy", () => {
    component.ngOnDestroy();
    expect(searchBarService.setEnabled).toHaveBeenCalledWith(false);
  });

  describe("addSend", () => {
    it("sets action to Add", async () => {
      await component.addSend();
      expect(component.action).toBe("add");
    });

    it("calls resetAndLoad on addEditComponent when component exists", async () => {
      const mockAddEdit = mock<AddEditComponent>();
      component.addEditComponent = mockAddEdit;

      await component.addSend();

      expect(mockAddEdit.resetAndLoad).toHaveBeenCalled();
    });

    it("does not throw when addEditComponent is null", async () => {
      component.addEditComponent = null;
      await expect(component.addSend()).resolves.not.toThrow();
    });
  });

  describe("cancel", () => {
    it("resets action to None", () => {
      component.action = "edit";
      component.sendId = "test-id";

      component.cancel(new SendView());

      expect(component.action).toBe("");
      expect(component.sendId).toBeNull();
    });
  });

  describe("deletedSend", () => {
    it("refreshes the list and resets action and sendId", async () => {
      component.action = "edit";
      component.sendId = "test-id";
      jest.spyOn(component, "refresh").mockResolvedValue();

      const mockSend = new SendView();
      await component.deletedSend(mockSend);

      expect(component.refresh).toHaveBeenCalled();
      expect(component.action).toBe("");
      expect(component.sendId).toBeNull();
    });
  });

  describe("savedSend", () => {
    it("refreshes the list and selects the saved send", async () => {
      jest.spyOn(component, "refresh").mockResolvedValue();
      jest.spyOn(component, "selectSend").mockResolvedValue();

      const mockSend = new SendView();
      mockSend.id = "saved-send-id";

      await component.savedSend(mockSend);

      expect(component.refresh).toHaveBeenCalled();
      expect(component.selectSend).toHaveBeenCalledWith("saved-send-id");
    });
  });

  describe("selectSend", () => {
    it("sets action to Edit and updates sendId", async () => {
      await component.selectSend("new-send-id");

      expect(component.action).toBe("edit");
      expect(component.sendId).toBe("new-send-id");
    });

    it("updates addEditComponent when it exists", async () => {
      const mockAddEdit = mock<AddEditComponent>();
      component.addEditComponent = mockAddEdit;

      await component.selectSend("test-send-id");

      expect(mockAddEdit.sendId).toBe("test-send-id");
      expect(mockAddEdit.refresh).toHaveBeenCalled();
    });

    it("does not reload if same send is already selected in edit mode", async () => {
      const mockAddEdit = mock<AddEditComponent>();
      component.addEditComponent = mockAddEdit;
      component.sendId = "same-id";
      component.action = "edit";

      await component.selectSend("same-id");

      expect(mockAddEdit.refresh).not.toHaveBeenCalled();
    });

    it("reloads if selecting different send", async () => {
      const mockAddEdit = mock<AddEditComponent>();
      component.addEditComponent = mockAddEdit;
      component.sendId = "old-id";
      component.action = "edit";

      await component.selectSend("new-id");

      expect(mockAddEdit.refresh).toHaveBeenCalled();
    });
  });

  describe("selectedSendType", () => {
    it("returns the type of the currently selected send", () => {
      const mockSend1 = new SendView();
      mockSend1.id = "send-1";
      mockSend1.type = SendType.Text;

      const mockSend2 = new SendView();
      mockSend2.id = "send-2";
      mockSend2.type = SendType.File;

      component.sends = [mockSend1, mockSend2];
      component.sendId = "send-2";

      expect(component.selectedSendType).toBe(SendType.File);
    });

    it("returns undefined when no send is selected", () => {
      component.sends = [];
      component.sendId = "non-existent";

      expect(component.selectedSendType).toBeUndefined();
    });

    it("returns undefined when sendId is null", () => {
      const mockSend = new SendView();
      mockSend.id = "send-1";
      mockSend.type = SendType.Text;

      component.sends = [mockSend];
      component.sendId = null;

      expect(component.selectedSendType).toBeUndefined();
    });
  });

  describe("viewSendMenu", () => {
    let mockSend: SendView;

    beforeEach(() => {
      mockSend = new SendView();
      mockSend.id = "test-send";
      mockSend.name = "Test Send";
      jest.clearAllMocks();
    });

    it("creates menu with copy link option", () => {
      jest.spyOn(component, "copy").mockResolvedValue();

      component.viewSendMenu(mockSend);

      expect(utils.invokeMenu).toHaveBeenCalled();
      const menuItems = (utils.invokeMenu as jest.Mock).mock.calls[0][0];
      expect(menuItems.length).toBeGreaterThanOrEqual(2); // At minimum: copy link + delete
    });

    it("includes remove password option when send has password and is not disabled", () => {
      mockSend.password = "test-password";
      mockSend.disabled = false;
      jest.spyOn(component, "removePassword").mockResolvedValue(true);

      component.viewSendMenu(mockSend);

      expect(utils.invokeMenu).toHaveBeenCalled();
      const menuItems = (utils.invokeMenu as jest.Mock).mock.calls[0][0];
      expect(menuItems.length).toBe(3); // copy link + remove password + delete
    });

    it("excludes remove password option when send has no password", () => {
      mockSend.password = null;
      mockSend.disabled = false;

      component.viewSendMenu(mockSend);

      expect(utils.invokeMenu).toHaveBeenCalled();
      const menuItems = (utils.invokeMenu as jest.Mock).mock.calls[0][0];
      expect(menuItems.length).toBe(2); // copy link + delete (no remove password)
    });

    it("excludes remove password option when send is disabled", () => {
      mockSend.password = "test-password";
      mockSend.disabled = true;

      component.viewSendMenu(mockSend);

      expect(utils.invokeMenu).toHaveBeenCalled();
      const menuItems = (utils.invokeMenu as jest.Mock).mock.calls[0][0];
      expect(menuItems.length).toBe(2); // copy link + delete (no remove password)
    });

    it("always includes delete option", () => {
      jest.spyOn(component, "delete").mockResolvedValue(true);
      jest.spyOn(component, "deletedSend").mockResolvedValue();

      component.viewSendMenu(mockSend);

      expect(utils.invokeMenu).toHaveBeenCalled();
      const menuItems = (utils.invokeMenu as jest.Mock).mock.calls[0][0];
      // Delete is always the last item in the menu
      expect(menuItems.length).toBeGreaterThan(0);
      expect(menuItems[menuItems.length - 1]).toHaveProperty("label");
      expect(menuItems[menuItems.length - 1]).toHaveProperty("click");
    });
  });

  describe("search bar subscription", () => {
    it("updates searchText when search bar text changes", () => {
      const searchSubject = new BehaviorSubject<string>("initial");
      searchBarService.searchText$ = searchSubject;

      // Create new component to trigger constructor subscription
      fixture = TestBed.createComponent(SendV2Component);
      component = fixture.componentInstance;

      searchSubject.next("new search text");

      expect(component.searchText).toBe("new search text");
    });
  });

  describe("load", () => {
    it("sets loading states correctly", async () => {
      jest.spyOn(component, "search").mockResolvedValue();

      expect(component.loaded).toBeFalsy();

      await component.load();

      expect(component.loading).toBe(false);
      expect(component.loaded).toBe(true);
    });

    it("sets up sendViews$ subscription", async () => {
      const mockSends = [new SendView(), new SendView()];
      sendService.sendViews$ = of(mockSends);
      jest.spyOn(component, "search").mockResolvedValue();

      await component.load();

      // Give observable time to emit
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(component.sends).toEqual(mockSends);
    });

    it("calls onSuccessfulLoad when it is set", async () => {
      jest.spyOn(component, "search").mockResolvedValue();
      const mockCallback = jest.fn().mockResolvedValue(undefined);
      component.onSuccessfulLoad = mockCallback;

      await component.load();

      expect(mockCallback).toHaveBeenCalled();
    });
  });
});
