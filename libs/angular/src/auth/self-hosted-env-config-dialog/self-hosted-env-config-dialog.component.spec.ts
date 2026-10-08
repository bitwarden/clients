import { TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { ClientCertificateSettingsService } from "../services/client-certificate-settings.service";

import { SelfHostedEnvConfigDialogComponent } from "./self-hosted-env-config-dialog.component";

describe("Self-hosted certificate activation", () => {
  function setup(pending: boolean) {
    const certificates = mock<ClientCertificateSettingsService>();
    certificates.supported.mockReturnValue(true);
    certificates.status.mockResolvedValue({
      ok: true,
      value: { state: pending ? "restart-pending" : "ready" },
    });
    certificates.restart.mockResolvedValue({ ok: true, value: undefined });
    const environment = mock<EnvironmentService>();
    environment.globalEnvironment$ = of();
    environment.setEnvironment.mockResolvedValue(null);
    const dialog = mock<DialogRef<boolean>>();
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      ],
    });
    const component = TestBed.runInInjectionContext(
      () =>
        new SelfHostedEnvConfigDialogComponent(
          dialog,
          new FormBuilder(),
          environment,
          certificates,
          mock<DialogService>(),
        ),
    );
    component.baseUrl.setValue("https://vault.example");
    component.ngOnInit();
    return { component, certificates, environment, dialog };
  }

  it("saves the edited server URLs before restarting for a pending binding", async () => {
    const { component, certificates, environment, dialog } = setup(true);
    await Promise.resolve();
    await component.submit();
    expect(environment.setEnvironment).toHaveBeenCalled();
    expect(certificates.restart).toHaveBeenCalledTimes(1);
    expect(environment.setEnvironment.mock.invocationCallOrder[0]).toBeLessThan(
      certificates.restart.mock.invocationCallOrder[0],
    );
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it("saves normally without restarting when no binding is pending", async () => {
    const { component, certificates, dialog } = setup(false);
    await Promise.resolve();
    await component.submit();
    expect(certificates.restart).not.toHaveBeenCalled();
    expect(dialog.close).toHaveBeenCalledWith(true);
  });

  it("keeps the dialog open when restart fails", async () => {
    const { component, certificates, dialog } = setup(true);
    certificates.restart.mockResolvedValue({ ok: false, error: { code: "backend-failed" } });
    await Promise.resolve();
    await component.submit();
    expect(dialog.close).not.toHaveBeenCalled();
    expect(component["restartError"]).toBe(true);
  });
});
