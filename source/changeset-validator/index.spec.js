// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk-mock')
const expect = require('chai').expect
const lambda = require('./index')

let event = {
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
}

let context = {
    invokeid: "lkajsdflkjas9d87fy792kjeh",
    success: function(message) {},
    fail: function(message) {}
}

describe('changeset-validator-lambda',() => {

    afterEach(() => {
        AWS.restore()
    })

    it('stops pipeline when there are no changes', async () => {
        process.env.STACK_NAME = 'test-stack'
        process.env.REGION = 'us-east-1'

        AWS.mock("CloudFormation", "describeChangeSet", Promise.resolve({  
            Status: "FAILED",
            StatusReason: "No changes in ChangeSet"
        }))

        AWS.mock("CodePipeline", "putJobFailureResult", Promise.resolve())

        let result = await lambda.handler(event, context)
        expect(result.status).to.equal("SUCCESS")
        expect(result.pipelineState).to.equal("STOPPED")
    })

    it('does not stop pipeline when there are changes', async () => {
        process.env.STACK_NAME = 'test-stack'
        process.env.REGION = 'us-east-1'

        AWS.mock("CloudFormation", "describeChangeSet", Promise.resolve({  
            Status: "CREATE_PENDING",
        }))

        AWS.mock("CodePipeline", "putJobSuccessResult", Promise.resolve())

        let result = await lambda.handler(event, context)
        expect(result.status).to.equal("SUCCESS")
        expect(result.pipelineState).to.equal("RUNNING")
    })

    it('stops pipeline when exception occurs', async () => {
        process.env.STACK_NAME = 'test-stack'
        process.env.REGION = 'us-east-1'

        AWS.mock("CloudFormation", "describeChangeSet", Promise.reject("ERROR"))
        AWS.mock("CodePipeline", "putJobFailureResult", Promise.resolve())

        await lambda.handler(event, context).catch(err => {
            expect(err).to.equal("ERROR")
        })
    })
})


