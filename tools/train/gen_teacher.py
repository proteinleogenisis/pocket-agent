"""Make English + general-knowledge practice Q&A with a bigger local teacher model (runs on the Mac, offline
after the one-time download). Output JSONL: {"q", "a", "cat"}; for reading passages {"passage", "qs": [[q, a], ...]};
for multiple-choice passages {"cat": "mcreading", "passage", "qs": [{"q", "options": [4], "answer": "A-D"}], "topic"}.
Usage: python gen_teacher.py OUT.jsonl ROUNDS [TEACHER]
"""
import json, random, re, sys
from mlx_lm import load
from mlx_lm.sample_utils import make_sampler

ENGLISH = """subject-verb agreement|pronoun-antecedent agreement|run-on sentences and comma splices|sentence fragments|
commas in a series and after introductory phrases|semicolons and colons|apostrophes and possessives|its vs it's, their/there/they're, your/you're|
affect vs effect, then vs than, accept vs except|active vs passive voice|verb tenses|parts of speech (noun, verb, adjective, adverb)|
prepositions and prepositional phrases|simple, compound and complex sentences|independent and dependent clauses|capitalization|
synonyms of common SAT/ACT words|antonyms|word meanings from context clues|prefixes, suffixes and Greek/Latin roots|connotation vs denotation|
simile and metaphor|personification and hyperbole|alliteration, onomatopoeia and imagery|irony (verbal, situational, dramatic)|
foreshadowing and flashback|theme vs main idea|protagonist, antagonist and types of conflict|point of view (first, second, third person)|
tone and mood|symbolism|plot structure (exposition, rising action, climax, falling action, resolution)|characterization (direct and indirect)|
thesis statements|topic sentences and supporting details|transition words|claims, evidence and counterclaims|ethos, pathos and logos|
fact vs opinion|summarizing vs paraphrasing|MLA citations basics|Shakespeare's Romeo and Juliet|Of Mice and Men|To Kill a Mockingbird|
The Outsiders|Animal Farm|The Odyssey|Lord of the Flies|The Great Gatsby basics|poetry terms (stanza, rhyme scheme, meter)|
haiku, sonnet and free verse|figurative vs literal language|idioms and what they mean|homophones|commonly misspelled words|
formal vs informal writing|writing a strong conclusion|correcting a sentence with grammar mistakes|combining two short sentences""".replace("\n", "").split("|")

GENERAL = """cell biology|photosynthesis and respiration|genetics and DNA basics|human body systems|ecosystems and food webs|evolution and natural selection|
atoms, elements and the periodic table|chemical vs physical changes|acids and bases|balancing simple chemical equations|states of matter|
Newton's laws of motion|speed, velocity and acceleration|energy, work and power|electricity and circuits|waves, light and sound|
Earth's layers and plate tectonics|weather and climate|the solar system|the water cycle and rock cycle|
the American Revolution|the US Constitution and Bill of Rights|three branches of US government|the Civil War and Reconstruction|
World War I|World War II|the Cold War|the civil rights movement|ancient Egypt, Greece and Rome|the Renaissance and Reformation|
the Industrial Revolution|world geography: continents, oceans, capitals|US states and capitals|economics: supply and demand|
personal finance: budgeting, interest, credit|basic statistics: mean, median, mode, range|probability basics|geometry: area, perimeter, volume|
Pythagorean theorem|percent, ratios and proportions|unit conversions|Spanish basics (greetings, numbers, common verbs)|
computer basics and the internet|famous inventors and inventions|famous artists and composers|health and nutrition|first aid basics|
chess rules and basic strategy|sports rules (basketball, soccer, football)|everyday how-to questions|study tips and time management|
world religions basics|famous scientists|space exploration|climate change basics|recycling and the environment""".replace("\n", "").split("|")

ADV_ENGLISH = """rhetorical situation (speaker, audience, purpose, context)|author's purpose in an argumentative passage|identifying the main claim of an essay|
tone and attitude of the author|diction and connotation as rhetorical choices|syntax: short vs long sentences, periodic and cumulative sentences|
ethos, pathos and logos in speeches|anaphora and parallelism|antithesis and juxtaposition|irony, understatement and sarcasm in nonfiction|
concession and refutation in an argument|counterargument and rebuttal|analogy and extended metaphor as argument|rhetorical questions and their effect|
inference from a passage|evidence that best supports a claim|vocabulary in context (multiple meaning words)|function of a sentence or paragraph in a passage|
shifts in tone or perspective within a passage|structure and organization of an argument|qualifying language and hedging|loaded language and bias|
logical fallacies (straw man, slippery slope, false dilemma, ad hominem)|appeal to authority and appeal to emotion|primary vs secondary sources|
analyzing a speech excerpt about civic life|analyzing an editorial about technology and society|analyzing a personal essay or memoir excerpt|
analyzing informational science writing for a general audience|analyzing a historical argument or letter|analyzing a nature essay|
analyzing a narrative passage: narrator, characterization, symbolism|reading dense nineteenth-century prose|imagery and sensory detail|
paradox and oxymoron|allusion and its purpose|satire and its targets|dangling modifiers and misplaced modifiers|faulty parallelism|
pronoun case and pronoun reference errors|subject-verb agreement with intervening phrases|colons, semicolons and dashes for effect|
sentence combining for style and emphasis|revising wordy or vague sentences|synthesizing information from two short sources""".replace("\n", "").split("|")

GEN = """Write {n} different questions a high-school student (grade 9-11) might ask about: {topic}.
Mix easy and medium questions. Give each a correct, short answer: the answer first, then at most 2 short sentences of explanation.
For grammar questions that ask to fix a sentence, include the full sentence in the question and the corrected sentence in the answer.
Return ONLY a JSON array of objects like {{"q": "...", "a": "..."}}. No other text."""

