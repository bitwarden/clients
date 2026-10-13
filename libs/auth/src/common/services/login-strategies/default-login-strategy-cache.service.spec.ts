import { firstValueFrom } from "rxjs";

import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";

import { DefaultLoginStrategyCacheService } from "./default-login-strategy-cache.service";
import {
  CACHE_EXPIRATION_KEY,
  CACHE_KEY,
  CURRENT_LOGIN_STRATEGY_KEY,
} from "./login-strategy.state";

describe("DefaultLoginStrategyCacheService", () => {
  let sut: DefaultLoginStrategyCacheService;
  let stateProvider: FakeGlobalStateProvider;

  beforeEach(() => {
    stateProvider = new FakeGlobalStateProvider();
    sut = new DefaultLoginStrategyCacheService(stateProvider);
  });

  describe("setCurrentAuthType", () => {
    it("should update the current auth type state", async () => {
      await sut.setCurrentAuthType(AuthenticationType.Password);

      const state = stateProvider.getFake(CURRENT_LOGIN_STRATEGY_KEY);
      const result = await firstValueFrom(state.state$);
      expect(result).toBe(AuthenticationType.Password);
    });

    it("should emit through currentAuthType$", async () => {
      await sut.setCurrentAuthType(AuthenticationType.Sso);

      const result = await firstValueFrom(sut.currentAuthType$);
      expect(result).toBe(AuthenticationType.Sso);
    });
  });

  describe("setCacheData", () => {
    it("should update the cache data state", async () => {
      const data = { password: {} as any };
      await sut.setCacheData(data);

      const state = stateProvider.getFake(CACHE_KEY);
      const result = await firstValueFrom(state.state$);
      expect(result).toEqual(data);
    });

    it("should emit through cacheData$", async () => {
      const data = { sso: {} as any };
      await sut.setCacheData(data);

      const result = await firstValueFrom(sut.cacheData$);
      expect(result).toEqual(data);
    });
  });

  describe("setCacheExpiration", () => {
    it("should update the cache expiration state", async () => {
      const date = new Date("2026-01-01");
      await sut.setCacheExpiration(date);

      const state = stateProvider.getFake(CACHE_EXPIRATION_KEY);
      const result = await firstValueFrom(state.state$);
      expect(result).toEqual(date);
    });

    it("should emit through cacheExpiration$", async () => {
      const date = new Date("2026-06-15");
      await sut.setCacheExpiration(date);

      const result = await firstValueFrom(sut.cacheExpiration$);
      expect(result).toEqual(date);
    });
  });

  describe("clearCache", () => {
    it("should set all three state keys to null", async () => {
      await sut.setCurrentAuthType(AuthenticationType.Password);
      await sut.setCacheData({ password: {} as any });
      await sut.setCacheExpiration(new Date());

      await sut.clearCache();

      const authType = await firstValueFrom(sut.currentAuthType$);
      const cacheData = await firstValueFrom(sut.cacheData$);
      const expiration = await firstValueFrom(sut.cacheExpiration$);

      expect(authType).toBeNull();
      expect(cacheData).toBeNull();
      expect(expiration).toBeNull();
    });
  });
});
