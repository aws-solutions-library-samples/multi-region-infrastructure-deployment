// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const event = {
  "CodePipeline.job": {
    "id": "5e1fedf9-d9bf-4f2e-a11a-5fff5b110fa9",
    "data": {
      "inputArtifacts": [],
      "outputArtifacts": []
    }
  }
};

const context = {
  invokeid: 'lkajsdflkjas9d87fy792kjeh',
  success: function(_message) {},
  fail: function(_message) {}
};

const mockCloudFormation = jest.fn();
const mockSns = jest.fn();
const mockCodePipeline = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    CloudFormation: jest.fn(() => ({
      detectStackDrift: mockCloudFormation,
      describeStackDriftDetectionStatus: mockCloudFormation
    })),
    SNS: jest.fn(() => ({
      publish: mockSns
    })),
    CodePipeline: jest.fn(() => ({
      putJobSuccessResult: mockCodePipeline,
      putJobFailureResult: mockCodePipeline
    }))
  };
});

describe('drift-detection-lambda', function() {
  beforeEach(function() {
    process.env.PRIMARY_STACK = 'primary-stack';
    process.env.REGION = 'test-region-1';
    process.env.SECONDARY_STACK = 'secondary-stack';
    process.env.SECONDARY_REGION = 'test-region-2';
    process.env.NOTIFICATION_SNS_ARN = 'arn:of:sns:topic';

    mockCloudFormation.mockReset();
    mockSns.mockReset();
    mockCodePipeline.mockReset();
  });

  it('should succeed when no stack found, likely happens at the first round', async function() {
    mockCloudFormation.mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.reject({
            message: `Stack [${process.env.PRIMARY_STACK}] does not exist`
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.reject({
            message: `Stack [${process.env.SECONDARY_STACK}] does not exist`
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

  it('should succeed when stacks are drifted', async function() {
    mockCloudFormation.mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.PRIMARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "DRIFTED",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_COMPLETE",
            "DriftedStackResourceCount": 0
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.SECONDARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "DRIFTED",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_COMPLETE",
            "DriftedStackResourceCount": 0
          });
        }
      };
    });
    mockSns.mockImplementation(() => {
      return {
        // sns:publish
        promise() {
          return Promise.resolve({ "MessageId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f" });
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

  it('should succeed when stacks are drifted - DETECTION_IN_PROGRESS', async function() {
    mockCloudFormation.mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.PRIMARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "NOT_CHECKED",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_IN_PROGRESS",
            "DriftedStackResourceCount": 0
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.PRIMARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "DRIFTED",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_COMPLETE",
            "DriftedStackResourceCount": 0
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.SECONDARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "DRIFTED",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_COMPLETE",
            "DriftedStackResourceCount": 0
          });
        }
      };
    });
    mockSns.mockImplementation(() => {
      return {
        // sns:publish
        promise() {
          return Promise.resolve({ "MessageId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f" });
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

  it('should succeed when stacks are in sync', async function() {
    mockCloudFormation.mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.PRIMARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "IN_SYNC",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_FAILED",
            "DriftedStackResourceCount": 0
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.PRIMARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "IN_SYNC",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_FAILED",
            "DriftedStackResourceCount": 0
          });
        }
      };
    });
    mockSns.mockImplementation(() => {
      return {
        // sns:publish
        promise() {
          return Promise.resolve({ "MessageId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f" });
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

  it('should succeed when SNS error occurs', async function() {
    mockCloudFormation.mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.PRIMARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "DRIFTED",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_COMPLETE",
            "DriftedStackResourceCount": 0
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.SECONDARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "DRIFTED",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_COMPLETE",
            "DriftedStackResourceCount": 0
          });
        }
      };
    });
    mockSns.mockImplementation(() => {
      return {
        // sns:publish
        promise() {
          return Promise.reject('ERROR');
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

  it('should fail when other error occurs', async function() {
    mockCloudFormation.mockImplementation(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.reject({
            message: 'Unknown error occurred'
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
    try {
      const result = await lambda.handler(event, context);
      expect(result).toEqual('Failed: Error is expected');
    } catch (error) {
      expect(error).toEqual({
        message: 'Unknown error occurred'
      });
    }
  });

  it('should fail when putJob fails', async function() {
    mockCloudFormation.mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.PRIMARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "DRIFTED",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_COMPLETE",
            "DriftedStackResourceCount": 0
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:detectStackDrift
        promise() {
          return Promise.resolve({
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f"
          });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // cloudFormation:describeStackDriftDetectionStatus
        promise() {
          return Promise.resolve({
            "StackId": `arn:of:cloudformation:stack/${process.env.SECONDARY_STACK}/1c6f1cb0-a4f8-11ea-ade4-0e715b49d7c1`,
            "StackDriftDetectionId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f",
            "StackDriftStatus": "IN_SYNC",
            "Timestamp": "2020-06-04T17:43:14.929Z",
            "DetectionStatus": "DETECTION_COMPLETE",
            "DriftedStackResourceCount": 0
          });
        }
      };
    });
    mockSns.mockImplementation(() => {
      return {
        // sns:publish
        promise() {
          return Promise.resolve({ "MessageId": "de0ca610-a68a-11ea-89b2-0aff04b5e65f" });
        }
      };
    });
    mockCodePipeline.mockImplementationOnce(() => {
      return {
        // codePipeline:putJobSuccessResult
        promise() {
          return Promise.reject({ message: 'ERROR' });
        }
      };
    }).mockImplementationOnce(() => {
      return {
        // codePipeline:putJobFailureResult
        promise() {
          return Promise.resolve();
        }
      };
    });

    const lambda = require('./index');
    try {
      const result = await lambda.handler(event, context);
      expect(result).toEqual('Failed: Error is expected');
    } catch (error) {
      expect(error).toEqual({
        message: 'ERROR'
      });
    }
  });
});