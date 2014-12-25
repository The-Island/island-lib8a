#!/usr/bin/env node

var lib8a = require('../lib/8a');

console.log('Getting ticks for Jasna Hodzic');
lib8a.searchUser('Hodzic', function(err, res) {
  console.log(err, res);
  lib8a.getTicks(res[0].userId, function(err, res) {
    console.log(err, res);
  });
});
