const questions = require('../config/questions');
const rarity = require('../config/rarity');
const axes = ['rel', 'att', 'lead'];

function calc(answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    throw new TypeError('ANSWERS_LENGTH_INVALID');
  }
  const scores = { rel: 0, att: 0, lead: 0 };
  const strong = { rel: 0, att: 0, lead: 0 };
  for (let i = 0; i < questions.length; i += 1) {
    const answer = answers[i];
    if (!Number.isInteger(answer) || answer < 0 || answer >= questions[i].options.length) {
      throw new TypeError('ANSWER_INDEX_INVALID');
    }
    const vector = questions[i].options[answer].score;
    axes.forEach(axis => {
      const value = vector[axis] || 0;
      scores[axis] += value;
      if (Math.abs(value) === 2) strong[axis] += value;
    });
  }
  const resolved = {};
  axes.forEach(axis => { resolved[axis] = scores[axis] || strong[axis]; });
  let code = (resolved.rel > 0 ? 'P' : 'T') +
    (resolved.att >= 0 ? 'E' : 'G') + (resolved.lead > 0 ? 'A' : 'M');
  const t = rarity.thresholds;
  if (code === rarity.hiddenCode && !(scores.rel <= t.rel && scores.att >= t.att && scores.lead <= t.lead)) {
    const weakest = rarity.weakestTieOrder.reduce((best, axis) =>
      Math.abs(scores[axis]) < Math.abs(scores[best]) ? axis : best);
    code = { rel: 'PEM', att: 'TGM', lead: 'TEA' }[weakest];
  }
  return {
    code, scores, coords: { x: scores.rel / 24, y: scores.att / 24 },
    rarity: code === rarity.hiddenCode ? 'hidden' : 'common'
  };
}

module.exports = { calc };
