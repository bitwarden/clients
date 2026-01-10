// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ApPermissionEnum {
  CanRead = "canRead",
  CanReadWrite = "canReadWrite",
}

export class ApPermissionEnumUtil {
  static toApPermissionEnum(read: boolean, write: boolean): ApPermissionEnum {
    if (read && write) {
      return ApPermissionEnum.CanReadWrite;
    } else if (read) {
      return ApPermissionEnum.CanRead;
    } else {
      throw new Error("Unsupported Access Policy Permission option");
    }
  }

  static toRead(permission: ApPermissionEnum): boolean {
    if (permission == ApPermissionEnum.CanRead || permission == ApPermissionEnum.CanReadWrite) {
      return true;
    }
    return false;
  }

  static toWrite(permission: ApPermissionEnum): boolean {
    if (permission === ApPermissionEnum.CanReadWrite) {
      return true;
    }
    return false;
  }
}
