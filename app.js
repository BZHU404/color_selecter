/* 色研所 · CHROMA LAB — interface */
(function () {
  "use strict";

  const E = window.ColorEngine;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const STORAGE_HISTORY = "chroma-lab-history-v1";
  const STORAGE_MEDIUM = "chroma-lab-medium-v1";
  const STORAGE_PAPER = "chroma-lab-paper-v1";
  const PAPERS = {
    stone: { label: "冷灰纸", paper: "#EBEDE8", card: "#FAF8F1" },
    porcelain: { label: "暖白纸", paper: "#F3F1EA", card: "#FCFAF4" },
    blue: { label: "雾蓝纸", paper: "#E8ECEE", card: "#FAF8F1" },
  };

  const MEDIA = {
    watercolor: {
      palette: E.WATERCOLOR_PALETTE,
      note: "以透明叠色为主，纸张的白就是最亮的光。",
      label: "水彩颜料",
      kicker: "WATERCOLOUR",
      variables: ["纸张的白度与纹理", "水量与颜料浓度", "透明叠色的层数", "颜料品牌与批次"],
    },
    acrylic: {
      palette: E.PAINT_PALETTE,
      note: "遮盖力更强，干湿差和底材会明显改变最终观感。",
      label: "丙烯 / 油画颜料",
      kicker: "ACRYLIC · OIL",
      variables: ["底材的吸收性与底色", "颜料厚度与罩染层数", "干湿状态下的明度差", "媒介、光泽与泛黄"],
    },
    print: {
      palette: E.PRINT_INKS,
      note: "CMYK 负责分色，专色负责四色难以到达的高饱和区域。",
      label: "印刷油墨",
      kicker: "PRINT INK",
      variables: ["纸张白度与吸收性", "网点扩大与油墨密度", "总墨量 TAC 与叠印", "观察光源与色温"],
    },
    textile: {
      palette: [],
      note: "染料不是颜料：纤维、温度与 pH 决定上染，配方必须做小样。",
      label: "纺织染料",
      kicker: "TEXTILE DYE",
      variables: ["纤维种类与前处理", "浴比、温度与时间", "pH、盐与碱的用量", "水硬度与染料批次"],
    },
  };

  const state = {
    hex: "#2F5D8C",
    h: 210,
    s: 50,
    v: 55,
    harmony: "mono",
    medium: "watercolor",
    fiber: "cotton",
    recipeIndex: 0,
    recipes: [],
    spotRecipes: [],
    dye: null,
    history: [],
    expanded: false,
    sampleHex: null,
    lastRecipeKey: "",
    toastTimer: null,
    recipeTimer: null,
    dragging: false,
    image: { canvas: null, palette: [] },
  };

  const els = {
    stage: $("#stage"),
    stageCursor: $("#stage-cursor"),
    stageHex: $("#stage-hex-text"),
    stageRgb: $("#stage-rgb"),
    stageZh: $("#stage-zh"),
    stageEn: $("#stage-en"),
    hue: $("#hue"),
    hueValue: $("#hue-value"),
    hexInput: $("#hex-input"),
    nativeColor: $("#native-color"),
    profileTopline: $("#profile-topline"),
    colorName: $("#color-name"),
    colorEn: $("#color-en"),
    profileSwatch: $("#profile-swatch"),
    profileSwatchColor: $("#profile-swatch-color"),
    profileSwatchHex: $("#profile-swatch-hex"),
    colorDesc: $("#color-desc"),
    tagRow: $("#tag-row"),
    valueTable: $("#value-table"),
    profileCard: $(".profile-card"),
    rgbBars: $("#rgb-bars"),
    cmykBars: $("#cmyk-bars"),
    history: $("#history-list"),
    wheel: $("#wheel"),
    wheelHex: $("#wheel-hex"),
    wheelMarkers: $("#wheel-markers"),
    wheelHue: $("#wheel-hue-label"),
    harmonyTabs: $("#harmony-tabs"),
    harmonyNote: $("#harmony-note"),
    harmonySwatches: $("#harmony-swatches"),
    contrastPreview: $("#contrast-preview"),
    contrastCopy: $("#contrast-copy"),
    contrastRows: $("#contrast-rows"),
    contrastRank: $("#contrast-rank"),
    mediumTabs: $("#medium-tabs"),
    mediumNote: $("#medium-note"),
    recipeMain: $("#recipe-main"),
    matchCard: $("#match-card"),
    scienceCard: $("#science-card"),
    toast: $("#toast"),
    imageModal: $("#image-modal"),
    dropzone: $("#dropzone"),
    imageFile: $("#image-file"),
    imageWorkspace: $("#image-workspace"),
    imageCanvas: $("#image-canvas"),
    samplePin: $("#sample-pin"),
    sampleSwatch: $("#sample-swatch"),
    sampleHex: $("#sample-hex"),
    sampleRgb: $("#sample-rgb"),
    imagePalette: $("#image-palette"),
    applyImageColor: $("#apply-image-color"),
    canvasShell: $("#canvas-shell"),
  };

  /* ---------- utilities ---------- */

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  function copyText(text, message = "已复制") {
    const done = () => toast(message);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0;pointer-events:none;left:-9999px";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); done(); }
    catch (e) { toast("复制失败，请手动选择数值"); }
    area.remove();
  }

  function formatPct(n) { return `${E.round(n, 1)}%`; }
  function deLabel(de) {
    if (de < 1.6) return "非常接近";
    if (de < 3.5) return "接近";
    if (de < 7) return "可用起点";
    return "需实测调整";
  }
  function deColor(de) {
    if (de < 1.6) return "#587e52";
    if (de < 3.5) return "#7f7a42";
    if (de < 7) return "#9b6a3a";
    return "#a1523e";
  }
  function deg(n) { return `${Math.round(n)}°`; }
  function signed(n, p = 1) {
    const r = E.round(n, p);
    return r > 0 ? `+${r}` : `${r}`;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function simplifyRatio(parts) {
    const min = Math.min(...parts.filter((v) => v > 0.9));
    if (!isFinite(min) || min <= 0) return "";
    return parts.map((v) => {
      const n = v / min;
      return n >= 10 ? String(Math.round(n)) : String(E.round(n, 1));
    }).join(" : ");
  }
  function icon(name) {
    if (name === "shuffle") return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 5.5h-3.1c-2 0-3 1.2-4.1 2.7s-2.2 4-4.6 4H3M14.1 3l2.8 2.5-2.8 2.7"/><path d="M16.5 12.2h-3.1c-1.2 0-2.1-.4-2.8-1.2M14.1 14.5l2.8-2.4-2.8-2.6"/></svg>';
    if (name === "warning") return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.2 18 17H2L10 3.2Z"/><path d="M10 8v4.2M10 14.7v.1"/></svg>';
    if (name === "info") return '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.3"/><path d="M10 9v5M10 6.3v.1"/></svg>';
    return "";
  }

  /* ---------- paper stock ---------- */

  function initPaper() {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_PAPER); } catch (e) {}
    applyPaper(PAPERS[saved] ? saved : "stone", false);
  }

  function applyPaper(name, announce = true) {
    if (!PAPERS[name]) name = "stone";
    document.documentElement.dataset.paper = name;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", PAPERS[name].paper);
    $$(".paper-chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.paper === name)));
    try { localStorage.setItem(STORAGE_PAPER, name); } catch (e) {}
    if (announce) toast(`纸张已切换为${PAPERS[name].label}`);
  }

  function activePaper() {
    return PAPERS[document.documentElement.dataset.paper] || PAPERS.stone;
  }

  /* ---------- colour state ---------- */

  function init() {
    const hash = E.parseHex(location.hash.replace("#", ""));
    let stored = null;
    try { stored = E.parseHex(localStorage.getItem("chroma-lab-last-v1") || ""); } catch (e) {}
    loadHistory();
    const initial = hash ? hash.hex : stored ? stored.hex : "#2F5D8C";
    const savedMedium = (() => { try { return localStorage.getItem(STORAGE_MEDIUM); } catch (e) { return null; } })();
    if (savedMedium && MEDIA[savedMedium]) state.medium = savedMedium;

    bindEvents();
    initPaper();
    setColor(initial, { record: false, updateUrl: false });
    renderHistory();
    syncMediumTabs();
    requestAnimationFrame(() => document.body.classList.add("is-loaded"));
    setTimeout(() => document.body.classList.add("is-loaded"), 400);
  }

  function setColor(hex, opts = {}) {
    const rgb = E.parseHex(hex);
    if (!rgb) return false;
    const hsv = E.rgbToHsv(rgb.r, rgb.g, rgb.b);
    state.hex = rgb.hex;
    state.h = hsv.h;
    state.s = hsv.s;
    state.v = hsv.v;
    state.recipeIndex = 0;
    state.lastRecipeKey = "";
    if (opts.record) pushHistory(rgb.hex);
    renderAll();
    if (opts.updateUrl !== false) {
      try { history.replaceState(null, "", "#" + rgb.hex.slice(1)); } catch (e) {}
    }
    try { localStorage.setItem("chroma-lab-last-v1", rgb.hex); } catch (e) {}
    return true;
  }

  function setHsv(h, s, v, opts = {}) {
    h = E.mod(h, 360); s = clamp(s, 0, 100); v = clamp(v, 0, 100);
    state.h = h; state.s = s; state.v = v;
    const rgb = E.hsvToRgb(h, s, v);
    state.hex = E.rgbToHex(rgb.r, rgb.g, rgb.b);
    state.recipeIndex = 0;
    state.lastRecipeKey = "";
    renderAll({ skipRecipe: !!opts.skipRecipe });
    if (opts.updateUrl !== false) {
      try { history.replaceState(null, "", "#" + state.hex.slice(1)); } catch (e) {}
    }
    try { localStorage.setItem("chroma-lab-last-v1", state.hex); } catch (e) {}
  }

  function pushHistory(hex) {
    state.history = [hex, ...state.history.filter((h) => h !== hex)].slice(0, 9);
    try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(state.history)); } catch (e) {}
    renderHistory();
  }

  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || "[]");
      state.history = Array.isArray(raw) ? raw.filter((h) => E.parseHex(h)).slice(0, 9) : [];
    } catch (e) { state.history = []; }
  }

  function renderAll(opts = {}) {
    const v = E.allValues(state.hex);
    const named = E.nearestTraditional(state.hex);
    const profile = E.describe(state.hex);
    const on = E.textOn(v.rgb);
    const root = document.documentElement;
    root.style.setProperty("--accent", v.hex);
    root.style.setProperty("--on-accent", on.color);

    // stage
    els.stage.style.backgroundColor = v.hex;
    els.stageCursor.style.left = state.s + "%";
    els.stageCursor.style.top = (100 - state.v) + "%";
    els.stageHex.textContent = v.hex;
    els.stageRgb.textContent = `RGB ${v.rgb.r} · ${v.rgb.g} · ${v.rgb.b}`;
    els.stageZh.textContent = named.name;
    els.stageEn.textContent = named.en.toUpperCase();
    els.hue.value = Math.round(state.h);
    els.hueValue.textContent = deg(state.h);
    els.nativeColor.value = v.hex.toLowerCase();
    if (document.activeElement !== els.hexInput) els.hexInput.value = v.hex.slice(1);
    els.profileTopline.style.background = v.hex;

    // identity
    els.colorName.textContent = named.name;
    els.colorEn.textContent = named.en.toUpperCase();
    els.profileSwatchColor.style.background = v.hex;
    els.profileSwatchColor.style.color = on.color;
    els.profileSwatchHex.textContent = v.hex;
    els.profileSwatch.dataset.copy = v.hex;
    els.profileSwatch.setAttribute("aria-label", `当前色卡 ${v.hex}，点击复制`);
    els.colorDesc.textContent = profile.description;
    els.tagRow.innerHTML = profile.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("") +
      `<span class="tag">${esc(named.name)} · 最近传统色</span>`;
    renderValues(v);

    // history highlight
    renderHistory();

    // relationships
    renderRelationships();

    // material recipe (expensive; deferred while dragging)
    if (opts.skipRecipe) scheduleRecipeUpdate();
    else {
      if (state.recipeTimer) { clearTimeout(state.recipeTimer); state.recipeTimer = null; }
      renderRecipe();
    }

    // wheel
    els.wheelHex.textContent = v.hex;
    els.wheelHue.textContent = `H ${Math.round(state.h)}°`;

    document.title = `${named.name} ${v.hex} · 色研所 CHROMA LAB`;
  }

  function renderValues(v) {
    const rows = {
      HEX: v.hex,
      RGB: `${v.rgb.r}, ${v.rgb.g}, ${v.rgb.b}`,
      HSL: `${deg(v.hsl.h)}, ${formatPct(v.hsl.s)}, ${formatPct(v.hsl.l)}`,
      CMYK: `${Math.round(v.cmyk.c)}, ${Math.round(v.cmyk.m)}, ${Math.round(v.cmyk.y)}, ${Math.round(v.cmyk.k)}`,
      LAB: `${E.round(v.lab.l, 1)}, ${signed(v.lab.a, 1)}, ${signed(v.lab.b, 1)}`,
      OKLCH: `${formatPct(v.oklch.l)}, ${E.round(v.oklch.c, 3)}, ${deg(v.oklch.h)}`,
      HSV: `${deg(v.hsv.h)}, ${formatPct(v.hsv.s)}, ${formatPct(v.hsv.v)}`,
      HWB: `${deg(v.hwb.h)}, ${formatPct(v.hwb.w)}, ${formatPct(v.hwb.b)}`,
      XYZ: `${E.round(v.xyz.x * 100, 1)}, ${E.round(v.xyz.y * 100, 1)}, ${E.round(v.xyz.z * 100, 1)}`,
      LUM: `${E.round(v.lum * 100, 2)}%`,
    };
    const ids = { HEX: "v-hex", RGB: "v-rgb", HSL: "v-hsl", CMYK: "v-cmyk", LAB: "v-lab", OKLCH: "v-oklch", HSV: "v-hsv", HWB: "v-hwb", XYZ: "v-xyz", LUM: "v-lum" };
    Object.keys(rows).forEach((key) => {
      const el = document.getElementById(ids[key]);
      if (el) el.textContent = rows[key];
      const row = els.valueTable.querySelector(`[data-key="${key}"]`);
      if (row) {
        const btn = row.querySelector(".copy-mini");
        if (btn) btn.dataset.copy = rows[key];
      }
    });

    // composition bars
    const maxRGB = Math.max(v.rgb.r, v.rgb.g, v.rgb.b, 1);
    els.rgbBars.innerHTML = ["r", "g", "b"].map((k, i) => {
      const val = v.rgb[k];
      const channelColor = ["#c85043", "#64885a", "#416d9d"][i];
      return `<div class="channel-row"><span class="channel-label">${k.toUpperCase()}</span><div class="channel-track"><div class="channel-fill" style="width:${(val / 255) * 100}%;background:${channelColor}"></div></div><span class="channel-value">${Math.round((val / maxRGB) * 100)}%</span></div>`;
    }).join("");
    els.cmykBars.innerHTML = ["c", "m", "y", "k"].map((k, i) => {
      const val = v.cmyk[k];
      const colors = ["#24a6c4", "#cc3e7f", "#e4c535", "#2b2a27"];
      return `<div class="channel-row"><span class="channel-label">${k.toUpperCase()}</span><div class="channel-track"><div class="channel-fill" style="width:${val}%;background:${colors[i]}"></div></div><span class="channel-value">${Math.round(val)}%</span></div>`;
    }).join("");
  }

  function renderHistory() {
    if (!els.history) return;
    if (!state.history.length) {
      els.history.innerHTML = '<span class="history-empty">拖动色块，留下第一枚颜色</span>';
      return;
    }
    els.history.innerHTML = state.history.map((hex) =>
      `<button class="history-chip${hex === state.hex ? " current" : ""}" type="button" data-history="${hex}" style="background:${hex}" title="${hex}" aria-label="切换到 ${hex}"></button>`
    ).join("");
  }

  /* ---------- relationships ---------- */

  function renderRelationships() {
    const all = E.harmonies(state.hex);
    const current = all[state.harmony] || all.mono;
    const harmonyMeta = E.HARMONIES.find((h) => h.id === state.harmony) || E.HARMONIES[0];
    els.harmonyNote.textContent = harmonyMeta.note;
    els.harmonySwatches.innerHTML = current.map((c) =>
      `<button class="harmony-swatch" type="button" data-pick="${c.hex}" title="应用 ${c.hex}">
        <span class="harmony-color" style="background:${c.hex}" data-hex="${c.hex}"></span>
        <span class="harmony-info"><span class="harmony-name">${esc(c.name)}</span><span class="harmony-role">${esc(c.role)} · ${c.hex}</span></span>
      </button>`
    ).join("");

    // wheel markers: always anchor the current colour, then deduplicate nearby harmony hues
    const seen = new Set([Math.round(state.h) % 360]);
    const currentNamed = E.nearestTraditional(state.hex);
    const markers = [{ ...current, hex: state.hex, h: state.h, name: currentNamed.name, base: true }];
    current.forEach((c) => {
      const key = Math.round(c.h) % 360;
      if (seen.has(key)) return;
      seen.add(key);
      markers.push({ ...c, base: false });
    });
    els.wheelMarkers.innerHTML = markers.map((c) => {
      const rad = (c.h - 90) * Math.PI / 180;
      const radius = 41;
      const left = 50 + Math.cos(rad) * radius;
      const top = 50 + Math.sin(rad) * radius;
      return `<span class="wheel-marker${c.base ? " base" : ""}" style="left:${left}%;top:${top}%;background:${c.hex}" title="H ${Math.round(c.h)}° · ${c.name}"></span>`;
    }).join("");

    renderContrast();
  }

  function renderContrast() {
    const report = E.contrastReport(state.hex);
    const on = report.onColor;
    els.contrastPreview.style.background = state.hex;
    els.contrastPreview.style.color = on.color;
    const best = report.best;
    const rank = best.ratio >= 7 ? "AAA" : best.ratio >= 4.5 ? "AA" : best.ratio >= 3 ? "AA LARGE" : "LOW";
    els.contrastRank.textContent = rank;
    els.contrastCopy.textContent = `在这个底色上，${best.name}文字达到 ${E.round(best.ratio, 2)}:1${best.ratio >= 4.5 ? "，适合正文。" : best.ratio >= 3 ? "，适合大号文字。" : "，仅适合装饰性文字。"}`;
    els.contrastRows.innerHTML = report.rows.map((r) => {
      const pass = r.ratio >= 4.5 ? "AAA / AA" : r.ratio >= 3 ? "AA 大字" : "不足";
      return `<span class="contrast-chip${r.ratio >= 4.5 ? " pass" : ""}"><span style="width:7px;height:7px;border-radius:50%;background:${r.hex};box-shadow:0 0 0 1px rgba(0,0,0,.12)"></span>${esc(r.name)} <strong>${E.round(r.ratio, 2)}</strong> · ${pass}</span>`;
    }).join("");
  }

  function setHarmony(id) {
    if (!E.HARMONIES.some((h) => h.id === id)) return;
    state.harmony = id;
    $$(".harmony-tab", els.harmonyTabs).forEach((b) => {
      const active = b.dataset.harmony === id;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
    });
    renderRelationships();
  }

  /* ---------- recipes ---------- */

  function mediumLabel() { return MEDIA[state.medium].label; }

  function getPaintRecipes() {
    return E.findPigmentRecipes(state.hex, MEDIA[state.medium].palette, 4);
  }

  function scheduleRecipeUpdate() {
    if (state.recipeTimer) clearTimeout(state.recipeTimer);
    state.recipeTimer = setTimeout(() => {
      state.recipeTimer = null;
      renderRecipe();
    }, 140);
  }

  function flushRecipe() {
    if (state.recipeTimer) { clearTimeout(state.recipeTimer); state.recipeTimer = null; }
    renderRecipe();
  }

  function renderRecipe() {
    els.mediumNote.textContent = MEDIA[state.medium].note;
    syncMediumTabs();
    if (state.medium === "print") renderPrintRecipe();
    else if (state.medium === "textile") renderTextileRecipe();
    else renderPaintRecipe();
  }

  function syncMediumTabs() {
    $$(".medium-tab", els.mediumTabs).forEach((b) => {
      const active = b.dataset.medium === state.medium;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
    });
    const meta = MEDIA[state.medium];
    els.mediumNote.textContent = meta.note;
  }

  function recipeHeader(kicker, title, sub, showShuffle = true) {
    return `<div class="recipe-eyebrow">
      <div>
        <span class="section-kicker">${esc(kicker)}</span>
        <h3 class="recipe-title">${esc(title)}</h3>
        <p class="recipe-sub">${sub}</p>
      </div>
      ${showShuffle ? `<button class="outline-btn recipe-shuffle" type="button">${icon("shuffle")} 换一组</button>` : ""}
    </div>`;
  }

  function mixEquationHTML(components, palette) {
    const map = new Map(palette.map((p) => [p.id, p]));
    return `<div class="mix-equation">${components.map((c, i) => {
      const p = map.get(c.id) || { name: c.name, code: c.code || "", hex: c.hex };
      const pct = c.parts;
      return `${i > 0 ? '<span class="plus-sign">＋</span>' : ""}
        <div class="pigment-chip">
          <div class="pigment-dot" style="background:${p.hex}"></div>
          <div class="pigment-pct">${E.round(pct, pct < 10 ? 1 : 0)}<small>%</small></div>
          <div class="pigment-name">${esc(p.name)}</div>
          <div class="pigment-code">${esc(p.code || "")}${p.en ? " · " + esc(p.en) : ""}</div>
        </div>`;
    }).join("")}</div>`;
  }

  function compareHTML(recipe) {
    return `<div class="compare-strip">
      <div class="compare-cell">
        <span class="compare-swatch" style="background:${state.hex}"></span>
        <span><span class="compare-label">TARGET / 目标</span><span class="compare-value">${state.hex}</span><span class="compare-meta">屏幕 sRGB</span></span>
      </div>
      <div class="compare-cell">
        <span class="compare-swatch" style="background:${recipe.predicted.hex}"></span>
        <span><span class="compare-label">PREDICTED / 预测</span><span class="compare-value">${recipe.predicted.hex}</span><span class="compare-meta">ΔE00 ${E.round(recipe.de, 2)} · ${esc(recipe.quality)}</span></span>
        <span class="match-badge">${esc(deLabel(recipe.de))}</span>
      </div>
    </div>`;
  }

  function stepsHTML(steps) {
    return `<div class="steps-block"><div class="block-heading"><span>操作 / METHOD</span><span class="micro">先少后多，逐次记录</span></div>
      <ol class="steps-list">${steps.map((s, i) => `<li data-step="${String(i + 1).padStart(2, "0")}"><span>${s}</span></li>`).join("")}</ol>
    </div>`;
  }

  function renderPaintRecipe() {
    let recipes = getPaintRecipes();
    state.recipes = recipes;
    if (!recipes.length) {
      els.recipeMain.innerHTML = recipeHeader("MATERIAL RECIPE", "暂时没有可用配方", "请换一个颜色或介质。");
      els.matchCard.innerHTML = "";
      els.scienceCard.innerHTML = "";
      return;
    }
    state.recipeIndex = state.recipeIndex % recipes.length;
    const r = recipes[state.recipeIndex];
    const comps = r.components;
    const ratios = simplifyRatio(comps.map((c) => c.parts));
    const isWater = state.medium === "watercolor";
    const first = comps[0];
    const second = comps[1];
    const third = comps[2];
    const firstP = MEDIA[state.medium].palette.find((p) => p.id === first.id);
    const secondP = second ? MEDIA[state.medium].palette.find((p) => p.id === second.id) : null;
    const whiteIncluded = comps.some((c) => c.id === "pw6");
    const steps = [
      `在白色调色盘上取总量约 <strong>${E.round(first.parts, 1)}% 的${esc(firstP.name)}</strong> 作为基底，保持取量可复现。`,
      second ? `用牙签尖或小勺分 2–3 次加入 <strong>${E.round(second.parts, 1)}% 的${esc(secondP.name)}</strong>，每加一次都先搅匀、再试色。` : "先试一次基底色，判断是否需要继续加深或提亮。",
      third ? `加入 <strong>约 ${E.round(third.parts, 1)}%</strong> 第三色，宁少勿多；颜色一旦过头，很难完全退回。` : "若需要更接近，可先补极少量同类色相，不要同时改明度与饱和度。",
      whiteIncluded
        ? (isWater ? "配方含白。水彩中的白会带来粉感；可先尝试用水稀释替代一部分白，再决定是否补白。" : "先从浅色向深色调：若白色比例高，先取白再逐次加色，避免一次性把颜色压死。")
        : "把混合色涂在一块目标材料上，完全干燥后再比对；湿色通常更深、更艳。",
      "记录颜料品牌、比例、底材与日期，并在日光和室内灯下各看一次。",
    ];
    const title = `以 ${comps.length} 种${isWater ? "水彩颜料" : "颜料"}逼近目标`;
    const sub = `${esc(r.quality)}配方 · 以体积百分比计。ΔE00 = ${E.round(r.de, 2)}，数值越小越接近。屏幕色与颜料色无法完全相等，请以试涂为准。`;
    els.recipeMain.innerHTML = recipeHeader(`${MEDIA[state.medium].kicker} · RECIPE ${String(state.recipeIndex + 1).padStart(2, "0")}`, title, sub) +
      mixEquationHTML(comps, MEDIA[state.medium].palette) +
      `<div class="recipe-ratios"><span>体积比</span><strong>${ratios}</strong><span class="sep">/</span><span>${comps.map((c) => E.round(c.parts, 1) + "%").join(" : ")}</span><span class="sep">/</span><span>先少后多，逐次加入</span></div>` +
      compareHTML(r) +
      stepsHTML(steps) +
      `<div class="recipe-footnote">${icon("info")}<span>配方由三通道 Kubelka–Munk 近似生成。颜料品牌、粒径与底色差异会带来可见偏色；正式使用前请打小样。</span></div>`;

    els.matchCard.innerHTML = matchCardHTML(r);
    els.scienceCard.innerHTML = scienceCardHTML(state.medium, comps, r);
  }

  function renderPrintRecipe() {
    const v = E.allValues(state.hex);
    const spot = E.findPigmentRecipes(state.hex, E.PRINT_INKS, 4);
    state.spotRecipes = spot;
    if (!spot.length) return;
    state.recipeIndex = state.recipeIndex % spot.length;
    const r = spot[state.recipeIndex];
    const c = v.cmyk;
    const tac = c.c + c.m + c.y + c.k;
    const tacNote = tac > 320
      ? `总墨量约 ${Math.round(tac)}%，偏高。实际印刷建议做 UCR/GCR 分色，并控制在纸张允许的 TAC 以内。`
      : `总墨量约 ${Math.round(tac)}%，处于常见涂层纸建议区间内；未涂布纸需要更低墨量。`;
    const inkCols = [
      ["C", "青", c.c, "#0094D8"],
      ["M", "品红", c.m, "#E5007E"],
      ["Y", "黄", c.y, "#FFE600"],
      ["K", "黑", c.k, "#1E1E1E"],
    ];
    const spotComps = r.components;
    const ratios = simplifyRatio(spotComps.map((x) => x.parts));
    const steps = [
      "先用上面的 CMYK 数值做数码或软打样，确认色相与明度方向。",
      "若四色无法到达目标饱和度，再以专色油墨作为起点：按比例称取，先少量、后补色。",
      "在目标纸张上印/刮一张色样，干燥后测量或目视比对；油墨湿时通常更深、更亮。",
      "记录油墨品牌、纸张、墨层厚度与干燥条件，再决定是否放大生产。",
    ];
    const sub = `四色分色是简易换算，适合作为印刷沟通的起点。专色配方 ΔE00 = ${E.round(r.de, 2)}，需以实际纸张和油墨打样为准。`;
    els.recipeMain.innerHTML = recipeHeader("PRINT INK · CMYK + SPOT", "四色分色，再加一点专色", sub) +
      `<div class="ink-cmyk-grid">${inkCols.map(([code, name, value, color]) =>
        `<div class="ink-column"><div class="ink-dot" style="background:${color}"></div><div class="ink-name">${code} · ${name}</div><div class="ink-value">${Math.round(value)}<small>%</small></div></div>`
      ).join("")}</div>
      <div class="tac-note">总墨量 TAC ≈ ${Math.round(tac)}% · ${tacNote}</div>
      <div class="block-heading print-section-title"><span>专色调墨 / SPOT MIX</span><span class="micro">扩展色起点</span></div>
      ${mixEquationHTML(spotComps, E.PRINT_INKS)}
      <div class="recipe-ratios"><span>专色体积比</span><strong>${ratios}</strong><span class="sep">/</span><span>ΔE00 ${E.round(r.de, 2)}</span></div>
      ${compareHTML(r)}
      ${stepsHTML(steps)}
      <div class="recipe-footnote">${icon("info")}<span>CMYK 数值未做 ICC 特性文件转换，不能直接作为印厂最终分色数据。专色配方用于沟通与打样，不替代印厂配色。</span></div>`;
    els.matchCard.innerHTML = matchCardHTML(r, "专色预测");
    els.scienceCard.innerHTML = scienceCardHTML("print", spotComps, r);
  }

  function renderTextileRecipe() {
    const d = E.dyeRecipe(state.hex, state.fiber);
    state.dye = d;
    const fiber = d.fiber;
    const fiberBtns = Object.values(E.FIBERS).map((f) =>
      `<button class="fiber-btn${state.fiber === f.id ? " is-active" : ""}" type="button" data-fiber="${f.id}">${esc(f.name)}</button>`
    ).join("");
    const total = E.round(d.components.reduce((s, c) => s + c.amount, 0), 2);
    const steps = d.process.map((s) => s);
    const dyeRows = d.components.map((c) =>
      `<div class="dye-row">
        <span class="dye-dot" style="background:${c.hex}"></span>
        <span><span class="dye-name">${esc(c.name)}</span><span class="dye-code">${esc(fiber.dyeClass)} · 三原色拼色</span></span>
        <span class="dye-amount"><strong>${c.amount.toFixed(2)}</strong>% <span class="micro">o.w.f.</span></span>
      </div>`
    ).join("");
    const sub = `按纤维重量计算染料用量（o.w.f.）。这是一份方向性起点，不是分光测色结果；上染率因纤维、浴比、水质与染料批次而变。`;
    els.recipeMain.innerHTML = recipeHeader(`TEXTILE DYE · ${fiber.en}`, `${fiber.dyeClass}近似配方`, sub, false) +
      `<div class="fiber-nav">${fiberBtns}</div>
      <div class="process-grid">
        <div class="process-cell"><span>TEMPERATURE</span><strong>${esc(fiber.temp)}</strong></div>
        <div class="process-cell"><span>TIME</span><strong>${esc(fiber.time)}</strong></div>
        <div class="process-cell"><span>BATH RATIO</span><strong>${esc(fiber.bath)}</strong></div>
        <div class="process-cell"><span>pH</span><strong>${esc(fiber.ph)}</strong></div>
      </div>
      <div class="dye-list">${dyeRows}</div>
      <div class="dye-basis">合计染料约 <strong>${total}% o.w.f.</strong> · 以 100 g 织物为例，按比例取用染料；浴比 ${esc(fiber.bath)}。</div>
      <div class="block-heading print-section-title"><span>助剂 / AUXILIARIES</span><span class="micro">按染厂工艺调整</span></div>
      <div class="chemical-list">${d.chemicals.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
      ${stepsHTML(steps)}
      <div class="recipe-footnote">${icon("warning")}<span>纺织染料与酸碱助剂需在通风环境操作，佩戴手套与护目镜；染液不得随意排放。高温高压工艺需要专业设备，家用条件请勿尝试。</span></div>`;

    const targetText = E.nearestTraditional(state.hex);
    els.matchCard.innerHTML = `
      <div class="match-head">
        <div><span class="section-kicker">FORMULA / 配方</span><div class="match-score">${total}<small>% owf</small></div><div class="match-quality"><i style="background:${targetText.hex}"></i>${esc(fiber.dyeClass)} · ${esc(fiber.name)}</div></div>
        <div class="dual-swatch" style="margin:0;width:72px;flex:0 0 auto"><div><div class="color" style="height:38px;background:${state.hex}"></div><div class="label" style="padding:4px 5px">目标</div></div></div>
      </div>
      <div class="aside-divider"></div>
      <p class="aside-note">屏幕上的这个颜色无法直接换算成绝对染料用量。此处根据明度与色相分解给出<strong>三原色拼色方向</strong>，请从所示用量的 60% 开始做小样，再逐步补足。</p>
      <div class="aside-divider"></div>
      <p class="aside-note"><strong>打样建议：</strong>称取 5–10 g 织物，按同一浴比与助剂比例做 2–3 个梯度，避免一次性放大。</p>`;
    els.scienceCard.innerHTML = `
      <div class="block-heading"><span>变量 / VARIABLES</span><span class="micro">LAB DIP FIRST</span></div>
      <h3 class="science-title">纤维会改写颜色。</h3>
      <ul class="variable-list">${MEDIA.textile.variables.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>
      <div class="safety-note">${icon("warning")}<span>${esc(fiber.note)} 打样后请测试耐洗、耐摩擦与耐光色牢度，再决定是否放量。</span></div>`;
  }

  function matchCardHTML(r, kicker = "PREDICTED MATCH") {
    const score = Math.round(clamp(100 - r.de * 8, 15, 99));
    const hints = tweakHints(r);
    return `<div class="match-head">
      <div><span class="section-kicker">${esc(kicker)}</span><div class="match-score">ΔE <span>${E.round(r.de, 2)}</span></div><div class="match-quality"><i style="background:${deColor(r.de)}"></i>${esc(deLabel(r.de))}</div></div>
      <div class="match-ring" style="--score:${score}"><span>${score}%</span></div>
    </div>
    <div class="dual-swatch">
      <div><div class="color" style="background:${state.hex}"></div><div class="label"><span>目标</span><span>${state.hex}</span></div></div>
      <div><div class="color" style="background:${r.predicted.hex}"></div><div class="label"><span>预测</span><span>${r.predicted.hex}</span></div></div>
    </div>
    <div class="tweak-list">${hints.map((h) => `<span class="tweak"><strong>${esc(h.label)}</strong> ${esc(h.text)}</span>`).join("")}</div>
    <div class="aside-divider"></div>
    <p class="aside-note">预测颜色来自颜料浓度的减色近似，<strong>不等同于分光测色</strong>。请把配方当作起点，在目标底材上打样后再微调。</p>`;
  }

  function tweakHints(r) {
    const t = E.allValues(state.hex).lab;
    const p = r.lab;
    const hints = [];
    const dL = t.l - p.l;
    const da = t.a - p.a;
    const db = t.b - p.b;
    if (dL > 2.8) hints.push({ label: "偏暗", text: "少量加白或提高涂层厚度" });
    else if (dL < -2.8) hints.push({ label: "偏亮", text: "加一丝深色，避免直接加黑" });
    if (da > 2) hints.push({ label: "偏绿", text: "补极少量红 / 洋红" });
    else if (da < -2) hints.push({ label: "偏红", text: "补极少量绿 / 青" });
    if (db > 2) hints.push({ label: "偏蓝", text: "补极少量黄" });
    else if (db < -2) hints.push({ label: "偏黄", text: "补极少量蓝 / 紫" });
    if (!hints.length) hints.push({ label: "接近", text: "色相与明度已在模型误差内，直接打样" });
    return hints.slice(0, 3);
  }

  function scienceCardHTML(medium, comps, r) {
    const meta = MEDIA[medium];
    const cadmium = comps.some((c) => ["po20"].includes(c.id));
    const hasSolvent = medium === "acrylic";
    return `<div class="block-heading"><span>变量 / VARIABLES</span><span class="micro">MATERIAL FIRST</span></div>
      <h3 class="science-title">让配方落地的变量</h3>
      <ul class="variable-list">${meta.variables.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>
      <div class="safety-note">${icon("warning")}<span>${cadmium ? "配方涉及含镉颜料，避免干磨、喷涂或入口；使用后洗手。" : hasSolvent ? "使用溶剂型媒介时保持通风，远离火源；颜料不可入口。" : "某些矿物与金属颜料需避免吸入粉尘；儿童使用请在成人陪同下进行。"}</span></div>`;
  }

  /* ---------- image sampler ---------- */

  function openImageModal() {
    if (typeof els.imageModal.showModal === "function") els.imageModal.showModal();
    else els.imageModal.setAttribute("open", "");
  }
  function closeImageModal() {
    if (typeof els.imageModal.close === "function") els.imageModal.close();
    else els.imageModal.removeAttribute("open");
  }

  function loadImageFile(file) {
    if (!file || !file.type.startsWith("image/")) { toast("请选择图片文件"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = els.imageCanvas;
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        els.dropzone.hidden = true;
        els.imageWorkspace.hidden = false;
        state.image.canvas = canvas;
        state.sampleHex = null;
        els.applyImageColor.disabled = true;
        els.sampleHex.textContent = "—";
        els.sampleRgb.textContent = "点击图片任意位置";
        els.sampleSwatch.style.background = "var(--card-soft)";
        els.samplePin.classList.remove("show");
        buildImagePalette(canvas);
      };
      img.onerror = () => toast("这张图片无法读取，请换一张");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function buildImagePalette(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let data;
    try { data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; }
    catch (e) { els.imagePalette.innerHTML = ""; return; }
    const step = Math.max(1, Math.floor(Math.sqrt(canvas.width * canvas.height / 4000)));
    const pixels = [];
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const i = (y * canvas.width + x) * 4;
        if (data[i + 3] < 100) continue;
        pixels.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
    if (!pixels.length) { els.imagePalette.innerHTML = ""; return; }
    const k = Math.min(6, pixels.length);
    const centers = [];
    // farthest-point seeding for stable, varied palettes
    centers.push(pixels[Math.floor(pixels.length / 2)]);
    while (centers.length < k) {
      let far = pixels[0], farD = -1;
      for (const p of pixels) {
        let minD = Infinity;
        for (const c of centers) minD = Math.min(minD, (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2);
        if (minD > farD) { farD = minD; far = p; }
      }
      centers.push(far);
    }
    let groups = [];
    for (let iter = 0; iter < 7; iter++) {
      groups = centers.map(() => []);
      for (const p of pixels) {
        let best = 0, bestD = Infinity;
        centers.forEach((c, i) => {
          const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
          if (d < bestD) { bestD = d; best = i; }
        });
        groups[best].push(p);
      }
      groups.forEach((g, i) => {
        if (!g.length) return;
        centers[i] = [0, 0, 0].map((_, ch) => Math.round(g.reduce((s, p) => s + p[ch], 0) / g.length));
      });
    }
    state.image.palette = groups.map((g, i) => ({
      hex: E.rgbToHex(centers[i][0], centers[i][1], centers[i][2]),
      count: g.length,
    })).filter((c) => c.count).sort((a, b) => b.count - a.count);
    els.imagePalette.innerHTML = state.image.palette.map((c) =>
      `<button class="image-swatch" type="button" data-image-color="${c.hex}" style="background:${c.hex}" title="${c.hex}" aria-label="选取 ${c.hex}"></button>`
    ).join("");
  }

  function pickImageColor(e) {
    const canvas = state.image.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1) * (canvas.width - 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1) * (canvas.height - 1);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const sx = Math.max(0, Math.round(x) - 2), sy = Math.max(0, Math.round(y) - 2);
    const sw = Math.min(5, canvas.width - sx), sh = Math.min(5, canvas.height - sy);
    let data;
    try { data = ctx.getImageData(sx, sy, sw, sh).data; } catch (err) { return; }
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 20) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (!n) return;
    const hex = E.rgbToHex(r / n, g / n, b / n);
    state.sampleHex = hex;
    els.sampleHex.textContent = hex;
    els.sampleRgb.textContent = `RGB ${Math.round(r / n)} · ${Math.round(g / n)} · ${Math.round(b / n)}`;
    els.sampleSwatch.style.background = hex;
    els.applyImageColor.disabled = false;
    const pin = els.samplePin;
    pin.style.left = (canvas.offsetLeft + (x / canvas.width) * rect.width) + "px";
    pin.style.top = (canvas.offsetTop + (y / canvas.height) * rect.height) + "px";
    pin.classList.add("show");
  }

  /* ---------- export ---------- */

  function colorData() {
    const v = E.allValues(state.hex);
    const named = E.nearestTraditional(state.hex);
    const all = E.harmonies(state.hex);
    let recipes;
    if (state.medium === "textile") {
      recipes = { medium: "textile", fiber: state.dye ? state.dye.fiber.name : null, dyeClass: state.dye ? state.dye.fiber.dyeClass : null, components: state.dye ? state.dye.components.map((c) => ({ name: c.name, amountOwf: c.amount })) : [] };
    } else if (state.medium === "print") {
      const spot = state.spotRecipes && state.spotRecipes.length ? state.spotRecipes[state.recipeIndex % state.spotRecipes.length] : null;
      recipes = { medium: "print", components: spot ? spot.components : [], predicted: spot ? spot.predicted.hex : null, deltaE00: spot ? E.round(spot.de, 2) : null };
    } else {
      const r = state.recipes && state.recipes.length ? state.recipes[state.recipeIndex % state.recipes.length] : null;
      recipes = { medium: state.medium, components: r ? r.components : [], predicted: r ? r.predicted.hex : null, deltaE00: r ? E.round(r.de, 2) : null };
    }
    return {
      generator: "色研所 · CHROMA LAB",
      generatedAt: new Date().toISOString(),
      color: {
        hex: v.hex,
        rgb: v.rgb,
        hsl: { h: E.round(v.hsl.h, 2), s: E.round(v.hsl.s, 2), l: E.round(v.hsl.l, 2) },
        hsv: { h: E.round(v.hsv.h, 2), s: E.round(v.hsv.s, 2), v: E.round(v.hsv.v, 2) },
        hwb: { h: E.round(v.hwb.h, 2), w: E.round(v.hwb.w, 2), b: E.round(v.hwb.b, 2) },
        cmyk: { c: E.round(v.cmyk.c, 2), m: E.round(v.cmyk.m, 2), y: E.round(v.cmyk.y, 2), k: E.round(v.cmyk.k, 2) },
        lab: { l: E.round(v.lab.l, 2), a: E.round(v.lab.a, 2), b: E.round(v.lab.b, 2) },
        lch: { l: E.round(v.lch.l, 2), c: E.round(v.lch.c, 2), h: E.round(v.lch.h, 2) },
        oklch: { l: E.round(v.oklch.l, 2), c: E.round(v.oklch.c, 4), h: E.round(v.oklch.h, 2) },
        xyz: { x: E.round(v.xyz.x * 100, 3), y: E.round(v.xyz.y * 100, 3), z: E.round(v.xyz.z * 100, 3) },
        relativeLuminance: E.round(v.lum, 4),
        nearestChineseName: { name: named.name, en: named.en, distance: named.distance },
      },
      relationships: { type: state.harmony, colors: all[state.harmony] || all.mono },
      accessibility: E.contrastReport(state.hex),
      reproduction: recipes,
      note: "CMYK is a naive conversion; pigment/dye recipes are starting points from an approximate model. Test on real materials.",
    };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON() {
    const data = colorData();
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `chroma-${state.hex.slice(1)}.json`);
    toast("JSON 档案已下载");
  }

  function exportCard() {
    const W = 1400, H = 1800;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const v = E.allValues(state.hex);
    const named = E.nearestTraditional(state.hex);
    const desc = E.describe(state.hex);
    const allHarmonies = E.harmonies(state.hex);
    const harmonies = allHarmonies[state.harmony] || allHarmonies.mono;
    const relation = E.HARMONIES.find((h) => h.id === state.harmony) || E.HARMONIES[0];
    const on = E.textOn(v.rgb);
    const paperTone = activePaper();
    const paper = paperTone.paper, card = paperTone.card, ink = "#12110D", muted = "#766B57";
    const yellow = "#DDFF3E", blue = "#2438FF", red = "#FF4B2B", pink = "#FF83AE";
    const heavy = '"Arial Black", "Helvetica Neue", "PingFang SC", sans-serif';
    const sans = '"Helvetica Neue", "PingFang SC", sans-serif';
    const mono = '"SFMono-Regular", Menlo, monospace';

    // grid paper
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(18,17,13,.065)"; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 56) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // edition strip
    ctx.fillStyle = ink; ctx.fillRect(0, 0, W, 40);
    ctx.fillStyle = yellow;
    ctx.font = `700 12px ${mono}`;
    ctx.fillText("CHROMA LAB®", 72, 25);
    [blue, red, yellow, pink, paper].forEach((c, i) => {
      ctx.fillStyle = c; ctx.fillRect(194 + i * 18, 14, 11, 11);
      ctx.strokeStyle = "rgba(242,232,212,.5)"; ctx.lineWidth = 1; ctx.strokeRect(194.5 + i * 18, 14.5, 10, 10);
    });
    ctx.fillStyle = "rgba(242,232,212,.68)";
    ctx.font = `700 10px ${mono}`;
    ctx.fillText("A FIELD GUIDE TO COLOUR / 色彩材料档案", 340, 25);
    ctx.textAlign = "right";
    ctx.fillText("ISSUE 01 — " + new Date().getFullYear(), W - 72, 25);
    ctx.textAlign = "left";

    // ticker rail
    ctx.fillStyle = yellow; ctx.fillRect(0, 40, W, 36);
    ctx.fillStyle = ink; ctx.fillRect(0, 40, W, 2); ctx.fillRect(0, 74, W, 2);
    ctx.fillStyle = ink;
    ctx.font = `700 11px ${mono}`;
    ctx.fillText("LIGHT IS ADDITIVE  ✦  光 · 加色  ✦  PIGMENT IS SUBTRACTIVE  ✦  颜料 · 减色  ✦  TEST YOUR INK  ✦  先打样，再放量  ✦  LIGHT IS ADDITIVE  ✦  光 · 加色  ✦  PIGMENT IS SUBTRACTIVE", 72, 63);

    // registration marks
    drawRegMark(ctx, 46, 98, ink);
    drawRegMark(ctx, W - 46, 98, ink);

    // specimen plate with hard shadow
    const sx = 72, sy = 112, sw = 1256, sh = 560;
    ctx.fillStyle = blue;
    ctx.fillRect(sx + 14, sy + 14, sw, sh);
    ctx.fillStyle = state.hex;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = ink; ctx.lineWidth = 4;
    ctx.strokeRect(sx + 2, sy + 2, sw - 4, sh - 4);

    // labels on plate
    ctx.fillStyle = ink; ctx.fillRect(sx + 24, sy + 24, 214, 35);
    ctx.fillStyle = paper;
    ctx.font = `700 11px ${mono}`;
    ctx.fillText("01 / THE SPECIMEN", sx + 38, sy + 47);
    ctx.fillStyle = paper;
    ctx.fillRect(sx + sw - 102, sy + 24, 78, 35);
    ctx.fillStyle = ink;
    ctx.font = `700 10px ${mono}`;
    ctx.fillText("sRGB", sx + sw - 84, sy + 46);

    // caption bar
    const capH = 128, capY = sy + sh - capH;
    ctx.fillStyle = ink; ctx.fillRect(sx, capY, sw, capH);
    ctx.fillStyle = paper;
    ctx.font = `700 72px ${mono}`;
    ctx.fillText(v.hex, sx + 28, capY + 74);
    ctx.font = `700 12px ${mono}`;
    ctx.fillStyle = "rgba(242,232,212,.62)";
    ctx.fillText(`RGB ${v.rgb.r} · ${v.rgb.g} · ${v.rgb.b}`, sx + 31, capY + 103);
    ctx.textAlign = "right";
    ctx.fillStyle = paper;
    ctx.font = `900 43px ${heavy}`;
    ctx.fillText(named.name, sx + sw - 28, capY + 73);
    ctx.fillStyle = "rgba(242,232,212,.58)";
    ctx.font = `700 11px ${mono}`;
    ctx.fillText(named.en.toUpperCase(), sx + sw - 28, capY + 101);
    ctx.textAlign = "left";

    // identity
    ctx.fillStyle = red; ctx.fillRect(72, 724, 64, 8);
    ctx.fillStyle = ink;
    ctx.font = `900 27px ${sans}`;
    ctx.fillText(desc.description, 72, 780);
    let tagX = 72;
    desc.tags.forEach((tag, i) => {
      ctx.font = `700 13px ${mono}`;
      const tw = ctx.measureText(tag).width + 26;
      ctx.fillStyle = i === 0 ? yellow : card;
      ctx.fillRect(tagX, 806, tw, 30);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(tagX, 806, tw, 30);
      ctx.fillStyle = ink;
      ctx.fillText(tag, tagX + 13, 826);
      tagX += tw + 9;
    });

    // data table
    const items = [
      ["HEX", v.hex],
      ["RGB", `${v.rgb.r}, ${v.rgb.g}, ${v.rgb.b}`],
      ["HSL", `${Math.round(v.hsl.h)}°, ${Math.round(v.hsl.s)}%, ${Math.round(v.hsl.l)}%`],
      ["CMYK", `${Math.round(v.cmyk.c)}, ${Math.round(v.cmyk.m)}, ${Math.round(v.cmyk.y)}, ${Math.round(v.cmyk.k)}`],
      ["CIELAB", `${E.round(v.lab.l, 1)}, ${E.round(v.lab.a, 1)}, ${E.round(v.lab.b, 1)}`],
      ["OKLCH", `${Math.round(v.oklch.l)}%, ${E.round(v.oklch.c, 3)}, ${Math.round(v.oklch.h)}°`],
    ];
    const gx = 72, gy = 876, gw = 1256, cellH = 106, cellW = gw / 3;
    ctx.fillStyle = card; ctx.fillRect(gx, gy, gw, cellH * 2);
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(gx, gy, gw, cellH * 2);
    items.forEach(([label, value], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = gx + col * cellW, y = gy + row * cellH;
      if (col) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellH); ctx.stroke(); }
      if (row) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke(); }
      ctx.fillStyle = muted;
      ctx.font = `700 10px ${mono}`;
      ctx.fillText(label, x + 17, y + 33);
      ctx.fillStyle = ink;
      ctx.font = `700 21px ${mono}`;
      ctx.fillText(value, x + 17, y + 70);
    });

    // relationship header
    ctx.fillStyle = ink; ctx.fillRect(72, 1136, 1256, 40);
    ctx.fillStyle = yellow;
    ctx.font = `700 11px ${mono}`;
    ctx.fillText("RELATIONSHIP / 色彩关系", 88, 1162);
    ctx.fillStyle = "rgba(242,232,212,.65)";
    ctx.textAlign = "right";
    ctx.fillText(`${relation.name} / ${relation.en}`, W - 88, 1162);
    ctx.textAlign = "left";

    // relationship swatches
    const gap = 16, chipW = (1256 - gap * 4) / 5, chipY = 1196, chipH = 158;
    harmonies.forEach((c, i) => {
      const x = 72 + i * (chipW + gap);
      ctx.fillStyle = ink; ctx.fillRect(x + 5, chipY + 5, chipW, chipH);
      ctx.fillStyle = c.hex; ctx.fillRect(x, chipY, chipW, chipH);
      ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(x, chipY, chipW, chipH);
      ctx.fillStyle = muted;
      ctx.font = `700 10px ${mono}`;
      ctx.fillText(c.hex, x, chipY + chipH + 27);
      ctx.fillStyle = ink;
      ctx.font = `900 17px ${heavy}`;
      ctx.fillText(c.name, x, chipY + chipH + 54);
      ctx.fillStyle = muted;
      ctx.font = `700 9px ${mono}`;
      ctx.fillText(c.role, x, chipY + chipH + 75);
    });

    // footer
    ctx.fillStyle = yellow; ctx.fillRect(0, 1512, W, 5);
    ctx.fillStyle = ink; ctx.fillRect(0, 1517, W, H - 1517);
    ctx.fillStyle = paper;
    ctx.font = `900 30px ${sans}`;
    ctx.fillText("颜色不是答案，是材料与光之间的一次协商。", 72, 1595);
    ctx.fillStyle = yellow;
    ctx.font = `700 11px ${mono}`;
    ctx.fillText("CHROMA LAB® / 色研所", 72, 1662);
    ctx.fillStyle = "rgba(242,232,212,.58)";
    ctx.font = `500 10px ${mono}`;
    ctx.fillText("SPECIMEN CARD · " + new Date().toLocaleDateString("zh-CN"), 72, 1691);
    ctx.textAlign = "right";
    ctx.fillText("配方为起点 · 请以实物打样为准", W - 72, 1691);
    ctx.fillStyle = yellow;
    ctx.font = `700 10px ${mono}`;
    ctx.fillText("LIGHT → MATTER", W - 72, 1662);
    ctx.textAlign = "left";

    // small footer registration swatches
    [state.hex, blue, yellow, red, pink].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(72 + i * 22, 1730, 17, 17);
      ctx.strokeStyle = "rgba(242,232,212,.4)"; ctx.lineWidth = 1;
      ctx.strokeRect(72.5 + i * 22, 1730.5, 16, 16);
    });

    canvas.toBlob((blob) => {
      if (!blob) { toast("导出失败，请重试"); return; }
      downloadBlob(blob, `chroma-${state.hex.slice(1)}.png`);
      toast("色卡 PNG 已生成");
    }, "image/png");
  }

  function drawRegMark(ctx, x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fullArchiveText() {
    const v = E.allValues(state.hex);
    const named = E.nearestTraditional(state.hex);
    const data = colorData();
    const rep = data.reproduction;
    const lines = [
      "色研所 · CHROMA LAB",
      `${named.name} / ${named.en}`,
      E.describe(state.hex).description,
      "",
      `HEX      ${v.hex}`,
      `RGB      ${v.rgb.r}, ${v.rgb.g}, ${v.rgb.b}`,
      `HSL      ${Math.round(v.hsl.h)}°, ${Math.round(v.hsl.s)}%, ${Math.round(v.hsl.l)}%`,
      `HSV      ${Math.round(v.hsv.h)}°, ${Math.round(v.hsv.s)}%, ${Math.round(v.hsv.v)}%`,
      `HWB      ${Math.round(v.hwb.h)}°, ${Math.round(v.hwb.w)}%, ${Math.round(v.hwb.b)}%`,
      `CMYK*    ${Math.round(v.cmyk.c)}, ${Math.round(v.cmyk.m)}, ${Math.round(v.cmyk.y)}, ${Math.round(v.cmyk.k)}`,
      `CIELAB   ${E.round(v.lab.l, 2)}, ${E.round(v.lab.a, 2)}, ${E.round(v.lab.b, 2)}`,
      `LCH      ${E.round(v.lch.l, 2)}, ${E.round(v.lch.c, 2)}, ${E.round(v.lch.h, 2)}°`,
      `OKLCH    ${E.round(v.oklch.l, 2)}%, ${E.round(v.oklch.c, 4)}, ${E.round(v.oklch.h, 2)}°`,
      `相对亮度 ${E.round(v.lum * 100, 2)}%`,
      `对比度   白 ${E.round(E.contrast(v.rgb, { r: 255, g: 255, b: 255 }), 2)} : 1 · 黑 ${E.round(E.contrast(v.rgb, { r: 26, g: 24, b: 20 }), 2)} : 1`,
      "",
      `CSS      --color: ${v.hex};`,
    ];
    if (rep && rep.components && rep.components.length) {
      lines.push("", `近似配方 (${MEDIA[state.medium].label})：`);
      if (state.medium === "textile") {
        rep.components.forEach((c) => lines.push(`  ${c.name} ${c.amountOwf.toFixed(2)}% o.w.f.`));
      } else {
        const palette = state.medium === "print" ? E.PRINT_INKS : MEDIA[state.medium].palette;
        lines.push("  " + rep.components.map((c) => {
          const p = palette.find((x) => x.id === c.id);
          return `${p ? p.name : c.id} ${Math.round(c.parts)}%`;
        }).join(" + "));
        if (rep.predicted) lines.push(`  预测 ${rep.predicted} · ΔE00 ${rep.deltaE00}`);
      }
    }
    return lines.join("\n");
  }

  /* ---------- events ---------- */

  function bindEvents() {
    const paperPicker = $(".paper-picker");
    if (paperPicker) {
      paperPicker.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-paper]");
        if (chip) applyPaper(chip.dataset.paper);
      });
    }

    // stage picker
    els.stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      state.dragging = true;
      els.stage.classList.add("is-dragging");
      els.stage.setPointerCapture?.(e.pointerId);
      els.stage.focus({ preventScroll: true });
      pointStage(e);
    });
    els.stage.addEventListener("pointermove", (e) => {
      if (!state.dragging) return;
      pointStage(e);
    });
    const endDrag = (e) => {
      if (!state.dragging) return;
      state.dragging = false;
      els.stage.classList.remove("is-dragging");
      pushHistory(state.hex);
      flushRecipe();
      try { els.stage.releasePointerCapture?.(e.pointerId); } catch (err) {}
    };
    els.stage.addEventListener("pointerup", endDrag);
    els.stage.addEventListener("pointercancel", endDrag);
    els.stage.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 5 : 1;
      let changed = false;
      if (e.key === "ArrowLeft") { state.s = clamp(state.s - step, 0, 100); changed = true; }
      if (e.key === "ArrowRight") { state.s = clamp(state.s + step, 0, 100); changed = true; }
      if (e.key === "ArrowUp") { state.v = clamp(state.v + step, 0, 100); changed = true; }
      if (e.key === "ArrowDown") { state.v = clamp(state.v - step, 0, 100); changed = true; }
      if (changed) {
        e.preventDefault();
        setHsv(state.h, state.s, state.v, { updateUrl: true });
        pushHistory(state.hex);
      }
    });
    function pointStage(e) {
      const rect = els.stage.getBoundingClientRect();
      const s = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 100;
      const v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1) * 100;
      setHsv(state.h, s, v, { updateUrl: true, skipRecipe: true });
    }

    els.hue.addEventListener("input", () => {
      setHsv(Number(els.hue.value), state.s, state.v, { updateUrl: true, skipRecipe: true });
    });
    els.hue.addEventListener("change", () => { pushHistory(state.hex); flushRecipe(); });

    els.nativeColor.addEventListener("input", () => setColor(els.nativeColor.value, { record: false }));
    els.nativeColor.addEventListener("change", () => { setColor(els.nativeColor.value, { record: false }); pushHistory(state.hex); });

    let hexTimer = null;
    els.hexInput.addEventListener("input", () => {
      const raw = els.hexInput.value.trim().replace(/^#/, "");
      if (raw.length === 3 || raw.length === 6) {
        const p = E.parseHex(raw);
        if (p) {
          clearTimeout(hexTimer);
          hexTimer = setTimeout(() => setColor(p.hex, { record: false }), 120);
        }
      }
    });
    els.hexInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyHexInput(true);
      }
      if (e.key === "Escape") {
        els.hexInput.value = state.hex.slice(1);
        els.hexInput.blur();
      }
    });
    els.hexInput.addEventListener("blur", () => applyHexInput(false));
    function applyHexInput(record) {
      const p = E.parseHex(els.hexInput.value.trim());
      if (!p) {
        els.hexInput.value = state.hex.slice(1);
        toast("HEX 需要 3 或 6 位十六进制字符");
        return;
      }
      setColor(p.hex, { record: false });
      if (record) pushHistory(state.hex);
    }

    $("#random").addEventListener("click", randomize);
    $("#stage-random").addEventListener("click", randomize);
    function randomize() {
      const hex = E.randomColor();
      setColor(hex, { record: true });
      toast("换了一枚颜色");
    }

    $("#copy-hex").addEventListener("click", () => copyText(state.hex, "HEX 已复制"));
    $("#copy-all").addEventListener("click", () => copyText(fullArchiveText(), "完整档案已复制"));
    $("#toggle-all").addEventListener("click", () => {
      state.expanded = !state.expanded;
      els.profileCard.classList.toggle("expanded", state.expanded);
      const btn = $("#toggle-all");
      btn.setAttribute("aria-expanded", String(state.expanded));
      btn.innerHTML = state.expanded ? '收起额外数值 <span>−</span>' : '展开全部数值 <span>＋</span>';
    });
    $("#share").addEventListener("click", share);
    $("#foot-share").addEventListener("click", share);
    async function share() {
      const url = location.href;
      if (navigator.share) {
        try { await navigator.share({ title: `色研所 · ${state.hex}`, url }); return; } catch (e) { if (e.name === "AbortError") return; }
      }
      copyText(url, "分享链接已复制");
    }

    els.history.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-history]");
      if (chip) setColor(chip.dataset.history, { record: false });
    });
    $("#clear-history").addEventListener("click", () => {
      state.history = [];
      try { localStorage.removeItem(STORAGE_HISTORY); } catch (e) {}
      renderHistory();
      toast("历史已清空");
    });

    els.harmonyTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-harmony]");
      if (btn) setHarmony(btn.dataset.harmony);
    });
    els.harmonyTabs.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const tabs = $$(".harmony-tab", els.harmonyTabs);
      const idx = tabs.indexOf(document.activeElement);
      if (idx < 0) return;
      e.preventDefault();
      const next = tabs[(idx + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      next.focus(); next.click();
    });
    els.harmonySwatches.addEventListener("click", (e) => {
      const sw = e.target.closest("[data-pick]");
      if (sw) setColor(sw.dataset.pick, { record: true });
    });

    els.mediumTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-medium]");
      if (!btn) return;
      state.medium = btn.dataset.medium;
      state.recipeIndex = 0;
      state.recipes = [];
      try { localStorage.setItem(STORAGE_MEDIUM, state.medium); } catch (e) {}
      renderRecipe();
      syncMediumTabs();
    });
    els.mediumTabs.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const tabs = $$(".medium-tab", els.mediumTabs);
      const idx = tabs.indexOf(document.activeElement);
      if (idx < 0) return;
      e.preventDefault();
      const next = tabs[(idx + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      next.focus(); next.click();
    });

    els.recipeMain.addEventListener("click", (e) => {
      if (e.target.closest(".recipe-shuffle")) {
        const count = state.medium === "print" ? state.spotRecipes.length : state.recipes.length;
        if (count > 1) {
          state.recipeIndex = (state.recipeIndex + 1) % count;
          renderRecipe();
          toast("换了一组配方");
        } else {
          toast("这个颜色只有一组推荐配方");
        }
      }
      const fiberBtn = e.target.closest("[data-fiber]");
      if (fiberBtn) {
        state.fiber = fiberBtn.dataset.fiber;
        renderRecipe();
      }
    });

    $("#image-open").addEventListener("click", openImageModal);
    $("#image-close").addEventListener("click", closeImageModal);
    els.imageModal.addEventListener("click", (e) => {
      if (e.target === els.imageModal) closeImageModal();
    });
    els.dropzone.addEventListener("click", () => els.imageFile.click());
    els.imageFile.addEventListener("change", () => { if (els.imageFile.files[0]) loadImageFile(els.imageFile.files[0]); els.imageFile.value = ""; });
    ["dragenter", "dragover"].forEach((evt) => els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault(); els.dropzone.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach((evt) => els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault(); els.dropzone.classList.remove("is-over");
    }));
    els.dropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadImageFile(file);
    });
    els.imageCanvas.addEventListener("click", pickImageColor);
    els.imagePalette.addEventListener("click", (e) => {
      const sw = e.target.closest("[data-image-color]");
      if (!sw) return;
      state.sampleHex = sw.dataset.imageColor;
      els.sampleHex.textContent = state.sampleHex;
      els.sampleSwatch.style.background = state.sampleHex;
      const rgb = E.parseHex(state.sampleHex);
      els.sampleRgb.textContent = `RGB ${rgb.r} · ${rgb.g} · ${rgb.b}`;
      els.applyImageColor.disabled = false;
      els.samplePin.classList.remove("show");
    });
    $("#new-image").addEventListener("click", () => {
      els.dropzone.hidden = false;
      els.imageWorkspace.hidden = true;
      els.imageCanvas.width = 1; els.imageCanvas.height = 1;
      state.image.canvas = null;
      state.sampleHex = null;
      els.imagePalette.innerHTML = "";
    });
    els.applyImageColor.addEventListener("click", () => {
      if (!state.sampleHex) return;
      setColor(state.sampleHex, { record: true });
      closeImageModal();
      toast("已应用图片中的颜色");
    });

    $("#eyedropper").addEventListener("click", async () => {
      if (!window.EyeDropper) {
        toast("此浏览器不支持屏幕吸管，请用图片取色或直接输入色值");
        return;
      }
      try {
        const result = await new window.EyeDropper().open();
        setColor(result.sRGBHex, { record: true });
        toast("已从屏幕取色");
      } catch (e) { /* user cancelled */ }
    });

    $("#download-card").addEventListener("click", exportCard);
    $("#download-json").addEventListener("click", exportJSON);
    $("#copy-css").addEventListener("click", () => copyText(`--color: ${state.hex};`, "CSS token 已复制"));

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-copy]");
      if (btn) copyText(btn.dataset.copy, "已复制");
    });

    window.addEventListener("hashchange", () => {
      const p = E.parseHex(location.hash.replace("#", ""));
      if (p && p.hex !== state.hex) setColor(p.hex, { record: false, updateUrl: false });
    });
    document.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "textarea", "select"].includes(tag) || e.target.isContentEditable) return;
      if (els.imageModal.open) return;
      if (e.key.toLowerCase() === "r") { e.preventDefault(); randomize(); }
      if (e.key.toLowerCase() === "e") { e.preventDefault(); $("#eyedropper").click(); }
      if (e.key.toLowerCase() === "i") { e.preventDefault(); openImageModal(); }
    });
  }

  init();
})();
