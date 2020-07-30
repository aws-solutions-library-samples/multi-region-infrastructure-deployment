// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const event = {
  "CodePipeline.job": {
    "id": "5e1fedf9-d9bf-4f2e-a11a-5fff5b110fa9",
    "data": {
      "inputArtifacts": [
        {
          "name": "Source",
          "revision": "3a6e84be5229e0721ea5a8a4f406f46516fa1e31",
          "location": {
            "type": "S3",
            "s3Location": {
              "bucketName": "bucket-name",
              "objectKey": "object-key"
            }
          }
        }
      ]
    }
  }
};

const context = {
  invokeid: 'lkajsdflkjas9d87fy792kjeh',
  success: function(_message) {},
  fail: function(_message) {}
};

const mockSsm = jest.fn();
const mockCodePipeline = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    SSM: jest.fn(() => ({
      putParameter: mockSsm
    })),
    CodePipeline: jest.fn(() => ({
      putJobSuccessResult: mockCodePipeline,
      putJobFailureResult: mockCodePipeline
    }))
  };
});

describe('stage-artifact-putter-lambda', function() {
  beforeEach(function() {
    process.env.REGION = 'test-mock-region';
    process.env.ARTIFACT_SOURCE = '/multi-region/infrastructure-deployment/source-artifact';
    process.env.ARTIFACT_PARAMETER = '/multi-region/infrastructure-deployment/parameter-artifact';

    mockSsm.mockReset();
    mockCodePipeline.mockReset();
  });

  it('should succeed when putting SSM paramter succeeds', async function() {
    mockSsm.mockImplementation(() => {
      return {
        // ssm:putParameter
        promise() {
          return Promise.resolve();
        }
      };
    });
    mockCodePipeline.mockImplementation(() => {
      return {
        // codePipeline:putJobSuccessResult
        promise() {
          return Promise.resolve();
        }
      };
    });

    const lambda = require('./index');
    const result = await lambda.handler(event, context);
    expect(result).toEqual({
      status: 'SUCCESS',
      pipelineState: 'RUNNING'
    });
  });

  process.env.CLOUDFORMATION_PARAMETERS = '{"ParameterA":"Value"}';
  it('should succeed when putting both SSM paramters succeeds', async function() {
    mockSsm.mockImplementation(() => {
      return {
        // ssm:putParameter
        promise() {
          return Promise.resolve();
        }
      };
    });
    mockCodePipeline.mockImplementation(() => {
      return {
        // codePipeline:putJobSuccessResult
        promise() {
          return Promise.resolve();
        }
      };
    });

    const lambda = require('./index');
    const result = await lambda.handler(event, context);
    expect(result).toEqual({
      status: 'SUCCESS',
      pipelineState: 'RUNNING'
    });
  });

  it('should throw an error when putting SSM paramter fails', async function() {
    mockSsm.mockImplementation(() => {
      return {
        // ssm:putParameter
        promise() {
          return Promise.reject('ERROR');
        }
      };
    });
    mockCodePipeline.mockImplementation(() => {
      return {
        // codePipeline:putJobFailureResult
        promise() {
          return Promise.resolve();
        }
      };
    });

    const lambda = require('./index');
    await lambda.handler(event, context).catch(error => {
      expect(error).toEqual('ERROR');
    });
  });
});