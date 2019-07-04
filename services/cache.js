const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');
const keys = require('../config/keys');

//const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
    this.useCache = true;
    this.hasKey = JSON.stringify(options.key || '');

    return this;
}

mongoose.Query.prototype.exec = async function() {
    //console.log('I am about to run a query.....');
    //console.log(this.getQuery());
    //console.log(this.mongooseCollection.name);

    if(!this.useCache) {
       return exec.apply(this, arguments);
    }

    const key = JSON.stringify({
        ...this.getQuery(),
        collection:this.mongooseCollection.name
    });

   // console.log(`key is ${JSON.stringify(key)} `);
   // console.log(key);
   const cacheValue = await client.hget(this.hasKey,key);

   if(cacheValue) {
       // const doc = new this.model(JSON.parse(cacheValue));

       const doc = JSON.parse(cacheValue);

       console.log(` FROM CACHE`);

        return  Array.isArray(doc) 
            ? doc.map( d => new this.model(d)) 
            : new this.model(doc) 
       
      
   }
   console.log(` FROM DB`);
   const result = await exec.apply(this, arguments);
   client.hset(this.hasKey , key, JSON.stringify(result));
   return result;
}

module.exports = {

    clearHash(hashKey) {
        client.del(JSON.stringify(hashKey));
    }

}