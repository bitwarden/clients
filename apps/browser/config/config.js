function load(envName, channelName) {
  const base = loadConfig("base");
  const env = loadConfig(envName);
  const channel = channelName ? loadConfig(channelName) : {};
  const local = loadConfig("local");

  return {
    ...base,
    ...env,
    ...channel,
    ...local,
    flags: {
      ...base.flags,
      ...env.flags,
      ...channel.flags,
      ...local.flags,
    },
    devFlags: {
      ...base.devFlags,
      ...env.devFlags,
      ...channel.devFlags,
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
