
// Mock implementation to bypass Rust/Native modules requirements
module.exports = {
  autofill: {
    AutofillIpcServer: {
      listen: async () => ({
        getPath: () => "mock-pipe",
        stop: () => {},
        completeRegistration: () => {},
        completeAssertion: () => {},
        completeError: () => {}
      })
    },
    runCommand: async () => "mock-response"
  },
  autostart: {
    setAutostart: async () => {}
  },
  autotype: {
    getForegroundWindowTitle: () => "Mock Window",
    typeInput: () => {}
  },
  biometrics: {
    available: async () => false,
    deriveKeyMaterial: async () => ({ keyB64: "mock-key", ivB64: "mock-iv" }),
    getBiometricSecret: async () => { throw new Error("Mock: Biometric secret not found"); },
    prompt: async () => true,
    setBiometricSecret: async () => "mock-secret"
  },
  biometrics_v2: {
    BiometricLockSystem: class {},
    initBiometricSystem: () => ({}),
    authenticate: async () => true,
    authenticateAvailable: async () => false,
    enrollPersistent: async () => {},
    hasPersistent: async () => false,
    provideKey: async () => {},
    unenroll: async () => {},
    unlock: async () => Buffer.from("mock-key"),
    unlockAvailable: async () => false
  },
  chromium_importer: {
    getAvailableProfiles: () => [],
    getMetadata: () => ({}),
    importLogins: async () => []
  },
  clipboards: {
    read: async () => "mock-clipboard-content",
    write: async () => {}
  },
  ipc: {
    NativeIpcServer: {
      listen: async () => ({
        getPath: () => "mock-ipc-pipe",
        stop: () => {},
        send: () => 0
      })
    },
    IpcMessageType: {
      Connected: 0,
      Disconnected: 1,
      Message: 2
    }
  },
  logging: {
    initNapiLog: () => {},
    LogLevel: {
      Trace: 0,
      Debug: 1,
      Info: 2,
      Warn: 3,
      Error: 4
    }
  },
  passkey_authenticator: {
    register: () => {}
  },
  passwords: {
    deletePassword: async () => {},
    getPassword: async () => { throw new Error("Mock: Password not found"); },
    isAvailable: async () => true,
    PASSWORD_NOT_FOUND: "Mock: Password not found",
    setPassword: async () => {}
  },
  powermonitors: {
    isLockMonitorAvailable: async () => false,
    onLock: async () => {}
  },
  processisolations: {
    disableCoredumps: async () => {},
    isCoreDumpingDisabled: async () => true,
    isolateProcess: async () => {}
  },
  sshagent: {
    SshAgentState: class {},
    clearKeys: () => {},
    isRunning: () => false,
    lock: () => {},
    serve: async () => ({}),
    setKeys: () => {},
    stop: () => {}
  },
  windows_registry: {
    createKey: async () => {},
    deleteKey: async () => {}
  }
};
