"""Assemble the fine-tuning set in the exact prompt formats Pocket Agent uses (js/agent.js).
Usage: python build_data.py MATH.jsonl TEACHER.jsonl OUT_DIR"""
import json, os, random, re, sys

# Must match SYSTEM_PROMPT in js/agent.js.
SYSTEM = """You are Pocket Agent, a private homework helper running offline on the user's iPad.
Give the answer first, in plain words. Then add at most 2-3 short sentences or steps if they help.
For math, show the key steps briefly and end with the final answer. Never make up facts; if unsure, say so."""

# Must match answerScreenQuestion() in js/agent.js.
SCREEN_SYS = "Answer the question using the text from the user's screen (notes, a reading, a worksheet). If the screen text contains the answer, use it. Answer ONLY what the question asks, in one short plain sentence — do not copy the whole sentence from the text if it contains other details. No lists, no markdown, no steps. For math, give the final answer with at most one short step in the same sentence."


def chat(q, a):
    return {"messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": q}, {"role": "assistant", "content": a}]}


def screen(ctx, q, a):
    return {"messages": [{"role": "system", "content": SCREEN_SYS}, {"role": "user", "content": f'Screen text:\n"""\n{ctx}\n"""\n\nQuestion: {q}'}, {"role": "assistant", "content": a}]}


def short(a):
    """First sentence of a teacher answer, for one-sentence screen answers."""
    s = re.split(r"(?<=[.!?])\s+", a.strip())[0]
    return s if len(s) > 2 else a.strip()


def main(math_f, teacher_f, out):
    from eval_set import all_items, norm
    held = {norm(q) for _, q, _ in all_items()}
    R = random.Random(3)
    math = [json.loads(l) for l in open(math_f)]
    teach = [json.loads(l) for l in open(teacher_f)] if os.path.exists(teacher_f) else []
    qa = [t for t in teach if "q" in t and norm(t["q"]) not in held]
    reads = [t for t in teach if "passage" in t]
    rows = []
    math = [m for m in math if norm(m["q"]) not in held]
    for i, m in enumerate(math):
        if i % 4:
            rows.append(chat(m["q"], m["a"]))
        else:  # on a worksheet, among other problems
            others = [x["q"] for x in R.sample(math, 3)]
            sheet = [f"{k + 1}. {x}" for k, x in enumerate(others[:2] + [m["q"]] + others[2:])]
            last = m["a"].split(". ")[-2] if m["a"].count(". ") >= 2 else m["a"]
            rows.append(screen("Algebra 2 Practice\n" + "\n".join(sheet), m["q"], f"{m['final']} ({last.rstrip('.')})." if last.strip() not in (m['final'], m['final'] + '.') else f"{m['final']}."))
    for t in qa:
        rows.append(chat(t["q"], t["a"]))
        if R.random() < 0.25:
            others = [x["q"] for x in R.sample(qa, 3) if x["topic"] == t["topic"]] or [x["q"] for x in R.sample(qa, 2)]
            sheet = "\n".join(f"{k + 1}. {x}" for k, x in enumerate([t["q"]] + others))
            rows.append(screen(f"{t['topic'].title()} Review\n{sheet}", t["q"], short(t["a"])))
    for r in reads:
        for q, a in r["qs"]:
            if isinstance(q, str) and isinstance(a, str):
                ctx = r["passage"] + "\n\nQuestions\n" + "\n".join(f"{k + 1}. {x[0]}" for k, x in enumerate(r["qs"]))
                rows.append(screen(ctx, q, short(a)))
    R.shuffle(rows)
    os.makedirs(out, exist_ok=True)
    nv = max(50, len(rows) // 25)
    with open(os.path.join(out, "valid.jsonl"), "w") as f:
        for r in rows[:nv]:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(out, "train.jsonl"), "w") as f:
        for r in rows[nv:]:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(rows) - nv} train, {nv} valid  (math {len(math)}, teacher Q&A {len(qa)}, passages {len(reads)})")


if __name__ == "__main__":
    main(*sys.argv[1:4])
