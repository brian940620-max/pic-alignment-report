// Display-only sequential scale. Input is the renderer's existing normalized intensity.
// Keep the physical normalization and every color bar unchanged in meaning.
const STOPS = [[10, 23, 42], [25, 59, 88], [29, 111, 137], [69, 175, 179], [181, 217, 172], [255, 215, 133]];
export function fieldColor(value) {
  const u = Math.max(0, Math.min(1, value)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(u)), f = u - i;
  return STOPS[i].map((v, k) => (v + (STOPS[i + 1][k] - v) * f) / 255);
}
export const fieldRGB = value => fieldColor(value).map(v => v * 255);

// Write the same interpolated colors directly, avoiding a short-lived array for
// every pixel. Keep /255 *255 to match the existing Uint8ClampedArray rounding.
export function writeFieldPixel(data, offset, value) {
  const u = Math.max(0, Math.min(1, value)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(u)), f = u - i;
  const a = STOPS[i], b = STOPS[i + 1];
  data[offset] = ((a[0] + (b[0] - a[0]) * f) / 255) * 255;
  data[offset + 1] = ((a[1] + (b[1] - a[1]) * f) / 255) * 255;
  data[offset + 2] = ((a[2] + (b[2] - a[2]) * f) / 255) * 255;
  data[offset + 3] = 255;
}

// High-contrast light display; normalization stays linear and shared across Z.
const LIGHT_STOPS = [[5, 12, 24], [16, 100, 139], [39, 191, 205], [143, 235, 218], [255, 239, 173], [255, 255, 247]];
export function lightRGB(value) {
  const stops = LIGHT_STOPS;
  const u = Math.max(0, Math.min(1, value)) * 5, i = Math.min(4, Math.floor(u)), f = u - i;
  return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * f);
}

export function writeLightPixel(data, offset, value) {
  const u = Math.max(0, Math.min(1, value)) * 5, i = Math.min(4, Math.floor(u)), f = u - i;
  const a = LIGHT_STOPS[i], b = LIGHT_STOPS[i + 1];
  data[offset] = a[0] + (b[0] - a[0]) * f;
  data[offset + 1] = a[1] + (b[1] - a[1]) * f;
  data[offset + 2] = a[2] + (b[2] - a[2]) * f;
  data[offset + 3] = 255;
}
