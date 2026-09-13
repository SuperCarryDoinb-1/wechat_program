// 固定种子的独立伪随机流，用高位取选项，避免低位循环造成答案相关性。
function randomAnswers(count, seed = 20260909) {
  let state = seed >>> 0;
  return Array.from({ length: count }, () => Array.from({ length: 12 }, () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) >>> 30;
  }));
}
module.exports = { randomAnswers };
