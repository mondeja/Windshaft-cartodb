var assert = require('assert');
var _ = require('underscore');

var RedisPool = require('redis-mpool');
var cartodbRedis = require('cartodb-redis');
var PgConnection = require('../../../lib/cartodb/backends/pg_connection');
var AuthApi = require('../../../lib/cartodb/api/auth_api');
var TemplateMaps = require('../../../lib/cartodb/backends/template_maps');

const cleanUpQueryParamsMiddleware = require('../../../lib/cartodb/middleware/context/clean-up-query-params');
const authorizeMiddleware = require('../../../lib/cartodb/middleware/context/authorize');
const dbConnSetupMiddleware = require('../../../lib/cartodb/middleware/context/db-conn-setup');

var windshaft = require('windshaft');

describe('prepare-context', function() {

    var test_user = _.template(global.environment.postgres_auth_user, {user_id:1});
    var test_pubuser = global.environment.postgres.user;
    var test_database = test_user + '_db';

    let cleanUpQueryParams;
    let dbConnSetup;
    let authorize;

    before(function() {
        var redisPool = new RedisPool(global.environment.redis);
        var mapStore = new windshaft.storage.MapStore();
        var metadataBackend = cartodbRedis({pool: redisPool});
        var pgConnection = new PgConnection(metadataBackend);
        var templateMaps = new TemplateMaps(redisPool);
        var authApi = new AuthApi(pgConnection, metadataBackend, mapStore, templateMaps);

        cleanUpQueryParams = cleanUpQueryParamsMiddleware();
        authorize = authorizeMiddleware(authApi);
        dbConnSetup = dbConnSetupMiddleware(pgConnection);
    });


    it('can be found in server_options', function(){
        assert.ok(_.isFunction(authorize));
        assert.ok(_.isFunction(dbConnSetup));
        assert.ok(_.isFunction(cleanUpQueryParams));
    });

    function prepareRequest(req) {
        req.profiler = {
            done: function() {}
        };
        req.context = { user: 'localhost' };
        req.params = {};
        return req;
    }

    it('cleans up request', function(done){
      var req = {headers: { host:'localhost' }, query: {dbuser:'hacker',dbname:'secret'}};
      var res = {};

      cleanUpQueryParams(prepareRequest(req), res, function(err) {
          if ( err ) { done(err); return; }
          assert.ok(_.isObject(req.query), 'request has query');
          assert.ok(!req.query.hasOwnProperty('dbuser'), 'dbuser was removed from query');
          assert.ok(req.hasOwnProperty('params'), 'request has params');
          assert.ok(!req.params.hasOwnProperty('interactivity'), 'request params do not have interactivity');
          done();
      });
    });

    it('sets dbname from redis metadata', function(done){
      var req = {headers: { host:'localhost' }, query: {}, locals: {} };
      var res = {};

      dbConnSetup(prepareRequest(req), res, function(err) {
          if ( err ) { done(err); return; }
          assert.ok(_.isObject(req.query), 'request has query');
          assert.ok(!req.query.hasOwnProperty('dbuser'), 'dbuser was removed from query');
          assert.ok(req.hasOwnProperty('params'), 'request has params');
          assert.ok(!req.params.hasOwnProperty('interactivity'), 'request params do not have interactivity');
          assert.equal(req.params.dbname, test_database);
          assert.ok(req.params.dbuser === test_pubuser, 'could inject dbuser ('+req.params.dbuser+')');
          done();
      });
    });

    it('sets also dbuser for authenticated requests', function(done){
        var req = { headers: { host: 'localhost' }, query: { map_key: '1234' }, locals: {} };
        var res = {};

        // FIXME: review authorize-pgconnsetup workflow, It might we are doing authorization twice.
        authorize(prepareRequest(req), res, function (err) {
            if (err) { done(err); return; }
            dbConnSetup(req, res, function(err) {
                if ( err ) { done(err); return; }
                assert.ok(_.isObject(req.query), 'request has query');
                assert.ok(!req.query.hasOwnProperty('dbuser'), 'dbuser was removed from query');
                assert.ok(req.hasOwnProperty('params'), 'request has params');
                assert.ok(!req.params.hasOwnProperty('interactivity'), 'request params do not have interactivity');
                assert.equal(req.params.dbname, test_database);
                assert.equal(req.params.dbuser, test_user);

                req = {
                    headers: {
                        host:'localhost'
                    },
                    query: {
                        map_key: '1235'
                    },
                    locals: {}
                };

                dbConnSetup(prepareRequest(req), res, function(err, req) {
                    // wrong key resets params to no user
                    assert.ok(req.params.dbuser === test_pubuser, 'could inject dbuser ('+req.params.dbuser+')');
                    done();
                });
            });
        });
    });

    it('it should remove invalid params', function(done) {
        var config = {
            version: '1.3.0'
        };
        var req = {
            headers: {
                host:'localhost'
            },
            query: {
                non_included: 'toberemoved',
                api_key: 'test',
                style: 'override',
                config: config
            },
            locals: {}
        };
        var res = {};

        cleanUpQueryParams(prepareRequest(req), res, function (err) {
            if ( err ) {
                return done(err);
            }

            var query = req.params;
            assert.deepEqual(config, query.config);
            assert.equal('test', query.api_key);
            assert.equal(undefined, query.non_included);
            done();
        });
    });

});