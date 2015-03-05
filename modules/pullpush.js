var When = require('when');
var gitUtils = require('./gitUtils.js');
var jamFile = require('./jamFile.js');
var path = require('path');
var fs = require('fs');
var constants = require('constants.json');

exports.pull = function(){
	return When.all([gitUtils.dotJamConfig('backend'),gitUtils.getJamPath()]
	.spread(function(back,jamPath){
		var backend = back? back : "sftp";
		var digests = fs.readFileSync(path.join(jamPath,constants.MissingJam),'utf-8').split('\n');
		console.log('Preparing to pull',digests.length,'objects.');
		return [require('./Backends/' + backend).PullObjects(jamPath,digests),digests.length,jamPath];
	})
	.spread(function(failedObjects,numberOfObjects,jamPath){
		console.log('\nPulled',numberOfObjects - failedObjects.length,'objects.');
		if(failedObjects.length !== 0){
			console.error('Could not pull',failedObjects.length,'objects.');
		}
		fs.writeFileSync(path.join(jamPath,constants.MissingJam),failedObjects.join('\n'));
		return exports.restoreFiles();
	})
	.then(function(res){
		console.log('Done.');
	});
};

exports.restoreFiles = function(){
	console.log('Restoring jam files...');
	return gitUtils.lsFiles()
	.then(function(files){
		return [gitUtils.filteredFiles(files),gitUtils.getJamPath()];
	})
	.spread(function(files,jamPath){
		console.log('Considering',files.length,'jam files.');
		var skippedFiles = [];
		files.forEach(function(file){
			if(jamFile.mightBeJam(file)){
				var digest = jamFile.getDigestFromJam(file);
				var jamFilePath = path.join(jamPath,digest);
				if(digest != "" && fs.existsSync(jamFilePath)){
					console.log('Restoring',file,":",digest)
					fs.writeFileSync(file,fs.readSync(jamFilePath));
				}
				else if(digest != ""){
					console.error('/!\\ Could not restore',file,digest);
					skippedFiles.push({File : file, Digest : digest});
				}
			}
		});
		if(skippedFiles.length > 0){
			console.error("/!\\ Could not restore",skippedFiles.length,"files.");
		}
		return skippedFiles;
	});
};
