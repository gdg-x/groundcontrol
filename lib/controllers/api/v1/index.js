'use strict';

module.exports = function(app, cacher) {
	
	// Version Metadata
	app.set("metadata", {
		name: "bitos",
		title: "bitOS API",
		description: "Office 4.0",
		ownerName: "bitstars",
		status: "unstable",
		icons: {
			"x16": "https://bitos.herokuapp.com/images/icons/apis/bitos-16.png",
			"x32": "https://bitos.herokuapp.com/images/icons/apis/bitos-32.png"
		},
		protocol: "rest"
	})
	require("fs").readdirSync(__dirname + '/').forEach(function(file) {
		if (file.match(/.+\.js/g) != null && file != "index.js") {
			require('./'+file)(app, cacher);
		}
	});
}