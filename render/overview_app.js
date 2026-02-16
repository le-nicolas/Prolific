    key_stats_all = [] // global

    function showOverviewMessage(html) {
      $("#content").html('<div class="overview-msg">' + html + '</div>');
      $("#keysummary").empty();
      $("#timesummary").empty();
      $("#yearsummary").empty();
      $("#keystats").empty();
    }
    var overviewPrimaryUrl = "http://127.0.0.1:8080/overview.html";
    var overviewFallbackUrl = "http://127.0.0.1:8090/overview.html";

    var skipdraw = {}; // global...
    function drawEvents() {
      $("#content").empty();
      if(!event_list || event_list.length === 0) {
        showOverviewMessage('No exported days yet. Click <b>Refresh Data</b> after tracking for a bit.');
        return;
      }

      // draw the legend on top of the svg
      var d3div = d3.select("#content");
      var ldiv = d3div.append("div").attr('class', 'legenddiv');

      for(var i=0;i<etypes.length;i++) {
        var pi = ldiv.append('p').text(etypes[i]).attr('style', 'color:' + color_hash[etypes[i]]);

        var m = etypes[i];
        if(skipdraw[m]) { pi.attr('class', 'skipdrawyes'); }
        else { pi.attr('class', 'skipdrawno'); }

        pi.on('click', function(i) { // close over index i
          return function() {
            // toggle whether this one gets drawn
            var m = etypes[i];
            if(skipdraw[m] === false) { skipdraw[m] = true; }
            else { skipdraw[m] = false; }
            drawEvents(); // and redraw the graph!
          }
        }(i));
      }

      var margin = {top: 10, right: 10, bottom: 100, left: 40};
      var fullwidth = 1200;
      var fullheight = 800;
      var width = fullwidth - margin.left - margin.right;
      var height = fullheight - margin.top - margin.bottom;
      var svg = d3div.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)

      var yscale = 0.008;

      // draw y axis labels
      var yoff = 0;
      var yn = 0;
      while(yoff < height) {

        var yy = (height + margin.top - yoff);
        svg.append("text")
          .attr("transform", "translate(1," + (yy-3) + ")")
          .text(yn + "hr");

        svg.append("line")
          .attr("x1", 0)
          .attr("x2", width + margin.left)
          .attr("y1", yy)
          .attr("y2", yy)
          .attr("stroke", "#EEE")
          .attr("stroke-width", 1);

        yn++;
        yoff += 3600 * yscale;
      }

      // draw x axis labels
      var N = edur.length;
      var dsz = width / N;
      svg.selectAll('.xlabel')
        .data(event_list)
      .enter()
        .append("text")
        .attr("transform", function(d, i) {
          var x = margin.left + i * dsz;
          var y = height + margin.top + 3;
          return "translate(" + x + "," + y + ")rotate(90)";})
        .attr("fill", "#333")
        .attr("font-family", "arial")
        .attr("font-size", "14px")
        .text(function(d) { var dobj = new Date(d.t0 * 1000); return ppDateShort(dobj); })

      // draw vertical lines at week boundaries for easier visual consumption
      svg.selectAll('.yd')
        .data(event_list)
      .enter()
        .append("line")
        .attr("stroke", function(d) { 
          var dobj = new Date(d.t0 * 1000); 
          var isMonday = dobj.getDay() === 1;
          return isMonday ? "#BBB" : "#EEE"
        })
        .attr('x1', function(d, i) { return margin.left + i * dsz; })
        .attr('x2', function(d, i) { return margin.left + i * dsz; })
        .attr('y1', height + margin.top)
        .attr('y2', margin.top);

      // draw the data
      for(var k=0;k<N;k++) {
        // convert from kv to list
        var dtimes = [];
        for(var i=0;i<etypes.length;i++) {
          var m = etypes[i];
          if(skipdraw[m]) continue; // skip!
          dtimes.push({
            val: edur[k].hasOwnProperty(m) ? edur[k][m] : 0,
            col: color_hash[m]
          });
        }

        svgg = svg.append('g')
          .attr("style", "cursor:pointer;")
          .on("click", function(q){ 
            return function(){
              window.location.href = 'day.html?gotoday=' + q;
            };
          }(k)); // have to closure k

        var gh = 0;
        svgg.selectAll(".day"+k)
          .data(dtimes)
        .enter()
          .append("rect")
          .attr("width", dsz)
          .attr("height", function(d) { return d.val * yscale; })
          .attr("x", margin.left + k * dsz)
          .attr("y", function(d) { gh += d.val; return height + margin.top - gh * yscale; })
          .attr("fill", function(d) { return d.col; } );
      }
    }

    // enter .m field and build up etypes[]
    var etypes = []
    function mapEvents(es) {
      for(var i=0,N=es.length;i<N;i++) {
        var e = es[i];
        e.m = mapwin(e.s);
        if(etypes.indexOf(e.m) === -1) { 
          etypes.push(e.m); 
          skipdraw[e.m] = false;
        }
      }
    }

    function statEvents(es, ecounts) {
      if(es.length === 0) return; // empty case

      var t0 = es[0].t;
      var ixprev = 0;
      for(var i=1,N=es.length;i<N;i++) {
        var e = es[i];
        var dt = es[i].t - es[ixprev].t; // length of time for last event
        es[ixprev].dt = dt;
        var tmap = es[ixprev].m; // mapped title of previous events
        if(ecounts.hasOwnProperty(tmap)) {
          ecounts[tmap] += dt;
        } else {
          ecounts[tmap] = 0;
        }
        ixprev = i;
      }
      es[N-1].dt = 1; // last event we dont know how long lasted. assume 1 second?
    }

    var edur = []; // stores durations for events for all days. Core structure!
    var color_hash = {};
    function analyzeEvents() {
      edur = []; // reset global var

      for(var k=0;k<events.length;k++) {
        var es = events[k]['window_events']; // window events for day k
        mapEvents(es); // assign group names to structure in field .m, build etypes[]
      }
      color_hash = colorHashStrings(etypes);
      
      for(var k=0;k<events.length;k++) {
        edur.push({}) // hmmm
        var es = events[k]['window_events']; // window events for day k
        statEvents(es, edur[k]);
      }
    }

    function drawKeyEvents() {

      var W = $("#keystats").width();
      var H = 15;
      $("#keystats").empty();
      if(!events || events.length === 0) {
        return;
      }

      var wmargin = 100;

      var time_bin = 10*60; // in seconds
      var allkevents = [];
      var d0s = [];
      var ktots = [];
      var maxs = 0;
      var maxktot = 0;
      var kevents_global = [];
      var max_kevents_global = 0;
      var sum_kevents_global = 0;
      for(var k=0;k<events.length;k++) {
        var es = events[k]['keyfreq_events'] || []; // keyfreq events for day k
        
        // use exported day boundary so empty keyfreq days are still represented
        var t00 = event_list[k].t0;
        var d0 = new Date(t00 * 1000);
        var ft = t00 + 60*60*24; // 7am the next day
        var kevents = [];
        var t = t00;
        while(t <= ft) { 
          kevents.push(0); t += time_bin; // create time bins
          if(k===0) { kevents_global.push(0); }
        } 

        // bucket up the events
        var ktot = 0;
        for(var q=0,n=es.length;q<n;q++) {
          var kw = es[q];
          var binix = Math.floor((kw.t - t00)/time_bin);
          if(binix < 0 || binix >= kevents.length) {
            continue;
          }
          var news = kevents[binix] + kw.s;
          kevents[binix] = news;
          var newg = kevents_global[binix] + kw.s;
          if(news > maxs) { maxs = news; }

          kevents_global[binix] = newg;
          if(newg > max_kevents_global) { max_kevents_global = newg; }
          sum_kevents_global += kw.s;
          
          ktot += kw.s;
        }
        allkevents.push(kevents);
        d0s.push(d0);
        ktots.push(ktot);
        if(ktot > maxktot) { maxktot = ktot; }
      }

      // avoid divide-by-zero when there is no key activity
      maxs = Math.max(1, maxs);
      maxktot = Math.max(1, maxktot);
      max_kevents_global = Math.max(1, max_kevents_global);

      // draw global key events across all days as line
      var sx = kevents_global.length;
      var bar_width = (W - wmargin) / sx;
      var div = d3.select("#keystats").append("div");
      var svg = div.append("svg")
        .attr("width", W)
        .attr("height", H*2);
      var line = d3.svg.line()
        .x(function(d,i) { return (W - 2*wmargin) * i / sx + wmargin; })
        .y(function(d) { return 2*H - d / max_kevents_global * H * 2; });
      svg.append("path")
        .datum(kevents_global)
        .attr("class", "line")
        .attr("d", line);

      // draw x axis: times of the day
      var div = d3.select("#keystats").append("div");
      var svg = div.append("svg")
        .attr("width", W)
        .attr("height", 20);
      for(var q=0;q<24;q++) {
        svg.append('text')
        .attr('font-size', 14)
        .attr("font-family", "arial")
        .attr("transform", "translate(" + (q/24*(W-2*wmargin)+2+wmargin) + ",16)")
        .text(function(d, i) { return ((q + 7) % 24) + ':00'; });

        svg.append('line')
        .attr('x1', q/24*(W-2*wmargin)+wmargin)
        .attr('x2', q/24*(W-2*wmargin)+wmargin)
        .attr('y1', 0)
        .attr('y2', 20)
        .attr("stroke", "#000")
        .attr("stroke-width", 2);

      }

      for(var k=0;k<events.length;k++) {

        var kevents = allkevents[k];
        var div = d3.select("#keystats").append("div").attr("class", "divkeys");

        var svg = div.append("svg")
        .attr("width", W)
        .attr("height", H);
        var sx = kevents.length;

        svg.selectAll('.ke')
          .data(kevents)
        .enter()
          .append('rect')
          .attr('x', function(d,i) { return (W - 2*wmargin) * i / sx + wmargin; })
          .attr('width', bar_width)
          .attr('y', 0)
          .attr('height', H)
          .attr('fill', function(d) {
            var e = d / maxs;
            var r = Math.floor(Math.max(0, 255 - e*255));
            var g = Math.floor(Math.max(0, 255 - e*255));
            var b = 255;
            return 'rgb(' + r + ',' + g + ',' + b + ')';
          });

        // draw y axis: time
        svg.append('text')
          .attr("font-size", 14)
          .attr("transform", "translate(0,12)")
          .attr("font-family", "arial")
          .text(ppDateShort(d0s[k]));

        // draw y axis: total number of keys
        svg.append('rect')
          .attr('x', W - wmargin + 5)
          .attr('y', 0)
          .attr('width', function(d) { return ktots[k]/maxktot * wmargin; })
          .attr('height', H)
          .attr('fill', 'rgb(255, 100, 100)');

        svg.append('text')
          .attr('transform', 'translate(' + (W - wmargin + 7) + ', ' + 13 + ')')
          .attr('font-size', 14)
          .attr("font-family", "arial")
          .text(ktots[k]);
      }

      var kevents_global
      div.append('p').text('total keys pressed: ' + sum_kevents_global + ' in ' + events.length + ' days (' + Math.floor(sum_kevents_global/events.length) + ' per day average)');
    }

    function loadAllEvents() {
      var loaded_ok = false;

      // load the master json file and all the other jsons
      getJSON_CACHEHACK("export_list.json").then(function(days_list) {
        event_list = days_list; // global variable assign
        console.log("fetched export_list OK.")
        return Promise.all((days_list || []).map(function(x) { return getJSON_CACHEHACK(x.fname); }));
      }).then(function(days) {
        events = days; // global variable assign
        loaded_ok = true;
      }).catch(function(err){
        console.log('some error happened: ' + err);
        var msg = 'Global Overview could not load data. ';
        if(window.location.protocol === 'file:') {
          msg += 'Open it from the local server instead: ';
          msg += '<a href="' + overviewPrimaryUrl + '">:8080</a> or ';
          msg += '<a href="' + overviewFallbackUrl + '">:8090</a>.';
        } else {
          msg += 'Try refreshing, then open via ';
          msg += '<a href="' + overviewPrimaryUrl + '">:8080</a> or ';
          msg += '<a href="' + overviewFallbackUrl + '">:8090</a>.';
        }
        showOverviewMessage(msg);
      }).then(function() {
        if(!loaded_ok) {
          return;
        }
        if(!event_list || event_list.length === 0) {
          showOverviewMessage('No exported days yet. Click <b>Refresh Data</b> after tracking for a bit.');
          return;
        }
        
        analyzeEvents(); // all events have been loaded. Analyze!
        drawEvents(); // and d3js draw!
        
        key_stats_all = mergeWindowKeyEvents();
        visualizeKeySummary(key_stats_all);
        visualizeTimeSummary(edur);
        visualizeYearlySummary(edur);
        try {
          drawKeyEvents(); // draw key events
        } catch (err) {
          console.log('drawKeyEvents failed: ' + err);
        }
      });
    }

    function mergeWindowKeyEvents() {
      // iterate over all events and compute key_stats
      var key_stats_all = [];
      for(var k=0;k<events.length;k++) {
        var es = events[k]['window_events'] || []; // window events for day k
        var ek = events[k]['keyfreq_events'] || []; // key events
        key_stats = computeKeyStats(es, ek); // defined in prolific_common
        key_stats_all.push(key_stats);
      }
      return key_stats_all;
    }

    function visualizeKeySummary(key_stats_all) {
      $("#keysummary").empty();

      // merge all keystats into a single global key stats
      var gstats = {};
      _.each(etypes, function(m) { gstats[m] = {name: m, val: 0, n:0, col: color_hash[m]}; });
      var n = key_stats_all.length;
      for(var i=0;i<n;i++) {
        var key_stats = key_stats_all[i];
        for(var j=0;j<etypes.length;j++) {
          var e = etypes[j];
          if(key_stats.hasOwnProperty(e)) {
            gstats[e].val += key_stats[e].f;
            gstats[e].n += key_stats[e].n;
          }
        }
      }
      gstats = _.filter(gstats, function(d) { return d.val > 0; }); // cutoff at 0 keys
      _.each(gstats, function(d) { d.text = d.val + ' (' + (d.val/(d.n*9)).toFixed(2) + '/s) (' + d.name + ')'; });
      gstats = _.sortBy(gstats, 'val').reverse();

      // visualize as chart
      var chart_data = {};
      chart_data.width = 600;
      chart_data.barheight = 30;
      chart_data.textpad = 300;
      chart_data.textmargin = 10;
      chart_data.title = 'total keys per window';
      chart_data.data = gstats;
      d3utils.drawHorizontalBarChart(d3.select('#keysummary'), chart_data);
    }

    function visualizeTimeSummary(edur) {
      $("#timesummary").empty();

      var gstats = {};
      _.each(etypes, function(m) { gstats[m] = {name: m, val: 0, n:0, col: color_hash[m]}; });
      var n = edur.length;
      for(var i=0;i<n;i++) {
        var key_stats = edur[i];
        for(var j=0;j<etypes.length;j++) {
          var e = etypes[j];
          if(key_stats.hasOwnProperty(e)) {
            gstats[e].val += key_stats[e];
          }
        }
      }
      gstats = _.filter(gstats, function(d) { return d.val > 0; }); // cutoff at 0 keys
      _.each(gstats, function(d) { d.text = (d.val/60/60).toFixed(2) + 'hr (' + d.name + ')'; });
      gstats = _.sortBy(gstats, 'val').reverse();

      // visualize as chart
      var chart_data = {};
      chart_data.width = 600;
      chart_data.barheight = 30;
      chart_data.textpad = 300;
      chart_data.textmargin = 10;
      chart_data.title = 'total time per window';
      chart_data.data = gstats;
      d3utils.drawHorizontalBarChart(d3.select('#timesummary'), chart_data);
    }

    function visualizeYearlySummary(edur) {
      $("#yearsummary").empty();
      if(!event_list || !edur || edur.length === 0) {
        $("#yearsummary").html('<div class="overview-msg">No yearly data yet.</div>');
        return;
      }

      var yearly = {};
      var n = Math.min(edur.length, event_list.length);
      for(var k=0;k<n;k++) {
        var t0 = event_list[k].t0;
        if(!t0) continue;

        var year = new Date(t0 * 1000).getFullYear();
        if(!yearly.hasOwnProperty(year)) {
          yearly[year] = {total: 0, categories: {}};
        }

        var daystats = edur[k] || {};
        for(var cat in daystats) {
          if(!daystats.hasOwnProperty(cat)) continue;
          var sec = daystats[cat];
          if(!isFinite(sec) || sec <= 0) continue;
          yearly[year].total += sec;
          yearly[year].categories[cat] = (yearly[year].categories[cat] || 0) + sec;
        }
      }

      var years = _.keys(yearly).sort().reverse();
      if(years.length === 0) {
        $("#yearsummary").html('<div class="overview-msg">No yearly data yet.</div>');
        return;
      }

      var max_total = _.max(_.map(years, function(y) { return yearly[y].total; }));
      max_total = Math.max(1, max_total);

      var grid = $('<div class="year-grid"></div>');
      _.each(years, function(year) {
        var info = yearly[year];
        var card = $('<article class="year-card"></article>');

        var head = $('<div class="year-head"></div>');
        head.append($('<h3 class="year-title"></h3>').text(year));
        head.append($('<p class="year-total"></p>').text((info.total / 3600.0).toFixed(2) + ' hr tracked'));
        card.append(head);

        var track = $('<div class="year-track"><div class="year-fill"></div></div>');
        track.find('.year-fill').css('width', (100 * info.total / max_total).toFixed(2) + '%');
        card.append(track);

        var cats = _.map(_.keys(info.categories), function(name) {
          return {name: name, sec: info.categories[name]};
        });
        cats = _.sortBy(cats, function(d) { return d.sec; }).reverse();

        var list = $('<div class="year-cats"></div>');
        var limit = Math.min(6, cats.length);
        for(var i=0;i<limit;i++) {
          var row = $('<div class="year-cat-row"></div>');
          row.append($('<span class="year-cat-name"></span>').text(cats[i].name));
          row.append($('<span class="year-cat-hours"></span>').text((cats[i].sec / 3600.0).toFixed(2) + 'h'));
          list.append(row);
        }

        if(cats.length === 0) {
          list.append($('<div class="year-cat-row"></div>').text('No tracked categories'));
        }

        card.append(list);
        grid.append(card);
      });

      $("#yearsummary").append(grid);
    }

    function startSpinner() {
      // create a spinner object
      var target = document.getElementById('spinnerdiv');
      opts = {left:'30px', top:'40px', radius: 10, color: "#FFF" };
      var spinner = new Spinner(opts).spin(target);
    }
    function stopSpinner() {
      $("#spinnerdiv").empty();
    }

    var event_list;
    var events;
    function start() {
      if(window.location.protocol === 'file:') {
        showOverviewMessage(
          'Global Overview needs the Prolific local server. Open ' +
          '<a href="' + overviewPrimaryUrl + '">' + overviewPrimaryUrl + '</a> ' +
          'or ' +
          '<a href="' + overviewFallbackUrl + '">' + overviewFallbackUrl + '</a>.'
        );
        return;
      }
      
      loadAllEvents();

      $("#reloadbutton").click(function() {

        startSpinner();
        $.post("/refresh",
          {"time" : 0},
          function(data,status){
            console.log("Data: " + data + "\nStatus: " + status);
            stopSpinner();
            if(data === 'OK') {
              // everything went well, refresh current view
              loadAllEvents(); // reload all events
            }
        });
      });
    }

    
