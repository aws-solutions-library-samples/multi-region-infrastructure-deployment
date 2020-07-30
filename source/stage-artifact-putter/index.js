// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk');

const { REGION, ARTIFACT_SOURCE, ARTIFACT_PARAMETER, CLOUDFORMATION_PARAMETERS } = process.env;
const ssm = new AWS.SSM({ region: REGION });
const codePipeline = new AWS.CodePipeline({ region: REGION });

exports.handler = async (event, context) => {
  console.log(`Requested event: ${JSON.stringify(event, null, 2)}`);

  const codePipelineJob = event['CodePipeline.job'];

  try {
    const inputArtifact = codePipelineJob.data.inputArtifacts[0];

    await ssm.putParameter({
      Name: ARTIFACT_SOURCE,
      Type: 'SecureString',
      Value: JSON.stringify({
        sourceBucket: inputArtifact.location.s3Location.bucketName,
        sourceKey: inputArtifact.location.s3Location.objectKey
      }),
      Overwrite: true
    }).promise();

    await ssm.putParameter({
      Name: ARTIFACT_PARAMETER,
      Type: 'SecureString',
      Value: CLOUDFORMATION_PARAMETERS || '{}',
      Overwrite: true
    }).promise();

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