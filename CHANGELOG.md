# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2020-07-30
### Added
- multi-region-infrastructure-deployment.yaml is the main CloudFormation template; multi-region-infrastructure-deployment.template would be removed in the next update.
- SNS notification on manual change approval step
- Automated stage environment rollback when the change approval is rejected
- Drift detection notification for the primary and the secondary stacks
- AWS CloudFormation parameter to terminate the stage stack after the change approval
- Provides enviroment variables to make cfn_nag and cfn-lint optional

### Changed
- Renames ```Pre-Prod``` to ```Stage```
- Fixes cfn_nag and cfn-lint script

## [1.0.0] - 2020-04-16
### Added
- Multi Region Infrastructure Deployment release
