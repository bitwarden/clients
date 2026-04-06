// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ApItemEnum {
  User,
  Group,
  ServiceAccount,
  Project,
}

export class ApItemEnumUtil {
  static itemIcon(type: ApItemEnum): string {
    switch (type) {
      case ApItemEnum.User:
        return "bwi-user";
      case ApItemEnum.Group:
        return "bwi-family";
      case ApItemEnum.ServiceAccount:
        return "bwi-wrench";
      case ApItemEnum.Project:
        return "bwi-collection";
    }
  }
}
