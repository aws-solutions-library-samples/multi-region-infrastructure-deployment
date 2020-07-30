// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk');

const { PRIMARY_STACK, REGION, SECONDARY_STACK, SECONDARY_REGION, NOTIFICATION_SNS_ARN } = process.env;
const sns = new AWS.SNS({ region: REGION });
const codePipeline = new AWS.CodePipeline({ region: REGION });

exports.handler = async (event, context) => {
  console.log(`Requested event: ${JSON.stringify(event, null, 2)}`);

  const codePipelineJob = event['CodePipeline.job'];
  const driftedStacks = [];

  try {
    if (await isDrifted(PRIMARY_STACK, REGION)) {
      driftedStacks.push(PRIMARY_STACK);
    }

    if (await isDrifted(SECONDARY_STACK, SECONDARY_REGION)) {
      driftedStacks.push(SECONDARY_STACK);
    }
  } catch (error) {
    console.error('Error occurred: ', error);

    await codePipeline.putJobFailureResult({
      jobId: codePipelineJob.id,
      failureDetails: {
        message: error.message,
        type: 'JobFailed',
        externalExecutionId: context.invokeid
      }
    }).promise();

    throw error;
  }

  if (driftedStacks.length > 0) {
    try {
      await sns.publish({
        Message: `Stack(s) drifted: ${driftedStacks.join(' and ')}`,
        Subject: `Drift Detection on ${driftedStacks.join(' and ')}`,
        TopicArn: NOTIFICATION_SNS_ARN
      }).promise();
    } catch (error) {
      console.error('Error to publish SNS notification.', error);
    }
  }

  try {
    await codePipeline.putJobSuccessResult({
      jobId: codePipelineJob.id
    }).promise();

    return {
      status: 'SUCCESS',
      pipelineState: 'RUNNING'
    };
  } catch (error) {
    console.error('Error occurred: ', error);

    await codePipeline.putJobFailureResult({
      jobId: codePipelineJob.id,
      failureDetails: {
        message: error.message,
        type: 'JobFailed',
        externalExecutionId: context.invokeid
      }
    }).promise();

    throw error;
  }
}

/**
 * Sleep for a second.
 * @param {number} seconds
 * @return {Promise} - Sleep promise
 */
async function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Check if the CloudFormation stack is drifted.
 * @param {string} stackName - CloudFormation stack name
 * @param {string} region - CloudFormation stack region
 */
async function isDrifted(stackName, region, ) {
  const cloudFormation = new AWS.CloudFormation({ region });

  try {
    const response = await cloudFormation.detectStackDrift({
      StackName: stackName
    }).promise();

    let driftResponse = null;

    do {
      driftResponse = await cloudFormation.describeStackDriftDetectionStatus({
        StackDriftDetectionId: response.StackDriftDetectionId
      }).promise();

      if (driftResponse.DetectionStatus === 'DETECTION_IN_PROGRESS') {
        await sleep(3);
      }
    } while(driftResponse.DetectionStatus === 'DETECTION_IN_PROGRESS');

    if (driftResponse.StackDriftStatus === 'DRIFTED') {
      return true;
    }

    return false;
  } catch (error) {
    if (error.message !== `Stack [${stackName}] does not exist`) {
      throw error;
    }

    return false;
  }
}