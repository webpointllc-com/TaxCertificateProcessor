'use strict';

require('dotenv').config();
const store = require('../src/db/store');

store
  .init()
  .then((info) => {
    console.log(`migrate ok (${info.mode})`);
    return store.close();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
