'use strict';

var path = require('path');

var rootPath = path.normalize(__dirname + '/../../..');

module.exports = {
  root: rootPath,
  port: process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000,
  hostname: process.env.OPENSHIFT_NODEJS_IP || "localhost",
  mongo: {
    options: {
      db: {
        safe: true
      }
    }
  },
  sessionSecret: "e45h6e46456&$34dww3g5I/(&FGh657bijkbgu"
};