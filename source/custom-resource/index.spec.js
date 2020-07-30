// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import packages
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const axiosMock = new MockAdapter(axios);

// System environment
process.env.AWS_REGION = 'mock-region-1';

// Mock axios
axiosMock.onPut('/cfn-response').reply(200);

// Mock context
const context = {
  logStreamName: 'log-stream'
};

// Import index.js
const index = require('./index.js');

// Unit tests
describe('index', function() {
  describe('SendAnonymousUsage', function() {
    it('should return success when sending anonymous usage succeeds', async function() {
      // Mock event data
      const event = {
        "RequestType": "Create",
        "ServiceToken": "LAMBDA_ARN",
        "ResponseURL": "/cfn-response",
        "StackId": "CFN_STACK_ID",
        "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
        "LogicalResourceId": "SendAnonymousUsage",
        "ResourceType": "Custom::SendAnonymousUsage",
        "ResourceProperties": {
          "ServiceToken": "LAMBDA_ARN",
          "SOLUTION_ID": "SOLUTION_ID",
          "UUID": "mock-uuid",
          "VERSION": "test-version",
          "SEND_METRICS": "true"
        }
      };

      // Mock axios
      axiosMock.onPost('https://metrics.awssolutionsbuilder.com/generic').reply(200);

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Anonymous data was sent successfully.' }
      });
    });
    it('should return success when sending anonymous usage fails', async function() {
      // Mock event data
      const event = {
        "RequestType": "Update",
        "ServiceToken": "LAMBDA_ARN",
        "ResponseURL": "/cfn-response",
        "StackId": "CFN_STACK_ID",
        "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
        "LogicalResourceId": "SendAnonymousUsage",
        "ResourceType": "Custom::SendAnonymousUsage",
        "ResourceProperties": {
          "ServiceToken": "LAMBDA_ARN",
          "SOLUTION_ID": "SOLUTION_ID",
          "UUID": "mock-uuid",
          "VERSION": "test-version",
          "SEND_METRICS": "true"
        }
      };

      // Mock axios
      axiosMock.onPost('https://metrics.awssolutionsbuilder.com/generic').reply(500);

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Anonymous data was sent failed.' }
      });
    });
    it('should return success when not sending anonymous usage', async function() {
      // Mock event data
      const event = {
        "RequestType": "Delete",
        "ServiceToken": "LAMBDA_ARN",
        "ResponseURL": "/cfn-response",
        "StackId": "CFN_STACK_ID",
        "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
        "LogicalResourceId": "SendAnonymousUsage",
        "ResourceType": "Custom::SendAnonymousUsage",
        "ResourceProperties": {
          "ServiceToken": "LAMBDA_ARN",
          "SOLUTION_ID": "SOLUTION_ID",
          "UUID": "mock-uuid",
          "VERSION": "test-version",
          "SEND_METRICS": "false"
        }
      };

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Anonymous data was not sent.' }
      });
    });
  });
});
