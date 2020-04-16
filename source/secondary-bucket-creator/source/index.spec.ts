// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const awsMock = require('aws-sdk-mock');
const axios = require('axios');
const sinon = require('sinon');
const MockAdapter = require('axios-mock-adapter');

describe('Secondary Bucket Creator Lambda', () => {
    let axiosMock: any;

    beforeEach(() => {
        axiosMock = new MockAdapter(axios);
        const emptySpy = sinon.spy((_, callback) => callback(null, {}));

        awsMock.mock('S3', 'createBucket', emptySpy);
        awsMock.mock('S3', 'putBucketAcl', emptySpy);
        awsMock.mock('S3', 'putBucketEncryption', emptySpy);
        awsMock.mock('S3', 'putPublicAccessBlock', emptySpy);
        awsMock.mock('S3', 'putBucketLogging', emptySpy);
    });

    afterEach(() => {
        awsMock.restore();
        sinon.restore();
    });

    test('Testing "Create" Custom Resource Action - Long Bucket Name', async () => {
        const primaryBucketName = 'this-is-a-very-long-primary-bucket-name-close-to-63-characters';
        const secondaryRegion = 'ap-northeast-2';
        const expectedSecondaryBucketName = 't-rimary-bucket-name-close-to-63-characters-ap-northeast-2';

        axiosMock.onPut().reply((config: any) => {
            try {
                const responseData = JSON.parse(config.data);

                if (responseData.Status !== 'SUCCESS') { throw new Error('Success status not returned from Custom Resource Lambda'); }
                if (responseData.Data.BucketName !== expectedSecondaryBucketName) { throw new Error(`Expected bucket name to be "${expectedSecondaryBucketName}". Got "${responseData.Data.BucketName}" instead`)}

                return [200, {}];
            } catch (err) {
                console.error(err);
                return [500, {}];
            }
        });

        const lambdaFunction = require('./index');

        const resp = await lambdaFunction.handler({
            RequestType: 'Create',
            ResourceProperties: {
                PrimaryBucketName: primaryBucketName,
                SecondaryRegion: secondaryRegion
            }
        }, { getRemainingTimeInMillis: () => { return 1000; } });

        expect(resp).toBe(200);
    });

    test('Testing "Create" Custom Resource Action - Short Bucket Name', async () => {
        const primaryBucketName = 'short-name';
        const secondaryRegion = 'ap-northeast-2';
        const expectedSecondaryBucketName = `${primaryBucketName}-${secondaryRegion}`;

        axiosMock.onPut().reply((config: any) => {
            try {
                const responseData = JSON.parse(config.data);

                if (responseData.Status !== 'SUCCESS') { throw new Error('Success status not returned from Custom Resource Lambda'); }
                if (responseData.Data.BucketName !== expectedSecondaryBucketName) { throw new Error(`Expected bucket name to be "${expectedSecondaryBucketName}". Got "${responseData.Data.BucketName}" instead`)}

                return [200, {}];
            } catch (err) {
                console.error(err);
                return [500, {}];
            }
        });

        const lambdaFunction = require('./index');

        const resp = await lambdaFunction.handler({
            RequestType: 'Create',
            ResourceProperties: {
                PrimaryBucketName: primaryBucketName,
                SecondaryRegion: secondaryRegion
            }
        }, { getRemainingTimeInMillis: () => { return 1000; } });

        expect(resp).toBe(200);
    });
});

describe('Secondary Bucket Creator Lambda - NOPs', () => {
    let axiosMock;

    beforeEach(() => {
        axiosMock = new MockAdapter(axios);
    });

    test('Testing "Update" Custom Resource Action', async () => {
        axiosMock.onPut().reply((config) => {
            try {
                const responseData = JSON.parse(config.data);

                if (responseData.Status !== 'SUCCESS') { throw new Error('Success status not returned from Custom Resource Lambda'); }

                return [200, {}];
            } catch (err) {
                console.error(err);
                return [500, {}];
            }
        });

        const lambdaFunction = require('./index');

        const resp = await lambdaFunction.handler({
            RequestType: 'Update',
            ResourceProperties: {}
        }, { getRemainingTimeInMillis: () => { return 1000; } });

        expect(resp).toBe(200);
    });

    test('Testing "Delete" Custom Resource Action', async () => {
        axiosMock.onPut().reply((config) => {
            try {
                const responseData = JSON.parse(config.data);

                if (responseData.Status !== 'SUCCESS') { throw new Error('Success status not returned from Custom Resource Lambda'); }

                return [200, {}];
            } catch (err) {
                console.error(err);
                return [500, {}];
            }
        });

        const lambdaFunction = require('./index');

        const resp = await lambdaFunction.handler({
            RequestType: 'Delete',
            ResourceProperties: {}
        }, { getRemainingTimeInMillis: () => { return 1000; } });

        expect(resp).toBe(200);
    });
});