// Apply the saved theme and motion preference before first paint (no flash).
try {
  var t = localStorage.getItem("fv-theme");
  if (t && t !== "system") document.documentElement.dataset.theme = t;
  var m = localStorage.getItem("fv-motion");
  if (m === "on") document.documentElement.dataset.motion = "reduce";
  if (m === "off") document.documentElement.dataset.motion = "full";
} catch {
  // storage blocked; defaults apply
}
