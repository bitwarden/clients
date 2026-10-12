// IntersectionObserver is not available in JSDOM; mock it so DialogComponent scroll detection doesn't throw.
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";

import { EmergencyAccessBulkTrustComponent } from "./emergency-access-bulk-trust.component";

describe("EmergencyAccessBulkTrustComponent", () => {
  let fixture: ComponentFixture<EmergencyAccessBulkTrustComponent>;
  let component: EmergencyAccessBulkTrustComponent;

  let mockDialogRef: MockProxy<DialogRef<string[] | undefined>>;
  let mockLegacyCompatKeyService: MockProxy<LegacyCompatKeyService>;
  let mockLogService: MockProxy<LogService>;

  const contacts = [
    { id: "ea-1", granteeId: "grantee-1", name: "one@example.com", publicKey: new Uint8Array(1) },
    { id: "ea-2", granteeId: "grantee-2", name: "two@example.com", publicKey: new Uint8Array(2) },
  ];

  beforeEach(async () => {
    mockDialogRef = mock<DialogRef<string[] | undefined>>();
    mockLegacyCompatKeyService = mock<LegacyCompatKeyService>();
    mockLogService = mock<LogService>();

    mockLegacyCompatKeyService.getFingerprint.mockImplementation(async (granteeId) => [
      granteeId,
      "phrase",
    ]);

    await TestBed.configureTestingModule({
      imports: [EmergencyAccessBulkTrustComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { contacts } },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: LegacyCompatKeyService, useValue: mockLegacyCompatKeyService },
        { provide: LogService, useValue: mockLogService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmergencyAccessBulkTrustComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it("computes the fingerprint phrase of each contact", () => {
    expect(mockLegacyCompatKeyService.getFingerprint).toHaveBeenCalledWith(
      "grantee-1",
      contacts[0].publicKey,
    );
    expect(mockLegacyCompatKeyService.getFingerprint).toHaveBeenCalledWith(
      "grantee-2",
      contacts[1].publicKey,
    );
    expect(component["fingerprints"]()).toEqual({
      "ea-1": "grantee-1-phrase",
      "ea-2": "grantee-2-phrase",
    });
  });

  it("selects all contacts by default", async () => {
    await component["submit"]();

    expect(mockDialogRef.close).toHaveBeenCalledWith(["ea-1", "ea-2"]);
  });

  it("returns only the selected contacts", async () => {
    component["trustForm"].controls["ea-1"].setValue(false);

    await component["submit"]();

    expect(mockDialogRef.close).toHaveBeenCalledWith(["ea-2"]);
  });

  it("logs and continues when a fingerprint cannot be computed", async () => {
    mockLegacyCompatKeyService.getFingerprint.mockRejectedValueOnce(new Error("failure"));

    const failingFixture = TestBed.createComponent(EmergencyAccessBulkTrustComponent);
    failingFixture.detectChanges();
    await failingFixture.whenStable();

    expect(mockLogService.error).toHaveBeenCalled();
    expect(failingFixture.componentInstance["fingerprints"]()).toEqual({
      "ea-2": "grantee-2-phrase",
    });
    expect(failingFixture.componentInstance["loading"]()).toBe(false);
  });
});
