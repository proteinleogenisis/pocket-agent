"""Second pass: the teacher grades every Q&A it wrote and drops the ones it judges wrong.
Usage: python verify.py IN.jsonl OUT.jsonl [TEACHER]"""
import json, sys
from mlx_lm import load, batch_generate
from mlx_lm.sample_utils import make_sampler

JUDGE = """You are checking homework answers for high-school students.
Question: {q}
Proposed answer: {a}
Is the proposed answer correct, with no false statements? Reply with only YES or NO."""


MC_JUDGE = """You are checking a multiple-choice reading question for high-school students.
Passage: {passage}

Question: {q}
{opts}
Proposed answer: {letter}
Is {letter} the single correct answer, with the other three options clearly wrong and the question answerable from the passage? Reply with only YES or NO."""


def main(inp, out, teacher="mlx-community/Qwen2.5-14B-Instruct-4bit", batch=64):
    model, tok = load(teacher)
    greedy = make_sampler(temp=0.0)
    rows = [json.loads(l) for l in open(inp)]
    checks = []  # (row index, qa index or None, q, a)
    for i, r in enumerate(rows):
        if "q" in r:
            checks.append((i, None, r["q"], r["a"]))
        elif r.get("cat") == "mcreading":
            for k, x in enumerate(r.get("qs") or []):
                if isinstance(x, dict) and isinstance(x.get("options"), list) and len(x["options"]) == 4 and str(x.get("answer", ""))[:1].upper() in list("ABCD"):
                    opts = "\n".join(f"{'ABCD'[j]}. {o}" for j, o in enumerate(x["options"]))
                    checks.append((i, k, MC_JUDGE.format(passage=r["passage"], q=x["q"], opts=opts, letter=str(x["answer"])[:1].upper()), None))
        else:
            for k, qa in enumerate(r.get("qs") or []):
                if isinstance(qa, list) and len(qa) == 2:
                    checks.append((i, k, f"(About this passage: {r['passage'][:900]})\n{qa[0]}", qa[1]))
    verdict = {}
    for s in range(0, len(checks), batch):
        chunk = checks[s:s + batch]
        prompts = [tok.apply_chat_template([{"role": "user", "content": (JUDGE.format(q=q, a=a) if a is not None else q)}], add_generation_prompt=True) for _, _, q, a in chunk]
        res = batch_generate(model, tok, prompts, max_tokens=3, sampler=greedy)
        for (i, k, _, _), t in zip(chunk, res.texts):
            verdict[(i, k)] = t.strip().upper().startswith("YES")
        print(f"checked {min(s + batch, len(checks))}/{len(checks)}", file=sys.stderr, flush=True)
    kept = dropped = 0
    with open(out, "w") as f:
        for i, r in enumerate(rows):
            if "q" in r:
                if verdict.get((i, None)):
                    f.write(json.dumps(r, ensure_ascii=False) + "\n"); kept += 1
                else:
                    dropped += 1
            else:
                qs = [qa for k, qa in enumerate(r.get("qs") or []) if verdict.get((i, k))]  # works for [q, a] pairs and mcreading dicts
                dropped += len(r.get("qs") or []) - len(qs)
                if qs:
                    r["qs"] = qs; f.write(json.dumps(r, ensure_ascii=False) + "\n"); kept += len(qs)
    print(f"kept {kept}, dropped {dropped}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
