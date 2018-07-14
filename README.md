10sai
=====

Setup
-----

1. `npm install`
1. You might need to install `webpack-dev-server` globally, `npm install -g
   webpack-dev-server` assuming you plan to use it.
1. If you want to test with a local server, you probably want to install
   CouchDB: [Setup guide](https://pouchdb.com/guides/setup-couchdb.html).
1. `npm start` should start a server running on `http://localhost:8080`.
   If you just want to build the project, try `npm run build`.
   * If you're trying to connect by IP (e.g. to test on your phone) you might
     need to use `npm start -- --host 0.0.0.0`. Nobody really knows why.
