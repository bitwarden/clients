import forge from "node-forge";

import { Utils } from "../../../platform/misc/utils";

/**
 * Decrypts data using AES-ECB with the given key.
 * This is used for decrypting LastPass imports, which use AES-ECB without an IV. 
 * 
 * ⚠️️ HAZMAT WARNING ⚠️️: AES-ECB is not a secure encryption mode and allows both tampering and
 * leaks large amounts of information. DO NOT USE THIS FOR ANYTHING ELSE THAN DECRYPTING LASTPASS
 * IMPORTS.
 */
export function DANGEROUS_aesEcbDecryptLastpassImport(
    data: Uint8Array,
    key: Uint8Array,
): Uint8Array<ArrayBuffer> {
    const decipher = forge.cipher.createDecipher(
        "AES-ECB",
        Utils.fromArrayToByteString(key) as string,
    );
    decipher.start();
    decipher.update(forge.util.createBuffer(Utils.fromArrayToByteString(data) as string));

    if (!decipher.finish()) {
        throw new Error("AES-ECB decryption failed.");
    }

    return Utils.fromByteStringToArray(decipher.output.getBytes());
}

export function DANGEROUS_aesCbcDecryptLastpassImport(
    data: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array,
): Uint8Array<ArrayBuffer> {
    const decipher = forge.cipher.createDecipher(
        "AES-CBC",
        Utils.fromArrayToByteString(key) as string,
    );
    decipher.start({ iv: Utils.fromArrayToByteString(iv) as string });
    decipher.update(forge.util.createBuffer(Utils.fromArrayToByteString(data) as string));

    if (!decipher.finish()) {
        throw new Error("AES-CBC decryption failed.");
    }

    return Utils.fromByteStringToArray(decipher.output.getBytes());
}