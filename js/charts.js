/* She Counts charts. Plain SVG, no library: a flow (sankey), a line chart,
   a stacked bar per row, and small slope panels. Every chart draws to the
   width of its box and is drawn again when that width changes. Colours are
   the page's CSS tokens, so both themes follow without a redraw. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  // Break a label into lines of about n characters, at spaces.
  function wrap(s, n) {
    var out = [], cur = '';
    String(s).split(' ').forEach(function (w) { if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; });
    if (cur) out.push(cur);
    return out;
  }
  function width(el) { return Math.max(260, Math.floor(el.clientWidth || el.getBoundingClientRect().width || 600)); }
  function tok(c) { return c.charAt(0) === '-' ? 'var(' + c + ')' : c; }

  // Push labels apart so none overlaps the next, keeping each as near its own
  // point as it can. ys are centres; returns new centres.
  // gap is a number, or an array giving each label's own height.
  function spread(ys, gap, lo, hi) {
    var idx = ys.map(function (y, i) { return i; }).sort(function (a, b) { return ys[a] - ys[b]; });
    var out = ys.slice();
    var need = function (a, b) { return typeof gap === 'number' ? gap : (gap[a] + gap[b]) / 2; };
    for (var pass = 0; pass < 2; pass++) {
      for (var k = 1; k < idx.length; k++) {
        var a = idx[k - 1], b = idx[k];
        if (out[b] - out[a] < need(a, b)) out[b] = out[a] + need(a, b);
      }
      if (hi != null && idx.length && out[idx[idx.length - 1]] > hi) {
        out[idx[idx.length - 1]] = hi;
        for (k = idx.length - 2; k >= 0; k--) {
          a = idx[k]; b = idx[k + 1];
          if (out[b] - out[a] < need(a, b)) out[a] = out[b] - need(a, b);
        }
      }
      if (lo != null && idx.length && out[idx[0]] < lo) out[idx[0]] = lo;
    }
    return out;
  }

  // ---------- flow ----------
  // spec.nodes: [{id, col, value, label, color}] in drawing order within a column.
  // spec.links: [{s, t, v}] in the order bands leave a node.
  function flow(el, spec, o) {
    o = o || {};
    var W = width(el), wide = W >= 700, fmt = o.fmt || String;
    var nodes = {}, cols = [];
    spec.nodes.forEach(function (n) { n.inV = 0; n.outV = 0; nodes[n.id] = n; (cols[n.col] = cols[n.col] || []).push(n); });
    spec.links.forEach(function (l) { nodes[l.s].outV += l.v; nodes[l.t].inV += l.v; });
    var gap = wide ? 16 : 10, nodeW = wide ? 12 : 10;
    var H = wide ? 440 : 0, padR = wide ? 175 : 0, padT = 10;
    var breadth = wide ? H - padT * 2 : W - 4;
    var k = Infinity;
    cols.forEach(function (c) {
      var sum = c.reduce(function (a, n) { return a + n.value; }, 0);
      k = Math.min(k, (breadth - gap * (c.length - 1)) / sum);
    });
    var minH = 1.5, step = wide ? (W - padR - nodeW) / (cols.length - 1) : 0, rowH = 86;
    if (!wide) H = (cols.length - 1) * rowH + nodeW + 8;
    cols.forEach(function (c, ci) {
      var pos = wide ? padT : 2;
      c.forEach(function (n) {
        n.len = Math.max(minH, n.value * k);
        n.at = pos; n.depth = wide ? ci * step : ci * rowH + 4;
        pos += n.len + gap;
        n.so = 0; n.to = 0;
      });
    });
    var g = '';
    spec.links.forEach(function (l) {
      var a = nodes[l.s], b = nodes[l.t], h = Math.max(minH * 0.6, l.v * k);
      var a0 = a.at + a.so, b0 = b.at + b.to; a.so += l.v * k; b.to += l.v * k;
      var d0 = a.depth + nodeW, d1 = b.depth, dm = (d0 + d1) / 2, p;
      if (wide) p = 'M' + d0 + ' ' + a0 + 'C' + dm + ' ' + a0 + ' ' + dm + ' ' + b0 + ' ' + d1 + ' ' + b0 +
        'L' + d1 + ' ' + (b0 + h) + 'C' + dm + ' ' + (b0 + h) + ' ' + dm + ' ' + (a0 + h) + ' ' + d0 + ' ' + (a0 + h) + 'Z';
      else p = 'M' + a0 + ' ' + d0 + 'C' + a0 + ' ' + dm + ' ' + b0 + ' ' + dm + ' ' + b0 + ' ' + d1 +
        'L' + (b0 + h) + ' ' + d1 + 'C' + (b0 + h) + ' ' + dm + ' ' + (a0 + h) + ' ' + dm + ' ' + (a0 + h) + ' ' + d0 + 'Z';
      g += '<path class="band" d="' + p + '" fill="' + tok(b.color) + '" fill-opacity=".32"><title>' + esc(a.label + ' → ' + b.label + ': ' + fmt(l.v)) + '</title></path>';
    });
    spec.nodes.forEach(function (n) {
      var r = wide ? [n.depth, n.at, nodeW, n.len] : [n.at, n.depth, n.len, nodeW];
      g += '<rect x="' + r[0].toFixed(1) + '" y="' + r[1].toFixed(1) + '" width="' + r[2].toFixed(1) + '" height="' + r[3].toFixed(1) +
        '" fill="' + tok(n.color) + '"><title>' + esc(n.label + ': ' + fmt(n.value)) + '</title></rect>';
    });
    var legend = '';
    if (wide) {
      cols.forEach(function (c) {
        var wrapped = c.map(function (n) { return wrap(n.label, 22); });
        var sizes = wrapped.map(function (w) { return w.length * 16 + 22; });
        var ys = spread(c.map(function (n) { return n.at + n.len / 2; }), sizes, 14, null);
        c.forEach(function (n, i) {
          var x = n.depth + nodeW + 7, lines = wrapped[i], top = ys[i] - (lines.length * 16 + 16) / 2 + 12, cy = n.at + n.len / 2;
          if (Math.abs(ys[i] - cy) > 3) g += '<path d="M' + (n.depth + nodeW + 1) + ' ' + cy + 'L' + (x - 2) + ' ' + ys[i] + '" stroke="var(--soft)" fill="none"/>';
          lines.forEach(function (ln, j) { g += '<text class="lab" x="' + x + '" y="' + (top + j * 16) + '">' + esc(ln) + '</text>'; });
          g += '<text class="lab num" x="' + x + '" y="' + (top + lines.length * 16 + 1) + '">' + esc(fmt(n.value)) + '</text>';
          H = Math.max(H, top + lines.length * 16 + 10);
        });
      });
    } else {
      legend = '<ol class="flowkey">' + cols.map(function (c) {
        return '<li><ul>' + c.map(function (n) {
          return '<li><i style="background:' + tok(n.color) + '"></i><span>' + esc(n.label) + '</span><b>' + esc(fmt(n.value)) + '</b></li>';
        }).join('') + '</ul></li>';
      }).join('') + '</ol>';
    }
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + Math.ceil(H) + '" width="' + W + '" height="' + Math.ceil(H) + '" role="img" aria-label="' + esc(o.label || '') + '">' + g + '</svg>' + legend;
  }

  // ---------- lines ----------
  // spec: {x: [labels], series: [{label, values, color, dash, width}], fmt, marks: [{i, label}]}
  function lines(el, spec) {
    var W = width(el), narrow = W < 560, fmt = spec.fmt || String;
    var H = narrow ? 260 : 320, L = narrow ? 44 : 56, R = narrow ? 100 : 170, T = 18, B = 30;
    var max = 0;
    spec.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null && v > max) max = v; }); });
    var nice = niceMax(max), ticks = 4;
    var x = function (i) { return L + i * (W - L - R) / (spec.x.length - 1); };
    var y = function (v) { return T + (H - T - B) * (1 - v / nice); };
    var g = '';
    for (var t = 0; t <= ticks; t++) {
      var v = nice * t / ticks, yy = y(v);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--thread)" stroke-dasharray="' + (t ? '3 5' : '0') + '"/>' +
           '<text class="tick" x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + esc(fmt(v, true)) + '</text>';
    }
    spec.x.forEach(function (lab, i) { g += '<text class="tick" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lab) + '</text>'; });
    (spec.marks || []).forEach(function (m) {
      g += '<line x1="' + x(m.i) + '" x2="' + x(m.i) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--turmeric)" stroke-width="2" stroke-dasharray="2 4"/>' +
           '<text class="tick mark" x="' + (x(m.i) + (m.i === spec.x.length - 1 ? -6 : 6)) + '" y="' + (narrow && m.i === spec.x.length - 1 ? H - B - 8 : T + 10) + '" text-anchor="' + (m.i === spec.x.length - 1 ? 'end' : 'start') + '">' + esc(m.label) + '</text>';
    });
    var ends = [];
    spec.series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return v == null ? null : [x(i), y(v), v, i]; }).filter(Boolean);
      if (!pts.length) return;
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
      g += '<path d="' + d + '" fill="none" stroke="' + tok(s.color) + '" stroke-width="' + (s.width || 2.5) + '"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + ' stroke-linejoin="round"/>';
      pts.forEach(function (p) {
        g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (s.dash ? 3 : 4.5) + '" fill="' + tok(s.color) + '" stroke="var(--cloth)" stroke-width="1.5"><title>' +
          esc(s.label + ', ' + spec.x[p[3]] + ': ' + fmt(p[2])) + '</title></circle>';
      });
      var last = pts[pts.length - 1];
      ends.push({ y: last[1], x: last[0], s: s, v: last[2] });
    });
    var wr = ends.map(function (e) { return wrap(narrow && e.s.short ? e.s.short : e.s.label, narrow ? 12 : 20); });
    var ys = spread(ends.map(function (e) { return e.y; }), wr.map(function (w) { return w.length * 15 + 22; }), T + 6, H - B - 20);
    ends.forEach(function (e, i) {
      var top = ys[i] - (wr[i].length * 15 + 16) / 2 + 11;
      wr[i].forEach(function (ln, j) { g += '<text class="lab" x="' + (e.x + 10) + '" y="' + (top + j * 15) + '" fill="' + tok(e.s.ink || e.s.color) + '">' + esc(ln) + '</text>'; });
      g += '<text class="lab num" x="' + (e.x + 10) + '" y="' + (top + wr[i].length * 15 + 1) + '">' + esc(fmt(e.v)) + '</text>';
      H = Math.max(H, top + wr[i].length * 15 + 8);
    });
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
  }
  function niceMax(v) {
    if (!v) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    var n = m <= 1 ? 1 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10;
    return n * p;
  }

  // ---------- stacked bars, one row each ----------
  // spec: {rows: [{label, parts: [{key, value}]}], keys: [{key, label, color}], share: bool, fmt}
  function stack(el, spec) {
    var W = width(el), narrow = W < 560, fmt = spec.fmt || String;
    var blank = spec.rows.every(function (r) { return !r.label; });
    var L = blank ? 0 : spec.labelW ? Math.min(spec.labelW, W * 0.38) : (narrow ? 44 : 64), R = spec.values ? 70 : 8, rowH = narrow ? 30 : 34, T = 6;
    if (spec.rows.length > 12) rowH = 22;
    var H = T + spec.rows.length * (rowH + 8) + 4;
    var max = 0;
    spec.rows.forEach(function (r) { var s = 0; r.parts.forEach(function (p) { s += p.value || 0; }); r.sum = s; if (s > max) max = s; });
    var g = '', color = {}, label = {};
    spec.keys.forEach(function (k) { color[k.key] = k.color; label[k.key] = k.label; });
    spec.rows.forEach(function (r, i) {
      var y = T + i * (rowH + 8), x = L, full = spec.share ? r.sum : max;
      if (r.label) g += '<text class="tick" x="' + (L - 10) + '" y="' + (y + rowH / 2 + 5) + '" text-anchor="end">' + esc(r.label) + '</text>';
      r.parts.forEach(function (p) {
        if (!p.value) return;
        var w = p.value / full * (W - L - R);
        var pct = Math.round(p.value / r.sum * 100);
        var txt = spec.values ? fmt(p.value) : pct + '%';
        g += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + Math.max(0.8, w).toFixed(1) + '" height="' + rowH + '" fill="' + tok(color[p.key]) + '"><title>' +
          esc((r.label ? r.label + ', ' : '') + label[p.key] + ': ' + fmt(p.value) + (spec.values ? '' : ' (' + pct + '%)')) + '</title></rect>';
        if (!spec.values && w > (narrow ? 44 : 52)) g += '<text class="inbar" x="' + (x + 7) + '" y="' + (y + rowH / 2 + 5) + '">' + txt + '</text>';
        x += w;
      });
      if (spec.values) g += '<text class="lab num" x="' + (x + 6) + '" y="' + (y + rowH / 2 + 5) + '">' + esc(fmt(r.sum)) + '</text>';
    });
    var key = '<ul class="legend">' + spec.keys.map(function (k) { return '<li><i style="background:' + tok(k.color) + '"></i>' + esc(k.label) + '</li>'; }).join('') + '</ul>';
    el.innerHTML = key + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
  }

  // ---------- one slope panel ----------
  // spec: {a, b, ia, ib, fmt, label}: this place in 2020 and 2024, and India.
  function slope(spec) {
    var W = 200, H = 120, L = 46, R = 46, T = 14, B = 22, fmt = spec.fmt || String;
    var max = niceMax(Math.max(spec.a || 0, spec.b || 0, spec.ia || 0, spec.ib || 0));
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var up = spec.b > spec.a, col = spec.a == null || spec.b == null ? 'var(--thread)' : up ? 'var(--red)' : 'var(--knot)';
    var g = '<line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--thread)" stroke-dasharray="3 4"/>' +
            '<line x1="' + (W - R) + '" x2="' + (W - R) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--thread)" stroke-dasharray="3 4"/>';
    if (spec.ia != null && spec.ib != null)
      g += '<path d="M' + L + ' ' + y(spec.ia).toFixed(1) + 'L' + (W - R) + ' ' + y(spec.ib).toFixed(1) + '" stroke="var(--soft)" stroke-width="1.5" stroke-dasharray="5 4" fill="none"/>';
    if (spec.a != null && spec.b != null) {
      g += '<path d="M' + L + ' ' + y(spec.a).toFixed(1) + 'L' + (W - R) + ' ' + y(spec.b).toFixed(1) + '" stroke="' + col + '" stroke-width="3" fill="none"/>' +
           '<circle cx="' + L + '" cy="' + y(spec.a).toFixed(1) + '" r="4" fill="' + col + '"/><circle cx="' + (W - R) + '" cy="' + y(spec.b).toFixed(1) + '" r="4" fill="' + col + '"/>' +
           '<text class="lab num" x="' + (L - 7) + '" y="' + (y(spec.a) + 4).toFixed(1) + '" text-anchor="end">' + esc(fmt(spec.a)) + '</text>' +
           '<text class="lab num" x="' + (W - R + 7) + '" y="' + (y(spec.b) + 4).toFixed(1) + '">' + esc(fmt(spec.b)) + '</text>';
    }
    g += '<text class="tick" x="' + L + '" y="' + (H - 5) + '" text-anchor="middle">' + spec.ya + '</text><text class="tick" x="' + (W - R) + '" y="' + (H - 5) + '" text-anchor="middle">' + spec.yb + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
  }

  // Redraw a chart whenever its box changes width.
  var watched = [];
  function watch(el, draw) {
    var w = el.clientWidth;
    watched = watched.filter(function (x) { return x.el !== el; });
    watched.push({ el: el, draw: draw, w: w });
    draw();
  }
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { watched.forEach(function (x) { if (x.el.clientWidth !== x.w) { x.w = x.el.clientWidth; x.draw(); } }); }, 150);
  });

  window.SC_CHARTS = { flow: flow, lines: lines, stack: stack, slope: slope, watch: watch, niceMax: niceMax };
})();
