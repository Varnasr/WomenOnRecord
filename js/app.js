/* She Counts. Reads data/site.json (built from data/shecounts.csv) and, on the
   states page, the DataMeet state map. Each page carries data-page on <body>
   and this script draws only what that page holds. Every sentence that
   carries a number is computed here from the data. */
(function () {
  'use strict';
  var D = null, GEO = null;
  var I = window.SC_I18N, C = window.SC_CHARTS;
  var lang = 'en';
  var body = document.body, PAGE = body.dataset.page;
  var st = { crime: 'RAPE', year: 2024, head: 'RAPE', measure: 'rate', ob: 'all', mult: 'cases', trend: 'cases', sort: null };
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var CRIMES = ['RAPE', 'POCSO_RAPE', 'ATTEMPT_RAPE', 'ASSAULT_MODESTY', 'INSULT_MODESTY', 'MURDER_WOMEN', 'MURDER_RAPE', 'DOWRY_DEATH',
                'ABETMENT_SUICIDE', 'CRUELTY', 'DOWRY_ACT', 'PWDVA', 'KIDNAP', 'ACID', 'ITPA', 'CYBER', 'TOTAL'];
  var FIR = ['RAPE', 'POCSO_RAPE', 'MURDER_RAPE', 'DOWRY_DEATH', 'CRUELTY', 'TOTAL'];

  // ---------- language ----------
  function t(key, vars) {
    var d = I.dict[lang] || {}, s = d[key];
    if (s == null) s = I.dict.en[key];
    if (s == null) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
  }
  function head(code) { return t('head.' + code) !== 'head.' + code ? t('head.' + code) : D.heads[code].label; }
  function crimeName(code) { var k = 'tab.' + code; return t(k) !== k ? t(k) : head(code); }
  // Lower-case a name for use inside a sentence, leaving acronyms such as POCSO alone.
  function lc(s) { return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function place(id) {
    var p = D.places.find(function (x) { return x.id === id; });
    var v = (I.dict[lang] || {})['st.' + id];
    return v || (p ? p.name : id);
  }
  function fmt(n, dp) {
    if (n == null || isNaN(n)) return '–';
    return Number(n).toLocaleString('en-IN', { maximumFractionDigits: dp == null ? 1 : dp, minimumFractionDigits: dp || 0 });
  }
  // The fingerprinted address of a file the page loads (see scripts/build_pages.py).
  function ver(path) { var h = (window.SC_V || {})[path.slice(1)]; return h ? path + '?v=' + h : path; }
  function slug(s) { return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function link(path) { return path + (lang === 'en' ? '' : '?lang=' + lang); }
  function setLang(l) {
    lang = I.dict[l] ? l : 'en';
    var meta = I.langs[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
    if (meta.font && !$('font-' + lang)) {
      var ln = document.createElement('link');
      ln.id = 'font-' + lang; ln.rel = 'stylesheet'; ln.href = meta.font;
      document.head.appendChild(ln);
    }
    $('lang').value = lang;
    $('tnote').hidden = lang === 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    try { localStorage.setItem('sc-lang', lang); } catch (e) {}
    var u = new URL(location.href);
    if (lang === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang);
    history.replaceState(null, '', u);
    links();
    if (D) renderAll();
  }
  // Internal links carry the language, so a reader who chose Tamil stays in Tamil.
  function links(root) {
    (root || document).querySelectorAll('a[href^="/"]').forEach(function (a) {
      var u = new URL(a.getAttribute('href'), location.origin);
      if (lang === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang);
      a.setAttribute('href', u.pathname + u.search + u.hash);
    });
  }

  // ---------- data helpers ----------
  function S(code, measure, p, y) {
    var c = D.series[code]; if (!c || !c[measure] || !c[measure][p]) return null;
    return c[measure][p][D.years.indexOf(y == null ? st.year : y)];
  }
  function row(code, measure, p) { var c = D.series[code]; return c && c[measure] && c[measure][p] ? c[measure][p] : null; }
  function STATES() { return D.places.filter(function (p) { return p.kind !== 'total'; }); }
  function byName(a, b) { return place(a.id).localeCompare(place(b.id), lang); }
  function cases(code, p) { return code === 'MURDER_WOMEN' ? row(code, 'victims', p) : row(code, 'cases', p); }
  function rate(code, p, y) {
    if (code === 'MURDER_WOMEN') { var v = S(code, 'victims', p, y), pop = S('FEMALE_POP', 'population_lakh', p, y); return v != null && pop ? v / pop : null; }
    return S(code, 'rate', p, y);
  }
  function law(code) { return [D.heads[code].ipc ? 'IPC ' + D.heads[code].ipc : '', D.heads[code].bns || ''].filter(Boolean).join(' · '); }
  // Police and court figures. For one crime, India only: <code> with police_ and court_
  // measures. For all crimes together in a state: POLICE and COURTS.
  function pc(code, p, y) {
    var pol = code === 'STATE' ? function (m) { return S('POLICE', m, p, y); } : function (m) { return S(code, 'police_' + m, p, y); };
    var crt = code === 'STATE' ? function (m) { return S('COURTS', m, p, y); } : function (m) { return S(code, 'court_' + m, p, y); };
    var o = { rep: pol('reported'), inv: pol('total_for_investigation'), cs: pol('chargesheeted'), fal: pol('final_report_false'),
              ins: pol('final_report_true_insufficient_evidence'), pinv: pol('pending_investigation_end_of_year'),
              ct: crt('total_for_trial'), conv: crt('convicted'), acq: crt('acquitted'), dis: crt('discharged'),
              ptr: crt('pending_trial_end_of_year'), cr: crt('conviction_rate') };
    o.carry = o.inv - o.rep;
    o.othp = Math.max(0, o.inv - o.cs - o.fal - o.ins - o.pinv);
    o.earl = Math.max(0, o.ct - o.cs);
    o.othc = Math.max(0, o.ct - o.conv - o.acq - o.dis - o.ptr);
    return o;
  }
  function tabs(box, list, key, label, on) {
    box.innerHTML = '';
    list.forEach(function (code) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(st[key] === code));
      b.textContent = label(code);
      b.addEventListener('click', function () { st[key] = code; on(); });
      box.appendChild(b);
    });
  }
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  // ---------- home ----------
  function hero() {
    var y = 2024;
    var before = S('RAPE', 'court_total_for_trial', 'All India', y), pend = S('RAPE', 'court_pending_trial_end_of_year', 'All India', y);
    var out = [
      [fmt(S('TOTAL', 'cases', 'All India', y), 0), t('hero.f1', { y: y }), null],
      [fmt(S('RAPE', 'cases', 'All India', y), 0), t('hero.f2', { y: y }), 'tip.ipc'],
      [fmt(S('POCSO_RAPE', 'cases', 'All India', y), 0), t('hero.f3', { y: y }), 'tip.pocso'],
      [t('field.big', { share: Math.round(pend / before * 100) }), t('hero.f4', { y: y }), 'tip.pend']];
    $('heroFigs').innerHTML = out.map(function (f) { return '<div class="fig"><b>' + f[0] + '</b><span' + (f[2] ? ' data-tip="' + f[2] + '"' : '') + '>' + f[1] + '</span></div>'; }).join('');
  }
  function home() {
    hero();
    var o = pc('RAPE', 'All India', 2024);
    $('homeCourts').textContent = t('home.courts.t', { conv: Math.round(o.cr), y: 2024 });
    // a strip of every rape case before the courts in 2024, split by outcome
    var parts = [['conv', '--red'], ['acq', '--turmeric'], ['dis', '--q2'], ['othc', '--soft'], ['ptr', '--knot-open']], x = 0, g = '';
    parts.forEach(function (p) { var w = o[p[0]] / o.ct * 300; g += '<rect x="' + x.toFixed(1) + '" y="0" width="' + Math.max(1, w).toFixed(1) + '" height="14" fill="var(' + p[1] + ')"/>'; x += w; });
    $('vizCourts').setAttribute('viewBox', '0 0 300 14'); $('vizCourts').innerHTML = g;
    var v = cases('TOTAL', 'All India'), mx = Math.max.apply(null, v);
    var d = v.map(function (n, i) { return (i ? 'L' : 'M') + (i * 72 + 6) + ' ' + (40 - n / mx * 34).toFixed(1); }).join('');
    $('vizCrimes').setAttribute('viewBox', '0 0 300 44');
    $('vizCrimes').innerHTML = '<path d="' + d + '" fill="none" stroke="var(--knot)" stroke-width="2.5"/>' +
      v.map(function (n, i) { return '<circle cx="' + (i * 72 + 6) + '" cy="' + (40 - n / mx * 34).toFixed(1) + '" r="3.5" fill="' + (i === 4 ? 'var(--red)' : 'var(--knot)') + '"/>'; }).join('');
  }

  // ---------- protests ----------
  function protests() {
    var y = 2024, ri = S('RAPE', 'rate', 'All India', y);
    ['Delhi', 'Bihar'].forEach(function (p) {
      $(p === 'Delhi' ? 'prDelhi' : 'prBihar').textContent = t(p === 'Delhi' ? 'pr.delhi' : 'pr.bihar', {
        rape: fmt(S('RAPE', 'cases', p, y), 0), pocso: fmt(S('POCSO_RAPE', 'cases', p, y), 0),
        rate: fmt(S('RAPE', 'rate', p, y), 1), india: fmt(ri, 1) });
    });
    var o = pc('RAPE', 'All India', y);
    $('prIndia').textContent = t('pr.india', { pend: Math.round(o.ptr / o.ct * 100), conv: Math.round(o.cr) });
    C.watch($('prChart'), function () {
      C.lines($('prChart'), { x: D.years, fmt: function (v) { return fmt(v, 1); }, label: t('pr.chart'),
        series: [{ label: place('Delhi'), values: row('RAPE', 'rate', 'Delhi'), color: '--red' },
                 { label: place('Bihar'), values: row('RAPE', 'rate', 'Bihar'), color: '--knot' },
                 { label: place('All India'), values: row('RAPE', 'rate', 'All India'), color: '--soft', dash: '6 5' }] });
    });
    $('prChartCap').textContent = t('pr.chart');
  }

  // ---------- police and courts ----------
  function flowSpec(o) {
    return { nodes: [
      { id: 'carry', col: 0, value: o.carry, label: t('flow.carry'), color: '--knot-open' },
      { id: 'new', col: 0, value: o.rep, label: t('flow.new'), color: '--knot' },
      { id: 'pol', col: 1, value: o.inv, label: t('flow.police'), color: '--knot' },
      { id: 'cs', col: 2, value: o.cs, label: t('flow.cs'), color: '--q4' },
      { id: 'earl', col: 2, value: o.earl, label: t('flow.earlier'), color: '--knot-open' },
      { id: 'fal', col: 2, value: o.fal, label: t('flow.false'), color: '--soft' },
      { id: 'ins', col: 2, value: o.ins, label: t('flow.insuff'), color: '--soft' },
      { id: 'othp', col: 2, value: o.othp, label: t('flow.otherp'), color: '--soft' },
      { id: 'pinv', col: 2, value: o.pinv, label: t('flow.pinv'), color: '--knot-open' },
      { id: 'crt', col: 3, value: o.ct, label: t('flow.court'), color: '--knot' },
      { id: 'conv', col: 4, value: o.conv, label: t('flow.conv'), color: '--red' },
      { id: 'acq', col: 4, value: o.acq, label: t('flow.acq'), color: '--turmeric' },
      { id: 'dis', col: 4, value: o.dis, label: t('flow.dis'), color: '--q2' },
      { id: 'othc', col: 4, value: o.othc, label: t('flow.otherc'), color: '--soft' },
      { id: 'ptr', col: 4, value: o.ptr, label: t('flow.ptrial'), color: '--knot-open' }],
      links: [{ s: 'carry', t: 'pol', v: o.carry }, { s: 'new', t: 'pol', v: o.rep },
        { s: 'pol', t: 'cs', v: o.cs }, { s: 'pol', t: 'fal', v: o.fal }, { s: 'pol', t: 'ins', v: o.ins }, { s: 'pol', t: 'othp', v: o.othp }, { s: 'pol', t: 'pinv', v: o.pinv },
        { s: 'cs', t: 'crt', v: o.cs }, { s: 'earl', t: 'crt', v: o.earl },
        { s: 'crt', t: 'conv', v: o.conv }, { s: 'crt', t: 'acq', v: o.acq }, { s: 'crt', t: 'dis', v: o.dis }, { s: 'crt', t: 'othc', v: o.othc }, { s: 'crt', t: 'ptr', v: o.ptr }] };
  }
  function flow(code, y) {
    var o = pc(code, 'All India', y), name = lc(crimeName(code));
    $('flowIntro').textContent = t('flow.intro', { y: y, crime: name, police: fmt(o.inv, 0), court: fmt(o.ct, 0), conv: fmt(o.conv, 0) });
    $('flowCap').textContent = t('flow.cap', { y: y });
    C.watch($('flowChart'), function () { C.flow($('flowChart'), flowSpec(o), { fmt: function (v) { return fmt(v, 0); }, label: $('flowIntro').textContent }); });
  }
  function courts() {
    tabs($('pcTabs'), FIR, 'crime', crimeName, courts);
    var ys = $('pcYear');
    if (!ys.options.length) {
      ys.innerHTML = D.years.slice().reverse().map(function (y) { return '<option>' + y + '</option>'; }).join('');
      ys.addEventListener('change', function () { st.year = +this.value; courts(); });
    }
    ys.value = st.year;
    flow(st.crime, st.year);
    field();
    outcomes(st.crime, 'All India');
    fir();
  }

  // dot field: one stitch per N cases before the courts
  var PER = { TOTAL: 1000, CRUELTY: 1000 };
  function field() {
    var c = st.crime, y = st.year, o = pc(c, 'All India', y);
    var per = PER[c] || (o.ct > 150000 ? 100 : o.ct > 15000 ? 10 : 1);
    var n = { conv: Math.round(o.conv / per), acq: Math.round((o.acq + o.dis) / per), other: Math.round(o.othc / per), pend: Math.round(o.ptr / per) };
    var knots = [];
    ['conv', 'acq', 'other', 'pend'].forEach(function (k) { for (var i = 0; i < n[k]; i++) knots.push(k); });
    var name = lc(crimeName(c)), share = Math.round(o.ptr / o.ct * 100);
    $('h-courts').textContent = t('courts.hy', { y: y });
    $('courtsIntro').textContent = t('courts.intro', { n: fmt(o.ct, 0), crime: name, y: y });
    $('fieldCap').innerHTML = t('field.cap', { per: fmt(per, 0), crime: name, conv: '<b>' + fmt(o.conv, 0) + '</b>', pend: fmt(o.ptr, 0), share: share, y: y });
    $('field').setAttribute('aria-label', $('fieldCap').textContent);
    $('fieldBig').innerHTML = '<b>' + t('field.big', { share: share }) + '</b><span>' + t('field.bigsub', { crime: name, y: y }) + '</span>';
    var leg = [['conv', t('leg.conv'), o.conv], ['acq', t('leg.acq'), o.acq + o.dis], ['other', t('leg.other'), o.othc], ['pend', t('leg.pend'), o.ptr]];
    $('fieldLegend').innerHTML = leg.map(function (l) { return '<li>' + glyph(l[0]) + l[1] + ' · ' + fmt(l[2], 0) + '</li>'; }).join('') +
      '<li>' + t('leg.per', { per: fmt(per, 0) }) + '</li>';
    C.watch($('field'), function () { drawField(knots); });
  }
  // Shape as well as colour tells the stitches apart: a full cross for pending
  // and convicted, a half cross for acquitted or discharged, a small pale cross
  // for cases that ended without a trial.
  var STITCH = { pend: ['--knot', 1, 1.9], conv: ['--red', 1, 2.4], acq: ['--red', 0, 1.9], other: ['--knot-open', 0.7, 1.6] };
  function glyph(k) {
    var s = STITCH[k], c = 'var(' + s[0] + ')', a = 6 * (s[1] || 1);
    var d = 'M' + (8 - a) + ' ' + (8 + a) + 'L' + (8 + a) + ' ' + (8 - a) + (s[1] ? 'M' + (8 - a) + ' ' + (8 - a) + 'L' + (8 + a) + ' ' + (8 + a) : '');
    return '<svg class="glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="' + d + '" stroke="' + c + '" stroke-width="' + s[2] + '" stroke-linecap="round" fill="none"/></svg>';
  }
  function drawField(knots) {
    var cv = $('field'), w = cv.clientWidth || 900, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var gap = w < 520 ? 9 : 11.5, half = gap * 0.32;
    var cols = Math.max(10, Math.floor((w - gap * 1.2) / gap)), rows = Math.ceil(knots.length / cols);
    var h = rows * gap + gap * 0.5;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    knots.forEach(function (k, i) {
      var rr = Math.floor(i / cols), cc = i % cols, s = STITCH[k];
      var x = cc * gap + gap * 0.6 + (rr % 2 ? gap * 0.3 : 0), y = rr * gap + gap * 0.6;
      var a = half * (s[1] || 1);
      g.strokeStyle = cssv(s[0]); g.lineWidth = s[2] * (w < 520 ? 0.8 : 1);
      g.beginPath(); g.moveTo(x - a, y + a); g.lineTo(x + a, y - a);
      if (s[1]) { g.moveTo(x - a, y - a); g.lineTo(x + a, y + a); }
      g.stroke();
    });
  }

  // verdicts by year, as stacked bars
  function outcomes(code, p) {
    tabs($('obMode'), ['all', 'done'], 'ob', function (m) { return t('ob.' + m); }, function () { outcomes(code, p); });
    var share = st.ob === 'done';
    var keys = [{ key: 'conv', label: t('flow.conv'), color: '--red' }, { key: 'acq', label: t('flow.acq'), color: '--turmeric' },
                { key: 'dis', label: t('flow.dis'), color: '--q2' }];
    if (!share) keys = keys.concat([{ key: 'othc', label: t('flow.otherc'), color: '--soft' }, { key: 'ptr', label: t('flow.ptrial'), color: '--knot-open' }]);
    var rows = D.years.map(function (y) {
      var o = pc(code, p, y);
      return { label: String(y), parts: keys.map(function (k) { return { key: k.key, value: o[k.key] }; }) };
    });
    var name = code === 'STATE' ? lc(t('tab.TOTAL')) : lc(crimeName(code));
    $('obCap').textContent = t(share ? 'ob.cap.done' : 'ob.cap.all', { crime: name, place: p === 'All India' ? t('india') : place(p) });
    C.watch($('obChart'), function () { C.stack($('obChart'), { rows: rows, keys: keys, share: share, fmt: function (v) { return fmt(v, 0); }, label: $('obCap').textContent }); });
  }

  var TIPS = { 'fir.c2': 'tip.cs', 'fir.c3': 'tip.inv', 'fir.c4': 'tip.court', 'fir.c5': 'tip.trials', 'fir.c7': 'tip.cr', 'fir.c8': 'tip.pend',
               'o.cs': 'tip.cs', 'o.pinv': 'tip.inv', 'o.trial': 'tip.court', 'o.cr': 'tip.cr', 'o.ptrial': 'tip.pend', 'o.cp': 'tip.cp',
               'rate24': 'tip.rate', 'india24': 'tip.rate' };
  function fir() {
    var c = st.crime, cols = [
      ['police_reported', 'fir.c1', 0], ['police_chargesheeting_rate', 'fir.c2', 1], ['police_pending_investigation_end_of_year', 'fir.c3', 0],
      ['court_total_for_trial', 'fir.c4', 0], ['court_trials_completed', 'fir.c5', 0], ['court_convicted', 'fir.c6', 0],
      ['court_conviction_rate', 'fir.c7', 1], ['court_pending_trial_end_of_year', 'fir.c8', 0]];
    var h = '<caption class="sr">' + crimeName(c) + '</caption><thead><tr><th scope="col">' + t('year') + '</th>' +
      cols.map(function (x) { return '<th scope="col"' + (TIPS[x[1]] ? ' data-tip="' + TIPS[x[1]] + '"' : '') + '>' + t(x[1]) + '</th>'; }).join('') + '</tr></thead><tbody>';
    D.years.forEach(function (y) {
      h += '<tr><th scope="row">' + y + '</th>' + cols.map(function (x) {
        var v = S(c, x[0], 'All India', y), pct = x[0].indexOf('rate') > 0;
        return '<td data-label="' + t(x[1]) + '"' + (x[0] === 'court_conviction_rate' ? ' class="hl"' : '') + '>' + fmt(v, x[2]) + (pct && v != null ? '%' : '') + '</td>';
      }).join('') + '</tr>';
    });
    $('firTable').innerHTML = h + '</tbody>';
    $('firTable').classList.add('stack');
  }

  // ---------- states and the map ----------
  var MAPHEADS = ['TOTAL', 'RAPE', 'POCSO_RAPE', 'ATTEMPT_RAPE', 'ASSAULT_MODESTY', 'MURDER_WOMEN', 'MURDER_RAPE', 'DOWRY_DEATH',
                  'ABETMENT_SUICIDE', 'CRUELTY', 'KIDNAP', 'ACID', 'CYBER'];
  function mapValue(code, p, y) { return st.measure === 'rate' ? (code === 'MURDER_WOMEN' ? (rate(code, p, y) == null ? null : Math.round(rate(code, p, y) * 100) / 100) : S(code, 'rate', p, y)) : (cases(code, p) || [])[D.years.indexOf(y)]; }
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
  function go(p) { location.href = link('/states/' + slug(p) + '/'); }
  function map() {
    var hs = $('mapHead'), ys = $('mapYear');
    hs.innerHTML = MAPHEADS.map(function (c) { return '<option value="' + c + '">' + head(c) + '</option>'; }).join('');
    hs.value = st.head;
    ys.innerHTML = D.years.slice().reverse().map(function (y) { return '<option>' + y + '</option>'; }).join('');
    ys.value = st.year;
    $('mapMeasure').value = st.measure;
    var dp = st.measure === 'rate' ? 1 : 0;
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
        el.setAttribute('tabindex', '0'); el.setAttribute('role', 'link');
        var label = place(v[0].id) + ': ' + (v[1] == null ? t('nodata') : fmt(v[1], dp));
        el.setAttribute('aria-label', label);
        var ti = document.createElementNS(NS, 'title'); ti.textContent = label; el.appendChild(ti);
        el.addEventListener('click', function () { go(v[0].id); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(v[0].id); });
      }
      svg.appendChild(el);
    });
    var india = mapValue(st.head, 'All India', st.year);
    var unit = st.measure === 'rate' ? t('unit.rate') : t('unit.cases');
    $('mapCap').textContent = t('map.cap', { crime: head(st.head), y: st.year, unit: unit, india: fmt(india, dp) });
    var edges = [nums[0]].concat(cuts).concat([nums[nums.length - 1]]);
    $('mapScale').innerHTML = RAMP.map(function (r, i) {
      return '<span><i style="background:var(' + r + ')"></i>' + t('range', { a: fmt(edges[i], 1), b: fmt(edges[i + 1], 1) }) + '</span>';
    }).join('') + '<span><i style="background:var(--ground);outline:1px dashed var(--thread)"></i>' + t('nodata') + '</span>';
    // States in alphabetical order. Ranking them would invite the comparison NCRB warns against.
    var max = Math.max.apply(null, nums.concat(st.measure === 'rate' && india != null ? [india] : []));
    function li(p, v, cls) {
      var bar = v == null ? '' : '<span class="bar" style="width:' + (v / max * 100).toFixed(1) + '%"></span>';
      var inner = '<span>' + place(p) + '</span><span class="v">' + (v == null ? t('nodata') : fmt(v, dp)) + '</span>' + bar;
      return '<li class="' + cls + '">' + (p === 'All India' ? '<div class="row">' + inner + '</div>' : '<a class="row" href="' + link('/states/' + slug(p) + '/') + '">' + inner + '</a>') + '</li>';
    }
    $('rank').innerHTML = (st.measure === 'rate' ? li('All India', india, 'india') : '') +
      vals.slice().sort(function (a, b) { return byName(a[0], b[0]); }).map(function (v) { return li(v[0].id, v[1], ''); }).join('');
  }
  function states() {
    map();
    $('placeList').innerHTML = STATES().slice().sort(byName).map(function (p) {
      return '<li><a href="' + link('/states/' + slug(p.id) + '/') + '">' + place(p.id) + '</a></li>';
    }).join('');
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
  function placeFromPage() {
    var id = body.dataset.place;
    var pk = $('statePick');
    pk.innerHTML = STATES().slice().sort(byName).map(function (x) { return '<option value="' + x.id + '">' + place(x.id) + '</option>'; }).join('');
    pk.value = id;
    return id;
  }
  function state() {
    var p = placeFromPage();
    $('h-state').textContent = place(p);
    document.title = place(p) + ' · She Counts';
    var tot = S('TOTAL', 'cases', p, 2024), r = S('TOTAL', 'rate', p, 2024), ri = S('TOTAL', 'rate', 'All India', 2024);
    $('stateIntro').textContent = t('state.intro', { s: place(p), pop: fmt(S('FEMALE_POP', 'population_lakh', p, 2024), 1), tot: fmt(tot, 0), r: fmt(r, 1), ri: fmt(ri, 1) });
    // slope panels
    var y0 = D.years[0], y1 = D.years[D.years.length - 1];
    $('slopes').innerHTML = CRIMES.map(function (code) {
      var a = rate(code, p, y0), b = rate(code, p, y1), ia = rate(code, 'All India', y0), ib = rate(code, 'All India', y1);
      if (a == null && b == null) return '';
      var dp = Math.max(a || 0, b || 0, ia || 0, ib || 0) < 1 ? 2 : 1;
      var f = function (v) { return fmt(v, dp); };
      return '<figure class="slope cloth"><figcaption><a href="' + link('/crimes/' + slug(code) + '/') + '">' + head(code) + '</a></figcaption>' +
        C.slope({ a: a, b: b, ia: ia, ib: ib, ya: y0, yb: y1, fmt: f, label: t('slope.label', { crime: head(code), a: f(a), b: f(b), y0: y0, y1: y1, ia: f(ia), ib: f(ib) }) }) + '</figure>';
    }).join('');
    links($('slopes'));
    // every crime, five years
    var h = '<thead><tr><th scope="col">' + t('crime') + '</th>' + D.years.map(function (y, i) { return '<th scope="col"' + (i < D.years.length - 1 ? ' class="old"' : '') + '>' + y + '</th>'; }).join('') +
      '<th scope="col">' + t('trend') + '</th><th scope="col" data-tip="tip.rate">' + t('rate24') + '</th><th scope="col" class="ind">' + t('india24') + '</th></tr></thead><tbody>';
    GROUPS.forEach(function (g) {
      h += '<tr class="group"><th colspan="9" scope="rowgroup">' + t('group.' + g[0]) + '</th></tr>';
      g[1].forEach(function (code) {
        var vals = cases(code, p); if (!vals) return;
        h += '<tr><th scope="row">' + head(code) + (law(code) ? '<span class="sub">' + law(code) + '</span>' : '') + '</th>' +
          vals.map(function (v, i) { return '<td' + (i < vals.length - 1 ? ' class="old"' : '') + '>' + fmt(v, 0) + '</td>'; }).join('') + '<td>' + spark(vals) + '</td>' +
          '<td class="hl">' + fmt(rate(code, p, 2024), 2) + '</td><td class="ind">' + fmt(rate(code, 'All India', 2024), 2) + '</td></tr>';
      });
    });
    $('stateTable').innerHTML = h + '</tbody>';
    outcomes('STATE', p);
    var oc = [['POLICE', 'reported', 'o.reported', 0], ['POLICE', 'chargesheeting_rate', 'o.cs', 1], ['POLICE', 'pending_investigation_end_of_year', 'o.pinv', 0],
              ['COURTS', 'total_for_trial', 'o.trial', 0], ['COURTS', 'convicted', 'o.conv', 0], ['COURTS', 'conviction_rate', 'o.cr', 1],
              ['COURTS', 'pending_trial_end_of_year', 'o.ptrial', 0], ['COURTS', 'court_pendency', 'o.cp', 1]];
    var o = '<thead><tr><th scope="col">' + t('year') + '</th>' + oc.map(function (x) { return '<th scope="col"' + (TIPS[x[2]] ? ' data-tip="' + TIPS[x[2]] + '"' : '') + '>' + t(x[2]) + '</th>'; }).join('') + '</tr></thead><tbody>';
    D.years.forEach(function (y) {
      o += '<tr><th scope="row">' + y + '</th>' + oc.map(function (x) {
        var v = S(x[0], x[1], p, y), pct = /rate|pendency/.test(x[1]);
        return '<td data-label="' + t(x[2]) + '"' + (x[1] === 'conviction_rate' ? ' class="hl"' : '') + '>' + fmt(v, x[3]) + (pct && v != null ? '%' : '') + '</td>';
      }).join('') + '</tr>';
    });
    $('stateOutcomes').innerHTML = o + '</tbody>';
    $('stateOutcomes').classList.add('stack');
  }

  // ---------- crimes ----------
  function crimes() {
    tabs($('multMode'), ['cases', 'rate'], 'mult', function (m) { return t(m === 'rate' ? 'm.rate' : 'm.cases'); }, crimes);
    $('multiples').innerHTML = CRIMES.map(function (code) {
      var vals = st.mult === 'rate' ? D.years.map(function (y) { return rate(code, 'All India', y); }) : cases(code, 'All India');
      if (!vals) return '';
      var dp = st.mult === 'rate' ? 2 : 0;
      var mx = Math.max.apply(null, vals.filter(function (v) { return v != null; })) * 1.15, W = 240, H = 90, L = 4, B = 18;
      var pts = vals.map(function (v, i) { return v == null ? null : [L + i * (W - 2 * L - 30) / 4, H - B - v / mx * (H - B - 6)]; });
      var d = pts.filter(Boolean).map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
      var g = '<line x1="' + L + '" x2="' + (W - 30) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--thread)" stroke-dasharray="5 4"/>';
      g += '<path d="M' + pts[0][0] + ' ' + (H - B) + d.replace(/^M/, 'L') + 'L' + pts[pts.length - 1][0] + ' ' + (H - B) + 'Z" fill="var(--q1)"/>';
      g += '<path d="' + d + '" fill="none" stroke="var(--knot)" stroke-width="2"/>';
      pts.forEach(function (p, i) { if (p) g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === 4 ? 4 : 2.6) + '" fill="' + (i === 4 ? 'var(--red)' : 'var(--knot)') + '"/>'; });
      g += '<text x="' + L + '" y="' + (H - 3) + '" class="tick">2020</text><text x="' + (W - 30) + '" y="' + (H - 3) + '" class="tick" text-anchor="end">2024</text>';
      var first = vals[0], last = vals[4], ch = first ? Math.round((last - first) / first * 100) : null;
      return '<a class="mult cloth" href="' + link('/crimes/' + slug(code) + '/') + '"><h3>' + head(code) + '</h3>' + (law(code) ? '<span class="law">' + law(code) + '</span>' : '') +
        '<span class="last">' + fmt(last, dp) + '</span>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + head(code) + ': ' + vals.map(function (v) { return fmt(v, dp); }).join(', ') + '">' + g + '</svg>' +
        '<p>' + t('mult.p', { a: fmt(first, dp), b: fmt(last, dp), ch: (ch > 0 ? '+' : '') + ch }) + '</p></a>';
    }).join('');
  }

  // ---------- one crime ----------
  function crime() {
    var c = body.dataset.crime, pk = $('crimePick');
    pk.innerHTML = CRIMES.map(function (x) { return '<option value="' + x + '">' + head(x) + '</option>'; }).join('');
    pk.value = c;
    $('h-crime').textContent = head(c);
    document.title = head(c) + ' · She Counts';
    $('crimeLaw').textContent = law(c);
    var v = cases(c, 'All India'), y0 = D.years[0], y1 = D.years[D.years.length - 1];
    $('crimeIntro').textContent = t('crime.intro', { b: fmt(v[4], 0), y1: y1, a: fmt(v[0], 0), y0: y0, r: fmt(rate(c, 'All India', y1), 2) });
    var note = (D.notes[c] || {})['2024'];
    $('crimeNote').textContent = note || '';
    $('crimeNote').hidden = !note;
    tabs($('trendMode'), ['cases', 'rate'], 'trend', function (m) { return t(m === 'rate' ? 'm.rate' : 'm.cases'); }, trend);
    trend();
    if (FIR.indexOf(c) >= 0) { $('pc').hidden = false; flow(c, y1); }
    crimeStates(c);
  }
  function trend() {
    var c = body.dataset.crime, rateMode = st.trend === 'rate';
    var get = function (code) { return rateMode ? D.years.map(function (y) { return rate(code, 'All India', y); }) : cases(code, 'All India'); };
    var series = [{ label: head(c), short: crimeName(c), values: get(c), color: '--red', width: 3 }];
    // Rape and POCSO rape are two halves of one crime and are always shown together.
    var pair = { RAPE: 'POCSO_RAPE', POCSO_RAPE: 'RAPE' }[c];
    if (pair) series.push({ label: head(pair), short: crimeName(pair), values: get(pair), color: '--knot', dash: '6 5' });
    var dp = rateMode ? 2 : 0;
    $('trendCap').textContent = t(rateMode ? 'trend.cap.rate' : 'trend.cap.cases') + (pair ? ' ' + t('trend.pair') : '');
    C.watch($('trendChart'), function () {
      C.lines($('trendChart'), { x: D.years, series: series, label: $('trendCap').textContent,
        fmt: function (v, tick) { return tick && !rateMode && v >= 100000 ? fmt(v / 100000, 1) + ' L' : fmt(v, tick ? (rateMode ? 1 : 0) : dp); },
        marks: [{ i: 0, label: t('mark.lock') }, { i: 4, label: t('mark.bns') }] });
    });
  }
  function crimeStates(c) {
    var cols = D.years.map(function (y) { return { key: 'y' + y, label: String(y), get: function (p) { return (cases(c, p) || [])[D.years.indexOf(y)]; }, dp: 0 }; })
      .concat([{ key: 'rate', label: t('rate24'), get: function (p) { return rate(c, p, 2024); }, dp: 2, tip: 'tip.rate' }]);
    function draw() {
      var list = STATES().slice();
      var sc = cols.find(function (x) { return x.key === st.sort; });
      list.sort(sc ? function (a, b) { var va = sc.get(a.id), vb = sc.get(b.id); return (vb == null ? -1 : vb) - (va == null ? -1 : va); } : byName);
      var h = '<thead><tr><th scope="col"' + (sc ? '' : ' aria-sort="ascending"') + '><button type="button" data-k="">' + t('pick.state') + '</button></th>' + cols.map(function (x, i) {
        return '<th scope="col"' + (i < cols.length - 2 ? ' class="old"' : '') + (st.sort === x.key ? ' aria-sort="descending"' : '') + '><button type="button" data-k="' + x.key + '"' + (x.tip ? ' data-tip="' + x.tip + '"' : '') + '>' + x.label + '</button></th>';
      }).join('') + '</tr></thead><tbody>';
      list.forEach(function (p) {
        h += '<tr><th scope="row"><a href="' + link('/states/' + slug(p.id) + '/') + '">' + place(p.id) + '</a></th>' + cols.map(function (x, i) {
          return '<td' + (i < cols.length - 2 ? ' class="old"' : x.key === 'rate' ? ' class="hl"' : '') + '>' + fmt(x.get(p.id), x.dp) + '</td>';
        }).join('') + '</tr>';
      });
      h += '<tr class="total"><th scope="row">' + place('All India') + '</th>' + cols.map(function (x, i) { return '<td' + (i < cols.length - 2 ? ' class="old"' : '') + '>' + fmt(x.get('All India'), x.dp) + '</td>'; }).join('') + '</tr>';
      $('crimeStates').innerHTML = h + '</tbody>';
      $('crimeStates').querySelectorAll('thead button').forEach(function (b) {
        b.addEventListener('click', function () { st.sort = b.dataset.k || null; draw(); wireTips($('crimeStates')); });
      });
    }
    draw();
  }

  function method() {
    $('srcList').innerHTML = D.years.map(function (y) {
      var s = D.sources[String(y)];
      return '<li>' + s.title + ' · ' + t('src.via') + ' ' + s.mirror + ' · <a href="' + s.url + '">PDF</a><br><code>sha256 ' + s.sha256 + '</code></li>';
    }).join('');
  }


  // ---------- context ----------
  var X = null;
  // One figure from a context source. With no period, the source's latest.
  function cv(src, code, p, period) {
    var c = ((X[src] || {})[code] || {})[p]; if (!c) return null;
    if (period != null) return c[period] == null ? null : c[period];
    var ks = Object.keys(c).sort(); return c[ks[ks.length - 1]];
  }
  function pct(v) { return v == null ? '–' : fmt(v, 1) + '%'; }
  // A sortable table of states: cols are [{label, get(p), dp, pct, tip}].
  function placeTable(el, cols, opts) {
    opts = opts || {};
    var key = null;
    function draw() {
      var list = STATES().filter(function (p) { return cols.some(function (c) { return c.get(p.id) != null; }); });
      var sc = cols[key];
      list.sort(sc ? function (a, b) { var va = sc.get(a.id), vb = sc.get(b.id); return (vb == null ? -1e12 : vb) - (va == null ? -1e12 : va); } : byName);
      var cell = function (c, p) { var v = c.get(p); return c.pct ? pct(v) : fmt(v, c.dp || 0); };
      var h = '<thead><tr><th scope="col"' + (sc ? '' : ' aria-sort="ascending"') + '><button type="button" data-k="">' + t('pick.state') + '</button></th>' +
        cols.map(function (c, i) { return '<th scope="col"' + (key === i ? ' aria-sort="descending"' : '') + '><button type="button" data-k="' + i + '"' + (c.tip ? ' data-tip="' + c.tip + '"' : '') + '>' + c.label + '</button></th>'; }).join('') + '</tr></thead><tbody>';
      list.forEach(function (p) {
        h += '<tr><th scope="row"><a href="' + link('/states/' + slug(p.id) + '/') + '">' + place(p.id) + '</a></th>' + cols.map(function (c) { return '<td>' + cell(c, p.id) + '</td>'; }).join('') + '</tr>';
      });
      if (!opts.noIndia) h += '<tr class="total"><th scope="row">' + t('india') + '</th>' + cols.map(function (c) { return '<td>' + cell(c, 'All India') + '</td>'; }).join('') + '</tr>';
      el.innerHTML = h + '</tbody>';
      el.querySelectorAll('thead button').forEach(function (b) { b.addEventListener('click', function () { key = b.dataset.k === '' ? null : +b.dataset.k; draw(); wireTips(el); }); });
    }
    draw();
  }
  function single(el, parts, keys, label) {
    C.watch(el, function () { C.stack(el, { rows: [{ label: '', parts: parts }], keys: keys, share: true, fmt: function (v) { return fmt(v, 1); }, label: label }); });
  }
  function context() {
    var NF = 'NFHS-5 (2019-21)';
    // NFHS
    var pos = cv('nfhs', 'NFHS5_SPV_POS', 'All India'), nev = cv('nfhs', 'NFHS5_HS_NEVER_TOLD', 'All India'), told = cv('nfhs', 'NFHS5_HS_TOLD_ONLY', 'All India'), sou = cv('nfhs', 'NFHS5_HS_SOUGHT', 'All India');
    $('nfhsLead').textContent = t('cx.nfhs.lead', { pos: fmt(pos, 1), never: fmt(nev, 1), sought: fmt(sou, 1) });
    $('nfhsCap').textContent = t('cx.nfhs.cap');
    single($('nfhsChart'), [{ key: 'n', value: nev }, { key: 't', value: told }, { key: 's', value: sou }],
      [{ key: 'n', label: t('cx.nfhs.never'), color: '--red' }, { key: 't', label: t('cx.nfhs.told'), color: '--turmeric' }, { key: 's', label: t('cx.nfhs.sought'), color: '--knot' }], $('nfhsCap').textContent);
    placeTable($('nfhsTable'), [
      { label: t('cx.nfhs.c1'), get: function (p) { return cv('nfhs', 'NFHS5_SPV_POS', p, NF); }, pct: 1 },
      { label: t('cx.nfhs.c2'), get: function (p) { return cv('nfhs', 'NFHS5_SV_EVER', p, NF); }, pct: 1 },
      { label: t('cx.nfhs.c3'), get: function (p) { return cv('nfhs', 'NFHS5_HS_NEVER_TOLD', p, NF); }, pct: 1 }]);
    // NCW
    var nt = D.years.map(function (y) { return cv('ncw', 'ncw_complaints_total', 'All India', String(y)); });
    var up = cv('ncw', 'ncw_complaints_total', 'Uttar Pradesh', '2024');
    $('ncwLead').textContent = t('cx.ncw.lead', { n: fmt(nt[4], 0), y: 2024, up: fmt(up / nt[4] * 100, 0), rape: fmt(cv('ncw', 'ncw_nature_rape_attempt_to_rape', 'All India', '2024'), 0), dv: fmt(cv('ncw', 'ncw_nature_domestic_violence', 'All India', '2024'), 0) });
    $('ncwCap').textContent = t('cx.ncw.cap');
    C.watch($('ncwChart'), function () {
      C.lines($('ncwChart'), { x: D.years, fmt: function (v) { return fmt(v, 0); }, label: $('ncwCap').textContent, series: [
        { label: t('cx.ncw.all'), values: nt, color: '--knot', width: 3 },
        { label: t('cx.ncw.dv'), values: D.years.map(function (y) { return cv('ncw', 'ncw_nature_domestic_violence', 'All India', String(y)); }), color: '--turmeric' },
        { label: t('cx.ncw.rape'), values: D.years.map(function (y) { return cv('ncw', 'ncw_nature_rape_attempt_to_rape', 'All India', String(y)); }), color: '--red' }] });
    });
    placeTable($('ncwTable'), D.years.map(function (y) { return { label: String(y), get: function (p) { return cv('ncw', 'ncw_complaints_total', p, String(y)); } }; }));
    // ADSI
    var af = D.years.map(function (y) { return cv('adsi', 'ADSI_SUI_F', 'All India', String(y)); }), ah = D.years.map(function (y) { return cv('adsi', 'ADSI_SUI_HW', 'All India', String(y)); });
    $('adsiLead').textContent = t('cx.adsi.lead', { f: fmt(af[4], 0), hw: fmt(ah[4], 0), share: fmt(ah[4] / af[4] * 100, 0), y: 2024 });
    $('adsiCap').textContent = t('cx.adsi.cap');
    C.watch($('adsiChart'), function () {
      C.lines($('adsiChart'), { x: D.years, fmt: function (v) { return fmt(v, 0); }, label: $('adsiCap').textContent, series: [
        { label: t('cx.adsi.f'), values: af, color: '--knot', width: 3 }, { label: t('cx.adsi.hw'), values: ah, color: '--red' }] });
    });
    placeTable($('adsiTable'), [
      { label: t('cx.adsi.f') + ', 2024', get: function (p) { return cv('adsi', 'ADSI_SUI_F', p, '2024'); } },
      { label: t('cx.adsi.hw') + ', 2024', get: function (p) { return cv('adsi', 'ADSI_SUI_HW', p, '2024'); } },
      { label: t('cx.adsi.f') + ', 2020', get: function (p) { return cv('adsi', 'ADSI_SUI_F', p, '2020'); } }]);
    // BPR&D
    var B = '2023-01-01', wp = cv('bprd', 'women_police_pct_actual', 'All India', B);
    $('bprdLead').textContent = t('cx.bprd.lead', { pct: fmt(wp, 1), n: fmt(cv('bprd', 'women_police_actual', 'All India', B), 0), old: fmt(cv('bprd', 'women_police_pct_actual', 'All India', '2020-01-01'), 1), ps: fmt(cv('bprd', 'women_police_stations_total', 'All India', B), 0) });
    $('bprdCap').textContent = t('cx.bprd.cap');
    single($('bprdChart'), [{ key: 'w', value: wp }, { key: 'm', value: 100 - wp }],
      [{ key: 'w', label: t('cx.bprd.w'), color: '--red' }, { key: 'm', label: t('cx.bprd.m'), color: '--knot-open' }], $('bprdCap').textContent);
    placeTable($('bprdTable'), [
      { label: t('cx.bprd.c1'), get: function (p) { return cv('bprd', 'women_police_pct_actual', p, B); }, pct: 1 },
      { label: t('cx.bprd.c2'), get: function (p) { return cv('bprd', 'women_police_actual', p, B); } },
      { label: t('cx.bprd.c3'), get: function (p) { return cv('bprd', 'women_police_stations_total', p, B); } },
      { label: t('cx.bprd.c4'), get: function (p) { return cv('bprd', 'police_per_lakh_actual', p, B); }, dp: 1 }]);
    // FTSC
    var fc = cv('ftsc', 'FTSC_FUNC', 'All India'), fp = cv('ftsc', 'FTSC_PEND_CUM', 'All India'), d25 = cv('ftsc', 'FTSC_DISP_2025', 'All India');
    $('ftscLead').textContent = t('cx.ftsc.lead', { courts: fmt(fc, 0), epocso: fmt(cv('ftsc', 'FTSC_FUNC_EPOCSO', 'All India'), 0), pend: fmt(fp, 0), disp: fmt(d25, 0), years: fmt(fp / d25, 1) });
    $('ftscCap').textContent = t('cx.ftsc.cap');
    C.watch($('ftscChart'), function () {
      C.stack($('ftscChart'), { rows: [2023, 2024, 2025].map(function (y) { return { label: String(y), parts: [{ key: 'd', value: cv('ftsc', 'FTSC_DISP_' + y, 'All India') }] }; })
        .concat([{ label: t('cx.ftsc.pendrow'), parts: [{ key: 'p', value: fp }] }]),
        keys: [{ key: 'd', label: t('cx.ftsc.disp'), color: '--knot' }, { key: 'p', label: t('cx.ftsc.pend'), color: '--red' }], fmt: function (v) { return fmt(v, 0); }, label: $('ftscCap').textContent, values: true });
    });
    placeTable($('ftscTable'), [
      { label: t('cx.ftsc.c1'), get: function (p) { return cv('ftsc', 'FTSC_FUNC', p); } },
      { label: t('cx.ftsc.c2'), get: function (p) { return cv('ftsc', 'FTSC_PEND_CUM', p); } },
      { label: t('cx.ftsc.c3'), get: function (p) { return cv('ftsc', 'FTSC_DISP_2025', p); } },
      { label: t('cx.ftsc.c4'), get: function (p) { return cv('ftsc', 'FTSC_CONV_RATE_2025', p); }, pct: 1 }]);
    // NJDG
    var wf = cv('njdg', 'njdg_women_filed_total', 'All India'), pt = cv('njdg', 'njdg_pending_total', 'All India');
    $('njdgLead').textContent = t('cx.njdg.lead', { wf: fmt(wf, 0), all: fmt(pt, 0), share: fmt(wf / pt * 100, 1), crim: fmt(cv('njdg', 'njdg_women_filed_criminal', 'All India'), 0) });
    $('njdgCap').textContent = t('cx.njdg.cap');
    single($('njdgChart'), [{ key: 'w', value: wf / pt * 100 }, { key: 'o', value: 100 - wf / pt * 100 }],
      [{ key: 'w', label: t('cx.njdg.w'), color: '--red' }, { key: 'o', label: t('cx.njdg.o'), color: '--knot-open' }], $('njdgCap').textContent);
    placeTable($('njdgTable'), [
      { label: t('cx.njdg.c1'), get: function (p) { return cv('njdg', 'njdg_women_filed_total', p); } },
      { label: t('cx.njdg.c2'), get: function (p) { return cv('njdg', 'njdg_women_filed_criminal', p); } },
      { label: t('cx.njdg.c3'), get: function (p) { var a = cv('njdg', 'njdg_women_filed_total', p), b = cv('njdg', 'njdg_pending_total', p); return a == null || !b ? null : a / b * 100; }, pct: 1 }]);
    // Nirbhaya
    var al = cv('nirbhaya', 'NIR_ALLOC_ALL', 'All India'), ru = cv('nirbhaya', 'NIR_REL_UTIL_ALL', 'All India');
    $('nirLead').textContent = t('cx.nir.lead', { alloc: fmt(al, 2), rel: fmt(ru, 2), left: fmt(al - ru, 2), share: fmt(ru / al * 100, 0) });
    $('nirCap').textContent = t('cx.nir.cap');
    single($('nirChart'), [{ key: 'r', value: ru / al * 100 }, { key: 'l', value: 100 - ru / al * 100 }],
      [{ key: 'r', label: t('cx.nir.r'), color: '--knot' }, { key: 'l', label: t('cx.nir.l'), color: '--turmeric' }], $('nirCap').textContent);
    placeTable($('nirTable'), [
      { label: t('cx.nir.c1'), get: function (p) { return cv('nirbhaya', 'NIR_CUM_REL_UTIL', p); }, dp: 2 },
      { label: t('cx.nir.c2'), get: function (p) { return cv('nirbhaya', 'NIR_FY2526_REL_UTIL', p); }, dp: 2 }], { noIndia: true });
    // ADR
    var A4 = '2024-08-21', A5 = '2025-03-17';
    $('adrLead').textContent = t('cx.adr.lead', { n: fmt(cv('adr', 'adr2024_mpmla_caw', 'All India', A4), 0), mp: fmt(cv('adr', 'adr2024_mp_caw', 'All India', A4), 0), mla: fmt(cv('adr', 'adr2024_mla_caw', 'All India', A4), 0),
      rape: fmt(cv('adr', 'adr2024_mpmla_rape', 'All India', A4), 0), n25: fmt(cv('adr', 'adr2025_mla_caw', 'All India', A5), 0), r25: fmt(cv('adr', 'adr2025_mla_rape', 'All India', A5), 0) });
    $('adrCap').textContent = t('cx.adr.cap');
    var adrRows = STATES().filter(function (p) { return cv('adr', 'adr2024_mpmla_caw', p.id, A4) != null; })
      .sort(function (a, b) { return cv('adr', 'adr2024_mpmla_caw', b.id, A4) - cv('adr', 'adr2024_mpmla_caw', a.id, A4) || byName(a, b); })
      .map(function (p) { return { label: place(p.id), parts: [{ key: 'mla', value: cv('adr', 'adr2024_mla_caw', p.id, A4) }, { key: 'mp', value: cv('adr', 'adr2024_mp_caw', p.id, A4) }] }; });
    C.watch($('adrChart'), function () {
      C.stack($('adrChart'), { rows: adrRows, keys: [{ key: 'mla', label: t('cx.adr.mla'), color: '--knot' }, { key: 'mp', label: t('cx.adr.mp'), color: '--red' }], fmt: function (v) { return fmt(v, 0); }, label: $('adrCap').textContent, values: true, labelW: 150 });
    });
    placeTable($('adrTable'), [
      { label: t('cx.adr.c1'), get: function (p) { return cv('adr', 'adr2024_mpmla_caw', p, A4); } },
      { label: t('cx.adr.c2'), get: function (p) { return cv('adr', 'adr2024_mpmla_rape', p, A4); } },
      { label: t('cx.adr.c3'), get: function (p) { return cv('adr', 'adr2025_mla_caw', p, A5); } },
      { label: t('cx.adr.c4'), get: function (p) { return cv('adr', 'adr2025_mla_rape', p, A5); } }]);
  }

  // ---------- contents rail ----------
  function toc() {
    var hs = Array.prototype.slice.call(document.querySelectorAll('main h2[id]')).filter(function (h) { return !h.classList.contains('sr') && !h.closest('[hidden]'); });
    var box = $('toc');
    box.hidden = hs.length < 3;
    if (box.hidden) return;
    box.querySelector('ol').innerHTML = hs.map(function (h) { return '<li><a href="#' + h.id + '">' + h.textContent + '</a></li>'; }).join('');
    body.classList.add('has-toc');
  }

  // ---------- tooltips ----------
  var tipEl = null, tipFor = null;
  function showTip(el) {
    tipEl = tipEl || $('tip');
    tipEl.textContent = t(el.getAttribute('data-tip'));
    tipEl.hidden = false; tipFor = el;
    var r = el.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 24);
    tipEl.style.maxWidth = w + 'px';
    var x = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    var below = r.bottom + 8 + tipEl.offsetHeight < window.innerHeight;
    tipEl.style.left = x + 'px';
    tipEl.style.top = (below ? r.bottom + 8 : r.top - tipEl.offsetHeight - 8) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; tipFor = null; }
  function wireTips(root) {
    (root || document).querySelectorAll('[data-tip]').forEach(function (el) {
      if (el.dataset.tipWired) return;
      el.dataset.tipWired = '1';
      el.classList.add('has-tip');
      if (!el.hasAttribute('tabindex') && el.tagName !== 'BUTTON') el.setAttribute('tabindex', '0');
      el.setAttribute('aria-describedby', 'tip');
      el.addEventListener('mouseenter', function () { showTip(el); });
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('focus', function () { showTip(el); });
      el.addEventListener('blur', hideTip);
      if (el.tagName !== 'BUTTON') el.addEventListener('click', function (e) { if (tipFor === el) hideTip(); else showTip(el); e.stopPropagation(); });
    });
  }
  document.addEventListener('click', hideTip);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('scroll', hideTip, { passive: true });

  // ---------- tour, on the home page ----------
  var TOUR = [['.figs', 'tour.1'], ['#cardProtests', 'tourp.2'], ['#cardCourts', 'tourp.3'], ['#cardStates', 'tourp.5'], ['#cardCrimes', 'tourp.4'], ['#cardData', 'tour.6']];
  var step = -1;
  function tourShow(i) {
    document.querySelectorAll('.tour-on').forEach(function (e) { e.classList.remove('tour-on'); });
    if (i < 0 || i >= TOUR.length) { $('tour').hidden = true; step = -1; $('tourBtn').focus(); return; }
    step = i;
    var target = document.querySelector(TOUR[i][0]);
    target.classList.add('tour-on');
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    $('tourN').textContent = t('tour.n', { i: i + 1, n: TOUR.length });
    $('tourTitle').textContent = t(TOUR[i][1] + '.t');
    $('tourText').textContent = t(TOUR[i][1]);
    $('tourBack').disabled = i === 0;
    $('tourNext').textContent = t(i === TOUR.length - 1 ? 'tour.done' : 'tour.next');
    $('tour').hidden = false;
    $('tourNext').focus();
  }

  var PAGES = { context: context, home: home, protests: protests, courts: courts, states: states, state: state, crimes: crimes, crime: crime, method: method };
  function renderAll() {
    if (PAGES[PAGE]) PAGES[PAGE]();
    toc(); links(); wireTips();
  }

  // Links into the old single page land on the page that now holds that section.
  function oldHash() {
    if (PAGE !== 'home' || !location.hash) return false;
    var h = location.hash.slice(1), m = h.match(/^s-(.+)$/);
    var to = m ? '/states/' + m[1] + '/' : { protests: '/protests/', courts: '/courts/', fir: '/courts/', states: '/states/', state: '/states/',
      crimes: '/crimes/', data: '/method/', method: '/method/', read: '/method/#read' }[h];
    if (to) { location.replace(to + location.search); return true; }
    return false;
  }

  // ---------- staying current ----------
  // When the reader comes back to this tab, or back to this page, ask the
  // server which build is live. If it is newer than the one this page came
  // from, reload. Never while the page is in view, so nothing moves under
  // someone who is reading.
  var lastCheck = 0;
  function checkBuild() {
    if (!window.SC_BUILD || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    fetch('/version.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (v && v.build && v.build !== window.SC_BUILD) location.reload();
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkBuild(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { lastCheck = 0; checkBuild(); } });

  // ---------- start ----------
  function init() {
    if (oldHash()) return;
    var q = new URL(location.href).searchParams.get('lang'), saved = null;
    try { saved = localStorage.getItem('sc-lang'); } catch (e) {}
    // A language is offered once it is translated. A string not yet translated falls back to English in t().
    var ready = function (l) { return l === 'en' || Object.keys(I.dict[l] || {}).length > 0; };
    Array.prototype.slice.call($('lang').options).forEach(function (o) { if (!ready(o.value)) o.remove(); });
    lang = ready(q) ? q : (ready(saved) ? saved : 'en');
    $('lang').addEventListener('change', function () { setLang(this.value); });
    if ($('tourBtn')) {
      $('tourBtn').addEventListener('click', function () { tourShow(0); });
      $('tourNext').addEventListener('click', function () { tourShow(step + 1); });
      $('tourBack').addEventListener('click', function () { tourShow(step - 1); });
      $('tourClose').addEventListener('click', function () { tourShow(-1); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && step >= 0) tourShow(-1); });
    }
    var mb = $('menuBtn'), nav = $('nav');
    function setMenu(open) { nav.classList.toggle('open', open); mb.setAttribute('aria-expanded', String(open)); }
    mb.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); mb.focus(); } });
    var th = $('theme');
    function dark() { var d = document.documentElement.dataset.theme; return d ? d === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
    th.setAttribute('aria-pressed', String(dark()));
    th.addEventListener('click', function () {
      var next = dark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = next; th.setAttribute('aria-pressed', String(next === 'dark'));
      try { localStorage.setItem('sc-theme', next); } catch (e) {}
      if (PAGE === 'courts') field();
    });
    if ($('mapHead')) {
      $('mapHead').addEventListener('change', function () { st.head = this.value; map(); links($('rank')); });
      $('mapYear').addEventListener('change', function () { st.year = +this.value; map(); links($('rank')); });
      $('mapMeasure').addEventListener('change', function () { st.measure = this.value; map(); links($('rank')); });
    }
    if ($('statePick')) $('statePick').addEventListener('change', function () { go(this.value); });
    if ($('crimePick')) $('crimePick').addEventListener('change', function () { location.href = link('/crimes/' + slug(this.value) + '/'); });
    var want = [fetch(ver('/data/site.json')).then(function (r) { return r.json(); })];
    if (PAGE === 'states') want.push(fetch(ver('/data/geo/india.json')).then(function (r) { return r.json(); }));
    if (PAGE === 'context') want.push(fetch(ver('/data/context.json')).then(function (r) { return r.json(); }));
    Promise.all(want).then(function (res) {
      D = res[0]; if (PAGE === 'context') X = res[1]; else GEO = res[1] || null;
      if (GEO) project();
      setLang(lang);
      if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
    }).catch(function (e) {
      console.error(e);
      var m = document.createElement('p'); m.className = 'note'; m.textContent = t('err');
      $('main').prepend(m);
    });
  }
  init();
})();
