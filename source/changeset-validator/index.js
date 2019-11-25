// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const metrics = require('./metrics')

exports.handler = async (event, context) => {

    let codePipelineJob = event["CodePipeline.job"]

    let cfn = new AWS.CloudFormation({region: process.env.REGION})
    let codePipeline = new AWS.CodePipeline({region: process.env.REGION})

    try {
        let changeSetName = codePipelineJob.data.inputArtifacts[0].name
        let stackName = process.env.STACK_NAME
    
        let changeSet = await cfn.describeChangeSet({
            ChangeSetName: changeSetName,
            StackName: stackName
        }).promise()

        await metrics.send({
            changeSetHasChanges: changeSet.Status !== 'FAILED'
        })

        if (changeSet.Status === 'FAILED') {
            await codePipeline.putJobFailureResult({
                jobId: codePipelineJob.id,
                failureDetails: {
                    message: changeSet.StatusReason,
                    type: 'JobFailed',
                    externalExecutionId: context.invokeid
                }
            }).promise()
            return {
                status: "SUCCESS",
                pipelineState: "STOPPED"
            }
        } else {
            await codePipeline.putJobSuccessResult({
                jobId: codePipelineJob.id
            }).promise()
            return {
                status: "SUCCESS",
                pipelineState: "RUNNING"
            }
        }

   
    } catch (err) {
        await metrics.send({
            changeSetValidationFailed: 'JobFailed'
        })
        await codePipeline.putJobFailureResult({
            jobId: codePipelineJob.id,
            failureDetails: {
                message: err,
                type: 'JobFailed',
                externalExecutionId: context.invokeid
            }
        }).promise()
        throw err
    }
}