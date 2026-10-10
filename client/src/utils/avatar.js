// client/src/utils/avatar.js
export function generateAvatar(seed) {
  // Gera uma cor consistente baseada na string seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const s = 60 + (Math.abs(hash) % 20); // 60-80%
  const l = 45 + (Math.abs(hash) % 15); // 45-60%
  const color = `hsl(${h}, ${s}%, ${l}%)`;
  
  // Pegamos as iniciais
  const parts = seed.split(/[\s_-]+/);
  let initials = '?';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts[0] && parts[0].length >= 2) {
    initials = parts[0].substring(0, 2).toUpperCase();
  } else if (parts[0]) {
    initials = parts[0].substring(0, 1).toUpperCase();
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${color}" />
      <text x="50" y="50" font-family="sans-serif" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">
        ${initials}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
