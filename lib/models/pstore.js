'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 * User Schema
 */
var PersistentStoreSchema = new Schema({
	scope: String,
	key: String,
	value: Schema.Types.Mixed,
	updated_at: Date,
	created_at: Date
});

PersistentStoreSchema.pre('save', function(next){
	this.updated_at = new Date;
	if ( !this.created_at ) {
		this.created_at = new Date;
	}
	next();
});

PersistentStoreSchema.index({scope: 1, key: 1}, {unique: true, sparse: true});

mongoose.model('PersistentStore', PersistentStoreSchema);