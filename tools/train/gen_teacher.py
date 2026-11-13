"""Make English + general-knowledge practice Q&A with a bigger local teacher model (runs on the Mac, offline
after the one-time download). Output JSONL: {"q", "a", "cat"} and, for reading passages, {"passage", "qs": [[q, a], ...]}.
Usage: python gen_teacher.py OUT.jsonl ROUNDS [TEACHER]
"""
import json, random, re, sys
from mlx_lm import load, generate
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

GEN = """Write {n} different questions a high-school student (grade 9-11) might ask about: {topic}.
Mix easy and medium questions. Give each a correct, short answer: the answer first, then at most 2 short sentences of explanation.
For grammar questions that ask to fix a sentence, include the full sentence in the question and the corrected sentence in the answer.
Return ONLY a JSON array of objects like {{"q": "...", "a": "..."}}. No other text."""

PASSAGE = """Write a short reading passage (90-150 words) for high-school students about {topic}. Then write 3 questions about it
(at least one about the main idea and one about a detail or vocabulary word in context) with short correct answers based only on the passage.
Return ONLY JSON: {{"passage": "...", "qs": [["question", "answer"], ...]}}"""


def parse(t):
    t = t.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    m = re.search(r"(\[.*\]|\{.*\})", t, re.S)
    return json.loads(m.group(1)) if m else None


def main(out, rounds, teacher="mlx-community/Qwen2.5-7B-Instruct-4bit"):
    model, tok = load(teacher)
    samp = make_sampler(temp=0.8, top_p=0.95)
    rnd = random.Random(7)

    def ask(prompt, maxt):
        msgs = [{"role": "user", "content": prompt}]
        p = tok.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)
        return generate(model, tok, prompt=p, max_tokens=maxt, sampler=samp)

    with open(out, "a") as f:
        for r in range(rounds):
            for cat, topics in (("english", ENGLISH), ("general", GENERAL)):
                topic = rnd.choice(topics).strip()
                try:
                    items = parse(ask(GEN.format(n=8, topic=topic), 1400)) or []
                    for it in items:
                        if isinstance(it, dict) and it.get("q") and it.get("a") and len(it["a"]) < 600:
                            f.write(json.dumps({"q": it["q"].strip(), "a": it["a"].strip(), "cat": cat, "topic": topic}, ensure_ascii=False) + "\n")
                except Exception as e:
                    print("skip", topic, e, file=sys.stderr)
            if r % 3 == 0:
                topic = rnd.choice(ENGLISH + GENERAL).strip()
                try:
                    d = parse(ask(PASSAGE.format(topic=topic), 900))
                    if isinstance(d, dict) and d.get("passage") and d.get("qs"):
                        f.write(json.dumps({"passage": d["passage"], "qs": d["qs"], "cat": "reading", "topic": topic}, ensure_ascii=False) + "\n")
                except Exception as e:
                    print("skip passage", topic, e, file=sys.stderr)
            f.flush()
            print(f"round {r + 1}/{rounds}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), *(sys.argv[3:4]))
