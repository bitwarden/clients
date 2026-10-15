import { createComponent, EnvironmentInjector, Injector } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

// The dialog's footer border watches scrolling with an observer jsdom doesn't have.
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationScopedApiKeyCreatedResponse } from "@bitwarden/common/admin-console/models/response/organization-scoped-api-key-created.response";
import { OrganizationScopedApiKeyResponse } from "@bitwarden/common/admin-console/models/response/organization-scoped-api-key.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  SimpleDialogOptions,
  ToastService,
} from "@bitwarden/components";

import { ScopedApiKeyCreateDialogComponent } from "./scoped-api-key-create-dialog.component";
import { ScopedApiKeySecretDialogComponent } from "./scoped-api-key-secret-dialog.component";
import { ScopedApiKeysComponent } from "./scoped-api-keys.component";

const organizationId = "org-id";

const keyResponse = (
  id: string,
  name: string,
  scopes: string[],
  expireAt: string | null = null,
) => ({
  object: "scopedApiKey",
  id,
  clientId: `organization.${organizationId}.${id}`,
  name,
  scopes,
  expireAt,
  creationDate: "2026-10-01T12:00:00Z",
});

const listOf = (...keys: object[]) =>
  new ListResponse({ data: keys, continuationToken: null }, OrganizationScopedApiKeyResponse);

