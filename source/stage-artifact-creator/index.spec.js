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
      ],
      "outputArtifacts": [
        {
          "name": "StageArtifact-Source",
          "revision": null,
          "location": {
            "type": "S3",
            "s3Location": {
              "bucketName": "bucket-name",
              "objectKey": "stage-artifact/source-object-key"
            }
          }
        },
        {
          "name": "StageArtifact-Parameter",
          "revision": null,
          "location": {
            "type": "S3",
            "s3Location": {
              "bucketName": "bucket-name",
              "objectKey": "stage-artifact/parameter-object-key"
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
const mockCloudFormation = jest.fn();
const mockS3 = jest.fn();
const mockCodePipeline = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    SSM: jest.fn(() => ({
      getParameter: mockSsm
    })),
    CloudFormation: jest.fn(() => ({
      describeStacks: mockCloudFormation
    })),
    S3: jest.fn(() => ({
      copyObject: mockS3,
      putObject: mockS3
    })),
    CodePipeline: jest.fn(() => ({
      putJobSuccessResult: mockCodePipeline,
      putJobFailureResult: mockCodePipeline
    }))
  };
});

describe('stage-artifact-creator-lambda', function() {
  beforeEach(function() {
    process.env.STACK_NAME = 'test-stack';
    process.env.REGION = 'test-mock-region';
    process.env.ARTIFACT_SOURCE = '/multi-region/infrastructure-deployment/source-artifact';
    process.env.ARTIFACT_PARAMETER = '/multi-region/infrastructure-deployment/parameter-artifact';
    process.env.ARTIFACT_SOURCE_NAME = 'StageArtifact-Source';
    process.env.ARTIFACT_PARAMETER_NAME = 'StageArtifact-Parameter';

    mockSsm.mockReset();
    mockS3.mockReset();
    mockCloudFormation.mockReset();
    mockCodePipeline.mockReset();
  });

  it('should succeed when SSM parameter does not exist', async function() {
    mockSsm.mockImplementation(() => {
      return {
        // ssm:getParameter
        promise() {
          return Promise.reject({
            code: 'ParameterNotFound',
            message: 'Parameter does not exist.'
          });
        }
      };
    });
    mockCloudFormation.mockImplementation(() => {
      return {
        // cloudformation:describeStacks
        promise() {
          return Promise.resolve({
            Stacks: [
              {
                StackName: process.env.STACK_NAME,
                Parameters: [
                  {
                    ParameterKey: 'StageParameters',
                    ParameterValue: '{"ParameterA":"Value"}'
                  }
                ]
              }
            ]
          });
        }
      }
    })
    mockS3.mockImplementation(() => {
      return {
        // s3:copyObject
        // s3:putObject
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

  it('should throw an error when describing CloudFormation stacks fails', async function() {
    mockSsm.mockImplementation(() => {
      return {
        // ssm:getParameter
        promise() {
          return Promise.reject({
            code: 'ParameterNotFound',
            message: 'Parameter does not exist.'
          });
        }
      };
    });
    mockCloudFormation.mockImplementation(() => {
      return {
        // cloudformation:describeStacks
        promise() {
          return Promise.reject({ message: 'ERROR' });
        }
      }
    })
    mockCodePipeline.mockImplementation(() => {
      return {
        // codePipeline:putJobFailureResult
        promise() {
          return Promise.resolve();
        }
      };
    });

    const lambda = require('./index');
    const result = await lambda.handler(event, context);
    expect(result).toEqual({
      status: 'SUCCESS',
      pipelineState: 'STOPPED'
    });
  });

  it('should succeed when SSM parameter exists', async function() {
    mockSsm.mockImplementationOnce(() => {
      return {
        // ssm:getParameter
        promise() {
          return Promise.resolve({
            Parameter: {
              Value: '{"sourceBucket":"source-bucket","sourceKey":"source-key"}'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // ssm:getParameter
        promise() {
          return Promise.resolve({
            Parameter: {
              Value: '{"ParameterA":"Value"}'
            }
          });
        }
      }
    });
    mockS3.mockImplementation(() => {
      return {
        // s3:copyObject
        // s3:putObject
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

  it('should throw an error when copying S3 object fails', async function() {
    mockSsm.mockImplementationOnce(() => {
      return {
        // ssm:getParameter
        promise() {
          return Promise.resolve({
            Parameter: {
              Value: '{"sourceBucket":"source-bucket","sourceKey":"source-key"}'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // ssm:getParameter
        promise() {
          return Promise.resolve({
            Parameter: {
              Value: '{"ParameterA":"Value"}'
            }
          });
        }
      }
    });
    mockS3.mockImplementation(() => {
      return {
        // s3:copyObject
        promise() {
          return Promise.reject({ message: 'ERROR' });
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
    const result = await lambda.handler(event, context);
    expect(result).toEqual({
      status: 'SUCCESS',
      pipelineState: 'STOPPED'
    });
  });

  it('should throw an error when putting S3 object fails', async function() {
    mockSsm.mockImplementationOnce(() => {
      return {
        // ssm:getParameter
        promise() {
          return Promise.resolve({
            Parameter: {
              Value: '{"sourceBucket":"source-bucket","sourceKey":"source-key"}'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // ssm:getParameter
        promise() {
          return Promise.resolve({
            Parameter: {
              Value: '{"ParameterA":"Value"}'
            }
          });
        }
      }
    });
    mockS3.mockImplementationOnce(() => {
      return {
        // s3:copyObject
        promise() {
          return Promise.resolve();
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // s3:putObject
        promise() {
          return Promise.reject({ message: 'ERROR' });
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
    const result = await lambda.handler(event, context);
    expect(result).toEqual({
      status: 'SUCCESS',
      pipelineState: 'STOPPED'
    });
  });
});