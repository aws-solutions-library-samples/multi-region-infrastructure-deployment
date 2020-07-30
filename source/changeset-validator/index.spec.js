// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const event = {
  "CodePipeline.job": {
    "id": "e35011e7-9820-4dcc-9bbb-16d0050656ee",
    "data": {
      "inputArtifacts": [
        {
          "name": "mr1-ChangeSet-CheckChangeSet-us-east-1"
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

const mockCloudFormation = jest.fn();
const mockSsm = jest.fn();
const mockCodePipeline = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    CloudFormation: jest.fn(() => ({
      describeChangeSet: mockCloudFormation
    })),
    SSM: jest.fn(() => ({
      getParameter: mockSsm
    })),
    CodePipeline: jest.fn(() => ({
      putJobSuccessResult: mockCodePipeline,
      putJobFailureResult: mockCodePipeline
    }))
  };
});

describe('changeset-validator-lambda',() => {
  describe('DELETE_STAGE_STACK === Yes', () => {
    beforeEach(() => {
      process.env.REGION = 'test-mock-region';
      process.env.STACK_NAME = 'test-stack';
      process.env.DELETE_STAGE_STACK = 'Yes';
      process.env.ARTIFACT_SOURCE = '/multi-region/infrastructure-deployment/previous-artifact';

      mockCloudFormation.mockReset();
      mockSsm.mockReset();
      mockCodePipeline.mockReset();
    });

    it('should succeed when there is no change and no SSM parameter', async () => {
      mockCloudFormation.mockImplementation(() => {
        return {
          // cloudFormation:describeChangeSet
          promise() {
            return Promise.resolve({
              Status: 'FAILED',
              StatusReason: 'No changes in ChangeSet'
            });
          }
        };
      });
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

    it('should fail when there is no change but SSM parameter exists', async () => {
      mockCloudFormation.mockImplementation(() => {
        return {
          // cloudFormation:describeChangeSet
          promise() {
            return Promise.resolve({
              Status: 'FAILED',
              StatusReason: 'No changes in ChangeSet'
            });
          }
        };
      });
      mockSsm.mockImplementation(() => {
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

  describe('DELETE_STAGE_STACK === No', () => {
    beforeEach(() => {
      process.env.REGION = 'test-mock-region';
      process.env.STACK_NAME = 'test-stack';
      process.env.DELETE_STAGE_STACK = 'No';
      process.env.ARTIFACT_SOURCE = '/multi-region/infrastructure-deployment/previous-artifact';

      mockCloudFormation.mockReset();
      mockCodePipeline.mockReset();
    });

    it('should succeed when there are any changes', async () => {
      mockCloudFormation.mockImplementation(() => {
        return {
          // cloudFormation:describeChangeSet
          promise() {
            return Promise.resolve({
              Status: 'CREATE_PENDING'
            });
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

    it('should fail when there is no change', async () => {
      mockCloudFormation.mockImplementation(() => {
        return {
          // cloudFormation:describeChangeSet
          promise() {
            return Promise.resolve({
              Status: 'FAILED',
              StatusReason: 'No changes in ChangeSet'
            });
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
});