PASSAGE = """Write a short reading passage (90-150 words) for high-school students about {topic}. Then write 3 questions about it
(at least one about the main idea and one about a detail or vocabulary word in context) with short correct answers based only on the passage.
Return ONLY JSON: {{"passage": "...", "qs": [["question", "answer"], ...]}}"""

ADV_GEN = """Write {n} different questions at AP English Language / advanced high-school level about: {topic}.
Where useful, include a short original quoted sentence or 2-3 sentence excerpt inside the question. Give each a correct, short answer: the answer first, then at most 2 short sentences of explanation.
Return ONLY a JSON array of objects like {{"q": "...", "a": "..."}}. No other text."""

MCPASSAGE = """Write an ORIGINAL reading passage of 150-220 words in the style of an AP English Language exam, on this subject or skill: {topic}.
The passage may be an argumentative essay excerpt, a speech, an editorial, a narrative, or informational writing. Do not quote any published work.
Then write 3 multiple-choice questions about it. Choose from: main idea or claim, author's purpose, tone, rhetorical device or strategy, inference,
evidence that best supports a claim, vocabulary in context, function of a sentence or paragraph. Each question has exactly 4 options, exactly one is
unambiguously correct and the other three are plausible but clearly wrong. Give the letter of the correct option.
Return ONLY JSON in exactly this form: {{"passage": "...", "qs": [{{"q": "...", "options": ["...", "...", "...", "..."], "answer": "B"}}]}}
Options must be plain text without letter prefixes, and must not use "all of the above" or "none of the above". No other text."""


def parse(t):
    t = t.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    m = re.search(r"(\[.*\]|\{.*\})", t, re.S)
    return json.loads(m.group(1)) if m else None


def clean_mc(d, topic, rnd):
    """Validate a teacher MC passage; shuffle options so the correct letter is not biased. Returns a row or None."""
    if not isinstance(d, dict) or not isinstance(d.get("passage"), str) or len(d["passage"].split()) < 100:
        return None
    qs = []
    for it in d.get("qs") or []:
        try:
            q, opts, ans = str(it["q"]).strip(), [re.sub(r"^\(?[A-Da-d][.):]\s+", "", str(o)).strip() for o in it["options"]], str(it["answer"]).strip().upper()[:1]
        except Exception:
            continue
        if not q or len(opts) != 4 or len(set(opts)) != 4 or ans not in "ABCD" or not ans or not all(opts):
            continue
        if any(re.search(r"\b(all|none|both) of the (above|these)\b", o, re.I) for o in opts):
            continue
        right = opts["ABCD".index(ans)]
        rnd.shuffle(opts)
        qs.append({"q": q, "options": opts, "answer": "ABCD"[opts.index(right)]})
    if not qs:
        return None
    return {"cat": "mcreading", "passage": d["passage"].strip(), "qs": qs, "topic": topic}


def main(out, rounds, teacher="mlx-community/Qwen2.5-14B-Instruct-4bit", batch=24):
    from mlx_lm import batch_generate
    model, tok = load(teacher)
    samp = make_sampler(temp=0.8, top_p=0.95)
    rnd = random.Random(int(rounds) * 7919 + len(out))
    enc = lambda p: tok.apply_chat_template([{"role": "user", "content": p}], add_generation_prompt=True)
    with open(out, "a") as f:
        for r in range(rounds):
            jobs = []
            for k in range(batch):
                # thirds: advanced-English Q&A, multiple-choice passages, and the previous mix (passages, English, general)
                if k % 3 == 0:
                    topic = rnd.choice(ADV_ENGLISH).strip(); jobs.append(("english2", topic, ADV_GEN.format(n=8, topic=topic)))
                elif k % 3 == 1:
                    topic = rnd.choice(ADV_ENGLISH).strip(); jobs.append(("mcreading", topic, MCPASSAGE.format(topic=topic)))
                elif k % 6 == 5:
                    topic = rnd.choice(ENGLISH + GENERAL).strip(); jobs.append(("reading", topic, PASSAGE.format(topic=topic)))
                else:
                    cat, topics = (("english", ENGLISH), ("general", GENERAL))[(k // 6) % 2]
                    topic = rnd.choice(topics).strip(); jobs.append((cat, topic, GEN.format(n=8, topic=topic)))
            res = batch_generate(model, tok, [enc(j[2]) for j in jobs], max_tokens=1600, sampler=samp)
            kept = 0
            for (cat, topic, _), text in zip(jobs, res.texts):
                try:
                    d = parse(text)
                except Exception:
                    continue
                if cat == "mcreading":
                    row = clean_mc(d, topic, rnd)
                    if row:
                        f.write(json.dumps(row, ensure_ascii=False) + "\n"); kept += 1
                    continue
                if cat == "reading":
                    if isinstance(d, dict) and d.get("passage") and d.get("qs"):
                        f.write(json.dumps({"passage": d["passage"], "qs": d["qs"], "cat": "reading", "topic": topic}, ensure_ascii=False) + "\n"); kept += 1
                    continue
                for it in d or []:
                    if isinstance(it, dict) and it.get("q") and it.get("a") and len(str(it["a"])) < 600:
                        f.write(json.dumps({"q": str(it["q"]).strip(), "a": str(it["a"]).strip(), "cat": cat, "topic": topic}, ensure_ascii=False) + "\n"); kept += 1
            f.flush()
            print(f"round {r + 1}/{rounds}: kept {kept}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), *(sys.argv[3:4]))
