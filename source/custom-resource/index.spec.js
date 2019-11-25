// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk-mock');
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const expect = require('chai').expect;

const createArtifactStoreBucketEvent = {
    RequestType: "Create",
    ServiceToken: "arn:aws:lambda",
    ResponseURL: "https://cloudformation",
    StackId: "arn:aws:cloudformation",
    RequestId: "1111111",
    LogicalResourceId: "Uuid",
    ResourceType: "Custom::UUID",
    ResourceProperties: {
        Resource: "ArtifactStoreCreatorCustomResource"
    }
}

const context = {
    logStreamName: 'cloudwatch',
    getRemainingTimeInMillis: function() { return 1 }
}

describe('custom-resource',() => {

    beforeEach(() => {
        AWS.mock('S3', 'createBucket', (_params, callback) => {
            callback(null, { Location: 'http://examplebucket.s3.amazonaws.com/' });
        });
        AWS.mock('S3', 'putBucketAcl', (_params, callback) => {
            callback(null, {});
        });
        AWS.mock('S3', 'putBucketLogging', (_params, callback) => {
            callback(null, {});
        });
        AWS.mock('S3', 'putBucketEncryption', (_params, callback) => {
            callback(null, {});
        });
        AWS.mock('S3', 'putBucketReplication', (_params, callback) => {
            callback(null, {});
        });
        AWS.mock('S3', 'putPublicAccessBlock', (_params, callback) => {
            callback(null, {});
        });
    })

    afterEach(() => {
        AWS.restore('S3');
    })

    it('creates s3 bucket in us-east-1 region', async () => {

        let mock = new MockAdapter(axios);
        mock.onPut().reply(200, {});

        process.env.REGION = 'us-east-1'
        process.env.BUCKET_PREFIX = 'test-bucket'
        let expected = process.env.BUCKET_PREFIX + '-' + process.env.REGION

        const lambda = require('./index.js');
        await lambda.handler(createArtifactStoreBucketEvent, context)
    })

    it('creates s3 bucket in region other than us-east-1', async () => {

        let mock = new MockAdapter(axios);
        mock.onPut().reply(200, {});

        process.env.REGION = 'us-east-2'
        process.env.BUCKET_PREFIX = 'test-bucket'
        let expected = process.env.BUCKET_PREFIX + '-' + process.env.REGION

        const lambda = require('./index.js');
        await lambda.handler(createArtifactStoreBucketEvent, context)
    })
})
