var RedisStore = require('socket.io/lib/stores/redis'),
	redis  = require('socket.io/node_modules/redis'),
	MemoryStore  = require('socket.io/lib/stores/memory'),
	config = require('../config/config'),
	request = require('superagent'),
	passport = require('passport'),
	utils = require('../utils'),
	mongoose = require('mongoose'),
	cookie = require('express/node_modules/cookie'),
	cookieParser = require('cookie-parser/lib/parse'),
	User = mongoose.model('User'),
	crypto = require('crypto');
	uuid = require('node-uuid'),
	geocoder = require('node-geocoder').getGeocoder('openstreetmap', 'http', {});
	googleapis = require('googleapis'),
	PersistentStore = mongoose.model('PersistentStore'),
	Campaign = mongoose.model('Campaign'),
	socketio = require('socket.io');

var screens = {};
var admins = {};
var driveClient;
var jwt;

module.exports = function(io, app) {

	jwt = new googleapis.auth.JWT( config.keys.google.serviceAccountMail, config.keys.google.serviceAccountKeyFile, null, ['https://www.googleapis.com/auth/drive']);

    var getOrCreateFolder = function(jwt, parent, folderName, cb) {
		driveClient.drive.files.list({
				q: "mimeType = 'application/vnd.google-apps.folder' and '"+ parent +"' in parents and title = '"+ folderName +"'",
				fields: "items(id,title)"
			}) 
	          .withAuthClient(jwt)
	          .execute(function(err, result) {
	            if(err) {
	            	cb(err, null);
	            } else {
	            	if(result.items.length > 0) {
	            		cb(null, result.items[0]);
	            	} else {
	            		driveClient.drive.files.insert({
						  "title": folderName,
						  "parents": [{ id: parent }],
						  "mimeType": "application/vnd.google-apps.folder"
						})
						.withAuthClient(jwt)
	          			.execute(function(err, result) {
	          				if(err) {
	          					cb(err, null);
	          				} else {
	            				cb(null, { id: result.id, title: result.title });
	            			}
	          			});
	            	}
	            } 
	    });
    }

    var listFilesInFolder = function(jwt, folderId, cb) {
    	driveClient.drive.files.list({
				q: "mimeType != 'application/vnd.google-apps.folder' and '"+ folderId +"' in parents",
				fields: "items(id,title,mimeType,webContentLink,createdDate)"
			}) 
	          .withAuthClient(jwt)
	          .execute(function(err, result) {
	          	cb(err, result.items);
	          });
    }

    var uploadFileToFolder = function(jwt, mgr, fileName, mime, fileData, folderId, cb) {
    	driveClient.drive.files.insert({ title: fileName, description: "Taken by " 
    		+ mgr.screen.friendlyName 
    		+ ", Group: "
    		+ mgr.screen.groupCode
    		+ ", Campaign: "
    		+ mgr.screen.campaign.name
    		+ ", CID: "
    		+ mgr.screen.campaignId
    		+ ", Auth User: "
    		+ mgr.screen.userId,
    		properties: 
    		[ { key: "screen_name", visibility: "PUBLIC",  value: mgr.screen.friendlyName },
    		 { key: "user_id", visibility: "PUBLIC",  value: mgr.screen.userId },
    		 { key: "group_code", visibility: "PUBLIC", value: mgr.screen.groupCode },
    		 { key: "campaign_name", visibility: "PUBLIC", value: mgr.screen.campaign.name },
    		 { key: "campaign_id", visibility: "PUBLIC", value: mgr.screen.campaignId } ], mimeType: mime, parents: [{ id: folderId }] })
		      .withMedia(mime, fileData)
	          .withAuthClient(jwt)
	          .execute(function(err, result) {
	          	cb(err, result);
	          });
    }

    var makeFilePublic = function(jwt, fileId, cb) {
    	driveClient.drive.permissions.insert({ fileId: fileId }, { role: "reader", type: "anyone"})
	          .withAuthClient(jwt)
	          .execute(function(err, result) {
	          	cb(err, result);
	          });
    }

    googleapis.discover('drive', 'v2')
    .execute(function(err, client) {
     	driveClient = client;
     	console.log("Google Drive API loaded.");
  	});

	var pushToAdmin = function(type, msg) {
		for(var key in admins) {
			admins[key].emit(type, msg);
		}
	};

	var queuePlayItem = function(socket, mgr) {

		if(mgr.screen.lastViz) {
			socket.emit('blackout', {});
		}

		Campaign.findOne({ _id: mgr.screen.campaignId })
			.populate({ path: 'visualizations.visualization' })
  			.exec(function(err, campaign) {
				var viz;

				if(!campaign || campaign.visualizations.length == 0) {
					return pushToAdmin('screen',{ msg: "Screen (Group Code: %s, Id: %s) has nothing to play", params: [ mgr.screen.groupCode, mgr.screen.screenId ] });
				} else if(campaign.visualizations.length > 1) {
					var idx = 0;
					do {
						idx = Math.floor(Math.random() * campaign.visualizations.length);
					} while(campaign.visualizations[idx].visualization._id+"-"+campaign.visualizations[idx].params == mgr.screen.lastViz || campaign.visualizations[idx].active != true || campaign.visualizations[idx].handles_interrupts.length > 0 ||
						(campaign.visualizations[idx].scope != "campaign" && campaign.visualizations[idx].scope != mgr.screen.groupCode))

					viz = campaign.visualizations[idx];
				} else {
					console.log("got only one viz, take it...");
					viz = campaign.visualizations[0];
				}

				mgr.screen.lastViz = viz.visualization._id+"-"+viz.params;
				socket.emit('play', viz);

				if(viz.duration != -1) {
					mgr.screen.timeout = setTimeout(function() {
						mgr.screen.timeout = undefined;
						queuePlayItem(socket, mgr)
					}, viz.duration);
				}

				pushToAdmin('screen',{ msg: "Screen (Group Code: %s, Id: %s) plays %s from %s", params: [ mgr.screen.groupCode, mgr.screen.screenId, viz.visualization.name, viz.name ]});
  			});
	};

	var handleBlobstore = function(socket, mgr, scope, data, fn) {

		if(mgr.screen["campaign"].drive_blobstore && driveClient) {
			jwt.authorize(function(err, result) {
				if(data.cmd == "put_blob_collection") {
					getOrCreateFolder(jwt, mgr.screen["campaign"].drive_blobstore, scope+"_"+data.key, function(err, folder) {

						if(err) {
							return fn({code: 500, msg: "err", err: err });
						}

						var regex = /^data:(.+);base64,(.*)$/;
						var matches = data.value.match(regex);

						var imgData = new Buffer(matches[2], 'base64');
						var filename = uuid.v4();

						uploadFileToFolder(jwt, mgr, filename, matches[1], imgData, folder.id, function(err, item) {
							if(err) {
								return fn({code: 500, msg: "err", err: err });
							}

							var shareUrl = item.webContentLink;
							var id = item.id;

							console.log("Uploaded file to Drive: %s, URL: %s"+ id, shareUrl);

							makeFilePublic(jwt, id, function(err, res) {
								if(err) {
									return fn({code: 500, msg: "err", err: err });
								}
								return fn({code: 200, msg: "ok",  url: shareUrl});
							})
						});
					});
					
				} else if(data.cmd == "get_blob_collection") { 
					getOrCreateFolder(jwt, mgr.screen["campaign"].drive_blobstore, scope+"_"+data.key, function(err, folder) {
						listFilesInFolder(jwt, folder.id, function(err, files) {
							if(err) {
								return fn({code: 500, msg: "err", err: err });
							}
							var rfiles = [];
							for(var i = 0; i < files.length; i++) {
								rfiles.push({
									url: files[i].webContentLink,
									mimeType: files[i].mimeType,
									createdAt: files[i].createdDate
								});
							}
							console.log("pushed "+ rfiles.length+ " blob urls");
							var srfiles = rfiles.sort(function(a,b){
							  // Turn your strings into dates, and then subtract them
							  // to get a value that is either negative, positive, or zero.
							  return (new Date(b.createdAt) - new Date(a.createdAt))*-1;
							});
							return fn({code: 200, msg: "ok", items: srfiles});
						})
					});
				}
			});
		} else {
			if(data.cmd == "put_blob_collection") {
	    		PersistentStore.findOne({
	    			scope: scope,
	    			key: data.key
	    		}, function(err, ps) {
	    			if(err) {
	    				return fn({code: 500, msg: "err"});
	    			} else {

	    				if(!ps) {
	    					ps = new PersistentStore();
	    					ps.scope = scope;
	    					ps.key = data.key;
	    					ps.value = [];
	    				}

	    				var base64Data = data.value.replace(/^data:image\/webp;base64,/, "");
	    				var path = __dirname + "/../../public/blobstore/";
	    				var filename = uuid.v4()+".webp";

						require("fs").writeFile(path+filename, base64Data, 'base64', function(err) {
						  	if(err)
						  		return fn({code: 500, msg: "save_failed", err: err}); 

						  	var publicUrl = "http://groundcontrol.gdgx.io/blobstore/"+filename;

						  	ps.value.push(publicUrl);
						  	ps.markModified('value');

							ps.save(function(err) {
			    				if(!err) {
			    					return fn({code: 200, msg: publicUrl});
			    				} else {
			    					return fn({code: 500, msg: "failed"});
			    				}
	    					});
						});
	    			}
	    		});
	    	} else if(data.cmd == "get_blob_collection") { 
	    		PersistentStore.findOne({
	    			scope: scope,
	    			key: data.key
	    		}, function(err, ps) {
	    			if(err || !ps) {
	    				return fn({code: 404, msg: "not found"});
	    			} else {
	    				return fn({code: 200, msg: "ok", items: ps.value});
	    			}
	    		});
	    	}
    	}
	}

	var handleScreen = function(socket, mgr) {
		console.log("A Screen connected...");

		Campaign.findOne({ _id: mgr.screen.campaignId }, function(err, campaign) {

			if(err || !campaign)
				return socket.disconnect('invalid campaign');

			mgr.screen["campaign"] = campaign;

		  	if(!screens[mgr.screen.groupCode]) {
		  		screens[mgr.screen.groupCode] = {};
		  	}

		  	screens[mgr.screen.groupCode][socket.id] = socket;

		  	queuePlayItem(socket, mgr);
		  	
		  	socket.on('interrupt_event', function(data, fn) {
		  		var unique;
				var scope = "";

	    		var sendOutInterrupt = function(resolvedEventType, data) {

	    			var tscreens = [];

	    			if(data.scope == "group" && screens[mgr.screen.groupCode]) {
	    				for(var screenId in screens[mgr.screen.groupCode]) {
	    					var screen = screens[mgr.screen.groupCode][screenId];

	    					if(socket.manager.handshaken[screenId].screen.groupCode == mgr.screen.groupCode
	    						&& socket.manager.handshaken[screenId].screen.campaignId == mgr.screen.campaignId) {
	    						console.log("Added a group screen to interrupt target");
	    						tscreens.push(screen);
	    					}
	    				}
	    			} else {
	    				for(var groupCode in screens) {

							for(var screenId in screens[groupCode]) {
	    						var screen = screens[mgr.screen.groupCode][screenId];

		    					if(socket.manager.handshaken[screenId].screen.campaignId == mgr.screen.campaignId) {
		    						console.log("Added a campaign screen to interrupt target");
		    						tscreens.push(screen);
		    					}
	    					}
	    				}
	    			}

	    			// Find suitable handler
	    			Campaign.findOne({ _id: mgr.screen.campaignId })
						.populate({ path: 'visualizations.visualization' })
  						.exec(function(err, campaign) {

  							var interruptViz;

  							for(var f = 0; f < campaign.visualizations.length; f++) {
  								var viz = campaign.visualizations[f];

  								if(viz.active == true && viz.handles_interrupts.indexOf(resolvedEventType) != -1
  									&& (viz.scope == "campaign" || viz.scope == mgr.screen.groupCode)) {
  									interruptViz = viz;
  								}
  							}

  							if(!interruptViz) {
  								console.log("failed. have no viz handling "+ resolvedEventType);
  							} else {
				    			console.log(tscreens.length +" screens will receive the interrupt of type "+ resolvedEventType + " with viz "+ interruptViz.visualization.name);
				    			for(var i = 0; i < tscreens.length; i++) {

				    				var scr = tscreens[i];

				    				if(socket.manager.handshaken[scr.id].screen.timeout) {
				    					clearTimeout(socket.manager.handshaken[scr.id].screen.timeout);
				    					socket.manager.handshaken[scr.id].screen.timeout = undefined;
				    				}

				    				tscreens[i].emit('interrupt', { visualization: interruptViz, interrupt: { type: resolvedEventType, payload: data.payload }});

									if(viz.duration != -1) {
										socket.manager.handshaken[scr.id].screen.timeout = setTimeout(function() {
											socket.manager.handshaken[scr.id].timeout = undefined;
											queuePlayItem(scr, socket.manager.handshaken[scr.id]);
										}, viz.duration);
									}
				    			}
  							}

		  				});

	    		};

		  		if(data.type == "nfc") {

		  			var handleNfc = function(tagId, tagSave, fn) {
						PersistentStore.findOne({
							scope: data.scope,
							key: "nfc_checkins"
						}, function(err, ps) {
							if(!ps) {
								ps = new PersistentStore();
								ps.scope = data.scope;
								ps.key = "nfc_checkins";
								ps.value = {};
							}

							if(ps.value[tagId]) {
								// Not unique
								sendOutInterrupt("nfc", data);
							} else {
								ps.value[tagId] = tagSave;
								ps.markModified('value');
		    			
				    			ps.save(function(err) {
				    				if(!err) {
				    					return fn({code: 200, msg: "ok"});
				    				} else {
				    					return fn({code: 500, msg: "failed", err: err});
				    				}
				    			});
				    			sendOutInterrupt("nfc_unique", data);
							}
							
						});
		  			}

		  			// G+ Tag Special Case
		  			if(data.payload.type == "URI" && data.payload.uri.indexOf("plus.google.com") != -1) {
		  				var splitUrl = data.payload.uri.split("/");
		  				var googleId = splitUrl[splitUrl.length-1];

		  				request.get("https://www.googleapis.com/plus/v1/people/"+ googleId +"?fields=placesLived&key="+config.keys.google.simpleApiKey, function(res) {
		  					
		  					var place;
		  					for(var i = 0; i < res.body.placesLived.length; i++) {
		  						if(res.body.placesLived[i].primary) {
		  							place = res.body.placesLived[i].value;
		  						}
		  					}

		  					if(place) {
			  					geocoder.geocode(place, function(err, res) {		
	    							if(!err && res.length > 0) {
	    								handleNfc(googleId, { latitude: res[0].latitude, longitude: res[0].longitude }, fn);
	    							} else {
	    								handleNfc(googleId, {}, fn);
	    							}
								});
    						} else {
    							handleNfc(googleId, {}, fn);
    						}
		  				});
		  			} else {
		  				var mId = crypto.createHash('md5').update(JSON.stringify(data.payload)).digest('hex');
		  				handleNfc(mId, {}, fn);
		  			}
		  		} else {
		  			return fn({code: 500, msg: "unknown interrupt event"});
		  		}

		  	});

		  	socket.on('finished_viz', function(data) {
		  		// Viz finished, send the next one
		  		queuePlayItem(socket, mgr);
		  	});

		  	socket.on('persistent', function (data, fn) {
		  		var scope = "";

	    		if(data.scope == "group") {
	    			scope = mgr.screen.campaignId+"_"+mgr.screen.groupCode;
	    		} else if(data.scope == "campaign") {
	    			scope = mgr.screen.campaignId;
	    		}

		    	if(data.cmd == "read") {
		    		PersistentStore.findOne({
		    			scope: scope,
		    			key: data.key
		    		}, function(err, ps) {
		    			if(err || !ps) {
		    				return fn({code: 404, msg: "not found"});
		    			} else {
		    				return fn({code: 200, msg: "ok", item: ps.value});
		    			}
		    		});
		    	} else if(data.cmd == "set") {
		    		PersistentStore.findOne({
		    			scope: scope,
		    			key: data.key
		    		}, function(err, ps) {
		    			if(!ps) {
		    				ps = new PersistentStore();
		    				ps.scope = scope;
		    				ps.key = data.key;
		    			}

		    			ps.value = data.value;
		    			ps.markModified('value');
		    			
		    			ps.save(function(err) {
		    				if(!err) {
		    					return fn({code: 200, msg: "ok"});
		    				} else {
		    					return fn({code: 500, msg: "failed"});
		    				}
		    			});
		    		});
		    	} else if(data.cmd == "append") {
		    		PersistentStore.findOne({
		    			scope: scope,
		    			key: data.key
		    		}, function(err, ps) {
		    			if(err || !ps) {
		    				return fn({code: 404, msg: "not found"});
		    			} else {

		    				if(ps.value instanceof Array) {
		    					ps.value.push(data.value);
		    				} else if(ps.value instanceof Object && data.subkey) {
		    					ps.value[data.subkey] = data.value;
		    				} else {
		    					return fn({code: 500, msg: "cant append to this type"});
		    				}
							
							ps.markModified('value');
		    				ps.save(function(err) {
			    				if(!err) {
			    					return fn({code: 200, msg: "ok"});
			    				} else {
			    					return fn({code: 500, msg: "failed"});
			    				}
		    				});
		    			}
		    		});
		    	} else if(data.cmd.indexOf("blob") != -1) {
		    		handleBlobstore(socket, mgr, scope, data, fn);
		    	} else {
		    		console.log("unknown persistent op: "+ data.cmd);
		    		return fn({code: 500, msg: "failed"});
		    	}
		  	});
		});
	}

	io.sockets.on('connection', function (socket) {
	  console.log("ws connection id: "+ socket.id);
	  
	  var mgr = socket.manager.handshaken[socket.id];

	  if(mgr.screen) {
	  	handleScreen(socket, mgr);
	  } else {
	  	console.log("Admin GUI connected...");
	  	admins[socket.id] = socket;
	  }

	  socket.on('disconnect', function() {
		  var mgr = socket.manager.handshaken[socket.id];

	      if(mgr.screen) {
	      	delete screens[mgr.screen.groupCode][socket.id];
	      	console.log("Screen disconnected. Left in group: "+ Object.keys(screens[mgr.screen.groupCode]).length);
	      } else {
	      	delete admins[socket.id];
	        console.log("Admin disconnected. Left in group: "+ Object.keys(admins[socket.id]).length);
	      }
	      
   	  });
	});
};