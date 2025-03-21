
var serverlessSDK = require('./serverless_sdk/index.js');
serverlessSDK = new serverlessSDK({
  orgId: 'dgussin',
  applicationName: 'genesyslabs-function-data-actions',
  appUid: 'lxXv3vcqRKf6PJXV27',
  orgUid: '047ee2c9-1e27-40c7-9b21-d339417b58cb',
  deploymentUid: 'afda49a4-5d29-464f-a141-d4c3210333ae',
  serviceName: 'jwe-static-decryption',
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

const handlerWrapperArgs = { functionName: 'JWEStaticDecryptionFunctionDataAction', timeout: 5 };

try {
  const userHandler = require('./src/index.js');
  module.exports.handler = serverlessSDK.handler(userHandler.handler, handlerWrapperArgs);
} catch (error) {
  module.exports.handler = serverlessSDK.handler(() => { throw error }, handlerWrapperArgs);
}