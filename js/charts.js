/* Women on Record charts. Plain SVG, no library: a flow (sankey), a line chart,
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
    var W = width(el);
    if (W < 700) return steps(el, spec, o, W);
    var fmt = o.fmt || String;
    var nodes = {}, cols = [];
    spec.nodes.forEach(function (n) { n.inV = 0; n.outV = 0; nodes[n.id] = n; (cols[n.col] = cols[n.col] || []).push(n); });
    spec.links.forEach(function (l) { nodes[l.s].outV += l.v; nodes[l.t].inV += l.v; });
    var gap = 16, nodeW = 12, H = 440, padR = 175, padT = 10, breadth = H - padT * 2, k = Infinity;
    cols.forEach(function (c) {
      var sum = c.reduce(function (a, n) { return a + n.value; }, 0);
      k = Math.min(k, (breadth - gap * (c.length - 1)) / sum);
    });
    var minH = 1.5, step = (W - padR - nodeW) / (cols.length - 1);
    cols.forEach(function (c, ci) {
      var pos = padT;
      c.forEach(function (n) { n.len = Math.max(minH, n.value * k); n.at = pos; n.depth = ci * step; pos += n.len + gap; n.so = 0; n.to = 0; });
    });
    var g = '';
    spec.links.forEach(function (l) {
      var a = nodes[l.s], b = nodes[l.t], h = Math.max(minH * 0.6, l.v * k);
      var a0 = a.at + a.so, b0 = b.at + b.to; a.so += l.v * k; b.to += l.v * k;
      var d0 = a.depth + nodeW, d1 = b.depth, dm = (d0 + d1) / 2;
      var p = 'M' + d0 + ' ' + a0 + 'C' + dm + ' ' + a0 + ' ' + dm + ' ' + b0 + ' ' + d1 + ' ' + b0 +
        'L' + d1 + ' ' + (b0 + h) + 'C' + dm + ' ' + (b0 + h) + ' ' + dm + ' ' + (a0 + h) + ' ' + d0 + ' ' + (a0 + h) + 'Z';
      g += '<path class="band" d="' + p + '" fill="' + tok(b.color) + '" fill-opacity=".32"><title>' + esc(a.label + ' → ' + b.label + ': ' + fmt(l.v)) + '</title></path>';
    });
    spec.nodes.forEach(function (n) {
      g += '<rect x="' + n.depth.toFixed(1) + '" y="' + n.at.toFixed(1) + '" width="' + nodeW + '" height="' + n.len.toFixed(1) +
        '" fill="' + tok(n.color) + '"><title>' + esc(n.label + ': ' + fmt(n.value)) + '</title></rect>';
    });
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
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + Math.ceil(H) + '" width="' + W + '" height="' + Math.ceil(H) + '" role="img" aria-label="' + esc(o.label || '') + '">' + g + '</svg>';
    el.__csv = [['stage', 'cases']].concat(spec.nodes.map(function (n) { return [n.label, n.value]; }));
  }
  // The same flow on a narrow screen, read top to bottom. Each stage where
  // cases gather (the police, the courts) is a heading with its total, a bar of
  // where its cases came from, and a bar of what became of them, each bar with
  // its parts named and counted directly beneath it.
  function steps(el, spec, o, W) {
    var fmt = o.fmt || String, nodes = {};
    spec.nodes.forEach(function (n) { nodes[n.id] = n; });
    var ins = {}, outs = {};
    spec.links.forEach(function (l) { (ins[l.t] = ins[l.t] || []).push(l); (outs[l.s] = outs[l.s] || []).push(l); });
    var hubs = spec.nodes.filter(function (n) { return (ins[n.id] || []).length > 1 && (outs[n.id] || []).length > 1; });
    var y = 4, g = '', room = Math.floor((W - 96) / 7.4);
    function bar(list, end, total) {
      var x = 0;
      list.forEach(function (l) {
        var n = nodes[l[end]], w = l.v / total * W;
        g += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + Math.max(1.5, w).toFixed(1) + '" height="16" fill="' + tok(n.color) + '"><title>' + esc(n.label + ': ' + fmt(l.v)) + '</title></rect>';
        x += w;
      });
      y += 30;
      list.forEach(function (l) {
        var n = nodes[l[end]], lines = wrap(n.label, room);
        g += '<rect x="0" y="' + (y - 11) + '" width="11" height="11" rx="2" fill="' + tok(n.color) + '"/>';
        lines.forEach(function (ln, j) { g += '<text class="lab part" x="20" y="' + (y + j * 18) + '">' + esc(ln) + '</text>'; });
        g += '<text class="lab num" x="' + W + '" y="' + y + '" text-anchor="end">' + esc(fmt(l.v)) + '</text>';
        y += lines.length * 18 + 8;
      });
    }
    hubs.forEach(function (h, i) {
      if (i) { g += '<line x1="0" x2="' + W + '" y1="' + (y + 4) + '" y2="' + (y + 4) + '" stroke="var(--thread)"/>'; y += 30; }
      else y += 18;
      wrap(h.label, Math.floor((W - 90) / 9)).forEach(function (ln, j, a) {
        g += '<text class="lab hub" x="0" y="' + y + '">' + esc(ln) + '</text>';
        if (j === a.length - 1) g += '<text class="lab num hub" x="' + W + '" y="' + y + '" text-anchor="end">' + esc(fmt(h.value)) + '</text>';
        y += 22;
      });
      bar(ins[h.id], 's', ins[h.id].reduce(function (a, l) { return a + l.v; }, 0));
      g += '<path d="M' + (W / 2 - 7) + ' ' + (y - 2) + 'l7 9 7-9" fill="none" stroke="var(--soft)" stroke-width="2"/>';
      y += 18;
      bar(outs[h.id], 't', outs[h.id].reduce(function (a, l) { return a + l.v; }, 0));
    });
    var H = Math.ceil(y);
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.label || '') + '">' + g + '</svg>';
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
    // on a narrow chart with many years, every other year is labelled, always keeping the last
    var every = (W - L - R) / Math.max(1, spec.x.length - 1) < 34 ? 2 : 1, lastI = spec.x.length - 1;
    spec.x.forEach(function (lab, i) { if ((lastI - i) % every) return; g += '<text class="tick" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lab) + '</text>'; });
    (spec.marks || []).forEach(function (m) {
      g += '<line x1="' + x(m.i) + '" x2="' + x(m.i) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--turmeric)" stroke-width="2" stroke-dasharray="2 4"/>' +
           '<text class="tick mark" x="' + (x(m.i) + (m.i === spec.x.length - 1 ? -6 : 6)) + '" y="' + (narrow && m.i === spec.x.length - 1 ? H - B - 8 : T + 10) + '" text-anchor="' + (m.i === spec.x.length - 1 ? 'end' : 'start') + '">' + esc(m.label) + '</text>';
    });
    var ends = [];
    spec.series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return v == null ? null : [x(i), y(v), v, i]; }).filter(Boolean);
      if (!pts.length) return;
      // a missing year breaks the line, so no line joins two years across a gap
      var d = '', prev = -2;
      pts.forEach(function (p) { d += (p[3] === prev + 1 ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); prev = p[3]; });
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
      if (r.label) {
        // a name too long for the label column is shortened, with the whole name in its tooltip
        var room = Math.floor((L - 12) / 6.6), lab = String(r.label), short = lab.length > room ? lab.slice(0, room - 1).replace(/\s+\S*$/, '') + '…' : lab;
        g += '<text class="tick" x="' + (L - 10) + '" y="' + (y + rowH / 2 + 5) + '" text-anchor="end"><title>' + esc(lab) + '</title>' + esc(short) + '</text>';
      }
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
    // Many single columns on a phone leave no room for their labels, so they lie on their side.
    if (narrow && spec.x.length > 5 && spec.series.length === 1) {
      var z = spec.series[0];
      return stack(el, { rows: spec.x.map(function (x, i) { return { label: x, parts: [{ key: 'v', value: z.values[i] }] }; }),
        keys: [{ key: 'v', label: z.label, color: z.color }], values: true, fmt: function (v) { return fmt(v); }, label: spec.label });
    }
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
    // spec.above puts each row's name on its own line over its cells on a phone, so long names are never cut
    var above = narrow && spec.above, lh = above ? 18 : 0;
    var L = above ? 0 : Math.min(narrow ? 128 : (spec.labelW || 190), W * 0.4), cell = (W - L - 4) / spec.x.length, rh = narrow ? 22 : (spec.rowH || 24), T = 22;
    var H = T + spec.rows.length * (rh + lh) + 6, vals = [];
    spec.rows.forEach(function (r) { r.values.forEach(function (v) { if (v != null) vals.push(v); }); });
    vals.sort(function (a, b) { return a - b; });
    var q = function (p) { return vals[Math.min(vals.length - 1, Math.floor(p * vals.length))]; };
    var cuts = [q(0.2), q(0.4), q(0.6), q(0.8)], ramp = ['--q1', '--q2', '--q3', '--q4', '--q5'];
    var bin = function (v) { var b = 0; cuts.forEach(function (c) { if (v > c) b++; }); return b; };
    // With rowScale, each row is shaded against its own highest year, so a rare
    // crime's change shows as plainly as a common one's.
    if (spec.rowScale) bin = function (v, row) { var mx = Math.max.apply(null, row.values.filter(function (q) { return q != null; })); return mx > 0 ? Math.min(4, Math.floor(v / mx * 5 - 1e-9)) : 0; };
    var g = '';
    spec.x.forEach(function (x, j) { g += '<text class="tick" x="' + (L + j * cell + cell / 2).toFixed(1) + '" y="14" text-anchor="middle">' + esc(x) + '</text>'; });
    spec.rows.forEach(function (r, i) {
      var y = T + i * (rh + lh) + lh;
      // a name too long for the label column is shortened, with the whole name in its tooltip
      var room = Math.floor((L - 12) / 6.6), lab = r.label.length > room ? r.label.slice(0, room - 1).replace(/\s+\S*$/, '') + '…' : r.label;
      if (above) g += '<text class="tick rowlab" x="0" y="' + (y - 5) + '">' + esc(r.label) + '</text>';
      else g += '<text class="tick rowlab" x="' + (L - 8) + '" y="' + (y + rh / 2 + 4) + '" text-anchor="end"><title>' + esc(r.label) + '</title>' + esc(lab) + '</text>';
      r.values.forEach(function (v, j) {
        var b = v == null ? -1 : bin(v, r), x = L + j * cell;
        g += '<rect x="' + (x + 1).toFixed(1) + '" y="' + (y + 1) + '" width="' + (cell - 2).toFixed(1) + '" height="' + (rh - 2) + '" fill="' + (b < 0 ? 'var(--ground)' : 'var(' + ramp[b] + ')') + '"><title>' +
          esc(r.label + ', ' + spec.x[j] + ': ' + (v == null ? '–' : fmt(v))) + '</title></rect>';
        if (v != null && cell > 40) g += '<text x="' + (x + cell / 2).toFixed(1) + '" y="' + (y + rh / 2 + 4) + '" text-anchor="middle" font-size="11" class="hv' + (b >= 3 ? ' dark' : '') + '">' + esc(fmt(v)) + '</text>';
      });
    });
    var edges = [vals[0]].concat(cuts).concat([vals[vals.length - 1]]);
    var key = spec.rowScale ? '<ul class="legend"><li>' + esc(spec.keyLow) + '</li>' + ramp.map(function (c) { return '<li><i style="background:var(' + c + ');border-radius:2px;margin:0"></i></li>'; }).join('') + '<li>' + esc(spec.keyHigh) + '</li></ul>'
      : '<ul class="legend">' + ramp.map(function (c, i) { return '<li><i style="background:var(' + c + ');border-radius:2px"></i>' + esc(fmt(edges[i]) + ' – ' + fmt(edges[i + 1])) + '</li>'; }).join('') + '</ul>';
    el.innerHTML = key + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
    el.__csv = [['place'].concat(spec.x)].concat(spec.rows.map(function (r) { return [r.label].concat(r.values); }));
  }

  // ---------- dumbbell ----------
  // spec: {rows: [{label, a, b}], aLabel, bLabel, fmt, label}. Each row on its
  // own scale from zero, because the crimes differ by orders of magnitude.
  function dumbbell(el, spec) {
    var W = width(el), narrow = W < 560, fmt = spec.fmt || String;
    // On a phone the name sits on its own line above its row, so it is never cut.
    var L = narrow ? 8 : Math.min(spec.labelW || 230, W * 0.42), R = 54, rh = narrow ? 50 : 30, T = 8;
    var H = T + spec.rows.length * rh + 6, g = '';
    spec.rows.forEach(function (r, i) {
      var y = T + i * rh + (narrow ? 34 : rh / 2), mx = spec.max || Math.max(r.a || 0, r.b || 0) * 1.12 || 1;
      var x = function (v) { return L + (W - L - R) * v / mx; };
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="var(--thread)"/>';
      if (narrow) g += '<text class="tick rowlab" x="0" y="' + (y - 14) + '">' + esc(r.label) + '</text>';
      else g += '<text class="tick rowlab" x="' + (L - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(r.label) + '</text>';
      if (r.a != null && r.b != null) g += '<line x1="' + x(r.a).toFixed(1) + '" x2="' + x(r.b).toFixed(1) + '" y1="' + y + '" y2="' + y + '" stroke="var(--soft)" stroke-width="3"/>';
      if (r.b != null) g += '<circle cx="' + x(r.b).toFixed(1) + '" cy="' + y + '" r="5.5" fill="var(--cloth)" stroke="var(--soft)" stroke-width="2"><title>' + esc(spec.bLabel + ': ' + fmt(r.b)) + '</title></circle>';
      if (r.a != null) g += '<circle cx="' + x(r.a).toFixed(1) + '" cy="' + y + '" r="6.5" fill="var(--red)"><title>' + esc(spec.aLabel + ': ' + fmt(r.a)) + '</title></circle>';
      g += '<text class="lab num" x="' + (W - R + 8) + '" y="' + (y + 4) + '">' + esc(r.a == null ? '–' : fmt(r.a)) + '</text>';
    });
    var key = '<ul class="legend"><li><i style="background:var(--red)"></i>' + esc(spec.aLabel) + '</li><li><i style="background:var(--cloth);box-shadow:inset 0 0 0 2px var(--soft)"></i>' + esc(spec.bLabel) + '</li></ul>';
    el.innerHTML = key + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
    el.__csv = [['', spec.aLabel, spec.bLabel]].concat(spec.rows.map(function (r) { return [r.label, r.a, r.b]; }));
  }



  // ---------- strip ----------
  // spec: {rows: [{label, dots: [{name, v}], hi, mark}], hiLabel, markLabel, fmt, label}.
  // One row per crime: every state as a small dot, this state as a large red
  // one and India as a line. Each row has its own scale from zero, and the
  // dots carry no rank. The point is where one place sits among the rest.
  function strip(el, spec, scale) {
    scale = scale || 1;
    var W = width(el), narrow = W < 560, fmt = spec.fmt || String;
    // The label column is as wide as the longest label, up to 40% of the chart;
    // a label longer than that goes onto two lines.
    var cv = document.createElement('canvas').getContext('2d');
    cv.font = '12.5px ' + getComputedStyle(el).fontFamily;
    var tw = function (s) { return cv.measureText(s).width * scale; };
    var cap = Math.floor(W * 0.4), longest = 0;
    spec.rows.forEach(function (r) { longest = Math.max(longest, tw(r.label)); });
    var L = narrow ? 4 : Math.min(cap, Math.ceil(longest) + 16), R = 58, T = 6, g = '';
    var lines = spec.rows.map(function (r) {
      if (narrow || tw(r.label) <= L - 16) return [r.label];
      for (var n = r.label.length; n > 4; n--) { var w = wrap(r.label, n); if (w.every(function (x) { return tw(x) <= L - 16; })) return w; }
      return wrap(r.label, 20);
    });
    var two = lines.some(function (x) { return x.length > 1; }), rh = narrow ? 52 : (two ? 40 : 34);
    var H = T + spec.rows.length * rh + 4;
    spec.rows.forEach(function (r, i) {
      var y = T + i * rh + (narrow ? 36 : rh / 2), mx = 0;
      r.dots.forEach(function (d) { if (d.v > mx) mx = d.v; });
      if (r.mark > mx) mx = r.mark; if (r.hi > mx) mx = r.hi; mx = mx * 1.04 || 1;
      var x = function (v) { return L + (W - L - R) * v / mx; };
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="var(--thread)"/>';
      if (narrow) g += '<text class="tick rowlab" x="0" y="' + (y - 14) + '">' + esc(r.label) + '</text>';
      else g += '<text class="tick rowlab" x="' + (L - 12) + '" y="' + (y + 4 - (lines[i].length - 1) * 7.5) + '" text-anchor="end">' +
        lines[i].map(function (ln, k) { return '<tspan x="' + (L - 12) + '"' + (k ? ' dy="15"' : '') + '>' + esc(ln) + '</tspan>'; }).join('') + '</text>';
      r.dots.forEach(function (d) {
        g += '<circle cx="' + x(d.v).toFixed(1) + '" cy="' + y + '" r="3.6" fill="var(--knot)" fill-opacity=".38"><title>' + esc(d.name + ': ' + fmt(d.v)) + '</title></circle>';
      });
      if (r.mark != null) g += '<line x1="' + x(r.mark).toFixed(1) + '" x2="' + x(r.mark).toFixed(1) + '" y1="' + (y - 9) + '" y2="' + (y + 9) + '" stroke="var(--ink)" stroke-width="2.5"><title>' + esc(spec.markLabel + ': ' + fmt(r.mark)) + '</title></line>';
      if (r.hi != null) g += '<circle cx="' + x(r.hi).toFixed(1) + '" cy="' + y + '" r="7" fill="var(--red)" stroke="var(--cloth)" stroke-width="2"><title>' + esc(spec.hiLabel + ': ' + fmt(r.hi)) + '</title></circle>';
      g += '<text class="lab num" x="' + (W - R + 10) + '" y="' + (y + 4) + '" fill="var(--red)">' + esc(r.hi == null ? '–' : fmt(r.hi)) + '</text>';
    });
    var key = '<ul class="legend"><li><i style="background:var(--red)"></i>' + esc(spec.hiLabel) + '</li><li><i style="background:var(--ink);width:3px;border-radius:0"></i>' + esc(spec.markLabel) + '</li><li><i style="background:var(--knot);opacity:.45"></i>' + esc(spec.dotLabel) + '</li></ul>';
    el.innerHTML = key + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
    el.__csv = [['', spec.hiLabel, spec.markLabel]].concat(spec.rows.map(function (r) { return [r.label, r.hi, r.mark]; }));
    // The canvas may measure in a fallback face before the page's own font has
    // loaded. Measure the drawn labels, and draw again if any is wider than its estimate.
    if (!narrow && scale < 3) {
      var worst = 1;
      el.querySelectorAll('text.rowlab tspan').forEach(function (t) {
        var est = tw(t.textContent); if (est > 0) worst = Math.max(worst, t.getComputedTextLength() / est);
      });
      if (worst > 1.01) strip(el, spec, scale * worst * 1.02);
    }
    // Drawing the labels can start a font download (the Indian-script faces load
    // only when a page needs them), so draw again once the fonts are in.
    if (scale === 1 && document.fonts && document.fonts.status === 'loading' && !el.__fontWait) {
      el.__fontWait = true;
      document.fonts.ready.then(function () { el.__fontWait = false; strip(el, spec); });
    }
  }

  // ---------- treemap ----------
  // spec: {items: [{label, value, color, ink}], fmt, label}. Squarified, so the
  // boxes stay close to square and their areas can be compared. Every box is
  // its share of the whole; the items must add to the whole.
  function treemap(el, spec) {
    var W = width(el), narrow = W < 560, H = narrow ? 420 : 440, fmt = spec.fmt || String;
    var items = spec.items.filter(function (d) { return d.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    var total = items.reduce(function (a, d) { return a + d.value; }, 0), k = W * H / total, out = [];
    function worst(row, side) {
      var s = row.reduce(function (a, d) { return a + d.value * k; }, 0), mx = 0, mn = Infinity;
      row.forEach(function (d) { mx = Math.max(mx, d.value * k); mn = Math.min(mn, d.value * k); });
      return Math.max(side * side * mx / (s * s), s * s / (side * side * mn));
    }
    function lay(row, box) {
      var s = row.reduce(function (a, d) { return a + d.value * k; }, 0);
      if (box.w >= box.h) { var w = s / box.h, y = box.y; row.forEach(function (d) { var h = d.value * k / w; out.push([d, box.x, y, w, h]); y += h; }); box.x += w; box.w -= w; }
      else { var h2 = s / box.w, x = box.x; row.forEach(function (d) { var ww = d.value * k / h2; out.push([d, x, box.y, ww, h2]); x += ww; }); box.y += h2; box.h -= h2; }
    }
    var box = { x: 0, y: 0, w: W, h: H }, row = [], rest = items.slice();
    while (rest.length) {
      var side = Math.min(box.w, box.h), d = rest[0];
      if (!row.length || worst(row.concat([d]), side) <= worst(row, side)) { row.push(d); rest.shift(); }
      else { lay(row, box); row = []; }
    }
    if (row.length) lay(row, box);
    var g = '';
    out.forEach(function (o) {
      var d = o[0], x = o[1], y = o[2], w = o[3], h = o[4], pct = d.value / total * 100;
      var txt = d.ink || 'var(--cloth)';
      g += '<rect x="' + (x + 1).toFixed(1) + '" y="' + (y + 1).toFixed(1) + '" width="' + Math.max(0.5, w - 2).toFixed(1) + '" height="' + Math.max(0.5, h - 2).toFixed(1) + '" fill="' + tok(d.color) + '"><title>' +
        esc(d.label + ': ' + fmt(d.value) + ' (' + pct.toFixed(1) + '%)') + '</title></rect>';
      var lines = wrap(d.label, Math.max(6, Math.floor((w - 14) / 7.6))), need = lines.length * 16 + 22;
      if (w > 64 && h > need) {
        lines.forEach(function (ln, j) { g += '<text class="tml" x="' + (x + 8).toFixed(1) + '" y="' + (y + 20 + j * 16).toFixed(1) + '" fill="' + txt + '">' + esc(ln) + '</text>'; });
        g += '<text class="tml num" x="' + (x + 8).toFixed(1) + '" y="' + (y + 22 + lines.length * 16).toFixed(1) + '" fill="' + txt + '">' + esc(fmt(d.value)) + ' · ' + (pct < 1 ? pct.toFixed(1) : Math.round(pct)) + '%</text>';
      } else if (w > 34 && h > 20) {
        g += '<text class="tml num" x="' + (x + 5).toFixed(1) + '" y="' + (y + 16).toFixed(1) + '" fill="' + txt + '">' + (pct < 1 ? pct.toFixed(1) : Math.round(pct)) + '%</text>';
      }
    });
    // every box is named in the key under the chart, so a box too small for its name is still found
    var key = '<ul class="tmkey">' + items.map(function (d) { return '<li><i style="background:' + tok(d.color) + '"></i><span>' + esc(d.label) + '</span><b>' + esc(fmt(d.value)) + '</b></li>'; }).join('') + '</ul>';
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>' + key;
    el.__csv = [['heading', 'cases', 'share %']].concat(items.map(function (d) { return [d.label, d.value, (d.value / total * 100).toFixed(2)]; }));
  }

  // ---------- tile map ----------
  // spec: {tiles: [{code, name, col, row, values, last, href}], x: [years], fmt, label}.
  // One square per state or union territory, placed roughly where it lies, each
  // with its own five years as a line on its own scale. Equal squares, so a
  // small territory is as easy to read as a large state.
  function tiles(el, spec) {
    var W = width(el), cols = 10, rows = 8, gap = 3, s = Math.min(78, (W - gap * (cols - 1)) / cols), fmt = spec.fmt || String;
    var Wd = cols * s + (cols - 1) * gap, H = rows * s + (rows - 1) * gap, g = '', big = s >= 54;
    spec.tiles.forEach(function (t) {
      var x = t.col * (s + gap), y = t.row * (s + gap), v = t.values.filter(function (q) { return q != null; });
      var up = v.length > 1 && v[v.length - 1] > v[0];
      g += '<a href="' + esc(t.href) + '"><title>' + esc(t.name + ': ' + t.values.map(function (q, i) { return spec.x[i] + ' ' + (q == null ? '–' : fmt(q)); }).join(', ')) + '</title>' +
        '<rect class="tile" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + s.toFixed(1) + '" height="' + s.toFixed(1) + '" rx="3"/>' +
        '<text class="tcode" x="' + (x + 5).toFixed(1) + '" y="' + (y + (big ? 15 : 12)).toFixed(1) + '" font-size="' + (big ? 12 : 10) + '">' + esc(t.code) + '</text>';
      if (big && t.last != null) g += '<text class="tval" x="' + (x + s - 5).toFixed(1) + '" y="' + (y + 15).toFixed(1) + '" text-anchor="end">' + esc(fmt(t.last)) + '</text>';
      if (v.length > 1) {
        var mx = Math.max.apply(null, v), mn = Math.min.apply(null, v), top = y + (big ? 24 : 17), bot = y + s - 6, l = x + 5, r = x + s - 5;
        var pts = t.values.map(function (q, i) { return q == null ? null : [l + i * (r - l) / (t.values.length - 1), bot - (mx === mn ? 0.5 : (q - mn) / (mx - mn)) * (bot - top)]; }).filter(Boolean);
        g += '<path d="' + pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('') + '" fill="none" stroke="' + (up ? 'var(--red)' : 'var(--knot)') + '" stroke-width="' + (big ? 2 : 1.5) + '" stroke-linejoin="round"/>';
        var e = pts[pts.length - 1];
        g += '<circle cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="' + (big ? 2.6 : 2) + '" fill="' + (up ? 'var(--red)' : 'var(--knot)') + '"/>';
      }
      g += '</a>';
    });
    el.innerHTML = '<svg viewBox="0 0 ' + Wd.toFixed(0) + ' ' + H.toFixed(0) + '" width="' + Wd.toFixed(0) + '" height="' + H.toFixed(0) + '" role="group" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
    el.__csv = [['place'].concat(spec.x)].concat(spec.tiles.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (t) { return [t.name].concat(t.values); }));
  }

  // ---------- swarm ----------
  // spec: {rows: [{label, dots: [{name, v}], mark}], markLabel, fmt, label}.
  // One row per year, one dot per state, piled sideways where dots would
  // overlap. The line in each row is India as a whole. Dots carry no rank.
  function swarm(el, spec) {
    var W = width(el), narrow = W < 560, fmt = spec.fmt || String, L = 46, R = 14, T = 8, r = narrow ? 3.5 : 5, band = narrow ? 92 : 80;
    var max = 0;
    spec.rows.forEach(function (row) { row.dots.forEach(function (d) { if (d.v > max) max = d.v; }); if (row.mark > max) max = row.mark; });
    var nice = niceMax(max), x = function (v) { return L + (W - L - R) * v / nice; };
    var H = T + spec.rows.length * band + 26, g = '';
    for (var t = 0; t <= 4; t++) {
      var v = nice * t / 4, xx = x(v);
      g += '<line x1="' + xx + '" x2="' + xx + '" y1="' + T + '" y2="' + (H - 22) + '" stroke="var(--thread)"' + (t ? ' stroke-dasharray="3 5"' : '') + '/>' +
        '<text class="tick" x="' + xx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(fmt(v, true)) + '</text>';
    }
    spec.rows.forEach(function (row, i) {
      var cy = T + i * band + band / 2, placed = [];
      g += '<text class="tick" x="0" y="' + (cy + 4) + '">' + esc(row.label) + '</text>';
      row.dots.slice().sort(function (a, b) { return a.v - b.v; }).forEach(function (d) {
        var px = x(d.v), y = cy, k2 = 0;
        // try the centre line, then alternate above and below until the dot is clear
        while (placed.some(function (p) { return (p[0] - px) * (p[0] - px) + (p[1] - y) * (p[1] - y) < (2 * r + 1) * (2 * r + 1); }) && k2 < 40) {
          k2++; y = cy + (k2 % 2 ? -1 : 1) * Math.ceil(k2 / 2) * (r * 0.9);
        }
        placed.push([px, y]);
        g += '<circle cx="' + px.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="var(--knot)" fill-opacity=".72" stroke="var(--cloth)" stroke-width="1"><title>' + esc(d.name + ', ' + row.label + ': ' + fmt(d.v)) + '</title></circle>';
      });
      if (row.mark != null) g += '<line x1="' + x(row.mark).toFixed(1) + '" x2="' + x(row.mark).toFixed(1) + '" y1="' + (cy - band / 2 + 6) + '" y2="' + (cy + band / 2 - 6) + '" stroke="var(--red)" stroke-width="3"><title>' + esc(spec.markLabel + ', ' + row.label + ': ' + fmt(row.mark)) + '</title></line>';
    });
    var key = '<ul class="legend"><li><i style="background:var(--knot)"></i>' + esc(spec.dotLabel) + '</li><li><i style="background:var(--red);border-radius:1px;width:4px"></i>' + esc(spec.markLabel) + '</li></ul>';
    el.innerHTML = key + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.label || '') + '">' + g + '</svg>';
    var names = spec.rows[0].dots.map(function (d) { return d.name; }).sort();
    el.__csv = [['place'].concat(spec.rows.map(function (r2) { return r2.label; }))].concat(names.map(function (n) {
      return [n].concat(spec.rows.map(function (r2) { var d = r2.dots.find(function (q) { return q.name === n; }); return d ? d.v : ''; })); }))
      .concat([[spec.markLabel].concat(spec.rows.map(function (r2) { return r2.mark; }))]);
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
    return '<div class="iso" aria-hidden="true">' + out + '</div>';
  }

  window.WOR_CHARTS = { strip: strip, treemap: treemap, tiles: tiles, swarm: swarm, wrap: wrap, columns: columns, heat: heat, dumbbell: dumbbell, savePng: savePng, saveSvg: saveSvg, saveCsv: saveCsv, woman: woman, hundred: hundred, iso: iso, flow: flow, lines: lines, stack: stack, slope: slope, watch: watch, niceMax: niceMax };
})();
