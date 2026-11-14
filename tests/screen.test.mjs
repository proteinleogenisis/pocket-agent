// Screen-question detection tests. Run: node tests/screen.test.mjs
import assert from 'node:assert/strict';
import { handle, screenQuestions, pickScreenQuestions, joinWrapped, solveExact, parseChoice, formatChoice } from '../js/agent.js';

let pass = 0; const fails = [];
const test = (name, fn) => { try { fn(); pass++; } catch (e) { fails.push(`${name}\n    ${String(e.message).split('\n').join('\n    ')}`); } };

// ---------- Fixture screens (OCR-style) ----------
const FIX = {
  worksheet: {
    screen: `Chapter 4 Review Worksheet
Name: ____________ Date: ________
Directions: Answer each question in a complete sentence.
1. What is the capital of France?
2. Who wrote Romeo and Juliet?
3. Why do leaves change color in the fall?
Page 2`,
    want: ['What is the capital of France?', 'Who wrote Romeo and Juliet?', 'Why do leaves change color in the fall?'],
  },
  passage: {
    screen: `The Lost Kite
Maya found a red kite in the garden. It was torn at one corner, and the string was tangled around the fence.
She spent the afternoon mending it with tape. When the wind picked up, she ran to the hill.
Questions
1. Where did Maya find the kite?
2. What did she use to fix it?
3. Why did Maya run to the hill`,
    want: ['Where did Maya find the kite?', 'What did she use to fix it?', 'Why did Maya run to the hill?'],
  },
  multipleChoice: {
    screen: `Geography Quiz
1. What is the capital of France?
A. Paris
B. Lyon
C. Rome
D. Madrid
2. Which ocean is the largest?
a) Atlantic
b) Pacific
c) Indian`,
    want: ['What is the capital of France?\nA. Paris\nB. Lyon\nC. Rome\nD. Madrid', 'Which ocean is the largest?\nA. Atlantic\nB. Pacific\nC. Indian'],
  },
  multipleChoiceMath: {
    screen: `3. What is 5 + 7?
(A) 10
(B) 12
(C) 13
4. Solve 2x = 8
A) 2  B) 4  C) 8`,
    want: ['What is 5 + 7?\nA. 10\nB. 12\nC. 13', 'Solve 2x = 8\nA. 2\nB. 4\nC. 8'],
  },
  multipleChoiceNoQuestionMark: {
    screen: `5. The phrase "time is a thief" is an example of
A. simile
B. metaphor
C. alliteration
6. Choose the best word to complete the sentence:
(A) their (B) there (C) they're`,
    want: ['The phrase "time is a thief" is an example of\nA. simile\nB. metaphor\nC. alliteration', 'Choose the best word to complete the sentence:\nA. their\nB. there\nC. they\'re'],
  },
  fillBlank: {
    screen: `Vocabulary
Name ________ Period ___
1. The process by which plants make food is called ________.
2. Water boils at ___ degrees Celsius.
3. 3 + ___ = 10
Word bank: photosynthesis, 100, evaporation`,
    want: ['The process by which plants make food is called ________.', 'Water boils at ___ degrees Celsius.', '3 + ___ = 10'],
  },
  trueFalse: {
    screen: `Part B: True or False
1. The sun is a star.
2. Sound travels faster than light.
3. True or false: Whales are fish.
Part C: Short Answer
4. Explain why the sky looks blue.`,
    want: ['True or false: The sun is a star.', 'True or false: Sound travels faster than light.', 'True or false: Whales are fish.', 'Explain why the sky looks blue.'],
  },
  algebra: {
    screen: `Algebra 2 - Unit 3 Practice
Name: __________
1. Solve x^2 - 5x + 6 = 0
2. Factor 6x^2 + x - 2
3. Simplify (3x^2)(4x^3)
4. Evaluate f(3) if f(x) = 2x^2 - 1
5. Graph y = 2x + 1
6. Find the vertex of y = x^2 - 4x + 7`,
    want: ['Solve x^2 - 5x + 6 = 0', 'Factor 6x^2 + x - 2', 'Simplify (3x^2)(4x^3)', 'Evaluate f(3) if f(x) = 2x^2 - 1', 'Graph y = 2x + 1', 'Find the vertex of y = x^2 - 4x + 7'],
  },
  directiveItems: {
    screen: `Section 2.1 Linear Equations
Solve each equation.
1. 3x + 2 = 11
2. 5x - 7 = 18
3. x/2 + 4 = 9`,
    want: ['Solve 3x + 2 = 11', 'Solve 5x - 7 = 18', 'Solve x/2 + 4 = 9'],
  },
  bulletSlide: {
    screen: `Photosynthesis
- Plants convert light into chemical energy
• Occurs in the chloroplasts
• How plants make food
• Explain the role of chlorophyll
• Needs water, carbon dioxide and sunlight`,
    want: [],
  },
  notes: {
    screen: `Biology notes - Oct 12
Cells are the basic unit of life.
The nucleus controls the cell's activities.
Mitochondria make energy (ATP).
Remember: plants also have a cell wall.
Note: quiz on Friday
When the cell divides, two daughter cells form.
Page 3`,
    want: [],
  },
  wrapped: {
    screen: `1. Which planet is known as the Red
Planet?
2. Explain why the leaves of deciduous trees
change color in the fall.
3. What is the main idea of the
second paragraph?`,
    want: ['Which planet is known as the Red Planet?', 'Explain why the leaves of deciduous trees change color in the fall.', 'What is the main idea of the second paragraph?'],
  },
  mixed: {
    screen: `Review: Mixed Practice
1. Solve 3x + 4 = 19
2. What is the main theme of the poem?
3. Define the word "irony".
4. Calculate 15% of 80.
5. Circle the noun in this sentence: The dog barked loudly.
6. Correct the sentence: me and him goes to school.
7. List three causes of the American Revolution.`,
    want: ['Solve 3x + 4 = 19', 'What is the main theme of the poem?', 'Define the word "irony".', 'Calculate 15% of 80.', 'Circle the noun in this sentence: The dog barked loudly.', 'Correct the sentence: me and him goes to school.', 'List three causes of the American Revolution.'],
  },
  subQuestions: {
    screen: `4. Read the graph and answer.
a) What was the highest temperature?
b) Which day was the coldest?
5. Simplify each expression.
a) 2x + 3x
b) 4y - y`,
    want: ['What was the highest temperature?', 'Which day was the coldest?', 'Simplify 2x + 3x', 'Simplify 4y - y'],
  },
  dialogue: {
    screen: `"Where are you going?" asked Tom.
Mia said she was going home. "Wait for me," he called.
Find the key, she whispered, and hurry.`,
    want: [],
  },
  inlineOptions: {
    screen: `1. What is 6 x 7? A. 36 B. 42 C. 48
2. Name the largest planet.`,
    want: ['What is 6 x 7?\nA. 36\nB. 42\nC. 48', 'Name the largest planet.'],
  },
};
for (const [name, f] of Object.entries(FIX)) test(`detect: ${name}`, () => assert.deepEqual(screenQuestions(f.screen), f.want));

