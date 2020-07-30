// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import packages
const axios = require('axios');

/**
 * Request handler.
 */
exports.handler = async (event, context) => {
  console.log(`Received event: ${JSON.stringify(event)}`);

  let response = {
    status: 'SUCCESS',
    data: {},
  };
  const anonymousProperties = {
    ...event.ResourceProperties,
    TYPE: event.RequestType
  };

  response.data = await sendAnonymousUsage(anonymousProperties);
  await sendResponse(event, context.logStreamName, response);

  return response;
}

/**
 * Send custom resource response.
 * @param {object} event - Custom resource event
 * @param {string} logStreamName - Custom resource log stream name
 * @param {object} response - Response object { status: "SUCCESS|FAILED", data: any }
 */
async function sendResponse(event, logStreamName, response) {
  const responseBody = JSON.stringify({
    Status: response.status,
    Reason: `See the details in CloudWatch Log Stream: ${logStreamName}`,
    PhysicalResourceId: logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: response.data,
  });

  console.log(`RESPONSE BODY: ${responseBody}`);

  const config = {
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length
    }
  };

  await axios.put(event.ResponseURL, responseBody, config);
}

/**
 * Send anonymous usage.
 * @param {object} properties - Anonymous properties object { SOLUTION_ID: string, UUID: string, VERSION: string, TYPE: "Create|Update|Delete", SEND_METRICS: "Yes|No" }
 * @return {Promise} - Promise mesage object
 */
async function sendAnonymousUsage(properties) {
  const METRICS_ENDPOINT = 'https://metrics.awssolutionsbuilder.com/generic';
  const { SOLUTION_ID, UUID, VERSION, TYPE, SEND_METRICS } = properties;

  if (SEND_METRICS === 'true') {
    const config = {
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const data = {
      Solution: SOLUTION_ID,
      TimeStamp: `${new Date().toISOString().replace(/T/, ' ')}`,
      UUID: UUID,
      Version: VERSION,
      Data: {
        Region: process.env.AWS_REGION,
        Type: TYPE
      }
    };

    try {
      await axios.post(METRICS_ENDPOINT, data, config);
      return { Message: 'Anonymous data was sent successfully.' };
    } catch (error) {
      console.error('Error to send anonymous usage.');
      return { Message: 'Anonymous data was sent failed.' };
    }
  } else {
    return { Message: 'Anonymous data was not sent.' };
  }
}