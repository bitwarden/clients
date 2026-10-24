/** True only in test builds: allows http://localhost origins, ws:// relays and the test hooks. */
declare const __TEST_BUILD__: boolean;
declare const __CREDENTIAL_SOURCE__: "relay" | "static";
declare const __RELAY_URL__: string;
