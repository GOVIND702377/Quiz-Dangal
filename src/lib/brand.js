// Minimal brand helper utilities used across info pages
// Keep static strings so Tailwind can pick them during content scan

const gradients = [
  'from-violet-500 to-fuchsia-500',
  'from-indigo-500 to-sky-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-rose-500',
  'from-pink-500 to-red-500',
];

const textColors = [
  'text-violet-400',
  'text-indigo-300',
  'text-emerald-400',
  'text-amber-300',
  'text-rose-400',
];

export function getBrandGradient(index = 0) {
  const i = Number.isFinite(index) ? Math.abs(index) : 0;
  return gradients[i % gradients.length];
}

export function getBrandText(index = 0) {
  const i = Number.isFinite(index) ? Math.abs(index) : 0;
  return textColors[i % textColors.length];
}

// Named exports for potential iteration or testing
export const BRAND_GRADIENTS = gradients;
export const BRAND_TEXT_COLORS = textColors;
