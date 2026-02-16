(function () {
  "use strict";

  function formatDayStamp(ts) {
    if (!ts) return "-";
    var d = new Date(ts * 1000);
    return d.toISOString().slice(0, 10);
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function portOrigin() {
    return window.location.origin || (window.location.protocol + "//" + window.location.host);
  }

  function redirectLegacyDayLink() {
    var p = new URLSearchParams(window.location.search);
    if (!p.has("gotoday")) return;
    var ix = p.get("gotoday");
    window.location.replace("day.html?gotoday=" + encodeURIComponent(ix));
  }

  function refreshStatus() {
    setText("homeStatusServer", "Checking...");
    setText("homeStatusPort", portOrigin());
    fetch("export_list.json?sigh=" + Math.floor(Math.random() * 100000), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (days) {
        setText("homeStatusServer", "Running");
        setText("homeStatusDays", String(days.length));
        var last = days.length ? days[days.length - 1].t0 : null;
        setText("homeStatusLast", formatDayStamp(last));
      })
      .catch(function () {
        setText("homeStatusServer", "Not reachable");
        setText("homeStatusDays", "-");
        setText("homeStatusLast", "-");
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    redirectLegacyDayLink();
    var btn = document.getElementById("homeRefreshBtn");
    if (btn) {
      btn.addEventListener("click", refreshStatus);
    }
    refreshStatus();
  });
})();
