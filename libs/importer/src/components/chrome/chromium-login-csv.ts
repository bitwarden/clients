import * as papa from "papaparse";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ImporterLoginResult } from "../../services";

export type ChromiumLogin = {
  url: string;
  username: string;
  password: string;
  note: string;
};
export type ChromiumLoginFailure = {
  url: string;
  username: string;
  error: string;
};

export type ChromiumLoginImportResult = {
  login?: ChromiumLogin;
  failure?: ChromiumLoginFailure;
};

// Fails the build if ImporterLoginResult (services/) stops being assignable to the type below
// (kept independent so services/ doesn't depend on components/).
type AssertAssignable<T extends U, U> = T;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LoginResultShapesStayCompatible = AssertAssignable<
  ImporterLoginResult,
  ChromiumLoginImportResult
>;

export type ChromiumLoginsToCsvResult =
  | { csv: string }
  // Separates the raw (loggable) failure detail from the localized message to show the user.
  | { errorKey: "importNothingError" }
  | { errorKey: "errorOccurred"; failureDetail: string };

/** Converts native Chromium logins into the CSV shape `ChromeCsvImporter` parses. */
export function chromiumLoginsToCsv(
  logins: ChromiumLoginImportResult[],
): ChromiumLoginsToCsvResult {
  // Unsupported Chrome V3 encryption surfaces here as a generic error, not a partial import.
  const failure = logins.map((l) => l.failure).find((f) => f != null);
  if (failure != null) {
    return { errorKey: "errorOccurred", failureDetail: failure.error };
  }

  const rows = logins
    .map((l) => l.login)
    .filter((login): login is ChromiumLogin => login != null)
    .map(toCsvRow);

  // Checked after filtering: records with neither login nor failure would else false-succeed.
  if (rows.length === 0) {
    return { errorKey: "importNothingError" };
  }
  return { csv: papa.unparse(rows) };
}

function toCsvRow(login: ChromiumLogin): ChromiumLogin & { name: string } {
  const url = Utils.getUrl(login?.url);
  const name = url != null ? new URL(url).hostname : login.url;

  return {
    name,
    url: login.url,
    username: login.username,
    password: login.password,
    note: login.note,
  };
}
