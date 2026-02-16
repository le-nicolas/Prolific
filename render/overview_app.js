key_stats_all = []; // global

var overviewPrimaryUrl = "http://127.0.0.1:8080/overview.html";
var overviewFallbackUrl = "http://127.0.0.1:8090/overview.html";

var skipdraw = {};
var etypes = [];
var edur = []; // duration by day index -> {category: seconds}
var color_hash = {};
var event_list = [];
var events = [];

var year_stats = {};
var year_order = [];
var active_year = null;

function showOverviewMessage(html) {
  $("#graphopts").empty();
  $("#content").html('<div class="overview-msg">' + html + '</div>');
  $("#keysummary").empty();
  $("#timesummary").empty();
  $("#yearsummary").empty();
  $("#keystats").empty();
}

function mapEvents(es) {
  for(var i=0,N=es.length;i<N;i++) {
    var e = es[i];
    e.m = mapwin(e.s);
    if(etypes.indexOf(e.m) === -1) {
      etypes.push(e.m);
    }
    if(!skipdraw.hasOwnProperty(e.m)) {
      skipdraw[e.m] = false;
    }
  }
}

function statEvents(es, ecounts) {
  if(es.length === 0) return; // empty case

  var ixprev = 0;
  for(var i=1,N=es.length;i<N;i++) {
    var dt = es[i].t - es[ixprev].t;
    es[ixprev].dt = dt;
    var tmap = es[ixprev].m;
    if(ecounts.hasOwnProperty(tmap)) {
      ecounts[tmap] += dt;
    } else {
      ecounts[tmap] = 0;
    }
    ixprev = i;
  }
  es[N-1].dt = 1;
}

function analyzeEvents() {
  edur = [];
  etypes = [];

  for(var k=0;k<events.length;k++) {
    var es = events[k]["window_events"] || [];
    mapEvents(es);
  }

  color_hash = colorHashStrings(etypes);

  for(var q=0;q<events.length;q++) {
    edur.push({});
    var day_events = events[q]["window_events"] || [];
    statEvents(day_events, edur[q]);
  }
}

function sumDayDurations(day_dur) {
  var total = 0;
  if(!day_dur) return total;
  for(var cat in day_dur) {
    if(day_dur.hasOwnProperty(cat)) {
      total += day_dur[cat];
    }
  }
  return total;
}

function buildYearStats() {
  year_stats = {};
  year_order = [];

  var n = Math.min(event_list.length, events.length, edur.length);
  for(var k=0;k<n;k++) {
    var t0 = event_list[k].t0;
    if(!t0) continue;

    var year = new Date(t0 * 1000).getFullYear();
    if(!year_stats.hasOwnProperty(year)) {
      year_stats[year] = {
        year: year,
        indices: [],
        day_count: 0,
        total_seconds: 0,
        total_keys: 0
      };
      year_order.push(year);
    }

    var ys = year_stats[year];
    ys.indices.push(k);
    ys.day_count += 1;
    ys.total_seconds += sumDayDurations(edur[k]);

    var key_events = events[k]["keyfreq_events"] || [];
    for(var i=0;i<key_events.length;i++) {
      ys.total_keys += (key_events[i].s || 0);
    }
  }

  year_order = _.sortBy(year_order, function(y) { return y; });

  if(year_order.length === 0) {
    active_year = null;
    return;
  }

  if(active_year === null || !year_stats.hasOwnProperty(active_year)) {
    var best_year = year_order[0];
    var best_days = -1;
    for(var i=0;i<year_order.length;i++) {
      var y = year_order[i];
      var days = year_stats[y].day_count;
      if(days > best_days) {
        best_days = days;
        best_year = y;
      }
    }
    active_year = best_year;
  }
}

function categoryTotalsForIndices(indices) {
  var totals = {};
  for(var i=0;i<indices.length;i++) {
    var k = indices[i];
    var day_dur = edur[k] || {};
    for(var cat in day_dur) {
      if(day_dur.hasOwnProperty(cat)) {
        totals[cat] = (totals[cat] || 0) + day_dur[cat];
      }
    }
  }
  return totals;
}

function categoriesForIndices(indices) {
  var totals = categoryTotalsForIndices(indices);
  var cats = [];
  for(var cat in totals) {
    if(!totals.hasOwnProperty(cat)) continue;
    if(totals[cat] <= 0) continue;
    cats.push({name: cat, val: totals[cat]});
  }
  cats = _.sortBy(cats, "val").reverse();
  return _.pluck(cats, "name");
}

