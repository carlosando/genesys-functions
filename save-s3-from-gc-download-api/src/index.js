const https = require('https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const querystring = require('querystring');

exports.handler = async (event, context, callback) => {
  console.log("## Context: " + JSON.stringify(context));
  console.log("## Event: " + JSON.stringify(event));

  const {
    inputUrl,
    s3BucketName,
    awsRegion,
    clientId,
    clientSecret,
    awsAccessKeyId,
    awsSecretAccessKey,
    regionDomain = 'mypurecloud.com'
  } = event;

  if (!inputUrl || !s3BucketName || !awsRegion || !clientId || !clientSecret || !awsAccessKeyId || !awsSecretAccessKey) {
    callback(new Error("Missing one or more required parameters: inputUrl, s3BucketName, awsRegion, clientId, clientSecret, awsAccessKeyId, awsSecretAccessKey."));
    return;
  }

  try {
    const token = await getOAuthToken(clientId, clientSecret, regionDomain);
    const fileBuffer = await downloadFile(inputUrl, token);

    //const fileName = `chat-download/${uuidv4()}.bin`;
    const fileName = `chat-download/${uuidv4()}.jpg`;

    const s3 = new S3Client({
      region: awsRegion,
      forcePathStyle: true, // path-style for compatibility with your bucket
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }
    });

    await s3.send(new PutObjectCommand({
      Bucket: s3BucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: 'image/jpeg'
      // ContentType: 'application/octet-stream'
      // ACL: 'public-read'
    }));

    // const publicUrl = `https://s3.${awsRegion}.amazonaws.com/${s3BucketName}/${fileName}`;
    const publicUrl = `https://${s3BucketName}.s3.${awsRegion}.amazonaws.com/${fileName}`;
    console.log(`File uploaded successfully: ${publicUrl}`);

    return { s3PublicUrl: publicUrl };

  } catch (error) {
    console.error("Error occurred:", error);
    callback(error);
  }
};

// Get OAuth token from Genesys Cloud
function getOAuthToken(clientId, clientSecret, regionDomain) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({ grant_type: 'client_credentials' });
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const options = {
      hostname: `login.${regionDomain}`,
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const parsed = JSON.parse(data);
          resolve(parsed.access_token);
        } else {
          reject(new Error(`OAuth token request failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Download file, following redirects if necessary
function downloadFile(url, accessToken, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('Too many redirects'));
    }

    const options = {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`Redirecting to ${res.headers.location}`);
        return resolve(downloadFile(res.headers.location, accessToken, redirectCount + 1));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download file. Status: ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}
