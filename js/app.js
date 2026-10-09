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
      ln.id = 'font-' + lang; ln.rel = 'stylesheet'; ln.href = ver(meta.font);
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
      [fmt(S('POCSO_RAPE', 'cases', 'All India', y), 0), t('hero.f3', { y: y }), 'tip.pocso']];
    var o = pc('RAPE', 'All India', y);
    $('heroIso').innerHTML = isoBlock(o, lc(crimeName('RAPE')), y);
    $('heroIso').__csv = isoCsv(o);
    $('heroIso').setAttribute('aria-label', t('iso.cap', { crime: lc(crimeName('RAPE')), y: y, conv: fmt(o.conv, 0), pend: fmt(o.ptr, 0), share: isoParts(o)[3] }));
    $('heroFigs').innerHTML = out.map(function (f) { return '<div class="fig"><b>' + f[0] + '</b><span' + (f[2] ? ' data-tip="' + f[2] + '"' : '') + '>' + f[1] + '</span></div>'; }).join('');
  }
  // Four findings, each computed from the data, so they move when it does.
  function findings() {
    var y0 = D.years[0], y1 = D.years[D.years.length - 1];
    var cr = cases('CRUELTY', 'All India')[4] / cases('TOTAL', 'All India')[4] * 100;
    var pa = cases('POCSO_RAPE', 'All India'), ch = Math.round((pa[4] - pa[0]) / pa[0] * 100);
    var cs = S('RAPE', 'police_chargesheeting_rate', 'All India', y1);
    var done = S('RAPE', 'court_trials_completed', 'All India', y1), pend = S('RAPE', 'court_pending_trial_end_of_year', 'All India', y1);
    var f = [
      [t('field.big', { share: Math.round(cr) }), t('find.1', { share: Math.round(cr), y: y1 }), '/crimes/cruelty/'],
      ['+' + ch + '%', t('find.2', { a: fmt(pa[0], 0), b: fmt(pa[4], 0), y0: y0, y1: y1 }), '/crimes/pocso-rape/'],
      [t('field.big', { share: Math.round(cs) }), t('find.3', { cs: Math.round(cs), y: y1 }), '/courts/'],
      [t('find.yrs', { n: fmt(pend / done, 1) }), t('find.4', { done: fmt(done, 0), pend: fmt(pend, 0), y: y1, yrs: fmt(pend / done, 1) }), '/courts/#years']];
    $('findList').innerHTML = f.map(function (x) { return '<li><b>' + x[0] + '</b><span>' + x[1] + '</span><a href="' + link(x[2]) + '">' + t('find.more') + '</a></li>'; }).join('');
  }
  function home() {
    hero();
    findings();
    var o = pc('RAPE', 'All India', 2024);
    $('homeCourts').textContent = t('home.courts.t', { conv: Math.round(o.cr), y: 2024 });
    // a strip of every rape case before the courts in 2024, split by outcome
    var parts = [['conv', '--red'], ['acq', '--turmeric'], ['dis', '--q4'], ['othc', '--soft'], ['ptr', '--knot-open']], x = 0, g = '';
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
      C.columns($('prChart'), { x: D.years, fmt: function (v) { return fmt(v, 1); }, label: t('pr.chart'),
        series: [{ label: place('Delhi'), values: row('RAPE', 'rate', 'Delhi'), color: '--red' },
                 { label: place('Bihar'), values: row('RAPE', 'rate', 'Bihar'), color: '--knot' },
                 { label: t('india'), values: row('RAPE', 'rate', 'All India'), color: '--soft' }] });
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
      { id: 'dis', col: 4, value: o.dis, label: t('flow.dis'), color: '--q4' },
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

  // A hundred women: each one is 1 in every 100 cases of a crime before the
  // courts in a year, coloured by how the case stood when the year ended.
  var ISO = [['conv', '--red', null], ['acq', null, '--red'], ['other', '--soft', null], ['pend', '--knot', null]];
  function isoParts(o) { return C.hundred([o.conv, o.acq + o.dis, o.othc, o.ptr]); }
  function isoCsv(o) {
    var n = isoParts(o);
    return [['', 'cases', 'figures of 100']].concat([[t('leg.conv'), o.conv, n[0]], [t('leg.acq'), o.acq + o.dis, n[1]], [t('leg.other'), o.othc, n[2]], [t('leg.pend'), o.ptr, n[3]]]);
  }
  function isoBlock(o, crime, y) {
    var n = isoParts(o), share = n[3];
    var leg = [[t('leg.conv'), o.conv], [t('leg.acq'), o.acq + o.dis], [t('leg.other'), o.othc], [t('leg.pend'), o.ptr]];
    return '<p class="isobig"><b>' + t('field.big', { share: share }) + '</b><span>' + t('field.bigsub', { crime: crime, y: y }) + '</span></p>' +
      C.iso(ISO.map(function (g, i) { return { n: n[i], fill: g[1], line: g[2] }; })) +
      '<ul class="legend">' + leg.map(function (l, i) { return '<li>' + C.woman(ISO[i][1], ISO[i][2]) + l[0] + ' · ' + fmt(l[1], 0) + '</li>'; }).join('') + '</ul>' +
      '<p class="isonote">' + t('iso.per') + '</p>';
  }
  function field() {
    var c = st.crime, y = st.year, o = pc(c, 'All India', y), name = lc(crimeName(c));
    var share = isoParts(o)[3];
    $('h-courts').textContent = t('courts.hy', { y: y });
    $('courtsIntro').textContent = t('courts.intro', { n: fmt(o.ct, 0), crime: name, y: y });
    $('field').innerHTML = isoBlock(o, name, y);
    $('field').__csv = isoCsv(o);
    $('fieldCap').innerHTML = t('iso.cap', { crime: name, y: y, conv: '<b>' + fmt(o.conv, 0) + '</b>', pend: fmt(o.ptr, 0), share: share });
    $('field').setAttribute('aria-label', $('fieldCap').textContent);
  }

  // verdicts by year, as stacked bars
  function outcomes(code, p) {
    tabs($('obMode'), ['all', 'done'], 'ob', function (m) { return t('ob.' + m); }, function () { outcomes(code, p); });
    var share = st.ob === 'done';
    var keys = [{ key: 'conv', label: t('flow.conv'), color: '--red' }, { key: 'acq', label: t('flow.acq'), color: '--turmeric' },
                { key: 'dis', label: t('flow.dis'), color: '--q4' }];
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
    svg.__csv = [['state', st.measure === 'rate' ? 'per lakh women' : 'cases']].concat(vals.slice().sort(function (a, b) { return byName(a[0], b[0]); }).map(function (v) { return [place(v[0].id), v[1]]; }));
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
  // Squares for the tile map: [code, column, row], placed roughly where each lies.
  var TILES = { 'Jammu & Kashmir': ['JK', 3, 0], 'Ladakh': ['LA', 4, 0], 'Chandigarh': ['CH', 2, 1], 'Punjab': ['PB', 3, 1], 'Himachal Pradesh': ['HP', 4, 1],
    'Rajasthan': ['RJ', 2, 2], 'Haryana': ['HR', 3, 2], 'Delhi': ['DL', 4, 2], 'Uttarakhand': ['UK', 5, 2], 'Sikkim': ['SK', 6, 2], 'Arunachal Pradesh': ['AR', 9, 2],
    'Gujarat': ['GJ', 1, 3], 'Madhya Pradesh': ['MP', 2, 3], 'Uttar Pradesh': ['UP', 3, 3], 'Bihar': ['BR', 4, 3], 'West Bengal': ['WB', 5, 3], 'Meghalaya': ['ML', 7, 3], 'Assam': ['AS', 8, 3], 'Nagaland': ['NL', 9, 3],
    'D&N Haveli and Daman & Diu': ['DD', 0, 4], 'Maharashtra': ['MH', 2, 4], 'Chhattisgarh': ['CG', 3, 4], 'Jharkhand': ['JH', 4, 4], 'Tripura': ['TR', 7, 4], 'Mizoram': ['MZ', 8, 4], 'Manipur': ['MN', 9, 4],
    'Goa': ['GA', 1, 5], 'Karnataka': ['KA', 2, 5], 'Telangana': ['TG', 3, 5], 'Odisha': ['OD', 4, 5],
    'Andhra Pradesh': ['AP', 3, 6], 'A&N Islands': ['AN', 6, 6],
    'Lakshadweep': ['LD', 0, 7], 'Kerala': ['KL', 2, 7], 'Tamil Nadu': ['TN', 3, 7], 'Puducherry': ['PY', 4, 7] };
  function tileMap() {
    var dp = st.measure === 'rate' ? 1 : 0, y0 = D.years[0], y1 = D.years[D.years.length - 1];
    var list = STATES().filter(function (p) { return TILES[p.id]; }).map(function (p) {
      var vals = D.years.map(function (y) { return mapValue(st.head, p.id, y); });
      return { code: TILES[p.id][0], col: TILES[p.id][1], row: TILES[p.id][2], name: place(p.id), values: vals, last: vals[vals.length - 1], href: link('/states/' + slug(p.id) + '/') };
    });
    var unit = st.measure === 'rate' ? t('unit.rate') : t('unit.cases');
    $('tileCap').textContent = t('tiles.cap', { crime: head(st.head), unit: unit, y0: y0, y1: y1 });
    C.watch($('tileChart'), function () { C.tiles($('tileChart'), { tiles: list, x: D.years, label: $('tileCap').textContent, fmt: function (v) { return fmt(v, dp); } }); });
  }
  // The same map in each of the five years, on one colour scale for all five.
  function yearMaps() {
    var dp = st.measure === 'rate' ? 1 : 0, all = [], per = {};
    D.years.forEach(function (y) { per[y] = {}; STATES().forEach(function (p) { var v = mapValue(st.head, p.id, y); per[y][p.map] = v; if (v != null) all.push(v); }); });
    all.sort(function (a, b) { return a - b; });
    var cuts = [0.2, 0.4, 0.6, 0.8].map(function (q) { return all[Math.min(all.length - 1, Math.floor(q * all.length))]; });
    var bin = function (v) { if (v == null) return -1; var b = 0; cuts.forEach(function (c) { if (v > c) b++; }); return b; };
    var names = {}; STATES().forEach(function (p) { names[p.map] = place(p.id); });
    var unit = st.measure === 'rate' ? t('unit.rate') : t('unit.cases');
    $('yearCap').textContent = t('years.cap', { crime: head(st.head), unit: unit });
    var box = $('yearMaps');
    C.watch(box, function () {
      var W = Math.max(260, box.clientWidth), n = W < 560 ? 2 : W < 900 ? 3 : 5, gap = 10, mw = (W - gap * (n - 1)) / n, k = mw / projected.W, mh = projected.H * k;
      var rows = Math.ceil(D.years.length / n), H = rows * (mh + 28), g = '';
      D.years.forEach(function (y, i) {
        var x = (i % n) * (mw + gap), top = Math.floor(i / n) * (mh + 28);
        g += '<text class="lab" x="' + (x + 2) + '" y="' + (top + 15) + '">' + y + '</text><g transform="translate(' + x.toFixed(1) + ' ' + (top + 22) + ') scale(' + k.toFixed(4) + ')">';
        projected.paths.forEach(function (pp) {
          var v = per[y][pp.name], b = bin(v);
          g += '<path d="' + pp.d + '" fill="' + (b < 0 ? 'var(--ground)' : 'var(' + RAMP[b] + ')') + '" stroke="var(--cloth)" stroke-width="' + (0.6 / k).toFixed(2) + '"><title>' + pp.name + ', ' + y + ': ' + (v == null ? t('nodata') : fmt(v, dp)) + '</title></path>';
        });
        g += '</g>';
      });
      var edges = [all[0]].concat(cuts).concat([all[all.length - 1]]);
      box.innerHTML = '<ul class="legend">' + RAMP.map(function (r, i) { return '<li><i style="background:var(' + r + ')"></i>' + t('range', { a: fmt(edges[i], dp), b: fmt(edges[i + 1], dp) }) + '</li>'; }).join('') + '</ul>' +
        '<svg viewBox="0 0 ' + W + ' ' + Math.ceil(H) + '" width="' + W + '" height="' + Math.ceil(H) + '" role="img" aria-label="' + $('yearCap').textContent.replace(/"/g, '') + '">' + g + '</svg>';
      box.__csv = [['state'].concat(D.years)].concat(STATES().slice().sort(byName).map(function (p) { return [place(p.id)].concat(D.years.map(function (y) { return mapValue(st.head, p.id, y); })); }));
    });
  }
  function states() {
    map();
    tileMap();
    yearMaps();
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
  // Rape survivors by age (NCRB table 3A.3), for India or one state.
  var AGES = [['victims_under6', 'age.u6'], ['victims_6_12', '6-12'], ['victims_12_16', '12-16'], ['victims_16_18', '16-18'],
              ['victims_18_30', '18-30'], ['victims_30_45', '30-45'], ['victims_45_60', '45-60'], ['victims_60plus', 'age.60']];
  function ages(p) {
    var y = 2024, vals = AGES.map(function (g) { return S('RAPE_VICTIMS_AGE', g[0], p, y); });
    if (vals.every(function (v) { return v == null; })) { $('ages').hidden = true; return; }
    $('ages').hidden = false;
    $('ageCap').textContent = t('age.cap', { y: y, place: p === 'All India' ? t('india') : place(p), girls: fmt(S('RAPE_VICTIMS_AGE', 'victims_girls', p, y), 0), women: fmt(S('RAPE_VICTIMS_AGE', 'victims_women', p, y), 0) });
    C.watch($('ageChart'), function () {
      C.columns($('ageChart'), { x: AGES.map(function (g) { return g[1].indexOf('age.') === 0 ? t(g[1]) : g[1]; }), xWrap: true, label: $('ageCap').textContent,
        fmt: function (v, tick) { return tick && v >= 1000 ? fmt(v / 1000, v % 1000 ? 1 : 0) + 'k' : fmt(v, 0); },
        series: [{ label: t('age.h'), values: vals, color: '--knot' }] });
    });
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
    ages(p);
    var dbRows = CRIMES.filter(function (c) { return c !== 'TOTAL'; }).map(function (c) { return { label: head(c), a: rate(c, p, 2024), b: rate(c, 'All India', 2024) }; })
      .filter(function (r) { return r.a != null || r.b != null; });
    C.watch($('dbChart'), function () {
      C.dumbbell($('dbChart'), { rows: dbRows, aLabel: place(p), bLabel: t('india'), label: t('db.cap'), fmt: function (v) { return fmt(v, v < 1 ? 2 : 1); } });
    });
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
  // The headings that together make up all crimes against women, with no case
  // counted twice (NCRB files each case under its most serious offence). What
  // the named headings leave over is shown as the rest of each law's total.
  var MIX_IPC = ['RAPE', 'ATTEMPT_RAPE', 'DECEIT_69', 'ASSAULT_MODESTY', 'INSULT_MODESTY', 'MURDER_RAPE', 'DOWRY_DEATH', 'ABETMENT_SUICIDE', 'CRUELTY', 'KIDNAP', 'ACID', 'ACID_ATTEMPT', 'TRAFFICKING'];
  var MIX_SLL = ['POCSO_TOTAL', 'DOWRY_ACT', 'PWDVA', 'ITPA', 'CYBER'];
  var GROUP_COLOR = { sexual: ['--red'], killed: ['--knot'], home: ['--turmeric', '#16181d'], other: ['--q3'] };
  function mix() {
    var years = D.years.slice().reverse();
    if (years.indexOf(st.mixY) < 0) st.mixY = years[0];
    tabs($('mixYear'), years, 'mixY', String, mix);
    var y = st.mixY, i = D.years.indexOf(y), items = [];
    var add = function (code) { var v = (cases(code, 'All India') || [])[i]; if (v) { var c = GROUP_COLOR[D.heads[code].group]; items.push({ label: head(code), value: v, color: c[0], ink: c[1] }); return v; } return 0; };
    var ipc = MIX_IPC.reduce(function (a, c) { return a + add(c); }, 0), sll = MIX_SLL.reduce(function (a, c) { return a + add(c); }, 0);
    var restI = cases('IPC_TOTAL', 'All India')[i] - ipc, restS = cases('SLL_TOTAL', 'All India')[i] - sll;
    if (restI > 0) items.push({ label: t('mix.ipc'), value: restI, color: '--soft' });
    if (restS > 0) items.push({ label: t('mix.sll'), value: restS, color: '--soft' });
    var total = cases('TOTAL', 'All India')[i];
    $('mixCap').textContent = t('mix.cap', { y: y, n: fmt(total, 0) });
    C.watch($('mixChart'), function () {
      C.treemap($('mixChart'), { items: items, fmt: function (v) { return fmt(v, 0); }, label: $('mixCap').textContent });
      $('mixChart').insertAdjacentHTML('afterbegin', '<ul class="legend">' + ['sexual', 'killed', 'home', 'other'].map(function (g) {
        return '<li><i style="background:var(' + GROUP_COLOR[g][0] + ')"></i>' + t('group.' + g) + '</li>'; }).join('') + '<li><i style="background:var(--soft)"></i>' + t('mix.rest') + '</li></ul>');
    });
  }
  function crimes() {
    mix();
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
    if (c === 'RAPE') ages('All India');
    var hrows = STATES().slice().sort(byName).map(function (p) { return { label: place(p.id), values: D.years.map(function (y) { return rate(c, p.id, y); }) }; });
    C.watch($('heatChart'), function () {
      C.heat($('heatChart'), { rows: hrows, x: D.years, label: t('heat.cap'), fmt: function (v) { return fmt(v, v < 10 ? 1 : 0); } });
    });
    var dp = rate(c, 'All India', D.years[D.years.length - 1]) < 1 ? 2 : 1;
    var swRows = D.years.map(function (y) {
      return { label: String(y), mark: rate(c, 'All India', y), dots: STATES().map(function (p) { return { name: place(p.id), v: rate(c, p.id, y) }; }).filter(function (d) { return d.v != null; }) };
    });
    C.watch($('swarmChart'), function () {
      C.swarm($('swarmChart'), { rows: swRows, markLabel: t('india'), dotLabel: t('spread.dot'), label: t('spread.cap'), fmt: function (v) { return fmt(v, dp); } });
    });
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
      C.columns($('ncwChart'), { x: D.years, fmt: function (v, tick) { return tick && v >= 1000 ? fmt(v / 1000, v % 1000 ? 1 : 0) + 'k' : fmt(v, 0); }, label: $('ncwCap').textContent, series: [
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
      C.columns($('adsiChart'), { x: D.years, fmt: function (v, tick) { return tick && v >= 1000 ? fmt(v / 1000, v % 1000 ? 1 : 0) + 'k' : fmt(v, 0); }, label: $('adsiCap').textContent, series: [
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


  // ---------- explore ----------
  // The whole dataset as a table: filter, search, sort, choose columns and
  // download the rows in view. data/explore.json is data/shecounts.csv with
  // each repeated value written once (scripts/build_explore.py); a download
  // rebuilds full rows in the CSV's own columns. The view lives in the address.
  var E = null, ex = null;
  var EXCOLS = ['law', 'kind', 'unit', 'table', 'flag', 'note'];
  function exParams() {
    var q = new URL(location.href).searchParams, all = E.years.slice();
    var ys = (q.get('y') || '').split(',').map(Number).filter(function (y) { return all.indexOf(y) >= 0; });
    return { q: q.get('q') || '', crime: q.get('crime') || '', place: q.get('place') || '', m: q.has('m') ? q.get('m') : 'cases',
      years: ys.length ? ys : all, lay: q.get('lay') === 'long' ? 'long' : 'wide', cols: (q.get('cols') || 'law').split(',').filter(function (c) { return EXCOLS.indexOf(c) >= 0; }),
      sort: q.get('sort') || '', desc: q.get('dir') !== 'asc', shown: 100 };
  }
  function exSave() {
    var u = new URL(location.href), q = u.searchParams;
    var set = function (k, v, dflt) { if (v === dflt || v === '') q.delete(k); else q.set(k, v); };
    set('q', ex.q, ''); set('crime', ex.crime, ''); set('place', ex.place, ''); set('m', ex.m, 'cases');
    set('y', ex.years.length === E.years.length ? '' : ex.years.join(','), ''); set('lay', ex.lay, 'wide');
    set('cols', ex.cols.join(','), 'law'); set('sort', ex.sort, ''); set('dir', ex.sort && !ex.desc ? 'asc' : '', '');
    history.replaceState(null, '', u);
  }
  function exPrep() {
    E.years = Object.keys(E.sources).map(Number).sort();
    E.code = E.crimes.map(function (c) { return c[0]; });
    E.codes = E.code.filter(function (c, i) { return E.code.indexOf(c) === i; });
    E.mcodes = E.measures.map(function (m) { return m[0]; });
  }
  function exCrime(code) { return D.heads[code] ? head(code) : code; }
  function exLaw(ci) { var c = E.crimes[ci]; return [c[3] ? 'IPC ' + c[3] : '', c[4]].filter(Boolean).join(' · '); }
  function exVal(v, unit) {
    if (v == null) return '–';
    if (typeof v === 'string') return v;
    return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  function exFilter() {
    var q = ex.q.trim().toLowerCase(), out = [];
    var pl = ex.place, kind = pl.charAt(0) === ':' ? pl.slice(1) : null;
    var text = {};
    E.rows.forEach(function (r) {
      if (ex.years.indexOf(r[1]) < 0) return;
      var p = E.places[r[0]], c = E.code[r[2]], m = E.measures[r[3]];
      if (ex.crime && c !== ex.crime) return;
      if (ex.m && m[0] !== ex.m) return;
      if (kind ? p[2] !== kind : (pl && p[0] !== pl)) return;
      if (q) {
        var key = r[0] + '|' + r[2] + '|' + r[3] + '|' + r[7];
        if (text[key] == null) text[key] = [p[0], place(p[0]), c, E.crimes[r[2]][2], exCrime(c), m[2], exLaw(r[2]), E.notes[r[7]]].join(' ').toLowerCase();
        if (text[key].indexOf(q) < 0) return;
      }
      out.push(r);
    });
    return out;
  }
  function exGroups(rows) {
    if (ex.lay === 'long') return rows.map(function (r) { return { r: r, vals: null }; });
    var g = {}, order = [];
    rows.forEach(function (r) {
      var k = r[0] + '|' + r[2] + '|' + r[3];
      if (!g[k]) { g[k] = { r: r, vals: {} }; order.push(k); }
      g[k].vals[r[1]] = r[4];
    });
    return order.map(function (k) { return g[k]; });
  }
  function exSortKey(x) {
    var r = x.r, k = ex.sort;
    if (k === 'place') return place(E.places[r[0]][0]);
    if (k === 'crime') return exCrime(E.code[r[2]]);
    if (k === 'measure') return E.measures[r[3]][2];
    if (k === 'year') return r[1];
    if (k === 'value') return typeof r[4] === 'number' ? r[4] : null;
    if (k.charAt(0) === 'y' && x.vals) { var v = x.vals[+k.slice(1)]; return typeof v === 'number' ? v : null; }
    return null;
  }
  function exDraw() {
    if (ex.sort && (ex.lay === 'long' ? /^y\d/.test(ex.sort) : /^(year|value)$/.test(ex.sort) ) || (/^y\d/.test(ex.sort) && ex.years.indexOf(+ex.sort.slice(1)) < 0)) { ex.sort = ''; exSave(); }
    var rows = exFilter(), groups = exGroups(rows);
    if (ex.sort) {
      var num = ex.sort === 'value' || ex.sort === 'year' || ex.sort.charAt(0) === 'y';
      groups.sort(function (a, b) {
        var va = exSortKey(a), vb = exSortKey(b);
        if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
        var d = num ? va - vb : String(va).localeCompare(String(vb), lang);
        return ex.desc ? -d : d;
      });
    }
    ex.rows = rows;
    var years = ex.years, cols = [['place', t('pick.state')], ['crime', t('crime')], ['measure', t('ex.measure')]];
    if (ex.lay === 'long') cols.push(['year', t('year')], ['value', t('ex.value')]);
    else years.forEach(function (y) { cols.push(['y' + y, String(y)]); });
    var opt = ex.cols.map(function (c) { return [c, t('ex.c.' + c)]; });
    var h = '<thead><tr>' + cols.concat(opt).map(function (c, i) {
      var sortable = i < cols.length, s = ex.sort === c[0];
      return '<th scope="col"' + (s ? ' aria-sort="' + (ex.desc ? 'descending' : 'ascending') + '"' : '') + (i > 2 && i < cols.length ? '' : ' class="t"') + '>' +
        (sortable ? '<button type="button" data-k="' + c[0] + '">' + c[1] + (s ? (ex.desc ? ' ↓' : ' ↑') : '') + '</button>' : c[1]) + '</th>';
    }).join('') + (ex.lay === 'wide' && years.length > 1 ? '<th scope="col">' + t('trend') + '</th>' : '') + '</tr></thead><tbody>';
    groups.slice(0, ex.shown).forEach(function (x) {
      var r = x.r, p = E.places[r[0]], c = E.code[r[2]], m = E.measures[r[3]];
      var pn = place(p[0]), pc2 = p[2] === 'total' ? pn : '<a href="' + link('/states/' + slug(p[0]) + '/') + '">' + pn + '</a>';
      var cn = CRIMES.indexOf(c) >= 0 ? '<a href="' + link('/crimes/' + slug(c) + '/') + '">' + exCrime(c) + '</a>' : exCrime(c);
      h += '<tr><th scope="row">' + pc2 + '</th><td class="t">' + cn + '</td><td class="t">' + m[2] + '</td>';
      if (ex.lay === 'long') h += '<td>' + r[1] + '</td><td class="hl">' + exVal(r[4], m[1]) + '</td>';
      else years.forEach(function (y) { h += '<td>' + exVal(x.vals[y], m[1]) + '</td>'; });
      ex.cols.forEach(function (k) {
        var v = k === 'law' ? exLaw(r[2]) : k === 'kind' ? t('ex.k.' + p[2]) : k === 'unit' ? m[1] : k === 'table' ? E.tables[r[5]] : k === 'flag' ? E.flags[r[6]].replace(/;/g, ', ') : E.notes[r[7]];
        h += '<td class="t' + (k === 'note' ? ' wide' : '') + '">' + (v || '') + '</td>';
      });
      if (ex.lay === 'wide' && years.length > 1) h += '<td>' + spark(years.map(function (y) { var v = x.vals[y]; return typeof v === 'number' ? v : null; })) + '</td>';
      h += '</tr>';
    });
    if (!groups.length) h += '<tr><td colspan="' + (cols.length + opt.length + 1) + '" class="t">' + t('ex.none') + '</td></tr>';
    var tb = $('exTable'); tb.innerHTML = h + '</tbody>';
    tb.querySelectorAll('thead button').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.k;
        if (ex.sort === k) { if (ex.desc === (k === 'place' || k === 'crime' || k === 'measure')) ex.sort = ''; else ex.desc = !ex.desc; }
        else { ex.sort = k; ex.desc = !(k === 'place' || k === 'crime' || k === 'measure'); }
        exSave(); exDraw();
      });
    });
    $('exCount').textContent = t(ex.lay === 'long' ? 'ex.count.long' : 'ex.count.wide', { n: fmt(groups.length, 0), rows: fmt(rows.length, 0), shown: fmt(Math.min(ex.shown, groups.length), 0) });
    var left = groups.length - ex.shown;
    $('exMore').hidden = left <= 0;
    $('exMore').textContent = t('ex.more', { n: fmt(Math.min(100, left), 0), left: fmt(left, 0) });
    $('exDl').disabled = !rows.length;
  }
  function exControls() {
    var cs = $('exCrime');
    cs.innerHTML = '<option value="">' + t('ex.all.crimes') + '</option>' + E.codes.map(function (c) { return '<option value="' + c + '">' + exCrime(c) + '</option>'; }).join('');
    cs.value = ex.crime;
    var ps = $('exPlace'), seen = {};
    var list = E.places.filter(function (p) { if (seen[p[0]]) return false; seen[p[0]] = 1; return true; });
    var opts = function (k) { return list.filter(function (p) { return p[2] === k; }).sort(function (a, b) { return place(a[0]).localeCompare(place(b[0]), lang); }).map(function (p) { return '<option value="' + p[0] + '">' + place(p[0]) + '</option>'; }).join(''); };
    ps.innerHTML = '<option value="">' + t('ex.all.places') + '</option><option value=":state">' + t('ex.all.state') + '</option><option value=":ut">' + t('ex.all.ut') + '</option><option value=":total">' + t('ex.all.total') + '</option>' +
      '<optgroup label="' + t('ex.k.state') + '">' + opts('state') + '</optgroup><optgroup label="' + t('ex.k.ut') + '">' + opts('ut') + '</optgroup><optgroup label="' + t('ex.k.total') + '">' + opts('total') + '</optgroup>';
    ps.value = ex.place;
    var ms = $('exMeasure'), mseen = {};
    ms.innerHTML = '<option value="">' + t('ex.all.measures') + '</option>' + E.measures.filter(function (m) { if (mseen[m[0]]) return false; mseen[m[0]] = 1; return true; })
      .map(function (m) { return '<option value="' + m[0] + '">' + m[2] + '</option>'; }).join('');
    ms.value = ex.m;
    $('exYears').innerHTML = E.years.map(function (y) { return '<button type="button" aria-pressed="' + (ex.years.indexOf(y) >= 0) + '" data-y="' + y + '">' + y + '</button>'; }).join('');
    tabs($('exLayout'), ['wide', 'long'], 'exLay', function (k) { return t('ex.' + k); }, function () { ex.lay = st.exLay; exSave(); exControls(); exDraw(); });
    $('exLayout').querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-selected', String(['wide', 'long'][i] === ex.lay)); });
    $('exCols').innerHTML = EXCOLS.map(function (c) { return '<label><input type="checkbox" value="' + c + '"' + (ex.cols.indexOf(c) >= 0 ? ' checked' : '') + '> ' + t('ex.c.' + c) + '</label>'; }).join('');
    $('exQ').value = ex.q;
  }
  function exCsv() {
    var head2 = E.columns, out = [head2];
    ex.rows.forEach(function (o) {
      var p = E.places[o[0]], c = E.crimes[o[2]], m = E.measures[o[3]], s = E.sources[String(o[1])];
      out.push([p[0], p[1], p[2], o[1], c[0], c[1], c[2], c[3], c[4], m[0], o[4] == null ? '' : o[4], m[1], s[0], E.tables[o[5]], s[1], s[2], E.flags[o[6]], E.notes[o[7]]]);
    });
    return out;
  }
  function explore() {
    if (!ex) {
      exPrep(); ex = exParams(); st.exLay = ex.lay;
      var redraw = function () { ex.shown = 100; exSave(); exDraw(); };
      var timer;
      $('exQ').addEventListener('input', function () { clearTimeout(timer); var v = this.value; timer = setTimeout(function () { ex.q = v; redraw(); }, 180); });
      $('exCrime').addEventListener('change', function () { ex.crime = this.value; redraw(); });
      $('exPlace').addEventListener('change', function () { ex.place = this.value; redraw(); });
      $('exMeasure').addEventListener('change', function () { ex.m = this.value; redraw(); });
      $('exYears').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var y = +b.dataset.y, i = ex.years.indexOf(y);
        if (i >= 0 && ex.years.length > 1) ex.years.splice(i, 1); else if (i < 0) ex.years.push(y);
        ex.years.sort(); b.setAttribute('aria-pressed', String(ex.years.indexOf(y) >= 0)); redraw();
      });
      $('exCols').addEventListener('change', function () {
        ex.cols = EXCOLS.filter(function (c) { var i = $('exCols').querySelector('input[value="' + c + '"]'); return i && i.checked; }); exSave(); exDraw();
      });
      $('exReset').addEventListener('click', function () { var keep = ex.lay; ex = { q: '', crime: '', place: '', m: 'cases', years: E.years.slice(), lay: keep, cols: ['law'], sort: '', desc: true, shown: 100 }; exControls(); redraw(); });
      $('exMore').addEventListener('click', function () { ex.shown += 100; exDraw(); });
      $('exDl').addEventListener('click', function () { C.saveCsv(exCsv(), 'shecounts-selection'); });
      $('exLink').addEventListener('click', function () { copy(location.href, $('exLink')); });
    }
    $('exIntro').textContent = t('ex.intro', { n: fmt(E.rows.length, 0) });
    exControls();
    exDraw();
  }

  // ---------- sharing and saving ----------
  // Under every chart a row of buttons, as on offtheroll.in: the chart as a
  // PNG or SVG card that carries its title and its source, the numbers behind
  // it as a CSV, a WhatsApp message with the finding and a link to this
  // section, and a copied link.
  var LINKICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
  function pageUrl(hash) { var u = new URL(location.href); u.hash = hash || ''; return u.toString(); }
  function copy(text, btn, msg) {
    var done = function () { btn.setAttribute('data-msg', t('tools.copied')); setTimeout(function () { btn.removeAttribute('data-msg'); }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { prompt('', text); }); else prompt('', text);
  }
  function sectionOf(el) { var s = el.closest('section[id]'); return s ? s.id : ''; }
  function chartTitle(fig) {
    var s = fig.closest('section'), h = s && s.querySelector('h2'), h1 = document.querySelector('main h1');
    var a = h ? h.firstChild.textContent.trim() : '', b = (PAGE === 'state' || PAGE === 'crime') && h1 ? h1.textContent.trim() : '';
    // a figure outside any section (the home page's hundred women) is titled by its own sentence
    var box = fig.querySelector('[aria-label]') || fig;
    return [a, b].filter(Boolean).join(', ') || box.getAttribute('aria-label') || document.title;
  }
  function finding(fig) {
    var s = fig.closest('section'), p = s && s.querySelector('.lead2, .intro[id], #flowIntro, #courtsIntro');
    var box = fig.querySelector('[aria-label]') || fig;
    return (p && p.textContent.trim()) || box.getAttribute('aria-label') || (fig.querySelector('figcaption') || {}).textContent || document.title;
  }
  function tools() {
    document.querySelectorAll('main figure.chart, main figure.isofig, main figure.field, main figure.map').forEach(function (fig) {
      if (fig.querySelector('.tools') || fig.querySelector('figure')) return;
      var box = fig.querySelector('#field, .chart > div[id], div[id], svg[id]') || fig;
      var id = box.id || sectionOf(fig), name = (location.pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'shecounts') + '-' + id;
      var bar = document.createElement('div'); bar.className = 'tools';
      bar.innerHTML = '<button type="button" data-t="png">PNG</button><button type="button" data-t="svg">SVG</button><button type="button" data-t="csv">CSV</button>' +
        '<a class="wa" data-t="wa" target="_blank" rel="noopener">' + t('tools.wa') + '</a><button type="button" data-t="link">' + t('tools.link') + '</button>';
      var wa = bar.querySelector('.wa');
      var setWa = function () { wa.href = 'https://wa.me/?text=' + encodeURIComponent(finding(fig).replace(/\s+/g, ' ').trim() + '\n' + pageUrl(sectionOf(fig))); };
      setWa(); wa.addEventListener('mouseenter', setWa); wa.addEventListener('focus', setWa);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-t]'); if (!b) return;
        var k = b.getAttribute('data-t'), foot = 'She Counts · shecounts.netlify.app' + location.pathname + ' · ' + t('tools.src');
        if (k === 'png') C.savePng(box, chartTitle(fig), foot, name);
        else if (k === 'svg') C.saveSvg(box, chartTitle(fig), foot, name);
        else if (k === 'csv' && box.__csv) C.saveCsv(box.__csv, name);
        else if (k === 'link') copy(pageUrl(sectionOf(fig)), b);
        else if (k === 'wa') setWa();
      });
      bar.__box = box;
      fig.appendChild(bar);
    });
    // a chart may be redrawn with or without numbers behind it, so this is checked each time
    document.querySelectorAll('main figure .tools').forEach(function (bar) { bar.querySelector('[data-t=csv]').hidden = !(bar.__box && bar.__box.__csv); });
  }
  // A link button on every section heading: it copies this page's address with
  // the section in it, so a shared link opens on that section.
  function anchors() {
    document.querySelectorAll('main h2[id]').forEach(function (h) {
      if (h.querySelector('.anchor') || h.classList.contains('sr')) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'anchor'; b.innerHTML = LINKICON;
      b.setAttribute('aria-label', t('tools.anchor'));
      b.addEventListener('click', function () { var s = h.closest('section[id]'), id = s ? s.id : h.id; try { history.replaceState(null, '', '#' + id); } catch (e) {} copy(pageUrl(id), b); });
      h.appendChild(b);
    });
    document.querySelectorAll('main h2 .anchor').forEach(function (b) { b.setAttribute('aria-label', t('tools.anchor')); });
  }
  // A link to a section opens on it. Charts draw after the page loads and push
  // what is below them down, so the jump is made again once they are drawn,
  // unless the reader has already started scrolling.
  var moved = false;
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { addEventListener(ev, function () { moved = true; }, { once: true, passive: true }); });
  function jump() {
    if (moved || !location.hash) return;
    var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el && el.closest('main')) el.scrollIntoView({ block: 'start' });
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

  var PAGES = { explore: explore, context: context, home: home, protests: protests, courts: courts, states: states, state: state, crimes: crimes, crime: crime, method: method };
  function renderAll() {
    if (PAGES[PAGE]) PAGES[PAGE]();
    toc(); links(); wireTips(); tools(); anchors(); setTimeout(jump, 50);
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
    });
    if ($('mapHead')) {
      $('mapHead').addEventListener('change', function () { st.head = this.value; map(); tileMap(); yearMaps(); links($('rank')); });
      $('mapYear').addEventListener('change', function () { st.year = +this.value; map(); links($('rank')); });
      $('mapMeasure').addEventListener('change', function () { st.measure = this.value; map(); tileMap(); yearMaps(); links($('rank')); });
    }
    if ($('statePick')) $('statePick').addEventListener('change', function () { go(this.value); });
    if ($('crimePick')) $('crimePick').addEventListener('change', function () { location.href = link('/crimes/' + slug(this.value) + '/'); });
    var want = [fetch(ver('/data/site.json')).then(function (r) { return r.json(); })];
    if (PAGE === 'states') want.push(fetch(ver('/data/geo/india.json')).then(function (r) { return r.json(); }));
    if (PAGE === 'context') want.push(fetch(ver('/data/context.json')).then(function (r) { return r.json(); }));
    if (PAGE === 'explore') want.push(fetch(ver('/data/explore.json')).then(function (r) { return r.json(); }));
    Promise.all(want).then(function (res) {
      D = res[0]; if (PAGE === 'context') X = res[1]; else if (PAGE === 'explore') E = res[1]; else GEO = res[1] || null;
      if (GEO) project();
      setLang(lang);
    }).catch(function (e) {
      console.error(e);
      var m = document.createElement('p'); m.className = 'note'; m.textContent = t('err');
      $('main').prepend(m);
    });
  }
  init();
})();