function renderYearControls() {
  $("#graphopts").empty();
  if(year_order.length === 0) return;

  var controls = $('<div class="year-controls"></div>');
  var years_desc = year_order.slice(0).reverse();
  _.each(years_desc, function(y) {
    var info = year_stats[y];
    var btn = $('<button type="button" class="year-chip"></button>');
    btn.text(y + " (" + info.day_count + "d)");
    if(y === active_year) {
      btn.addClass("active");
    }
    btn.click(function() {
      active_year = y;
      drawYearlyOverview();
    });
    controls.append(btn);
  });

  var info_active = year_stats[active_year];
  var meta = $('<p class="year-viewing"></p>');
  if(info_active) {
    meta.text(
      "Viewing " + active_year +
      ": " + info_active.day_count + " days, " +
      (info_active.total_seconds / 3600.0).toFixed(2) + " hours tracked"
    );
  }

  $("#graphopts").append(controls).append(meta);
}

function renderYearSummaryCards() {
  $("#yearsummary").empty();

  if(year_order.length === 0) {
    $("#yearsummary").html('<div class="overview-msg">No yearly data yet.</div>');
    return;
  }

  var years_desc = year_order.slice(0).reverse();
  var max_total = _.max(_.map(years_desc, function(y) {
    return year_stats[y].total_seconds;
  }));
  max_total = Math.max(1, max_total);

  var grid = $('<div class="year-grid"></div>');

  _.each(years_desc, function(y) {
    var info = year_stats[y];
    var avg_keys = info.day_count > 0 ? Math.floor(info.total_keys / info.day_count) : 0;

    var card = $('<article class="year-card"></article>');
    if(y === active_year) {
      card.addClass("active");
    }

    var head = $('<div class="year-head"></div>');
    head.append($('<h3 class="year-title"></h3>').text(y));
    head.append($('<p class="year-total"></p>').text((info.total_seconds / 3600.0).toFixed(2) + " hr"));
    card.append(head);

    card.append(
      $('<p class="year-meta"></p>').text(
        info.total_keys + " keys in " + info.day_count + " days (" + avg_keys + "/day)"
      )
    );

    var track = $('<div class="year-track"><div class="year-fill"></div></div>');
    track.find(".year-fill").css("width", (100 * info.total_seconds / max_total).toFixed(2) + "%");
    card.append(track);

    card.click(function() {
      active_year = y;
      drawYearlyOverview();
    });

    grid.append(card);
  });

  $("#yearsummary").append(grid);
}

