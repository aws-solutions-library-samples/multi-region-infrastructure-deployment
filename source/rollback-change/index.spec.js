// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const event = {
  "version": "0",
  "id": "f47e5e71-e00a-c118-8807-dbe9ca5893c9",
  "detail-type": "CodePipeline Action Execution State Change",
  "source": "aws.codepipeline",
  "time": "2020-06-01T05:47:22Z",
  "detail": {
    "pipeline": "mock-pipeline",
    "execution-id": "ee9c3169-3f9a-47c5-b835-d693c3a93524",
    "stage": "Stage-test-mock-region",
    "action": "ApproveChangeSet",
    "state": "FAILED",
    "region": "test-mock-region",
    "type": {
      "owner": "AWS",
      "provider": "Lambda",
      "category": "Invoke",
      "version": "1"
    },
    "version": 1
  }
};
const zipContent = '504b03040a0000000000aa8ecb500000000000000000000000000a001c0074656d706c617465732f55540900038f6fe25e9d6fe25e75780b000104e803000004e8030000504b03040a0000000000aa8ecb5000000000000000000000000017001c0074656d706c617465732f74656d706c6174652e79616d6c55540900038f6fe25e9e6fe25e75780b000104e803000004e8030000504b01021e030a0000000000aa8ecb500000000000000000000000000a0018000000000000001000fd410000000074656d706c617465732f55540500038f6fe25e75780b000104e803000004e8030000504b01021e030a0000000000aa8ecb50000000000000000000000000170018000000000000000000b4814400000074656d706c617465732f74656d706c6174652e79616d6c55540500038f6fe25e75780b000104e803000004e8030000504b05060000000002000200ad000000950000000000'

const mockSsm = jest.fn();
const mockS3 = jest.fn();
const mockCloudFormation = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    SSM: jest.fn(() => ({
      getParameter: mockSsm
    })),
    S3: jest.fn(() => ({
      getObject: mockS3,
      putObject: mockS3
    })),
    CloudFormation: jest.fn(() => ({
      updateStack: mockCloudFormation,
      deleteStack: mockCloudFormation
    }))
  };
});

