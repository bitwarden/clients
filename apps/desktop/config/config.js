function load(envName) {
  const base = loadConfig("base");
  const env = loadConfig(envName);
  const local = loadConfig("local");

  return {
    ...base,
    ...env,
    ...local,
    flags: {
      ...base.flags,
      ...env.flags,
      ...local.flags,
    },
    devFlags: {
      ...base.devFlags,
      ...env.devFlags,
      ...local.devFlags,
    },
  };
}

function log(configObj) {
  const repeatNum = 50;
  // eslint-disable-next-line
  console.log(`${"=".repeat(repeatNum)}\nenvConfig`);
  // eslint-disable-next-line
  console.log(JSON.stringify(configObj, null, 2));
  // eslint-disable-next-line
  console.log(`${"=".repeat(repeatNum)}`);
}

function loadConfig(configName) {
  try {
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`./${configName}.json`);
  } catch (e) {
    if (e instanceof Error && e.code === "MODULE_NOT_FOUND") {
      return {};
    } else {
      throw e;
    }
  }
}

module.exports = {
  load,
  log,
};
