var test = require('tap').test
 , repo = require(__dirname+'/../lib/repo.js');
 ;

test('test create document',function(t){
  var em = repo.list(__dirname+'/fixtures');

  em.on('tar',function(tarinfo){
    console.log(tarinfo);
    t.equals(tarinfo.name,'npmish','tar found should have correct name');
    t.equals(tarinfo.version,'0.0.0','version should be 0.0.0');
  });
  
  em.on('end',function(){
    t.end();
  });
});



