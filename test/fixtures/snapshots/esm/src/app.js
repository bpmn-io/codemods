import { dep } from './dep.js';
import { other } from './nested/other.js';

export const lazy = () => import('./dep.js');

export { dep, other };
