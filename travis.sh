#!/bin/bash
set -e

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

npm run lint || error_exit "Error running lint"
npm test || error_exit "Error running tests"
npm run build:prod || error_exit "Error building"

# Rename index to 200.html so it is called for all not found URLs
mv public/index.html public/200.html
