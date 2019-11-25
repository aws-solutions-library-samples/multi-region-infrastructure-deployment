#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name solution-name version-code
#
# Parameters:
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions my-solution v1.0.0
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#
#  - solution-name: name of the solution for consistency
#
#  - version-code: version of the package

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name, trademark approved solution name and version where the lambda code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

# define main directories
template_dir="$PWD"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"

# clean up old build files
rm -rf $template_dist_dir
mkdir -p $template_dist_dir
rm -rf $build_dist_dir
mkdir -p $build_dist_dir

# move the CFN template to the global dist dir
cp $template_dir/multi-region-infrastructure-pipeline.template $template_dist_dir/

# replace placeholder values in the CFN template
cd ..
replace="s/CODE_BUCKET/$1/g"
sed -i '' -e $replace $template_dist_dir/multi-region-infrastructure-pipeline.template
replace="s/SOLUTION_NAME/$2/g"
sed -i '' -e $replace $template_dist_dir/multi-region-infrastructure-pipeline.template
replace="s/SOLUTION_VERSION/$3/g"
sed -i '' -e $replace $template_dist_dir/multi-region-infrastructure-pipeline.template

# build the custom-resource Lambda package and move it to the regional dist dir
cd $source_dir/custom-resource
rm -rf node_modules/
npm install --production
rm package-lock.json
zip -q -r9 $build_dist_dir/custom-resource.zip *

# build the changeset-validator Lambda package and move it to the regional dist dir
cd $source_dir/changeset-validator
rm -rf node_modules/
npm install --production
rm package-lock.json
zip -q -r9 $build_dist_dir/changeset-validator.zip *
