10sai
=====

[![CircleCI](https://circleci.com/gh/birchill/10sai.svg?style=svg)](https://circleci.com/gh/birtles/10sai)
![](https://api.dependabot.com/badges/status?host=github&repo=birchill/10sai)

Setup
-----

1. `yarn install`
1. If you want to test with a local server, you probably want to install
   CouchDB: [Setup guide](https://pouchdb.com/guides/setup-couchdb.html).
1. `yarn start` should start a server running on `http://localhost:8080`.
   If you just want to build the project, try `npm run build`.
   * If you're trying to connect by IP (e.g. to test on your phone) you might
     need to use `yarn start --host 0.0.0.0`. Nobody really knows why.

Other targets:

* `yarn test` — Run automated tests
* `yarn start:prod` — Test the production version
* `yarn build:prod` — Just build the production version. For example, to get package size information run: `yarn build:prod --profile --json stats.json`.
* `yarn storybook` — Play with components
* `yarn build:storybook` — Check that storybook still builds
