"""Structural tests for the synthetic generator.  python3 -I -m unittest synth.test_synth   (needs MIKAJY_ASSETS/fonts/*.ttf)"""
import os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from synth.glyphs import GlyphBank
from synth.session import make_sample
from synth import layout as L, gen as G

FONTS = os.path.join(os.environ.get('MIKAJY_ASSETS', '/tmp'), 'fonts')


@unittest.skipUnless(os.path.isdir(FONTS), 'fonts not downloaded (training/fetch_assets.sh)')
class Synth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bank = GlyphBank(FONTS)
        cls.samples = []
        rng = np.random.default_rng(7)
        while len(cls.samples) < 150:
            s = make_sample(rng, cls.bank)
            if s: cls.samples.append(s)

    def test_strokes_and_time_are_sane(self):
        for s in self.samples:
            last_start = -1
            for st in s['strokes']:
                p = np.array(st['pts'])
                self.assertTrue(np.isfinite(p).all())
                self.assertTrue((np.diff(p[:, 2]) >= 0).all())
                self.assertGreaterEqual(p[0, 2], last_start)           # strokes are listed in the order they were written
                last_start = p[0, 2]

    def test_every_symbol_has_strokes_and_a_box(self):
        for s in self.samples:
            for sy in s['symbols']:
                self.assertTrue(sy['strokes'] and all(0 <= i < len(s['strokes']) for i in sy['strokes']))
                b = sy['bbox']; self.assertTrue(b[2] >= b[0] and b[3] >= b[1])

    def test_latex_is_balanced_and_nonempty(self):
        for s in self.samples:
            for t in s['latex']:
                self.assertTrue(t.strip()); self.assertEqual(t.count('{'), t.count('}'))

    def test_fraction_geometry(self):
        n = 0
        for s in self.samples:
            if not any(y['role'] == 'fracbar' for y in s['symbols']): continue
            for bar in [y for y in s['symbols'] if y['role'] == 'fracbar']:
                par = bar['path'].rsplit('bar', 1)[0]
                nums = [y for y in s['symbols'] if y['path'].startswith(par + 'num') and y['line'] == bar['line']]
                dens = [y for y in s['symbols'] if y['path'].startswith(par + 'den') and y['line'] == bar['line']]
                if nums and dens:
                    n += 1
                    self.assertLess(np.mean([y['bbox'][3] for y in nums]), np.mean([y['bbox'][1] for y in dens]))
        self.assertGreater(n, 5)

    def test_exponents_sit_higher_than_their_base(self):
        n = 0
        for s in self.samples:
            for sup in [y for y in s['symbols'] if y['role'] == 'sup']:
                par = sup['path'].rsplit('exp', 1)[0]
                base = [y for y in s['symbols'] if y['path'].startswith(par + 'base') and y['line'] == sup['line']]
                if base:
                    n += 1
                    self.assertLess((sup['bbox'][1] + sup['bbox'][3]) / 2, np.mean([(y['bbox'][1] + y['bbox'][3]) / 2 for y in base]) + 1e-6)
        self.assertGreater(n, 5)

    def test_late_additions_are_written_last(self):
        n = 0
        for s in self.samples:
            late = [y for y in s['symbols'] if y['late']]
            if not late: continue
            for ln in {y['line'] for y in late}:
                others = [y for y in s['symbols'] if not y['late'] and y['line'] == ln]
                if others:
                    n += 1
                    self.assertGreater(min(i for y in late if y['line'] == ln for i in y['strokes']),
                                       min(i for y in others for i in y['strokes']))
        self.assertGreater(n, 5)

    def test_extend_has_two_stages(self):
        ext = [s for s in self.samples if s['behaviour'] == 'extend']
        self.assertTrue(ext)
        for s in ext:
            self.assertEqual(len(s['stages']), 2); self.assertLess(len(s['stages'][0]), len(s['stages'][1]))

    def test_styles_and_domains_are_diverse(self):
        self.assertGreaterEqual(len({s['writer']['mode'] for s in self.samples}), 3)
        sl = [s['writer']['slant'] for s in self.samples]
        self.assertGreater(max(sl) - min(sl), .5)
        self.assertGreaterEqual(len({s['domain'] for s in self.samples}), 8)
        self.assertGreaterEqual(len({f for s in self.samples for f in s['writer']['fonts']}), 10)
        self.assertGreater(len({s['behaviour'] for s in self.samples}), 3)

    def test_reproducible(self):
        a = make_sample(np.random.default_rng(5), self.bank, 'fraction', 'plain')
        b = make_sample(np.random.default_rng(5), self.bank, 'fraction', 'plain')
        self.assertEqual(a, b)

    def test_every_domain_makes_valid_latex(self):
        rng = np.random.default_rng(1)
        for d in G.DOMAINS:
            self.assertTrue(L.latex(G.Gen(rng).make(d)))


if __name__ == '__main__':
    unittest.main()
