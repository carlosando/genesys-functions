const { JWK, JWE } = require('node-jose');
const { Buffer } = require('buffer');

// Handler function
exports.handler = async (event, context, callback) => {

  const alg = 'RSA-OAEP';
  const enc = 'A256GCM';  
  const encFormat = 'compact';

  //console.log("## Context: " + JSON.stringify(context));
  //console.log("## Event: " + JSON.stringify(event));

  // Input plain text from event
  const payload = event.plainText;
  
  // Input and parse the RSA Public Key
  let publicKey = Buffer.from(event.PUBLIC_KEY).toString('utf8');
  //console.log('## input publicKey: ' + publicKey);

  let pemPublicKey = await JWK.asKey(publicKey, "pem");
  //console.log('##publicKey: ' + pemPublicKey.toString());
  const buffer = Buffer.from(payload);
  //console.log('##jsonPayload: ' + buffer);
  const encrypted = await JWE.createEncrypt({ format: encFormat, contentAlg: enc, fields: { alg: alg } }, pemPublicKey).update(buffer).final();
  //console.log('##cypherText: ' + encrypted.toString());
  
   // Return the JWE Token
    return {
      cypherText: encrypted
    };
};