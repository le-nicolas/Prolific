var d3utils = {};

(function(global) {
  "use strict";

  // convenience function
  var getopt = function(opt, field_name, default_value) {
    return typeof opt[field_name] !== 'undefined' ? opt[field_name] : default_value;
  }

  function drawPieChart(d3div, chart_data) {
    // chart_data.data is a list of data elements.
    // each should contain fields: val, col, name

    d3div.html(""); // clear the div
    var title = getopt(chart_data, 'title', '');

    // desired width and height of chart
    var w = getopt(chart_data, 'width', 300);
    var h = getopt(chart_data, 'height', 300);
    var pad = getopt(chart_data, 'pad', 50);
    var textmargin = getopt(chart_data, 'textmargin', 20);
    var labelMinPct = getopt(chart_data, 'labelMinPct', 1.5);
    var labelSpacing = getopt(chart_data, 'labelSpacing', 14);
    var labelXOffset = getopt(chart_data, 'labelXOffset', 18);
    var r = Math.min(w, h) / 2 - pad; // radius of pie chart

    var div = d3div.append('div');
    if(title !== '') {
      div.append('p').attr('class', 'pietitle').text(title);
    }
    
    var arc = d3.svg.arc()
      .outerRadius(r)
      .innerRadius(0);

    var pie = d3.layout.pie()
      .sort(null)
      .value(function(d) { return d.val; });

    var pieData = pie(chart_data.data);

    var svg = d3div.append("svg")
      .attr("width", w)
      .attr("height", h)
      .append("g")
      .attr("transform", "translate(" + w / 2 + "," + h / 2 + ")");

    var g = svg.selectAll(".arc")
      .data(pieData)
      .enter().append("g")
      .attr("class", "arc");

    g.append("path")
      .attr("d", arc)
      .style("fill", function(d) { return d.data.col; });

    function pointOnRadius(d, radius) {
      var c = arc.centroid(d);
      var x = c[0];
      var y = c[1];
      var norm = Math.sqrt(x * x + y * y) || 1;
      return [(x / norm) * radius, (y / norm) * radius];
    }

    function limitSideLabels(sideData, maxLabelY) {
      var maxPerSide = Math.max(1, Math.floor((2 * maxLabelY) / labelSpacing) + 1);
      if(sideData.length <= maxPerSide) {
        return sideData;
      }
      sideData.sort(function(a, b) { return a.val - b.val; });
      return sideData.slice(sideData.length - maxPerSide);
    }

    function spreadSideLabels(sideData, maxLabelY, labelRadius) {
      if(sideData.length === 0) {
        return;
      }

      sideData.sort(function(a, b) { return a.y - b.y; });

      var top = -maxLabelY;
      var bottom = maxLabelY;
      var i;

      sideData[0].y = Math.max(sideData[0].y, top);
      for(i = 1; i < sideData.length; i++) {
        sideData[i].y = Math.max(sideData[i].y, sideData[i - 1].y + labelSpacing);
      }

      var overflow = sideData[sideData.length - 1].y - bottom;
      if(overflow > 0) {
        sideData[sideData.length - 1].y -= overflow;
        for(i = sideData.length - 2; i >= 0; i--) {
          sideData[i].y = Math.min(sideData[i].y, sideData[i + 1].y - labelSpacing);
        }
      }

      if(sideData[0].y < top) {
        // Too many labels: spread evenly across the side to avoid collisions.
        var span = bottom - top;
        var step = sideData.length > 1 ? span / (sideData.length - 1) : 0;
        for(i = 0; i < sideData.length; i++) {
          sideData[i].y = top + step * i;
        }
      }

      for(i = 0; i < sideData.length; i++) {
        sideData[i].x = sideData[i].side * (labelRadius + labelXOffset);
      }
    }

    var total = d3.sum(chart_data.data, function(d) { return d.val; });
    var labelRadius = r + textmargin;
    var maxLabelY = h / 2 - 14;
    var leftLabels = [];
    var rightLabels = [];

    for(var i = 0; i < pieData.length; i++) {
      var d = pieData[i];
      if(!d || !d.data || !d.data.val) {
        continue;
      }
      if(total > 0 && (100 * d.data.val / total) < labelMinPct) {
        continue;
      }

      var p = pointOnRadius(d, labelRadius);
      var side = ((d.endAngle + d.startAngle) / 2 > Math.PI) ? -1 : 1;
      var label = {
        arcDatum: d,
        name: d.data.name,
        col: d.data.col,
        val: d.data.val,
        side: side,
        x: p[0],
        y: p[1],
      };
      if(side < 0) {
        leftLabels.push(label);
      } else {
        rightLabels.push(label);
      }
    }

    leftLabels = limitSideLabels(leftLabels, maxLabelY);
    rightLabels = limitSideLabels(rightLabels, maxLabelY);
    spreadSideLabels(leftLabels, maxLabelY, labelRadius);
    spreadSideLabels(rightLabels, maxLabelY, labelRadius);

    var labels = leftLabels.concat(rightLabels);

    svg.selectAll(".arc-label-line")
      .data(labels)
      .enter().append("polyline")
      .attr("class", "arc-label-line")
      .attr("fill", "none")
      .attr("stroke", function(d) { return d.col; })
      .attr("stroke-width", 1)
      .attr("opacity", 0.7)
      .attr("points", function(d) {
        var p0 = pointOnRadius(d.arcDatum, r);
        var p1 = pointOnRadius(d.arcDatum, labelRadius - 4);
        var p2 = [d.x + (d.side > 0 ? -6 : 6), d.y];
        return p0[0] + "," + p0[1] + " " + p1[0] + "," + p1[1] + " " + p2[0] + "," + p2[1];
      });

    svg.selectAll(".arc-label")
      .data(labels)
      .enter().append("text")
      .attr("class", "arc-label")
      .attr("fill", function(d) { return d.col; })
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .attr("dy", ".35em")
      .attr("text-anchor", function(d) { return d.side > 0 ? "start" : "end"; })
      .text(function(d) { return d.name; });
  }

  function drawHorizontalBarChart(d3div, chart_data) {
    // chart_data.data is a list of data elements.
    // each should contain fields: val, col, name, fn (text next to bar)

    d3div.html(""); // clear the div
    var div = d3div.append('div');

    var title = getopt(chart_data, 'title', '');
    if(title !== '') {
      div.append('p').attr('class', 'hbtitle').text(title);
    }

    // desired width and height of chart
    var w = getopt(chart_data, 'width', 300);
    var bh = getopt(chart_data, 'barheight', 30);
    var textmargin = getopt(chart_data, 'textmargin', 20);
    var textpad = getopt(chart_data, 'textpad', 100);
    var textoffy = getopt(chart_data, 'textoffy', 8);

    var h = chart_data.data.length * bh;
    var sx = (w - textmargin - textpad) / d3.max(chart_data.data, function(x){ return x.val; }); // for scaling to fit

    var svg = div.append("svg")
      .attr("width", w)
      .attr("height", h);

    var g = svg.selectAll(".b")
      .data(chart_data.data)
      .enter().append("g")
      .attr("class", "b");

    g.append("rect")
      .attr("x", function(d) { return 0.0; } )
      .attr("width", function(d) { return d.val * sx; } )
      .attr("y", function(d,i) { return i * bh; })
      .attr("height", bh)
      .attr("fill", function(d) { return d.col; });
      
    g.append("text")
      .attr("transform", function(d, i) { return "translate(" + (d.val * sx + textmargin) + "," + ((i+1) * bh - textoffy) + ")"; })
      .text(function(d) { return d.text });   
  }

  // exports
  global.drawPieChart = drawPieChart;
  global.drawHorizontalBarChart = drawHorizontalBarChart;

})(d3utils);

