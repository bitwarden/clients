console.log(
  `Popup triggered -> HTML loaded: ${Math.round(
    performance.measure("", {}, "html-loaded").duration,
  )} ms\n` +
    `Popup triggered -> Angular bootstrap start: ${Math.round(
      performance.measure("", {}, "angular-bootstrap-start").duration,
    )} ms\n` +
    `Popup triggered -> InitService start: ${Math.round(
      performance.measure("", {}, "init-start").duration,
    )} ms\n` +
    // `Popup triggered -> cipher decryption start: ${Math.round(
    //   performance.measure("", {}, "cipher-decryption-start").duration
    // )} ms\n` +
    // `Popup triggered -> cipher decryption end: ${Math.round(
    //   performance.measure("", {}, "cipher-decryption-end").duration
    // )} ms\n` +
    `Popup triggered -> VaultV2Component constructor start: ${Math.round(
      performance.measure("", {}, "vault-v2-ctor-start").duration,
    )} ms\n` +
    `Popup triggered -> VaultPopupItemsService first emission: ${Math.round(
      performance.measure("", {}, "vault-v2-ciphers-available").duration,
    )} ms\n` +
    ``,
);
