// Central brand palette helpers derived from the app logo hues
// Use these to keep icon backgrounds and accent texts varied but on-brand.

export const brandGradients = [
  'from-fuchsia-600 to-rose-500',
  'from-indigo-600 to-violet-600',
  'from-amber-500 to-yellow-400',
  'from-cyan-600 to-emerald-600',
  'from-violet-600 to-fuchsia-600',
  'from-teal-500 to-cyan-500',
];

export const brandIconText = [
  'text-fuchsia-300',
  'text-indigo-300',
  'text-amber-300',
  'text-cyan-300',
  'text-violet-300',
  'text-emerald-300',
];

export function getBrandGradient(i = 0) {
  const arr = brandGradients;
  const idx = ((i % arr.length) + arr.length) % arr.length;
  return arr[idx];
}

export function getBrandText(i = 0) {
  const arr = brandIconText;
  const idx = ((i % arr.length) + arr.length) % arr.length;
  return arr[idx];
}
