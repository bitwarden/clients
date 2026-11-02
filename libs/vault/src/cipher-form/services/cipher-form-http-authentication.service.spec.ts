import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { DialogService } from "@bitwarden/components";

import { CipherFormHTTPAuthenticationService } from "./cipher-form-http-authentication.service";

describe("CipherFormHTTPAuthenticationService", () => {
  let service: CipherFormHTTPAuthenticationService;
  let dialogService: MockProxy<DialogService>;

  beforeEach(() => {
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        CipherFormHTTPAuthenticationService,
        { provide: DialogService, useValue: dialogService },
      ],
    });

    service = TestBed.inject(CipherFormHTTPAuthenticationService);
  });

  describe("updateUriMatchStrategies", () => {
    it("reports that every URI has an explicit match strategy", async () => {
      service.updateUriMatchStrategies([UriMatchStrategy.Host, UriMatchStrategy.Never]);

      expect(await firstValueFrom(service.allUrisHaveExplicitMatchStrategy$)).toBe(true);
    });

    it("reports that every URI has an explicit match strategy when there are no URIs", async () => {
      service.updateUriMatchStrategies([]);

      expect(await firstValueFrom(service.allUrisHaveExplicitMatchStrategy$)).toBe(true);
    });

    it("reports when a URI uses the default match strategy", async () => {
      service.updateUriMatchStrategies([UriMatchStrategy.Host, null]);

      expect(await firstValueFrom(service.allUrisHaveExplicitMatchStrategy$)).toBe(false);
    });

    it("turns HTTP authentication off when a URI uses the default match strategy", () => {
      service.httpAuthenticationControl.setValue(true);

      service.updateUriMatchStrategies([null]);

      expect(service.httpAuthenticationControl.value).toBe(false);
    });

    it("leaves HTTP authentication on when every URI has an explicit match strategy", () => {
      service.httpAuthenticationControl.setValue(true);

      service.updateUriMatchStrategies([UriMatchStrategy.Domain]);

      expect(service.httpAuthenticationControl.value).toBe(true);
    });
  });

  describe("confirmDefaultMatchStrategy", () => {
    it("resolves true without asking when HTTP authentication is off", async () => {
      expect(await service.confirmDefaultMatchStrategy()).toBe(true);
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("turns HTTP authentication off when the user confirms", async () => {
      service.httpAuthenticationControl.setValue(true);

      expect(await service.confirmDefaultMatchStrategy()).toBe(true);
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "useDefaultMatchDetectionTitle" } }),
      );
      expect(service.httpAuthenticationControl.value).toBe(false);
    });

    it("leaves HTTP authentication on when the user declines", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      service.httpAuthenticationControl.setValue(true);

      expect(await service.confirmDefaultMatchStrategy()).toBe(false);
      expect(service.httpAuthenticationControl.value).toBe(true);
    });

    it("does not turn HTTP authentication off for a URI change that is still being confirmed", async () => {
      let resolveDialog: (confirmed: boolean) => void;
      dialogService.openSimpleDialog.mockReturnValue(
        new Promise((resolve) => {
          resolveDialog = resolve;
        }),
      );
      service.httpAuthenticationControl.setValue(true);

      const confirmation = service.confirmDefaultMatchStrategy();
      service.updateUriMatchStrategies([null]);

      expect(service.httpAuthenticationControl.value).toBe(true);

      resolveDialog(false);
      await confirmation;
      service.updateUriMatchStrategies([UriMatchStrategy.Host]);

      expect(service.httpAuthenticationControl.value).toBe(true);
    });
  });

  describe("resolveInitialHTTPAuthentication", () => {
    it("keeps HTTP authentication on when reprompt is off", async () => {
      expect(await service.resolveInitialHTTPAuthentication(true, false)).toBe(true);
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("keeps HTTP authentication off when it is off", async () => {
      expect(await service.resolveInitialHTTPAuthentication(false, true)).toBe(false);
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("turns HTTP authentication off and tells the user when reprompt is also on", async () => {
      expect(await service.resolveInitialHTTPAuthentication(true, true)).toBe(false);
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "httpAuthenticationTurnedOffTitle" },
          cancelButtonText: null,
        }),
      );
    });
  });
});
