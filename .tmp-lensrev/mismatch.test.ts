import { describe, it } from 'vitest';
import { loadings, fanBeams } from '../src/lib/factorModel';
import { SIGNAL_WEIGHTS } from '../src/data/signalWeights';

describe('does beam geometry match the displayed beta?', () => {
  it('prints both', () => {
    const evidence = loadings(SIGNAL_WEIGHTS.signals);
    const count = loadings(null);
    const beams = fanBeams();
    console.log('factor      beta(shown, evidence)  beta(baked into beam)  length  halfWidth');
    for (const b of beams) {
      const shown = evidence.find((l) => l.factor.key === b.factor.key)!.beta;
      const cnt = count.find((l) => l.factor.key === b.factor.key)!.beta;
      console.log(
        b.factor.key.padEnd(11),
        shown.toFixed(3).padEnd(22),
        b.beta.toFixed(3) + ' (count=' + cnt.toFixed(3) + ')',
        b.length.toFixed(3),
        b.halfWidth.toFixed(3),
      );
    }
    console.log('\nazimuth order (screen left->right) with the beta printed on each label:');
    for (const b of [...beams].sort((a, c) => a.azimuth - c.azimuth)) {
      const shown = evidence.find((l) => l.factor.key === b.factor.key)!.beta;
      console.log(
        '  az ' + ((b.azimuth * 180) / Math.PI).toFixed(0).padStart(5),
        b.factor.key.padEnd(11),
        'label says beta ' + shown.toFixed(3),
        '| beam sized by ' + b.beta.toFixed(3),
      );
    }
  });
});
