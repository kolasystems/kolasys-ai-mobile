const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Stub out react-dom — @clerk/clerk-react imports it but doesn't use it at runtime
// in React Native. Without this, Metro throws a bundle error.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-dom' || moduleName.startsWith('react-dom/')) {
    return {
      filePath: path.resolve(__dirname, 'src/stubs/react-dom.js'),
      type: 'sourceFile',
    };
  }
  // Fall through to default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