function drawEventsForYear(year) {
  $("#content").empty();

  var info = year_stats[year];
  if(!info || info.indices.length === 0) {
    $("#content").html('<div class="overview-msg">No days for this year.</div>');
    return;
  }

  var indices = info.indices;
  var days = _.map(indices, function(ix) { return event_list[ix]; });
  var local_edur = _.map(indices, function(ix) { return edur[ix] || {}; });
  var local_categories = categoriesForIndices(indices);

  if(local_categories.length === 0) {
    $("#content").html('<div class="overview-msg">No mapped activity categories for this year.</div>');
    return;
  }

  var d3div = d3.select("#content");
  var ldiv = d3div.append("div").attr("class", "legenddiv");

  for(var i=0;i<local_categories.length;i++) {
    var cat = local_categories[i];
    var pi = ldiv.append("p").text(cat).attr("style", "color:" + color_hash[cat]);

    if(skipdraw[cat]) { pi.attr("class", "skipdrawyes"); }
    else { pi.attr("class", "skipdrawno"); }

    pi.on("click", function(m) {
      return function() {
        skipdraw[m] = !skipdraw[m];
        drawEventsForYear(active_year);
      };
    }(cat));
  }

  var margin = {top: 10, right: 10, bottom: 100, left: 42};
  var N = local_edur.length;
  var fullwidth = Math.max(1200, N * 14 + margin.left + margin.right + 40);
  var fullheight = 800;
  var width = fullwidth - margin.left - margin.right;
  var height = fullheight - margin.top - margin.bottom;
  var svg = d3div.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  var yscale = 0.008;

  var yoff = 0;
  var yn = 0;
  while(yoff < height) {
    var yy = (height + margin.top - yoff);
    svg.append("text")
      .attr("transform", "translate(1," + (yy-3) + ")")
      .attr("fill", "#d8c6b5")
      .text(yn + "hr");

    svg.append("line")
      .attr("x1", 0)
      .attr("x2", width + margin.left)
      .attr("y1", yy)
      .attr("y2", yy)
      .attr("stroke", "rgba(255,255,255,0.15)")
      .attr("stroke-width", 1);

    yn++;
    yoff += 3600 * yscale;
  }

  var dsz = N > 0 ? width / N : width;
  svg.selectAll(".xlabel")
    .data(days)
    .enter()
    .append("text")
    .attr("transform", function(d, i) {
      var x = margin.left + i * dsz;
      var y = height + margin.top + 3;
      return "translate(" + x + "," + y + ")rotate(90)";
    })
    .attr("fill", "#cab8a7")
    .attr("font-family", "'Lato', sans-serif")
    .attr("font-size", "12px")
    .text(function(d) {
      return ppDateShort(new Date(d.t0 * 1000));
    });

  svg.selectAll(".yd")
    .data(days)
    .enter()
    .append("line")
    .attr("stroke", function(d) {
      var dobj = new Date(d.t0 * 1000);
      return dobj.getDay() === 1 ? "rgba(255,185,120,0.55)" : "rgba(255,255,255,0.1)";
    })
    .attr("x1", function(d, i) { return margin.left + i * dsz; })
    .attr("x2", function(d, i) { return margin.left + i * dsz; })
    .attr("y1", height + margin.top)
    .attr("y2", margin.top);

  for(var k=0;k<N;k++) {
    var dtimes = [];
    for(var q=0;q<local_categories.length;q++) {
      var m = local_categories[q];
      if(skipdraw[m]) continue;
      dtimes.push({
        val: local_edur[k].hasOwnProperty(m) ? local_edur[k][m] : 0,
        col: color_hash[m]
      });
    }

    var day_ix = indices[k];
    var svgg = svg.append("g")
      .attr("style", "cursor:pointer;")
      .on("click", function(day_index) {
        return function() {
          window.location.href = "day.html?gotoday=" + day_index;
        };
      }(day_ix));

    var gh = 0;
    svgg.selectAll(".day" + k)
      .data(dtimes)
      .enter()
      .append("rect")
      .attr("width", dsz)
      .attr("height", function(d) { return d.val * yscale; })
      .attr("x", margin.left + k * dsz)
      .attr("y", function(d) {
        gh += d.val;
        return height + margin.top - gh * yscale;
      })
      .attr("fill", function(d) { return d.col; });
  }
}

function mergeWindowKeyEventsForIndices(indices) {
  var key_stats_out = [];
  for(var i=0;i<indices.length;i++) {
    var k = indices[i];
    var es = events[k]["window_events"] || [];
    var ek = events[k]["keyfreq_events"] || [];
    key_stats_out.push(computeKeyStats(es, ek));
  }
  return key_stats_out;
}

function visualizeKeySummaryForYear(indices, local_categories) {
  $("#keysummary").empty();

  if(indices.length === 0 || local_categories.length === 0) {
    $("#keysummary").html('<div class="overview-msg">No key summary for this year.</div>');
    return;
  }

  key_stats_all = mergeWindowKeyEventsForIndices(indices);

  var gstats = {};
  _.each(local_categories, function(m) {
    gstats[m] = {name: m, val: 0, n: 0, col: color_hash[m]};
  });

  for(var i=0;i<key_stats_all.length;i++) {
    var key_stats = key_stats_all[i];
    for(var j=0;j<local_categories.length;j++) {
      var cat = local_categories[j];
      if(key_stats.hasOwnProperty(cat)) {
        gstats[cat].val += key_stats[cat].f;
        gstats[cat].n += key_stats[cat].n;
      }
    }
  }

  var arr = _.values(gstats);
  arr = _.filter(arr, function(d) { return d.val > 0; });
  _.each(arr, function(d) {
    var rate = d.n > 0 ? (d.val/(d.n*9)).toFixed(2) : "0.00";
    d.text = d.val + " (" + rate + "/s) (" + d.name + ")";
  });
  arr = _.sortBy(arr, "val").reverse();

  if(arr.length === 0) {
    $("#keysummary").html('<div class="overview-msg">No keystrokes recorded in this year.</div>');
    return;
  }

  var chart_data = {
    width: 600,
    barheight: 30,
    textpad: 300,
    textmargin: 10,
    title: "total keys per window (" + active_year + ")",
    data: arr
  };
  d3utils.drawHorizontalBarChart(d3.select("#keysummary"), chart_data);
}

