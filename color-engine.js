/*!
 * 色研所 · CHROMA LAB — color engine
 * Pure, dependency-free color math and a practical pigment-recipe approximator.
 * Mixing predictions are models, not colorimetric guarantees. Always make a test swatch.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ColorEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
  const round = (n, p = 2) => {
    const f = Math.pow(10, p);
    return Math.round(n * f) / f;
  };
  const mod = (n, m) => ((n % m) + m) % m;

  /* ---------- conversions ---------- */

  function parseHex(input) {
    if (typeof input !== "string") return null;
    let hex = input.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      hex: "#" + hex.toUpperCase(),
    };
  }

  function rgbToHex(r, g, b) {
    const h = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
    return ("#" + h(r) + h(g) + h(b)).toUpperCase();
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { h: mod(h, 360), s: clamp(s) * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    h = mod(h, 360) / 360; s = clamp(s / 100); l = clamp(l / 100);
    if (s === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return {
      r: Math.round(hue(h + 1 / 3) * 255),
      g: Math.round(hue(h) * 255),
      b: Math.round(hue(h - 1 / 3) * 255),
    };
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: mod(h, 360), s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
  }

  function hsvToRgb(h, s, v) {
    h = mod(h, 360) / 60; s = clamp(s / 100); v = clamp(v / 100);
    const c = v * s, x = c * (1 - Math.abs((h % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 1) [r, g, b] = [c, x, 0];
    else if (h < 2) [r, g, b] = [x, c, 0];
    else if (h < 3) [r, g, b] = [0, c, x];
    else if (h < 4) [r, g, b] = [0, x, c];
    else if (h < 5) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  }

  function rgbToHwb(r, g, b) {
    const hsl = rgbToHsl(r, g, b);
    const w = Math.min(r, g, b) / 255 * 100;
    const bl = (1 - Math.max(r, g, b) / 255) * 100;
    return { h: hsl.h, w, b: bl };
  }

  function srgbToLinear(c) {
    c = clamp(c);
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb(c) {
    c = clamp(c);
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  function rgbToXyz(r, g, b) {
    const R = srgbToLinear(r / 255), G = srgbToLinear(g / 255), B = srgbToLinear(b / 255);
    return {
      x: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
      y: R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
      z: R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
    };
  }

  const WHITE = { x: 0.95047, y: 1, z: 1.08883 };
  const LAB_EPS = 216 / 24389;
  const LAB_KAPPA = 24389 / 27;

  function xyzToLab(xyz) {
    const f = (t) => (t > LAB_EPS ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116);
    const fx = f(xyz.x / WHITE.x), fy = f(xyz.y / WHITE.y), fz = f(xyz.z / WHITE.z);
    return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  function rgbToLab(r, g, b) {
    return xyzToLab(rgbToXyz(r, g, b));
  }

  function labToLch(lab) {
    const c = Math.hypot(lab.a, lab.b);
    let h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { l: lab.l, c, h };
  }

  function rgbToOklab(r, g, b) {
    const R = srgbToLinear(r / 255), G = srgbToLinear(g / 255), B = srgbToLinear(b / 255);
    const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
    const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
    const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return {
      l: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    };
  }

  function rgbToOklch(r, g, b) {
    const lab = rgbToOklab(r, g, b);
    const c = Math.hypot(lab.a, lab.b);
    let h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { l: lab.l * 100, c, h };
  }

  function rgbToCmyk(r, g, b) {
    const rr = r / 255, gg = g / 255, bb = b / 255;
    const k = 1 - Math.max(rr, gg, bb);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: ((1 - rr - k) / (1 - k)) * 100,
      m: ((1 - gg - k) / (1 - k)) * 100,
      y: ((1 - bb - k) / (1 - k)) * 100,
      k: k * 100,
    };
  }

  function relativeLuminance(r, g, b) {
    return 0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255);
  }

  function contrast(rgb1, rgb2) {
    const a = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const b = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function textOn(rgb) {
    const white = contrast(rgb, { r: 255, g: 255, b: 255 });
    const ink = contrast(rgb, { r: 26, g: 24, b: 20 });
    return white >= ink
      ? { color: "#FFFFFF", ratio: white, label: "白" }
      : { color: "#1A1814", ratio: ink, label: "墨" };
  }

  function deltaE76(lab1, lab2) {
    return Math.hypot(lab1.l - lab2.l, lab1.a - lab2.a, lab1.b - lab2.b);
  }

  // CIE ΔE2000 (kL = kC = kH = 1)
  function deltaE2000(lab1, lab2) {
    const L1 = lab1.l, a1 = lab1.a, b1 = lab1.b;
    const L2 = lab2.l, a2 = lab2.a, b2 = lab2.b;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
    const Cbar = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
    const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
    const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
    const hp1 = Cp1 === 0 ? 0 : mod(Math.atan2(b1, ap1) * 180 / Math.PI, 360);
    const hp2 = Cp2 === 0 ? 0 : mod(Math.atan2(b2, ap2) * 180 / Math.PI, 360);
    const dLp = L2 - L1;
    const dCp = Cp2 - Cp1;
    let dhp = 0;
    if (Cp1 * Cp2 !== 0) {
      dhp = hp2 - hp1;
      if (dhp > 180) dhp -= 360;
      else if (dhp < -180) dhp += 360;
    }
    const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * Math.PI) / 360);
    const Lbar = (L1 + L2) / 2;
    const Cpbar = (Cp1 + Cp2) / 2;
    let hbar = hp1 + hp2;
    if (Cp1 * Cp2 !== 0) {
      if (Math.abs(hp1 - hp2) > 180) hbar = hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2;
      else hbar = (hp1 + hp2) / 2;
    }
    const T = 1 - 0.17 * Math.cos((hbar - 30) * Math.PI / 180)
      + 0.24 * Math.cos((2 * hbar) * Math.PI / 180)
      + 0.32 * Math.cos((3 * hbar + 6) * Math.PI / 180)
      - 0.20 * Math.cos((4 * hbar - 63) * Math.PI / 180);
    const dTheta = 30 * Math.exp(-Math.pow((hbar - 275) / 25, 2));
    const Rc = 2 * Math.sqrt(Math.pow(Cpbar, 7) / (Math.pow(Cpbar, 7) + Math.pow(25, 7)));
    const Sl = 1 + (0.015 * Math.pow(Lbar - 50, 2)) / Math.sqrt(20 + Math.pow(Lbar - 50, 2));
    const Sc = 1 + 0.045 * Cpbar;
    const Sh = 1 + 0.015 * Cpbar * T;
    const Rt = -Math.sin(2 * dTheta * Math.PI / 180) * Rc;
    return Math.sqrt(
      Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh)
    );
  }

  /* ---------- colour language ---------- */

  const TRADITIONAL = [
    { name: "朱砂", en: "Cinnabar", hex: "#E34234" },
    { name: "妃色", en: "Consort Red", hex: "#ED5736" },
    { name: "品红", en: "Fuchsia", hex: "#F00056" },
    { name: "桃红", en: "Peach Blossom", hex: "#F47983" },
    { name: "海棠红", en: "Begonia Red", hex: "#DB5A6B" },
    { name: "石榴红", en: "Pomegranate", hex: "#F20C00" },
    { name: "樱桃色", en: "Cherry", hex: "#C93756" },
    { name: "银红", en: "Silver Red", hex: "#F05654" },
    { name: "大红", en: "Scarlet", hex: "#FF2121" },
    { name: "绛紫", en: "Deep Plum", hex: "#8C4356" },
    { name: "胭脂", en: "Rouge", hex: "#9D2933" },
    { name: "洋红", en: "Carmine", hex: "#FF4777" },
    { name: "嫣红", en: "Rosy Red", hex: "#EF7A82" },
    { name: "赫赤", en: "Crimson", hex: "#C1232B" },
    { name: "茜色", en: "Madder", hex: "#CB3A56" },
    { name: "丹", en: "Vermilion", hex: "#FF4E20" },
    { name: "橘红", en: "Tangerine", hex: "#FF7500" },
    { name: "杏黄", en: "Apricot", hex: "#FFA631" },
    { name: "姜黄", en: "Turmeric", hex: "#FFC773" },
    { name: "缃色", en: "Silk Yellow", hex: "#F0C239" },
    { name: "琥珀", en: "Amber", hex: "#CA6924" },
    { name: "茶色", en: "Tea", hex: "#B35C44" },
    { name: "驼色", en: "Camel", hex: "#A88462" },
    { name: "藤黄", en: "Gamboge", hex: "#FFB61E" },
    { name: "鹅黄", en: "Gosling Yellow", hex: "#FFF143" },
    { name: "樱草色", en: "Primrose", hex: "#EAFF56" },
    { name: "明黄", en: "Imperial Yellow", hex: "#FFE211" },
    { name: "金黄", en: "Golden", hex: "#F2BE45" },
    { name: "秋香色", en: "Autumn Gold", hex: "#D9B611" },
    { name: "松花色", en: "Pine Pollen", hex: "#BCE672" },
    { name: "柳黄", en: "Willow Yellow", hex: "#C9DD22" },
    { name: "豆绿", en: "Pea Green", hex: "#9ED900" },
    { name: "油绿", en: "Glossy Green", hex: "#00BC12" },
    { name: "碧色", en: "Jade", hex: "#1BD1A5" },
    { name: "竹青", en: "Bamboo Green", hex: "#789262" },
    { name: "青碧", en: "Mineral Cyan", hex: "#48C0A3" },
    { name: "铜绿", en: "Verdigris", hex: "#549688" },
    { name: "石绿", en: "Malachite", hex: "#16A951" },
    { name: "松柏绿", en: "Cypress", hex: "#21A675" },
    { name: "艾绿", en: "Mugwort", hex: "#A4E2C6" },
    { name: "绿沈", en: "Deep Green", hex: "#0C8918" },
    { name: "墨绿", en: "Ink Green", hex: "#1A6840" },
    { name: "苔绿", en: "Moss", hex: "#887322" },
    { name: "青绿", en: "Teal Green", hex: "#2C9678" },
    { name: "孔雀蓝", en: "Peacock Blue", hex: "#0EB0C9" },
    { name: "湖蓝", en: "Lake Blue", hex: "#30DFF3" },
    { name: "青色", en: "Cyan", hex: "#00E09E" },
    { name: "天青", en: "Sky Blue", hex: "#7BC6CC" },
    { name: "月白", en: "Moon White", hex: "#D6ECF0" },
    { name: "水色", en: "Water Hue", hex: "#88ADA6" },
    { name: "靛青", en: "Indigo", hex: "#177CB0" },
    { name: "群青", en: "Ultramarine", hex: "#2E59A7" },
    { name: "宝蓝", en: "Sapphire", hex: "#4B5CC4" },
    { name: "石青", en: "Azurite", hex: "#1685A9" },
    { name: "藏蓝", en: "Navy", hex: "#3B2E7E" },
    { name: "黛蓝", en: "Dai Blue", hex: "#425066" },
    { name: "黛", en: "Kohl", hex: "#4A4266" },
    { name: "普鲁士蓝", en: "Prussian Blue", hex: "#003153" },
    { name: "紫罗兰", en: "Violet", hex: "#7B4F9D" },
    { name: "紫棠", en: "Aubergine", hex: "#56004F" },
    { name: "雪青", en: "Lilac Gray", hex: "#B0A4E3" },
    { name: "丁香", en: "Lilac", hex: "#CCA4E3" },
    { name: "藕荷", en: "Lotus Pink", hex: "#E4C6D0" },
    { name: "葡萄紫", en: "Grape", hex: "#5D3F6A" },
    { name: "紫檀", en: "Rosewood", hex: "#4C221B" },
    { name: "枣红", en: "Jujube Red", hex: "#C32136" },
    { name: "栗色", en: "Chestnut", hex: "#60281E" },
    { name: "赭石", en: "Ochre", hex: "#845A33" },
    { name: "褐色", en: "Brown", hex: "#6E4B3A" },
    { name: "咖啡", en: "Coffee", hex: "#6F4E37" },
    { name: "象牙白", en: "Ivory", hex: "#FFFBF0" },
    { name: "缟素", en: "Raw Silk", hex: "#F2ECDE" },
    { name: "霜色", en: "Frost", hex: "#E9F1F6" },
    { name: "银白", en: "Silver White", hex: "#E9E7EF" },
    { name: "铅白", en: "Lead White", hex: "#F0F0F4" },
    { name: "墨灰", en: "Ink Gray", hex: "#758A99" },
    { name: "鸦青", en: "Raven Blue", hex: "#424C50" },
    { name: "玄青", en: "Mystic Black", hex: "#3D3B4F" },
    { name: "墨色", en: "Ink", hex: "#1C1C1C" },
    { name: "乌黑", en: "Raven Black", hex: "#2B2B2B" },
  ].map((c) => ({ ...c, rgb: parseHex(c.hex), lab: rgbToLab(...Object.values(parseHex(c.hex)).slice(0, 3)) }));

  // Nearest traditional colour; deltaE76 is plenty for swatch labels and is fast.
  function nearestTraditional(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    let best = null, bestD = Infinity;
    for (const c of TRADITIONAL) {
      const d = deltaE76(lab, c.lab);
      if (d < bestD) { bestD = d; best = c; }
    }
    return { ...best, distance: round(bestD, 2) };
  }

  const CSS_NAMES = [
    ["黑", "#000000"], ["石板灰", "#708090"], ["灰", "#808080"], ["银", "#C0C0C0"], ["白", "#FFFFFF"],
    ["栗色", "#800000"], ["红", "#FF0000"], ["橙红", "#FF4500"], ["橙", "#FFA500"], ["金", "#FFD700"],
    ["黄", "#FFFF00"], ["黄绿", "#9ACD32"], ["酸橙", "#00FF00"], ["绿", "#008000"], ["海洋绿", "#2E8B57"],
    ["青", "#00FFFF"], ["水鸭", "#008080"], ["天蓝", "#87CEEB"], ["道奇蓝", "#1E90FF"], ["蓝", "#0000FF"],
    ["海军蓝", "#000080"], ["靛蓝", "#4B0082"], ["紫", "#800080"], ["兰花紫", "#DA70D6"], ["粉", "#FFC0CB"],
    ["米色", "#F5F5DC"], ["小麦", "#F5DEB3"], ["沙棕", "#F4A460"], ["巧克力", "#D2691E"], ["棕", "#A52A2A"],
  ].map(([name, hex]) => ({ name, hex, lab: rgbToLab(...["r", "g", "b"].map((k) => parseHex(hex)[k])) }));

  function nearestCssName(hex) {
    const rgb = parseHex(hex);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    let best = null, bestD = Infinity;
    for (const c of CSS_NAMES) {
      const d = deltaE76(lab, c.lab);
      if (d < bestD) { bestD = d; best = c; }
    }
    return { ...best, distance: round(bestD, 2) };
  }

  const HUE_FAMILIES = [
    { max: 15, key: "red", name: "红", scene: "暮色里的朱砂与旧漆器" },
    { max: 40, key: "orange", name: "橙", scene: "秋日晒暖的陶土" },
    { max: 65, key: "yellow", name: "黄", scene: "麦田将熟的午后" },
    { max: 90, key: "chartreuse", name: "黄绿", scene: "雨后的嫩叶" },
    { max: 150, key: "green", name: "绿", scene: "潮湿苔藓与旧铜器" },
    { max: 185, key: "spring", name: "青绿", scene: "青瓷釉面和浅海" },
    { max: 215, key: "cyan", name: "青", scene: "晨雾里的湖水" },
    { max: 250, key: "blue", name: "蓝", scene: "暮色中的远山" },
    { max: 285, key: "indigo", name: "靛", scene: "深夜海面与靛蓝布" },
    { max: 320, key: "purple", name: "紫", scene: "暮霭中的紫藤" },
    { max: 345, key: "magenta", name: "洋红", scene: "胭脂与将散的晚霞" },
    { max: 360, key: "red", name: "红", scene: "暮色里的朱砂与旧漆器" },
  ];

  function hueFamily(h) {
    return HUE_FAMILIES.find((f) => h < f.max) || HUE_FAMILIES[0];
  }

  function describe(hex) {
    const rgb = parseHex(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    const lch = labToLch(lab);
    const fam = hueFamily(hsl.h);
    const neutral = lch.c < 9;
    const warm = hsl.h < 70 || hsl.h >= 330;
    const tone =
      hsl.l > 84 ? "极浅而近乎呼吸" :
      hsl.l > 70 ? "浅淡而轻盈" :
      hsl.l < 18 ? "深到几乎吞掉光线" :
      hsl.l < 34 ? "深沉而克制" :
      hsl.s < 18 ? "安静、灰调" :
      hsl.s > 74 ? "浓烈而直接" :
      "沉稳而有分寸";
    const temp = neutral ? "中性" : warm ? "暖调" : "冷调";
    const scene = neutral ? "宣纸、石阶与被雨洗过的雾" : fam.scene;
    const tags = [temp];
    if (neutral) tags.push("低饱和");
    else if (lch.c > 52) tags.push("高彩度");
    if (hsl.l > 70) tags.push("明亮");
    else if (hsl.l < 35) tags.push("幽深");
    if (hsl.h >= 0 && hsl.h < 75) tags.push("温暖");
    if (hsl.h >= 75 && hsl.h < 200) tags.push("清透");
    if (hsl.h >= 200 && hsl.h < 300) tags.push("冷静");
    return {
      hueName: neutral ? "无彩" : fam.name,
      label: neutral ? "近中性色" : `${fam.name}调`,
      temp,
      tags: [...new Set(tags)].slice(0, 3),
      description: `它像${scene}，${tone}。`,
      cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b),
      lab, lch, hsl,
    };
  }

  /* ---------- relationships ---------- */

  const HARMONIES = [
    { id: "mono", name: "单色", en: "MONOCHROMATIC", note: "同一色相，以明度与饱和度分层。" },
    { id: "analogous", name: "类似", en: "ANALOGOUS", note: "色轮上相邻的色相，安静而有层次。" },
    { id: "complement", name: "互补", en: "COMPLEMENTARY", note: "正对面的色相，对比最强、最响。" },
    { id: "split", name: "分裂互补", en: "SPLIT", note: "互补色两侧的色相，保留张力但更易相处。" },
    { id: "triad", name: "三角", en: "TRIADIC", note: "色轮三等分，鲜明、均衡、富有节奏。" },
    { id: "tetrad", name: "四角", en: "TETRADIC", note: "两组互补色，信息丰富，需要主次。" },
  ];

  function makeHsv(h, s, v) {
    h = mod(h, 360); s = clamp(s, 0, 100); v = clamp(v, 0, 100);
    const rgb = hsvToRgb(h, s, v);
    return { h, s, v, ...rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b) };
  }

  function harmonies(baseHex) {
    const rgb = parseHex(baseHex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    const h = hsv.h, s = hsv.s, v = hsv.v;
    const out = {};
    const push = (type, role, hh, ss, vv) => {
      const c = makeHsv(hh, ss, vv);
      const named = nearestTraditional(c.hex);
      out[type].push({ ...c, role, name: named.name, en: named.en });
    };
    const types = ["mono", "analogous", "complement", "split", "triad", "tetrad"];
    types.forEach((t) => (out[t] = []));

    [0.18, 0.36, 0.55, 0.76, 0.95].forEach((k, i) => {
      push("mono", ["深", "较深", "基准", "较浅", "浅"][i], h, Math.max(8, s * (0.55 + k * 0.55)), Math.min(98, 20 + k * 78));
    });
    [-42, -21, 0, 21, 42].forEach((dh, i) => {
      push("analogous", ["远邻", "近邻", "基准", "近邻", "远邻"][i], h + dh, s * (0.88 + i * 0.03), Math.min(98, v * (0.9 + i * 0.035)));
    });
    [
      ["基准", 0, 1], ["浅调", 0, 1.26], ["互补", 180, 1], ["互补浅调", 180, 1.22], ["深调", 0, 0.64],
    ].forEach(([role, dh, mult], i) => {
      const l = makeHsv(h + dh, i === 1 || i === 3 ? Math.max(12, s * 0.62) : s, i === 1 || i === 3 ? Math.min(98, v * 1.1 + 8) : i === 4 ? v * 0.58 : v);
      push("complement", role, l.h, l.s, l.v);
    });
    [
      ["基准", 0, 1], ["邻色", 150, 0.95], ["邻色", 210, 0.95], ["浅邻色", 150, 0.62], ["浅邻色", 210, 0.62],
    ].forEach(([role, dh, sv]) => {
      const c = makeHsv(h + dh, s * (sv < 0.8 ? 0.7 : 0.92), v * (sv < 0.8 ? 1.1 : 0.98));
      push("split", role, c.h, Math.min(96, c.s), Math.min(98, c.v));
    });
    [
      ["基准", 0, 1], ["第二色", 120, 0.96], ["第三色", 240, 0.96], ["浅第二色", 120, 0.66], ["浅第三色", 240, 0.66],
    ].forEach(([role, dh, sv]) => {
      const c = makeHsv(h + dh, s * (sv < 0.8 ? 0.7 : 0.94), v * (sv < 0.8 ? 1.08 : 0.98));
      push("triad", role, c.h, Math.min(96, c.s), Math.min(98, c.v));
    });
    [
      ["基准", 0], ["第二色", 90], ["互补", 180], ["第四色", 270], ["浅基准", 0],
    ].forEach(([role, dh], i) => {
      const c = makeHsv(h + dh, s * (i === 4 ? 0.6 : 0.93), v * (i === 4 ? 1.1 : 0.97));
      push("tetrad", role, c.h, Math.min(96, c.s), Math.min(98, c.v));
    });
    return out;
  }

  function contrastReport(hex) {
    const bg = parseHex(hex);
    const candidates = [
      { name: "纯白", hex: "#FFFFFF" },
      { name: "暖白", hex: "#FFF8EA" },
      { name: "墨黑", hex: "#1A1814" },
      { name: "同色深调", hex: makeHsv(0, 0, 0).hex },
    ];
    const hsl = rgbToHsl(bg.r, bg.g, bg.b);
    candidates[3].hex = makeHsv(hsl.h, Math.min(90, hsl.s * 0.9), Math.max(12, hsl.l * 0.28)).hex;
    const rows = candidates.map((c) => {
      const rgb = parseHex(c.hex);
      return { ...c, ratio: contrast(bg, rgb) };
    }).sort((a, b) => b.ratio - a.ratio);
    return { best: rows[0], rows, onColor: textOn(bg) };
  }

  /* ---------- pigment recipe engine ---------- */

  const PIGMENTS = [
    { id: "pw6", name: "钛白", en: "Titanium White", code: "PW6", hex: "#F8F6EC", strength: 0.72, opacity: "高", granulation: "低", lightfast: "极佳", note: "遮盖力强，用来提亮和降低饱和度。" },
    { id: "py3", name: "柠檬黄", en: "Lemon Yellow", code: "PY3", hex: "#FFE94A", strength: 0.52, opacity: "中", granulation: "低", lightfast: "良好", note: "清亮的绿相黄，适合偏冷的黄绿。" },
    { id: "py74", name: "汉沙黄", en: "Hansa Yellow", code: "PY74", hex: "#FFD11F", strength: 0.62, opacity: "中", granulation: "低", lightfast: "良好", note: "干净的中性黄，透明而鲜艳。" },
    { id: "py43", name: "土黄", en: "Yellow Ochre", code: "PY43", hex: "#C28B3F", strength: 0.88, opacity: "高", granulation: "中", lightfast: "极佳", note: "温和的土色黄，适合压住过于鲜艳的颜色。" },
    { id: "po20", name: "镉橙", en: "Cadmium Orange", code: "PO20", hex: "#E66A2C", strength: 0.9, opacity: "高", granulation: "低", lightfast: "极佳", note: "不透明的暖橙；含镉，避免喷涂或入口。" },
    { id: "pr9", name: "朱红", en: "Naphthol Red", code: "PR9", hex: "#D83A33", strength: 1.02, opacity: "中", granulation: "低", lightfast: "良好", note: "偏暖的红，适合砖红、珊瑚和暖橙红。" },
    { id: "pr122", name: "喹吖啶酮洋红", en: "Quinacridone Magenta", code: "PR122", hex: "#B8346B", strength: 1.2, opacity: "半透明", granulation: "低", lightfast: "极佳", note: "高着色力洋红，适合玫红、紫红和清透的红。" },
    { id: "pv19", name: "玫瑰红", en: "Quinacridone Rose", code: "PV19", hex: "#BC4C67", strength: 1.05, opacity: "半透明", granulation: "低", lightfast: "极佳", note: "偏蓝的红，能调出干净的粉色与紫色。" },
    { id: "pr102", name: "熟赭", en: "Burnt Sienna", code: "PR102", hex: "#A54E34", strength: 0.92, opacity: "高", granulation: "中", lightfast: "极佳", note: "暖调铁红，土色与肤色的骨架。" },
    { id: "pbr7", name: "熟褐", en: "Burnt Umber", code: "PBr7", hex: "#633B2A", strength: 1.05, opacity: "高", granulation: "中", lightfast: "极佳", note: "深棕带红，适合压暗暖色。" },
    { id: "pbr7r", name: "生褐", en: "Raw Umber", code: "PBr7", hex: "#7A6040", strength: 0.9, opacity: "高", granulation: "中", lightfast: "极佳", note: "偏冷的棕，降低明度而不发红。" },
    { id: "pb29", name: "群青", en: "Ultramarine", code: "PB29", hex: "#2E4F9F", strength: 0.85, opacity: "半透明", granulation: "高", lightfast: "极佳", note: "偏紫的蓝，适合天空、阴影和清透的紫。" },
    { id: "pb15", name: "酞菁蓝", en: "Phthalo Blue", code: "PB15", hex: "#0D6E9E", strength: 1.55, opacity: "半透明", granulation: "低", lightfast: "极佳", note: "着色力极强；少量就能染色，务必逐次加入。" },
    { id: "pg7", name: "酞菁绿", en: "Phthalo Green", code: "PG7", hex: "#007C6B", strength: 1.45, opacity: "半透明", granulation: "低", lightfast: "极佳", note: "强烈、偏冷的绿；与黄混合可做鲜绿。" },
    { id: "pg18", name: "铬绿", en: "Viridian", code: "PG18", hex: "#1F6B5B", strength: 0.86, opacity: "半透明", granulation: "中", lightfast: "优", note: "沉静的蓝绿，适合松针与深水。" },
    { id: "pv23", name: "二噁嗪紫", en: "Dioxazine Violet", code: "PV23", hex: "#563178", strength: 1.4, opacity: "半透明", granulation: "低", lightfast: "优", note: "深而透明的紫，少量即可压出紫调暗部。" },
    { id: "pbk9", name: "象牙黑", en: "Ivory Black", code: "PBk9", hex: "#252528", strength: 1.8, opacity: "高", granulation: "低", lightfast: "极佳", note: "偏暖的黑；过量会让颜色发灰、发脏。" },
  ];

  const WATERCOLOR_PALETTE = PIGMENTS.filter((p) => !["po20"].includes(p.id)); // a compact, mostly cadmium-free beginner palette
  const PAINT_PALETTE = PIGMENTS.filter((p) => !["po20"].includes(p.id));

  const PRINT_INKS = [
    { id: "ink-y", name: "四色黄", en: "Process Yellow", code: "Y", hex: "#FFE600", strength: 0.8, note: "四色胶印黄墨。" },
    { id: "ink-m", name: "四色品红", en: "Process Magenta", code: "M", hex: "#E5007E", strength: 1.05, note: "四色胶印品红墨。" },
    { id: "ink-c", name: "四色青", en: "Process Cyan", code: "C", hex: "#0094D8", strength: 1.0, note: "四色胶印青墨。" },
    { id: "ink-k", name: "四色黑", en: "Process Black", code: "K", hex: "#1E1E1E", strength: 1.9, note: "四色胶印黑墨。" },
    { id: "ink-w", name: "调墨白", en: "Opaque White", code: "W", hex: "#FAF9F3", strength: 0.66, note: "用于冲淡墨色；会略微降低饱和度。" },
    { id: "ink-o", name: "橙墨", en: "Orange Ink", code: "O", hex: "#F47A20", strength: 0.9, note: "扩展色，让橙色不必只靠 Y+M。" },
    { id: "ink-g", name: "绿墨", en: "Green Ink", code: "G", hex: "#008B5A", strength: 1.0, note: "扩展色，补足四色难以企及的鲜绿。" },
    { id: "ink-v", name: "紫墨", en: "Violet Ink", code: "V", hex: "#5B2A86", strength: 1.1, note: "扩展色，用于深紫与蓝紫。" },
  ];

  function ksFromChannel(c) {
    const r = clamp(c, 0.004, 0.996);
    return Math.pow(1 - r, 2) / (2 * r);
  }
  function channelFromKs(ks) {
    ks = Math.max(0, ks);
    return clamp(1 + ks - Math.sqrt(ks * ks + 2 * ks));
  }

  const _pigmentCache = new Map();
  function pigmentKs(p) {
    if (_pigmentCache.has(p.id)) return _pigmentCache.get(p.id);
    const rgb = parseHex(p.hex);
    const ks = [rgb.r, rgb.g, rgb.b].map((v) => ksFromChannel(srgbToLinear(v / 255)));
    _pigmentCache.set(p.id, ks);
    return ks;
  }

  /**
   * A three-channel, single-constant Kubelka–Munk style approximation.
   * Good enough to generate starting recipes; not a spectral color match.
   */
  function mixPigments(components, palette = PIGMENTS) {
    const map = new Map(palette.map((p) => [p.id, p]));
    const total = components.reduce((s, c) => s + Math.max(0, c.parts), 0);
    if (total <= 0) return null;
    const ks = [0, 0, 0];
    let weightSum = 0;
    for (const comp of components) {
      const p = map.get(comp.id);
      if (!p || comp.parts <= 0) continue;
      const w = comp.parts * (p.strength || 1);
      const pks = pigmentKs(p);
      weightSum += w;
      for (let i = 0; i < 3; i++) ks[i] += pks[i] * w;
    }
    if (weightSum === 0) return null;
    const rgb = ks.map((v) => linearToSrgb(channelFromKs(v / weightSum)) * 255);
    return {
      r: Math.round(rgb[0]), g: Math.round(rgb[1]), b: Math.round(rgb[2]),
      hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
    };
  }

  function normalizeComponents(components, palette) {
    const map = new Map(palette.map((p) => [p.id, p]));
    const cleaned = components
      .filter((c) => c.parts > 0.001 && map.has(c.id))
      .map((c) => ({ id: c.id, parts: c.parts }));
    const total = cleaned.reduce((s, c) => s + c.parts, 0);
    return cleaned.map((c) => ({ ...c, parts: (c.parts / total) * 100 })).sort((a, b) => b.parts - a.parts);
  }

  function recipeLabel(de) {
    if (de < 1.6) return "非常接近";
    if (de < 3.5) return "接近";
    if (de < 7) return "可用起点";
    return "需实测调整";
  }

  function findPigmentRecipes(targetHex, palette = PIGMENTS, limit = 4) {
    const rgb = parseHex(targetHex);
    if (!rgb) return [];
    const targetLab = rgbToLab(rgb.r, rgb.g, rgb.b);
    const pool = palette;
    const singles = [];
    const pairs = [];

    const evaluate = (comps, complexity = 0) => {
      const predicted = mixPigments(comps, pool);
      if (!predicted) return null;
      const lab = rgbToLab(predicted.r, predicted.g, predicted.b);
      const de = deltaE2000(targetLab, lab);
      const total = comps.reduce((s, c) => s + c.parts, 0);
      const whitePart = comps.reduce((s, c) => s + (c.id === "pw6" || c.id === "ink-w" ? c.parts : 0), 0) / total;
      const blackPart = comps.reduce((s, c) => s + (c.id === "pbk9" || c.id === "ink-k" ? c.parts : 0), 0) / total;
      const penalty = complexity + Math.max(0, whitePart - 0.78) * 3 + Math.max(0, blackPart - 0.55) * 4;
      return { components: comps, predicted, de, score: de + penalty, lab, complexity };
    };

    pool.forEach((p) => {
      const c = evaluate([{ id: p.id, parts: 1 }], 0);
      if (c) singles.push(c);
    });
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        for (let t = 0.04; t <= 0.961; t += 0.04) {
          const c = evaluate([{ id: pool[i].id, parts: t * 100 }, { id: pool[j].id, parts: (1 - t) * 100 }], 0);
          if (c) pairs.push(c);
        }
      }
    }
    pairs.sort((a, b) => a.score - b.score);
    const seeds = pairs.slice(0, 28).concat(singles).sort((a, b) => a.score - b.score).slice(0, 34);

    const triples = [];
    for (const seed of seeds) {
      const used = new Set(seed.components.map((c) => c.id));
      if (seed.components.length === 1) {
        for (const p of pool) {
          if (used.has(p.id)) continue;
          for (const extra of [0.08, 0.16, 0.25, 0.38]) {
            const base = 1 - extra;
            const comps = [
              { id: seed.components[0].id, parts: base * 100 },
              { id: p.id, parts: extra * 100 },
            ];
            const c = evaluate(comps, 0.22);
            if (c) triples.push(c);
          }
        }
      } else {
        for (const p of pool) {
          if (used.has(p.id)) continue;
          for (const extra of [0.06, 0.12, 0.2, 0.3]) {
            const base = 1 - extra;
            const comps = seed.components.map((c) => ({ id: c.id, parts: c.parts * base }));
            comps.push({ id: p.id, parts: extra * 100 });
            const c = evaluate(comps, 0.3);
            if (c) triples.push(c);
          }
        }
      }
    }

    let all = singles.concat(pairs, triples)
      .filter((r) => r.de < 24)
      .sort((a, b) => a.score - b.score);

    const seen = new Set();
    const results = [];
    for (const r of all) {
      const comps = normalizeComponents(r.components, pool);
      if (comps.some((c) => c.parts < 1.2)) continue;
      const key = comps.map((c) => `${c.id}:${Math.round(c.parts / 2) * 2}`).sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const predicted = mixPigments(comps, pool);
      const lab = rgbToLab(predicted.r, predicted.g, predicted.b);
      const de = deltaE2000(targetLab, lab);
      results.push({ ...r, components: comps, predicted, de, lab, quality: recipeLabel(de) });
      if (results.length >= limit) break;
    }
    return results;
  }

  /* ---------- textile dye recipes ---------- */

  const FIBERS = {
    cotton: {
      id: "cotton",
      name: "棉 / 麻",
      en: "CELLULOSIC",
      dyeClass: "活性染料",
      dyes: ["活性黄 3RS", "活性红 3BS", "活性蓝 KN-R", "活性黑 B"],
      chemicals: ["元明粉 40–80 g/L", "纯碱 15–20 g/L", "匀染剂 0.5–1 g/L", "皂洗剂 1–2 g/L（后处理）"],
      temp: "60 °C", time: "60 min", bath: "1:10", ph: "10.5–11（固色阶段）",
      process: [
        "称取织物重量，按 o.w.f. 计算染料与助剂用量；先用温水化开染料。",
        "入染浴，加入元明粉，40 °C 起染 20 分钟，让染料均匀吸附。",
        "分两次加入纯碱，升温至 60 °C，保温 60 分钟完成固色。",
        "充分水洗，再用皂洗剂 90 °C 皂洗 10 分钟，洗去浮色并测试色牢度。",
      ],
      note: "活性染料与纤维素形成共价键，湿牢度好；碱量和盐量需按颜色深度调整。",
    },
    wool: {
      id: "wool",
      name: "羊毛 / 真丝",
      en: "PROTEIN",
      dyeClass: "酸性染料",
      dyes: ["酸性黄 2G", "酸性红 B", "酸性蓝 5R", "酸性黑 10B"],
      chemicals: ["醋酸 1–2%（调 pH）", "元明粉 5–10 g/L", "匀染剂 0.5–1 g/L"],
      temp: "85–98 °C", time: "45–60 min", bath: "1:20", ph: "4.5–5.5",
      process: [
        "将染料用温水化开，加入醋酸与匀染剂，调至 pH 4.5–5.5。",
        "织物润湿后入浴，从 40 °C 缓慢升温，避免羊毛毡化。",
        "在 85–98 °C 保温 45–60 分钟；真丝宜取温度下限。",
        "自然降温后水洗，必要时做固色后处理；勿骤冷。",
      ],
      note: "酸性染料与蛋白质纤维结合；升温过快会造成上染不匀和毡化。",
    },
    polyester: {
      id: "polyester",
      name: "涤纶",
      en: "SYNTHETIC",
      dyeClass: "分散染料",
      dyes: ["分散黄 E-3G", "分散红 3B", "分散蓝 2BLN", "分散黑 ECT"],
      chemicals: ["分散剂 0.5–1 g/L", "醋酸 0.5–1 g/L（调 pH）", "还原清洗剂（后处理）"],
      temp: "130 °C", time: "30–60 min", bath: "1:10", ph: "4.5–5",
      process: [
        "染料用少量温水与分散剂调成均匀悬浮液，避免结块。",
        "入染浴，调 pH 4.5–5，在 70 °C 左右开始缓慢升温。",
        "升至 130 °C，保温 30–60 分钟；需要高温高压染缸。",
        "降温后还原清洗，去除表面浮色，再水洗、烘干。",
      ],
      note: "分散染料需要高温高压；家庭条件通常无法达到 130 °C，建议送专业染厂打样。",
    },
  };

  function dyeRecipe(hex, fiberId = "cotton") {
    const rgb = parseHex(hex);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
    const depth = clamp(0.18 + (1 - lab.l / 100) * 4.6, 0.12, 5.2); // total approximate depth % o.w.f.
    const black = cmyk.k / 100;
    const amounts = [
      (cmyk.y / 100) * 0.94 + black * 0.22 + 0.012,
      (cmyk.m / 100) * 0.94 + black * 0.22 + 0.012,
      (cmyk.c / 100) * 0.94 + black * 0.22 + 0.012,
      black > 0.24 ? (black - 0.16) * 0.9 : 0.008,
    ].map((v) => round(v * depth, 2));
    const fiber = FIBERS[fiberId] || FIBERS.cotton;
    const comps = amounts.map((a, i) => ({
      id: "dye-" + i,
      name: fiber.dyes[i],
      parts: a,
      hex: ["#EFCF2A", "#D5325C", "#2468A4", "#222326"][i],
      amount: a,
    }));
    const total = amount => amount;
    return {
      fiber,
      depth: round(depth, 2),
      components: comps.filter((c) => c.amount > 0.005),
      totalDye: round(comps.reduce((s, c) => s + c.amount, 0), 2),
      chemicals: fiber.chemicals,
      process: fiber.process,
      note: fiber.note,
      cmyk,
      lab,
      total,
    };
  }

  /* ---------- export helpers ---------- */

  function allValues(hex) {
    const rgb = parseHex(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    const hwb = rgbToHwb(rgb.r, rgb.g, rgb.b);
    const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    const lch = labToLch(lab);
    const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);
    const xyz = rgbToXyz(rgb.r, rgb.g, rgb.b);
    const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
    const named = nearestTraditional(hex);
    return {
      hex: rgb.hex, rgb, hsl, hsv, hwb, cmyk, lab, lch, oklch, xyz, lum, named,
      css: `--color: ${rgb.hex};`,
    };
  }

  function randomColor() {
    const h = Math.random() * 360;
    const s = 38 + Math.random() * 58;
    const v = 30 + Math.random() * 58;
    const c = makeHsv(h, s, v);
    return c.hex;
  }

  return {
    clamp, round, mod, parseHex, rgbToHex,
    rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb, rgbToHwb,
    srgbToLinear, linearToSrgb, rgbToXyz, xyzToLab, rgbToLab, labToLch, rgbToOklab, rgbToOklch,
    rgbToCmyk, relativeLuminance, contrast, textOn, deltaE76, deltaE2000,
    TRADITIONAL, nearestTraditional, CSS_NAMES, nearestCssName, describe, hueFamily,
    HARMONIES, harmonies, makeHsv, contrastReport,
    PIGMENTS, WATERCOLOR_PALETTE, PAINT_PALETTE, PRINT_INKS,
    mixPigments, findPigmentRecipes, recipeLabel,
    FIBERS, dyeRecipe,
    allValues, randomColor,
  };
});