// ---------- Picks ----------
const Q3 = ['What is 2 + 2?', 'Who wrote Hamlet?', 'Solve 3x + 2 = 11'];
const PICKS = [
  ['answer the questions', Q3], ['answer question 2', [Q3[1]]], ['answer questions 1 and 3', [Q3[0], Q3[2]]], ['do #1, 3', [Q3[0], Q3[2]]],
  ['#2', [Q3[1]]], ['question 3', [Q3[2]]],
  ['help', Q3], ['answers', Q3], ["what's the answer", Q3], ['do this', Q3], ['do it', Q3], ['solve', Q3], ['answer', Q3],
  ['help me with this', Q3], ['?', Q3], ['', Q3], ['what are the answers?', Q3], ['please answer these', Q3], ['questions 1-2', [Q3[0], Q3[1]]],
  ['summarize this', null], ['explain this paragraph', null], ['what does photosynthesis mean', null], ['translate this', null], ['who was Hamlet', null],
];
for (const [req, want] of PICKS) test(`pick: "${req}"`, () => assert.deepEqual(pickScreenQuestions(req, Q3), want));
test('pick: "answer questions 1-2"', () => assert.deepEqual(pickScreenQuestions('answer questions 1-2', Q3), [Q3[0], Q3[1]]));
test('pick: "do #1, 4" out of 5', () => assert.deepEqual(pickScreenQuestions('do #1, 4', ['a?', 'b?', 'c?', 'd?', 'e?']), ['a?', 'd?']));
test('pick: no questions → null', () => assert.equal(pickScreenQuestions('help', []), null));

