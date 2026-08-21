# -*- coding: utf-8 -*-
"""Round-5 execution test: prototype census kernel + named regression tests + census-data audit."""
import json, re, io, sys, math, glob
from fractions import Fraction as Fr
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DIMS = ['M', 'L', 'T', 'Th', 'I']

# ---------- exact linear algebra over Q ----------
def rank_and_nullspace(rows):
    """rows: list of 5-vectors (Fractions). Returns (rank, nullspace basis of the ROW-combination space:
    vectors alpha with sum_i alpha_i * rows[i] = 0)."""
    n = len(rows)
    # augment with identity to track combinations
    aug = [list(r) + [Fr(int(i == j)) for j in range(n)] for i, r in enumerate(rows)]
    piv_col, rank = 0, 0
    ncols = 5
    for col in range(ncols):
        piv = None
        for r in range(rank, n):
            if aug[r][col] != 0:
                piv = r; break
        if piv is None: continue
        aug[rank], aug[piv] = aug[piv], aug[rank]
        pv = aug[rank][col]
        aug[rank] = [x / pv for x in aug[rank]]
        for r in range(n):
            if r != rank and aug[r][col] != 0:
                f = aug[r][col]
                aug[r] = [a - f * b for a, b in zip(aug[r], aug[rank])]
        rank += 1
    null = [row[5:] for row in aug[rank:]]  # rows whose dim-part is now zero
    return rank, null

def residual_invariants(rows):
    """directions in dimension space NOT spanned by rows (basis of the quotient) — via rank of rows^T."""
    # column space of rows = span; residual rank = 5 - rank
    r, _ = rank_and_nullspace(rows)
    return 5 - r

def solve_restoration(gens, target):
    """solve sum_j x_j * gens[j] = target exactly; return dict or None (inconsistent) or 'nonunique'."""
    n = len(gens)
    A = [[gens[j][i] for j in range(n)] + [target[i]] for i in range(5)]  # 5 x (n+1)
    rank = 0
    pivots = []
    for col in range(n):
        piv = None
        for r in range(rank, 5):
            if A[r][col] != 0: piv = r; break
        if piv is None: continue
        A[rank], A[piv] = A[piv], A[rank]
        pv = A[rank][col]
        A[rank] = [x / pv for x in A[rank]]
        for r in range(5):
            if r != rank and A[r][col] != 0:
                f = A[r][col]
                A[r] = [a - f * b for a, b in zip(A[r], A[rank])]
        pivots.append(col); rank += 1
    for r in range(rank, 5):
        if A[r][n] != 0: return None  # inconsistent
    if rank < n: return 'nonunique'
    x = [Fr(0)] * n
    for i, col in enumerate(pivots): x[i] = A[i][n]
    return x

def validate_convention(named):
    """named: list of (symbol, 5-vector). Returns verdict string."""
    rows = [v for _, v in named]
    r, null = rank_and_nullspace(rows)
    n = len(rows)
    res = 5 - r
    if n > r:
        combos = []
        for vec in null:
            parts = []
            for (sym, _), a in zip(named, vec):
                if a != 0:
                    e = f"^{a}" if a != 1 else ""
                    parts.append(f"{sym}{e}")
            combos.append("·".join(parts) + " = 1")
        return f"OVER-DETERMINED (n={n}, rank={r}): implied dimensionless group(s): {'; '.join(combos)}"
    return f"well-posed sector (n={n} = rank), residual dimension rank {res}"

def V(*a): return [Fr(x) for x in a]

# canonical dimensions (M, L, T, Θ, I), SI basis
D = {
 'c': V(0,1,-1,0,0), 'G': V(-1,3,-2,0,0), 'hbar': V(1,2,-1,0,0), 'h': V(1,2,-1,0,0),
 'kB': V(1,2,-2,-1,0), 'eps0': V(-1,-3,4,0,2), 'mu0': V(1,1,-2,0,-2), 'e': V(0,0,1,0,1),
 'me': V(1,0,0,0,0), 'E_SI': V(1,1,-3,0,-1), 'B_SI': V(1,0,-2,0,-1),
 't_hop': V(1,2,-2,0,0), 'J_ex': V(1,2,-2,0,0), 'a_lat': V(0,1,0,0,0),
 'L_scale': V(0,1,0,0,0), 'U_vel': V(0,1,-1,0,0), 'nu_visc': V(0,2,-1,0,0), 'hc': V(1,3,-1,0,0),
}

print("=" * 78); print("A. NAMED REGRESSION TESTS (census §10.3 + §2.3 + §2.4)"); print("=" * 78)
results = []
def check(name, cond, detail=""):
    results.append((name, cond))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))

# T1: rank checks catch published ill-posed declarations
v = validate_convention([('t', D['t_hop']), ('J', D['J_ex'])])
check("{t, J} rejected as over-determined, group NAMED", "OVER-DETERMINED" in v and "t" in v and "J" in v, v)
v = validate_convention([('hbar', D['hbar']), ('k_B', D['kB']), ('a', D['a_lat']), ('e', D['e'])])
check("{ħ,k_B,a,e} = well-posed n=rank but residual rank 1 (missing energy scale)", "residual dimension rank 1" in v, v)
v = validate_convention([('L', D['L_scale']), ('U', D['U_vel']), ('nu', D['nu_visc'])])
check("{L,U,ν} over-determined, implied group ≅ Re", "OVER-DETERMINED" in v, v)
# T2: residual-rank ladder (census §2.13/rank bookkeeping)
for gens, expect, label in [
    ([D['c']], 4, "c=1 → residual 4"),
    ([D['hbar'], D['c']], 3, "ħ=c=1 → residual 3"),
    ([D['hbar'], D['c'], D['eps0'], D['kB']], 1, "ħ=c=ε₀=k_B=1 → residual 1 (mass dim)"),
    ([D['hbar'], D['c'], D['eps0'], D['kB'], D['G']], 0, "+G → residual 0 (checking vacuous)"),
]:
    check(f"rank ladder: {label}", residual_invariants(gens) == expect)
