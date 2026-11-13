"""Score a model on the held-out test. Usage: python run_eval.py MODEL [ADAPTER_DIR] [--show]"""
import json, re, sys, time
from mlx_lm import load, generate
from mlx_lm.sample_utils import make_sampler
from eval_set import all_items, norm
from build_data import SYSTEM


def ok(cat, answer, accepted):
    a = norm(answer)
    if cat == "math":
        parts = re.split(r"\s+or\s+|,\s*(?=[a-z]\s*=)", accepted[0])
        return all(norm(p) in a for p in parts)
    return any(norm(x) in a for x in accepted)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    model, tok = load(args[0], adapter_path=args[1] if len(args) > 1 else None)
    greedy = make_sampler(temp=0.0)
    score, n, t0, rows = {}, {}, time.time(), []
    for cat, q, acc in all_items():
        p = tok.apply_chat_template([{"role": "system", "content": SYSTEM}, {"role": "user", "content": q}], add_generation_prompt=True, tokenize=False)
        out = generate(model, tok, prompt=p, max_tokens=300, sampler=greedy)
        good = ok(cat, out, acc)
        score[cat] = score.get(cat, 0) + good; n[cat] = n.get(cat, 0) + 1
        rows.append({"cat": cat, "q": q, "out": out, "ok": good, "want": acc})
        if "--show" in sys.argv and not good:
            print(f"✗ [{cat}] {q}\n   want {acc}\n   got  {out[:300]!r}")
    tot = sum(score.values()); N = sum(n.values())
    print(json.dumps({"model": args[0], "adapter": args[1] if len(args) > 1 else None, **{c: f"{score[c]}/{n[c]}" for c in n}, "total": f"{tot}/{N} ({100 * tot / N:.0f}%)", "seconds": round(time.time() - t0)}))
    json.dump(rows, open(f"eval_{re.sub(r'[^A-Za-z0-9]+', '_', args[0] + '_' + (args[1] if len(args) > 1 else ''))[-60:]}.json", "w"), indent=1)


if __name__ == "__main__":
    main()
