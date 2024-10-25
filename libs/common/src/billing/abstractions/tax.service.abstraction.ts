import { TaxableCountry } from "@bitwarden/common/billing/models/domain/taxable-country";

export abstract class TaxServiceAbstraction {
  getSelectableCountries: () => TaxableCountry[];
  isSupportedCountry: (country: string) => boolean;
}
