import { mock } from "jest-mock-extended";
import { of, firstValueFrom, Subject, toArray } from "rxjs";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SEND_KDF_ITERATIONS } from "@bitwarden/common/tools/send/send-kdf";

import { awaitAsync } from "../../../../../../../libs/common/spec";

import { keyToSendAccessRequest } from "./rx";

describe("keyToSendAccessRequest", () => {
  const cryptoFunctionService = mock<CryptoFunctionService>();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("calls pbkdf2 with exact parameters when given a base64 key", async () => {
    const password = "test-password";
    const keyArray = new Uint8Array([1, 2, 3, 4, 5]);
    const key = Utils.fromBufferToB64(keyArray);
    const hashedArray = new Uint8Array([10, 20, 30, 40]);

    cryptoFunctionService.pbkdf2.mockResolvedValue(hashedArray);

    const toRequest = keyToSendAccessRequest(cryptoFunctionService, password);
    await firstValueFrom(of(key).pipe(toRequest));

    expect(cryptoFunctionService.pbkdf2).toHaveBeenCalledWith(
      password,
      keyArray,
      "sha256",
      SEND_KDF_ITERATIONS,
    );
    expect(cryptoFunctionService.pbkdf2).toHaveBeenCalledTimes(1);
  });

  it("returns SendAccessRequest with base64 encoded password when pbkdf2 succeeds", async () => {
    const password = "test-password";
    const keyArray = new Uint8Array([1, 2, 3, 4, 5]);
    const key = Utils.fromBufferToB64(keyArray);
    const hashedArray = new Uint8Array([10, 20, 30, 40]);
    const expectedPassword = Utils.fromBufferToB64(hashedArray);

    cryptoFunctionService.pbkdf2.mockResolvedValue(hashedArray);

    const hasher = keyToSendAccessRequest(cryptoFunctionService, password);
    const result = await firstValueFrom(of(key).pipe(hasher));

    expect(result.password).toBe(expectedPassword);
  });

  it("propagates error when pbkdf2 fails", async () => {
    const password = "test-password";
    const key = Utils.fromBufferToB64(new Uint8Array([1, 2, 3, 4, 5]));
    const expectedError = new Error("pbkdf2 failed");

    cryptoFunctionService.pbkdf2.mockRejectedValue(expectedError);

    const hasher = keyToSendAccessRequest(cryptoFunctionService, password);
    await expect(firstValueFrom(of(key).pipe(hasher))).rejects.toThrow("pbkdf2 failed");
  });

  it("completes when source observable completes", (done) => {
    const password = "test-password";
    const source$ = new Subject<string>();
    const hashedArray = new Uint8Array([10, 20, 30, 40]);

    cryptoFunctionService.pbkdf2.mockResolvedValue(hashedArray);

    const hasher = keyToSendAccessRequest(cryptoFunctionService, password);
    source$.pipe(hasher).subscribe({
      complete: () => {
        done();
      },
    });

    // if `hasher` fails to pass through complete, `done()` won't be called
    // and the test will time out
    source$.complete();
  });

  it("handles multiple emissions when source emits multiple keys", async () => {
    const password = "test-password";
    const keyArray1 = new Uint8Array([1, 2, 3, 4, 5]);
    const keyArray2 = new Uint8Array([6, 7, 8, 9, 10]);
    const key1 = Utils.fromBufferToB64(keyArray1);
    const key2 = Utils.fromBufferToB64(keyArray2);
    const hashedArray1 = new Uint8Array([10, 20, 30, 40]);
    const hashedArray2 = new Uint8Array([50, 60, 70, 80]);
    const expectedPassword1 = Utils.fromBufferToB64(hashedArray1);
    const expectedPassword2 = Utils.fromBufferToB64(hashedArray2);

    cryptoFunctionService.pbkdf2
      .mockResolvedValueOnce(hashedArray1)
      .mockResolvedValueOnce(hashedArray2);

    const hasher = keyToSendAccessRequest(cryptoFunctionService, password);
    let results: SendAccessRequest[] = [];
    of(key1, key2)
      .pipe(hasher, toArray())
      .subscribe((r) => (results = r));
    await awaitAsync();

    expect(results).toHaveLength(2);
    expect(results[0].password).toBe(expectedPassword1);
    expect(results[1].password).toBe(expectedPassword2);
    expect(cryptoFunctionService.pbkdf2).toHaveBeenCalledTimes(2);
    expect(cryptoFunctionService.pbkdf2).toHaveBeenNthCalledWith(
      1,
      password,
      keyArray1,
      "sha256",
      SEND_KDF_ITERATIONS,
    );
    expect(cryptoFunctionService.pbkdf2).toHaveBeenNthCalledWith(
      2,
      password,
      keyArray2,
      "sha256",
      SEND_KDF_ITERATIONS,
    );
  });
});
