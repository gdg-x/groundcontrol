'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 * Visualization Schema
 */
var VisualizationSchema = new Schema({
	name: String,
	url: String,
	handles: [String],
	updated_at: Date,
	created_at: Date
});

VisualizationSchema.pre('save', function(next){
	this.updated_at = new Date;
	if ( !this.created_at ) {
		this.created_at = new Date;
	}
	next();
});

mongoose.model('Visualization', VisualizationSchema);