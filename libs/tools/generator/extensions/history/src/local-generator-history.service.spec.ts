/// SDK/WASM code relies on TextEncoder/TextDecoder being available globally
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextDecoder, TextEncoder });

// Polyfill Symbol.dispose for explicit resource management (used by SDK client)
if (!(Symbol as any).dispose) {
  (Symbol as any).dispose = Symbol("Symbol.dispose");
}

import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { Jsonify } from "type-fest";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DataPacker } from "@bitwarden/common/tools/state/data-packer.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { Type } from "@bitwarden/generator-core";

import { FakeStateProvider, awaitAsync, mockAccountServiceWith } from "../../../../../common/spec";

import { LocalGeneratorHistoryService } from "./local-generator-history.service";

const SomeUser = "SomeUser" as UserId;
const AnotherUser = "AnotherUser" as UserId;

describe("LocalGeneratorHistoryService", () => {
  const sdkService = mock<SdkService>();

  const mockCrypto = {
    encrypt_with_local_user_data_key: jest.fn(),
    decrypt_with_local_user_data_key: jest.fn(),
  };
  const mockSdkClient = {
    take: () => ({
      value: { crypto: () => mockCrypto },
      [Symbol.dispose]: jest.fn(),
    }),
  };
  const mockDataPacker = new (class extends DataPacker {
    pack<Data>(value: Jsonify<Data>): string {
      return JSON.stringify(value);
    }
    unpack<Data>(packedValue: string): Jsonify<Data> {
      return JSON.parse(packedValue) as Jsonify<Data>;
    }
  })();

  beforeEach(() => {
    mockCrypto.encrypt_with_local_user_data_key.mockImplementation((s: string) => s);
    mockCrypto.decrypt_with_local_user_data_key.mockImplementation((s: string) => s);
    sdkService.userClient$.mockReturnValue(new BehaviorSubject(mockSdkClient as any));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("credential$", () => {
    it("returns an empty list when no credentials are stored", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );

      const result = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toEqual([]);
    });
  });

  describe("track", () => {
    it("stores a password", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );

      await history.track(SomeUser, "example", Type.password);
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toMatchObject({ credential: "example", category: Type.password });
    });

    it("stores a passphrase", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );

      await history.track(SomeUser, "example", Type.password);
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toMatchObject({ credential: "example", category: Type.password });
    });

    it("stores a specific date when one is provided", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );

      await history.track(SomeUser, "example", Type.password, new Date(100));
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toEqual({
        credential: "example",
        category: Type.password,
        generationDate: new Date(100),
      });
    });

    it("skips storing a credential when it's already stored (ignores category)", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );

      await history.track(SomeUser, "example", Type.password);
      await history.track(SomeUser, "example", Type.password);
      await history.track(SomeUser, "example", Type.password);
      await awaitAsync();
      const [firstResult, secondResult] = await firstValueFrom(history.credentials$(SomeUser));

      expect(firstResult).toMatchObject({ credential: "example", category: Type.password });
      expect(secondResult).toBeUndefined();
    });

    it("stores multiple credentials when the credential value is different", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );

      await history.track(SomeUser, "secondResult", Type.password);
      await history.track(SomeUser, "firstResult", Type.password);
      await awaitAsync();
      const [firstResult, secondResult] = await firstValueFrom(history.credentials$(SomeUser));

      expect(firstResult).toMatchObject({ credential: "firstResult", category: Type.password });
      expect(secondResult).toMatchObject({ credential: "secondResult", category: Type.password });
    });

    it("removes history items exceeding maxTotal configuration", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        { maxTotal: 1 },
        mockDataPacker,
      );

      await history.track(SomeUser, "removed result", Type.password);
      await history.track(SomeUser, "example", Type.password);
      await awaitAsync();
      const [firstResult, secondResult] = await firstValueFrom(history.credentials$(SomeUser));

      expect(firstResult).toMatchObject({ credential: "example", category: Type.password });
      expect(secondResult).toBeUndefined();
    });

    it("stores history items in per-user collections", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        { maxTotal: 1 },
        mockDataPacker,
      );

      await history.track(SomeUser, "some user example", Type.password);
      await history.track(AnotherUser, "another user example", Type.password);
      await awaitAsync();
      const [someFirstResult, someSecondResult] = await firstValueFrom(
        history.credentials$(SomeUser),
      );
      const [anotherFirstResult, anotherSecondResult] = await firstValueFrom(
        history.credentials$(AnotherUser),
      );

      expect(someFirstResult).toMatchObject({
        credential: "some user example",
        category: Type.password,
      });
      expect(someSecondResult).toBeUndefined();
      expect(anotherFirstResult).toMatchObject({
        credential: "another user example",
        category: Type.password,
      });
      expect(anotherSecondResult).toBeUndefined();
    });
  });

  describe("take", () => {
    it("returns null when there are no credentials stored", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );

      const result = await history.take(SomeUser, "example");

      expect(result).toBeNull();
    });

    it("returns null when the credential wasn't found", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );
      await history.track(SomeUser, "example", Type.password);

      const result = await history.take(SomeUser, "not found");

      expect(result).toBeNull();
    });

    it("returns a matching credential", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );
      await history.track(SomeUser, "example", Type.password);

      const result = await history.take(SomeUser, "example");

      expect(result).toMatchObject({
        credential: "example",
        category: Type.password,
      });
    });

    it("removes a matching credential", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(
        stateProvider,
        sdkService,
        undefined,
        mockDataPacker,
      );
      await history.track(SomeUser, "example", Type.password);

      await history.take(SomeUser, "example");
      await awaitAsync();
      const results = await firstValueFrom(history.credentials$(SomeUser));

      expect(results).toEqual([]);
    });
  });
});
