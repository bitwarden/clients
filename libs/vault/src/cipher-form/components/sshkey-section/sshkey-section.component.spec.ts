import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import { generate_ssh_key } from "@bitwarden/sdk-internal";

import { SshImportPromptService } from "../../../services/ssh-import-prompt.service";
import { CipherFormContainer } from "../../cipher-form-container";

import { SshKeySectionComponent } from "./sshkey-section.component";

jest.mock("@bitwarden/sdk-internal", () => {
  return {
    generate_ssh_key: jest.fn(),
  };
});

describe("SshKeySectionComponent", () => {
  let fixture: ComponentFixture<SshKeySectionComponent>;
  let component: SshKeySectionComponent;
  const mockI18nService = mock<I18nService>();

  let formStatusChange$: Subject<string>;

  let cipherFormContainer: {
    registerChildForm: jest.Mock;
    patchCipher: jest.Mock;
    getInitialCipherView: jest.Mock;
    formStatusChange$: Subject<string>;
  };

  let sdkClient$: BehaviorSubject<unknown>;
  let sdkService: { client$: BehaviorSubject<unknown> };

  let sshImportPromptService: { importSshKeyFromClipboard: jest.Mock };

  let platformUtilsService: { getClientType: jest.Mock };

  beforeEach(async () => {
    formStatusChange$ = new Subject<string>();

    cipherFormContainer = {
      registerChildForm: jest.fn(),
      patchCipher: jest.fn(),
      getInitialCipherView: jest.fn(),
      formStatusChange$,
    };

    sdkClient$ = new BehaviorSubject<unknown>({});
    sdkService = { client$: sdkClient$ };

    sshImportPromptService = {
      importSshKeyFromClipboard: jest.fn(),
    };

    platformUtilsService = {
      getClientType: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SshKeySectionComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: CipherFormContainer, useValue: cipherFormContainer },
        { provide: SdkService, useValue: sdkService },
        { provide: SshImportPromptService, useValue: sshImportPromptService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SshKeySectionComponent);
    component = fixture.componentInstance;

    // minimal required inputs
    fixture.componentRef.setInput("originalCipherView", { edit: true, sshKey: null });
    fixture.componentRef.setInput("disabled", false);

    (generate_ssh_key as unknown as jest.Mock).mockReset();
  });

  it("registers the sshKeyDetails form with the container in the constructor", () => {
    expect(cipherFormContainer.registerChildForm).toHaveBeenCalledTimes(1);
    expect(cipherFormContainer.registerChildForm).toHaveBeenCalledWith(
      "sshKeyDetails",
      component.sshKeyForm,
    );
  });

  it("patches cipher sshKey whenever the form changes", () => {
    component.sshKeyForm.setValue({
      privateKey: "priv",
      publicKey: "pub",
      keyFingerprint: "fp",
    });

    expect(cipherFormContainer.patchCipher).toHaveBeenCalledTimes(1);
    const patchFn = cipherFormContainer.patchCipher.mock.calls[0][0] as (c: any) => any;

    const cipher: any = {};
    const patched = patchFn(cipher);

    expect(patched.sshKey).toBeInstanceOf(SshKeyView);
    expect(patched.sshKey.privateKey).toBe("priv");
    expect(patched.sshKey.publicKey).toBe("pub");
    expect(patched.sshKey.keyFingerprint).toBe("fp");
  });

  it("ngOnInit uses initial cipher sshKey (prefill) when present and does not generate", async () => {
    cipherFormContainer.getInitialCipherView.mockReturnValue({
      sshKey: { privateKey: "p1", publicKey: "p2", keyFingerprint: "p3" },
    });

    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

    await component.ngOnInit();

    expect(generate_ssh_key).not.toHaveBeenCalled();
    expect(component.sshKeyForm.get("privateKey")?.value).toBe("p1");
    expect(component.sshKeyForm.get("publicKey")?.value).toBe("p2");
    expect(component.sshKeyForm.get("keyFingerprint")?.value).toBe("p3");
  });

  it("ngOnInit falls back to originalCipherView sshKey when prefill is missing", async () => {
    cipherFormContainer.getInitialCipherView.mockReturnValue(null);
    fixture.componentRef.setInput("originalCipherView", {
      edit: true,
      sshKey: { privateKey: "o1", publicKey: "o2", keyFingerprint: "o3" },
    });

    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

    await component.ngOnInit();

    expect(generate_ssh_key).not.toHaveBeenCalled();
    expect(component.sshKeyForm.get("privateKey")?.value).toBe("o1");
    expect(component.sshKeyForm.get("publicKey")?.value).toBe("o2");
    expect(component.sshKeyForm.get("keyFingerprint")?.value).toBe("o3");
  });

  it("ngOnInit generates an ssh key when no sshKey exists and populates the form", async () => {
    cipherFormContainer.getInitialCipherView.mockReturnValue(null);
    fixture.componentRef.setInput("originalCipherView", { edit: true, sshKey: null });

    (generate_ssh_key as unknown as jest.Mock).mockReturnValue({
      privateKey: "genPriv",
      publicKey: "genPub",
      fingerprint: "genFp",
    });

    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

    await component.ngOnInit();

    expect(generate_ssh_key).toHaveBeenCalledTimes(1);
    expect(generate_ssh_key).toHaveBeenCalledWith("Ed25519");
    expect(component.sshKeyForm.get("privateKey")?.value).toBe("genPriv");
    expect(component.sshKeyForm.get("publicKey")?.value).toBe("genPub");
    expect(component.sshKeyForm.get("keyFingerprint")?.value).toBe("genFp");
  });

  it("ngOnInit disables the form", async () => {
    cipherFormContainer.getInitialCipherView.mockReturnValue({
      sshKey: { privateKey: "p1", publicKey: "p2", keyFingerprint: "p3" },
    });
    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

    await component.ngOnInit();

    expect(component.sshKeyForm.disabled).toBe(true);
  });

  it("sets showImport true when not Web and originalCipherView.edit is true", async () => {
    cipherFormContainer.getInitialCipherView.mockReturnValue({
      sshKey: { privateKey: "p1", publicKey: "p2", keyFingerprint: "p3" },
    });

    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);
    fixture.componentRef.setInput("originalCipherView", { edit: true, sshKey: null } as any);

    await component.ngOnInit();

    expect(component.showImport()).toBe(true);
  });

  it("keeps showImport false when client type is Web", async () => {
    cipherFormContainer.getInitialCipherView.mockReturnValue({
      sshKey: { privateKey: "p1", publicKey: "p2", keyFingerprint: "p3" },
    });

    platformUtilsService.getClientType.mockReturnValue(ClientType.Web);
    fixture.componentRef.setInput("originalCipherView", { edit: true, sshKey: null } as any);

    await component.ngOnInit();

    expect(component.showImport()).toBe(false);
  });

  it("disables the ssh key form when formStatusChange emits enabled", async () => {
    cipherFormContainer.getInitialCipherView.mockReturnValue({
      sshKey: { privateKey: "p1", publicKey: "p2", keyFingerprint: "p3" },
    });

    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

    await component.ngOnInit();

    component.sshKeyForm.enable();
    expect(component.sshKeyForm.disabled).toBe(false);

    formStatusChange$.next("enabled");
    expect(component.sshKeyForm.disabled).toBe(true);
  });

  it("renders the import button only when showImport is true", async () => {
    cipherFormContainer.getInitialCipherView.mockReturnValue({
      sshKey: { privateKey: "p1", publicKey: "p2", keyFingerprint: "p3" },
    });

    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);
    fixture.componentRef.setInput("originalCipherView", { edit: true, sshKey: null } as any);

    await component.ngOnInit();
    fixture.detectChanges();

    const importBtn = fixture.debugElement.query(By.css('[data-testid="import-privateKey"]'));
    expect(importBtn).not.toBeNull();
  });

  it("importSshKeyFromClipboard sets form values when a key is returned", async () => {
    sshImportPromptService.importSshKeyFromClipboard.mockResolvedValue({
      privateKey: "cPriv",
      publicKey: "cPub",
      keyFingerprint: "cFp",
    });

    await component.importSshKeyFromClipboard();

    expect(component.sshKeyForm.get("privateKey")?.value).toBe("cPriv");
    expect(component.sshKeyForm.get("publicKey")?.value).toBe("cPub");
    expect(component.sshKeyForm.get("keyFingerprint")?.value).toBe("cFp");
  });

  it("importSshKeyFromClipboard does nothing when null is returned", async () => {
    component.sshKeyForm.setValue({ privateKey: "a", publicKey: "b", keyFingerprint: "c" });
    sshImportPromptService.importSshKeyFromClipboard.mockResolvedValue(null);

    await component.importSshKeyFromClipboard();

    expect(component.sshKeyForm.get("privateKey")?.value).toBe("a");
    expect(component.sshKeyForm.get("publicKey")?.value).toBe("b");
    expect(component.sshKeyForm.get("keyFingerprint")?.value).toBe("c");
  });
});
