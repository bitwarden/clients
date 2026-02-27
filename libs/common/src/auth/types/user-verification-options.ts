/**
 * @typedef {Object} UserVerificationOptions - The available verification options for a user.
 */
export type UserVerificationOptions = {
  server: {
    otp: boolean;
    masterPassword: boolean;
  };
  client: {
    masterPassword: boolean;
    pin: boolean;
    biometrics: boolean;
  };
};
