/**
 * Represents a request to update an AuthRequest with either approval or denial of the request.
 * If the request is approved, the update will contain the key and/or hash to be shared with the requesting device.
 */
export class AuthRequestUpdateRequest {
  constructor(
    readonly key: string,
    readonly masterPasswordHash: string,
    readonly deviceIdentifier: string,
    readonly requestApproved: boolean,
  ) {}
}
