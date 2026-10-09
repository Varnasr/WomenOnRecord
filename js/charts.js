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
    el.__csv = [['stage', 'cases']].concat(spec.nodes.map(function (n) { return [n.label, n.value]; }));
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
    el.__csv = [['year'].concat(spec.series.map(function (z) { return z.label; }))].concat(spec.x.map(function (x, i) { return [x].concat(spec.series.map(function (z) { return z.values[i]; })); }));
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
    var longest = Math.max.apply(null, spec.rows.map(function (r) { return String(r.label || '').length; }));
    var L = blank ? 0 : Math.min(W * 0.38, spec.labelW || Math.max(narrow ? 44 : 64, longest * 7.5 + 16)), R = spec.values ? 70 : 8, rowH = narrow ? 30 : 34, T = 6;
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
    el.__csv = [[''].concat(spec.keys.map(function (k) { return k.label; }))].concat(spec.rows.map(function (r) {
      return [r.label].concat(spec.keys.map(function (k) { var p = r.parts.find(function (q) { return q.key === k.key; }); return p ? p.value : ''; })); }));
  }

  // ---------- columns ----------
  // spec: {x: [labels], series: [{label, values, color}], fmt, label}. Grouped
  // columns from zero, values written over each column when there is room.
  function columns(el, spec) {
    var W = width(el), narrow = W < 560, fmt = spec.fmt || String;
    var H = narrow ? 250 : 300, L = narrow ? 44 : 56, R = 8, T = 22, B = spec.xWrap ? 44 : 30;
    var max = 0;
    spec.series.forEach(function (z) { z.values.forEach(function (v) { if (v > max) max = v; }); });
    var nice = niceMax(max), n = spec.x.length, k = spec.series.length;
    var band = (W - L - R) / n, inner = band * (k > 1 ? 0.78 : 0.62), cw = inner / k;
    var y = function (v) { return T + (H - T - B) * (1 - v / nice); };
    var g = '';
    for (var t = 0; t <= 4; t++) {
      var v = nice * t / 4, yy = y(v);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--thread)"' + (t ? ' stroke-dasharray="3 5"' : '') + '/>' +
           '<text class="tick" x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + esc(fmt(v, true)) + '</text>';
    }
    spec.x.forEach(function (lab, i) {
      var x0 = L + i * band + (band - inner) / 2;
      spec.series.forEach(function (z, j) {
        var v = z.values[i]; if (v == null) return;
        var x = x0 + j * cw, h = (H - T - B) * v / nice;
        g += '<rect x="' + (x + 1).toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + Math.max(1, cw - 2).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + tok(z.color) + '"><title>' +
          esc(z.label + ', ' + lab + ': ' + fmt(v)) + '</title></rect>';
        if (cw > (narrow ? 26 : 30)) g += '<text class="lab num" x="' + (x + cw / 2).toFixed(1) + '" y="' + (y(v) - 5).toFixed(1) + '" text-anchor="middle" font-size="' + (narrow ? 10.5 : 12) + '">' + esc(fmt(v, true)) + '</text>';
      });
      var lines2 = spec.xWrap ? wrap(lab, 8) : [lab];
      lines2.forEach(function (ln, q) { g += '<text class="tick" x="' + (L + i * band + band / 2).toFixed(1) + '" y="' + (H - B + 16 + q * 13) + '" text-anchor="middle">' + esc(ln) + '</text>'; });
    });
    var key = k > 1 ? '<ul class="legend">' + spec.series.map(function (z) { return '<li><i style="background:' + tok(z.color) + '"></i>' + esc(z.label) + '</li>'; }).join('') + '</ul>' : '';
    el.innerHTML = key + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
    el.__csv = [[''].concat(spec.series.map(function (z) { return z.label; }))].concat(spec.x.map(function (x, i) { return [x].concat(spec.series.map(function (z) { return z.values[i]; })); }));
  }

  // ---------- heat ----------
  // spec: {rows: [{label, values}], x: [labels], fmt, label, ramp}. One row per
  // place, one column per year, the shade set by the value on one scale.
  function heat(el, spec) {
    var W = width(el), narrow = W < 560, fmt = spec.fmt || String;
    var L = Math.min(narrow ? 128 : 190, W * 0.4), cell = (W - L - 4) / spec.x.length, rh = narrow ? 22 : 24, T = 22;
    var H = T + spec.rows.length * rh + 6, vals = [];
    spec.rows.forEach(function (r) { r.values.forEach(function (v) { if (v != null) vals.push(v); }); });
    vals.sort(function (a, b) { return a - b; });
    var q = function (p) { return vals[Math.min(vals.length - 1, Math.floor(p * vals.length))]; };
    var cuts = [q(0.2), q(0.4), q(0.6), q(0.8)], ramp = ['--q1', '--q2', '--q3', '--q4', '--q5'];
    var bin = function (v) { var b = 0; cuts.forEach(function (c) { if (v > c) b++; }); return b; };
    var g = '';
    spec.x.forEach(function (x, j) { g += '<text class="tick" x="' + (L + j * cell + cell / 2).toFixed(1) + '" y="14" text-anchor="middle">' + esc(x) + '</text>'; });
    spec.rows.forEach(function (r, i) {
      var y = T + i * rh;
      // a name too long for the label column is shortened, with the whole name in its tooltip
      var room = Math.floor((L - 12) / 6.6), lab = r.label.length > room ? r.label.slice(0, room - 1).replace(/\s+\S*$/, '') + '…' : r.label;
      g += '<text class="tick rowlab" x="' + (L - 8) + '" y="' + (y + rh / 2 + 4) + '" text-anchor="end"><title>' + esc(r.label) + '</title>' + esc(lab) + '</text>';
      r.values.forEach(function (v, j) {
        var b = v == null ? -1 : bin(v), x = L + j * cell;
        g += '<rect x="' + (x + 1).toFixed(1) + '" y="' + (y + 1) + '" width="' + (cell - 2).toFixed(1) + '" height="' + (rh - 2) + '" fill="' + (b < 0 ? 'var(--ground)' : 'var(' + ramp[b] + ')') + '"><title>' +
          esc(r.label + ', ' + spec.x[j] + ': ' + (v == null ? '–' : fmt(v))) + '</title></rect>';
        if (v != null && cell > 40) g += '<text x="' + (x + cell / 2).toFixed(1) + '" y="' + (y + rh / 2 + 4) + '" text-anchor="middle" font-size="11" class="hv' + (b >= 3 ? ' dark' : '') + '">' + esc(fmt(v)) + '</text>';
      });
    });
    var edges = [vals[0]].concat(cuts).concat([vals[vals.length - 1]]);
    var key = '<ul class="legend">' + ramp.map(function (c, i) { return '<li><i style="background:var(' + c + ');border-radius:2px"></i>' + esc(fmt(edges[i]) + ' – ' + fmt(edges[i + 1])) + '</li>'; }).join('') + '</ul>';
    el.innerHTML = key + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
    el.__csv = [['place'].concat(spec.x)].concat(spec.rows.map(function (r) { return [r.label].concat(r.values); }));
  }

  // ---------- dumbbell ----------
  // spec: {rows: [{label, a, b}], aLabel, bLabel, fmt, label}. Each row on its
  // own scale from zero, because the crimes differ by orders of magnitude.
  function dumbbell(el, spec) {
    var W = width(el), narrow = W < 560, fmt = spec.fmt || String;
    var L = Math.min(narrow ? 140 : 230, W * 0.42), R = 54, rh = narrow ? 34 : 30, T = 8;
    var H = T + spec.rows.length * rh + 6, g = '';
    spec.rows.forEach(function (r, i) {
      var y = T + i * rh + rh / 2, mx = Math.max(r.a || 0, r.b || 0) * 1.12 || 1;
      var x = function (v) { return L + (W - L - R) * v / mx; };
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="var(--thread)"/>';
      g += '<text class="tick rowlab" x="' + (L - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(r.label) + '</text>';
      if (r.a != null && r.b != null) g += '<line x1="' + x(r.a).toFixed(1) + '" x2="' + x(r.b).toFixed(1) + '" y1="' + y + '" y2="' + y + '" stroke="var(--soft)" stroke-width="3"/>';
      if (r.b != null) g += '<circle cx="' + x(r.b).toFixed(1) + '" cy="' + y + '" r="5.5" fill="var(--cloth)" stroke="var(--soft)" stroke-width="2"><title>' + esc(spec.bLabel + ': ' + fmt(r.b)) + '</title></circle>';
      if (r.a != null) g += '<circle cx="' + x(r.a).toFixed(1) + '" cy="' + y + '" r="6.5" fill="var(--red)"><title>' + esc(spec.aLabel + ': ' + fmt(r.a)) + '</title></circle>';
      g += '<text class="lab num" x="' + (W - R + 8) + '" y="' + (y + 4) + '">' + esc(r.a == null ? '–' : fmt(r.a)) + '</text>';
    });
    var key = '<ul class="legend"><li><i style="background:var(--red)"></i>' + esc(spec.aLabel) + '</li><li><i style="background:var(--cloth);box-shadow:inset 0 0 0 2px var(--soft)"></i>' + esc(spec.bLabel) + '</li></ul>';
    el.innerHTML = key + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
    el.__csv = [['', spec.aLabel, spec.bLabel]].concat(spec.rows.map(function (r) { return [r.label, r.a, r.b]; }));
  }

  // ---------- export ----------
  // A chart as a standalone SVG card: its colours and type written in from the
  // page, a title above and the source and address below, so a shared picture
  // still says what it is and where it came from.
  function card(el, title, foot) {
    var cs = getComputedStyle(document.body), ink = cs.getPropertyValue('--ink').trim(), soft = cs.getPropertyValue('--soft').trim(), bg = cs.getPropertyValue('--cloth').trim();
    var svgs = el.tagName.toLowerCase() === 'svg' ? [el] : el.querySelectorAll('svg:not(.woman)'), iso = el.querySelector('.iso');
    var src, w, h;
    if (iso) {
      var ws = iso.querySelectorAll('.woman'), cw = 26, ch = 52;
      w = 600; h = Math.ceil(ws.length / 10) * (ch + 4);
      var off = (w - 10 * cw) / 2;
      src = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ws.forEach(function (m, i) {
        var c = m.cloneNode(true); c.setAttribute('x', (i % 10) * cw + off); c.setAttribute('y', Math.floor(i / 10) * (ch + 4)); c.setAttribute('width', cw - 4); c.setAttribute('height', ch);
        bake(m, c); src.appendChild(c);
      });
    } else {
      var orig = svgs[svgs.length - 1]; if (!orig) return null;
      src = orig.cloneNode(true); bake(orig, src);
      var vb = orig.viewBox.baseVal; w = vb.width; h = vb.height;
    }
    // the legend, if the chart has one, as a row of swatches under the title
    var keys = [].slice.call(el.querySelectorAll('.legend li')).map(function (li) {
      var sw = li.querySelector('i, svg'), c = sw ? (sw.tagName === 'I' ? getComputedStyle(sw).backgroundColor : getComputedStyle(sw).fill) : soft, o = false;
      if (sw && sw.tagName !== 'I' && (c === 'none' || !c)) { c = getComputedStyle(sw).stroke; o = true; }
      return { c: c, o: o, t: li.textContent.trim() };
    });
    var pad = 24, tl = wrap(title, Math.max(30, Math.floor(w / 9))), kl = [], row = [], used = 0;
    // a label too long for the card is cut at a word and marked with an ellipsis
    keys.forEach(function (k) { var max = Math.floor((w - 30) / 7.2); if (k.t.length > max) k.t = k.t.slice(0, max).replace(/\s+\S*$/, '') + '…'; });
    keys.forEach(function (k) { var kw = 22 + k.t.length * 7; if (used + kw > w && row.length) { kl.push(row); row = []; used = 0; } row.push(k); used += kw + 10; });
    if (row.length) kl.push(row);
    var fl = wrap(foot, Math.floor(w / 7)), top = pad + tl.length * 24 + 16 + kl.length * 22 + (kl.length ? 8 : 0), W = w + pad * 2, H = top + h + 34 + fl.length * 18;
    var kg = kl.map(function (r, i) { var x = pad; return r.map(function (k) { var y = pad + tl.length * 24 + 22 + i * 22, s2 = '<rect x="' + (x + 1) + '" y="' + (y - 9) + '" width="11" height="11" rx="2" ' + (k.o ? 'fill="none" stroke="' + k.c + '" stroke-width="1.8"' : 'fill="' + k.c + '"') + '/><text x="' + (x + 18) + '" y="' + y + '" font-size="12.5" fill="' + soft + '">' + esc(k.t) + '</text>'; x += 22 + k.t.length * 7 + 10; return s2; }).join(''); }).join('');
    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif">' +
      '<rect width="100%" height="100%" fill="' + bg + '"/>' +
      tl.map(function (t, i) { return '<text x="' + pad + '" y="' + (pad + 18 + i * 24) + '" font-size="18" font-weight="700" fill="' + ink + '">' + esc(t) + '</text>'; }).join('') + kg +
      '<g transform="translate(' + pad + ' ' + top + ')">' + src.innerHTML + '</g>' +
      '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + (top + h + 14) + '" y2="' + (top + h + 14) + '" stroke="' + soft + '" stroke-opacity=".4"/>' +
      fl.map(function (f, i) { return '<text x="' + pad + '" y="' + (top + h + 34 + i * 18) + '" font-size="12.5" fill="' + soft + '">' + esc(f) + '</text>'; }).join('') + '</svg>';
    return { svg: out, w: W, h: H };
  }
  // Write each element's computed paint and type into it, so the copy looks
  // the same outside the page.
  function bake(from, to) {
    var a = [from].concat([].slice.call(from.querySelectorAll('*'))), b = [to].concat([].slice.call(to.querySelectorAll('*')));
    a.forEach(function (e, i) {
      var st = getComputedStyle(e), d = b[i]; if (!d) return;
      ['fill', 'stroke'].forEach(function (p) { var v = st[p]; if (v && v !== 'none' || (e.getAttribute(p) || '').indexOf('var(') >= 0) d.setAttribute(p, v); });
      if (st.fillOpacity && st.fillOpacity !== '1') d.setAttribute('fill-opacity', st.fillOpacity);
      if (/^(text|tspan)$/.test(e.tagName)) { d.setAttribute('font-size', st.fontSize); d.setAttribute('font-weight', st.fontWeight); d.setAttribute('font-family', 'IBM Plex Sans, Helvetica, Arial, sans-serif');
        if (st.strokeWidth && st.stroke !== 'none') { d.setAttribute('stroke-width', st.strokeWidth); d.setAttribute('paint-order', 'stroke'); } }
      d.removeAttribute('class');
    });
  }
  function save(href, name) { var a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function saveSvg(el, title, foot, name) {
    var c = card(el, title, foot); if (!c) return;
    save(URL.createObjectURL(new Blob([c.svg], { type: 'image/svg+xml' })), name + '.svg');
  }
  function savePng(el, title, foot, name) {
    var c = card(el, title, foot); if (!c) return;
    var img = new Image(), cv = document.createElement('canvas'), k = 2;
    cv.width = c.w * k; cv.height = c.h * k;
    img.onload = function () { cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); save(cv.toDataURL('image/png'), name + '.png'); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.svg);
  }
  function saveCsv(rows, name) {
    var text = '\ufeff' + rows.map(function (r) { return r.map(function (c) { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n');
    save(URL.createObjectURL(new Blob([text], { type: 'text/csv' })), name + '.csv');
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

  // ---------- women ----------
  // One standing woman, front on: head, hair in a bun or a plait, a long kurta,
  // arms at her sides. Drawn upright and still on purpose. She stands for a
  // count of cases and is never shown hurt, hiding or afraid.
  function woman(fill, line, bun) {
    var st = line ? ' fill="none" stroke="' + tok(line) + '" stroke-width="1.5" stroke-linejoin="round"' : ' fill="' + tok(fill) + '"';
    return '<svg class="woman" viewBox="0 0 20 40" aria-hidden="true"' + st + '>' +
      '<circle cx="10" cy="5" r="4.2"/>' +
      (bun ? '<circle cx="10" cy="1.3" r="2.1"/>' : '<path d="M13.5 6.2q2.2 5.6-.3 12.4l-1.1-.4q1.9-5.8.1-11.6z"/>') +
      '<path d="M5.7 11.2q4.3-2.3 8.6 0l2.5 20.6q-6.8 2-13.6 0z"/>' +
      '<path d="M5.9 12.6l-2.1 9.3 1.5.4 2.3-8.4z"/><path d="M14.1 12.6l2.1 9.3-1.5.4-2.3-8.4z"/>' +
      '<rect x="7.1" y="32" width="2.1" height="7.4" rx="1"/><rect x="10.8" y="32" width="2.1" height="7.4" rx="1"/></svg>';
  }
  // Split 100 among groups by largest remainder, so the figures always add to 100.
  function hundred(values) {
    var tot = values.reduce(function (a, b) { return a + (b || 0); }, 0);
    var raw = values.map(function (v) { return (v || 0) / tot * 100; });
    var n = raw.map(Math.floor), left = 100 - n.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (r, i) { return [r - Math.floor(r), i]; }).sort(function (a, b) { return b[0] - a[0]; })
      .slice(0, left).forEach(function (x) { n[x[1]]++; });
    return n;
  }
  // groups: [{n, fill, line}]. Returns ten rows of ten women.
  function iso(groups) {
    var out = '', k = 0;
    groups.forEach(function (g) { for (var i = 0; i < g.n; i++) { out += woman(g.fill, g.line, k % 3 === 0); k++; } });
    return '<div class="iso">' + out + '</div>';
  }

  window.SC_CHARTS = { columns: columns, heat: heat, dumbbell: dumbbell, savePng: savePng, saveSvg: saveSvg, saveCsv: saveCsv, woman: woman, hundred: hundred, iso: iso, flow: flow, lines: lines, stack: stack, slope: slope, watch: watch, niceMax: niceMax };
})();
