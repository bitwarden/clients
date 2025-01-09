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
