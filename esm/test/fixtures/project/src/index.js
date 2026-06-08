import { getParents } from 'diagram-js/lib/util/Elements';
import { help } from './helper';
import { gone } from './does-not-exist';
import { nope } from 'diagram-js/lib/does-not-exist';
import coreModule from 'diagram-js/lib/core';
import Diagram from 'diagram-js';
import './style.css';
import { libHelper } from './lib';

export const lazy = () => import('./helper');

export { getParents, help, gone, nope, coreModule, Diagram, libHelper };
