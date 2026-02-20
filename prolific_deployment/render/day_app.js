    // GLOBALS
    var color_hash = {}; // mapped titles -> hsl color to draw with
    var t00; // initial time for a day (time first event began)
    var ft; // final time for a day (time last event ended)
    var ecounts = {};
    var etypes = [];
    var hacking_stats = {};
    var focus_stats = {};
    var coffee_events = [];
    var COFFEE_DAILY_LIMIT = 3;
    var COFFEE_DEFAULT_MG = 100;
    var COFFEE_HALF_LIFE_SECONDS = 5 * 3600;
    var COFFEE_SPACING_SECONDS = 3 * 3600;
    var COFFEE_SLEEP_BUFFER_SECONDS = 8 * 3600;

    // renders pie chart showing distribution of time spent into #piechart
    function createPieChart(es, etypes) {

      // count up the total amount of time spent in all windows
      var dtall = 0;
      var counts = {};
      _.each(es, function(e){ 
        counts[e.m] = (counts[e.m] || 0) + e.dt; 
        dtall += e.dt; 
      });
      var stats = _.map(etypes, function(m) {
        return {val: counts[m], 
                name: m + " (" + (100*counts[m]/dtall).toFixed(1) + "%)", 
                col: color_hash[m]
               };
      });

      // create a pie chart with d3
      var chart_data = {};
      chart_data.width = $(window).width();
      chart_data.height = 500;
      chart_data.title = "Total Time: " + strTimeDelta(dtall);
      chart_data.data = stats;
      d3utils.drawPieChart(d3.select('#piechart'), chart_data);
    }

    // creates the main barcode time visualization for all mapped window titles
    function visualizeEvents(es) {
      $("#eventvis").empty();
      _.each(display_groups, function(x) { visualizeEvent(es, x); })
    }

    // uses global variable hacking_events as input. Must be set
    // and global total_hacking_time as well.
    function visualizeHackingTimes(hacking_stats) {
      $("#hackingvis").empty();
      if(!draw_hacking) return; // global set in render_settings.js

      var c = "rgb(200,0,0)"; // color

      var div = d3.select("#hackingvis").append("div");
      div.append("p").attr("class", "tt").attr("style", "color:"+c).text("Hacking Streak");
      var txt = strTimeDelta(hacking_stats.total_hacking_time);
      txt += " (total keys = " + hacking_stats.total_hacking_keys + ")";
      div.append("p").attr("class", "td").text(txt);

      var W = $(window).width() - 40;
      var svg = div.append("svg")
      .attr("width", W)
      .attr("height", 30);

      var sx = (ft-t00) / W;
      var g = svg.selectAll(".h")
        .data(hacking_stats.events)
        .enter().append("g")
        .attr("class", "h")
        .on("mouseover", function(d){return tooltip.style("visibility", "visible").text(strTimeDelta(d.dt));})
        .on("mousemove", function(){return tooltip.style("top", (event.pageY-10)+"px").style("left",(event.pageX+10)+"px");})
        .on("mouseout", function(){return tooltip.style("visibility", "hidden");});

      g.append("rect")
        .attr("x", function(d) { return (d.t0-t00)/sx; } )
        .attr("width", function(d) { return d.dt/sx; } )
        .attr("y", function(d) {return 30-10*d.intensity} )
        .attr("height", function(d) {return 10*d.intensity; })
        .attr("fill", function(d) { return c; });
    }

    function computeFocusTaxStats(es) {
      var passive_titles = (typeof passive_hacking_titles !== 'undefined') ? passive_hacking_titles : [];
      var deep_titles = {};
      for(var i=0;i<hacking_titles.length;i++) { deep_titles[hacking_titles[i]] = true; }
      for(var j=0;j<passive_titles.length;j++) { deep_titles[passive_titles[j]] = true; }

      var ignored_titles = {
        "Idle": true,
        "Locked Screen": true,
        "Task Switching": true,
      };

      var seq = [];
      for(var q=0,N=es.length;q<N;q++) {
        var e = es[q];
        if(!e || !e.m || !e.dt || e.dt <= 0) continue;
        if(ignored_titles[e.m]) continue;
        seq.push({m: e.m, dt: e.dt});
      }

      var active_seconds = 0;
      var counts = {};
      var short_hops = 0;
      var deep_blocks = 0;
      for(var a=0;a<seq.length;a++) {
        var s = seq[a];
        active_seconds += s.dt;
        counts[s.m] = (counts[s.m] || 0) + s.dt;
        if(s.dt < 120) short_hops++;
        if(s.dt >= 1500) deep_blocks++;
      }

      var switches = 0;
      var tax_seconds = 0;
      var last_switch_ix = -999;
      for(var b=1;b<seq.length;b++) {
        var prev = seq[b-1];
        var cur = seq[b];
        if(prev.m === cur.m) continue;

        switches++;
        var penalty = 30;
        penalty += 0.15 * Math.min(prev.dt, 600);
        penalty += 0.15 * Math.min(cur.dt, 600);
        if(deep_titles[prev.m] || deep_titles[cur.m]) {
          penalty += 20;
        }
        if((b - last_switch_ix) <= 2) {
          penalty += 15; // clustered switching is extra expensive
        }
        tax_seconds += penalty;
        last_switch_ix = b;
      }

      if(active_seconds > 0) {
        tax_seconds = Math.min(tax_seconds, active_seconds * 0.5);
      }

      var cats = _.keys(counts);
      var entropy = 0.0;
      for(var c=0;c<cats.length;c++) {
        var p = counts[cats[c]] / Math.max(1, active_seconds);
        if(p > 0) {
          entropy += -p * (Math.log(p) / Math.log(2));
        }
      }
      var max_entropy = cats.length > 1 ? (Math.log(cats.length) / Math.log(2)) : 1.0;
      var coherence = 100;
      if(cats.length > 1) {
        coherence = Math.max(0, Math.min(100, Math.round(100 * (1.0 - entropy / max_entropy))));
      }

      var tax_pct = active_seconds > 0 ? (100.0 * tax_seconds / active_seconds) : 0;

      return {
        active_seconds: active_seconds,
        tax_seconds: Math.round(tax_seconds),
        tax_pct: tax_pct,
        coherence: coherence,
        switches: switches,
        short_hops: short_hops,
        deep_blocks: deep_blocks,
      };
    }

    function focusTipForStats(stats) {
      if(stats.active_seconds <= 0) {
        return "Not enough active data yet for a focus estimate.";
      }
      if(stats.coherence >= 80 && stats.switches <= 8) {
        return "Flow looked stable. Protect this day pattern.";
      }
      if(stats.short_hops >= 18) {
        return "High micro-switching. Try batching similar tasks into longer blocks.";
      }
      if(stats.tax_pct >= 22) {
        return "Hidden context tax is high. Reduce app/category switching during deep work windows.";
      }
      if(stats.deep_blocks <= 1) {
        return "Few deep blocks. Aim for 2+ sessions of 25 minutes or more.";
      }
      return "Good baseline. Push coherence up by reducing non-essential switches.";
    }

    function visualizeFocusMeter(stats) {
      $("#focusmeter").empty();

      var div = d3.select("#focusmeter").append("div");
      div.append("p").attr("class", "focus-label").text("Attention Residue");
      div.append("p").attr("class", "focus-tax").text("Hidden Focus Tax: " + strTimeDelta(stats.tax_seconds));

      var score_row = div.append("div").attr("class", "focus-score-row");
      score_row.append("p").attr("class", "focus-meta").text("Coherence");
      score_row.append("p").attr("class", "focus-score").text(stats.coherence + "/100");

      var track = div.append("div").attr("class", "focus-track");
      track.append("div")
        .attr("class", "focus-fill")
        .style("width", stats.coherence + "%");

      var meta = "";
      meta += "Switches: " + stats.switches + " | ";
      meta += "Rapid hops (<2m): " + stats.short_hops + " | ";
      meta += "Deep blocks (>=25m): " + stats.deep_blocks + "<br>";
      meta += "Estimated residue: " + stats.tax_pct.toFixed(1) + "% of active time";
      div.append("p").attr("class", "focus-meta").html(meta);

      div.append("p").attr("class", "focus-tip").text(focusTipForStats(stats));
    }

    function pad2(x) {
      return x < 10 ? ("0" + x) : ("" + x);
    }

    function formatClockTime(ts) {
      var d = new Date(ts * 1000);
      var h = d.getHours();
      var m = d.getMinutes();
      var h12 = h % 12;
      if(h12 === 0) h12 = 12;
      return h12 + ":" + pad2(m) + (h >= 12 ? " PM" : " AM");
    }

    function getSleepClockSetting() {
      var fallback = "23:00";
      try {
        var saved = window.localStorage.getItem("coffee_sleep_clock");
        if(saved && /^\d{2}:\d{2}$/.test(saved)) {
          return saved;
        }
      } catch(err) {}
      return fallback;
    }

    function setSleepClockSetting(clock) {
      if(!clock || !/^\d{2}:\d{2}$/.test(clock)) return;
      try {
        window.localStorage.setItem("coffee_sleep_clock", clock);
      } catch(err) {}
    }

    function parseSleepTime(day_t0, clock) {
      var parts = (clock || "23:00").split(":");
      var hh = parseInt(parts[0], 10);
      var mm = parseInt(parts[1], 10);
      if(isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        hh = 23;
        mm = 0;
      }

      var d = new Date(day_t0 * 1000);
      d.setHours(hh, mm, 0, 0);
      var ts = Math.floor(d.getTime() / 1000);
      if(ts < day_t0) ts += 86400;
      return ts;
    }

    function normalizeCoffeeEvents(es) {
      var xs = _.map(es || [], function(e) {
        var t = parseInt(e.t, 10);
        var mg = parseInt(e.mg, 10);
        if(isNaN(t) || isNaN(mg) || mg <= 0) return null;
        return {t: t, mg: mg};
      });
      return _.sortBy(_.filter(xs, function(x) { return x !== null; }), "t");
    }

    function estimateCaffeineAt(coffees, t) {
      var total = 0.0;
      _.each(coffees, function(c) {
        if(c.t > t) return;
        var age = Math.max(0, t - c.t);
        total += c.mg * Math.pow(0.5, age / COFFEE_HALF_LIFE_SECONDS);
      });
      return total;
    }

    function buildCoffeePlan(daylog, coffees, sleepClock, nowTs) {
      var cups_taken = coffees.length;
      var cups_left = Math.max(0, COFFEE_DAILY_LIMIT - cups_taken);
      var sleep_ts = parseSleepTime(daylog.t0, sleepClock);
      var cutoff_ts = sleep_ts - COFFEE_SLEEP_BUFFER_SECONDS;
      var last_coffee_ts = cups_taken > 0 ? coffees[cups_taken - 1].t : null;
      var earliest_next_ts = nowTs;
      if(last_coffee_ts !== null) {
        earliest_next_ts = Math.max(earliest_next_ts, last_coffee_ts + COFFEE_SPACING_SECONDS);
      }

      var next_slots = [];
      var slot_ts = earliest_next_ts;
      for(var i=0; i<cups_left; i++) {
        if(slot_ts > cutoff_ts) break;
        next_slots.push(slot_ts);
        slot_ts += COFFEE_SPACING_SECONDS;
      }

      return {
        cups_taken: cups_taken,
        cups_left: cups_left,
        sleep_ts: sleep_ts,
        cutoff_ts: cutoff_ts,
        now_ts: nowTs,
        next_slots: next_slots,
        caffeine_now_mg: estimateCaffeineAt(coffees, nowTs),
        caffeine_bedtime_mg: estimateCaffeineAt(coffees, sleep_ts),
      };
    }

    function coffeeAdviceForPlan(plan, is_today) {
      if(!is_today) {
        return "Viewing a historical day. Logging is enabled only for the current day.";
      }

      var lines = [];
      if(plan.cups_taken >= COFFEE_DAILY_LIMIT) {
        lines.push("Daily cap reached (3/3). Skip more caffeine today to protect sleep.");
      } else if(plan.next_slots.length === 0) {
        if(plan.now_ts > plan.cutoff_ts) {
          lines.push("You are inside the no-caffeine window before sleep. Skip the next cup today.");
        } else {
          lines.push("Not enough time remains before your sleep cutoff for another full coffee window.");
        }
      } else {
        var next_two = _.map(plan.next_slots.slice(0, 2), function(ts, idx) {
          return "Cup " + (plan.cups_taken + idx + 1) + ": around " + formatClockTime(ts);
        });
        lines.push(next_two.join(" | "));
      }

      lines.push("Sleep-protection caffeine cutoff: " + formatClockTime(plan.cutoff_ts) + " (~8h before target sleep).");
      if(plan.caffeine_bedtime_mg >= 30) {
        lines.push("Estimated bedtime circulating caffeine is still elevated (" + Math.round(plan.caffeine_bedtime_mg) + " mg).");
      }

      return lines.join("<br>");
    }

    function visualizeCoffeeAdvisor(daylog, raw_coffee_events) {
      $("#coffeemeter").empty();

      var now_ts = Math.floor(Date.now() / 1000);
      var is_today = (now_ts >= daylog.t0 && now_ts < daylog.t1);
      var effective_now_ts = is_today ? now_ts : (daylog.t1 - 1);
      var sleep_clock = getSleepClockSetting();
      var coffees = normalizeCoffeeEvents(raw_coffee_events);
      var plan = buildCoffeePlan(daylog, coffees, sleep_clock, effective_now_ts);

      var div = d3.select("#coffeemeter").append("div");
      div.append("p").attr("class", "focus-label").text("Coffee + Sleep Advisor");
      div.append("p").attr("class", "coffee-total").text("Cups logged: " + plan.cups_taken + "/" + COFFEE_DAILY_LIMIT);
      div.append("p").attr("class", "coffee-meta").text("Estimated caffeine now: " + Math.round(plan.caffeine_now_mg) + " mg");
      div.append("p").attr("class", "coffee-meta").text("Estimated at bedtime (" + sleep_clock + "): " + Math.round(plan.caffeine_bedtime_mg) + " mg");

      var controls = div.append("div").attr("class", "coffee-controls");
      controls.append("label").attr("class", "coffee-input-label").attr("for", "coffee-mg").text("Cup mg");
      var mg_select = controls.append("select").attr("id", "coffee-mg").attr("class", "coffee-select");
      _.each([80, 100, 120, 150], function(mg) {
        mg_select.append("option").attr("value", mg).text(mg + " mg");
      });
      mg_select.property("value", COFFEE_DEFAULT_MG);

      controls.append("label").attr("class", "coffee-input-label").attr("for", "coffee-sleep-time").text("Target sleep");
      controls.append("input")
        .attr("id", "coffee-sleep-time")
        .attr("class", "coffee-time-input")
        .attr("type", "time")
        .property("value", sleep_clock);

      var add_btn = controls.append("button")
        .attr("id", "coffee-add")
        .attr("type", "button")
        .text("I had coffee");

      var add_disabled = (!is_today || plan.cups_taken >= COFFEE_DAILY_LIMIT);
      if(add_disabled) add_btn.attr("disabled", true);

      div.append("p").attr("class", "coffee-tip").html(coffeeAdviceForPlan(plan, is_today));

      var list = div.append("div").attr("class", "coffee-list");
      if(coffees.length === 0) {
        list.append("p").attr("class", "coffee-meta").text("No coffee logged for this day.");
      } else {
        _.each(coffees, function(c, idx) {
          list.append("p")
            .attr("class", "coffee-entry")
            .text("Cup " + (idx + 1) + ": " + formatClockTime(c.t) + " (" + c.mg + " mg)");
        });
      }

      var sources = div.append("div").attr("class", "coffee-sources");
      sources.append("p")
        .attr("class", "coffee-source")
        .html('Evidence: <a href="https://pubmed.ncbi.nlm.nih.gov/24235903/" target="_blank" rel="noopener noreferrer">J Clin Sleep Med (2013)</a>, <a href="https://pubmed.ncbi.nlm.nih.gov/36870101/" target="_blank" rel="noopener noreferrer">Sleep Med Rev (2023)</a>, <a href="https://pubmed.ncbi.nlm.nih.gov/25175972/" target="_blank" rel="noopener noreferrer">Adenosine review (2014)</a>, <a href="https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much" target="_blank" rel="noopener noreferrer">FDA caffeine guidance</a>');

      $("#coffee-sleep-time").off("change").on("change", function() {
        setSleepClockSetting($(this).val());
        visualizeCoffeeAdvisor(daylog, coffees);
      });

      $("#coffee-add").off("click").on("click", function() {
        if(add_disabled) return;
        var mg = parseInt($("#coffee-mg").val(), 10);
        if(isNaN(mg) || mg <= 0) {
          mg = COFFEE_DEFAULT_MG;
        }

        startSpinner();
        $.ajax({
          url: "/addcoffee",
          type: "POST",
          data: {"time": Math.floor(Date.now() / 1000), "mg": mg},
          success: function(data, status) {
            console.log("Data: " + data + "\\nStatus: " + status);
            stopSpinner();
            fetchAndLoadEvents(event_list[cur_event_id]);
          },
          error: function(xhr) {
            stopSpinner();
            var msg = xhr && xhr.responseText ? xhr.responseText : "Unable to log coffee.";
            alert(msg);
            fetchAndLoadEvents(event_list[cur_event_id]);
          }
        });
      });
    }

    // number of keys pressed in every window type visualization
    function visualizeKeyStats(key_stats, etypes) {
      $("#keystats").empty();

      // format input for d3
      var stats = _.map(etypes, function(m) { 
        return {
          name: m,
          val: key_stats.hasOwnProperty(m) ? key_stats[m].f : 0,
          col: color_hash[m],
        };
      });
      stats = _.filter(stats, function(d) { return d.val > 60 }); // cutoff at 1 minute
      _.each(stats, function(d) { 
        var fn = (d.val / (key_stats[d.name].n * 9.0)).toFixed(2); 
        d.text = d.val + ' (' + fn + '/s) ' + d.name;
      });
      stats = _.sortBy(stats, 'val').reverse();

      // visualize as horizontal bars with d3
      var chart_data = {};
      chart_data.width = 700;
      chart_data.barheight = 30;
      chart_data.textpad = 300;
      chart_data.textmargin = 10;
      chart_data.title = "Total number of key strokes";
      chart_data.data = stats;
      d3utils.drawHorizontalBarChart(d3.select('#keystats'), chart_data);
    }

    // simple plot of key frequencies over time
    function visualizeKeyFreq(es) {
      $("#keygraph").empty();

      var W = $(window).width() - 40;

      var div = d3.select("#keygraph").append("div");
      var svg = div.append("svg")
      .attr("width", "100%")
      .attr("height", 100);

      var sx = (ft-t00) / W;
      var line = d3.svg.line()
        .x(function(d) { return (d.t -t00) / sx; })
        .y(function(d) { return 100 - d.s; });

      svg.append("path")
        .datum(es)
        .attr("class", "line")
        .attr("d", line);

      div.append("p").attr("class", "al").text("keystroke frequency");
    }

    function visualizeNotes(es) {
      console.log('number of notes:' + es.length);
      $("#notesvis").empty();
      if(!draw_notes) return; // draw_notes is set in render_settings.js
      var coffees = _.map(normalizeCoffeeEvents(coffee_events), function(c) { return c.t - t00; });
      if(es.length === 0 && coffees.length === 0) return; // nothing to do here...

      var dts= [];
      for(var i=0,N=es.length;i<N;i++) {
        var e = es[i];
        var d = {};
        d.x = e.t-t00;
        d.s = e.s;
        if(e.s.indexOf("coffee")>-1) {
          // we had coffee
          coffees.push(e.t-t00);
        }
        dts.push(d);
      }

      console.log('drawing ' + dts.length + ' notes.');
      var div = d3.select("#notesvis").append("div");
      div.append("p").attr("class", "tt").attr("style", "color: #964B00").text("Notes");
      var W = $(window).width() - 40;
      var svg = div.append("svg")
      .attr("width", W)
      .attr("height", 70);

      var sx = (ft-t00) / W;

      // Draw coffee. Overlay
      // draw_coffee is set in render_settings.js
      if(draw_coffee) {
        var coffex = [];
        var nc = coffees.length;
        var alpha = Math.log(2)/20520; // 20,520 is half life of coffee, in seconds. Roughly 6 hours
        for(var i=0;i<100;i++) {
          there = i*(ft-t00)/100.0;
          // coffee is assumed to add linearly in the body
          var amount = 0;
          for(var j=0;j<nc;j++) {
            if(there > coffees[j]) {
              amount += Math.exp(-alpha*(there - coffees[j]));
            }
          }
          coffex.push({t:there, a:30*amount}); // scale is roughly 30px = 150mg coffee, for now
        }
        var cdx = (ft - t00)/100.0;
        var g = svg.selectAll(".c")
          .data(coffex)
          .enter()
          .append("rect")
          .attr("width", cdx/sx)
          .attr("x", function(d){ return d.t/sx; })
          .attr("y", function(d){ return 50-d.a; })
          .attr("height", function(d){ return d.a; })
          .attr("fill", "#E4CFBA");
      }

      // draw notes
      var g = svg.selectAll(".n")
        .data(dts)
        .enter().append("g")
        .attr("class", "n");

      g.append("rect")
        .attr("x", function(d) { return d.x/sx; } )
        .attr("width", 2)
        .attr("y", 0)
        .attr("height", 50)
        .attr("fill", "#964B00");

      g.append("text")
        .attr("transform", function(d,i) { return "translate(" + (d.x/sx+5) + "," + (10+15*(i%5)) + ")"; })
        .attr("font-family", "'Lato', sans-serif")
        .attr("font-size", 14)
        .attr("fill", "#333")
        .text(function(d) { return d.s; } );
    }

    var clicktime;
    function visualizeEvent(es, filter) {

      var dts = [];
      var ttot = 0;
      var ttoti = [];
      var filter_colors = [];
      for(var q=0;q<filter.length;q++) { 
        filter_colors[q] = color_hash[filter[q]];
        ttoti.push(0); 
      }
      for(var i=0,N=es.length;i<N;i++) {
        var e = es[i];
        var fix = filter.indexOf(e.m);
        if( fix === -1) { continue; }
        ttot += e.dt;
        ttoti[fix] += e.dt;
        if(e.dt < 10) continue; // less than few second event? skip drawing. Not a concentrated activity
        var d = {};
        d.x = e.t - t00;
        d.w = e.dt;
        d.s = e.s + " (" + strTimeDelta(e.dt) + ")";
        d.fix = fix;
        dts.push(d);
      }
      if(ttot < 60) return; // less than a minute of activity? skip

      console.log('drawing filter ' + filter + ' with ' + dts.length + ' events.');

      var div = d3.select("#eventvis").append("div");

      var filters_div = div.append("div").attr("class", "fsdiv");
      for(var q=0;q<filter.length;q++) {
        if(ttoti[q] === 0) continue; // this filter wasnt found

        var filter_div = filters_div.append("div").attr("class", "fdiv");
        var c = filter_colors[q];
        filter_div.append("p").attr("class", "tt").attr("style", "color:"+c).text(filter[q]);
        var txt = strTimeDelta(ttoti[q]);
        filter_div.append("p").attr("class", "td").text(txt);
      }

      var W = $(window).width() - 40;
      var svg = div.append("svg")
      .attr("width", W)
      .attr("height", 70);

      var sx = (ft-t00) / W;
      var g = svg.selectAll(".e")
        .data(dts)
        .enter().append("g")
        .attr("class", "e")
        .on("mouseover", function(d){return tooltip.style("visibility", "visible").text(d.s);})
        .on("mousemove", function(){return tooltip.style("top", (event.pageY-10)+"px").style("left",(event.pageX+10)+"px");})
        .on("mouseout", function(){return tooltip.style("visibility", "hidden");})
        .on("click", function(d){ 
          $("#notesinfo").show(); 
          $("#notesmsg").html("clicked event <b>" + d.s + "</b><br> Add note at time of this event:");
          $("#notetext").focus()
          clicktime = d.x+t00;
          return 0; 
          });

      g.append("rect")
        .attr("x", function(d) { return d.x/sx; } )
        .attr("width", function(d) { return d.w/sx; } )
        .attr("y", 0)
        .attr("height", 50)
        .attr("fill", function(d) { return filter_colors[d.fix]; });

      // produce little axis numbers along the timeline
      var d0 = new Date(t00 * 1000);
      d0.setMinutes(0);
      d0.setSeconds(0);
      d0.setMilliseconds(0);
      var t = d0.getTime() / 1000; // cropped hour
      while(t < ft) {
        svg.append("text")
          .attr("transform", "translate(" + [(t-t00)/sx, 70] + ")")
          .attr("font-family", "'Lato', sans-serif")
          .attr("font-size", 14)
          .attr("fill", "#CCC")
          .text(new Date(t * 1000).getHours());
        t += 3600;
      }
    }

    // count up how much every event took
    function statEvents(es) {
      if(es.length === 0) return;

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
          etypes.push(tmap); // catalogue these in a list
        }
        ixprev = i;
      }
      es[N-1].dt = 1; // last event we dont know how long lasted. assume 1 second?
    }

    function writeHeader() {
      var date0 = new Date(t00*1000);
      var date1 = new Date(ft*1000);
      $("#header").html('<h2>' + ppDate(date0) + ' - ' + ppDate(date1) + '</h2>');
    }

    function startSpinner() {
      // create a spinner
      var target = document.getElementById('spinnerdiv');
      opts = {left:'30px', top:'40px', radius: 10, color: "#FFF" };
      var spinner = new Spinner(opts).spin(target);
    }
    function stopSpinner() {
      $("#spinnerdiv").empty();
    }

    function fetchAndLoadEvents(daylog) {
      loaded = false;
      // we do this random thing to defeat caching. Very annoying
      var json_path = daylog.fname + "?sigh=" + Math.floor(10000*Math.random());

      // fill in blog area with blog for this day
      $.getJSON(json_path, function(data){
        loaded = true;

        // save these as globals for later access
        events = data['window_events'];
        key_events = data['keyfreq_events']
        notes_events = data['notes_events']
        coffee_events = ('coffee_events' in data) ? data['coffee_events'] : [];

        // map all window titles through the (customizable) mapwin function
        _.each(events, function(e) { e.m = mapwin(e.s); });
        
        // compute various statistics
        statEvents(events);

        // create color hash table, maps from window titles -> HSL color
        color_hash = colorHashStrings(_.uniq(_.pluck(events, 'm')));

        // find the time extent: min and max time for this day
        if(events.length > 0) {
          t00 = _.min(_.pluck(events, 't'));
          ft = _.max(_.map(events, function(e) { return e.t + e.dt; }))
        } else {
          t00 = daylog.t0;
          ft = daylog.t1;
        }

        // render blog entry
        blog = 'blog' in data ? data['blog'] : '';
        if(typeof blog !== 'string') { blog = ''; }
        $("#blogpre").text(blog);

        visualizeEvents(events);
        writeHeader();
        createPieChart(events, etypes);
        computeKeyStats(events, key_events);
        hacking_stats = computeHackingStats(events, key_events, hacking_titles);
        visualizeHackingTimes(hacking_stats);
        focus_stats = computeFocusTaxStats(events);
        visualizeFocusMeter(focus_stats);
        visualizeCoffeeAdvisor(daylog, coffee_events);
        key_stats = computeKeyStats(events, key_events);
        visualizeKeyStats(key_stats, etypes);
        visualizeKeyFreq(key_events);
        visualizeNotes(notes_events);
      });
    }

    var events;
    var key_events;
    var notes_events;
    var blog;
    var tooltip;
    var event_list = [];
    var loaded = false;
    var cur_event_id = -1;
    var clicktime = 0;
    function start() {
      
      // create tooltip div
      tooltip = d3.select("body")
      .append("div")
      .style("position", "absolute")
      .style("z-index", "10")
      .style("visibility", "hidden")
      .text("");

      // we do this random thing to defeat caching. Very annoying
      $.getJSON("export_list.json?sigh=" + Math.floor(10000*Math.random()), function(data){
        event_list = data; // assign to global variable

        cur_event_id = event_list.length - 1;
        if('gotoday' in QueryString) { cur_event_id = parseInt(QueryString.gotoday); }

        fetchAndLoadEvents(event_list[cur_event_id]); // display latest
      });

      // setup notes hide key
      $("#notesinfohide").click(function(){ $("#notesinfo").hide(); });

      // setup refresh handler to create a post request to /reload
      $("#reloadbutton").click(function() {

        startSpinner();
        $.post("/refresh",
          {"time" : event_list[cur_event_id].t0},
          function(data,status){
            console.log("Data: " + data + "\nStatus: " + status);
            stopSpinner();
            if(data === 'OK') {
              // everything went well, refresh current view
              fetchAndLoadEvents(event_list[cur_event_id]);
            }
        });
      });

      // set up notes add handler
      $("#notesadd").click(function() {

        startSpinner();
        $.post("/addnote",
          {"note": $("#notetext").val(), "time": clicktime},
          function(data,status){
            console.log("Data: " + data + "\nStatus: " + status);
            stopSpinner();
            if(data === 'OK') {
              // everything went well, refresh current view
              $("#notetext").val('') // erase
              $("#notesinfo").hide(); // take away
              fetchAndLoadEvents(event_list[cur_event_id]);
            }
        });
      });

      // register enter key in notes as submitting
      $("#notetext").keyup(function(event){
        if(event.keyCode == 13){
          $("#notesadd").click();
        }
      });

      // setup arrow events
      $("#leftarrow").click(function() {
        cur_event_id--;
        if(cur_event_id < 0) {
          cur_event_id = 0;
        } else {
          fetchAndLoadEvents(event_list[cur_event_id]); // display latest
          $("#notesinfo").hide();
          $("#blogenter").hide();
          $("#blogpre").show();
        }
      });
      $("#rightarrow").click(function() {
        cur_event_id++;
        if(cur_event_id >= event_list.length) {
          cur_event_id = event_list.length - 1;
        } else {
          fetchAndLoadEvents(event_list[cur_event_id]); // display latest
          $("#notesinfo").hide();
          $("#blogenter").hide();
          $("#blogpre").show();
        }
      });

      // setup blog text click event
      $("#blogenter").hide();
      $("#blogpre").click(function(){
        var txt = $("#blogpre").text();
        $("#blogpre").hide();
        $("#blogenter").show();
        $("#blogentertxt").val(txt)
        $("#blogentertxt").focus();
      });

      // setup the submit blog entry button
      $("#blogentersubmit").click(function(){
        var txt = $("#blogentertxt").val();
        $("#blogpre").text(txt);
        $("#blogpre").show();
        $("#blogenter").hide();

        // submit to server with POST request
        $.post("/blog",
          {"time" : event_list[cur_event_id].t0, "post": txt},
           function(data,status){
            console.log("Data: " + data + "\nStatus: " + status);
            stopSpinner();
            if(data === 'OK') {
              // everything went well
            }
          });
      });
      setInterval(redraw, 1000); // in case of window resize, we can redraw
    }

    // redraw if dirty (due to window resize event)
    function redraw() {
      if(!dirty) return;
      if(!loaded) return;
      visualizeEvents(events);
      visualizeKeyFreq(key_events);
      visualizeNotes(notes_events);
      visualizeHackingTimes(hacking_stats);
      visualizeFocusMeter(focus_stats);
      if(cur_event_id >= 0 && cur_event_id < event_list.length) {
        visualizeCoffeeAdvisor(event_list[cur_event_id], coffee_events);
      }
      dirty = false;
    }

    var dirty = false;
    $(window).resize(function() {
      dirty = true;
    });

    
