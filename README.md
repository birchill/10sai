10sai
=====

[![CircleCI](https://circleci.com/gh/birtles/10sai.svg?style=svg)](https://circleci.com/gh/birtles/10sai)
[![Greenkeeper badge](https://badges.greenkeeper.io/birtles/10sai.svg)](https://greenkeeper.io/)

Setup
-----

1. `npm install`
1. If you want to test with a local server, you probably want to install
   CouchDB: [Setup guide](https://pouchdb.com/guides/setup-couchdb.html).
1. `npm start` should start a server running on `http://localhost:8080`.
   If you just want to build the project, try `npm run build`.
   * If you're trying to connect by IP (e.g. to test on your phone) you might
     need to use `npm start -- --host 0.0.0.0`. Nobody really knows why.

Other targets:

* `npm test` — Run automated tests
* `npm start:prod` — Test the production version
* `npm build:prod` — Just build the production version. For example, to get package size information run: `npm build:prod -- --profile --json stats.json`.
* `npm storybook` — Play with components
* `npm build:storybook` — Check that storybook still builds
