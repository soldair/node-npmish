var tako = require('tako')
  , request = require('request')
  , path = require('path')
  , url = require('url')
  , repo = require('./lib/repo.js')
  , fs = require('fs')
  , app = tako()
  ;

//
// USE:
//
// var npmish = require('npmish');
// var app = npmish({tarpath:__dirname+'/tars',idletimeout:20000});
// app.httpServer.listen(8033);
//


module.exports = function(config){

  //
  //process config
  //

  config  = config || {};
  config.tarpath = config.tarpath ||  config.tarpath || process.cwd()+'/tars';
  config.packagepath = config.packagepath ||  config.packagepath || process.cwd()+'/packages';
  config.publicrepo = config.publicrepo || "https://registry.npmjs.org";
  config.idletimeout = config.idletimeout ||  undefined;

  console.log('preparing npmish server');
  console.log("\ttar path: "+config.tarpath);
  console.log("\tpackage path: "+config.packagepath);
  console.log("\tpublic repo: "+config.publicrepo);
  console.log("\tidle timeout: "+(config.idletimeout?config.idletimeout:'no timeout'));

  //
  //shared state
  //
  lastrequest = Date.now();

  //
  //define routes
  //

  var serveTarRoute = function(req,res){
    lastrequest = Date.now();
    
    var dir = config.tarpath || process.cwd()+'/tars';
    var path = dir+req.url;

    console.log('looking for tar: ',path);
    serveTar(path,res);

  };

  var serveModuleJson = function(req,res){
    lastrequest = Date.now();

    var parsed = url.parse(req.url);
    var split = parsed.path.split('/') 
    var modulename = split[1]||'';
    var explicitversion = split[2];
    //
    //lookup the package
    //  
    repo(modulename,config.tarpath,req.headers.host,function(err,package){
      console.log('package lookup called back.');
      if(err) {
        console.log('error in package callback ',err);
        //
        // proxy request to public repo
        //
        if(!req.url || !req.url.length || req.url == '/') {
          //
          // dont want to get listing of registry... or do i?
          //
          res.writeHead(404,{'content-type':'text/plain'});
          res.end('you should send a modulename.')

        } else {
          console.log('calling ',config.publicrepo+req.url);
          req.pipe(request(config.publicrepo+req.url).pipe(res));
        }

      } else {

        //
        //serve json that will cause npm to download the package from this server
        //
        if(explicitversion) {

          //
          // if an explicit version is requested the version entry in the json is returned.
          // it its not found the npm reg returns not found.
          //
          package = package['versions'][explicitversion];
          if(!package){
            res.end({"error":"not_found","reason":"document not found"});
            return;
          }
        }

        res.end(package);

      }
    });

  };


  var ready = false;
  var readyWrap = function(cb){
    return function(req,res){
      if(ready) return cb(req,res);
      app.once('ready',function(){
        cb(req,res);
      });
    }
  };

  //
  // bind all routes
  //

  app.route("/:tar.tgz",readyWrap(serveTarRoute)).methods('GET');
  app.route('/:module/:explicitversion',readyWrap(serveModuleJson)).methods('GET');
  app.route('/:module',readyWrap(serveModuleJson)).methods('GET');

  //
  // TODO: add support for publish.
  //  commit new tar to this repo master and push.
  //

  if(config.idletimeout) {
    setInterval(function(){
        if(lastrequest+config.idletimeout < Date.now()) {
          console.log('process is idle. exiting');
          process.exit(0);
        }
    },300);
  }

  //
  // build missing tars.
  //

  repo.syncTars(config.packagepath,config.tarpath,function(){
    ready = true;
    app.emit('ready');
  });

  return app
}

//
// helpers
//

function serveTar(path,res){

    fs.stat(path,function(err,data){
        if (err) {

          console.log('no tar: ',err);
          res.writeHead(404);
          res.end('no tar =(');

        } else {

          res.writeHead(200,{'content-type':'application/x-tar'});

          var stream = fs.createReadStream(path);
          stream.on('open',function(){
            stream.pipe(res);
          });

          stream.on('error',function(err){
            res.end(err);
          });
        }
    });

}

