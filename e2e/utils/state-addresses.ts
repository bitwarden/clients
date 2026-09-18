import { StateAddress } from "./automation-driver";

/** Addresses of state the tests assert on, mirroring `libs/common/src/key-management`. */

/** Id of the user key as recorded by the server; changes on every key rotation. */
export const USER_KEY_ID: StateAddress = { stateName: "crypto", key: "userKeyId" };
