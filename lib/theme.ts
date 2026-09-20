import type { CSSProperties } from 'react';

export function teamTheme(color?: string): CSSProperties {
  const raw = color?.trim().replace(/^#/, '') ?? '';
  const hex = /^[\da-f]{6}$/i.test(raw) ? raw : /^[\da-f]{3}$/i.test(raw) ? raw.split('').map(c => c + c).join('') : '124b3b';
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (channels: number[]) => channels.map(v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const mix = (amount: number) => `rgb(${rgb.map(v => Math.round(v + (255 - v) * amount)).join(', ')})`;
  // Keep the exact primary on large surfaces, but darken text accents for light team colors.
  let accent = [...rgb];
  while (luminance(accent) > 0.14) accent = accent.map(v => Math.floor(v * 0.9));
  const onPrimary = luminance(rgb) > 0.179 ? '#000000' : '#ffffff';
  return {
    '--team-primary': `#${hex}`,
    '--team-on-primary': onPrimary,
    '--green': `rgb(${accent.join(', ')})`,
    '--team-tint': mix(0.94),
    '--paper': mix(0.975),
    '--lime': onPrimary,
  } as CSSProperties;
}
