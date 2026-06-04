import { dep } from './dep';
import { other } from './nested/other';

export const lazy = () => import('./dep');

export { dep, other };
