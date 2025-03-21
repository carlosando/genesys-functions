const { JWK, JWE, parse } = require('node-jose');
const { Buffer } = require('buffer');

// Handler function
exports.handler = async (event, context, callback) => {

  const encryptedPayload = Buffer.from(event.cypherText).toString('utf8');
  console.log('##encryptedPayload : ' + encryptedPayload);

  // Input and parse the RSA Private Key
  let privateKey = event.PRIVATE_KEY;

  let keystore = JWK.createKeyStore();
  console.log('##created empty key store');
  await keystore.add(await JWK.asKey(privateKey, 'pem'));
  console.log('##added private key to keystore');
  
  let output = parse.compact(encryptedPayload);
  console.log('##parsedPayload: ' + JSON.stringify(output));
  console.log('##decrypting payload...');
  let decryptedVal = await output.perform(keystore);
  let decrypted = Buffer.from(decryptedVal.plaintext).toString();
 
  console.log('##plainText: ' + decrypted);
  
   // Return the plain text
    return {
      plainText: decrypted
    };
};