var lib8a = require('../lib/8a');
var assert = require('assert');

describe('island-lib8a', function() {
  this.timeout(10000);
  var userId;
  describe('#searchUser()', function() {
    it('should find the user', function(done) {
      lib8a.searchUser('Hodzic', function(err, res) {
        if (err) done(err);
        assert.ok(res.length > 0)
        assert.equal(res[0].name, 'Jasna Hodzic')
        userId = res[0].userId
        done()
      });
    });
  });

  describe('#getTicks()', function() {
    it('should get the user\'s ticks', function(done) {
      lib8a.getTicks(userId, function(err, res) {
        if (err) done(err);
        assert.ok(res.length > 0)
        done()
      });
    });
  });
});
