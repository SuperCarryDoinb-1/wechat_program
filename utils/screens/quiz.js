const copy = require('../../config/copy');
const config = require('../../config/quiz');
const petConfig = require('../../config/pet');
const createQuizPet = require('../../utils/quiz-pet');
const assets = require('../../config/assets');
const questions = require('../../config/questions');
const { calc } = require('../../utils/scoring');
const requestId = require('../../utils/request-id');
const resultStore = require('../../utils/result-store');
const { validRid } = require('../../utils/public-result');

module.exports = {
  data: {
    copy: { brand: copy.brand, quiz: copy.quiz }, total: questions.length, index: 0, number: 1,
    question: null, scene: null, sceneColor: '', image: '', selected: -1,
    runnerFilters: config.runnerFilters,
    petImage: petConfig.image, petSize: petConfig.size, petBeat: -1,
    petMood: 'idle', petFacing: 1, petX: 0, petY: 0, petFloating: false,
    petDragging: false, petMotionReady: false,
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
    this._pet = createQuizPet(this, wx, { setTimeout, clearTimeout, now: () => Date.now() });
    this.showQuestion(0);
  },

  onShow() {
    this._active = true;
    this._pet.show();
    if (this._pending !== null) this.scheduleAdvance();
  },

  onHide() {
    this._active = false;
    this._pet.hide();
    this.cancelTimer();
  },

  onUnload() {
    this._disposed = true;
    this._active = false;
    this._pet.dispose();
    this._pending = null;
    this.cancelTimer();
  },

  cancelTimer() {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
  },

  onReady() { this._pet.refresh(); },
  onResize() { this._pet.refresh(); },
  onPageScroll(event) {
    if (event && event.scrollTop === (this._scrollTop || 0)) return;
    this._scrollTop = event ? event.scrollTop : undefined;
    this._pet.refresh();
  },
  tapPet() { this._pet.tapPet(); },
  goHome() {
    if (this._flow) this._flow.go('index');
    else wx.reLaunch({ url: '/pages/index/index' });
  },
  petTouchStart(event) { this._pet.touchStart(event); },
  petTouchMove(event) { this._pet.touchMove(event); },
  petTouchEnd(event) { this._pet.touchEnd(event); },
  petTouchCancel() { this._pet.touchCancel(); },

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
    }, () => this._pet.refresh());
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
    this._pending = this.data.index;
    this.setData({ selected: value, answered, progress: Math.round(answered / questions.length * 100),
      transitioning: true, submitError: '' });
    this.notifyPet();
    this.scheduleAdvance();
  },

  notifyPet() {
    this._pet.reactToAnswer();
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
        this.scrollToTop();
      }
    }, config.transitionMs);
  },

  previousQuestion() {
    if (!this._active || this._disposed || this._submitting || this.data.index === 0) return;
    this.cancelTimer();
    this._pending = null;
    this.showQuestion(this.data.index - 1);
    this.scrollToTop();
  },

  scrollToTop() {
    if (!(this._scrollTop > 0)) return;
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
      resultStore.write(wx, this._submissionRecord);
    } catch (_) {
      this.submissionFailed(copy.quiz.saveFailed);
      return;
    }
    // 内容请求由结果页发起，跳转前只保存必须的答题记录。
    if (this._flow) { this._flow.go('result'); return; }
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
};
