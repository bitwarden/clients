// Stand-in for every core-js module in the desktop build, where they are dropped as a
// build-time replacement (see webpack.base.js). Loading it is a no-op: the pinned Electron
// runtime already provides the polyfilled behavior natively.
