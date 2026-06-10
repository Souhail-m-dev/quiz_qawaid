import React from 'react';

// Icônes SVG légères (stroke currentColor) pour les contrôles d'édition.
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const IconUp = (p) => (<svg {...base} {...p}><path d="M18 15l-6-6-6 6" /></svg>);
export const IconDown = (p) => (<svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>);
export const IconEdit = (p) => (<svg {...base} {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
export const IconClose = (p) => (<svg {...base} {...p}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>);
export const IconPlus = (p) => (<svg {...base} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></svg>);
export const IconTrash = (p) => (<svg {...base} {...p}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>);
