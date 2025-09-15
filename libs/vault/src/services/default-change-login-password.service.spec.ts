/**
 * Jest needs to run in custom environment to mock Request/Response objects
 * @jest-environment ../../libs/shared/test.environment.ts
 */

import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { DefaultChangeLoginPasswordService } from "./default-change-login-password.service";

describe("DefaultChangeLoginPasswordService", () => {
  let service: DefaultChangeLoginPasswordService;

  const mockApiService = mock<ApiService>();
  const mockDomainSettingsService = mock<DomainSettingsService>();

  const showFavicons$ = new BehaviorSubject<boolean>(true);

  beforeEach(() => {
    mockApiService.fetch.mockClear();
    mockApiService.fetch.mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ uri: null }) } as Response),
    );

    mockDomainSettingsService.showFavicons$ = showFavicons$;

    const mockEnvironmentService = {
      environment$: of({
        getIconsUrl: () => "https://icons.bitwarden.com",
      } as Environment),
    } as EnvironmentService;

    service = new DefaultChangeLoginPasswordService(
      mockApiService,
      mockEnvironmentService,
      mockDomainSettingsService,
    );
  });

  it("should return null for non-login ciphers", async () => {
    const cipher = {
      type: CipherType.Card,
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBeNull();
  });

  it("should return null for logins with no URIs", async () => {
    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), { uris: [] as LoginUriView[] }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBeNull();
  });

  it("should return null for logins with no valid HTTP/HTTPS URIs", async () => {
    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "ftp://example.com" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBeNull();
  });

  it("should call the icons url endpoint", async () => {
    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com" }],
      }),
    } as CipherView;

    await service.getChangePasswordUrl(cipher);

    expect(mockApiService.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://icons.bitwarden.com/change-password-uri?uri=https%3A%2F%2Fexample.com%2F",
      }),
    );
  });

  it("should return the original URI when unable to verify the response", async () => {
    mockApiService.fetch.mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ uri: null }) } as Response),
    );

    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com/" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBe("https://example.com/");
  });

  it("should return the well known change url from the response", async () => {
    mockApiService.fetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ uri: "https://example.com/.well-known/change-password" }),
      } as Response);
    });

    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com/" }, { uri: "https://working.com/" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBe("https://example.com/.well-known/change-password");
  });

  it("should try the next URI if the first one fails", async () => {
    mockApiService.fetch.mockImplementation((request) => {
      if (request.url.includes("no-wellknown.com")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ uri: null }),
        } as Response);
      }

      if (request.url.includes("working.com")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ uri: "https://working.com/.well-known/change-password" }),
        } as Response);
      }

      throw new Error("Unexpected request");
    });

    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://no-wellknown.com/" }, { uri: "https://working.com/" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBe("https://working.com/.well-known/change-password");
  });

  it("returns the first URI when `showFavicons$` setting is disabled", async () => {
    showFavicons$.next(false);

    const cipher = {
      type: CipherType.Login,
      login: Object.assign(new LoginView(), {
        uris: [{ uri: "https://example.com/" }, { uri: "https://another.com/" }],
      }),
    } as CipherView;

    const url = await service.getChangePasswordUrl(cipher);

    expect(url).toBe("https://example.com/");
    expect(mockApiService.fetch).not.toHaveBeenCalled();
  });
});
