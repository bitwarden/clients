import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";
import type {
  AccessPreCheckView,
  AccessRequestResultView,
  CipherAccessStateView,
  LeasingError,
} from "@bitwarden/sdk-internal";

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { CipherLeaseBannerComponent } from "./cipher-lease-banner.component";

describe("CipherLeaseBannerComponent", () => {
  let fixture: ComponentFixture<CipherLeaseBannerComponent>;
  let component: CipherLeaseBannerComponent;
  let enabled$: BehaviorSubject<boolean>;
  let accessRequestSdkService: {
    getCipherAccessState: jest.Mock<Promise<CipherAccessStateView>, [string]>;
    preCheckAccessRequest: jest.Mock<Promise<AccessPreCheckView>, [string]>;
    createAccessRequest: jest.Mock<Promise<AccessRequestResultView>, [string, unknown]>;
    activateAccessRequest: jest.Mock<Promise<unknown>, [string]>;
    cancelAccessRequest: jest.Mock<Promise<void>, [string]>;
  };
  let toastService: { showToast: jest.Mock };

  function create(
    inputs: { cipherId?: string; partial?: boolean; leaseGated?: boolean } = {},
  ): void {
    fixture = TestBed.createComponent(CipherLeaseBannerComponent);
    fixture.componentRef.setInput("cipherId", inputs.cipherId ?? "cipher-1");
    fixture.componentRef.setInput("partial", inputs.partial ?? true);
    fixture.componentRef.setInput("leaseGated", inputs.leaseGated ?? false);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    accessRequestSdkService = {
      getCipherAccessState: jest.fn().mockResolvedValue({}),
      preCheckAccessRequest: jest.fn(),
      createAccessRequest: jest.fn(),
      activateAccessRequest: jest.fn(),
      cancelAccessRequest: jest.fn(),
    };
    toastService = { showToast: jest.fn() };

    TestBed.configureTestingModule({
      imports: [CipherLeaseBannerComponent, NoopAnimationsModule],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccessRequestSdkService, useValue: accessRequestSdkService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: { error: jest.fn() } },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  it("shows the request-access entry point when gated with no lease or request", async () => {
    create();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component["canRequestAccess"]()).toBe(true);
  });

  it("does not show the request-access entry point when the PAM flag is off", async () => {
    enabled$.next(false);
    create();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component["canRequestAccess"]()).toBe(false);
    expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
  });

  it("does not show the request-access entry point for a non-gated cipher", async () => {
    create({ partial: false });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component["canRequestAccess"]()).toBe(false);
  });

  describe("toggleRequestForm", () => {
    it("resolves the automatic workflow via pre-check", async () => {
      create();
      await fixture.whenStable();
      accessRequestSdkService.preCheckAccessRequest.mockResolvedValue({
        cipherId: "cipher-1",
        approvalMode: "automatic",
        hasActiveLease: false,
      } as unknown as AccessPreCheckView);

      await component["toggleRequestForm"]();

      expect(component["requestFormExpanded"]()).toBe(true);
      expect(component["requestMode"]()).toBe("automatic");
      expect(component["isAutomatic"]()).toBe(true);
    });

    it("resolves the human workflow via pre-check", async () => {
      create();
      await fixture.whenStable();
      accessRequestSdkService.preCheckAccessRequest.mockResolvedValue({
        cipherId: "cipher-1",
        approvalMode: "human",
        hasActiveLease: false,
      } as unknown as AccessPreCheckView);

      await component["toggleRequestForm"]();

      expect(component["requestMode"]()).toBe("human");
      expect(component["isAutomatic"]()).toBe(false);
    });

    it("collapses immediately when the pre-check reports an already-active lease", async () => {
      create();
      await fixture.whenStable();
      accessRequestSdkService.preCheckAccessRequest.mockResolvedValue({
        cipherId: "cipher-1",
        approvalMode: "automatic",
        hasActiveLease: true,
      } as unknown as AccessPreCheckView);

      await component["toggleRequestForm"]();

      expect(component["requestFormExpanded"]()).toBe(false);
    });

    it("surfaces a generic error when the pre-check fails", async () => {
      create();
      await fixture.whenStable();
      accessRequestSdkService.preCheckAccessRequest.mockRejectedValue(new Error("boom"));

      await component["toggleRequestForm"]();

      expect(component["requestError"]()).toBe("pamRequestAccessGenericError");
      expect(component["requestMode"]()).toBeNull();
    });
  });

  describe("submitRequest", () => {
    it("submits the automatic body and shows the approved-success toast", async () => {
      create();
      await fixture.whenStable();
      accessRequestSdkService.preCheckAccessRequest.mockResolvedValue({
        cipherId: "cipher-1",
        approvalMode: "automatic",
        hasActiveLease: false,
      } as unknown as AccessPreCheckView);
      await component["toggleRequestForm"]();
      accessRequestSdkService.createAccessRequest.mockResolvedValue({
        approvalMode: "automatic",
        request: { id: "request-1" },
      } as unknown as AccessRequestResultView);

      await component["submitRequest"]();

      expect(accessRequestSdkService.createAccessRequest).toHaveBeenCalledWith(
        "cipher-1",
        expect.objectContaining({ durationSeconds: 3600 }),
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "pamRequestAccessApprovedSuccess" }),
      );
      expect(component["requestFormExpanded"]()).toBe(false);
    });

    it("surfaces the LeasingError message inline on failure", async () => {
      create();
      await fixture.whenStable();
      accessRequestSdkService.preCheckAccessRequest.mockResolvedValue({
        cipherId: "cipher-1",
        approvalMode: "automatic",
        hasActiveLease: false,
      } as unknown as AccessPreCheckView);
      await component["toggleRequestForm"]();
      const leasingError = Object.assign(new Error("A reason is required."), {
        name: "LeasingError",
        variant: "MissingField",
      }) as LeasingError;
      accessRequestSdkService.createAccessRequest.mockRejectedValue(leasingError);

      await component["submitRequest"]();

      expect(component["requestError"]()).toBe("A reason is required.");
    });
  });

  it("activateApprovedRequest activates the approved request and toasts success", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      approvedRequest: { id: "request-1", decisions: [] },
    } as unknown as CipherAccessStateView);
    create();
    await fixture.whenStable();
    fixture.detectChanges();

    await component["activateApprovedRequest"]();

    expect(accessRequestSdkService.activateAccessRequest).toHaveBeenCalledWith("request-1");
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "pamStartLeaseSuccess" }),
    );
  });

  it("cancelRequest cancels a pending request and toasts success", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      pendingRequest: { id: "request-2" },
    } as unknown as CipherAccessStateView);
    create();
    await fixture.whenStable();
    fixture.detectChanges();

    await component["cancelRequest"]();

    expect(accessRequestSdkService.cancelAccessRequest).toHaveBeenCalledWith("request-2");
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "pamMyRequestsCancelSuccess" }),
    );
  });
});
