"""Held-out test questions (never trained on). Each: (category, question, [accepted answers]).
An answer passes if it contains ANY accepted string (case-insensitive, spaces ignored), and none of the
"wrong" strings when a ("!", ...) entry is given. Math items come from gen_math.py with a separate seed
(and are removed from training data by question text)."""

ENGLISH = [
    ("Fix the grammar: 'Me and him goes to the store every day.'", ["he and i go", "he and i went"]),
    ("Fix the sentence: 'Their going to the park tomorrow.'", ["they're going"]),
    ("Which is correct: 'its raining' or 'it's raining'?", ["it's raining"]),
    ("What is a simile?", ["like", "as"]),
    ("Is 'The wind whispered through the trees' a simile, metaphor or personification?", ["personification"]),
    ("Is 'Her smile was sunshine' a simile or a metaphor?", ["metaphor"]),
    ("What is the antonym of 'generous'?", ["stingy", "selfish", "greedy", "cheap", "miserly"]),
    ("What is a synonym for 'happy'?", ["joyful", "glad", "cheerful", "content", "delighted", "pleased"]),
    ("What part of speech is 'quickly' in 'She ran quickly'?", ["adverb"]),
    ("What part of speech is 'beautiful' in 'a beautiful song'?", ["adjective"]),
    ("Change to active voice: 'The ball was thrown by Sam.'", ["sam threw the ball"]),
    ("What is the climax of a story?", ["turning point", "highest", "most intense", "peak"]),
    ("What is dramatic irony?", ["audience", "reader"]),
    ("What point of view uses 'I' and 'me'?", ["first"]),
    ("What is the difference between theme and main idea?", ["message", "lesson"]),
    ("What does the prefix 'un-' mean?", ["not", "opposite"]),
    ("What does the root 'bio' mean?", ["life"]),
    ("What is alliteration?", ["consonant", "same sound", "same letter", "beginning"]),
    ("Who wrote Romeo and Juliet?", ["shakespeare"]),
    ("In To Kill a Mockingbird, who is Atticus Finch?", ["lawyer", "father"]),
    ("Who wrote Of Mice and Men?", ["steinbeck"]),
    ("What is a thesis statement?", ["main", "claim", "argument", "central"]),
    ("What is the rhyme scheme of a Shakespearean sonnet?", ["abab cdcd efef gg", "ababcdcdefefgg"]),
    ("How many syllables does a haiku have?", ["17", "5-7-5", "5, 7, 5", "seventeen"]),
    ("Combine into one sentence: 'I was tired. I finished my homework.'", ["although", "but", "even though", "though"]),
    ("What is the plural of 'child'?", ["children"]),
    ("Fix the run-on: 'I love pizza it is my favorite food.'", ["pizza;", "pizza.", "pizza, and", "pizza because", "pizza —", "pizza -"]),
    ("Which word is spelled correctly: 'recieve' or 'receive'?", ["receive"]),
    ("What does 'ethos' mean in persuasion?", ["credib", "character", "trust", "authority"]),
    ("Is 'Dogs are the best pets' a fact or an opinion?", ["opinion"]),
    ("What is the subject in 'The tall boy kicked the ball'?", ["boy"]),
    ("What is an idiom? Give the meaning of 'break the ice'.", ["start", "begin", "comfortable", "ease", "conversation", "tension"]),
    ("What type of conflict is a character struggling against a storm?", ["nature"]),
    ("What is foreshadowing?", ["hint", "clue", "later", "future"]),
    ("Choose the correct word: 'I would rather walk (then/than) drive.'", ["than"]),
    ("What is the tone of a text?", ["attitude", "author"]),
    ("What is onomatopoeia? Give an example.", ["sound", "buzz", "boom", "bang", "sizzle", "pop", "crash"]),
    ("Correct the sentence: 'Everyone have finished their test.'", ["everyone has"]),
    ("What is hyperbole?", ["exaggerat"]),
    ("What is the protagonist?", ["main character"]),
]

GENERAL = [
    ("What is the powerhouse of the cell?", ["mitochondri"]),
    ("What gas do plants take in for photosynthesis?", ["carbon dioxide", "co2", "co₂"]),
    ("What is the chemical symbol for sodium?", ["na"]),
    ("What is Newton's second law?", ["f = ma", "f=ma", "mass times acceleration", "mass × acceleration"]),
    ("What are the three branches of the US government?", ["legislative"]),
    ("Who was the first president of the United States?", ["washington"]),
    ("In what year did World War II end?", ["1945"]),
    ("What is the capital of Australia?", ["canberra"]),
    ("What is the largest ocean?", ["pacific"]),
    ("What is the capital of Texas?", ["austin"]),
    ("What does DNA stand for?", ["deoxyribonucleic"]),
    ("What is the pH of pure water?", ["7"]),
    ("What planet is known as the Red Planet?", ["mars"]),
    ("What is the boiling point of water in Celsius?", ["100"]),
    ("What is the mean of 4, 8, 6, 10?", ["7"]),
    ("What is the median of 3, 9, 1, 7, 5?", ["5"]),
    ("What is 15% of 80?", ["12"]),
    ("A right triangle has legs 6 and 8. How long is the hypotenuse?", ["10"]),
    ("What is the area of a circle with radius 3? (use π)", ["9π", "9pi", "28.2"]),
    ("What document begins with 'We the People'?", ["constitution"]),
    ("What amendment gives freedom of speech?", ["first", "1st"]),
    ("What causes the seasons on Earth?", ["tilt"]),
    ("What is the difference between weather and climate?", ["long", "average"]),
    ("What happens to supply and demand when price goes up?", ["demand", "decrease", "falls", "less"]),
    ("How does a knight move in chess?", ["l-shape", "l shape", "two squares", "2 squares"]),
    ("What is the past tense of 'ir' in Spanish for 'yo'? (preterite)", ["fui"]),
    ("How do you say 'thank you' in Spanish?", ["gracias"]),
    ("What organ pumps blood through the body?", ["heart"]),
    ("Who wrote the Declaration of Independence?", ["jefferson"]),
    ("What are the three states of matter?", ["solid"]),
]


def math_items(n=50, seed=999):
    import json, subprocess, sys, os
    here = os.path.dirname(os.path.abspath(__file__))
    out = subprocess.run([sys.executable, os.path.join(here, "gen_math.py"), str(n), str(seed)], capture_output=True, text=True).stdout
    items = []
    for l in out.splitlines():
        d = json.loads(l)
        items.append(("math", d["q"], [d["final"]]))
    return items


def all_items():
    return math_items() + [("english", q, a) for q, a in ENGLISH] + [("general", q, a) for q, a in GENERAL]


def norm(s):
    return "".join(str(s).lower().replace("−", "-").replace("’", "'").split())


def passed(answer, accepted):
    a = norm(answer)
    return any(norm(x) in a for x in accepted)
