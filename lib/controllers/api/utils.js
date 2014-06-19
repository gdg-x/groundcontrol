'use strict';

var mongoose = require('mongoose'),
	express = require('express'),
	jiff = require('jiff'),
	util = require('util'),
	extend = require('util')._extend;

module.exports = {
	buildQuery: function(query, options) {
		var skip = options.skip;
		var limit = options.limit;
		var sort = options.sort;
		var asc = options.asc || 1;
		var fields = options.fields;

		asc = parseInt(asc);

		if(limit == undefined)
			limit = 30;

		var count = options.count;

		delete options.sort;
		delete options.asc;
		delete options.fields;
		delete options.count;
		delete options.page;
		delete options.perpage;

		/*for(var key in options) {
			query.where(key);

			var value = options[key];
			if('>' == value[0]) {
				if('=' == value[1]) {
					query.gte(value.substr(2));
				} else {
					query.gt(value.substr(1));
				}
			}
			else if('<' == value[0]) {
				if('=' == value[1]) {
					query.lte(value.substr(2));
				} else {
					query.lt(value.substr(1));
				}
			} else {
				query.equals(value);
			}
		}*/

		if(count == undefined) {
			if(sort) {
				var so = {};
				so[sort] = asc;
				query.options["sort"] = so;
			}
			if(fields) {
				query.select(fields.split(/[ ,]+/).join(' '))
			}
		}

		return query;
	},

	paginate: function(q, page, resultsPerPage, callback) {
		callback = callback || function(){};
		page = (!isNaN(page) && page != undefined) ? parseInt(page) : 1;
		resultsPerPage = resultsPerPage || 25;
		var skipFrom = (page * resultsPerPage) - resultsPerPage;

		if(resultsPerPage != -1) {
			q.limit(resultsPerPage);
		} else {
			delete q["options"]["limit"];
		}

		var query = q.skip(skipFrom);

		query.exec(function(error, results) {
		    if (error) {
		      callback(error, null, null, null, null, null);
		    } else {
		      q.model.count(q, function(error, count) {
		        if (error) {
		          callback(error, null, null);
		        } else {
		          var pageCount = Math.ceil(count / resultsPerPage);
		          if (pageCount == 0) {
		            pageCount = 1;
		          };
		          callback(null, count, page, resultsPerPage, pageCount, results);
		        };
		      });
		    };
		});
	},

	parseAndOr: function(query, key, value, it) {

		if(!value || typeof value === 'object')
			return;

		if(value.indexOf(",") != -1) {
			var elements = value.split(',');
			query["$or"] = [];

			delete query[key];

			for(var i = 0; i < elements.length; i++) {
				var o = {}

				query["$or"].push(this.parseAndOr(query, key, elements[i], true));
			}
		} else if(value.indexOf("+") != -1) {
			var elements = value.split('+');

			var target;

			if(it) {
				var o = {}
				o["$and"] = [];
				for(var i = 0; i < elements.length; i++) {
					var or = {};
					or[key] = elements[i];
					o["$and"].push(or);
				}
				return o;
			} else {
				delete query[key];

				query["$and"] = [];
				for(var i = 0; i < elements.length; i++) {
					var o = {}
					o[key] = elements[i];

					query["$and"].push(o);
				}
			}

		} else {

			if(it) {
				var o = {}
				o[key] = value;
				return o;
			} else {
				query[key] = value;
			}
		}
	},

	crudModel: function(model, options, middleware, app) {
		var Model = mongoose.model(model);
		var impl = express();
		var me = this;

		var baseQuery = {};

		if(options.ownerField) {
			baseQuery[options.ownerField] = req.user._id;
		}

		var authMiddleware = function(name) {
			if(options.auth[name]) {
				return middleware.auth(options.auth[name]);
			} else {
				return function(req, res, next) {
					next();
				};
			}
		}

		var index = function(obj,i) {return obj[i]}

		// List
		impl.get('/', authMiddleware("list"), function(req, res) {
	    	me.getModel(model, baseQuery)(req, res);
		});

		// Create
		impl.post('/', authMiddleware("create"), function(req, res) {
			console.log2(req.body);

			if(typeof req.body === 'object' ) {
				console.log("is an object");
			}

	    	var newObject = req.body;

	    	if(newObject["_id"])
	    		delete newObject["_id"];

	    	if(newObject["created_at"])
	    		delete newObject["created_at"];
	    	
	    	if(newObject["updated_at"])
	    		delete newObject["updated_at"];

	    	if(options.ownerField && newObject[options.ownerField]) {
	    		delete newObject[options.ownerField];
	    		newObject[options.ownerField] = req.user._id;
			}

			console.log("save it now");
	    	var m = new Model(newObject);
	    	m.save(function(err, n) {
	    		if(err) {
	    			console.log(err);
	    			return res.send(500, err);
	    		} else {
	    			return res.jsonp(n);
	    		}
	    	});
		});

		// Get One
		impl.get('/:id', authMiddleware("get"), function(req, res) {
			console.log(Model.schema.path(options.idField));
			var query = {};
			query[options.idField] = req.params.id;

			query = extend(query, baseQuery);
	    	me.getModel(model, query, null, true)(req, res);
		});

		// Update
		impl.patch('/:id', authMiddleware("update"), function(req, res) {
	    	var query = {};
			query[options.idField] = mongoose.Types.ObjectId(req.params.id);

			query = extend(query, baseQuery);
	    	Model.findOne(query, function(err, mo) {
	    		if(err) {
	    			return res.send(500, err);
	    		} else {
		    		if(!mo) {
		    			return res.send(404, "Not found");
		    		} else {
		    			
		    			var patches = req.body;
						var patchResult = [];

		    			if(patches instanceof Array) {
		    				for(var i = 0; i < patches.length; i++) {
		    					var patch = patches[i];

		    					//console.log(Model.schema);
		    					if(patch.op == "remove" && Model.schema.pathType(patch.path.substring(1).split('/').join('.')) == "nested") {
		    						if(!mo.get(patch.path.substring(1).split('/').join('.'))) {
		    							return res.send(500, "no!");
		    						} else {
		    							mo.set(patch.path.substring(1).split('/').join('.'), undefined);
		    						}
		    					} else {
		    						mo = jiff.patchInPlace([patch], mo);
								}

		    					patchResult.push("ok");
		    				}

		    				mo.save(function(err, mn) {
		    					if(err) {
		    						res.send(500, err);
		    					} else {
		    						res.jsonp({ results: patchResult, item: mn });
		    					}
		    				})
		    				
		    			} else {
		    				res.send(500, "Invalid PATCH");
		    			}
		    		}
	    		}
	    	});
		});

		// Delete
		impl.delete('/:id', authMiddleware("delete"), function(req, res) {
			var query = {};
			query[options.idField] = mongoose.Types.ObjectId(req.params.id);

			query = extend(query, baseQuery);
	    	Model.findOne(query, function(err, m) {
	    		if(err) {
	    			return res.send(500, err);
	    		} else {
		    		if(!m) {
		    			return res.send(404, "Not found");
		    		} else {
		    			m.remove(function(err) {
		    				if(err) {
		    					return res.send(500, err);
		    				} else {
		    					return res.jsonp(200, { msg: "Deleted.", code: 200 });
		    				}
		    			});
		    		}
	    		}
	    	})
		});

		impl.get('/meta', authMiddleware("meta"), function(req, res) {
			res.jsonp(Model.schema);
		})

		app.use("/"+model.toLowerCase()+"s", impl);

		return impl;
	},

	getModel: function(model, baseQuery, populate, one, options) {
		var me = this;
		one = one != undefined ? one : false;
		populate = populate || [];
		options = options || {};

		return function(req, res) {
			var Model = mongoose.model(model);

			var query = extend({}, baseQuery)

			for(var key in query) {
				me.parseAndOr(query, key, req.params[query[key]]);
			}

			var targetQuery;
			var count = false;

			if(req.query.count != undefined) {
				count = true;
				targetQuery = Model.count(query);
			} else {

				if(one) {
					targetQuery = Model.findOne(query, null, options);
				} else {
					targetQuery = Model.find(query, null, options);
				}

				for(var i = 0; i < populate.length; i++) {
					var item = populate[i];

					if(item instanceof Array) {
						targetQuery = targetQuery.populate(item[0], item[1]);
					} else {
						targetQuery = targetQuery.populate(item);
					}
				}
			}

			if(count) {
				me.buildQuery(targetQuery, req.query).exec(function(err, count) {
					if(err) {
						console.log(err);
						res.send(400, 'Bad request');
					} else {
						res.jsonp({ count: count });
					}
				});
			} else if(one) {
				me.buildQuery(targetQuery, req.query).exec(function(err, item) {
					if(err) {
						console.log(err);
						res.send(400, 'Bad request');
					} else {
						if(!item)
							res.send(404, "Not found");
						else
							res.jsonp(item);
					}
				});
			} else {
				var page = parseInt(req.query.page);
				var perpage = req.query.perpage ? parseInt(req.query.perpage) : undefined;

				if(perpage && perpage < -1) {
					res.send(400, 'Bad request');
				}

				me.paginate(me.buildQuery(targetQuery, req.query), page, perpage, function(err, count, page, resultsPerPage, pageCount, results) {
					if(err) {
						console.log(err);
						res.send(400, 'Bad request');
					} else {
						var response = {
							"count": count
						};

						console.log("resultsPerPage :" + resultsPerPage);
						if(resultsPerPage != -1) {
							response["pages"] = pageCount;
							response["page"] = page;
							response["perPage"] = resultsPerPage;
						}

						response["items"] = results;

						res.jsonp(response);
					}
				});
			}
		};
	},
	fixCacher: function(Cacher) {
		Cacher.prototype.buildEnd = function(res, key, staleKey, realTtl, ttl) {
			var STALE_CREATED = 1
			var origEnd = res.end
			var self = this

			res.end = function (data) {
				res._responseBody += data

				var cachedHeaders = {};
				for (var header in res._headers) {
					if(!header.substring(0,2) == "X-" && header != "Set-Cookie")
	    				cachedHeaders[header] = res._headers[header];
	  			}

	  			if(res.statusCode == 200) {
					var cacheObject = {statusCode: res.statusCode, content: res._responseBody, headers: cachedHeaders}

					self.client.set(key, cacheObject, realTtl, function(err) {
						if (err) {
							self.emit("error", err)
						}
						self.client.set(staleKey, STALE_CREATED, ttl, function(err) {
							if (err) {
								self.emit("error", err)
							}
							self.emit("cache", cacheObject)
						})
					})
				}
				return origEnd.apply(res, arguments)
			}
		};

		Cacher.prototype.cache = function(unit, value) {
			var self = this;
			var STALE_REFRESH = 2
			var GEN_TIME = 30

			var HEADER_KEY = 'Cache-Control'
			var NO_CACHE_KEY = 'no-cache'
			var MAX_AGE_KEY = 'max-age'
			var MUST_REVALIDATE_KEY = 'must-revalidate'
			// set noCaching to true in dev mode to get around stale data when you don't want it
			var ttl = self.calcTtl(unit, value)
			if (ttl === 0 || this.noCaching) {
				return function(req, res, next) {
					res.header(HEADER_KEY, NO_CACHE_KEY)
					next()
				}
			}


			return function(req, res, next) {
				// only cache on get and head
				if (req.method !== 'GET' && req.method !== 'HEAD') {
					return next()
				}

				var key = self.genCacheKey(req)
				var staleKey = key + ".stale"
				var realTtl = ttl + GEN_TIME * 2

				self.client.get(key, function(err, cacheObject) {
					if (err) {
						self.emit("error", err)
						return next()
					}
					// if the stale key expires, we let one request through to refresh the cache
					// this helps us avoid dog piles and herds
					self.client.get(staleKey, function(err, stale) {
						if (err) {
							self.emit("error", err)
							return next()
						}

						res.header(HEADER_KEY, MAX_AGE_KEY + "=" + ttl + ", " + MUST_REVALIDATE_KEY);

						if (!stale) {
							self.client.set(staleKey, STALE_REFRESH, GEN_TIME)
							cacheObject = null
						}

						if (cacheObject) {
							self.emit("hit", key)
							return self.sendCached(res, cacheObject)
						}

						res._responseBody = ""

						self.buildEnd(res, key, staleKey, realTtl, ttl)
						self.buildWrite(res)

						res.header(self.cacheHeader, false)
						next()
						self.emit("miss", key)
					})
				})
			}
		};
	}
}