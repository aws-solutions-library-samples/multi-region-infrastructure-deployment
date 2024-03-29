#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh
#

# Get reference for source directory
source_dir="$PWD/../source"

declare -a lambda_packages=(
    "changeset-validator"
    "custom-resource"
    "drift-detection"
    "rollback-change"
    "secondary-bucket-creator"
    "stage-artifact-creator"
    "stage-artifact-putter"
    "uuid-generator"
)

for lambda_package in "${lambda_packages[@]}"
do
    echo "------------------------------------------------------------------------------"
    echo "Testing $lambda_package"
    echo "------------------------------------------------------------------------------"
    cd $source_dir/$lambda_package
    rm -rf coverage/
    npm run clean
    npm i --slient
    npm test

    # Check the result of the npm test and exit if a failed test is identified
    if [ $? -eq 0 ]
    then
      echo "Tests passed for $lambda_package"
    else
      echo "******************************************************************************"
      echo "Tests FAILED for $lambda_package"
      echo "******************************************************************************"
      exit 1
    fi

    npm run clean
done