// ---------- Multiple choice carries its options ----------
test('mc: options attached and parsed', () => {
  const [q] = screenQuestions(FIX.multipleChoice.screen);
  const { stem, opts } = parseChoice(q);
  assert.equal(stem, 'What is the capital of France?');
  assert.deepEqual(opts.map((o) => `${o.L}:${o.text}`), ['A:Paris', 'B:Lyon', 'C:Rome', 'D:Madrid']);
  assert.ok(q.includes('B. Lyon'));
});
test('mc: options never detected as their own questions', () => {
  for (const q of screenQuestions(FIX.multipleChoice.screen)) assert.ok(!/^[A-D]\. /.test(q));
  assert.equal(screenQuestions(FIX.multipleChoice.screen).length, 2);
});
test('mc: formatChoice leads with letter and text', () => {
  const opts = parseChoice(screenQuestions(FIX.multipleChoiceMath.screen)[0]).opts;
  assert.equal(formatChoice('B', opts), 'B. 12');
  assert.equal(formatChoice('B. 12 because 5 + 7 = 12', opts), 'B. 12');
  assert.equal(formatChoice('The answer is 12.', opts), 'B. 12');
  assert.equal(formatChoice('The answer is (C).', opts), 'C. 13');
  assert.equal(formatChoice('A bird flew.', opts), 'A bird flew.');
});

// ---------- handle() end to end with a stub model ----------
const run = async (text, screen, answer = 'B') => {
  const asked = [];
  const llm = { ready: true, stream: async (msgs) => { asked.push(msgs); return { text: answer }; } };
  const res = await handle({ text, llm, settings: {}, history: [], screen, ui: { status() {}, token() {} } });
  return { res, asked };
};
const e2e = async (name, fn) => { try { await fn(); pass++; } catch (e) { fails.push(`${name}\n    ${String(e.message).split('\n').join('\n    ')}`); } };
const quiz = 'Quiz\n1. Name the largest planet.\n2. Who wrote Hamlet?';
await e2e('handle: vague "help" answers MC with letter + text and passes options in the question', async () => {
  const a = await run('help', 'Geography\n1. What is the capital of France?\nA. Lyon\nB. Paris\nC. Rome', 'The answer is B');
  assert.equal(a.res.kind, 'answer'); assert.equal(a.res.text, 'B. Paris');
  assert.ok(a.asked[0][1].content.endsWith('"""\n\nQuestion: What is the capital of France?\nA. Lyon\nB. Paris\nC. Rome'), a.asked[0][1].content);
});
await e2e('handle: empty request answers all, combined blocks', async () => {
  const r = await run('', quiz, 'X');
  assert.equal(r.res.text, '**1. Name the largest planet.**\nX\n\n**2. Who wrote Hamlet?**\nX');
});
await e2e('handle: "answer question 2" answers just that one', async () => assert.equal((await run('answer question 2', quiz, 'Shakespeare')).res.text, 'Shakespeare'));
await e2e('handle: no questions message', async () => {
  const n = await run('answer the questions', 'Photosynthesis\n- Plants make food\n- Needs light');
  assert.equal(n.res.kind, 'error'); assert.match(n.res.text, /I don't see any questions on this screen/);
});
await e2e('handle: exact math skips the model', async () => {
  const m = await run('answer the questions', 'Worksheet\n1. Solve x^2 - 5x + 6 = 0');
  assert.match(m.res.text, /x = 2 or x = 3/); assert.equal(m.asked.length, 0);
});
await e2e('handle: exact math on multiple choice maps to the option', async () => {
  const m = await run('help', '2. Solve 2x = 8\nA. 2\nB. 4\nC. 8');
  assert.equal(m.res.text, 'B. 4'); assert.equal(m.asked.length, 0);
});

// ---------- Unchanged behaviour ----------
test('joinWrapped joins wrapped question', () => assert.equal(joinWrapped('1. Which planet is known as the Red\nPlanet?\n2. Who is it?'), '1. Which planet is known as the Red Planet?\n2. Who is it?'));
test('solveExact quadratic', () => assert.match(solveExact('Solve x^2 - 5x + 6 = 0'), /x = 2 or x = 3/));
test('solveExact linear', () => assert.match(solveExact('Solve 3x + 2 = 11'), /x = 3/));

console.log(`screen tests: ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log('\nFAILURES:\n' + fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
