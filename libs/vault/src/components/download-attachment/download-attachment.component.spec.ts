import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CipherType } from "@bitwarden/common/vault/enums";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { PasswordRepromptService } from "../../services/password-reprompt.service";

import { DownloadAttachmentComponent } from "./download-attachment.component";

class MockRequest {
  constructor(public url: string) {}
}

describe("DownloadAttachmentComponent", () => {
  let component: DownloadAttachmentComponent;
  let fixture: ComponentFixture<DownloadAttachmentComponent>;
  const activeUserId$ = new BehaviorSubject("888-333-222-222");
  const showToast = jest.fn();
  const getAttachmentData = jest
    .fn()
    .mockResolvedValue({ url: "https://www.downloadattachement.com" });
  const download = jest.fn();

  const attachment = {
    id: "222-3333-4444",
    url: "https://www.attachment.com",
    fileName: "attachment-filename",
    size: "1234",
  } as AttachmentView;

  const cipherView = {
    id: "5555-444-3333",
    type: CipherType.Login,
    name: "Test Login",
    login: {
      username: "username",
      password: "password",
    },
  } as CipherView;

  beforeEach(async () => {
    showToast.mockClear();
    getAttachmentData.mockClear();
    download.mockClear();

    await TestBed.configureTestingModule({
      imports: [DownloadAttachmentComponent],
      providers: [
        { provide: EncryptService, useValue: mock<EncryptService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: StateProvider, useValue: { activeUserId$ } },
        { provide: ToastService, useValue: { showToast } },
        { provide: ApiService, useValue: { getAttachmentData } },
        { provide: FileDownloadService, useValue: { download } },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DownloadAttachmentComponent);
    component = fixture.componentInstance;
    component.attachment = attachment;
    component.cipher = cipherView;
    fixture.detectChanges();
  });

  it("renders delete button", () => {
    const deleteButton = fixture.debugElement.query(By.css("button"));

    expect(deleteButton.attributes["title"]).toBe("downloadAttachmentName");
  });

  describe("download attachment", () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
      fetchMock = jest.fn().mockResolvedValue({});
      global.fetch = fetchMock;
      // Request is not defined in the Jest runtime
      // eslint-disable-next-line no-global-assign
      Request = MockRequest as any;
    });

    it("uses the attachment url when available when getAttachmentData returns a 404", async () => {
      getAttachmentData.mockRejectedValue(new ErrorResponse({}, 404));

      await component.download();

      expect(fetchMock).toHaveBeenCalledWith({ url: attachment.url });
    });

    it("calls file download service with the attachment url", async () => {
      getAttachmentData.mockResolvedValue({ url: "https://www.downloadattachement.com" });
      fetchMock.mockResolvedValue({ status: 200 });
      EncArrayBuffer.fromResponse = jest.fn().mockResolvedValue({});

      await component.download();

      expect(download).toHaveBeenCalledWith({ blobData: undefined, fileName: attachment.fileName });
    });

    describe("errors", () => {
      it("shows an error toast when fetch fails", async () => {
        getAttachmentData.mockResolvedValue({ url: "https://www.downloadattachement.com" });
        fetchMock.mockResolvedValue({ status: 500 });

        await component.download();

        expect(showToast).toHaveBeenCalledWith({
          message: "errorOccurred",
          title: null,
          variant: "error",
        });
      });

      it("shows an error toast when EncArrayBuffer fails", async () => {
        getAttachmentData.mockResolvedValue({ url: "https://www.downloadattachement.com" });
        fetchMock.mockResolvedValue({ status: 200 });
        EncArrayBuffer.fromResponse = jest.fn().mockRejectedValue({});

        await component.download();

        expect(showToast).toHaveBeenCalledWith({
          message: "errorOccurred",
          title: null,
          variant: "error",
        });
      });
    });
  });
});
