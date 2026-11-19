/** Where a KeePass failure is shown, and the message it shows. */
export interface KdbxFailure {
  field: "file" | "kdbxPassword";
  messageKey: string;
  args?: string[];
}

// The first four bytes shared by every KeePass database format.
const KEEPASS_SIGNATURE = [0x03, 0xd9, 0xa2, 0x9a];

// The SDK rejects larger databases with KdbxFileTooLarge.
const KDBX_MAX_BYTES = 10 * 1024 * 1024;

/** The failure for a message key from `KdbxSdkImporter.errorMessageKey`, if it is one. */
export function kdbxFailureFor(sdkMessageKey: string | undefined): KdbxFailure | undefined {
  switch (sdkMessageKey) {
    case "invalidFilePassword":
      return { field: "kdbxPassword", messageKey: "kdbxPasswordInvalidV2" };
    case "kdbxWrongFileType":
      return { field: "file", messageKey: "fileTypeNotSupportedV2", args: [".kdbx"] };
    case "kdbxCorruptOrOutdated":
      return { field: "file", messageKey: "importFileStructureInvalid" };
    case "kdbxFileTooLarge":
      return { field: "file", messageKey: "kdbxFileTooLarge" };
    default:
      return undefined;
  }
}

/** Checked before the file is read. */
export function kdbxSizeFailure(size: number): KdbxFailure | undefined {
  return size > KDBX_MAX_BYTES ? kdbxFailureFor("kdbxFileTooLarge") : undefined;
}

export function kdbxSignatureFailure(bytes: Uint8Array): KdbxFailure | undefined {
  return KEEPASS_SIGNATURE.every((byte, index) => bytes[index] === byte)
    ? undefined
    : kdbxFailureFor("kdbxWrongFileType");
}
