// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk');
const metrics = require('./metrics');

const { REGION, STACK_NAME, DELETE_STAGE_STACK, ARTIFACT_SOURCE } = process.env;
const ssm = new AWS.SSM({ region: REGION });
const cloudFormation = new AWS.CloudFormation({ region: REGION });
const codePipeline = new AWS.CodePipeline({ region: REGION });

exports.handler = async (event, context) => {
  console.log(`Requested event: ${JSON.stringify(event, null, 2)}`);

  const codePipelineJob = event["CodePipeline.job"];

  try {
    const changeSetName = codePipelineJob.data.inputArtifacts[0].name;
    const changeSet = await cloudFormation.describeChangeSet({
      ChangeSetName: changeSetName,
      StackName: STACK_NAME
    }).promise();

    if (changeSet.Status === 'FAILED') {
      if (DELETE_STAGE_STACK === 'Yes') {
        try {
          // Getting SSM parameter checks if this is the first time CodePipeline process or not.
          await ssm.getParameter({ Name: ARTIFACT_SOURCE }).promise();
          return await sendResult({
            success: false,
            jobId: codePipelineJob.id,
            failureDetails: {
              message: changeSet.StatusReason,
              type: 'JobFailed',
              externalExecutionId: context.invokeid
            }
          });
        } catch (error) {
          // This catch error would occur only before the first CodePipeline process success.
          if (error.code === 'ParameterNotFound') {
            return await sendResult({
              success: true,
              jobId: codePipelineJob.id
            });
          } else {
            return await sendResult({
              success: false,
              jobId: codePipelineJob.id,
              failureDetails: {
                message: changeSet.StatusReason,
                type: 'JobFailed',
                externalExecutionId: context.invokeid
              }
            });
          }
        }
      } else {
        return await sendResult({
          success: false,
          jobId: codePipelineJob.id,
          failureDetails: {
            message: changeSet.StatusReason,
            type: 'JobFailed',
            externalExecutionId: context.invokeid
          }
        });
      }
    } else {
      return await sendResult({
        success: true,
        jobId: codePipelineJob.id
      });
    }
  } catch (error) {
    console.error('Error occurred: ', error);

    return await sendResult({
      success: false,
      jobId: codePipelineJob.id,
      failureDetails: {
        message: error.message,
        type: 'JobFailed',
        externalExecutionId: context.invokeid
      }
    });
  }
}

/**
 * Send CodePipeline result.
 * @param {object} data - { success: boolean, jobId: string, failureDetails?: object }
 */
async function sendResult(data) {
  const { success, jobId, failureDetails } = data;

  if (success) {
    await codePipeline.putJobSuccessResult({ jobId }).promise();

    await metrics.send({
      success: 'true'
    });

    return {
      status: 'SUCCESS',
      pipelineState: 'RUNNING'
    };
  } else {
    await codePipeline.putJobFailureResult({
      jobId,
      failureDetails
    }).promise();

    await metrics.send({
      sucess: 'false'
    });

    return {
      status: 'SUCCESS',
      pipelineState: 'STOPPED'
    };
  }
}