import { Jsonify } from "type-fest";

import { KeyDefinition, SEND_ACCESS_DISK } from "@bitwarden/state";

import { SendAccessToken } from "../models/send-access-token";

export const SEND_ACCESS_TOKEN_DICT = KeyDefinition.record<SendAccessToken, string>(
  SEND_ACCESS_DISK,
  "accessTokenDict",
  {
    deserializer: (sendAccessTokenJson: Jsonify<SendAccessToken>) => {
      return SendAccessToken.fromJson(sendAccessTokenJson);
    },
  },
);
