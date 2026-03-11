export const CountryAbbreviations = {
  UnitedStates: "US",
  Switzerland: "CH",
} as const;

export type CountryAbbreviations = (typeof CountryAbbreviations)[keyof typeof CountryAbbreviations];

const DirectlyTaxableCountries = [
  CountryAbbreviations.UnitedStates,
  CountryAbbreviations.Switzerland,
] as const;

export const isDirectlyTaxableCountry = (country: string): boolean => {
  if (country === undefined || country === null) {
    return false;
  }
  const upperCaseCountry = country.toUpperCase();
  return DirectlyTaxableCountries.includes(upperCaseCountry as CountryAbbreviations);
};
