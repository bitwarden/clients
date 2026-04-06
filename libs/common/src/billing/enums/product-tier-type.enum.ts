// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ProductTierType {
  Free = 0,
  Families = 1,
  Teams = 2,
  Enterprise = 3,
  TeamsStarter = 4,
}

export function isNotSelfUpgradable(productType: ProductTierType): boolean {
  return (
    productType !== ProductTierType.Free &&
    productType !== ProductTierType.TeamsStarter &&
    productType !== ProductTierType.Families
  );
}
