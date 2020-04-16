// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CompletionStatus, StatusTypes, ICustomResourceRequest, IResourceProperties } from "./custom-resource-handler";

const axios = require('axios')
const AWS = require('aws-sdk')

async function createBucketInSecondaryRegion(bucketName: string, bucketRegion: string, loggingBucketName?: string, loggingPrefix?: string): Promise<CompletionStatus> {
  try {
    const s3 = new AWS.S3({ region: bucketRegion });

    const createBucketParams = {
      Bucket: bucketName
    };

    if (bucketRegion !== 'us-east-1') {
      createBucketParams['CreateBucketConfiguration'] = {
        LocationConstraint: bucketRegion
      };
    }

    console.log(`Creating bucket: ${JSON.stringify(createBucketParams)}`);
    await s3.createBucket(createBucketParams).promise();
    console.log(`Bucket created: ${JSON.stringify(createBucketParams)}`);

    const putBucketEncryptionParams = {
      Bucket: bucketName,
      ServerSideEncryptionConfiguration: {
        Rules: [
          {
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: 'aws:kms'
            }
          }
        ]
      }
    };
    console.log(`Putting bucket encryption: ${JSON.stringify(putBucketEncryptionParams)}`);
    await s3.putBucketEncryption(putBucketEncryptionParams).promise()
    console.log(`Bucket encryption placed: ${JSON.stringify(putBucketEncryptionParams)}`);

    if (!loggingBucketName) {
      const putBucketAclParams = {
        Bucket: bucketName,
        ACL: 'log-delivery-write'
      };
      console.log(`Putting bucket ACL: ${JSON.stringify(putBucketAclParams)}`);
      await s3.putBucketAcl(putBucketAclParams).promise();
      console.log(`Bucket ACL placed: ${JSON.stringify(putBucketAclParams)}`);
    }

    const putPublicAccessBlockParams = {
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      }
    };
    console.log(`Putting public access block: ${JSON.stringify(putPublicAccessBlockParams)}`);
    await s3.putPublicAccessBlock(putPublicAccessBlockParams).promise();
    console.log(`Public access block placed: ${JSON.stringify(putPublicAccessBlockParams)}`);

    if (loggingBucketName && loggingPrefix) {
      const putBucketLoggingParams = {
        Bucket: bucketName,
        BucketLoggingStatus: {
          LoggingEnabled: {
            TargetBucket: loggingBucketName,
            TargetPrefix: loggingPrefix
          }
        }
      };
      console.log(`Putting bucket logging: ${JSON.stringify(putBucketLoggingParams)}`);
      await s3.putBucketLogging(putBucketLoggingParams).promise()
      console.log(`Bucket logging placed: ${JSON.stringify(putBucketLoggingParams)}`);
    }

    return {
      Status: StatusTypes.Success,
      Data: { BucketName: bucketName }
    }
  } catch (error) {
    console.log(error)
    return {
      Status: StatusTypes.Failed,
      Data: error.message
    }
  }
}

export async function handleCreate(props: IResourceProperties): Promise<CompletionStatus> {
  try {
    const primaryBucket = props.PrimaryBucketName
    const secondaryRegion = props.SecondaryRegion

    // Create the prefix for the secondary region bucket based on how long the bucket name in the primary region is
    const s3BucketLenMax = 63;
    const secondaryRegionLen = secondaryRegion.length;
    const maxPrefixLen = s3BucketLenMax - secondaryRegionLen - 6; // the "-6" accounts for a "-" to join the region to the prefix and for "-logs" to be appended to the logs bucket
    let secondaryBucketPrefix = primaryBucket.length > maxPrefixLen ? primaryBucket.slice(-1 * maxPrefixLen) : primaryBucket;

    if (secondaryBucketPrefix.startsWith('-')) {
      secondaryBucketPrefix = `${primaryBucket.charAt(0)}-${secondaryBucketPrefix.slice(2)}`;
    }

    const secondaryLogsBucketName = `${secondaryBucketPrefix}-${secondaryRegion}-logs`;
    const createSecondaryLogsBucketRequest = await createBucketInSecondaryRegion(secondaryLogsBucketName, secondaryRegion);
    if (createSecondaryLogsBucketRequest.Status === StatusTypes.Failed) {
      return createSecondaryLogsBucketRequest;
    }

    const secondaryBucketName = `${secondaryBucketPrefix}-${secondaryRegion}`;
    return createBucketInSecondaryRegion(secondaryBucketName, secondaryRegion, secondaryLogsBucketName, 'artifact-store')
  } catch (error) {
    return {
      Status: StatusTypes.Failed,
      Data: error
    }
  }
}

async function processEvent(event) {
  let response

  try {
    switch (event.RequestType) {
      case 'Create':
        response = await handleCreate(event.ResourceProperties)
        break
      case 'Update':
      case 'Delete':
        response = {
          Status: StatusTypes.Success,
          Data: { Message: `No action required for ${event.RequestType}` }
        };
        break
    }
  } catch (error) {
    response = {
      Status: StatusTypes.Failed,
      Data: error
    }
  }

  return response
}

function withTimeout(func, timeoutMillis): Promise<CompletionStatus> {
  let timeoutId
  let timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject({
        Status: StatusTypes.Failed,
        Data: { Message: 'Processing the event timed out' }
      })
    }, timeoutMillis)
  })

  return Promise.race([func, timeout]).then(result => {
    clearTimeout(timeoutId)
    return result
  })
}

function sendResponse(event: ICustomResourceRequest, logStreamName: string, response: CompletionStatus) {
  console.log(`sending response status: '${response.Status}' to CFN with data: ${JSON.stringify(response.Data)}`)

  const reason = `See the details in CloudWatch Log Stream: ${logStreamName}`

  const responseBody = JSON.stringify({
    Status: response.Status.toString(),
    Reason: reason,
    PhysicalResourceId: event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: response.Data,
  })

  const config = {
    headers: {
      "content-type": "",
      "content-length": responseBody.length
    }
  }

  return axios.put(event.ResponseURL, responseBody, config)
}

exports.handler = async (event: ICustomResourceRequest, context) => {
  console.log(`Received event: ${JSON.stringify(event)}`)

  let result: CompletionStatus

  try {
    // To prevent CloudFormation Stack creation hangs, make sure to return a response if 
    // the function doesn't process in the time allotted.  
    const timeout = context.getRemainingTimeInMillis() - 1000
    result = await withTimeout(processEvent(event), timeout)
  } catch (error) {
    console.log(`error: ${error}\n${error.stack}`)
    result = {
      Status: StatusTypes.Failed,
      Data: error
    }
  }

  const response = await sendResponse(event, context.logStreamName, result);
  return response.status;
}
