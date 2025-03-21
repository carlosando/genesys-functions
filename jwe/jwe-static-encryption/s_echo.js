
var serverlessSDK = require('./serverless_sdk/index.js');
serverlessSDK = new serverlessSDK({
  orgId: 'dgussin',
  applicationName: 'genesyslabs-function-data-actions',
  appUid: 'lxXv3vcqRKf6PJXV27',
  orgUid: '047ee2c9-1e27-40c7-9b21-d339417b58cb',
  deploymentUid: 'ec3cb478-8f3c-4408-8d14-5fe2f726fdb7',
  serviceName: 'jwe-static-encryption',
  shouldLogMeta: true,
  shouldCompressLogs: true,
  disableAwsSpans: false,
  disableHttpSpans: false,
  stageName: 'dev',
  serverlessPlatformStage: 'prod',
  devModeEnabled: false,
  accessKey: null,
  pluginVersion: '7.2.3',
  disableFrameworksInstrumentation: false
});

const handlerWrapperArgs = { functionName: 'JWEStaticEncryptionFunctionDataAction', timeout: 5 };

try {
  const userHandler = require('./src/index.js');
  module.exports.handler = serverlessSDK.handler(userHandler.handler, handlerWrapperArgs);
} catch (error) {
  module.exports.handler = serverlessSDK.handler(() => { throw error }, handlerWrapperArgs);
}