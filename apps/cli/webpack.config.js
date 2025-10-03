// We also support building the cli with nx, which uses a different webpack
// config. We re-export the old npm config here for now because the nx
// migration is incomplete. Eventually we'll be dropping support for
// webpack.npm.config and npm builds in general, so if you make changes to
// this config please ensure they are also applied to nx builds. Reach out to
// Platform if you have any questions about this.
module.exports = require("./webpack.npm.config.js");
