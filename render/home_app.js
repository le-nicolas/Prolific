(function () {
  "use strict";

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDayStamp(ts) {
    if (!ts) return "-";
    var d = new Date(ts * 1000);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
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
    fetch("/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: "time=0",
      cache: "no-store"
    })
      .catch(function () {
        // Home status should still render if refresh endpoint is temporarily unavailable.
        return null;
      })
      .then(function () {
        return fetch("export_list.json?sigh=" + Math.floor(Math.random() * 100000), { cache: "no-store" });
      })
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
