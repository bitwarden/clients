// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { Account, Chunk, ParserOptions, SharedFolder } from "../models";

import { BinaryReader } from "./binary-reader";
import { CryptoUtils } from "./crypto-utils";

const AllowedSecureNoteTypes = new Set<string>([
  "Server",
  "Email Account",
  "Database",
  "Instant Messenger",
]);

export class Parser {
  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private cryptoUtils: CryptoUtils,
  ) {}

  /*
  May return null when the chunk does not represent an account.
  All secure notes are ACCTs but not all of them store account information.

  TODO: Add a test for the folder case!
  TODO: Add a test case that covers secure note account!
  */
  async parseAcct(
    chunk: Chunk,
    encryptionKey: Uint8Array,
    folder: SharedFolder,
    options: ParserOptions,
  ): Promise<Account> {
    let id: string;
    let step = 0;
    try {
      const placeholder = "decryption failed";
      const reader = new BinaryReader(chunk.payload);

      // Read all items
      // 0: id
      id = Utils.fromBufferToUtf8(this.readItem(reader));

      // 1: name
      step = 1;
      const name = await this.cryptoUtils.decryptAes256PlainWithDefault(
        this.readItem(reader),
        encryptionKey,
        placeholder,
      );

      // 2: group
      step = 2;
      const group = await this.cryptoUtils.decryptAes256PlainWithDefault(
        this.readItem(reader),
        encryptionKey,
        placeholder,
      );

      // 3: url
      step = 3;
      const urlEncoded = this.readItem(reader);
      let url =
        urlEncoded.length > 0 && urlEncoded[0] === 33 // 33 = '!'
          ? // URL is encrypted
            await this.cryptoUtils.decryptAes256PlainWithDefault(
              urlEncoded,
              encryptionKey,
              placeholder,
            )
          : // URL is not encrypted
            Utils.fromBufferToUtf8(this.decodeHexLoose(Utils.fromBufferToUtf8(urlEncoded)));

      // Ignore "group" accounts. They have no credentials.
      if (url == "http://group") {
        return null;
      }

      // 4: extra (notes)
      step = 4;
      const notes = await this.cryptoUtils.decryptAes256PlainWithDefault(
        this.readItem(reader),
        encryptionKey,
        placeholder,
      );

      // 5: fav (is favorite)
      step = 5;
      const isFavorite = Utils.fromBufferToUtf8(this.readItem(reader)) === "1";

      // 6: sharedfromaid (?)
      this.skipItem(reader);

      // 7: username
      step = 7;
      let username = await this.cryptoUtils.decryptAes256PlainWithDefault(
        this.readItem(reader),
        encryptionKey,
        placeholder,
      );

      // 8: password
      step = 8;
      let password = await this.cryptoUtils.decryptAes256PlainWithDefault(
        this.readItem(reader),
        encryptionKey,
        placeholder,
      );

      // 9: pwprotect (?)
      this.skipItem(reader);

      // 10: genpw (?)
      this.skipItem(reader);

      // 11: sn (is secure note)
      step = 11;
      const isSecureNote = Utils.fromBufferToUtf8(this.readItem(reader)) === "1";

      // Parse secure note
      if (options.parseSecureNotesToAccount && isSecureNote) {
        let type = "";
        // ParseSecureNoteServer
        for (const i of notes.split("\n")) {
          const keyValue = i.split(":", 2);
          if (keyValue.length < 2) {
            continue;
          }
          switch (keyValue[0]) {
            case "NoteType":
              type = keyValue[1];
              break;
            case "Hostname":
              url = keyValue[1];
              break;
            case "Username":
              username = keyValue[1];
              break;
            case "Password":
              password = keyValue[1];
              break;
          }
        }

        // Only the some secure notes contain account-like information
        if (!AllowedSecureNoteTypes.has(type)) {
          return null;
        }
      }

      // 12: last_touch_gmt (?)
      this.skipItem(reader);

      // 13: autologin (?)
      this.skipItem(reader);

      // 14: never_autofill (?)
      this.skipItem(reader);

      // 15: realm (?)
      this.skipItem(reader);

      // 16: id_again (?)
      this.skipItem(reader);

      // 17: custom_js (?)
      this.skipItem(reader);

      // 18: submit_id (?)
      this.skipItem(reader);

      // 19: captcha_id (?)
      this.skipItem(reader);

      // 20: urid (?)
      this.skipItem(reader);

      // 21: basic_auth (?)
      this.skipItem(reader);

      // 22: method (?)
      this.skipItem(reader);

      // 23: action (?)
      this.skipItem(reader);

      // 24: groupid (?)
      this.skipItem(reader);

      // 25: deleted (?)
      this.skipItem(reader);

      // 26: attachkey (?)
      this.skipItem(reader);

      // 27: attachpresent (?)
      this.skipItem(reader);

      // 28: individualshare (?)
      this.skipItem(reader);

      // 29: notetype (?)
      this.skipItem(reader);

      // 30: noalert (?)
      this.skipItem(reader);

      // 31: last_modified_gmt (?)
      this.skipItem(reader);

      // 32: hasbeenshared (?)
      this.skipItem(reader);

      // 33: last_pwchange_gmt (?)
      this.skipItem(reader);

      // 34: created_gmt (?)
      this.skipItem(reader);

      // 35: vulnerable (?)
      this.skipItem(reader);

      // 36: pwch (?)
      this.skipItem(reader);

      // 37: breached (?)
      this.skipItem(reader);

      // 38: template (?)
      this.skipItem(reader);

      // 39: totp (?)
      step = 39;
      const totp = await this.cryptoUtils.decryptAes256PlainWithDefault(
        this.readItem(reader),
        encryptionKey,
        placeholder,
      );

      // 3 more left. Don't even bother skipping them.

      // 40: trustedHostnames (?)
      // 41: last_credential_monitoring_gmt (?)
      // 42: last_credential_monitoring_stat (?)

      // Adjust the path to include the group and the shared folder, if any.
      step = 42;
      const path = this.makeAccountPath(group, folder);

      const account = new Account();
      account.id = id;
      account.name = name;
      account.username = username;
      account.password = password;
      account.url = url;
      account.path = path;
      account.notes = notes;
      account.totp = totp;
      account.isFavorite = isFavorite;
      account.isShared = folder != null;
      return account;
    } catch (err) {
      throw new Error(
        "Error parsing accounts on item with ID:" +
          id +
          " step #" +
          step +
          " errorMessage: " +
          err.message,
      );
    }
  }

  async parseShar(
    chunk: Chunk,
    encryptionKey: Uint8Array,
    rsaKey: Uint8Array,
  ): Promise<SharedFolder> {
    let id: string;
    try {
      const reader = new BinaryReader(chunk.payload);

      // Id
      id = Utils.fromBufferToUtf8(this.readItem(reader));

      // Key
      const folderKey = this.readItem(reader);
      const rsaEncryptedFolderKey = Utils.fromHexToArray(Utils.fromBufferToUtf8(folderKey));
      const decFolderKey = await this.cryptoFunctionService.rsaDecrypt(
        rsaEncryptedFolderKey,
        rsaKey,
        "sha1",
      );
      const key = Utils.fromHexToArray(Utils.fromBufferToUtf8(decFolderKey));

      // Name
      const encryptedName = this.readItem(reader);
      const name = await this.cryptoUtils.decryptAes256Base64(encryptedName, key);

      const folder = new SharedFolder();
      folder.id = id;
      folder.name = name;
      folder.encryptionKey = key;
      return folder;
    } catch (err) {
      throw new Error(
        "Error parsing shared folder with ID:" + id + " errorMessage: " + err.message,
      );
    }
  }

  async parseEncryptedPrivateKey(encryptedPrivateKey: string, encryptionKey: Uint8Array) {
    const decrypted = await this.cryptoUtils.decryptAes256(
      Utils.fromHexToArray(encryptedPrivateKey),
      encryptionKey,
      "cbc",
      encryptionKey.subarray(0, 16),
    );

    const header = "LastPassPrivateKey<";
    const footer = ">LastPassPrivateKey";
    if (!decrypted.startsWith(header) || !decrypted.endsWith(footer)) {
      throw new Error("Failed to decrypt private key");
    }

    const parsedKey = decrypted.substring(header.length, decrypted.length - footer.length);
    const pkcs8 = Utils.fromHexToArray(parsedKey);
    return pkcs8;
  }

  makeAccountPath(group: string, folder: SharedFolder): string {
    const groupEmpty = group == null || group.trim() === "";
    if (folder == null) {
      return groupEmpty ? "(none)" : group;
    }
    return groupEmpty ? folder.name : folder.name + "\\" + group;
  }

  extractChunks(reader: BinaryReader): Chunk[] {
    const chunks = new Array<Chunk>();
    while (!reader.atEnd()) {
      const chunk = this.readChunk(reader);
      chunks.push(chunk);

      // TODO: catch end of stream exception?
      // In case the stream is truncated we just ignore the incomplete chunk.
    }
    return chunks;
  }

  private readChunk(reader: BinaryReader): Chunk {
    /*
    LastPass blob chunk is made up of 4-byte ID, big endian 4-byte size and payload of that size
    Example:
      0000: 'IDID'
      0004: 4
      0008: 0xDE 0xAD 0xBE 0xEF
      000C: --- Next chunk ---
    */
    const chunk = new Chunk();
    chunk.id = this.readId(reader);
    chunk.payload = this.readPayload(reader, this.readSize(reader));
    return chunk;
  }

  private readItem(reader: BinaryReader): Uint8Array {
    /*
    An item in an itemized chunk is made up of the big endian size and the payload of that size
    Example:
      0000: 4
      0004: 0xDE 0xAD 0xBE 0xEF
      0008: --- Next item ---
    See readItem for item description.
    */
    return this.readPayload(reader, this.readSize(reader));
  }

  private skipItem(reader: BinaryReader): void {
    // See readItem for item description.
    reader.seekFromCurrentPosition(this.readSize(reader));
  }

  private readId(reader: BinaryReader): string {
    return Utils.fromBufferToUtf8(reader.readBytes(4));
  }

  private readSize(reader: BinaryReader): number {
    return reader.readUInt32BigEndian();
  }

  private readPayload(reader: BinaryReader, size: number): Uint8Array {
    return reader.readBytes(size);
  }

  private decodeHexLoose(s: string): Uint8Array {
    // This is a forgiving version that pads the input with a '0' when the length is odd
    return Utils.fromHexToArray(s.length % 2 == 0 ? s : "0" + s);
  }
}
