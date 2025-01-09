import { inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

/**
 * Interface describing the data that can be passed as query params for a FIDO2 session.
 */
export interface Fido2SessionData {
  isFido2Session: boolean;
  sessionId: string;
  fallbackSupported: boolean;
  userVerification: boolean;
  senderUrl: string;
  fromLock: boolean;
}

/**
 * Function to retrieve FIDO2 session data from query parameters.
 * Expected to be used within components tied to routes with these query parameters.
 */
export function fido2PopoutSessionData$() {
  const route = inject(ActivatedRoute);

  return route.queryParams.pipe(
    map(
      (queryParams) =>
        <Fido2SessionData>{
          isFido2Session: queryParams.sessionId != null,
          sessionId: queryParams.sessionId as string,
          fallbackSupported: queryParams.fallbackSupported === "true",
          userVerification: queryParams.userVerification === "true",
          senderUrl: queryParams.senderUrl as string,
          fromLock: queryParams.fromLock === "true",
        },
    ),
  );
}
