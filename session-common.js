// Shared by the two session screens: the theme and the site's name.
function applyBackground(bg) {
  if (!bg) return;
  if (bg.type === "preset") {
    document.body.classList.toggle("theme-white", bg.value === "white");
  } else if (bg.type === "custom" && bg.value) {
    document.body.style.background = bg.value;
    document.body.style.color = isLightColor(bg.value) ? "#000" : "#fff";
  }
}

function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff, g = (v >> 8) & 0xff, b = v & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}

function siteName(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return "this site"; }
}
