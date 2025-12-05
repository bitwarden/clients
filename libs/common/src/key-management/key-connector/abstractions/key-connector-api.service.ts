import { KeyConnectorConfirmationDetailsResponse } from "../models/response/key-connector-confirmation-details.response";

export abstract class KeyConnectorApiService {
  abstract getConfirmationDetails(
    orgSsoIdentifier: string,
  ): Promise<KeyConnectorConfirmationDetailsResponse>;
}
