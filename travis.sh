#!/bin/bash
set -e

SOURCE_BRANCH="master"
TARGET_BRANCH="gh-pages"

# The following is based, in part, on:
# https://gist.github.com/domenic/ec8b0fc8ab45f39403dd

function error_exit
{
  echo -e "\e[01;31m$1\e[00m" 1>&2
  exit 1
}

function ok_exit
{
  echo -e "\e[01;32m$1\e[00m" 1>&2
  exit 0
}

function build
{
  npm run build:prod || error_exit "Error building"
}

if [ "$TRAVIS_PULL_REQUEST" != "false" ] || [ "$TRAVIS_BRANCH" != "$SOURCE_BRANCH" ]; then
  build
  ok_exit "Pull request / commit to branch, not committing changes"
fi

# Save useful information
REPO=`git config remote.origin.url`
SSH_REPO=${REPO/https:\/\/github.com\//git@github.com:}
SHA=`git rev-parse --verify HEAD`

# Checkout target branch to 'out'
git clone $REPO out
cd out
git checkout $TARGET_BRANCH || git checkout --orphan $TARGET_BRANCH
cd ..

# Clear target branch output
rm -rf out/** || exit 0

# Run build and copy 'public' to (empty) clone of target branch
build
echo "Copying output to target branch"
cp -r public/** out

# Setup target branch git config
echo "Setting up git config"
cd out
git config user.name "$COMMIT_USER (via Travis)"
git config user.email "$COMMIT_EMAIL"

# Check for no-op change
echo "Checking for changes"
if [ $(git status --porcelain | wc -l) -lt 1 ]; then
  ok_exit "No changes to the output on this push; exiting."
fi

# Commit the changes
echo "Committing changes"
git add --all .
COMMIT_MESSAGE=$(echo -e "Deploy to $TARGET_BRANCH for '$TRAVIS_COMMIT_MSG' [ci skip]\n\nGenerated from:\n";
               git log $TRAVIS_COMMIT_RANGE)
git commit -m "$COMMIT_MESSAGE"

# Get deploy key
echo "Setting up deploy key"
ENCRYPTED_KEY_VAR="encrypted_${ENCRYPTION_LABEL}_key"
ENCRYPTED_IV_VAR="encrypted_${ENCRYPTION_LABEL}_iv"
ENCRYPTED_KEY=${!ENCRYPTED_KEY_VAR}
ENCRYPTED_IV=${!ENCRYPTED_IV_VAR}
openssl aes-256-cbc -K $ENCRYPTED_KEY -iv $ENCRYPTED_IV -in ../deploy_key.enc -out deploy_key -d
chmod 600 deploy_key
eval `ssh-agent -s`
ssh-add deploy_key

# Push changes
echo "Pushing to $SSH_REPO"
git push $SSH_REPO $TARGET_BRANCH
echo "Done"
