import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { AccessRequestSdkService, LeasingErrorService } from "@bitwarden/bit-pam";
import type { AccessPreCheckView } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import {
  RequestAccessSheetComponent,
  RequestAccessSheetParams,
} from "./request-access-sheet.component";

// bit-dialog's footer border watches the body with an observer jsdom lacks.
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

function preCheck(overrides: Partial<AccessPreCheckView> = {}): AccessPreCheckView {
  return {
    cipherId: "cipher-1",
    approvalMode: "automatic",
    hasActiveLease: false,
    defaultDurationSeconds: 3600,
    maxDurationSeconds: 86_400,
    canStartLease: true,
    ...overrides,
  } as unknown as AccessPreCheckView;
}

describe("RequestAccessSheetComponent", () => {
  let fixture: ComponentFixture<RequestAccessSheetComponent>;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let close: jest.Mock;

  const params: RequestAccessSheetParams = { cipherId: "cipher-1", itemName: "Github" };

  /** Opens the sheet and lets the form's pre-check land. */
  async function create(): Promise<void> {
    fixture = TestBed.createComponent(RequestAccessSheetComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    requestsApi.preCheck.mockResolvedValue(preCheck());
    close = jest.fn().mockResolvedValue({ closed: true });

    TestBed.configureTestingModule({
      imports: [RequestAccessSheetComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: { close } },
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: LeasingErrorService, useValue: { isLeasingError: () => false } },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  it("titles the sheet with the item and summarises the rule's terms", async () => {
    await create();

    const title = query('[data-testid="bit-dialog-title"]')?.textContent;
    expect(title).toContain("pamRequestAccessButton");
    expect(title).toContain("Github");
    const summary = query('[data-testid="request-sheet-summary"]')?.textContent;
    expect(summary).toContain("pamRequestToUse");
    expect(summary).toContain("pamRequestAccessBannerMaxDurationAutomatic 1 day");
  });

  it("offers Send request once the pre-check shapes the form", async () => {
    await create();

    expect(query("#pam-cipher-view-banner_button_request-submit")).not.toBeNull();
  });

  it("offers only Cancel when the pre-check fails", async () => {
    requestsApi.preCheck.mockRejectedValue(new Error("boom"));
    await create();

    expect(query("#pam-cipher-view-banner_button_request-submit")).toBeNull();
    expect(query("#pam-cipher-view-banner_button_request-cancel")).not.toBeNull();
  });

  it("closes without reporting a change from Cancel", async () => {
    await create();

    query("#pam-cipher-view-banner_button_request-cancel")?.click();

    expect(close).toHaveBeenCalledWith(false);
  });

  it("closes and reports a change when the form does", async () => {
    requestsApi.preCheck.mockResolvedValue(preCheck({ hasActiveLease: true }));
    await create();

    expect(close).toHaveBeenCalledWith(true);
  });
});
