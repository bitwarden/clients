import { IsActiveMatchOptions } from "@angular/router";

/**
 * Matches the route itself and nothing nested beneath it, ignoring every dimension a vault route
 * never varies in so the path is the only thing compared.
 */
export const EXACT_PATH: IsActiveMatchOptions = {
  paths: "exact",
  queryParams: "ignored",
  fragment: "ignored",
  matrixParams: "ignored",
};