function visualizeTimeSummaryForYear(indices, local_categories) {
  $("#timesummary").empty();

  if(indices.length === 0 || local_categories.length === 0) {
    $("#timesummary").html('<div class="overview-msg">No time summary for this year.</div>');
    return;
  }

  var totals = {};
  _.each(local_categories, function(m) {
    totals[m] = {name: m, val: 0, col: color_hash[m]};
  });

  for(var i=0;i<indices.length;i++) {
    var day_ix = indices[i];
    var day_stats = edur[day_ix] || {};
    for(var j=0;j<local_categories.length;j++) {
      var cat = local_categories[j];
      if(day_stats.hasOwnProperty(cat)) {
        totals[cat].val += day_stats[cat];
      }
    }
  }

  var arr = _.values(totals);
  arr = _.filter(arr, function(d) { return d.val > 0; });
  _.each(arr, function(d) { d.text = (d.val/3600.0).toFixed(2) + "hr (" + d.name + ")"; });
  arr = _.sortBy(arr, "val").reverse();

  if(arr.length === 0) {
    $("#timesummary").html('<div class="overview-msg">No window-time data in this year.</div>');
    return;
  }

  var chart_data = {
    width: 600,
    barheight: 30,
    textpad: 300,
    textmargin: 10,
    title: "total time per window (" + active_year + ")",
    data: arr
  };
  d3utils.drawHorizontalBarChart(d3.select("#timesummary"), chart_data);
}

function drawKeyEventsForYear(year) {
  $("#keystats").empty();

  var info = year_stats[year];
  if(!info || info.indices.length === 0) {
    $("#keystats").html('<div class="overview-msg">No key data for this year.</div>');
    return;
  }

  var W = $("#keystats").width();
  if(!W || W < 300) { W = 1200; }
  var H = 15;
  var wmargin = 100;
  var time_bin = 10 * 60;

  var allkevents = [];
  var d0s = [];
  var ktots = [];
  var maxs = 0;
  var maxktot = 0;
  var kevents_global = [];
  var max_kevents_global = 0;
  var sum_kevents_global = 0;

  for(var i=0;i<info.indices.length;i++) {
    var day_ix = info.indices[i];
    var es = events[day_ix]["keyfreq_events"] || [];

    var t00 = event_list[day_ix].t0;
    var d0 = new Date(t00 * 1000);
    var ft = t00 + 60*60*24;
    var kevents = [];
    var t = t00;
    while(t <= ft) {
      kevents.push(0);
      t += time_bin;
      if(i === 0) {
        kevents_global.push(0);
      }
    }

    var ktot = 0;
    for(var q=0,n=es.length;q<n;q++) {
      var kw = es[q];
      var binix = Math.floor((kw.t - t00)/time_bin);
      if(binix < 0 || binix >= kevents.length) continue;

      kevents[binix] += kw.s;
      kevents_global[binix] += kw.s;
      if(kevents[binix] > maxs) maxs = kevents[binix];
      if(kevents_global[binix] > max_kevents_global) max_kevents_global = kevents_global[binix];
      sum_kevents_global += kw.s;
      ktot += kw.s;
    }

    allkevents.push(kevents);
    d0s.push(d0);
    ktots.push(ktot);
    if(ktot > maxktot) maxktot = ktot;
  }

  maxs = Math.max(1, maxs);
  maxktot = Math.max(1, maxktot);
  max_kevents_global = Math.max(1, max_kevents_global);

  var sx = kevents_global.length;
  var bar_width = (W - wmargin) / sx;
  var div = d3.select("#keystats").append("div");
  var svg = div.append("svg")
    .attr("width", W)
    .attr("height", H * 2);
  var line = d3.svg.line()
    .x(function(d, i2) { return (W - 2*wmargin) * i2 / sx + wmargin; })
    .y(function(d) { return 2*H - d / max_kevents_global * H * 2; });
  svg.append("path")
    .datum(kevents_global)
    .attr("class", "line")
    .attr("d", line);

  div = d3.select("#keystats").append("div");
  svg = div.append("svg")
    .attr("width", W)
    .attr("height", 20);
  for(var hr=0;hr<24;hr++) {
    svg.append("text")
      .attr("font-size", 14)
      .attr("font-family", "arial")
      .attr("transform", "translate(" + (hr/24*(W-2*wmargin)+2+wmargin) + ",16)")
      .text(((hr + 7) % 24) + ":00");

    svg.append("line")
      .attr("x1", hr/24*(W-2*wmargin)+wmargin)
      .attr("x2", hr/24*(W-2*wmargin)+wmargin)
      .attr("y1", 0)
      .attr("y2", 20)
      .attr("stroke", "#000")
      .attr("stroke-width", 2);
  }

  for(var k=0;k<allkevents.length;k++) {
    var kevents = allkevents[k];
    div = d3.select("#keystats").append("div").attr("class", "divkeys");

    svg = div.append("svg")
      .attr("width", W)
      .attr("height", H);
    sx = kevents.length;

    svg.selectAll(".ke")
      .data(kevents)
      .enter()
      .append("rect")
      .attr("x", function(d, i3) { return (W - 2*wmargin) * i3 / sx + wmargin; })
      .attr("width", bar_width)
      .attr("y", 0)
      .attr("height", H)
      .attr("fill", function(d) {
        var e = d / maxs;
        var r = Math.floor(Math.max(0, 255 - e*255));
        var g = Math.floor(Math.max(0, 255 - e*255));
        var b = 255;
        return "rgb(" + r + "," + g + "," + b + ")";
      });

    svg.append("text")
      .attr("font-size", 14)
      .attr("transform", "translate(0,12)")
      .attr("font-family", "arial")
      .text(ppDateShort(d0s[k]));

    svg.append("rect")
      .attr("x", W - wmargin + 5)
      .attr("y", 0)
      .attr("width", ktots[k] / maxktot * wmargin)
      .attr("height", H)
      .attr("fill", "rgb(255, 100, 100)");

    svg.append("text")
      .attr("transform", "translate(" + (W - wmargin + 7) + ",13)")
      .attr("font-size", 14)
      .attr("font-family", "arial")
      .text(ktots[k]);
  }

  var avg = info.day_count > 0 ? Math.floor(sum_kevents_global / info.day_count) : 0;
  d3.select("#keystats")
    .append("p")
    .attr("class", "al")
    .text("total keys pressed: " + sum_kevents_global + " in " + info.day_count + " days (" + avg + " per day average)");
}

