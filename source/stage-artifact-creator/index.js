// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk');
const admZip = require('adm-zip');

const { STACK_NAME, REGION, ARTIFACT_SOURCE, ARTIFACT_PARAMETER, ARTIFACT_SOURCE_NAME, ARTIFACT_PARAMETER_NAME } = process.env;
const ssm = new AWS.SSM({ region: REGION });
const cloudFormation = new AWS.CloudFormation({ region: REGION });
const s3 = new AWS.S3({ region: REGION });
const codePipeline = new AWS.CodePipeline({ region: REGION });

exports.handler = async (event, context) => {
  console.log(`Requested event: ${JSON.stringify(event, null, 2)}`);

  const codePipelineJob = event['CodePipeline.job'];
  const outputArtifact = codePipelineJob.data.outputArtifacts;
  const sourceOutputArtifact = outputArtifact.filter(artifact => artifact.name === ARTIFACT_SOURCE_NAME)[0];
  const parameterOutputArtifact = outputArtifact.filter(artifact => artifact.name === ARTIFACT_PARAMETER_NAME)[0];
  const soureArtifactBucket = sourceOutputArtifact.location.s3Location.bucketName;
  const soureArtifactObjectKey = sourceOutputArtifact.location.s3Location.objectKey;
  const parameterArtifactBucket = parameterOutputArtifact.location.s3Location.bucketName;
  const parameterArtifactObjectKey = parameterOutputArtifact.location.s3Location.objectKey;

  let sourceBucket = '';
  let sourceKey = '';
  let configuration = {
    Parameters: {}
  };

  // Check source code artifact.
  try {
    const response = await ssm.getParameter({ Name: ARTIFACT_SOURCE, WithDecryption: true }).promise();
    const parameter = JSON.parse(response.Parameter.Value);
    sourceBucket = parameter.sourceBucket;
    sourceKey = parameter.sourceKey;
  } catch (error) {
    if (error.code === 'ParameterNotFound') {
      // SSM getParameter throws an error when the parameter does not exist.
      const inputArtifact = codePipelineJob.data.inputArtifacts[0];
      sourceBucket = inputArtifact.location.s3Location.bucketName;
      sourceKey = inputArtifact.location.s3Location.objectKey;
    } else {
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

  // Check CloudFormation parameter artifact.
  try {
    const response = await ssm.getParameter({ Name: ARTIFACT_PARAMETER, WithDecryption: true }).promise();
    const parameter = JSON.parse(response.Parameter.Value);
    configuration.Parameters = parameter;
  } catch (error) {
    if (error.code === 'ParameterNotFound') {
      // SSM getParameter throws an error when the parameter does not exist.
      try {
        const response = await cloudFormation.describeStacks({ StackName: STACK_NAME }).promise();
        const stackParameters = response.Stacks[0].Parameters.filter(parameter => parameter.ParameterKey === 'StageParameters');
        configuration.Parameters = stackParameters[0].ParameterValue === '' ? {} : JSON.parse(stackParameters[0].ParameterValue);
      } catch (cfnError) {
        console.error('Error occurred: ', cfnError);

        return await sendResult({
          success: false,
          jobId: codePipelineJob.id,
          failureDetails: {
            message: cfnError.message,
            type: 'JobFailed',
            externalExecutionId: context.invokeid
          }
        });
      }
    } else {
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

  try {
    // Copy source code artifact.
    await s3.copyObject({
      Bucket: soureArtifactBucket,
      Key: soureArtifactObjectKey,
      CopySource: `${sourceBucket}/${sourceKey}`
    }).promise();

    // Put parameter artifact.
    const fileName = parameterArtifactObjectKey.split('/').pop();
    const zip = new admZip();
    const content = JSON.stringify(configuration);
    zip.addFile('parameters.json', Buffer.alloc(content.length, content, 'utf-8'));
    zip.writeZip(`/tmp/${fileName}.zip`);

    await s3.putObject({
      Bucket: parameterArtifactBucket,
      Key: parameterArtifactObjectKey,
      Body: zip.toBuffer()
    }).promise();

    return await sendResult({
      success: true,
      jobId: codePipelineJob.id
    });
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

    return {
      status: 'SUCCESS',
      pipelineState: 'RUNNING'
    };
  } else {
    await codePipeline.putJobFailureResult({
      jobId,
      failureDetails
    }).promise();

    return {
      status: 'SUCCESS',
      pipelineState: 'STOPPED'
    };
  }
}