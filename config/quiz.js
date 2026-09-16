module.exports = {
  transitionMs: 120,
  sceneColors: ['#C9B6FF', '#A8C7FA', '#FFE17D', '#FFD1BC', '#BCE8CC', '#F8C4DF'],
  // Map the sprite's white fill to each scene color; black and alpha stay intact.
  runnerFilters: {
    '#C9B6FF': 'grayscale(1) brightness(0.5) sepia(1) saturate(1.32228) hue-rotate(214.64deg) brightness(1.23446)',
    '#A8C7FA': 'grayscale(1) brightness(0.5) sepia(1) saturate(1.21705) hue-rotate(178.48deg) brightness(1.26529)',
    '#FFE17D': 'grayscale(1) brightness(0.5) sepia(1) saturate(1.81839) hue-rotate(8.72deg) brightness(1.44678)',
    '#FFD1BC': 'grayscale(1) brightness(0.5) sepia(1) saturate(0.86257) hue-rotate(333.79deg) brightness(1.40215)',
    '#BCE8CC': 'grayscale(1) brightness(0.5) sepia(1) saturate(0.65140) hue-rotate(88.97deg) brightness(1.42375)',
    '#F8C4DF': 'grayscale(1) brightness(0.5) sepia(1) saturate(0.77801) hue-rotate(276.23deg) brightness(1.34877)'
  },
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
