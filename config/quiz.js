module.exports = {
  transitionMs: 200,
  sceneColors: ['#C9B6FF', '#A8C7FA', '#FFE17D', '#FFD1BC', '#BCE8CC', '#F8C4DF'],
  selectionColors: ['#C9B6FF', '#A8C7FA', '#FFE17D', '#FFD1BC', '#BCE8CC', '#F8C4DF'],
  // 只保存最近一次完整结果，不存答题草稿或历史列表。
  resultStorageKey: 'aiti:current-result:v1',
  resultVersion: 1,
  scenes: [
    { caption: '深夜 · 方案待交', tone: '#B89AFF', motif: 'document' },
    { caption: '一条数据 · 几分信任', tone: '#79B4FF', motif: 'search' },
    { caption: '称呼里 · 藏着关系', tone: '#77DCCB', motif: 'chat' },
    { caption: '旅行照 · 真假之间', tone: '#FFB976', motif: 'photo' },
    { caption: '聊天记录 · 要不要记住', tone: '#79B4FF', motif: 'document' },
    { caption: '坏心情 · 想找谁聊聊', tone: '#FF9DBA', motif: 'chat' },
    { caption: '离线一周 · 会想念吗', tone: '#B89AFF', motif: 'pause' },
    { caption: '出了差错 · 谁来负责', tone: '#FFB976', motif: 'search' },
    { caption: '工作通知 · 又有新要求', tone: '#A4C99A', motif: 'document' },
    { caption: '未来来了 · 你准备好了吗', tone: '#FFB976', motif: 'search' },
    { caption: '理想搭档 · 由你定义', tone: '#77DCCB', motif: 'chat' },
    { caption: '十年之后 · 人与 AI', tone: '#B89AFF', motif: 'photo' }
  ]
};
