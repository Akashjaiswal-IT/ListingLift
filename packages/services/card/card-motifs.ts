import type { FestivalId } from "./card-design";

/**
 * One emblem per festival, drawn flat in a 200×200 box centred on (0,0).
 * Layouts place a single emblem; the card never stacks several decorations.
 */

function marigold(cx: number, cy: number, r: number, outer: string, inner: string): string {
  const petals = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return `<circle cx="${(cx + Math.cos(a) * r * 0.62).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.62).toFixed(1)}" r="${(r * 0.42).toFixed(1)}" fill="${outer}"/>`;
  }).join("");
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${(r * 0.55).toFixed(1)}" fill="${inner}"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.22).toFixed(1)}" fill="${outer}" opacity="0.8"/>`;
}

const EMBLEMS: Record<FestivalId, (accent: string) => string> = {
  diwali: (gold) => `
    <circle cx="0" cy="-38" r="52" fill="${gold}" opacity="0.16"/>
    <path d="M0,-92 C18,-62 24,-44 0,-22 C-24,-44 -18,-62 0,-92 Z" fill="#F7B733"/>
    <path d="M0,-70 C9,-54 11,-44 0,-32 C-11,-44 -9,-54 0,-70 Z" fill="#FFF1C2"/>
    <path d="M-78,-14 C-70,40 70,40 78,-14 Z" fill="#B4532A"/>
    <path d="M-78,-14 L78,-14 L70,-4 L-70,-4 Z" fill="${gold}"/>
    <path d="M-48,14 C-30,26 30,26 48,14" fill="none" stroke="${gold}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
    <ellipse cx="0" cy="44" rx="40" ry="6" fill="#000" opacity="0.18"/>`,
  dussehra: (gold) => `
    <path d="M-58,-82 Q40,0 -58,82" fill="none" stroke="${gold}" stroke-width="9" stroke-linecap="round"/>
    <line x1="-58" y1="-82" x2="-58" y2="82" stroke="#F7E3C4" stroke-width="3"/>
    <line x1="-74" y1="0" x2="70" y2="0" stroke="#F7E3C4" stroke-width="6" stroke-linecap="round"/>
    <path d="M70,0 L50,-12 L50,12 Z" fill="${gold}"/>
    <path d="M-74,0 L-90,-12 M-74,0 L-90,12" stroke="${gold}" stroke-width="5" stroke-linecap="round"/>`,
  // Garbo: the perforated clay pot with a lamp, central to Navratri garba.
  navratri: (gold) => `
    <circle cx="0" cy="-70" r="30" fill="${gold}" opacity="0.18"/>
    <path d="M0,-96 C12,-80 14,-70 0,-58 C-14,-70 -12,-80 0,-96 Z" fill="#F7B733"/>
    <rect x="-22" y="-58" width="44" height="16" rx="4" fill="${gold}"/>
    <path d="M-26,-42 C-84,-30 -86,70 0,82 C86,70 84,-30 26,-42 Z" fill="#C2541E"/>
    <path d="M-62,6 C-30,16 30,16 62,6" fill="none" stroke="${gold}" stroke-width="5" stroke-linecap="round"/>
    ${[-40, -20, 0, 20, 40].map((x) => `<circle cx="${x}" cy="-12" r="5" fill="#FFE29A"/>`).join("")}
    ${[-30, -10, 10, 30].map((x) => `<circle cx="${x}" cy="34" r="5" fill="#FFE29A"/>`).join("")}
    ${[-20, 0, 20].map((x) => `<circle cx="${x}" cy="58" r="4.5" fill="#FFE29A"/>`).join("")}`,
  "durga-puja": (red) => `
    ${Array.from({ length: 8 }, (_, i) => `<path d="M0,-12 C26,-34 22,-78 0,-92 C-22,-78 -26,-34 0,-12 Z" fill="${i % 2 ? "#F4C7C3" : red}" transform="rotate(${i * 45})"/>`).join("")}
    <circle cx="0" cy="0" r="22" fill="#F2B233"/><circle cx="0" cy="0" r="9" fill="${red}"/>`,
  holi: () => `
    <circle cx="-30" cy="-18" r="46" fill="#E0457B" opacity="0.9"/>
    <circle cx="30" cy="-24" r="40" fill="#F7B733" opacity="0.9"/>
    <circle cx="4" cy="30" r="44" fill="#2BB39A" opacity="0.88"/>
    <circle cx="-62" cy="44" r="9" fill="#7A5AF8"/><circle cx="66" cy="34" r="7" fill="#E0457B"/><circle cx="58" cy="-70" r="6" fill="#2BB39A"/>`,
  // Crescent = circle r80 at (0,0) minus circle r68 at (30,0); arcs meet at (44.6, ±66.4).
  eid: (gold) => `
    <g transform="translate(-16,0)">
      <path d="M44.6,-66.4 A80,80 0 1,0 44.6,66.4 A68,68 0 1,1 44.6,-66.4 Z" fill="${gold}"/>
      <path d="M66,-30 L72,-12 L91,-12 L76,-1 L82,17 L66,6 L50,17 L56,-1 L41,-12 L60,-12 Z" fill="${gold}"/>
    </g>`,
  onam: (gold) => `
    <circle cx="0" cy="0" r="92" fill="#F08A24"/>
    <circle cx="0" cy="0" r="72" fill="#F7C531"/>
    <circle cx="0" cy="0" r="52" fill="#D9412B"/>
    <circle cx="0" cy="0" r="34" fill="#FFF8E7"/>
    ${Array.from({ length: 8 }, (_, i) => `<path d="M0,-30 C10,-18 10,-8 0,0 C-10,-8 -10,-18 0,-30 Z" fill="#7FB341" transform="rotate(${i * 45})"/>`).join("")}
    <circle cx="0" cy="0" r="92" fill="none" stroke="${gold}" stroke-width="4"/>`,
  pongal: (rust) => `
    <path d="M-40,-60 C-60,-82 -20,-96 0,-80 C20,-96 60,-82 40,-60 Z" fill="#FFFFFF" stroke="${rust}" stroke-width="4"/>
    <path d="M-62,-56 L62,-56 L54,-44 L-54,-44 Z" fill="${rust}"/>
    <path d="M-56,-44 C-82,10 -50,74 0,74 C50,74 82,10 56,-44 Z" fill="${rust}"/>
    <path d="M-58,4 C-20,18 20,18 58,4" fill="none" stroke="#F7C531" stroke-width="6" stroke-linecap="round"/>
    <rect x="72" y="-92" width="10" height="170" rx="5" fill="#6E8B3D"/><rect x="72" y="-30" width="10" height="5" fill="#3E5622"/><rect x="72" y="30" width="10" height="5" fill="#3E5622"/>`,
  rakhi: (pink) => `
    <path d="M-96,0 C-60,-10 -40,-10 -26,0 M26,0 C40,-10 60,-10 96,0" fill="none" stroke="#F2B233" stroke-width="7" stroke-linecap="round"/>
    ${Array.from({ length: 10 }, (_, i) => `<path d="M0,-14 C14,-26 14,-46 0,-56 C-14,-46 -14,-26 0,-14 Z" fill="${i % 2 ? "#F7B6CC" : pink}" transform="rotate(${i * 36})"/>`).join("")}
    <circle cx="0" cy="0" r="18" fill="#F2B233"/><circle cx="0" cy="0" r="7" fill="${pink}"/>`,
  christmas: (gold) => `
    <circle cx="0" cy="0" r="60" fill="${gold}" opacity="0.14"/>
    <path d="M0,-86 L20,-28 L82,-28 L32,8 L50,68 L0,32 L-50,68 L-32,8 L-82,-28 L-20,-28 Z" fill="${gold}"/>
    <path d="M64,-74 L68,-62 L80,-58 L68,-54 L64,-42 L60,-54 L48,-58 L60,-62 Z" fill="#F3F1E8"/>`,
  wedding: (gold) => `
    <path d="M-92,-70 Q0,-30 92,-70" fill="none" stroke="${gold}" stroke-width="4"/>
    ${marigold(-56, -24, 30, "#F08A24", "#F7C531")}
    ${marigold(0, -6, 36, "#F7B733", "#F08A24")}
    ${marigold(56, -24, 30, "#F08A24", "#F7C531")}
    <path d="M-20,32 C-30,60 -10,84 0,92 C10,84 30,60 20,32 Z" fill="#4E8A3A"/>`,
};

/** SVG fragment of the festival emblem, centred at (cx, cy), `size` px across. */
export function festivalEmblem(festival: FestivalId, cx: number, cy: number, size: number, accent: string): string {
  const scale = (size / 200).toFixed(3);
  return `<g transform="translate(${cx}, ${cy}) scale(${scale})">${EMBLEMS[festival](accent)}</g>`;
}

/** Small generic chat icon (not a brand logo) shown next to the seller's WhatsApp number. */
export function chatIcon(x: number, y: number, size: number, color: string): string {
  const s = (size / 24).toFixed(3);
  return `<g transform="translate(${x}, ${y}) scale(${s})"><path d="M12 2C6.5 2 2 6 2 11c0 2.4 1 4.6 2.8 6.2L4 22l4.4-2.2c1.1.4 2.3.6 3.6.6 5.5 0 10-4 10-9S17.5 2 12 2z" fill="${color}"/><path d="M8.6 9.2c.3 1.8 2.4 4.3 4.6 5 .6.2 1.3-.2 1.6-.8l.3-.6c.1-.3 0-.6-.3-.7l-1.2-.6c-.3-.1-.6 0-.7.2l-.3.4c-.9-.4-1.8-1.3-2.2-2.2l.4-.3c.2-.2.3-.5.2-.7l-.6-1.2c-.1-.3-.4-.4-.7-.3l-.6.3c-.4.3-.6.9-.5 1.5z" fill="#FFFFFF"/></g>`;
}

/** Small check mark used inside trust badges. */
export function checkIcon(x: number, y: number, size: number, color: string, checkColor = "#FFFFFF"): string {
  const s = (size / 24).toFixed(3);
  return `<g transform="translate(${x}, ${y}) scale(${s})"><circle cx="12" cy="12" r="11" fill="${color}"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="${checkColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
