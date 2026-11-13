"""Algebra 2 practice problems with exact, computed answers (no model involved).
Each item: {"q": question, "a": short worked answer ending in the final answer, "final": checkable final}.
Usage: python gen_math.py N SEED > out.jsonl
"""
import json, math, random, sys
from fractions import Fraction as F


def fr(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


def sgn(n, first=False):
    n = F(n) if not isinstance(n, int) else n
    if isinstance(n, F):
        return f"- {fr(-n)}" if n < 0 else f"+ {fr(n)}"
    if first:
        return f"-{abs(n)}" if n < 0 else f"{n}"
    return f"- {abs(n)}" if n < 0 else f"+ {n}"


def lin(a, b, v="x"):
    """a*v + b as text."""
    s = ("" if a == 1 else "-" if a == -1 else str(a)) + v
    return s if b == 0 else f"{s} {sgn(b)}"


def poly2(a, b, c, v="x"):
    t = [("" if a == 1 else "-" if a == -1 else str(a)) + v + "^2"]
    if b:
        t.append(f"{'-' if b < 0 else '+'} {'' if abs(b) == 1 else abs(b)}{v}")
    if c:
        t.append(sgn(c))
    return " ".join(t)


R = random.Random()
nz = lambda lo, hi: R.choice([i for i in range(lo, hi + 1) if i != 0])


def linear():
    a, x = nz(-9, 9), R.randint(-12, 12)
    b = R.randint(-20, 20)
    c = a * x + b
    if R.random() < 0.4:  # variables on both sides
        d = nz(-6, 6)
        while d == a:
            d = nz(-6, 6)
        e = (a - d) * x + b
        q = f"Solve for x: {lin(a, b)} = {lin(d, e - 0) if e else lin(d, 0)}"
        return q, f"Move the x terms to one side: {lin(a - d, 0)} = {e - b}. Divide by {a - d}: x = {x}.", f"x = {x}"
    q = R.choice(["Solve for x: {}", "Solve {}", "What is x if {}?", "Find x: {}"]).format(f"{lin(a, b)} = {c}")
    step = "" if b == 0 else (f"Subtract {b} from both sides: " if b > 0 else f"Add {-b} to both sides: ") + f"{a}x = {c - b}. "
    return q, f"{step}Divide by {a}: x = {x}.", f"x = {x}"


def system2():
    x, y = R.randint(-8, 8), R.randint(-8, 8)
    while True:
        a, b, d, e = nz(-6, 6), nz(-6, 6), nz(-6, 6), nz(-6, 6)
        if a * e - b * d:
            break
    c, f = a * x + b * y, d * x + e * y
    q = f"Solve the system: {lin(a, 0)} {sgn(b)}y = {c} and {lin(d, 0)} {sgn(e)}y = {f}".replace("+ 1y", "+ y").replace("- 1y", "- y")
    return q, f"Use elimination or substitution. Checking: {a}({x}) + {b}({y}) = {c} and {d}({x}) + {e}({y}) = {f}. The solution is x = {x}, y = {y}.", f"x = {x}, y = {y}"


def quad_factor():
    r1, r2 = R.randint(-10, 10), R.randint(-10, 10)
    a = R.choice([1, 1, 1, 2, 3])
    b, c = -a * (r1 + r2), a * r1 * r2
    roots = sorted({r1, r2})
    rs = " or ".join(f"x = {r}" for r in roots)
    f = ("" if a == 1 else str(a)) + f"(x {sgn(-r1)})(x {sgn(-r2)})"
    f = f.replace("(x + 0)", "x").replace("(x - 0)", "x")
    q = R.choice(["Solve {} = 0", "Find the roots of {}", "Solve by factoring: {} = 0", "What are the zeros of f(x) = {}?"]).format(poly2(a, b, c))
    return q, f"Factor: {poly2(a, b, c)} = {f}. Set each factor to 0: {rs}.", rs


def quad_formula():
    a, b, c = nz(-4, 5), R.randint(-9, 9), R.randint(-9, 9)
    D = b * b - 4 * a * c
    if D > 0 and int(math.isqrt(D)) ** 2 == D:
        return quad_factor()
    q = f"Use the quadratic formula to solve {poly2(a, b, c)} = 0"
    if D == 0:
        r = fr(F(-b, 2 * a))
        return q, f"Discriminant b^2 - 4ac = {D}, so there is one repeated root: x = -b/(2a) = {r}.", f"x = {r}"
    k, m = 1, abs(D)
    for i in range(int(math.isqrt(m)), 1, -1):
        if m % (i * i) == 0:
            k, m = i, m // (i * i)
            break
    rad = (f"{k}" if k > 1 else "") + (f"√{m}" if m > 1 else "")
    g = math.gcd(math.gcd(abs(b), k), abs(2 * a))
    nb, nk, den = -b // g, k // g, 2 * a // g
    if den < 0:
        nb, den = -nb, -den
    rad = (f"{nk}" if nk > 1 else "") + (f"√{m}" if m > 1 else "")
    unit = "i" if D < 0 else ""
    rad = (f"{nk}" if nk > 1 else "") + unit + (f"√{m}" if m > 1 else "")
    top = f"{nb} ± {rad}" if nb else f"±{rad}"
    ans = f"x = ({top})/{den}" if den != 1 else f"x = {top}"
    kind = "two complex roots" if D < 0 else "two real roots"
    return q, f"a = {a}, b = {b}, c = {c}. Discriminant = b^2 - 4ac = {D}, so there are {kind}. x = (-b ± √(b^2 - 4ac))/(2a), so {ans}.", ans


def discriminant():
    a, b, c = nz(-5, 5), R.randint(-10, 10), R.randint(-10, 10)
    D = b * b - 4 * a * c
    k = "two real solutions" if D > 0 else "one real solution" if D == 0 else "no real solutions (two complex solutions)"
    return f"How many real solutions does {poly2(a, b, c)} = 0 have?", f"Discriminant = b^2 - 4ac = ({b})^2 - 4({a})({c}) = {D}. So it has {k}.", k


def vertex():
    a, h, k = nz(-4, 4), R.randint(-8, 8), R.randint(-10, 10)
    b, c = -2 * a * h, a * h * h + k
    opens = "up" if a > 0 else "down"
    return f"Find the vertex of y = {poly2(a, b, c)}", f"x = -b/(2a) = {-b}/({2 * a}) = {h}. y at x = {h} is {k}. The vertex is ({h}, {k}) and the parabola opens {opens}.", f"({h}, {k})"


def exponents():
    b = R.choice(["x", "a", "y"])
    m, n, p = R.randint(2, 9), R.randint(2, 9), R.randint(2, 5)
    t = R.randint(0, 3)
    if t == 0:
        return f"Simplify {b}^{m} · {b}^{n}", f"Same base: add the exponents. {b}^{m}·{b}^{n} = {b}^{m + n}.", f"{b}^{m + n}"
    if t == 1:
        return f"Simplify ({b}^{m})^{p}", f"Power of a power: multiply the exponents. ({b}^{m})^{p} = {b}^{m * p}.", f"{b}^{m * p}"
    if t == 2:
        e = m - n
        r = f"{b}^{e}" if e > 1 else b if e == 1 else "1" if e == 0 else f"1/{b}^{-e}" if e < -1 else f"1/{b}"
        return f"Simplify {b}^{m} / {b}^{n}", f"Same base: subtract the exponents. {b}^{m}/{b}^{n} = {b}^{e} = {r}.", r
    c = R.choice([4, 8, 9, 16, 27, 25, 32, 64, 81, 125])
    for root in (2, 3, 5, 4, 6):
        v = round(c ** (1 / root))
        if v ** root == c:
            break
    pw = R.choice([p_ for p_ in (1, 2, 3) if p_ % root]) if root <= 3 else 1
    val = v ** pw
    return f"Evaluate {c}^({pw}/{root})", f"{c}^(1/{root}) = {v}, then raise to the power {pw}: {v}^{pw} = {val}.", f"{val}"


def logs():
    t = R.randint(0, 3)
    base = R.choice([2, 3, 4, 5, 10])
    e = R.randint(-2, 5) if base < 5 else R.randint(-1, 4)
    v = F(base) ** e
    if t == 0:
        return f"Evaluate log base {base} of {fr(v)}", f"{base}^{e} = {fr(v)}, so log_{base}({fr(v)}) = {e}.", f"{e}"
    if t == 1:
        e = abs(e) or 2
        return f"Solve {base}^x = {base ** e}", f"Write {base ** e} as {base}^{e}. Same base, so x = {e}.", f"x = {e}"
    if t == 2:
        e = abs(e) or 2
        return f"Solve log_{base}(x) = {e}", f"Rewrite in exponential form: x = {base}^{e} = {base ** e}.", f"x = {base ** e}"
    a, b = R.randint(2, 9), R.randint(2, 9)
    return f"Write as a single logarithm: log({a}) + log({b})", f"Product rule: log(a) + log(b) = log(ab), so log({a}) + log({b}) = log({a * b}).", f"log({a * b})"


def functions():
    t = R.randint(0, 3)
    a, b, c = nz(-5, 5), R.randint(-9, 9), R.randint(-9, 9)
    x = R.randint(-5, 5)
    if t == 0:
        v = a * x * x + b * x + c
        return f"If f(x) = {poly2(a, b, c)}, find f({x})", f"Substitute x = {x}: {a}({x})^2 + {b}({x}) + {c} = {v}.", f"f({x}) = {v}"
    if t == 1:
        m, k = nz(-5, 5), R.randint(-9, 9)
        return f"If f(x) = {lin(a, b)} and g(x) = {lin(m, k)}, find f(g(x))", f"Replace x in f with g(x): {a}({lin(m, k)}) {sgn(b)} = {lin(a * m, a * k + b)}.", f"f(g(x)) = {lin(a * m, a * k + b)}"
    if t == 2:
        m, k = nz(-6, 6), R.randint(-10, 10)
        if m > 0:
            inv = (f"(x {sgn(-k)})/{m}" if k else f"x/{m}") if m != 1 else lin(1, -k)
        else:
            inv = (f"({k} - x)/{-m}" if k else f"-x/{-m}") if m != -1 else lin(-1, k)
        return f"Find the inverse of f(x) = {lin(m, k)}", f"Write y = {lin(m, k)}, swap x and y: x = {lin(m, k, 'y')}, solve for y: y = {inv}.", f"f⁻¹(x) = {inv}"
    x1, y1, x2 = R.randint(-6, 6), R.randint(-9, 9), R.randint(-6, 6)
    while x2 == x1:
        x2 = R.randint(-6, 6)
    y2 = R.randint(-9, 9)
    m = F(y2 - y1, x2 - x1)
    bb = F(y1) - m * x1
    eq = f"y = {fr(m)}x {sgn(fr(bb)) if bb else ''}".replace(" + -", " - ").strip()
    return f"Find the equation of the line through ({x1}, {y1}) and ({x2}, {y2})", f"Slope m = ({y2} - {y1})/({x2} - {x1}) = {fr(m)}. b = {y1} - ({fr(m)})({x1}) = {fr(bb)}. So {eq}.", eq


def absval_ineq():
    if R.random() < 0.5:
        a, b, c = nz(-5, 5), R.randint(-9, 9), R.randint(1, 15)
        r1, r2 = F(c - b, a), F(-c - b, a)
        lo, hi = sorted([r1, r2])
        return f"Solve |{lin(a, b)}| = {c}", f"{lin(a, b)} = {c} or {lin(a, b)} = -{c}. So x = {fr(lo)} or x = {fr(hi)}.", f"x = {fr(lo)} or x = {fr(hi)}"
    a, b, c = nz(-6, 6), R.randint(-10, 10), R.randint(-20, 20)
    op = R.choice(["<", ">", "≤", "≥"])
    flip = {"<": ">", ">": "<", "≤": "≥", "≥": "≤"}
    r = F(c - b, a)
    op2 = flip[op] if a < 0 else op
    note = " Dividing by a negative flips the sign." if a < 0 else ""
    return f"Solve {lin(a, b)} {op} {c}", f"{'Subtract ' + str(b) if b >= 0 else 'Add ' + str(-b)}: {a}x {op} {c - b}. Divide by {a}: x {op2} {fr(r)}.{note}", f"x {op2} {fr(r)}"


def radicals_complex():
    t = R.randint(0, 2)
    if t == 0:
        k, m = R.randint(2, 9), R.choice([2, 3, 5, 6, 7, 10])
        n = k * k * m
        return f"Simplify √{n}", f"{n} = {k * k} · {m}, and √{k * k} = {k}, so √{n} = {k}√{m}.", f"{k}√{m}"
    a, b, c, d = R.randint(-7, 7), R.randint(-7, 7), R.randint(-7, 7), R.randint(-7, 7)
    def cx(r, i):
        if i == 0:
            return f"{r}"
        ii = "i" if abs(i) == 1 else f"{abs(i)}i"
        return f"{r} {'+' if i > 0 else '-'} {ii}" if r else (f"-{ii}" if i < 0 else ii)
    if t == 1:
        r, i = a * c - b * d, a * d + b * c
        return f"Multiply ({cx(a, b)})({cx(c, d)})", f"FOIL: {a * c} {sgn(a * d)}i {sgn(b * c)}i {sgn(b * d)}i^2. Since i^2 = -1: {cx(r, i)}.", cx(r, i)
    return f"Simplify ({cx(a, b)}) + ({cx(c, d)})", f"Add real parts and imaginary parts: {cx(a + c, b + d)}.", cx(a + c, b + d)


def sequences():
    if R.random() < 0.5:
        a1, d, n = R.randint(-10, 15), nz(-6, 8), R.randint(5, 40)
        seq = ", ".join(str(a1 + i * d) for i in range(4))
        v = a1 + (n - 1) * d
        return f"Find the {n}th term of the arithmetic sequence {seq}, …", f"a1 = {a1}, d = {d}. a_n = a1 + (n - 1)d = {a1} + ({n - 1})({d}) = {v}.", f"{v}"
    a1, r, n = R.randint(1, 6), R.choice([2, 3, -2, 4]), R.randint(4, 9)
    seq = ", ".join(str(a1 * r ** i) for i in range(4))
    v = a1 * r ** (n - 1)
    return f"Find the {n}th term of the geometric sequence {seq}, …", f"a1 = {a1}, r = {r}. a_n = a1 · r^(n - 1) = {a1} · {r}^{n - 1} = {v}.", f"{v}"


def word():
    t = R.randint(0, 2)
    if t == 0:
        p, r, y = R.choice([500, 1000, 1200, 2000, 5000]), R.choice([2, 3, 4, 5, 6, 8]), R.randint(2, 10)
        v = p * (1 + r / 100) ** y
        return f"${p} is invested at {r}% interest compounded yearly. How much is it worth after {y} years?", f"A = P(1 + r)^t = {p}(1.{r:02d})^{y} ≈ ${v:,.2f}.", f"${v:,.2f}"
    if t == 1:
        n0, k, h = R.choice([100, 200, 500, 50]), R.choice([2, 3]), R.randint(2, 6)
        word_ = "doubles" if k == 2 else "triples"
        return f"A population of {n0} bacteria {word_} every hour. How many are there after {h} hours?", f"N = {n0} · {k}^{h} = {n0 * k ** h}.", f"{n0 * k ** h}"
    w = R.randint(2, 12)
    l = w + R.randint(1, 8)
    return f"A rectangle's length is {l - w} more than its width, and its area is {l * w}. Find the width.", f"w(w + {l - w}) = {l * w}, so w^2 + {l - w}w - {l * w} = 0. Factor: (w - {w})(w + {l}) = 0. Width can't be negative, so w = {w}.", f"{w}"


GENS = [linear, linear, system2, quad_factor, quad_factor, quad_formula, discriminant, vertex, exponents, logs, logs,
        functions, functions, absval_ineq, radicals_complex, sequences, word]

if __name__ == "__main__":
    n, seed = int(sys.argv[1]), int(sys.argv[2])
    R.seed(seed)
    seen = set()
    while len(seen) < n:
        q, a, f = R.choice(GENS)()
        if q in seen:
            continue
        seen.add(q)
        print(json.dumps({"q": q, "a": a + ("" if a.rstrip().endswith(f + ".") or f in a.split(". ")[-1] else f" Answer: {f}."), "final": f, "cat": "math"}, ensure_ascii=False))