describe('rollback-change', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AWS_REGION = 'test-mock-region';
    process.env.STAGE_STACK_NAME = 'mock-stage-stack-name';
    process.env.PIPELINE_NAME = 'mock-pipeline';
    process.env.STAGE_NAME = 'Stage-test-mock-region';
    process.env.ACTION_NAME = 'ApproveChangeSet';
    process.env.ARTIFACT_SOURCE = '/multi-region/infrastructure-deployment/source-artifact';
    process.env.ARTIFACT_PARAMETER = '/multi-region/infrastructure-deployment/parameter-artifact';
    process.env.TEMPLATE_PATH = 'templates/template.yaml';
  });

  describe('default', () => {
    beforeEach(() => {
      process.env.DELETE_STAGE_STACK = 'Yes';
    });

    it('should return success when different approval is triggered', async () => {
      const differentEvent = {
        "version": "0",
        "id": "f47e5e71-e00a-c118-8807-dbe9ca5893c9",
        "detail-type": "CodePipeline Action Execution State Change",
        "source": "aws.codepipeline",
        "time": "2020-06-01T05:47:22Z",
        "detail": {
          "pipeline": "mock-different",
          "execution-id": "ee9c3169-3f9a-47c5-b835-d693c3a93524",
          "stage": "mock-different",
          "action": "mock-different",
          "state": "FAILED",
          "region": "test-mock-region",
          "type": {
            "owner": "AWS",
            "provider": "Lambda",
            "category": "Invoke",
            "version": "1"
          },
          "version": 1
        }
      }

      const lambda = require('./index');
      const result = await lambda.handler(differentEvent);
      expect(result).toEqual({
        result: 'SUCCESS',
        resultMessage: 'Different approval triggered.'
      });
    });
  });

  describe('DELETE_STAGE_STACK === Yes', () => {
    beforeEach(() => {
      process.env.DELETE_STAGE_STACK = 'Yes';

      mockCloudFormation.mockReset();
    });

    it('should return success when CloudFomration deleteStack succeedss', async () => {
      mockCloudFormation.mockImplementation(() => {
        return {
          // cloudFormation:deleteStack
          promise() {
            return Promise.resolve();
          }
        };
      });

      const lambda = require('./index');
      const result = await lambda.handler(event);
      expect(result).toEqual({
        result: 'SUCCESS',
        resultMessage: 'Stack delete triggered.'
      });
    });

    it('should return success when CloudFomration deleteStack succeedss', async () => {
      mockCloudFormation.mockImplementation(() => {
        return {
          // cloudFormation:deleteStack
          promise() {
            return Promise.reject('ERROR');
          }
        };
      });

      const lambda = require('./index');
      const result = await lambda.handler(event);
      expect(result).toEqual({
        result: 'ERROR',
        resultMessage: 'Error occurred.'
      });
    });
  });

  describe('DELETE_STAGE_STACK === No', () => {
    beforeEach(() => {
      process.env.DELETE_STAGE_STACK = 'No';

      mockSsm.mockReset();
      mockS3.mockReset();
      mockCloudFormation.mockReset();
    });

    it('should return success when SSM parameters exist', async () => {
      mockSsm.mockImplementationOnce(() => {
        return {
          // ssm:getParameter - artifact source
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
          promise() {
            // ssm:getParameter - artifact parameter
            return Promise.resolve({
              Parameter: {
                Value: '{"param1":"value","param2":"value"}'
              }
            });
          }
        };
      });
      mockS3.mockImplementationOnce(() => {
        return {
          // s3:getObject
          promise() {
            return Promise.resolve({
              Body: Buffer.from(zipContent, 'hex')
            });
          }
        };
      }).mockImplementationOnce(() => {
        return {
          // s3:putObject
          promise() {
            return Promise.resolve();
          }
        };
      });
      mockCloudFormation.mockImplementation(() => {
        return {
          // cloudFormation:updateStack
          promise() {
            return Promise.resolve({
              StackId: 'stack-id-to-return'
            });
          }
        };
      });

      const lambda = require('./index');
      const result = await lambda.handler(event);
      expect(result).toEqual({
        result: 'SUCCESS',
        resultMessage: 'Stack update triggerred: stack-id-to-return'
      });
    });

    it('should return success when there is no SSM parameter', async () => {
      mockSsm.mockImplementation(() => {
        return {
          promise() {
            // ssm:getParameter
            return Promise.reject({
              code: 'ParameterNotFound',
              message: 'Parameter does not exist.'
            });
          }
        }
      });
      mockCloudFormation.mockImplementation(() => {
        return {
          promise() {
            return Promise.resolve();
          }
        };
      });

      const lambda = require('./index');
      const result = await lambda.handler(event);
      expect(result).toEqual({
        result: 'SUCCESS',
        resultMessage: 'Stack delete triggerred.'
      });
    });

    it('should return error when SSM getParameter error is not ParameterNotFound', async () => {
      mockSsm.mockImplementation(() => {
        return {
          promise() {
            return Promise.reject({
              code: 'SomethingDifferent',
              message: 'Something different error occurred.'
            });
          }
        }
      });

      const lambda = require('./index');
      const result = await lambda.handler(event);
      expect(result).toEqual({
        result: 'ERROR',
        resultMessage: 'Error occurred.'
      });
    });

    // s3 get object error
    it('should return error when S3 getObject fails', async () => {
      mockSsm.mockImplementationOnce(() => {
        return {
          // ssm:getParameter - artifact source
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
          promise() {
            // ssm:getParameter - artifact parameter
            return Promise.resolve({
              Parameter: {
                Value: '{"param1":"value","param2":"value"}'
              }
            });
          }
        };
      });
      mockS3.mockImplementation(() => {
        return {
          // s3:getObject
          promise() {
            return Promise.reject('ERROR');
          }
        };
      });

      const lambda = require('./index');
      const result = await lambda.handler(event);
      expect(result).toEqual({
        result: 'ERROR',
        resultMessage: 'Error occurred.'
      });
    });

    // s3 put object error
    it('should return error when S3 putObject fails', async () => {
      mockSsm.mockImplementationOnce(() => {
        return {
          // ssm:getParameter - artifact source
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
          promise() {
            // ssm:getParameter - artifact parameter
            return Promise.resolve({
              Parameter: {
                Value: '{"param1":"value","param2":"value"}'
              }
            });
          }
        };
      });
      mockS3.mockImplementationOnce(() => {
        return {
          // s3:getObject
          promise() {
            return Promise.resolve({
              Body: Buffer.from(zipContent, 'hex')
            });
          }
        };
      }).mockImplementationOnce(() => {
        return {
          // s3:putObject
          promise() {
            return Promise.reject('ERROR');
          }
        };
      });

      const lambda = require('./index');
      const result = await lambda.handler(event);
      expect(result).toEqual({
        result: 'ERROR',
        resultMessage: 'Error occurred.'
      });
    });

    // cfn delete error
    it('should return success when CloudFormation deleteStack fails', async () => {
      mockSsm.mockImplementation(() => {
        return {
          promise() {
            // ssm:getParameter
            return Promise.reject({
              code: 'ParameterNotFound',
              message: 'Parameter does not exist.'
            });
          }
        }
      });
      mockCloudFormation.mockImplementation(() => {
        return {
          promise() {
            return Promise.reject('ERROR');
          }
        };
      });

      const lambda = require('./index');
      const result = await lambda.handler(event);
      expect(result).toEqual({
        result: 'ERROR',
        resultMessage: 'Error occurred.'
      });
    });

    // cfn update error
    it('should return error when CloudFormation updateStack fails', async () => {
      mockSsm.mockImplementationOnce(() => {
        return {
          // ssm:getParameter - artifact source
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
          promise() {
            // ssm:getParameter - artifact parameter
            return Promise.resolve({
              Parameter: {
                Value: '{"param1":"value","param2":"value"}'
              }
            });
          }
        };
      });
      mockS3.mockImplementationOnce(() => {
        return {
          // s3:getObject
          promise() {
            return Promise.resolve({
              Body: Buffer.from(zipContent, 'hex')
            });
          }
        };
      }).mockImplementationOnce(() => {
        return {
          // s3:putObject
          promise() {
            return Promise.resolve();
          }
        };
      });
      mockCloudFormation.mockImplementation(() => {
        return {
          // cloudFormation:updateStack
          promise() {
            return Promise.reject('ERROR');
          }
        };
      });

      const lambda = require('./index');
      const result = await lambda.handler(event);
      expect(result).toEqual({
        result: 'ERROR',
        resultMessage: 'Error occurred.'
      });
    });
  });
});