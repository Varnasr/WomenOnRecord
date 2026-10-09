/* She Counts. Reads data/site.json (built from data/shecounts.csv) and the
   DataMeet state map, and draws everything without a library. Every sentence
   that carries a number is computed here from the data. */
(function () {
  'use strict';
  var D = null, GEO = null, Y = 0;
  var I = window.SC_I18N;
  var lang = 'en';
  var st = { field: 'RAPE', fir: 'RAPE', head: 'RAPE', year: null, measure: 'rate', state: 'Bihar' };
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';

  // ---------- language ----------
  function t(key, vars) {
    var d = I.dict[lang] || {}, s = d[key];
    if (s == null) s = I.dict.en[key];
    if (s == null) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
  }
  function head(code) { return t('head.' + code) !== 'head.' + code ? t('head.' + code) : D.heads[code].label; }
  function place(id) {
    var p = D.places.find(function (x) { return x.id === id; });
    var k = 'st.' + id, v = (I.dict[lang] || {})[k];
    return v || (p ? p.name : id);
  }
  function fmt(n, dp) {
    if (n == null) return '–';
    return Number(n).toLocaleString('en-IN', { maximumFractionDigits: dp == null ? 1 : dp, minimumFractionDigits: dp || 0 });
  }
  function setLang(l) {
    lang = I.dict[l] ? l : 'en';
    var meta = I.langs[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
    if (meta.font && !document.getElementById('font-' + lang)) {
      var ln = document.createElement('link');
      ln.id = 'font-' + lang; ln.rel = 'stylesheet'; ln.href = meta.font;
      document.head.appendChild(ln);
    }
    $('lang').value = lang;
    $('tnote').hidden = lang === 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    try { localStorage.setItem('sc-lang', lang); } catch (e) {}
    var u = new URL(location.href);
    if (lang === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang);
    history.replaceState(null, '', u);
    if (D) renderAll();
  }

  // ---------- data helpers ----------
  function S(code, measure, place, y) {
    var c = D.series[code]; if (!c || !c[measure] || !c[measure][place]) return null;
    return c[measure][place][y == null ? Y : D.years.indexOf(y)];
  }
  function row(code, measure, place) {
    var c = D.series[code]; return c && c[measure] && c[measure][place] ? c[measure][place] : null;
  }
  var STATES = function () { return D.places.filter(function (p) { return p.kind !== 'total'; }); };

  // ---------- hero ----------
  function hero() {
    var y = 2024;
    var rape = S('RAPE', 'cases', 'All India', y), pocso = S('POCSO_RAPE', 'cases', 'All India', y);
    var tot = S('TOTAL', 'cases', 'All India', y);
    var before = S('RAPE', 'court_total_for_trial', 'All India', y), pend = S('RAPE', 'court_pending_trial_end_of_year', 'All India', y);
    var out = [
      [fmt(tot, 0), t('hero.f1', { y: y })],
      [fmt(rape, 0), t('hero.f2', { y: y })],
      [fmt(pocso, 0), t('hero.f3', { y: y })],
      [Math.round(pend / before * 100) + ' / 100', t('hero.f4', { y: y })]
    ];
    $('heroFigs').innerHTML = out.map(function (f) { return '<div class="fig"><b>' + f[0] + '</b><span>' + f[1] + '</span></div>'; }).join('');
  }

  // ---------- dot field ----------
  var FIELD = [['RAPE', 100], ['POCSO_RAPE', 100], ['TOTAL', 1000]];
  function tabs(box, list, key, on) {
    box.innerHTML = '';
    list.forEach(function (code) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(st[key] === code));
      b.textContent = t('tab.' + code);
      b.addEventListener('click', function () { st[key] = code; on(); });
      box.appendChild(b);
    });
  }
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function field() {
    tabs($('fieldTabs'), FIELD.map(function (f) { return f[0]; }), 'field', field);
    var per = FIELD.find(function (f) { return f[0] === st.field; })[1];
    var y = 2024, c = st.field;
    var total = S(c, 'court_total_for_trial', 'All India', y);
    var conv = S(c, 'court_convicted', 'All India', y);
    var acq = S(c, 'court_acquitted', 'All India', y) + S(c, 'court_discharged', 'All India', y);
    var pend = S(c, 'court_pending_trial_end_of_year', 'All India', y);
    var other = Math.max(0, total - conv - acq - pend);
    var n = { conv: Math.round(conv / per), acq: Math.round(acq / per), other: Math.round(other / per), pend: Math.round(pend / per) };
    var knots = [];
    ['conv', 'acq', 'other', 'pend'].forEach(function (k) { for (var i = 0; i < n[k]; i++) knots.push(k); });
    $('courtsIntro').textContent = t('courts.intro', { n: fmt(total, 0), crime: t('tab.' + c).toLowerCase(), y: y });
    $('fieldCap').innerHTML = t('field.cap', { per: fmt(per, 0), crime: t('tab.' + c).toLowerCase(), conv: '<b>' + fmt(conv, 0) + '</b>', pend: fmt(pend, 0), share: Math.round(pend / total * 100), y: y });
    $('field').setAttribute('aria-label', $('fieldCap').textContent);
    var leg = [['conv', t('leg.conv'), 'var(--red)', fmt(conv, 0)], ['acq', t('leg.acq'), 'transparent', fmt(acq, 0)],
               ['other', t('leg.other'), 'var(--knot-open)', fmt(other, 0)], ['pend', t('leg.pend'), 'var(--knot)', fmt(pend, 0)]];
    $('fieldLegend').innerHTML = leg.map(function (l) {
      var ring = l[0] === 'acq' ? ';box-shadow:inset 0 0 0 2px var(--red)' : '';
      return '<li><i style="background:' + l[2] + ring + '"></i>' + l[1] + ' · ' + l[3] + '</li>';
    }).join('') + '<li>' + t('leg.per', { per: fmt(per, 0) }) + '</li>';
    drawField(knots);
  }
  function drawField(knots) {
    var cv = $('field'), w = cv.clientWidth || 900, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var gap = w < 520 ? 9.5 : 12, r = gap * 0.3;
    var cols = Math.max(10, Math.floor((w - gap) / gap)), rows = Math.ceil(knots.length / cols);
    var h = rows * gap + gap * 0.6;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    var col = { conv: cssv('--red'), pend: cssv('--knot'), other: cssv('--knot-open'), thread: cssv('--thread') };
    // running stitch under every row, as on kantha cloth
    g.strokeStyle = col.thread; g.lineWidth = 1; g.setLineDash([5, 4]);
    for (var rr = 0; rr < rows; rr++) {
      var yy = rr * gap + gap * 0.55 + gap * 0.42;
      g.beginPath(); g.moveTo(gap * 0.2, yy); g.lineTo(w - gap * 0.2, yy); g.stroke();
    }
    g.setLineDash([]);
    knots.forEach(function (k, i) {
      var rr = Math.floor(i / cols), cc = i % cols;
      var x = cc * gap + gap * 0.6 + (rr % 2 ? gap * 0.35 : 0), y = rr * gap + gap * 0.55;
      if (x > w - r) return;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
      if (k === 'acq') { g.lineWidth = 1.6; g.strokeStyle = col.conv; g.stroke(); return; }
      g.fillStyle = col[k]; g.fill();
      // the turn of thread in a French knot
      g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.38, 0, Math.PI * 1.4);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.8; g.stroke();
    });
  }

  // ---------- after the FIR ----------
  var FIR = ['RAPE', 'POCSO_RAPE', 'MURDER_RAPE', 'DOWRY_DEATH', 'CRUELTY', 'TOTAL'];
  function fir() {
    tabs($('firTabs'), FIR, 'fir', fir);
    var c = st.fir, cols = [
      ['police_reported', 'fir.c1', 0], ['police_chargesheeting_rate', 'fir.c2', 1], ['police_pending_investigation_end_of_year', 'fir.c3', 0],
      ['court_total_for_trial', 'fir.c4', 0], ['court_trials_completed', 'fir.c5', 0], ['court_convicted', 'fir.c6', 0],
      ['court_conviction_rate', 'fir.c7', 1], ['court_pending_trial_end_of_year', 'fir.c8', 0]];
    var h = '<caption class="sr">' + head(c) + '</caption><thead><tr><th scope="col">' + t('year') + '</th>' +
      cols.map(function (x) { return '<th scope="col">' + t(x[1]) + '</th>'; }).join('') + '</tr></thead><tbody>';
    D.years.forEach(function (y) {
      h += '<tr><th scope="row">' + y + '</th>' + cols.map(function (x) {
        var v = S(c, x[0], 'All India', y), pct = x[0].indexOf('rate') > 0;
        return '<td' + (x[0] === 'court_conviction_rate' ? ' class="hl"' : '') + '>' + fmt(v, x[2]) + (pct && v != null ? '%' : '') + '</td>';
      }).join('') + '</tr>';
    });
    $('firTable').innerHTML = h + '</tbody>';
  }

  // ---------- map and ranking ----------
  var MAPHEADS = ['TOTAL', 'RAPE', 'POCSO_RAPE', 'ATTEMPT_RAPE', 'ASSAULT_MODESTY', 'MURDER_WOMEN', 'MURDER_RAPE', 'DOWRY_DEATH',
                  'ABETMENT_SUICIDE', 'CRUELTY', 'KIDNAP', 'ACID', 'CYBER'];
  function mapValue(code, p, y) {
    if (code === 'MURDER_WOMEN') {
      var v = S(code, 'victims', p, y), pop = S('FEMALE_POP', 'population_lakh', p, y);
      return st.measure === 'rate' ? (v != null && pop ? Math.round(v / pop * 100) / 100 : null) : v;
    }
    return S(code, st.measure, p, y);
  }
  var projected = null;
  function project() {
    var minx = 180, maxx = -180, miny = 90, maxy = -90;
    function walk(c, f) { if (typeof c[0] === 'number') f(c); else c.forEach(function (d) { walk(d, f); }); }
    GEO.features.forEach(function (ft) { walk(ft.geometry.coordinates, function (p) {
      minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }); });
    var k = Math.cos((miny + maxy) / 2 * Math.PI / 180), W = 600, sc = W / ((maxx - minx) * k), H = (maxy - miny) * sc;
    projected = { W: W, H: H, paths: GEO.features.map(function (ft) {
      var d = '';
      (ft.geometry.type === 'Polygon' ? [ft.geometry.coordinates] : ft.geometry.coordinates).forEach(function (poly) {
        poly.forEach(function (ring) {
          ring.forEach(function (p, i) { d += (i ? 'L' : 'M') + ((p[0] - minx) * k * sc).toFixed(1) + ' ' + ((maxy - p[1]) * sc).toFixed(1); });
          d += 'Z';
        });
      });
      return { name: ft.properties.name, d: d };
    }) };
  }
  var RAMP = ['--q1', '--q2', '--q3', '--q4', '--q5'];
  function map() {
    var hs = $('mapHead'), ys = $('mapYear');
    hs.innerHTML = MAPHEADS.map(function (c) { return '<option value="' + c + '">' + head(c) + '</option>'; }).join('');
    hs.value = st.head;
    ys.innerHTML = D.years.slice().reverse().map(function (y) { return '<option>' + y + '</option>'; }).join('');
    ys.value = st.year;
    $('mapMeasure').value = st.measure;
    var vals = STATES().map(function (p) { return [p, mapValue(st.head, p.id, st.year)]; });
    var nums = vals.map(function (v) { return v[1]; }).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
    var cuts = [0.2, 0.4, 0.6, 0.8].map(function (q) { return nums[Math.min(nums.length - 1, Math.floor(q * nums.length))]; });
    function bin(v) { if (v == null) return -1; var b = 0; cuts.forEach(function (c) { if (v > c) b++; }); return b; }
    var byMap = {}; vals.forEach(function (v) { byMap[v[0].map] = v; });
    var svg = $('map'); svg.setAttribute('viewBox', '0 0 ' + projected.W + ' ' + projected.H.toFixed(0)); svg.innerHTML = '';
    projected.paths.forEach(function (pp) {
      var v = byMap[pp.name], el = document.createElementNS(NS, 'path');
      el.setAttribute('d', pp.d);
      var b = v ? bin(v[1]) : -1;
      el.setAttribute('fill', b < 0 ? 'var(--ground)' : 'var(' + RAMP[b] + ')');
      if (v) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        var label = place(v[0].id) + ': ' + (v[1] == null ? t('nodata') : fmt(v[1], st.measure === 'rate' ? 1 : 0));
        el.setAttribute('aria-label', label);
        var ti = document.createElementNS(NS, 'title'); ti.textContent = label; el.appendChild(ti);
        if (v[0].id === st.state) el.classList.add('on');
        var go = function () { st.state = v[0].id; renderState(true); map(); };
        el.addEventListener('click', go);
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      }
      svg.appendChild(el);
    });
    var india = mapValue(st.head, 'All India', st.year);
    var unit = st.measure === 'rate' ? t('unit.rate') : t('unit.cases');
    $('mapCap').textContent = t('map.cap', { crime: head(st.head), y: st.year, unit: unit, india: fmt(india, st.measure === 'rate' ? 1 : 0) });
    var edges = [nums[0]].concat(cuts).concat([nums[nums.length - 1]]);
    $('mapScale').innerHTML = RAMP.map(function (r, i) {
      return '<span><i style="background:var(' + r + ')"></i>' + fmt(edges[i], 1) + ' to ' + fmt(edges[i + 1], 1) + '</span>';
    }).join('') + '<span><i style="background:var(--ground);outline:1px dashed var(--thread)"></i>' + t('nodata') + '</span>';
    // ranking
    var list = vals.filter(function (v) { return v[1] != null; }).sort(function (a, b) { return b[1] - a[1]; });
    var max = list.length ? list[0][1] : 1, h = '', placed = false, i = 0;
    function li(p, v, n, cls) {
      return '<li class="' + cls + '"><button type="button" data-p="' + p + '"' + (p === st.state ? ' class="on"' : '') + '><span class="n">' + n + '</span><span>' +
        place(p) + '</span><span class="v">' + fmt(v, st.measure === 'rate' ? 1 : 0) + '</span><span class="bar" style="width:' + (v / max * 100).toFixed(1) + '%"></span></button></li>';
    }
    list.forEach(function (v) {
      if (!placed && india != null && st.measure === 'rate' && india >= v[1]) { h += li('All India', india, '', 'india'); placed = true; }
      h += li(v[0].id, v[1], ++i, '');
    });
    if (!placed && st.measure === 'rate' && india != null) h += li('All India', india, '', 'india');
    $('rank').innerHTML = h;
    $('rank').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { if (b.dataset.p === 'All India') return; st.state = b.dataset.p; renderState(true); map(); });
    });
  }

  // ---------- one state ----------
  var GROUPS = [['sexual', ['RAPE', 'RAPE_WOMEN', 'RAPE_GIRLS_IPC', 'POCSO_RAPE', 'POCSO_ASSAULT', 'POCSO_TOTAL', 'ATTEMPT_RAPE', 'ASSAULT_MODESTY', 'INSULT_MODESTY']],
                ['killed', ['MURDER_WOMEN', 'MURDER_RAPE', 'DOWRY_DEATH', 'ABETMENT_SUICIDE']],
                ['home', ['CRUELTY', 'DOWRY_ACT', 'PWDVA']],
                ['other', ['KIDNAP', 'ACID', 'ACID_ATTEMPT', 'TRAFFICKING', 'ITPA', 'CYBER']],
                ['total', ['IPC_TOTAL', 'SLL_TOTAL', 'TOTAL']]];
  function spark(vals) {
    var v = vals.filter(function (x) { return x != null; }); if (v.length < 2) return '';
    var mx = Math.max.apply(null, v), mn = Math.min.apply(null, v), W = 70, H = 20;
    var pts = vals.map(function (x, i) { return x == null ? null : [i / (vals.length - 1) * (W - 6) + 3, H - 3 - (mx === mn ? 0.5 : (x - mn) / (mx - mn)) * (H - 6)]; });
    var d = pts.filter(Boolean).map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    var last = pts[pts.length - 1];
    return '<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + d +
      '" fill="none" stroke="var(--knot)" stroke-width="1.6"/>' + (last ? '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.4" fill="var(--red)"/>' : '') + '</svg>';
  }
  function cases(code, p) { return code === 'MURDER_WOMEN' ? row(code, 'victims', p) : row(code, 'cases', p); }
  function rate(code, p, y) {
    if (code === 'MURDER_WOMEN') { var v = S(code, 'victims', p, y), pop = S('FEMALE_POP', 'population_lakh', p, y); return v != null && pop ? v / pop : null; }
    return S(code, 'rate', p, y);
  }
  function renderState(scroll) {
    var p = st.state, sel = $('statePick');
    sel.innerHTML = STATES().map(function (x) { return '<option value="' + x.id + '">' + place(x.id) + '</option>'; }).join('');
    sel.value = p;
    $('h-state').textContent = place(p);
    var pop = S('FEMALE_POP', 'population_lakh', p, 2024);
    var tot = S('TOTAL', 'cases', p, 2024), r = S('TOTAL', 'rate', p, 2024), ri = S('TOTAL', 'rate', 'All India', 2024);
    $('stateIntro').textContent = t('state.intro', { s: place(p), pop: fmt(pop, 1), tot: fmt(tot, 0), r: fmt(r, 1), ri: fmt(ri, 1) });
    var h = '<thead><tr><th scope="col">' + t('crime') + '</th>' + D.years.map(function (y) { return '<th scope="col">' + y + '</th>'; }).join('') +
      '<th scope="col">' + t('trend') + '</th><th scope="col">' + t('rate24') + '</th><th scope="col">' + t('india24') + '</th></tr></thead><tbody>';
    GROUPS.forEach(function (g) {
      h += '<tr class="group"><th colspan="9" scope="rowgroup">' + t('group.' + g[0]) + '</th></tr>';
      g[1].forEach(function (code) {
        var vals = cases(code, p); if (!vals) return;
        var law = [D.heads[code].ipc ? 'IPC ' + D.heads[code].ipc : '', D.heads[code].bns || ''].filter(Boolean).join(' · ');
        h += '<tr><th scope="row">' + head(code) + (law ? '<span class="sub">' + law + '</span>' : '') + '</th>' +
          vals.map(function (v) { return '<td>' + fmt(v, 0) + '</td>'; }).join('') + '<td>' + spark(vals) + '</td>' +
          '<td class="hl">' + fmt(rate(code, p, 2024), 2) + '</td><td>' + fmt(rate(code, 'All India', 2024), 2) + '</td></tr>';
      });
    });
    $('stateTable').innerHTML = h + '</tbody>';
    var oc = [['POLICE', 'reported', 'o.reported', 0], ['POLICE', 'chargesheeting_rate', 'o.cs', 1], ['POLICE', 'pending_investigation_end_of_year', 'o.pinv', 0],
              ['COURTS', 'total_for_trial', 'o.trial', 0], ['COURTS', 'convicted', 'o.conv', 0], ['COURTS', 'conviction_rate', 'o.cr', 1],
              ['COURTS', 'pending_trial_end_of_year', 'o.ptrial', 0], ['COURTS', 'court_pendency', 'o.cp', 1]];
    var o = '<thead><tr><th scope="col">' + t('year') + '</th>' + oc.map(function (x) { return '<th scope="col">' + t(x[2]) + '</th>'; }).join('') + '</tr></thead><tbody>';
    D.years.forEach(function (y) {
      o += '<tr><th scope="row">' + y + '</th>' + oc.map(function (x) {
        var v = S(x[0], x[1], p, y), pct = /rate|pendency/.test(x[1]);
        return '<td' + (x[1] === 'conviction_rate' ? ' class="hl"' : '') + '>' + fmt(v, x[3]) + (pct && v != null ? '%' : '') + '</td>';
      }).join('') + '</tr>';
    });
    $('stateOutcomes').innerHTML = o + '</tbody>';
    if (scroll) { $('state').scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#s-' + slug(p)); }
  }
  function slug(s) { return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // ---------- small multiples ----------
  var MULT = ['RAPE', 'POCSO_RAPE', 'ATTEMPT_RAPE', 'ASSAULT_MODESTY', 'INSULT_MODESTY', 'MURDER_WOMEN', 'MURDER_RAPE', 'DOWRY_DEATH',
              'ABETMENT_SUICIDE', 'CRUELTY', 'DOWRY_ACT', 'PWDVA', 'KIDNAP', 'ACID', 'ITPA', 'CYBER', 'TOTAL'];
  function multiples() {
    $('multiples').innerHTML = MULT.map(function (code) {
      var vals = cases(code, 'All India'); if (!vals) return '';
      var mx = Math.max.apply(null, vals.filter(function (v) { return v != null; })) * 1.15, W = 240, H = 90, L = 4, B = 18;
      var pts = vals.map(function (v, i) { return v == null ? null : [L + i * (W - 2 * L - 30) / 4, H - B - v / mx * (H - B - 6)]; });
      var d = pts.filter(Boolean).map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
      var g = '<line x1="' + L + '" x2="' + (W - 30) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--thread)" stroke-dasharray="5 4"/>';
      g += '<path d="' + d + '" fill="none" stroke="var(--knot)" stroke-width="2"/>';
      pts.forEach(function (p, i) { if (p) g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === 4 ? 4 : 2.6) + '" fill="' + (i === 4 ? 'var(--red)' : 'var(--knot)') + '"/>'; });
      g += '<text x="' + L + '" y="' + (H - 3) + '" font-size="11" fill="var(--soft)">2020</text><text x="' + (W - 30) + '" y="' + (H - 3) + '" font-size="11" fill="var(--soft)" text-anchor="end">2024</text>';
      var first = vals[0], last = vals[4], ch = first ? Math.round((last - first) / first * 100) : null;
      var note = (D.notes[code] || {})['2024'];
      var law = [D.heads[code].ipc ? 'IPC ' + D.heads[code].ipc : '', D.heads[code].bns || ''].filter(Boolean).join(' · ');
      return '<figure class="mult cloth"><h3>' + head(code) + '</h3>' + (law ? '<span class="law">' + law + '</span>' : '') +
        '<span class="last">' + fmt(last, 0) + '</span>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + head(code) + ': ' + vals.map(fmt).join(', ') + '">' + g + '</svg>' +
        '<p>' + t('mult.p', { a: fmt(first, 0), b: fmt(last, 0), ch: (ch > 0 ? '+' : '') + ch }) + (note ? ' ' + note : '') + '</p></figure>';
    }).join('');
  }

  function sources() {
    $('srcList').innerHTML = D.years.map(function (y) {
      var s = D.sources[String(y)];
      return '<li>' + s.title + ' · ' + t('src.via') + ' ' + s.mirror + ' · <a href="' + s.url + '">PDF</a><br><code>sha256 ' + s.sha256 + '</code></li>';
    }).join('');
  }

  function renderAll() { hero(); field(); fir(); map(); renderState(false); multiples(); sources(); }

  // ---------- start ----------
  function init() {
    var q = new URL(location.href).searchParams.get('lang'), saved = null;
    try { saved = localStorage.getItem('sc-lang'); } catch (e) {}
    var ready = function (l) { return l === 'en' || Object.keys(I.dict[l] || {}).length >= Object.keys(I.dict.en).length; };
    Array.prototype.slice.call($('lang').options).forEach(function (o) { if (!ready(o.value)) o.remove(); });
    lang = ready(q) ? q : (ready(saved) ? saved : 'en');
    $('lang').addEventListener('change', function () { setLang(this.value); });
    var th = $('theme');
    function dark() { var d = document.documentElement.dataset.theme; return d ? d === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
    th.setAttribute('aria-pressed', String(dark()));
    th.addEventListener('click', function () {
      var next = dark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = next; th.setAttribute('aria-pressed', String(next === 'dark'));
      try { localStorage.setItem('sc-theme', next); } catch (e) {}
      field(); map();
    });
    $('mapHead').addEventListener('change', function () { st.head = this.value; map(); });
    $('mapYear').addEventListener('change', function () { st.year = +this.value; map(); });
    $('mapMeasure').addEventListener('change', function () { st.measure = this.value; map(); });
    $('statePick').addEventListener('change', function () { st.state = this.value; renderState(false); map(); history.replaceState(null, '', '#s-' + slug(st.state)); });
    Promise.all([fetch('data/site.json').then(function (r) { return r.json(); }), fetch('data/geo/india.json').then(function (r) { return r.json(); })])
      .then(function (res) {
        D = res[0]; GEO = res[1]; Y = D.years.length - 1; st.year = D.years[Y];
        var m = location.hash.match(/^#s-(.+)$/);
        if (m) { var hit = D.places.find(function (p) { return slug(p.id) === m[1]; }); if (hit) st.state = hit.id; }
        project(); setLang(lang);
        if (m) $('state').scrollIntoView();
        var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(field, 150); });
      })
      .catch(function () { $('heroFigs').innerHTML = '<p>' + t('err') + '</p>'; });
  }
  init();
})();
