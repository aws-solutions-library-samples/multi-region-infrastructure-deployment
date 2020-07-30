// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk');
const fs = require('fs');
const admZip = require('adm-zip');

const { AWS_REGION, STAGE_STACK_NAME, PIPELINE_NAME, STAGE_NAME, ACTION_NAME, ARTIFACT_SOURCE, ARTIFACT_PARAMETER, DELETE_STAGE_STACK, TEMPLATE_PATH } = process.env;
const ssm = new AWS.SSM({ region: AWS_REGION });
const s3 = new AWS.S3({ region: AWS_REGION });
const cloudFormation = new AWS.CloudFormation({ region: AWS_REGION });

exports.handler = async (event) => {
  console.log(`Requested event: ${JSON.stringify(event, null, 2)}`);

  const { pipeline, stage, action } = event.detail;

  if (pipeline !== PIPELINE_NAME || stage !== STAGE_NAME || action !== ACTION_NAME) {
    console.log('Different approval triggered.');

    return {
      result: 'SUCCESS',
      resultMessage: 'Different approval triggered.'
    };
  }

  try {
    if (DELETE_STAGE_STACK === 'Yes') {
      await cloudFormation.deleteStack({ StackName: STAGE_STACK_NAME }).promise();

      console.log('Stack delete triggered.');

      return {
        result: 'SUCCESS',
        resultMessage: 'Stack delete triggered.'
      };
    } else {
      try {
        const sourceResponse = await ssm.getParameter({ Name: ARTIFACT_SOURCE, WithDecryption: true }).promise();
        const sourceParameter = JSON.parse(sourceResponse.Parameter.Value);

        console.log(`Source Parameter: ${sourceParameter}`);

        const artifact = await s3.getObject({
          Bucket: sourceParameter.sourceBucket,
          Key: sourceParameter.sourceKey
        }).promise();

        fs.writeFileSync('/tmp/artifact.zip', artifact.Body);

        const zip = new admZip('/tmp/artifact.zip');
        const template = zip.readAsText(TEMPLATE_PATH);

        await s3.putObject({
          Bucket: sourceParameter.sourceBucket,
          Key: TEMPLATE_PATH,
          Body: template,
          ServerSideEncryption: 'AES256'
        }).promise();

        const parameterResponse = await ssm.getParameter({ Name: ARTIFACT_PARAMETER, WithDecryption: true }).promise();
        const parameterParameter = JSON.parse(parameterResponse.Parameter.Value);
        const parameters = [];

        for (const key in parameterParameter) {
          parameters.push({
            ParameterKey: key,
            ParameterValue: parameterParameter[key]
          });
        }

        const params = {
          StackName: STAGE_STACK_NAME,
          Capabilities: [ 'CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND' ],
          Parameters: parameters,
          TemplateURL: `https://${sourceParameter.sourceBucket}.s3.${AWS_REGION}.amazonaws.com/${TEMPLATE_PATH}`
        };

        const response = await cloudFormation.updateStack(params).promise();

        console.log(`Stack update triggerred: ${response.StackId}`);

        return {
          result: 'SUCCESS',
          resultMessage: `Stack update triggerred: ${response.StackId}`
        };
      } catch (error) {
        if (error.code === 'ParameterNotFound') {
          await cloudFormation.deleteStack({ StackName: STAGE_STACK_NAME }).promise();

          console.log('Stack delete triggerred.');

          return {
            result: 'SUCCESS',
            resultMessage: 'Stack delete triggerred.'
          };
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error occurred: ', error);

    return {
      result: 'ERROR',
      resultMessage: 'Error occurred.'
    };
  }
}