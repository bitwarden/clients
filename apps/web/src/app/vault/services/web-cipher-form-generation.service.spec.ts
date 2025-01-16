import { DialogRef } from "@angular/cdk/dialog";
import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { DialogService } from "@bitwarden/components";

import { WebVaultGeneratorDialogComponent } from "../components/web-generator-dialog/web-generator-dialog.component";

import { WebCipherFormGenerationService } from "./web-cipher-form-generation.service";

describe("WebCipherFormGenerationService", () => {
  let service: WebCipherFormGenerationService;
  let dialogService: jest.Mocked<DialogService>;
  let closed = of({});
  const close = jest.fn();
  const dialogRef = {
    close,
    get closed() {
      return closed;
    },
  } as unknown as DialogRef<unknown, unknown>;

  beforeEach(() => {
    dialogService = mock<DialogService>();

    TestBed.configureTestingModule({
      providers: [
        WebCipherFormGenerationService,
        { provide: DialogService, useValue: dialogService },
      ],
    });

    service = TestBed.inject(WebCipherFormGenerationService);
  });

  it("creates without error", () => {
    expect(service).toBeTruthy();
  });

  describe("generatePassword", () => {
    it("opens the password generator dialog and returns the generated value", async () => {
      const generatedValue = "generated-password";
      closed = of({ action: "generated", generatedValue });
      dialogService.open.mockReturnValue(dialogRef);

      const result = await service.generatePassword();

      expect(dialogService.open).toHaveBeenCalledWith(WebVaultGeneratorDialogComponent, {
        data: { type: "password" },
      });
      expect(result).toBe(generatedValue);
    });

    it("returns null if the dialog is canceled", async () => {
      closed = of({ action: "canceled" });
      dialogService.open.mockReturnValue(dialogRef);

      const result = await service.generatePassword();

      expect(result).toBeNull();
    });
  });

  describe("generateUsername", () => {
    it("opens the username generator dialog and returns the generated value", async () => {
      const generatedValue = "generated-username";
      closed = of({ action: "generated", generatedValue });
      dialogService.open.mockReturnValue(dialogRef);

      const result = await service.generateUsername();

      expect(dialogService.open).toHaveBeenCalledWith(WebVaultGeneratorDialogComponent, {
        data: { type: "username" },
      });
      expect(result).toBe(generatedValue);
    });

    it("returns null if the dialog is canceled", async () => {
      closed = of({ action: "canceled" });
      dialogService.open.mockReturnValue(dialogRef);

      const result = await service.generateUsername();

      expect(result).toBeNull();
    });
  });
});
