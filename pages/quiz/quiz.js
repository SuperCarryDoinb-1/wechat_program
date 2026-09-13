const copy = require('../../config/copy');
const config = require('../../config/quiz');
const assets = require('../../config/assets');
const questions = require('../../config/questions');
const { calc } = require('../../utils/scoring');
const contentService = require('../../utils/content-service');
const requestId = require('../../utils/request-id');
const { validRid } = require('../../utils/public-result');

Page({
  data: {
    copy, total: questions.length, index: 0, number: 1,
    question: null, scene: null, sceneColor: '', image: '', selected: -1,
    selectedColor: config.selectionColors[0],
    answered: 0, progress: 0, transitioning: false, submitting: false, submitError: ''
  },

  onLoad(options = {}) {
    this._fromRid = validRid(options.fromRid) ? options.fromRid : '';
    this._answers = Array(questions.length).fill(null);
    this._failedImages = {};
    this._pending = null;
    this._timer = null;
    this._active = false;
    this._disposed = false;
    this._submitting = false;
    this._submissionRecord = null;
    this.showQuestion(0);
  },

  onShow() {
    this._active = true;
    if (this._pending !== null) this.scheduleAdvance();
  },

  onHide() {
    this._active = false;
    this.cancelTimer();
  },

  onUnload() {
    this._disposed = true;
    this._active = false;
    this._pending = null;
    this.cancelTimer();
  },

  cancelTimer() {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
  },

  showQuestion(index) {
    const question = questions[index];
    const answered = this._answers.filter(value => value !== null).length;
    const sceneColors = config.sceneColors.filter(color => color !== this.data.sceneColor);
    const sceneColor = sceneColors[Math.floor(Math.random() * sceneColors.length)];
    this.setData({
      index, number: index + 1,
      // 视图只接收文字，得分向量留在逻辑层。
      question: { id: question.id, title: question.title,
        options: question.options.map(option => ({ label: option.label, text: option.text })) },
      scene: config.scenes[index], sceneColor,
      image: this._failedImages[index] ? '' : assets.questions[question.imageIndex],
      selected: this._answers[index] === null ? -1 : this._answers[index],
      answered, progress: Math.round(answered / questions.length * 100),
      transitioning: false, submitting: false, submitError: ''
    });
  },

  selectOption(event) {
    if (!this._active || this._disposed || this._pending !== null || this._submitting) return;
    const { option, questionId } = event.currentTarget.dataset;
    // 拒绝上一题残留的点击事件，以及异常选项。
    if (Number(questionId) !== questions[this.data.index].id) return;
    if (option === '' || option === null || option === undefined) return;
    const value = Number(option);
    if (!Number.isInteger(value) || value < 0 || value > 3) return;
    this._answers[this.data.index] = value;
    this._submissionRecord = null;
    const answered = this._answers.filter(answer => answer !== null).length;
    const colors = config.selectionColors.filter(color => color !== this.data.selectedColor);
    const selectedColor = colors[Math.floor(Math.random() * colors.length)];
    this.setData({ selected: value, selectedColor, answered, progress: Math.round(answered / questions.length * 100),
      submitError: '' });
    this.nextQuestion(event);
  },

  nextQuestion(event) {
    if (!this._active || this._disposed || this._pending !== null || this._submitting) return;
    if (Number(event.currentTarget.dataset.questionId) !== questions[this.data.index].id) return;
    if (this._answers[this.data.index] === null) return;
    this._pending = this.data.index;
    this.setData({ transitioning: true, submitError: '' });
    this.scheduleAdvance();
  },

  scheduleAdvance() {
    this.cancelTimer();
    if (!this._active || this._disposed || this._pending === null) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      if (!this._active || this._disposed || this._pending === null) return;
      const index = this._pending;
      this._pending = null;
      if (index === questions.length - 1) {
        this.finish();
      } else {
        this.showQuestion(index + 1);
        wx.pageScrollTo({ scrollTop: 0, duration: 0 });
      }
    }, config.transitionMs);
  },

  previousQuestion() {
    if (!this._active || this._disposed || this._submitting || this.data.index === 0) return;
    this.cancelTimer();
    this._pending = null;
    this.showQuestion(this.data.index - 1);
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  imageFailed(event) {
    if (this._disposed || Number(event.currentTarget.dataset.questionId) !== this.data.question.id) return;
    this._failedImages[this.data.index] = true;
    this.setData({ image: '' });
  },

  finish() {
    if (!this._active || this._disposed || this._submitting) return;
    this._submitting = true;
    this.setData({ submitting: true, transitioning: false, submitError: '' });
    let result;
    try {
      result = calc(this._answers);
    } catch (_) {
      this.submissionFailed(copy.quiz.calculationFailed);
      return;
    }
    try {
      this._submissionRecord = this._submissionRecord || {
        version: config.resultVersion, answers: this._answers.slice(),
        ...result, createdAt: Date.now(), requestId: requestId(),
        ...(this._fromRid ? { fromRid: this._fromRid } : {})
      };
      wx.setStorageSync(config.resultStorageKey, this._submissionRecord);
    } catch (_) {
      this.submissionFailed(copy.quiz.saveFailed);
      return;
    }
    // 请求跨页面复用，结果页立即显示人设与加载骨架，不等待云端才跳转。
    contentService.start(this._submissionRecord).catch(() => {});
    try {
      wx.redirectTo({ url: '/pages/result/result',
        fail: () => this.submissionFailed(copy.quiz.navigationFailed) });
    } catch (_) {
      this.submissionFailed(copy.quiz.navigationFailed);
    }
  },

  submissionFailed(message) {
    this._submitting = false;
    if (!this._disposed) this.setData({ submitting: false, submitError: message });
  },

  retryFinish() {
    if (!this.data.submitError) return;
    this.finish();
  }
});
