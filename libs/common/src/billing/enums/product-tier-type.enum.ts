/**
 * @deprecated instead use `ProductTierTypes` constants and `ProductTierTypeValue` type over unsafe typescript enums
 **/
export enum ProductTierType {
  Free = 0,
  Families = 1,
  Teams = 2,
  Enterprise = 3,
  TeamsStarter = 4,
}

export const ProductTierTypes = {
  Free: 0,
  Families: 1,
  Teams: 2,
  Enterprise: 3,
  TeamsStarter: 4,
} as const;

export type ProductTierTypeValue = (typeof ProductTierTypes)[keyof typeof ProductTierTypes];

export function isNotSelfUpgradable(productType: ProductTierTypeValue): boolean {
  return (
    productType !== ProductTierTypes.Free &&
    productType !== ProductTierTypes.TeamsStarter &&
    productType !== ProductTierTypes.Families
  );
}
