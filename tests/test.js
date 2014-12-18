#!/usr/bin/env node

var lib8a = require('../lib/8a');

console.log('Getting ticks for Sander Pick');
lib8a.searchUser('Sander Pick', function(err, res) {
  console.log(res);
  lib8a.getTicks(res[0].userId, function(err, res) {
    console.log(res.boulderTicks);
    console.log(res.routeTicks);
  });
});
