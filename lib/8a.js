// Functionality for indexing content for search.

var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var Step = require('step');
var cheerio = require('cheerio');
var request = require('request');

var headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) '
                + 'AppleWebKit/537.17 (KHTML, like Gecko) '
                + 'Chrome/24.0.1312.57 Safari/537.17',
};

exports.searchUser = function(name, cb) {

  Step(
    // Make a request so we can scrape some headers required for POST
    function getPostHeaders() {
      request.get({
        uri: 'http://www.8a.nu/scorecard/Search.aspx',
        qs: {CountryCode: 'GLOBAL'},
        headers: headers,
        encoding: 'binary'
      }, this);
    },

    function searchMember(err, res, body) {
      if (err) return this(err);
      viewState_rx = new RegExp(/id=\"__VIEWSTATE\" value=\"([A-Za-z0-9+/=]+)/);
      eventValidation_rx = new RegExp(/id=\"__EVENTVALIDATION\" value=\"([A-Za-z0-9+/=]+)/);

      var form = {
        __EVENTTARGET: undefined,
        __EVENTARGUMENT: undefined,
        __VIEWSTATE: viewState_rx.exec(body)[1],
        __VIEWSTATEGENERATOR:'BE3FD81F',
        __EVENTVALIDATION: eventValidation_rx.exec(body)[1],
        ListboxRorBSimple: 0,
        TextboxAscentCragSimple: undefined,
        ListBoxAscentCountry: undefined,
        TextboxMemberName: name,
        ListBoxSearchUserSex: 2,
        TextboxMemberCity: undefined,
        ListBoxSearchUserCountry: undefined,
        ButtonSearchMember: 'Search',
        TextboxAscentSector: undefined
      };

      request.post({
        uri: 'http://www.8a.nu/scorecard/Search.aspx',
        qs: {CountryCode: 'GLOBAL'},
        form: form,
        headers: headers,
        encoding: 'binary',
      }, this);
    },

    function collectResults(err, res, body) {
      if (err) return cb(err);

      var searchResults = [];
      var results;
      var member_rx = new RegExp(/Profile\.aspx\?UserId=([0-9]+)\'>(.*?)<.*?<nobr>(.+?)<.*?<td>(.*?)</g);

      while (results = member_rx.exec(body)) {
        searchResults.push({
          userId: results[1],
          name: results[2],
          city: results[3],
          country: results[4]
        });
      }

      cb(null, searchResults);
    }
  );
};

// Get ticks for an 8a userId
exports.getTicks = function(userId, cb) {
  Step(
    function getJavascripts() {
      // Get the javascript file that contains the ascent URLs
      request.get({
        uri: 'http://www.8a.nu/js/u_common.aspx?UserId=' + userId,
        headers: _.extend(headers,
            {'Referer': 'http://www.8a.nu/user/Profile.aspx?UserId' + userId}),
        encoding: 'binary',
      }, this);
    },
    function getAscents(err, res, body) {
      if (err) return this(err);

      var sandbox = {};
      // Run javascript in a new context to get bouldering/route URLs
      // FIXME: This has some security risks, and we'll want to do it
      // in a seperate process
      require('vm').runInNewContext(body, sandbox, {timeout: 100});
      // bouldering ascent
      var url_rx = new RegExp(/<a href="\.\.(.*?)"/);
      var d = 'http://www.8a.nu';
      var boulderUrl = d + url_rx.exec(sandbox.A8_sc_b)[1];
      var routeUrl = d + url_rx.exec(sandbox.A8_sc_r)[1];

      request.get({
        uri: boulderUrl,
        headers: headers,
        encoding: 'binary',
      }, this.parallel());

      request.get({
        uri: routeUrl,
        headers: headers,
        encoding: 'binary',
      }, this.parallel());

    },
    function parseHtmls(err, boulders, routes) {
      if (err) return cb(err);

      // 8a image hashes for ascent style map to Island's 'tries'
      var triesMap = {
        // redpoints
        '979607b133a6622a1fc3443e564d9577': 3,
        // flashes
        '56f871c6548ae32aaa78672c1996df7f': 2,
        // onsights
        'e9aec9aee0951ec9abfe204498bf95f9': 1,
        'e37046f07ac72e84f91d7f29f8455b58': 1,
      };

      var userRecommend = function(str) {
        return str.indexOf('images/UserRecommended_1') !== -1;
      };

      // filter for ascents
      var ascents_rx = new RegExp(/<!-- Ascents -->([\s\S]+?)<!-- List Options -->/);
      var bouldersHtml = ascents_rx.exec(boulders.body)[1];
      var routesHtml = ascents_rx.exec(routes.body)[1];

      // parse HTML into a DOM structure
      var $ = cheerio.load(bouldersHtml);

      var createTickObj = function(els) {
        // Parse rows for Island tick props
        var obj =  ({
          type: 'b',
          date: new Date('20' + $(els.get(0)).find('nobr').text()),
          sent: true,
          tries: triesMap[$(els.get(1)).find('img').attr('src')
              .split('/')[1].split('.')[0]],
          ascent: format($(els.get(2)).find('a').text()),
          recommended: userRecommend($(els.get(3)).find('img').attr('src')),
          crag: format($(els.get(4)).find('span').text()).split('/')[0],
          first: $(els.get(5)).text().indexOf('FA') ? true : false,
          feel: $(els.get(5)).text().indexOf('Soft') ? -1 :
              $(els.get(5)).text().indexOf('Hard') ? 1 : 0,
          note: $(els.get(6)).contents().filter(function() {
            return this.nodeType == 3;
          }).text(),
          rating: ($(els.get(7)).text().match(/\*/g) || []).length
        });
        return obj;
      };

      var boulderTicks = [];
      $('.AscentListHeadRow').each(function() {
        $(this).parent().nextUntil('tr:has(td:only-child)')
            .each(function() {
          var els = $(this).children();
          var tick = createTickObj(els);
          tick.type = 'b';
          boulderTicks.push(tick);
        });
      });

      $ = cheerio.load(routesHtml);
      var routeTicks = [];
      $('.AscentListHeadRow').each(function() {
        $(this).parent().nextUntil('tr:has(td:only-child)')
            .each(function() {
          var els = $(this).children();
          var tick = createTickObj(els);
          tick.type = 'r';
          routeTicks.push(tick);
        });
      });

      cb(null, boulderTicks.concat(routeTicks));
    }
  );
};
