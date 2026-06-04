import { getParents } from 'diagram-js/lib/util/Elements';
import { help } from './helper';
import { gone } from './does-not-exist';
import Diagram from 'diagram-js';
import './style.css';

export const lazy = () => import('./helper');

export { getParents, help, gone, Diagram };
