"""Score a model on the held-out test. Usage: python run_eval.py MODEL [ADAPTER_DIR] [--show] [--only reading]"""
import json, re, sys, time
from mlx_lm import load, generate
from mlx_lm.sample_utils import make_sampler
from eval_set import all_items, norm
from build_data import SYSTEM, SCREEN_SYS
from eval_reading import reading_items


def ok(cat, answer, accepted):
    a = norm(answer)
    if cat == "math":
        parts = re.split(r"\s+or\s+|,\s*(?=[a-z]\s*=)", accepted[0])
        return all(norm(p) in a for p in parts)
    return any(norm(x) in a for x in accepted)


def ok_reading(item, answer):
    """Reading items: MC is judged on the letter near the start (or the full correct option text); short answers by key substrings."""
    if item.get("kind") != "mc":
        return any(norm(x) in norm(answer) for x in item["accept"])
    L, opts = item["letter"], item["options"]
    head = answer.strip()[:40]
    if re.search(rf"(?<![A-Za-z0-9])(?:{L}[.):]|\({L}\))", head) or re.search(rf"(?i:answer is)\s*\(?{L}(?![A-Za-z])", head):
        return True
    a = norm(answer)
    correct = norm(opts["ABCD".index(L)])
    return correct in a and not any(norm(o) in a for o in opts if norm(o) != correct)


def main():
    argv = sys.argv[1:]
    only = None
    if "--only" in argv:
        k = argv.index("--only"); only = argv[k + 1] if k + 1 < len(argv) else None
        del argv[k:k + 2]
    args = [a for a in argv if not a.startswith("--")]
    model, tok = load(args[0], adapter_path=args[1] if len(args) > 1 else None)
    greedy = make_sampler(temp=0.0)
    score, n, t0, rows = {}, {}, time.time(), []
    items = [] if only == "reading" else [{"cat": c, "screen": "", "q": q, "accept": a} for c, q, a in all_items()]
    items += reading_items()
    for it in items:
        cat, q, acc = it["cat"], it["q"], it["accept"]
        if it["screen"]:  # exactly the app's screen-question prompt
            sysm, user = SCREEN_SYS, f'Screen text:\n"""\n{it["screen"]}\n"""\n\nQuestion: {q}'
        else:
            sysm, user = SYSTEM, q
        try:
            p = tok.apply_chat_template([{"role": "system", "content": sysm}, {"role": "user", "content": user}], add_generation_prompt=True, tokenize=False, enable_thinking=False)
        except Exception:  # models without a system role (Gemma): put it in the user turn
            p = tok.apply_chat_template([{"role": "user", "content": sysm + "\n\n" + user}], add_generation_prompt=True, tokenize=False)
        out = generate(model, tok, prompt=p, max_tokens=300, sampler=greedy)
        good = ok_reading(it, out) if cat == "reading" else ok(cat, out, acc)
        score[cat] = score.get(cat, 0) + good; n[cat] = n.get(cat, 0) + 1
        rows.append({"cat": cat, "q": q, "out": out, "ok": good, "want": acc})
        if "--show" in sys.argv and not good:
            print(f"✗ [{cat}] {q}\n   want {acc}\n   got  {out[:300]!r}")
    tot = sum(score.values()); N = sum(n.values())
    print(json.dumps({"model": args[0], "adapter": args[1] if len(args) > 1 else None, **{c: f"{score[c]}/{n[c]}" for c in n}, "total": f"{tot}/{N} ({100 * tot / N:.0f}%)", "seconds": round(time.time() - t0)}))
    json.dump(rows, open(f"eval_{re.sub(r'[^A-Za-z0-9]+', '_', args[0] + '_' + (args[1] if len(args) > 1 else ''))[-60:]}{'_' + only if only else ''}.json", "w"), indent=1)


if __name__ == "__main__":
    main()
