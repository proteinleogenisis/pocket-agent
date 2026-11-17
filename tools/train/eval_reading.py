"""Held-out reading / advanced-English test (AP-Language style). All passages and questions are original.
reading_items() -> list of {"cat": "reading", "screen", "q", "accept", ...}.
MC items also carry "kind": "mc", "letter", "options" (4 option strings) so the scorer can be strict.
Short-answer items have "kind": "sa", screen "" and accept = key substrings (see eval_set.norm)."""

LETTERS = "ABCD"


def _mc(stem, correct, wrongs, pos):
    opts = list(wrongs)
    opts.insert(pos, correct)
    return stem, opts, LETTERS[pos]


# (title, passage, [(stem, correct, [3 wrong], position of correct 0-3)]); options kept similar in length
PASSAGES = [
    ('Let Teenagers Sleep',
     "Every weekday at 6:15 a.m., Maplewood's school buses begin their rounds, collecting students who stumble into the dark carrying backpacks and half-eaten toast. District officials defend the early schedule as a matter of logistics: the same buses must serve the elementary schools later. But logistics is not an argument about learning; it is an argument about convenience. Researchers who study adolescent sleep have found that teenagers' internal clocks shift later during puberty, making it biologically difficult to fall asleep before eleven. Forcing these students into first period at 7:30 is therefore less like asking them to wake up early and more like asking an adult to report to work at 4:30. Critics worry that a later bell would push sports practices into the evening. That concern is fair, and it deserves a thoughtful schedule, not a veto. In neighboring Carver County, where the first bell was moved to 8:45, attendance rose and tardiness fell within a single year. If a district cares about students' success, it cannot keep treating their sleep as a problem for the students to solve.",
     [
      ("Which statement best expresses the author's central claim?",
       "Maplewood should start high school later because teenagers' biology makes early starts harmful.",
       ['School buses should be rerouted so that a single fleet can serve every grade level at once.', 'Sports practices matter more to students than their first-period classes ever could.', 'Teenagers should be required by the district to go to bed earlier on school nights.'], 1),
      ('The author compares a 7:30 first period to an adult reporting to work at 4:30 primarily in order to',
       "show how demanding the early schedule is for teenagers' shifted body clocks",
       ['suggest that teachers in the district are overworked and underpaid for early shifts', 'criticize adults who regularly work early-morning shifts in hospitals and bakeries', "explain why the district's buses must begin their routes before sunrise each day"], 2),
      ('The author\'s treatment of the concern about sports practices ("That concern is fair, and it deserves a thoughtful schedule, not a veto") is best described as',
       'a concession that acknowledges a valid point without abandoning the argument',
       ['a refutation that dismisses the concern as based on completely false information', "a personal anecdote meant to build the author's credibility with local coaches", 'an appeal to the authority of researchers who study adolescent sleep patterns'], 0),
     ]),
    ('Remarks at the Library Dedication',
     "Friends and neighbors, when this building first opened its doors in 1952, it held four thousand books, two reading tables, and one stubborn librarian named Mrs. Alder. Tonight it holds far more than that. It holds the résumé a laid-off welder typed here last spring. It holds the Tuesday afternoon when a seven-year-old finally sounded out her first whole sentence. It holds the quiet that a grieving widower comes in search of, and the noise that a robotics club makes in the back room. Some will tell you a library is a warehouse for paper, and that paper is on its way out. I say a library is a promise: that a person's curiosity will not be charged admission. Promises, unlike paper, do not go out of date. So as we cut this ribbon on the new wing, let us not praise ourselves for spending money. Let us praise ourselves for keeping our word.",
     [
      ('The repetition of "It holds" at the start of several consecutive sentences is an example of',
       'anaphora, which emphasizes the wide range of lives the library serves',
       ['antithesis, which sets the library in opposition to the rest of the town', 'hyperbole, which exaggerates how many books the building actually contains', 'irony, which suggests that the library is secretly empty on most days'], 2),
      ('Which word best describes the tone of the speech?',
       'warm and celebratory, with an undercurrent of quiet conviction',
       ['bitter and accusatory, aimed at those who doubt the relevance of libraries', 'detached and analytical, like a report on library usage statistics', 'anxious and uncertain about whether the new wing will succeed'], 3),
      ('In the sentence "a library is a promise: that a person\'s curiosity will not be charged admission," the speaker',
       'redefines the library as a lasting commitment rather than a collection of objects',
       ['argues that the library should begin charging modest fees to cover its costs', 'complains that the new wing cost taxpayers far more than it should have', 'contrasts the library of 1952 with the library of today in terms of its size and holdings'], 1),
     ]),
    ('The Lamp Room',
     'Tomas had kept the light at Gull Point for thirty-one winters, and in all that time he had never once told anyone he was afraid of the sea. The villagers assumed a man who lived on a rock must love the water the way sailors do. They brought him fish and gossip and never asked. But each evening, as he climbed the one hundred and twelve steps to the lamp room, his hand tightened on the rail, and he counted aloud, not for the steps but for the sound of his own voice, which was steadier than the waves below. When the new inspector arrived and asked what a keeper\'s greatest skill was, Tomas considered the question for a long minute. "Staying," he said at last, and returned to polishing the brass, which already shone.',
     [
      ('The detail that Tomas counted aloud "for the sound of his own voice" most strongly suggests that he',
       'uses his own voice to steady himself against his fear of the sea',
       ['enjoys singing aloud as he climbs the long stairs to the lamp room', 'wants the villagers on the shore to hear him and come to his help', 'has forgotten how many steps there are and must keep on recounting them'], 0),
      ('As used in the passage, "considered" most nearly means',
       'thought seriously and carefully about',
       ['sharply criticized and found fault with', 'politely ignored and moved on from', 'flatly refused to answer at all'], 3),
      ('Tomas\'s one-word answer, "Staying," is significant because it',
       'suggests that for him courage means enduring despite his fear',
       ['reveals that he plans to leave the lighthouse once the inspector has left', "mocks the inspector's lack of experience with isolated stations", 'proves that he has never really been afraid of the sea at all'], 1),
     ]),
    ('Life Between the Tides',
     "A tide pool looks like a calm aquarium, but its residents live through an extraordinary daily crisis. Twice a day the ocean retreats, leaving the whole pool exposed to sun, wind, and rain. Water temperature can climb ten degrees in an hour; rainfall can dilute the salt that the animals' bodies depend on. Yet sea anemones, snails, and small crabs thrive here. Their survival is a matter of adaptation rather than luck. Anemones retract their tentacles and hold a film of water against their bodies. Limpets clamp to the rock so tightly that they seal in moisture, returning each time to the same patch, which they wear into a shallow groove that fits their shells exactly. Hermit crabs retreat into the deepest shade. Biologists who study these creatures argue that the tide pool is useful not only as a habitat but as a preview: as oceans warm, the extremes that tide-pool animals already endure may become ordinary for many other species.",
     [
      ('The primary purpose of the passage is to',
       'explain how tide-pool animals survive harsh, changing conditions and why that matters',
       ['persuade readers to support new laws that would protect tide pools from collectors', 'narrate a typical day in the life of a marine biologist who studies the shore', 'compare anemones and limpets in detail to show which of them survives better'], 3),
      ('Which detail best supports the claim that survival in a tide pool is "a matter of adaptation rather than luck"?',
       'Limpets clamp down to seal in moisture and wear a groove that fits their shells.',
       ['Twice a day the ocean retreats, leaving the whole pool exposed to sun, wind, and rain.', 'Water temperature can climb ten degrees in an hour on a sunny afternoon.', 'A tide pool looks like a calm aquarium to a casual visitor at the shore.'], 0),
      ('The final sentence of the passage functions to',
       'extend the discussion by suggesting wider relevance to a warming ocean',
       ['introduce a counterargument that the rest of the passage will go on to refute', 'restate the opening sentence of the passage in somewhat different words', 'cast doubt on the conclusions drawn by the biologists who study tide pools'], 2),
     ]),
    ('In Defense of the Screen',
     'It is tempting to declare that screens have ruined reading. The charge is easy to make and easy to believe, since nearly everyone has caught themselves skimming a long article, thumb flicking, eyes sliding past whole paragraphs. Yet blaming the device mistakes the symptom for the cause. A novel on a tablet is still a novel; a reader who is absorbed by it reads just as deeply as one holding a paperback. What has changed is not the glass but the surroundings: the notifications, the open tabs, the endless invitation to be somewhere else. Paper, we should admit, has one honest advantage, which is that it cannot interrupt us. But a book that cannot interrupt us is not therefore a better book. If we want to read deeply, the remedy is not nostalgia for ink. It is the discipline to silence the machine we are holding, and the courage to be bored for twenty minutes.',
     [
      ("Which statement best describes the author's position?",
       'Shallow reading results mainly from distractions around digital devices, not from the screen itself.',
       ['Screens inherently make deep reading impossible for nearly every reader who uses them.', "Paperbacks are always superior to tablets because they hold readers' attention better.", 'Novels should never be read in public places where interruptions are so likely.'], 1),
      ('The phrase "mistakes the symptom for the cause" suggests that people who blame screens',
       'have misidentified what actually produces shallow reading',
       ['are too sick or tired to concentrate on reading for long periods', 'believe that skimming a long article is a harmless habit for readers', 'have never actually owned or read a paperback book in their lives'], 0),
      ('The sentence beginning "Paper, we should admit," is best described as',
       'a concession that grants the opposing side a point before the author answers it',
       ['a call to action directed at publishers and the makers of tablets', "a personal anecdote about the author's favorite childhood paperback book", 'a definition of a technical term that the author goes on to use later'], 2),
     ]),
    ('A Different List',
     'We are told that one person cannot change a city. We are told that the road is too long, that the budget is too small, that the problem is too old. I have heard these sentences my whole life, usually from people who have never tried. I would like to offer a different list. One person wrote the petition. One person knocked on the first door. One person stood up at the council meeting when everyone else was staring at their shoes. None of them was powerful; all of them were persistent. A city is not changed by the loud arrival of a crowd, but by the quiet accumulation of people who decline to leave. So I ask you tonight not for your applause but for your Saturday. Do not give me your sympathy; give me your signature. Do not tell me what the city should do; tell me what you will do.',
     [
      ('The repeated sentence openings "We are told" and "One person" are examples of',
       "anaphora, which builds rhythm and emphasizes the speaker's point",
       ['simile, which compares ordinary people to objects around the city', 'personification, which gives human qualities to the city council', 'understatement, which calms the audience by downplaying the problems'], 3),
      ('The statement "I ask you tonight not for your applause but for your Saturday" mainly serves to',
       'contrast passive approval with committed action from the audience',
       ["thank the audience for taking the time to attend the evening's event", 'announce a change to the schedule of upcoming council meetings', 'complain that the audience has been unenthusiastic and quiet so far'], 0),
      ("The speaker's primary purpose is to",
       'motivate listeners to take part personally in civic change',
       ['explain to residents how the city budget is prepared each year', 'criticize the members of the city council for their inaction', 'recount the history of one particular petition in the city'], 1),
     ]),
    ('The Harbor Street Experiment',
     'When the council proposed converting one lane of Harbor Street to a protected bike path, the response was swift and loud. Shop owners predicted ruin; commuters predicted gridlock. Eighteen months after the lane opened, the evidence tells a less dramatic story. Traffic counts on Harbor Street dropped by only four percent, a change most drivers could not detect, while foot traffic past the storefronts rose by nearly a fifth. Sales at the corner bakery, whose owner had been the most vocal opponent, are up. None of this means the project was flawless; parking remains scarce on weekends, and the council should address it. But the dire forecasts rested on fear rather than data. Policy debates are always easier to win with a vivid prediction than with a measured one, and that is precisely why we should be wary of the vivid ones.',
     [
      ('As used in the passage, "dire" most nearly means',
       'warning of terrible consequences',
       ['highly detailed and supported by data', 'ultimately accurate in hindsight', 'cheerfully optimistic about the future'], 2),
      ('Which evidence from the passage most directly undermines the shop owners\' prediction of "ruin"?',
       "Foot traffic past the storefronts rose, and the corner bakery's sales are up.",
       ['Parking remains scarce on weekends, and the council should address the problem.', 'The council proposed converting one lane of Harbor Street to a bike path.', 'The response to the proposal was swift and loud from shop owners and commuters.'], 1),
     ]),
    ('The Soup Never Tastes the Same',
     'My grandmother\'s recipes were never written down, a fact she treated as a virtue and the rest of the family treated as a conspiracy. "A pinch," she would say, holding up fingers that had apparently been calibrated by heaven. "Until it looks right." When my cousin Ines, a chemistry student, once tried to measure a pinch on a laboratory scale, my grandmother watched with the patient expression of a woman observing a dog attempt arithmetic. The result was, by Ines\'s account, 0.7 grams. The result of the next attempt was 1.4. "You see," my grandmother said, vindicated, "it depends." We have since collected her dishes the only way we can: by standing in her kitchen, noticing what her hands do, and arguing afterward about what we saw. The soup never tastes the same twice. This, I have come to suspect, is exactly the point.',
     [
      ("The narrator's tone toward the grandmother is best described as",
       'affectionate and gently humorous, with real admiration',
       ['resentful and sarcastic, frustrated by her refusal to share', 'formal and distant, like a historian describing a stranger', 'fearful and bewildered, intimidated by her strict rules'], 0),
      ('The comparison of the grandmother\'s expression to "a woman observing a dog attempt arithmetic" suggests that she',
       "finds Ines's effort to measure her cooking amusingly futile",
       ['is angry that Ines is studying chemistry instead of cooking', 'thinks Ines is clever to bring scientific tools into the kitchen', 'is eager to learn how to use the laboratory scale herself'], 3),
      ('The final sentence, "This, I have come to suspect, is exactly the point," implies that',
       'the variation in the soup reflects the intuitive, living nature of the cooking, which is its value',
       ['the narrator is secretly disappointed in the soup and wishes it tasted the same each time', 'the family is certain to lose every one of the recipes because nobody can copy her cooking', "Ines's laboratory scale was broken and gave inconsistent readings, which spoiled the experiment"], 2),
     ]),
    ('Heat Islands',
     'On a summer afternoon, the temperature in a downtown parking lot can be ten degrees higher than in a park a mile away. Planners call this the urban heat island effect. Dark pavement and rooftops absorb sunlight and release it slowly, while the scarcity of trees removes the shade and the cooling that evaporating leaf moisture provides. The consequences are not evenly distributed. In many cities, neighborhoods with the fewest trees are also those with the lowest incomes, where fewer homes have air conditioning. Heat-related hospital visits cluster in precisely these areas. Some cities have responded with modest measures: painting roofs white, planting street trees, and replacing asphalt in schoolyards with grass. These changes are inexpensive compared with the cost of treating heat illness, but they require something harder to fund than concrete: sustained attention to the places that are easiest to overlook.',
     [
      ('Which conclusion is best supported by the passage?',
       'Hotter, less-shaded neighborhoods tend to house residents who are less able to cool their homes.',
       ['Cities with more air conditioning in their homes tend to have far fewer street trees overall.', 'White roofs make downtown temperatures rise because they trap heat near the pavement.', 'Parks are generally hotter than parking lots because trees block the evening breeze.'], 1),
      ('The phrase "something harder to fund than concrete" implies that',
       'the main obstacle to these solutions is lasting civic commitment rather than materials',
       ['concrete is the cheapest and most reliable building material available to planners', 'the author opposes planting street trees because they are expensive to maintain', 'schoolyards actually need more asphalt, not less, to stay safe for children'], 3),
     ]),
]