describe("ScopedApiKeysComponent", () => {
  let fixture: ComponentFixture<ScopedApiKeysComponent>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let dialogService: MockProxy<DialogService>;
  let flag$: BehaviorSubject<boolean>;

  const render = async () => {
    fixture = TestBed.createComponent(ScopedApiKeysComponent);
    fixture.componentRef.setInput("organizationId", organizationId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? "";

  beforeEach(async () => {
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    dialogService = mock<DialogService>();
    flag$ = new BehaviorSubject(true);

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(flag$ as any);

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string, ...params: unknown[]) =>
      params.length ? `${key}(${params.join(",")})` : key,
    );

    await TestBed.configureTestingModule({
      imports: [ScopedApiKeysComponent],
      providers: [
        { provide: OrganizationApiServiceAbstraction, useValue: organizationApiService },
        { provide: ConfigService, useValue: configService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: i18nService },
        { provide: ValidationService, useValue: mock<ValidationService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        provideNoopAnimations(),
      ],
    })
      // DialogModule provides its own DialogService, so a root provider isn't enough.
      .overrideProvider(DialogService, { useValue: dialogService })
      .compileComponents();
  });

  it("hides the section and doesn't load keys when the feature flag is off", async () => {
    flag$.next(false);

    await render();

    expect(text()).not.toContain("scopedApiKeys");
    expect(organizationApiService.getScopedApiKeys).not.toHaveBeenCalled();
  });

  it("lists the organization's keys with readable scopes", async () => {
    organizationApiService.getScopedApiKeys.mockResolvedValue(
      listOf(keyResponse("key-1", "Directory sync", ["api.organization.members.read"])),
    );

    await render();

    expect(organizationApiService.getScopedApiKeys).toHaveBeenCalledWith(organizationId);
    expect(text()).toContain("Directory sync");
    expect(text()).toContain("scopedApiKeyScopeLabel(members,scopedApiKeyScopeRead)");
  });

  it("marks keys whose expiration has passed as expired", async () => {
    organizationApiService.getScopedApiKeys.mockResolvedValue(
      listOf(keyResponse("key-1", "Old key", [], "2000-01-01T00:00:00Z")),
    );

    await render();

    expect(text()).toContain("expired");
  });

  it("doesn't mark keys that haven't expired yet", async () => {
    organizationApiService.getScopedApiKeys.mockResolvedValue(
      listOf(keyResponse("key-1", "New key", [], "2099-01-01T00:00:00Z")),
    );

    await render();

    expect(text()).not.toContain("expired");
  });

  describe("revoke", () => {
    const revokeButton = () =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        "#scoped-api-keys_button_revoke-key-1",
      )!;

    beforeEach(() => {
      organizationApiService.getScopedApiKeys
        .mockResolvedValueOnce(listOf(keyResponse("key-1", "Directory sync", [])))
        .mockResolvedValue(listOf());
    });

    it("revokes the key and removes it from the list once the owner confirms", async () => {
      dialogService.openSimpleDialog.mockImplementation(async (options: SimpleDialogOptions) => {
        await options.acceptAction!();
        return true;
      });
      await render();

      revokeButton().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(organizationApiService.revokeScopedApiKey).toHaveBeenCalledWith(
        organizationId,
        "key-1",
      );
      expect(text()).not.toContain("Directory sync");
    });

    it("doesn't revoke the key when the owner cancels", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      await render();

      revokeButton().click();
      await fixture.whenStable();

      expect(organizationApiService.revokeScopedApiKey).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    const created = new OrganizationScopedApiKeyCreatedResponse({
      ...keyResponse("key-2", "SIEM", [
        "api.organization.events.read",
        "api.organization.members.read",
      ]),
      object: "scopedApiKeyCreated",
      clientSecret: "the-client-secret",
    });

    const createButton = () =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        "#scoped-api-keys_button_create",
      )!;
    const doneButton = () =>
      document.querySelector<HTMLButtonElement>("#scoped-api-key-secret-dialog_button_done")!;

    let secretDialogOpen = false;

    // Renders the real secret dialog behind a ref that, like the CDK one, only closes via close().
    const openSecretDialog = (config: DialogConfig) => {
      const closed$ = new Subject<unknown>();
      const dialogRef = {
        disableClose: config.disableClose,
        closed: closed$.asObservable(),
        close: async (result?: unknown) => {
          secretDialogOpen = false;
          closed$.next(result);
          closed$.complete();
          dialogComponent.destroy();
          dialogComponent.location.nativeElement.remove();
          return { closed: true };
        },
      } as DialogRef;
      const dialogComponent = createComponent(ScopedApiKeySecretDialogComponent, {
        environmentInjector: TestBed.inject(EnvironmentInjector),
        elementInjector: Injector.create({
          providers: [
            { provide: DIALOG_DATA, useValue: config.data },
            { provide: DialogRef, useValue: dialogRef },
          ],
        }),
      });
      document.body.appendChild(dialogComponent.location.nativeElement);
      dialogComponent.changeDetectorRef.detectChanges();
      secretDialogOpen = true;
      return dialogRef;
    };

    beforeEach(async () => {
      organizationApiService.getScopedApiKeys.mockResolvedValue(listOf());
      dialogService.open.mockImplementation((component, config) =>
        component === ScopedApiKeyCreateDialogComponent
          ? ({ closed: of(created) } as DialogRef<any, any>)
          : openSecretDialog(config!),
      );
      await render();

      createButton().click();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    afterEach(async () => {
      // Settle the pending create action before the fixture is torn down.
      if (secretDialogOpen) {
        doneButton().click();
        await fixture.whenStable();
      }
      document.body.innerHTML = "";
    });

    it("shows the new client ID, secret and scope in a dialog that can't be dismissed by accident", () => {
      expect(dialogService.open).toHaveBeenLastCalledWith(
        ScopedApiKeySecretDialogComponent,
        expect.objectContaining({
          data: {
            name: "SIEM",
            clientId: `organization.${organizationId}.key-2`,
            clientSecret: "the-client-secret",
            scope: "api.organization.events.read api.organization.members.read",
          },
          disableClose: true,
        }),
      );
    });

    it("closes the secret dialog with Done and lets the owner create another key", async () => {
      doneButton().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(doneButton()).toBeNull();
      expect(createButton().getAttribute("aria-disabled")).toBeNull();
    });

    it("doesn't keep the secret on the page after the dialog closes", async () => {
      doneButton().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(text()).not.toContain("the-client-secret");
    });
  });
});
