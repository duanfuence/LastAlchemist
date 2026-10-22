import type { ElementArt } from '../lib';
import { dust } from './dust';
import { fire } from './fire';
import { homunculus } from './homunculus';
import { water } from './water';

/** Иллюстрации новой серии. Остальные элементы пока используют прежние SVG из assets/elements. */
export const ELEMENT_ART: readonly ElementArt[] = [water, fire, dust, homunculus];
