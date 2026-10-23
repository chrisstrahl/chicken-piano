// The chicken mascot. Its feathers follow --ck-body/--ck-edge, so each player's chicken has their color.
import { avatarOf } from './profiles.js';
import type { Player } from './types';

const BODY = 'style="fill:var(--ck-body,#fff);stroke:var(--ck-edge,#eadcc6)"';
export const CHICKEN = `<svg class="chicken" viewBox="0 0 120 125" aria-hidden="true"><g class="ck-all"><g class="ck-body">
<circle cx="47" cy="29" r="8" fill="#ff4d4d"/><circle cx="60" cy="23" r="9.5" fill="#ff4d4d"/><circle cx="73" cy="29" r="8" fill="#ff4d4d"/>
<g class="ck-wl"><ellipse cx="22" cy="76" rx="11" ry="19" ${BODY} stroke-width="2.5"/></g>
<g class="ck-wr"><ellipse cx="98" cy="76" rx="11" ry="19" ${BODY} stroke-width="2.5"/></g>
<ellipse cx="60" cy="71" rx="40" ry="40" ${BODY} stroke-width="2.5"/>
<g class="ck-eyes"><circle cx="46" cy="58" r="6.5" fill="#2b1d0e"/><circle cx="74" cy="58" r="6.5" fill="#2b1d0e"/><circle cx="48.5" cy="55.5" r="2.2" fill="#fff"/><circle cx="76.5" cy="55.5" r="2.2" fill="#fff"/></g>
<circle cx="35" cy="72" r="6" fill="#ffb3c1" opacity=".8"/><circle cx="85" cy="72" r="6" fill="#ffb3c1" opacity=".8"/>
<path d="M51 66 L69 66 L60 79 Z" fill="#ffa31a" stroke="#e08600" stroke-width="2" stroke-linejoin="round"/>
<ellipse cx="60" cy="85" rx="4" ry="6" fill="#ff4d4d"/></g>
<g stroke="#ffa31a" stroke-width="4" stroke-linecap="round" fill="none"><path d="M48 109v10M48 119l-6 3M48 119l6 3M72 109v10M72 119l-6 3M72 119l6 3"/></g></g></svg>`;

// CSS for one player's colors (on an element, or on :root for the whole app)
export const lookOf = (p: Pick<Player, 'avatar'> | null | undefined): string => { const a = avatarOf(p); return `--ck-body:${a.body};--ck-edge:${a.edge}`; };
// a chicken in an avatar's colors, by avatar id
export const avatarChicken = (avatar: string, cls = ''): string => `<span class="av ${cls}" style="${lookOf({ avatar })}">${CHICKEN}</span>`;