def _mc_items():
    items = []
    for title, passage, qs in PASSAGES:
        built = [_mc(*q) for q in qs]
        lines = []
        for n, (stem, opts, _) in enumerate(built, 1):
            lines.append(f"{n}. {stem}\n" + "\n".join(f"{LETTERS[k]}. {o}" for k, o in enumerate(opts)))
        screen = f"{title}\n\n{passage}\n\nQuestions\n" + "\n".join(lines)
        for stem, opts, L in built:
            q = stem + "\n" + "\n".join(f"{LETTERS[k]}. {o}" for k, o in enumerate(opts))
            correct = opts[LETTERS.index(L)]
            items.append({"cat": "reading", "kind": "mc", "screen": screen, "q": q, "letter": L, "options": opts,
                          "accept": [f"{L}.", f"{L})", f"({L})", f"answer is {L}", f"{L}:", correct]})
    return items


# (question, [accepted key substrings])
SHORT = [
    ("In the sentence 'We will not forget the ones who stayed, we will not forget the ones who left, we will not forget the ones who never got the chance to choose,' what rhetorical device is the repeated 'we will not forget'?",
     ["anaphora"]),
    ("Name the rhetorical device in this sentence: 'To err on the side of caution is human; to err on the side of silence is cowardice.'",
     ["antithesis"]),
    ("Which rhetorical appeal (ethos, pathos, or logos) is mainly used here: 'As a pediatric nurse with twenty years of experience, I can tell you this vaccine schedule is safe.'?",
     ["ethos"]),
    ("Which rhetorical appeal (ethos, pathos, or logos) is mainly used here: 'Picture a child shivering on a doorstep, waiting for a door that will never open.'?",
     ["pathos"]),
    ("Which rhetorical appeal (ethos, pathos, or logos) is mainly used here: 'Cities that added bike lanes saw a 12 percent drop in collisions, so bike lanes make streets safer.'?",
     ["logos"]),
    ("Fix the dangling modifier: 'Walking to the bus stop, the rain soaked my jacket.'",
     ["walking to the bus stop, i", "while walking to the bus stop, i", "as i walked", "when i walked", "while i was walking", "as i was walking"]),
    ("Fix the faulty parallelism: 'She likes hiking, to swim, and riding her bike.'",
     ["hiking, swimming, and riding", "hiking, swimming and riding", "to hike, to swim, and to ride", "to hike, to swim and to ride"]),
    ("Which is correct: 'The prize was shared between Maria and I' or 'The prize was shared between Maria and me'?",
     ["maria and me"]),
    ("Fix the comma splice: 'The experiment failed, we repeated it the next day.'",
     ["failed;", "failed. we", "failed, so we", "failed, and we", "failed — we", "failed: we"]),
    ("Choose the correct verb: 'The box of old letters (was / were) found in the attic.'",
     ["was found", "box of old letters was"]),
    ("What is juxtaposition in literature and rhetoric?",
     ["side by side", "next to each other", "placing two", "placement of two", "placed together", "placed next to", "placing contrasting"]),
    ("What does 'diction' mean when analyzing an author's style?",
     ["word choice", "choice of words", "words an author chooses", "words the author chooses", "words a writer chooses"]),
    ("What does 'syntax' refer to in rhetorical analysis?",
     ["sentence structure", "arrangement of words", "order of words", "arrangement of phrases", "way sentences are"]),
    ("What is a concession in an argument?",
     ["acknowledg", "admit", "concede", "opposing side", "opposing view", "other side"]),
    ("What is the term for a sentence that holds back its main clause until the end, like 'After years of doubt, after a thousand rejections, after nearly giving up, she published.'?",
     ["periodic"]),
]


def reading_items():
    items = _mc_items()
    for q, acc in SHORT:
        items.append({"cat": "reading", "kind": "sa", "screen": "", "q": q, "accept": acc})
    return items


if __name__ == "__main__":
    for it in reading_items():
        print(it["kind"], it.get("letter", ""), len(it["screen"].split()))
