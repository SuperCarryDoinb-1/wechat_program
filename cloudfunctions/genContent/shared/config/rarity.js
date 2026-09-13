// 分布统计仅来自均匀随机答案，不代表真实用户的出现率。
module.exports = {
  hiddenCode: 'TEM',
  thresholds: { rel: -1, att: 1, lead: -1 },
  // 最弱维度绝对值相同时，固定按此顺序选择，确保重复作答结果一致。
  weakestTieOrder: ['rel', 'att', 'lead'],
  targets: { hidden: [0.03, 0.06], common: [0.08, 0.25] }
};
