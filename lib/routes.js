'use strict';

var api = require('./controllers/api'),
    middleware = require('./middleware'),
    auth = require('./controllers/auth'),
    index = require('./controllers');

/**
 * Application routes
 */
module.exports = function(app, io) {

// Server API Routes
  api(app);

  app.post('/signin', auth.signin);
  app.post('/signin/satellite', auth.signinSatellite);

  // All other routes to use Angular routing in app/scripts/app.js
  app.route('/partials/*')
    .get(index.partials);
  app.route('/*')
    .get( index.index);
};