# T3: span rule — light wave E=cB
x = solve_restoration([D['c']], [a - b for a, b in zip(D['E_SI'], D['B_SI'])])
check("light-wave [E]/[B] restores c^1 when c is a generator (span rule)", x == [Fr(1)], f"x={x}")
x = solve_restoration([[a * 1 for a in D['eps0']]], [a - b for a, b in zip(D['E_SI'], D['B_SI'])])
check("same restoration with ONLY 4πε₀ generator → INCONSISTENT (decline, hint hidden c)", x is None)
# T4: uniqueness theorem — c^a G^b never dimensionless
r, null = rank_and_nullspace([D['c'], D['G']])
check("c,G independent (uniqueness theorem)", r == 2 and not null)
r, _ = rank_and_nullspace([D['c'], D['G'], D['hbar']])
check("c,G,ħ independent (Planck restoration unique)", r == 3)
r, null = rank_and_nullspace([D['hc'], D['h'], D['hbar'], D['kB']])
check("{hc,h,ħ,k_B} DEPENDENT (census §2.9: converter graph, not a basis)", r < 4, f"rank={r}")
# T5: numeric regressions
mu0 = 4 * math.pi * 1e-7
factor = math.sqrt(4 * math.pi / mu0) * (1000 ** 0.5) * (100 ** -0.5)   # + g·cm base conversion
check("1 T = 10⁴ G including kg·m→g·cm base conversion", abs(factor - 1e4) / 1e4 < 1e-12, f"{factor:.6f}")
factor_nobase = math.sqrt(4 * math.pi / mu0)
check("…and SKIPPING base conversion errs by ~3.16 (the census's warned trap)", abs(factor_nobase / 1e4 - 0.31622776) < 1e-6, f"{factor_nobase:.1f}")
eps0 = 8.8541878128e-12; cval = 2.99792458e8
check("μ_unrat·ε_unrat = 1/c²", abs((mu0 / (4 * math.pi)) * (4 * math.pi * eps0) - 1 / cval ** 2) / (1 / cval ** 2) < 1e-9)

print(); print("=" * 78); print("B. CENSUS-DATA AUDIT: parse + rank-check all recorded generator sets"); print("=" * 78)
def parse_dim(s):
    if not isinstance(s, str): return None
    m = re.search(r'\(([^)]*)\)', s)
    if not m: return None
    parts = [p.strip() for p in m.group(1).split(',')]
    if len(parts) < 3 or len(parts) > 6: return None
    out = []
    for p in parts[:5]:
        p = p.replace('−', '-').replace('–', '-')
        try:
            if '/' in p: out.append(Fr(p))
            else: out.append(Fr(str(float(p)).rstrip('0').rstrip('.')) if '.' in p else Fr(int(p)))
        except Exception: return None
    while len(out) < 5: out.append(Fr(0))
    return out

FAMS = ['si-cgs-em', 'hep-natural', 'gr-cosmo-astro', 'atomic-cm', 'historical-engineering', 'nondimensionalization']
tot = parsed_ok = 0
unparseable, dependent, overdet = [], [], []
for fam in FAMS:
    e = json.load(open(f"{fam}.enum.json", encoding='utf-8'))
    for s in e['systems']:
        gens = s['generators']
        if not gens: continue
        named, bad = [], []
        for g in gens:
            d = parse_dim(g.get('dimension', ''))
            tot += 1
            if d is None: bad.append(g['tex'][:40]); continue
            parsed_ok += 1
            named.append((g['tex'][:25], d))
        if bad:
            unparseable.append((fam, s['name'][:50], bad))
        if len(named) >= 2:
            r, null = rank_and_nullspace([v for _, v in named])
            if r < len(named):
                note = s.get('notes', '') + ' ' + str(s.get('name', ''))
                flagged = ('rank' in note.lower() or 'independen' in note.lower() or 'symmetry' in note.lower()
                           or 'converter' in note.lower() or 'not a' in note.lower())
                (dependent if not flagged else overdet).append((fam, s['name'][:55], len(named), r))
print(f"generator dimension fields: {tot} total, {parsed_ok} parsed ({100*parsed_ok/max(tot,1):.0f}%), {tot-parsed_ok} unparseable")
print(f"\nUNPARSEABLE ({len(unparseable)} systems):")
for fam, name, bad in unparseable[:12]:
    print(f"  {fam:22s} {name:52s} {bad}")
if len(unparseable) > 12: print(f"  … and {len(unparseable)-12} more")
print(f"\nDEPENDENT GENERATOR SETS *not* flagged in their own row notes ({len(dependent)}):")
for fam, name, n, r in dependent: print(f"  {fam:22s} {name:55s} n={n} rank={r}")
print(f"\nDependent but self-flagged (expected, e.g. converter-graph rows) ({len(overdet)}):")
for fam, name, n, r in overdet: print(f"  {fam:22s} {name:55s} n={n} rank={r}")

npass = sum(1 for _, c in results if c)
print(); print("=" * 78)
print(f"NAMED TESTS: {npass}/{len(results)} pass | data audit above is the finding, not a pass/fail")
