// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SendItemsService, SendListFiltersService } from "@bitwarden/send-ui";

import { AddEditComponent } from "../send/add-edit.component";

import { SendV2Component } from "./send-v2.component";

describe("SendV2Component", () => {
  let component: SendV2Component;
  let fixture: ComponentFixture<SendV2Component>;
  let sendService: MockProxy<SendService>;
  let accountService: MockProxy<AccountService>;
  let policyService: MockProxy<PolicyService>;
  let sendItemsService: MockProxy<SendItemsService>;
  let sendListFiltersService: MockProxy<SendListFiltersService>;
  let changeDetectorRef: MockProxy<ChangeDetectorRef>;

  beforeEach(async () => {
    sendService = mock<SendService>();
    accountService = mock<AccountService>();
    policyService = mock<PolicyService>();
    changeDetectorRef = mock<ChangeDetectorRef>();

    // Mock SendItemsService with all required observables
    sendItemsService = mock<SendItemsService>();
    sendItemsService.filteredAndSortedSends$ = of([]);
    sendItemsService.loading$ = of(false);
    sendItemsService.emptyList$ = of(false);
    sendItemsService.noFilteredResults$ = of(false);
    sendItemsService.latestSearchText$ = of("");

    // Mock SendListFiltersService
    sendListFiltersService = mock<SendListFiltersService>();

    // Mock sendViews$ observable
    sendService.sendViews$ = of([]);

    // Mock activeAccount$ observable
    accountService.activeAccount$ = of({ id: "test-user-id" } as any);
    policyService.policyAppliesToUser$ = jest.fn().mockReturnValue(of(false));

    // Mock SearchService methods needed by base component
    const mockSearchService = mock<SearchService>();
    mockSearchService.isSearchable.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [SendV2Component],
      providers: [
        provideNoopAnimations(),
        { provide: SendService, useValue: sendService },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: SearchService, useValue: mockSearchService },
        { provide: PolicyService, useValue: policyService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: SendApiService, useValue: mock<SendApiService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: AccountService, useValue: accountService },
        { provide: SendItemsService, useValue: sendItemsService },
        { provide: SendListFiltersService, useValue: sendListFiltersService },
        { provide: ChangeDetectorRef, useValue: changeDetectorRef },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendV2Component);
    component = fixture.componentInstance;
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("initializes with correct default action", () => {
    expect(component.action()).toBe("");
  });

  describe("addSend", () => {
    it("sets action to Add", async () => {
      await component.addSend(SendType.Text);
      expect(component.action()).toBe("add");
    });

    it("calls resetAndLoad on addEditComponent when component exists", async () => {
      const mockAddEdit = mock<AddEditComponent>();
      mockAddEdit.resetAndLoad.mockResolvedValue();
      jest.spyOn(component as any, "addEditComponent").mockReturnValue(mockAddEdit);

      await component.addSend(SendType.Text);

      expect(mockAddEdit.resetAndLoad).toHaveBeenCalled();
    });

    it("does not throw when addEditComponent is null", async () => {
      jest.spyOn(component as any, "addEditComponent").mockReturnValue(undefined);
      await expect(component.addSend(SendType.Text)).resolves.not.toThrow();
    });
  });

  describe("closeEditPanel", () => {
    it("resets action to None", () => {
      component["action"].set("edit");
      component["sendId"].set("test-id");

      component["closeEditPanel"]();

      expect(component["action"]()).toBe("");
      expect(component["sendId"]()).toBeNull();
    });
  });

  describe("savedSend", () => {
    it("selects the saved send", async () => {
      jest.spyOn(component as any, "selectSend").mockResolvedValue();

      const mockSend = new SendView();
      mockSend.id = "saved-send-id";

      await component["savedSend"](mockSend);

      expect(component["selectSend"]).toHaveBeenCalledWith("saved-send-id");
    });
  });

  describe("selectSend", () => {
    it("sets action to Edit and updates sendId", async () => {
      await component["selectSend"]("new-send-id");

      expect(component["action"]()).toBe("edit");
      expect(component["sendId"]()).toBe("new-send-id");
    });

    it("updates addEditComponent when it exists", async () => {
      const mockAddEdit = mock<AddEditComponent>();
      mockAddEdit.refresh.mockResolvedValue();
      jest.spyOn(component as any, "addEditComponent").mockReturnValue(mockAddEdit);

      await component["selectSend"]("test-send-id");

      expect(mockAddEdit.sendId).toBe("test-send-id");
      expect(mockAddEdit.refresh).toHaveBeenCalled();
    });

    it("does not reload if same send is already selected in edit mode", async () => {
      const mockAddEdit = mock<AddEditComponent>();
      jest.spyOn(component as any, "addEditComponent").mockReturnValue(mockAddEdit);
      component["sendId"].set("same-id");
      component["action"].set("edit");

      await component["selectSend"]("same-id");

      expect(mockAddEdit.refresh).not.toHaveBeenCalled();
    });

    it("reloads if selecting different send", async () => {
      const mockAddEdit = mock<AddEditComponent>();
      mockAddEdit.refresh.mockResolvedValue();
      jest.spyOn(component as any, "addEditComponent").mockReturnValue(mockAddEdit);
      component["sendId"].set("old-id");
      component["action"].set("edit");

      await component["selectSend"]("new-id");

      expect(mockAddEdit.refresh).toHaveBeenCalled();
    });
  });

  describe("onEditSend", () => {
    it("selects the send for editing", async () => {
      jest.spyOn(component as any, "selectSend").mockResolvedValue();
      const mockSend = new SendView();
      mockSend.id = "edit-send-id";

      await component["onEditSend"](mockSend);

      expect(component["selectSend"]).toHaveBeenCalledWith("edit-send-id");
    });
  });
});
