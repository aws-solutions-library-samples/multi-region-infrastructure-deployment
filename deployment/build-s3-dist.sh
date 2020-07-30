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

SUB1="s/CODE_BUCKET/$1/g"
SUB2="s/SOLUTION_NAME/$2/g"
SUB3="s/SOLUTION_VERSION/$3/g"

for FULLNAME in ./*.yaml
do
  TEMPLATE=`basename $FULLNAME .yaml`
  echo "Preparing $TEMPLATE"
  sed -e $SUB1 -e $SUB2 -e $SUB3 $template_dir/$TEMPLATE.yaml > $template_dist_dir/$TEMPLATE.template
done

cd $source_dir/secondary-bucket-creator
npm run clean
npm ci
mkdir package
rsync -r --exclude=*.spec.ts source/ ./package/ && cp package.json package-lock.json tsconfig.json ./package
cd package && npm ci --production && tsc --project tsconfig.json --outDir .
zip -q -r9 $build_dist_dir/secondary-bucket-creator *

cd $source_dir/uuid-generator
npm run clean
npm ci
mkdir package
rsync -r --exclude=*.spec.ts source/ ./package/ && cp package.json package-lock.json tsconfig.json ./package
cd package && npm ci --production && tsc --project tsconfig.json --outDir .
zip -q -r9 $build_dist_dir/uuid-generator *

cd $source_dir/changeset-validator
npm run clean
npm ci --production
zip -q -r9 $build_dist_dir/changeset-validator.zip *

cd $source_dir/stage-artifact-creator
npm run clean
npm ci --production
zip -q -r9 $build_dist_dir/stage-artifact-creator *

cd $source_dir/stage-artifact-putter
npm run clean
npm ci --production
zip -q -r9 $build_dist_dir/stage-artifact-putter *

cd $source_dir/drift-detection
npm run clean
npm ci --production
zip -q -r9 $build_dist_dir/drift-detection *

cd $source_dir/rollback-change
npm run clean
npm ci --production
zip -q -r9 $build_dist_dir/rollback-change *

cd $source_dir/custom-resource
npm run clean
npm ci --production
zip -q -r9 $build_dist_dir/custom-resource *