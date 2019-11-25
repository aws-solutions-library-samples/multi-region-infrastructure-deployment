// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')
const axios = require('axios')
const uuid = require('uuid')

exports.handler = async (event, context) => {
    console.log('REQUEST RECEIVED:\n' + JSON.stringify(event))

    let timeout = waitForTimeout(context.getRemainingTimeInMillis() - 1000)
    let process = await processEvent(event.RequestType, event.ResourceProperties.Resource)
    
    let completed = await Promise.race([timeout, process])
    const response = await sendResponse(event, context.logStreamName, completed.Status, completed.Data)
    console.log('sent response to CloudFormation with status: ' + response.status)
    return response.status
}

function waitForTimeout(timeoutMillis) {
    return new Promise(resolve => setTimeout(() => {
        resolve({
            Status: 'FAILED',
            Data: { Message: 'The Create request timed out' }
        })
    }, timeoutMillis))
}

async function processEvent(requestType, resource) {

    try {
        if (requestType === 'Create') {

            switch (resource) {
                case ('UUID'):
                    return Promise.resolve({
                        Status: 'SUCCESS',
                        Data: { UUID: uuid.v4() }
                    })

                case ('ArtifactStoreCreatorCustomResource'):
                    const s3 = new AWS.S3({ region: process.env.REGION })
                    const logsBucket = await createLogsBucket(s3, process.env.BUCKET_PREFIX, process.env.REGION)
                    await createArtifactsBucket(s3, process.env.BUCKET_PREFIX, process.env.REGION, logsBucket)
                    return {
                        Status: 'SUCCESS',
                        Data: { Message: 'Resource creation successful' }
                    }

                default:
                    throw new Error(resource + ' not defined as a resource')
            }
        } else if (requestType === 'Update') {
            // no op
        } else if (requestType === 'Delete') {
            return {
                Status: 'SUCCESS',
                Data: { Message: `Manually delete the resource` }
            }
        } else {
            return {
                Status: 'FAILED',
                Data: { Message: `Unknown RequestType received: ${requestType}. Expected: Create, Update, or Delete` }
            }
        }
    } catch (error) {
        return {
            Status: 'FAILED',
            Message: JSON.stringify(error)
        }
    }
}

async function createLogsBucket(s3, bucketName, region) {
    const logsBucketName = `${bucketName}-${region}-logs`
    await createBucket(s3, logsBucketName, region)

    console.log(`putBucketAcl log-delivery-write on logs bucket: ${logsBucketName}`)
    await s3.putBucketAcl({
        Bucket: logsBucketName,
        ACL: 'log-delivery-write'
    }).promise()

    return logsBucketName
}

async function createArtifactsBucket(s3, bucketName, region, logsBucket) {
    const artifactsBucketName = `${bucketName}-${region}`
    await createBucket(s3, artifactsBucketName, region)

    console.log(`putBucketLogging on bucket: ${artifactsBucketName} to target ${logsBucket}`)
    await s3.putBucketLogging({
        Bucket: artifactsBucketName,
        BucketLoggingStatus: {
          LoggingEnabled: {
            TargetBucket: logsBucket,
            TargetPrefix: 'artifact-store'
          }
        }
      }).promise()
}

async function createBucket(s3, bucketName, region) {
    try {
        console.log(`Creating S3 Bucket ${bucketName}`)
    
        if (region === 'us-east-1') {
            await s3.createBucket({
                Bucket: bucketName,
            }).promise()
        } else {
            await s3.createBucket({
                Bucket: bucketName,
                CreateBucketConfiguration: {
                    LocationConstraint: region
                }
            }).promise()
        }


        console.log(`putBucketEncryption on Bucket ${bucketName}`)
        await s3.putBucketEncryption({
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
        }).promise()

        console.log(`putPublicAccessBlock on Bucket ${bucketName}`)
        await s3.putPublicAccessBlock({
            Bucket: bucketName,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                BlockPublicPolicy: true,
                IgnorePublicAcls: true,
                RestrictPublicBuckets: true
            }
        }).promise()
    } catch (error) {
        console.log(error)
    }
}

function sendResponse(event, logStreamName, responseStatus, responseData) {
    const reason = `See the details in CloudWatch Log Stream: ${logStreamName}`
    
    const responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: reason,
        PhysicalResourceId: event.LogicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData,
    })

    const config = {
        headers: {
            "content-type": "",
            "content-length": responseBody.length
        }
    }

    console.log('sending response to CloudFormation: ' + responseBody)

    // using axios({config}) doesn't work with sinon stubs, so explicitly calling .put here to make it work
    return axios.put(event.ResponseURL, responseBody, config)
}