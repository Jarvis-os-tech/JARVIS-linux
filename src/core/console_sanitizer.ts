// Browser console sanitizer: in production silence noisy logs for cleaner UI performance
// while preserving console.error and console.warn for real diagnostics.

try {
  const isProd = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') ||
    (typeof (import.meta as any) !== 'undefined' && (import.meta as any).env && (import.meta as any).env.PROD);

  if (isProd) {
    console.debug = () => {};
  }
} catch {
  // ignore
}
