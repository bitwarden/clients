import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { ToastService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer, EncryptService, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { SendAccessFileComponent } from "./send-access-file.component";

describe("SendAccessFileComponent", () => {
  let component: SendAccessFileComponent;
  let fixture: ComponentFixture<SendAccessFileComponent>;
  const i18nService = mock<I18nService>();
  const toastService = mock<ToastService>();
  const encryptService = mock<EncryptService>();
  const fileDownloadService = mock<FileDownloadService>();
  const sendApiService = mock<SendApiService>();
  const environmentService = mock<EnvironmentService>();

  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.resetAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    global.fetch = jest.fn();
    global.Request = jest
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => ({ url, ...init })) as any;
    fetchSpy = jest.spyOn(global, "fetch");
    environmentService.environment$ = of({
      getApiUrl: () => "https://api.bitwarden.com",
    } as Environment);

    await TestBed.configureTestingModule({
      imports: [SendAccessFileComponent],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
        { provide: EncryptService, useValue: encryptService },
        { provide: FileDownloadService, useValue: fileDownloadService },
        { provide: SendApiService, useValue: sendApiService },
        { provide: EnvironmentService, useValue: environmentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendAccessFileComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("send", {
      file: { fileName: "example.txt" },
    } as SendAccessView);
    fixture.componentRef.setInput("decKey", mock<SymmetricCryptoKey>());
    fixture.componentRef.setInput("accessToken", { token: "token" } as any);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("blocks a download url that isn't https and never calls fetch", async () => {
    sendApiService.getSendFileDownloadData.mockResolvedValue({ url: "http://example.com/file" });

    await component["download"]();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "sendDownloadBlocked" }),
    );
  });

  it("blocks a download url that targets a restricted host and never calls fetch", async () => {
    sendApiService.getSendFileDownloadData.mockResolvedValue({
      url: "https://169.254.169.254/file",
    });

    await component["download"]();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "sendDownloadBlocked" }),
    );
  });

  it("does not block a download url on the same origin as the trusted api, even over http", async () => {
    environmentService.environment$ = of({
      getApiUrl: () => "http://bw.internal/api",
    } as Environment);
    sendApiService.getSendFileDownloadData.mockResolvedValue({
      url: "http://bw.internal/download",
    });
    fetchSpy.mockResolvedValue({ status: 200 } as Response);
    jest.spyOn(EncArrayBuffer, "fromResponse").mockResolvedValue(mock<EncArrayBuffer>());
    encryptService.decryptFileData.mockResolvedValue(new Uint8Array());

    await component["download"]();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ url: "http://bw.internal/download" }),
    );
  });

  it("fetches a safe https download url", async () => {
    sendApiService.getSendFileDownloadData.mockResolvedValue({
      url: "https://example.blob.core.windows.net/file",
    });
    fetchSpy.mockResolvedValue({ status: 200 } as Response);
    jest.spyOn(EncArrayBuffer, "fromResponse").mockResolvedValue(mock<EncArrayBuffer>());
    encryptService.decryptFileData.mockResolvedValue(new Uint8Array());

    await component["download"]();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.blob.core.windows.net/file" }),
    );
    expect(fileDownloadService.download).toHaveBeenCalled();
  });

  it("does not follow redirects, so a validated host can't redirect the download elsewhere", async () => {
    sendApiService.getSendFileDownloadData.mockResolvedValue({
      url: "https://example.blob.core.windows.net/file",
    });
    fetchSpy.mockResolvedValue({ status: 200 } as Response);
    jest.spyOn(EncArrayBuffer, "fromResponse").mockResolvedValue(mock<EncArrayBuffer>());
    encryptService.decryptFileData.mockResolvedValue(new Uint8Array());

    await component["download"]();

    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ redirect: "manual" }));
  });
});
