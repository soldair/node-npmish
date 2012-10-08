var walkdir = require('walkdir')
 , semver = require('semver')
 , tar = require('tar')
 , path = require('path')
 , fs = require('fs')
 , exec = require('child_process').exec
 ;

module.exports = function(modulename,dir,host,cb) {

  var em = list(dir);
  
  var versions = [];
  em.on('tar',function(tar){
    if(tar.name == modulename) {
      versions.push(tar);
    }  
  });

  em.on('error',function(err){
    cb(err,undefined); 
  });

  em.on('end',function(){

    if(!versions.length) return cb(new Error('could not locate module '+modulename),undefined);

    createDocument(versions,host,function(err,doc){
      cb(err,doc);
    });
  })
}

module.exports.list = list;

function list(dir,cb) {

  var find = walkdir(dir);
  find.on('file',function(path,stat){

    if(path.indexOf('.tgz') === -1) return;

    //mint-gitlog-0.0.0.tgz
    var matches = path.match(/([^/]+)-([^-]+).tgz$/);
    if(!matches) return;

    find.emit('tar',{path:path,version:matches[2],name:matches[1]})
  });

  if(cb) {
    var tars = [];
    find.on('tar',function(tar){    
      tars.push(tar);
    });

    find.on('end',function(){
      cb(undefined,tars); 
    });

    find.on('error',function(err){
       cb(err,undefined);
    });
  }

  return find;
}

module.exports.syncTars = function(packagedir,tardir,cb){

  var find = walkdir(packagedir,{max_depth:2})
   , q = 0
   , done = function(err,data){
      q--;
      if(!q && cb) cb(err,data);
    }
   ;
  

  find.on('file',function(p){
    if(path.basename(p) == 'package.json'){
      q++;
      fs.readFile(p,function(err,data){
        if(err) {
          console.log('error: could not read package.json at '+p+' ',err);
          done(err)
        } else {
          data = data.toString();
          try{
            var json = JSON.parse(data);
          } catch (e) {
            console.log('error: invalid json found in package.json '+p+' ',e);
            return done(e);
          }

          var name = json.name
           , version = json.version
           , tarname = name+'-'+json.version+'.tgz'
           , tarpath = tardir+'/'+tarname
           ;

          fs.stat(tarpath,function(err,stat){
            if(err) {
              //npm pack!
              npmPack(path.dirname(p),tarpath,function(err,tpath,stat){
                if(err) console.log('sync tar: could not npm pack '+p);
                console.log('sync tar: packed '+name+'@'+version+' into '+tpath);
                done(undefined,tarpath);
              });
            } else {
              console.log('sync tar: '+name+'@'+version+' tar exists at '+tarpath);
              done(undefined,tarpath);
            }  
          });
        }
      });
    }
  });
}

//
// private functions.
//

function createDocument(tarVersions,host,cb){
  if(!tarVersions || !tarVersions.length) return cb(new Error('missing or empty tar versions'),undefined);

  var latest = tarVersions[0].version;
  var versions = {};
  var times = {};
  tarVersions.forEach(function(tarinfo,k){
        if(semver.gt(tarinfo.version,latest)) latest = tarinfo.version;

        versions[tarinfo.version] = {
          _id:tarinfo.name+'@'+tarinfo.version,
          _rev:Date.now(),
          name:tarinfo.name,
          version:tarinfo.version,
          dist:{
            tarball:"http://"+host+"/"+tarinfo.name+'-'+tarinfo.version+".tgz"
          },
          //
          //TODO read from tar. 
          //this stage of the install should only need to provide the dist tarball.
          //all of this is hardcoded placeholder data.
          //
          description:"TODO.. - red",
          homepage:"",
          main:"index.js",
          engines:{
            node:">=0.2.0"
          },
          _nodeSupported:true,
          _npmVersion:"1.0",
          _nodeVersion:"v0.6.12"
        };

        times[tarinfo.version] = (new Date()).toString();
  });

  var doc = {
    _id:versions[latest].name,
    _rev:Date.now(),
    name:versions[latest].name,
    version:latest,
    description:versions[latest].description,
    "dist-tags":{latest:latest},
    versions:versions,
    time:times
  };

  cb(undefined,doc);
}

function npmPack(packagedir,tarpath,cb){
  exec('cd "'+packagedir+'"; mv `npm pack` "'+tarpath+'"',function(err,stdout,stderr){
      if(err) {
        return cb(err,undefined);
      }

      fs.stat(tarpath,function(err,stat){
        if(err) return cb(err,undefined);
        return cb(undefined,tarpath,stat);
      });
  });
}


/*
{
  "_id":"jsontoxml",
    "_rev":"",
    "name":"jsontoxml",
    "description":"This renders a simple javascript object structure into reasonably complicated xml/html. js objects are easier to modify than strings so no need to parse a whole dom to reliably add a few elements",
    "dist-tags":{"latest":"0.0.2"},
    "versions":{
      "0.0.1":{
        "name":"jsontoxml",
        "version":"0.0.1",
        "description":"This renders a simple javascript object structure into reasonably complicated xml/html. js objects are easier to modify than strings so no need to parse a whole dom to reliably add a few elements",
        "homepage":"http://github.com/soldair/node-json_to_xml",
        "main":"./jsontoxml",
        "people":{
          "author":{
            "name":"Ryan Day",
            "email":"soldair@gmail.com",
            "url":"http://ryanday.org"
          }
        },
        "repository":{
          "type":"git",
          "url":"git://github.com/soldair/node-json_to_xml.git"
        },
        "engines":{
          "node":">=0.2.0"
        },
        "_id":"jsontoxml@0.0.1",
        "_nodeSupported":true,
        "_npmVersion":"0.2.7-2",
        "_nodeVersion":"v0.3.1-pre",
        "dist":{
          "tarball":"http://registry.npmjs.org/jsontoxml/-/jsontoxml-0.0.1.tgz"
        },
        "directories":{}
      }
    }
    "maintainers":[{"name":"soldair","email":"soldair@gmail.com"}],
    "repository":{"type":"git","url":"git://github.com/soldair/node-jsontoxml.git"},
    "time":{
      "0.0.1":"2011-04-11T13:16:33.982Z",
      "0.0.2":"2011-04-11T13:16:33.982Z"
    }
}
*/
