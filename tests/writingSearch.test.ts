import { describe, expect, it } from 'vitest';
import { fold, shows } from '../src/lib/writingSearch';

describe('fold', () => {
  it('lower-cases, drops accents and straightens curly quotes', () => {
    expect(fold('Why Risk Parity Isn’t “Equal” — Teïletche')).toBe('why risk parity isn\'t "equal" — teiletche');
  });
});

describe('shows', () => {
  const q = fold('Why risk parity isn’t equal weights Explainers');

  it('holds every card for an empty query and All', () => {
    expect(shows(q, 'explainers', '', 'all')).toBe(true);
    expect(shows(q, 'explainers', '   ', 'all')).toBe(true);
  });

  it('matches every word of the query as a substring, in any order and case', () => {
    expect(shows(q, 'explainers', 'PAR risk', 'all')).toBe(true);
    expect(shows(q, 'explainers', "isn't", 'all')).toBe(true);
    expect(shows(q, 'explainers', 'risk budget', 'all')).toBe(false);
  });

  it('holds only the chosen kind', () => {
    expect(shows(q, 'explainers', 'risk', 'explainers')).toBe(true);
    expect(shows(q, 'explainers', 'risk', 'notes')).toBe(false);
  });
});
