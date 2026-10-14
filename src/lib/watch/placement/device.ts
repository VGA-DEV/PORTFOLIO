type Navigator3D = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

/** Skip the 3D on data saver or on clearly weak devices; the flat watch stays. */
export function deviceIsTooWeak() {
  const nav = navigator as Navigator3D;
  if (nav.connection?.saveData) return true;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return true;
  if (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4) return true;
  return false;
}
