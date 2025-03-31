function load(envName) {
  const base = require("./base.json");
  const env = loadConfig(envName);
  const local = loadConfig("local");

  return {
    ...base,
    ...env,
    ...local,
    dev: {
      ...base.dev,
      ...env.dev,
      ...local.dev,
    },
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
  console.log(`${"=".repeat(repeatNum)}\nenvConfig`);
  console.log(JSON.stringify(configObj, null, 2));
  console.log(`${"=".repeat(repeatNum)}`);
}

function loadConfig(configName) {
  try {
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