function drawYearlyOverview() {
  if(active_year === null || !year_stats.hasOwnProperty(active_year)) {
    showOverviewMessage("No yearly data yet. Click <b>Refresh Data</b> after tracking for a bit.");
    return;
  }

  renderYearControls();
  renderYearSummaryCards();
  drawEventsForYear(active_year);

  var indices = year_stats[active_year].indices || [];
  var local_categories = categoriesForIndices(indices);
  visualizeKeySummaryForYear(indices, local_categories);
  visualizeTimeSummaryForYear(indices, local_categories);

  try {
    drawKeyEventsForYear(active_year);
  } catch (err) {
    console.log("drawKeyEventsForYear failed: " + err);
  }
}

function loadAllEvents() {
  var loaded_ok = false;

  getJSON_CACHEHACK("export_list.json").then(function(days_list) {
    event_list = days_list || [];
    return Promise.all(event_list.map(function(x) { return getJSON_CACHEHACK(x.fname); }));
  }).then(function(days) {
    events = days || [];
    loaded_ok = true;
  }).catch(function(err) {
    console.log("some error happened: " + err);
    var msg = "Global Overview could not load data. ";
    if(window.location.protocol === "file:") {
      msg += "Open it from the local server instead: ";
      msg += '<a href="' + overviewPrimaryUrl + '">:8080</a> or ';
      msg += '<a href="' + overviewFallbackUrl + '">:8090</a>.';
    } else {
      msg += "Try refreshing, then open via ";
      msg += '<a href="' + overviewPrimaryUrl + '">:8080</a> or ';
      msg += '<a href="' + overviewFallbackUrl + '">:8090</a>.';
    }
    showOverviewMessage(msg);
  }).then(function() {
    if(!loaded_ok) return;

    if(!event_list || event_list.length === 0) {
      showOverviewMessage("No exported days yet. Click <b>Refresh Data</b> after tracking for a bit.");
      return;
    }

    analyzeEvents();
    buildYearStats();
    drawYearlyOverview();
  });
}

function startSpinner() {
  var target = document.getElementById("spinnerdiv");
  opts = {left: "30px", top: "40px", radius: 10, color: "#FFF"};
  var spinner = new Spinner(opts).spin(target);
}

function stopSpinner() {
  $("#spinnerdiv").empty();
}

function start() {
  if(window.location.protocol === "file:") {
    showOverviewMessage(
      "Global Overview needs the Prolific local server. Open " +
      '<a href="' + overviewPrimaryUrl + '">' + overviewPrimaryUrl + "</a> or " +
      '<a href="' + overviewFallbackUrl + '">' + overviewFallbackUrl + "</a>."
    );
    return;
  }

  loadAllEvents();

  $("#reloadbutton").click(function() {
    startSpinner();
    $.post("/refresh", {"time": 0}, function(data, status) {
      console.log("Data: " + data + "\nStatus: " + status);
      stopSpinner();
      if(data === "OK") {
        loadAllEvents();
      }
    });
  });
}
