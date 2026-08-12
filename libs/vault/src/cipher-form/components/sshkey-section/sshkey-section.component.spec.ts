import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AbstractControl, FormGroup } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import { generate_ssh_key } from "@bitwarden/sdk-internal";

import { SshImportPromptService } from "../../../services/ssh-import-prompt.service";
import { SshAgentDestinationSettingsService } from "../../abstractions/ssh-agent-destination-settings.service";
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

  it("does not render the SSH agent destinations section when the optional service is unavailable", async () => {
    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);
    (generate_ssh_key as unknown as jest.Mock).mockReturnValue({
      privateKey: "genPriv",
      publicKey: "genPub",
      fingerprint: "genFp",
    });

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.showDestinationSettings).toBe(false);
    expect(fixture.debugElement.query(By.css('[data-testid="add-destination-button"]'))).toBeNull();
  });
});

describe("SshKeySectionComponent - SSH agent destinations", () => {
  const CIPHER_ID = "cipher-1" as CipherId;

  let fixture: ComponentFixture<SshKeySectionComponent>;
  let component: SshKeySectionComponent;
  const mockI18nService = mock<I18nService>();

  let cipherFormContainer: {
    registerChildForm: jest.Mock;
    patchCipher: jest.Mock;
    getInitialCipherView: jest.Mock;
    formStatusChange$: Subject<string>;
    cipherSaved$: Subject<{ id: string; sshKey?: unknown }>;
  };

  let destinationFingerprintsSubject: BehaviorSubject<string[]>;
  let destinationSettings: {
    destinationFingerprints$: jest.Mock;
    setDestinationFingerprints: jest.Mock;
  };

  let sdkService: { client$: BehaviorSubject<unknown> };
  let sshImportPromptService: { importSshKeyFromClipboard: jest.Mock };
  let platformUtilsService: { getClientType: jest.Mock };

  async function setup(originalCipherView: { edit: boolean; id?: string; sshKey: null } | null) {
    (generate_ssh_key as unknown as jest.Mock).mockReturnValue({
      privateKey: "genPriv",
      publicKey: "genPub",
      fingerprint: "genFp",
    });

    await TestBed.configureTestingModule({
      imports: [SshKeySectionComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: CipherFormContainer, useValue: cipherFormContainer },
        { provide: SdkService, useValue: sdkService },
        { provide: SshImportPromptService, useValue: sshImportPromptService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: SshAgentDestinationSettingsService, useValue: destinationSettings },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SshKeySectionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("originalCipherView", originalCipherView);

    await component.ngOnInit();
    fixture.detectChanges();
  }

  beforeEach(() => {
    (generate_ssh_key as unknown as jest.Mock).mockReset();
    mockI18nService.t.mockImplementation((key: string) => key);

    cipherFormContainer = {
      registerChildForm: jest.fn(),
      patchCipher: jest.fn(),
      getInitialCipherView: jest.fn().mockReturnValue(null),
      formStatusChange$: new Subject<string>(),
      cipherSaved$: new Subject(),
    };

    destinationFingerprintsSubject = new BehaviorSubject<string[]>([]);
    destinationSettings = {
      destinationFingerprints$: jest.fn().mockReturnValue(destinationFingerprintsSubject),
      setDestinationFingerprints: jest.fn().mockResolvedValue(undefined),
    };

    sdkService = { client$: new BehaviorSubject<unknown>({}) };
    sshImportPromptService = { importSshKeyFromClipboard: jest.fn() };
    platformUtilsService = { getClientType: jest.fn().mockReturnValue(ClientType.Desktop) };
  });

  it("renders the section and loads configured fingerprints for an existing cipher", async () => {
    destinationFingerprintsSubject.next(["SHA256:aaaa", "SHA256:bbbb"]);

    await setup({ edit: true, id: CIPHER_ID, sshKey: null });

    expect(destinationSettings.destinationFingerprints$).toHaveBeenCalledWith(CIPHER_ID);
    expect(component.fingerprints.value).toEqual(["SHA256:aaaa", "SHA256:bbbb"]);
    expect(
      fixture.debugElement.query(By.css('[data-testid="add-destination-button"]')),
    ).not.toBeNull();
    // Loading existing state must not persist it back.
    expect(destinationSettings.setDestinationFingerprints).not.toHaveBeenCalled();
  });

  it("registers the destinations form so an invalid fingerprint blocks the parent cipher form, and fixing it restores validity", async () => {
    // Mirrors what CipherFormComponent really does in registerChildForm: attach the child group
    // to the parent FormGroup so its validity is aggregated.
    const cipherForm = new FormGroup({});
    cipherFormContainer.registerChildForm = jest.fn((name: string, group: AbstractControl) => {
      cipherForm.setControl(name, group);
    });

    await setup({ edit: true, id: CIPHER_ID, sshKey: null });

    expect(cipherFormContainer.registerChildForm).toHaveBeenCalledWith(
      "sshAgentDestinations",
      component.destinationsForm,
    );
    expect(cipherForm.valid).toBe(true);

    // A blank placeholder row must not block the form.
    component.addDestinationRow();
    expect(cipherForm.valid).toBe(true);

    // An invalid non-empty fingerprint must block it.
    component.fingerprints.at(0).setValue("not-a-valid-fingerprint");
    expect(cipherForm.valid).toBe(false);

    // Fixing the value restores validity.
    component.fingerprints.at(0).setValue("SHA256:aaaa");
    expect(cipherForm.valid).toBe(true);

    // Removing an invalid row also restores validity.
    component.fingerprints.at(0).setValue("still-invalid");
    expect(cipherForm.valid).toBe(false);
    component.removeDestinationRow(0);
    expect(cipherForm.valid).toBe(true);
  });

  it("never patches destination data into the cipher", async () => {
    await setup({ edit: true, id: CIPHER_ID, sshKey: null });
    cipherFormContainer.patchCipher.mockClear();

    component.addDestinationRow("SHA256:aaaa");
    component.removeDestinationRow(0);

    expect(cipherFormContainer.patchCipher).not.toHaveBeenCalled();
  });

  it("does not persist while the user is editing rows (no save yet)", async () => {
    await setup({ edit: true, id: CIPHER_ID, sshKey: null });

    component.addDestinationRow("SHA256:aaaa");
    component.addDestinationRow("SHA256:bbbb");
    component.removeDestinationRow(0);

    expect(destinationSettings.setDestinationFingerprints).not.toHaveBeenCalled();
  });

  it("leaves persisted destinations unchanged when there's no successful save (cancel)", async () => {
    destinationFingerprintsSubject.next(["SHA256:existing"]);
    await setup({ edit: true, id: CIPHER_ID, sshKey: null });

    component.addDestinationRow("SHA256:aaaa");
    component.removeDestinationRow(0);

    // No cipherSaved$ emission — simulates Cancel/closing the form.
    expect(destinationSettings.setDestinationFingerprints).not.toHaveBeenCalled();
  });

  it("persists normalized destinations after a successful save for an existing cipher", async () => {
    await setup({ edit: true, id: CIPHER_ID, sshKey: null });

    component.addDestinationRow("  SHA256:aaaa  ");
    component.addDestinationRow("SHA256:aaaa");
    component.addDestinationRow("SHA256:bbbb");

    cipherFormContainer.cipherSaved$.next({ id: CIPHER_ID });

    expect(destinationSettings.setDestinationFingerprints).toHaveBeenCalledTimes(1);
    expect(destinationSettings.setDestinationFingerprints).toHaveBeenCalledWith(CIPHER_ID, [
      "SHA256:aaaa",
      "SHA256:bbbb",
    ]);
  });

  it("persists an empty array when all destinations are removed and then saved", async () => {
    destinationFingerprintsSubject.next(["SHA256:aaaa"]);
    await setup({ edit: true, id: CIPHER_ID, sshKey: null });

    component.removeDestinationRow(0);
    expect(destinationSettings.setDestinationFingerprints).not.toHaveBeenCalled();

    cipherFormContainer.cipherSaved$.next({ id: CIPHER_ID });

    expect(destinationSettings.setDestinationFingerprints).toHaveBeenCalledWith(CIPHER_ID, []);
  });

  it("does not persist an invalid fingerprint even if a save event fires", async () => {
    await setup({ edit: true, id: CIPHER_ID, sshKey: null });

    component.addDestinationRow("not-a-valid-fingerprint");
    fixture.detectChanges();

    expect(component.fingerprints.at(0).invalid).toBe(true);
    expect(fixture.debugElement.query(By.css('[data-testid="remove-destination"]'))).not.toBeNull();

    cipherFormContainer.cipherSaved$.next({ id: CIPHER_ID });

    expect(destinationSettings.setDestinationFingerprints).not.toHaveBeenCalled();
  });

  it("shows exactly one translated validation error for an invalid, touched fingerprint, and clears it once fixed", async () => {
    await setup({ edit: true, id: CIPHER_ID, sshKey: null });

    component.addDestinationRow("not-a-valid-fingerprint");
    // bit-form-field only renders the error once the control has been touched (matches real
    // blur behavior); markAsTouched simulates that here.
    component.fingerprints.at(0).markAsTouched();
    fixture.detectChanges();

    expect(component.fingerprints.at(0).invalid).toBe(true);
    let errors = fixture.debugElement.queryAll(By.css("bit-error"));
    expect(errors.length).toBe(1);
    expect(errors[0].nativeElement.textContent).toContain("invalidSshAgentDestinationFingerprint");

    component.fingerprints.at(0).setValue("SHA256:aaaa");
    fixture.detectChanges();

    expect(component.fingerprints.at(0).invalid).toBe(false);
    errors = fixture.debugElement.queryAll(By.css("bit-error"));
    expect(errors.length).toBe(0);
  });

  it("persists pending fingerprints for a new cipher once it receives an ID", async () => {
    await setup({ edit: true, sshKey: null });

    component.addDestinationRow("SHA256:aaaa");
    expect(destinationSettings.setDestinationFingerprints).not.toHaveBeenCalled();

    cipherFormContainer.cipherSaved$.next({ id: CIPHER_ID });

    expect(destinationSettings.setDestinationFingerprints).toHaveBeenCalledWith(CIPHER_ID, [
      "SHA256:aaaa",
    ]);
  });

  it("persists again on every subsequent successful save, keeping later edits pending until then", async () => {
    await setup({ edit: true, id: CIPHER_ID, sshKey: null });

    component.addDestinationRow("SHA256:aaaa");
    cipherFormContainer.cipherSaved$.next({ id: CIPHER_ID });
    destinationSettings.setDestinationFingerprints.mockClear();

    // Edits after the first save must stay pending...
    component.addDestinationRow("SHA256:bbbb");
    expect(destinationSettings.setDestinationFingerprints).not.toHaveBeenCalled();

    // ...until the next successful save persists them.
    cipherFormContainer.cipherSaved$.next({ id: CIPHER_ID });
    expect(destinationSettings.setDestinationFingerprints).toHaveBeenCalledWith(CIPHER_ID, [
      "SHA256:aaaa",
      "SHA256:bbbb",
    ]);
  });
});
