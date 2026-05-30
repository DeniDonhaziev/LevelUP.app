const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

/** Zustand ESM (esm/*.mjs) содержит import.meta — в веб-бандле без module контекста падает. CommonJS — нет. */
const zustandRoot = path.dirname(require.resolve('zustand/package.json'));

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName === 'zustand') {
      return {
        filePath: path.join(zustandRoot, 'index.js'),
        type: 'sourceFile',
      };
    }
    if (moduleName === 'zustand/middleware') {
      return {
        filePath: path.join(zustandRoot, 'middleware.js'),
        type: 'sourceFile',
      };
    }
  }
  if (typeof upstreamResolveRequest === 'function') {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
