'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 * Visualization Schema
 */
var CampaignSchema = new Schema({
	name: String,
	visualizations: [{
		visualization: { type: String, ref: 'Visualization' },
		handles_interrupts: [String], // e.g. nfc if this visualization is to be brought to front onNfcEvent
		params: String, // Stringified JSON
		scope: { type: String, default: "campaign"},
		active: { type: Boolean, default: true },
		duration: { type: Number, default: -1 } // -1 if the viz will signal it's end via the postMessage API, otherwise runtime in ms
	}],
	drive_blobstore: String,
	is_public: { type: Boolean, default: true },
	updated_at: Date,
	created_at: Date
});

CampaignSchema.pre('save', function(next){
	this.updated_at = new Date;
	if ( !this.created_at ) {
		this.created_at = new Date;
	}
	next();
});

mongoose.model('Campaign', CampaignSchema);