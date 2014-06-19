'use strict';
var googleapis = require('googleapis'),
	utils = require('../utils'),
	mongoose = require('mongoose'),
	request = require('superagent'),
	Campaign = mongoose.model('Campaign'),
	User = mongoose.model('User'),
	uuid = require('node-uuid'),
	config = require('../config/config');

var oauth2Client = new googleapis.OAuth2Client(config.keys.google.oauthClientId, config.keys.google.oauthClientSecret, "postmessage");

module.exports = {
	signinSatellite: function(req, res) {
		Campaign.findOne({ _id: req.body.campaign_id, is_public: true }, function(err, campaign) {

			if(err || !campaign)
				return res.send(500, "Internal Server Errror");

			request.get('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token='+req.body.token, function(tdata) {
				if(tdata.body.audience == "487571729383-4lm2hakb65g76qrb0oc17s9t6d91nl7v.apps.googleusercontent.com" && tdata.body.user_id) {
					User.findOne({ _id: tdata.body.user_id }, function(err, user) {
						if(!user) {
							user = new User();
							user._id = tdata.body.user_id;
							user.save();
						}

						req.login(user, function(err) {
							if (err) { console.log(err);  return next(err); }
							req.session.screen = true;
							req.session.groupCode = req.body.group_code;
							req.session.friendlyName = req.body.friendly_name;
							req.session.handleInterrupts = req.body.handle_interrupts;
							req.session.campaignId = req.body.campaign_id;
							req.session.sendUpstreamEvents = req.body.send_upstream_events;
							req.session.userId = tdata.body.user_id;
							req.session.screenId = uuid.v4();
							
							var response = {
								msg: "ok",
								user: user._id,
								screen_id: req.session.screenId,
								roles: user.roles
							};
							
							return res.send(200, response);
						})
					});
				} else {
					req.logout();
					res.send(403,"Unauthorized");
				}
			});
		});
	},
	signin: function(req, res) {		
		process.nextTick(function () {
			oauth2Client.getToken(req.body.code, function(err, tokens) {
				if(err) {
					console.error(err);
					return;
				}
				// contains an access_token and optionally a refresh_token.
				// save them permanently.
				oauth2Client.credentials = {
					access_token: tokens['access_token']
				};

				utils.getGoogleCert(function(certs) {
					utils.decodeAndVerifyJwt(tokens['id_token'], certs, function(err, claims) {

						if(claims["aud"] == oauth2Client.clientId_) {
							User.findOne({ _id: claims['sub'] }, function(err, user) {
								if(!user) {
									user = new User();
									user._id = claims['sub'];
									user.email = claims['email'];
									user.save();
								}

								req.login(user, function(err) {
									if (err) { console.log(err); return next(err); }

									var response = {
										msg: "ok",
										user: user._id,
										roles: user.roles
									};
									
									res.send(200, response);
								})
							});
						} else {
							req.logout();
							res.send(403,"Unauthorized");
						}
					});
				});

			});
		});
	}
}