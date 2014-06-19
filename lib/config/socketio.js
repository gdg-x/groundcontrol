var RedisStore = require('socket.io/lib/stores/redis'),
	redis  = require('socket.io/node_modules/redis'),
	MemoryStore  = require('socket.io/lib/stores/memory'),
	config = require('./config'),
	request = require('superagent'),
	passport = require('passport'),
	utils = require('../utils'),
	mongoose = require('mongoose'),
	cookie = require('express/node_modules/cookie'),
	cookieParser = require('cookie-parser/lib/parse'),
	User = mongoose.model('User'),
	socketio = require('socket.io');

module.exports = function(server) {

	var io = socketio.listen(server); 
	io.set('log level', 1); 

	if(config.redis) {
		console.log("Connecting to Redis");

		var pub    = redis.createClient(config.redis.port, config.redis.host);
		var sub    = redis.createClient(config.redis.port, config.redis.host);
		var client = redis.createClient(config.redis.port, config.redis.host);

		pub.auth(config.redis.password, function (err) { if (err) throw err; });
		sub.auth(config.redis.password, function (err) { if (err) throw err; });
		client.auth(config.redis.password, function (err) { if (err) throw err; });

		io.set('store', new RedisStore({
		  redis    : redis
		, redisPub : pub
		, redisSub : sub
		, redisClient : client
		}));
	} else {
		console.log("Not using Redis");
		io.set('store', new MemoryStore());
	}

	io.set('authorization', function (handshakeData, accept) {

	  if(handshakeData.headers["authorization"] && handshakeData.headers["authorization"].indexOf("Bearer") != -1) {
	  	var token = handshakeData.headers["authorization"].replace("Bearer ", "");
	  	utils.getGoogleCert(function(certs) {
	    	utils.decodeAndVerifyJwt(token, certs, function(err, claims) {
				
	    		if(claims["aud"] == "390823780562-v5iou1c3amlb25ilj5483mb6q3s0cvt7.apps.googleusercontent.com") {
		    		request.get('https://www.googleapis.com/plus/v1/people/'+ claims['sub']+"?fields=displayName%2Cid%2Cname(familyName%2CgivenName)&key="+config.keys.google.simpleApiKey, function(gres){
						var guser = gres.body;
			    		User.findOne({_id: claims['sub'] }, function(err, user) {
			    			if (err) { return accept('Cookie is invalid.', false); }
			    			if(!user && claims['hd'] == "bitstars.com") {
								user = new User();
								user._id = claims['sub'];
								user.active = true;
								user.save();
							}

							if(!user) {
								return accept("Unknown user", false);
							}

							user.firstname = guser.name.givenName;
							user.lastname = guser.name.familyName;
							user.email = claims.email;
							user.save();

							if(user.active == true) {
								handshakeData['user'] = user;
								return accept(null, user);
							} else {
								return accept("Deactivated user", false);
							}
			    		});
		    		});
	    		} else {
	    			return accept("Unknown user", false);
	    		}
	    	});
	    });
	  } else if (handshakeData.headers.cookie) {

	    handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
	    var cookies = cookieParser.signedCookies(handshakeData.cookie, config.sessionSecret);

	    if (handshakeData.cookie['connect.sid'] == cookies['connect.sid']) {
	      return accept('Cookie is invalid.', false);
	    }

	    var sessionStore = config.sessionStore;

        sessionStore.get(cookies['connect.sid'], function(err, session) {
            if(!err && session) {
            	console.log2(session);
            	handshakeData['user'] = session.passport.user;
            	handshakeData['sid'] = cookies['connect.sid'];

            	if(session.screen) {
            		console.log("This is a screen.");
	            	handshakeData['screen'] = {
	            		friendlyName: session.friendlyName,
	            		groupCode: session.groupCode,
	            		campaignId: session.campaignId,
	            		screenId: session.screenId,
	            		userId: session.userId,
	            		handleInterrupts: session.handleInterrupts,
	            		
	            	};
            	}

            	console.log("WS connected user: "+ session.passport.user);
            	accept(null, true);
            } else {
				accept('Invalid session.', false);
            }
        });

	  } else {
	    return accept('No cookie transmitted.', false);
	  }

	});

	return io;
};