'use strict';

var express = require('express'),
    favicon = require('static-favicon'),
    morgan = require('morgan'),
    compression = require('compression'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    cookieParser = require('cookie-parser'),
    redis = require('redis'),
    passport = require('passport'),
    session = require('express-session'),
    MemoryStore = require('express-session/session/memory'),
    RedisStore = require('connect-redis')(session),
    errorHandler = require('errorhandler'),
    path = require('path'),
    config = require('./config');

/**
 * Express configuration
 */
module.exports = function(app) {
  var env = app.get('env');

  var redisClient;

  if(config.redis) {
    redisClient = redis.createClient(config.redis.port, config.redis.host);
    redisClient.auth(config.redis.password);

    redisClient.on('ready', function() {
      console.log("Redis is ready.");
    });
  }

  if ('development' === env) {
    app.use(require('connect-livereload')());

    // Disable caching of scripts for easier testing
    app.use(function noCache(req, res, next) {
      if (req.url.indexOf('/scripts/') === 0) {
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.header('Pragma', 'no-cache');
        res.header('Expires', 0);
      }
      next();
    });

    app.use(express.static(path.join(config.root, '.tmp')));
    app.use(express.static(path.join(config.root, 'app')));
    app.set('views', config.root + '/app/views');
  }

  if ('production' === env) {
    app.use(function(req, res, next) {
      if(Object.keys(req.headers).length === 0)
        return res.send("200", "42");
      else
        next();
    });
    app.use(compression());
    app.use(favicon(path.join(config.root, 'public', 'favicon.ico')));
    app.use(express.static(path.join(config.root, 'public')));
    app.set('views', config.root + '/views');
  }


  app.engine('html', require('ejs').renderFile);
  app.set('view engine', 'html');
  app.use(morgan('dev'));
  app.use(bodyParser());
  app.use(methodOverride());
  app.use(cookieParser());

  var store;
  if(config.redis) {
    store = new RedisStore({
        client: redisClient
    });
  } else {
    store = new MemoryStore();
  }
  app.use(session({
    store: store,
    secret: config.sessionSecret
  }));
  config.sessionStore = store;

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Error handler - has to be last
  if ('development' === app.get('env')) {
    app.use(errorHandler());
  }
};