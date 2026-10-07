(() => {
  const KEY = 'fitbalance-v1';
  const today = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const round = (n, d = 0) => Number(Number(n || 0).toFixed(d));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const defaults = {
    profile: {
      sex: 'male', age: 40, height: 175, weight: 70, goal: 'maintain',
      activityLevel: 1.375, stepGoal: 8000, manualCalGoal: '',
      diabetes: false, gout: false, hypertension: false, heartDisease: false,
      priorMI: false, priorStroke: false,
      emergencyContacts: [
        {name:'', relation:'', phone:''},
        {name:'', relation:'', phone:''}
      ],
      fasting: false, eatStart: '12:00', eatHours: 8
    },
    onboardingCompleted: false,
    foodLogs: [],
    exerciseLogs: [],
    weightLogs: [],
    manualSteps: {},
    stepHistory: {},
    recovery: {},
    behaviorLogs: [],
    customActivities: []
  };

  let state;
  try {
    state = JSON.parse(localStorage.getItem(KEY) || 'null') || {};
  } catch (e) {
    state = {};
  }
  state = {
    ...defaults,
    ...state,
    profile: {...defaults.profile, ...(state.profile || {})},
    onboardingCompleted: !!state.onboardingCompleted,
    foodLogs: Array.isArray(state.foodLogs) ? state.foodLogs : [],
    exerciseLogs: Array.isArray(state.exerciseLogs) ? state.exerciseLogs : [],
    weightLogs: Array.isArray(state.weightLogs) ? state.weightLogs : [],
    manualSteps: state.manualSteps || {},
    stepHistory: state.stepHistory || {},
    recovery: state.recovery || {},
    behaviorLogs: Array.isArray(state.behaviorLogs) ? state.behaviorLogs : [],
    customActivities: Array.isArray(state.customActivities) ? state.customActivities : []
  };
  if (!Array.isArray(state.profile.emergencyContacts)) {
    state.profile.emergencyContacts = defaults.profile.emergencyContacts.map(x => ({...x}));
  }
  while (state.profile.emergencyContacts.length < 2) {
    state.profile.emergencyContacts.push({name:'', relation:'', phone:''});
  }

  const fallbackFoods = [
    {id:'rice',name:'米饭（蒸，熟重）',icon:'🍚',kcal:120,p:2.7,c:25.9,f:0.3,purine:'low',basis:'每100g熟重',source_name:'中国食物交换份公开引用'},
    {id:'rice_raw',name:'大米（生重，谷物类参考）',icon:'🌾',kcal:360,p:10.0,c:76.0,f:2.0,purine:'low',basis:'每100g生重',source_name:'中国食物交换份公开引用'},
    {id:'chicken',name:'鸡胸肉（熟）',icon:'🍗',kcal:165,p:31.0,c:0,f:3.6,purine:'moderate',basis:'每100g熟重',source_name:'USDA FoodData Central'},
    {id:'egg',name:'鸡蛋（熟）',icon:'🥚',kcal:155,p:12.6,c:1.1,f:10.6,purine:'low',basis:'每100g',source_name:'USDA FoodData Central'},
    {id:'banana',name:'香蕉（可食部）',icon:'🍌',kcal:89,p:1.1,c:22.8,f:0.3,purine:'low',basis:'每100g可食部',source_name:'USDA FoodData Central'},
    {id:'apple',name:'苹果（带皮，可食部）',icon:'🍎',kcal:52,p:0.3,c:13.8,f:0.2,purine:'low',basis:'每100g可食部',source_name:'USDA FoodData Central'}
  ];
  let foods = fallbackFoods.slice();

  function loadFoodCatalog() {
    try {
      if (window.FitBridge && typeof FitBridge.getFoodCatalogJson === 'function') {
        const rows = JSON.parse(FitBridge.getFoodCatalogJson() || '[]');
        if (Array.isArray(rows) && rows.length) {
          foods = rows;
          return true;
        }
      }
    } catch (e) {}
    foods = fallbackFoods.slice();
    return false;
  }


  const baseExerciseTypes = [
    {id:'walk',label:'走路',icon:'🚶',met:3.5,category:'exercise'},
    {id:'run',label:'跑步',icon:'🏃',met:8.3,category:'exercise'},
    {id:'strength',label:'力量',icon:'🏋️',met:5.0,category:'exercise'},
    {id:'cycle',label:'骑行',icon:'🚴',met:6.8,category:'exercise'},
    {id:'meditation',label:'冥想',icon:'🧘',met:1.3,category:'meditation'},
    {id:'stretch',label:'拉伸',icon:'🤸',met:2.3,category:'mobility'}
  ];
  const allExerciseTypes = () => baseExerciseTypes.concat(state.customActivities || []);
  let selectedExercise = 'walk';
  let selectedMuscle = 'legs';
  let reportDays = 7;
  let photoDish = [];
  let zhuangziStatus = null;
  let zhuangziViewDay = 1;

  const muscleDefs = [
    ['chest','胸'],['back','背'],['legs','腿'],['shoulders','肩'],['arms','手臂'],['core','核心']
  ];

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function el(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    const t = el('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove('on'), 1800);
  }

  function profileMetrics() {
    const p = state.profile;
    const w = Number(p.weight) || 70;
    const h = Number(p.height) || 175;
    const age = Number(p.age) || 40;
    const sexOffset = p.sex === 'female' ? -161 : 5;
    const bmr = 10 * w + 6.25 * h - 5 * age + sexOffset;
    const tdee = bmr * Number(p.activityLevel || 1.375);
    const autoCal = tdee + (p.goal === 'lose' ? -300 : p.goal === 'gain' ? 250 : 0);
    const calGoal = Number(p.manualCalGoal) > 0 ? Number(p.manualCalGoal) : autoCal;
    const proteinFactor = p.goal === 'maintain' ? 1.4 : 1.6;
    const carbFactor = p.goal === 'lose' ? 2.5 : p.goal === 'gain' ? 4.0 : 3.0;
    const proteinGoal = w * proteinFactor;
    const carbGoal = w * carbFactor;
    const bmi = w / Math.pow(h / 100, 2);
    return {w,h,age,bmr,tdee,calGoal,proteinGoal,carbGoal,bmi};
  }

  function calcFood(food, grams) {
    const g = Math.max(0, Number(grams) || 0);
    const q = g / 100;
    return {
      kcal: food.kcal * q,
      p: food.p * q,
      c: food.c * q,
      f: food.f * q
    };
  }

  function todayFood() {
    return state.foodLogs.filter(x => x.date === today());
  }

  function todayExercise() {
    return state.exerciseLogs.filter(x => x.date === today());
  }

  function todayBehavior() {
    return state.behaviorLogs.find(x => x.date === today()) || {
      date: today(), cigarettes: 0, beerMl: 0, beerAbv: 5,
      baijiuMl: 0, baijiuAbv: 52, lateHours: 0
    };
  }

  function ethanolGrams(ml, abv) {
    return Math.max(0, Number(ml) || 0) * Math.max(0, Number(abv) || 0) / 100 * 0.789;
  }

  function behaviorLoad(b) {
    const cigarettes = Math.max(0, Number(b.cigarettes) || 0);
    const alcohol = ethanolGrams(b.beerMl, b.beerAbv) + ethanolGrams(b.baijiuMl, b.baijiuAbv);
    const late = Math.max(0, Number(b.lateHours) || 0);

    const smokingPoints = cigarettes > 0 ? Math.min(45, 12 + cigarettes * 1.65) : 0;
    const alcoholPoints = alcohol > 0 ? Math.min(35, 6 + alcohol * 0.75) : 0;
    const latePoints = late > 0 ? Math.min(30, 5 + late * 8) : 0;
    const score = Math.min(100, smokingPoints + alcoholPoints + latePoints);

    return { cigarettes, alcohol, late, smokingPoints, alcoholPoints, latePoints, score };
  }

  function dateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function renderBehavior() {
    const b = todayBehavior();
    const load = behaviorLoad(b);

    if (el('cigarettes')) el('cigarettes').value = b.cigarettes || 0;
    if (el('beerMl')) el('beerMl').value = b.beerMl || 0;
    if (el('beerAbv')) el('beerAbv').value = b.beerAbv == null ? 5 : b.beerAbv;
    if (el('baijiuMl')) el('baijiuMl').value = b.baijiuMl || 0;
    if (el('baijiuAbv')) el('baijiuAbv').value = b.baijiuAbv == null ? 52 : b.baijiuAbv;
    if (el('lateHours')) el('lateHours').value = b.lateHours || 0;

    if (el('alcoholCalc')) {
      el('alcoholCalc').textContent =
        '纯酒精估算：' + round(load.alcohol, 1) + ' g。换算按体积 × 酒精度 × 0.789 g/ml 估算。';
    }

    if (el('buffScore')) el('buffScore').textContent = round(load.score);
    if (el('buffMeter')) el('buffMeter').style.width = clamp(load.score, 0, 100) + '%';

    const smokeClass = load.cigarettes > 0 ? 'bad' : 'good';
    const alcoholClass = load.alcohol <= 0 ? 'good' : (load.alcohol >= 30 ? 'bad' : 'warn');
    const lateClass = load.late <= 0 ? 'good' : (load.late >= 2 ? 'bad' : 'warn');

    if (el('buffChips')) {
      el('buffChips').innerHTML =
        '<span class="buff-chip ' + smokeClass + '">🚬 ' + round(load.cigarettes) + ' 支</span>' +
        '<span class="buff-chip ' + alcoholClass + '">🍺 酒精 ' + round(load.alcohol,1) + 'g</span>' +
        '<span class="buff-chip ' + lateClass + '">🌙 熬夜 ' + round(load.late,1) + 'h</span>';
    }

    const messages = [];
    if (load.cigarettes > 0) messages.push('吸烟：所有烟草使用都有害，不设置“安全支数”');
    if (load.alcohol > 0) messages.push('饮酒：记录纯酒精克数，不把少量饮酒标成“安全”');
    if (load.late > 0) messages.push('熬夜：建议同时观察连续天数和总睡眠，而不是只看单晚');
    if (!messages.length) messages.push('今天这三项负 Buff 均为 0');
    if (el('buffSummary')) {
      el('buffSummary').textContent =
        messages.join('；') + '。0–100 分仅用于个人趋势可视化，不是临床风险预测。';
    }

    if (el('behaviorTrend')) {
      const days = [];
      for (let i = -6; i <= 0; i++) {
        const date = dateOffset(i);
        const item = state.behaviorLogs.find(x => x.date === date);
        const score = item ? behaviorLoad(item).score : 0;
        days.push({date, score});
      }
      el('behaviorTrend').innerHTML = days.map(x => {
        const h = Math.max(2, Math.round(clamp(x.score,0,100) * 0.34));
        return '<div class="day"><div class="col" style="height:' + h + 'px"></div><small>' +
          x.date.slice(5).replace('-','/') + '</small></div>';
      }).join('');
    }
  }

  function sumNutrition(logs) {
    return logs.reduce((a, x) => {
      a.kcal += Number(x.kcal || 0);
      a.p += Number(x.p || 0);
      a.c += Number(x.c || 0);
      a.f += Number(x.f || 0);
      return a;
    }, {kcal:0,p:0,c:0,f:0});
  }

  let iosStepCache = null;

  window.FitNative = window.FitNative || {};
  let androidStepCache = null;
  let androidStepConfidence = '';

  window.FitNative.receiveSteps = function(value) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) {
      iosStepCache = n;
      try { renderSteps(); renderHome(); } catch (e) {}
    }
  };

  window.FitNative.receiveAndroidSteps = function(value, source, confidence) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) {
      androidStepCache = n;
      androidStepConfidence = String(confidence || '');
      state.stepHistory[today()] = n;
      save();
      try { renderSteps(); renderHome(); renderReport(); syncTodayMetricsToNative(); } catch (e) {}
    }
  };

  function postIosNative(action, payload) {
    try {
      const handler = window.webkit &&
        window.webkit.messageHandlers &&
        window.webkit.messageHandlers.fitbridge;
      if (handler && typeof handler.postMessage === 'function') {
        handler.postMessage({action, payload: payload || {}});
        return true;
      }
    } catch (e) {}
    return false;
  }

  function sanitizePhone(value) {
    return String(value || '').replace(/[^0-9+]/g, '').slice(0, 24);
  }

  function callNumber(value) {
    const phone = sanitizePhone(value);
    if (!phone) return toast('请先填写电话号码');
    try {
      if (window.FitBridge && typeof FitBridge.dialNumber === 'function') {
        FitBridge.dialNumber(phone);
        return;
      }
      if (postIosNative('dialNumber', {phone})) return;
      window.location.href = 'tel:' + phone;
    } catch (e) {
      window.location.href = 'tel:' + phone;
    }
  }

  function cardiovascularModeOn() {
    const p = state.profile;
    return !!(p.hypertension || p.heartDisease || p.priorMI || p.priorStroke);
  }

  function renderEmergency() {
    const p = state.profile;
    const contacts = p.emergencyContacts || [];
    const c1 = contacts[0] || {};
    const c2 = contacts[1] || {};
    const section = el('emergencySection');

    if (section) {
      section.style.display = cardiovascularModeOn() || c1.phone || c2.phone ? '' : 'none';
    }

    const box = el('emergencyContactButtons');
    if (box) {
      const button = (c, idx) => {
        const phone = sanitizePhone(c.phone);
        const label = c.name || ('联系人 ' + idx);
        const meta = [c.relation, phone].filter(Boolean).join(' · ');
        return '<button class="contact-call" type="button" data-call-contact="' + (idx-1) + '"' +
          (phone ? '' : ' disabled') + '><b>☎ ' + label + '</b><small>' +
          (meta || '尚未设置') + '</small></button>';
      };
      box.innerHTML = button(c1,1) + button(c2,2);
      box.querySelectorAll('[data-call-contact]').forEach(btn => {
        btn.onclick = () => {
          const c = contacts[Number(btn.dataset.callContact)] || {};
          callNumber(c.phone);
        };
      });
    }

    if (el('profileCallPrimaryBtn')) {
      el('profileCallPrimaryBtn').disabled = !sanitizePhone(c1.phone);
      el('profileCallPrimaryBtn').textContent = c1.phone ? ('☎ 呼叫 ' + (c1.name || '主要联系人')) : '☎ 主要联系人未设置';
    }
  }

  function showOnboardingIfNeeded() {
    if (!state.onboardingCompleted && el('onboarding')) {
      el('onboarding').classList.add('on');
    }
  }

  function completeOnboarding(skip) {
    const p = state.profile;
    if (!skip) {
      p.age = clamp(Number(el('onAge').value || p.age), 14, 100);
      p.weight = clamp(Number(el('onWeight').value || p.weight), 30, 300);
      p.hypertension = !!el('onHypertension').checked;
      p.heartDisease = !!el('onHeartDisease').checked;
      p.priorMI = !!el('onPriorMI').checked;
      p.priorStroke = !!el('onPriorStroke').checked;
      p.diabetes = !!el('onDiabetes').checked;
      p.gout = !!el('onGout').checked;
      const name = String(el('onIceName').value || '').trim();
      const phone = sanitizePhone(el('onIcePhone').value);
      if (name || phone) {
        p.emergencyContacts[0] = {name, relation:'紧急联系人', phone};
      }
    }
    state.onboardingCompleted = true;
    save();
    if (el('onboarding')) el('onboarding').classList.remove('on');
    renderAll();
    toast(skip ? '已跳过，可稍后在“我的”填写' : '基础资料已保存');
  }

  function readSteps() {
    const manual = Number(state.manualSteps[today()] || 0);
    try {
      if (window.FitBridge && typeof FitBridge.getTodaySteps === 'function') {
        const n = Number(FitBridge.getTodaySteps());
        if (n >= 0) {
          androidStepCache = n;
          let status = null;
          try {
            if (typeof FitBridge.getStepStatusJson === 'function') {
              status = JSON.parse(FitBridge.getStepStatusJson() || '{}');
            }
          } catch (e) {}
          const conf = status && status.confidence ? status.confidence : androidStepConfidence;
          const suffix = conf === 'sensor_delta' ? '实时累计' :
            conf === 'first_baseline' ? '首次基线' :
            conf && conf.indexOf('cross_day') >= 0 ? '跨日估算' :
            conf && conf.indexOf('reboot') >= 0 ? '重启后估算' : '传感器';
          el('stepSource').textContent = 'Android TYPE_STEP_COUNTER · ' + suffix;
          return n;
        }
        if (n === -2) el('stepSource').textContent = '需要活动识别权限，点击下方授权';
        else el('stepSource').textContent = '设备没有 TYPE_STEP_COUNTER，使用手动步数';
      } else if (postIosNative('getTodaySteps')) {
        el('stepSource').textContent = iosStepCache == null ? 'iOS 步数读取中' : 'iOS Core Motion';
        if (iosStepCache != null) return iosStepCache;
      } else {
        el('stepSource').textContent = '手动步数';
      }
    } catch (e) {
      el('stepSource').textContent = '手动步数';
    }
    return manual;
  }

  function loadNativeStepHistory(days) {
    try {
      if (window.FitBridge && typeof FitBridge.getStepHistoryJson === 'function') {
        const rows = JSON.parse(FitBridge.getStepHistoryJson(Number(days || 30)) || '[]');
        if (Array.isArray(rows)) {
          rows.forEach(x => {
            if (x && x.date) state.stepHistory[x.date] = Number(x.steps || 0);
          });
          save();
          return rows;
        }
      }
    } catch (e) {}
    return [];
  }

  function stepCalories(steps) {
    const w = profileMetrics().w;
    return Math.max(0, steps) * w * 0.0005;
  }

  function activityBurn() {
    const steps = readSteps();
    const sKcal = stepCalories(steps);
    const logs = todayExercise();
    let stepLike = 0;
    let nonStep = 0;
    logs.forEach(x => {
      if (x.type === 'walk' || x.type === 'run') stepLike += Number(x.kcal || 0);
      else nonStep += Number(x.kcal || 0);
    });
    return {
      steps,
      stepKcal: sKcal,
      exerciseKcal: logs.reduce((a,x) => a + Number(x.kcal || 0), 0),
      total: nonStep + Math.max(sKcal, stepLike)
    };
  }

  function parseBridgeJson(value, fallback) {
    try {
      if (!value) return fallback;
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (e) {
      return fallback;
    }
  }

  function loadZhuangziStatus() {
    try {
      if (window.FitBridge && typeof FitBridge.getZhuangziStatusJson === 'function') {
        zhuangziStatus = parseBridgeJson(FitBridge.getZhuangziStatusJson(), null);
        if (zhuangziStatus && !zhuangziViewDay) zhuangziViewDay = Number(zhuangziStatus.current_day || 1);
        if (zhuangziStatus && zhuangziViewDay < 1) zhuangziViewDay = Number(zhuangziStatus.current_day || 1);
        return zhuangziStatus;
      }
    } catch (e) {}
    return null;
  }

  function getZhuangziDay(day) {
    try {
      if (window.FitBridge && typeof FitBridge.getZhuangziDayJson === 'function') {
        return parseBridgeJson(FitBridge.getZhuangziDayJson(Number(day)), null);
      }
    } catch (e) {}
    return null;
  }

  function renderZhuangzi() {
    const status = loadZhuangziStatus();
    if (!status) {
      if (el('zhuangziHomeTitle')) el('zhuangziHomeTitle').textContent = '本地庄子数据库暂不可用';
      if (el('zhuangziTitle')) el('zhuangziTitle').textContent = '本地庄子数据库暂不可用';
      return;
    }

    if (!zhuangziViewDay || zhuangziViewDay < 1 || zhuangziViewDay > Number(status.total_days || 30)) {
      zhuangziViewDay = Number(status.current_day || 1);
    }
    const current = getZhuangziDay(zhuangziViewDay) || status.current || {};
    const todayContent = status.current || current;
    const total = Number(status.total_days || 30);
    const checked = Number(status.checked_count || 0);

    if (el('zhuangziHomeDay')) el('zhuangziHomeDay').textContent = '第 ' + Number(status.current_day || 1) + ' 天';
    if (el('zhuangziHomeTitle')) el('zhuangziHomeTitle').textContent = todayContent.title || '今日庄子';
    if (el('zhuangziHomeQuote')) el('zhuangziHomeQuote').textContent = todayContent.original_text || '';
    if (el('zhuangziHomeAction')) el('zhuangziHomeAction').textContent = todayContent.action ? ('今日一事：' + todayContent.action) : '';
    if (el('zhuangziHomeProgress')) el('zhuangziHomeProgress').textContent = checked + ' / ' + total + ' 已完成';

    if (el('zhuangziDayBadge')) el('zhuangziDayBadge').textContent = '第 ' + Number(current.day_no || zhuangziViewDay) + ' / ' + total + ' 天';
    if (el('zhuangziTitle')) el('zhuangziTitle').textContent = current.title || '';
    if (el('zhuangziChapter')) el('zhuangziChapter').textContent = current.chapter ? ('《庄子·' + current.chapter + '》') : '';
    if (el('zhuangziCheckedCount')) el('zhuangziCheckedCount').textContent = checked;
    if (el('zhuangziProgressBar')) el('zhuangziProgressBar').style.width = clamp(checked / total * 100, 0, 100) + '%';
    if (el('zhuangziQuote')) el('zhuangziQuote').textContent = current.original_text || '';
    if (el('zhuangziStory')) el('zhuangziStory').textContent = current.story || '';
    if (el('zhuangziInterpretation')) el('zhuangziInterpretation').textContent = current.interpretation || '';
    if (el('zhuangziAction')) el('zhuangziAction').textContent = current.action || '';

    if (el('zhuangziTags')) {
      const tags = []
        .concat(Array.isArray(current.mood_tags) ? current.mood_tags : [])
        .concat(Array.isArray(current.health_tags) ? current.health_tags : []);
      el('zhuangziTags').innerHTML = tags.map(x => '<span class="dish-chip">' + x + '</span>').join('');
    }

    if (el('zhuangziPrevBtn')) el('zhuangziPrevBtn').disabled = zhuangziViewDay <= 1;
    if (el('zhuangziNextBtn')) el('zhuangziNextBtn').disabled = zhuangziViewDay >= total;
    if (el('zhuangziCheckBtn')) {
      el('zhuangziCheckBtn').classList.toggle('checked', !!current.checked);
      el('zhuangziCheckBtn').textContent = current.checked ? '✓ 已完成' : '✓ 标记完成';
    }

    if (el('zhuangziCycleNote')) {
      el('zhuangziCycleNote').textContent = status.cycle_complete
        ? '首轮 30 天已完成。现在可以自由翻阅复习；后续接入 API 时会通过内容版本同步扩展，不影响本地内容。'
        : '第 ' + Number(status.current_day || 1) + ' 天 · 从 ' + (status.start_date || '首次使用日') + ' 开始。本模块完全离线运行。';
    }
  }

  function openZhuangziModule() {
    const nav = document.querySelector('.nav-btn[data-page="recovery"]');
    if (nav) nav.click();
    setTimeout(() => {
      const s = el('zhuangziSection');
      if (s && s.scrollIntoView) s.scrollIntoView({behavior:'smooth',block:'start'});
    }, 50);
  }

  function renderDate() {
    const d = new Date();
    const wk = ['日','一','二','三','四','五','六'][d.getDay()];
    el('dateText').innerHTML = (d.getMonth()+1) + '月' + d.getDate() + '日<br>星期' + wk;
    el('weightDate').value = today();
  }

  function renderHome() {
    const nutrition = sumNutrition(todayFood());
    const activity = activityBurn();
    const m = profileMetrics();

    el('homeIntake').textContent = round(nutrition.kcal);
    el('homeBurn').textContent = round(activity.total);
    el('homeSteps').textContent = activity.steps;
    el('balanceKcal').textContent = round(nutrition.kcal - activity.total);

    el('proteinNow').textContent = round(nutrition.p, 1);
    el('carbNow').textContent = round(nutrition.c, 1);
    el('proteinGoal').textContent = round(m.proteinGoal);
    el('carbGoal').textContent = round(m.carbGoal);
    el('proteinBar').style.width = clamp(nutrition.p / m.proteinGoal * 100, 0, 100) + '%';
    el('carbBar').style.width = clamp(nutrition.c / m.carbGoal * 100, 0, 100) + '%';

    el('homeWeight').textContent = round(m.w,1);
    el('homeTdee').textContent = round(m.tdee);
    el('homeCalGoal').textContent = round(m.calGoal);
    el('bmiLabel').textContent = 'BMI ' + round(m.bmi,1);

    const remaining = m.calGoal - nutrition.kcal;
    el('heroHint').textContent = remaining >= 0
      ? '距今日热量目标约 ' + round(remaining) + ' kcal；以长期趋势为主。'
      : '今日已超过目标约 ' + round(Math.abs(remaining)) + ' kcal；不建议用极端禁食补偿。';

    el('macroGoalLabel').textContent = state.profile.diabetes
      ? '运动营养参考；糖尿病需个体化'
      : '基于体重与目标的运动营养估算';

    renderConditions();
    renderEmergency();
    renderFasting();
    renderBehavior();
    renderWeightCharts();
  }

  function renderConditions() {
    const wrap = el('conditionAlerts');
    const p = state.profile;
    const blocks = [];
    if (!p.diabetes && !p.gout && !p.hypertension && !p.heartDisease && !p.priorMI && !p.priorStroke) {
      blocks.push('<div class="alert">当前未开启疾病模式。可以在“我的 → 健康模式”补充基础疾病信息。</div>');
    }
    if (p.diabetes) {
      blocks.push('<div class="alert warn"><b>糖尿病：</b>重点看每餐碳水量与全天分布。若使用胰岛素或可能导致低血糖的药物，运动和禁食计划需要结合血糖监测及医疗建议。</div>');
    }
    if (p.gout) {
      blocks.push('<div class="alert warn"><b>痛风 / 高尿酸：</b>优先保证水分，限制酒精、高果糖饮料和高嘌呤食物，避免脱水和快速减重。</div>');
    }
    if (p.hypertension) {
      blocks.push('<div class="alert warn"><b>高血压：</b>运动强度和饮食钠管理应更保守；若出现胸痛、神经系统异常、明显呼吸困难或严重不适，停止运动并寻求医疗帮助。</div>');
    }
    if (p.heartDisease || p.priorMI) {
      blocks.push('<div class="alert red"><b>心脏病 / 既往心梗：</b>新的胸部压迫或疼痛、明显气短、恶心/头晕、下颌/颈/背或手臂肩部不适应按急症处理，不要等待 App 判断。</div>');
    }
    if (p.priorStroke) {
      blocks.push('<div class="alert red"><b>既往脑卒中 / TIA：</b>出现平衡、视力、面部、手臂或言语的突然异常时，用 B.E.F.A.S.T. 思路识别并立即求助，记录症状开始时间。</div>');
    }
    wrap.innerHTML = blocks.join('');
  }

  function renderFasting() {
    const p = state.profile;
    const wrap = el('fastingHomeWrap');
    if (!p.fasting) {
      el('fastStatus').textContent = '未开启';
      el('fastWindow').textContent = '在“我的”开启后显示当前窗口';
      el('fastCountdown').textContent = '--:--';
      el('fastWarning').innerHTML = '';
      return;
    }

    const parts = String(p.eatStart || '12:00').split(':').map(Number);
    const start = parts[0] * 60 + parts[1];
    const duration = Number(p.eatHours || 8) * 60;
    const end = (start + duration) % 1440;
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    const inWindow = duration >= 1440 ? true :
      start < end ? (current >= start && current < end) : (current >= start || current < end);

    const target = inWindow ? end : start;
    let diff = target - current;
    if (diff <= 0) diff += 1440;
    const hh = Math.floor(diff / 60);
    const mm = diff % 60;

    el('fastStatus').textContent = inWindow ? '进食窗口' : '禁食窗口';
    el('fastWindow').textContent = '进食 ' + p.eatStart + ' 起，共 ' + p.eatHours + ' 小时';
    el('fastCountdown').textContent = hh + ':' + String(mm).padStart(2,'0');

    let warning = '';
    if (p.diabetes) warning += '<div class="alert red">糖尿病模式已开启：若使用胰岛素或可能导致低血糖的药物，不应仅按 App 倒计时自行延长禁食。</div>';
    if (p.gout) warning += '<div class="alert warn">痛风模式已开启：禁食期间也要避免脱水，并避免用快速减重方式追求热量缺口。</div>';
    el('fastWarning').innerHTML = warning;
  }

  function evaluateFoodRisk(foodId) {
    try {
      if (window.FitBridge && typeof FitBridge.evaluateFoodRiskJson === 'function') {
        return parseBridgeJson(
          FitBridge.evaluateFoodRiskJson(foodId, JSON.stringify(state.profile)),
          {status:'neutral',items:[],has_rules:false}
        );
      }
    } catch (e) {}
    const f = foods.find(x => x.id === foodId);
    if (state.profile.gout && f) {
      if (f.purine === 'high') return {status:'red',items:[{disease:'gout',status:'red',reason:'高嘌呤食物，痛风模式下建议限制。'}],has_rules:true};
      if (f.purine === 'moderate') return {status:'yellow',items:[{disease:'gout',status:'yellow',reason:'中等嘌呤，注意份量。'}],has_rules:true};
      return {status:'green',items:[{disease:'gout',status:'green',reason:'低嘌呤选择。'}],has_rules:true};
    }
    return {status:'neutral',items:[],has_rules:false};
  }

  function riskIcon(status) {
    return status === 'red' ? '🔴' : status === 'yellow' ? '🟡' : status === 'green' ? '🟢' : '⚪';
  }

  function foodOptionHtml(selectedId) {
    return foods.map(f => {
      const risk = evaluateFoodRisk(f.id);
      return '<option value="' + f.id + '"' + (f.id === selectedId ? ' selected' : '') + '>' +
        riskIcon(risk.status) + ' ' + f.icon + ' ' + f.name + '</option>';
    }).join('');
  }

  function renderQuickFoods() {
    const quick = foods.slice(0, 10);
    el('quickFoods').innerHTML = quick.map(f => {
      const risk = evaluateFoodRisk(f.id);
      return '<button class="quick risk-' + risk.status + '" data-food="' + f.id + '">' +
        riskIcon(risk.status) + ' ' + f.icon + ' ' + f.name + '</button>';
    }).join('');
    el('quickFoods').querySelectorAll('[data-food]').forEach(btn => {
      btn.onclick = () => {
        el('foodSelect').value = btn.dataset.food;
        renderFoodEstimate();
      };
    });
  }

  function renderFoodControls() {
    const selected = el('foodSelect') ? el('foodSelect').value : foods[0].id;
    const photoSelected = el('photoFoodSelect') ? el('photoFoodSelect').value : foods[0].id;
    el('foodSelect').innerHTML = foodOptionHtml(selected);
    el('photoFoodSelect').innerHTML = foodOptionHtml(photoSelected);
    renderQuickFoods();

    el('foodSelect').onchange = renderFoodEstimate;
    el('foodGram').oninput = renderFoodEstimate;
    el('photoFoodSelect').onchange = renderPhotoEstimate;
    el('photoFoodGram').oninput = renderPhotoEstimate;
    renderFoodEstimate();
    renderPhotoEstimate();
  }

  function getFoodById(id) {
    return foods.find(f => f.id === id) || foods[0];
  }

  function renderFoodRiskPanel(food) {
    const risk = evaluateFoodRisk(food.id);
    const panel = el('foodRiskPanel');
    if (!panel) return risk;
    panel.className = 'food-risk-panel ' + (risk.status || 'neutral');
    el('foodRiskTitle').textContent =
      risk.status === 'red' ? '红色：当前健康模式下建议限制' :
      risk.status === 'yellow' ? '黄色：注意份量、频率或烹调方式' :
      risk.status === 'green' ? '绿色：当前健康模式下相对友好' :
      '当前未启用疾病联动';
    const reasons = (risk.items || []).map(x => {
      const d = x.disease === 'gout' ? '痛风' :
        x.disease === 'diabetes' ? '糖尿病' :
        x.disease === 'hypertension' ? '高血压' : '心血管';
      return d + '：' + x.reason + (x.evidence_id ? ' [' + x.evidence_id + ']' : '');
    });
    el('foodRiskReason').textContent = reasons.length
      ? reasons.join('；')
      : '在“我的 → 健康模式”开启疾病后，食物会按红 / 黄 / 绿联动。';
    return risk;
  }

  function renderFoodEstimate() {
    const food = getFoodById(el('foodSelect').value);
    const grams = Number(el('foodGram').value || 0);
    const n = calcFood(food, grams);
    const risk = renderFoodRiskPanel(food);
    let text = round(n.kcal) + ' kcal · 蛋白 ' + round(n.p,1) + 'g · 碳水 ' + round(n.c,1) + 'g · 脂肪 ' + round(n.f,1) + 'g';
    if (food.basis) text += ' ｜ 基准：' + food.basis;
    if (food.source_name) text += ' ｜ 来源：' + food.source_name;
    if (food.source_note) text += ' ｜ ' + food.source_note;
    if (state.profile.diabetes && n.c >= 30) text += ' ｜ 本份碳水约 ' + round(n.c,1) + 'g';
    if (risk.status && risk.status !== 'neutral') text += ' ｜ ' + riskIcon(risk.status) + ' 疾病联动';
    el('foodEstimate').textContent = text;
  }

  function renderPhotoEstimate() {
    const food = getFoodById(el('photoFoodSelect').value);
    const grams = Number(el('photoFoodGram').value || 0);
    const n = calcFood(food, grams);
    el('photoEstimate').textContent = round(n.kcal) + ' kcal · P ' + round(n.p,1) + 'g · C ' + round(n.c,1) + 'g';
  }

  function addFoodLog(food, grams, source) {
    const n = calcFood(food, grams);
    const risk = evaluateFoodRisk(food.id);
    state.foodLogs.push({
      id: uid(), date: today(), name: food.name, foodId: food.id, grams: Number(grams),
      kcal:n.kcal,p:n.p,c:n.c,f:n.f,source:source || '手动',
      riskStatus:risk.status || 'neutral'
    });
    save();
    renderAll();
  }

  function renderFoodLog() {
    const logs = todayFood().slice().reverse();
    const box = el('foodLog');
    const total = sumNutrition(todayFood());
    el('nutritionSummary').textContent = '今日 ' + round(total.kcal) + ' kcal';
    if (!logs.length) {
      box.innerHTML = '<div class="empty">今天还没有饮食记录</div>';
      return;
    }
    box.innerHTML = logs.map(x => {
      const f = getFoodById(x.foodId);
      return '<div class="item" data-log="' + x.id + '"><div class="item-icon">' + (f ? f.icon : '🍽️') +
        '</div><div class="item-main"><div class="item-title">' + x.name + ' · ' + round(x.grams) + 'g</div>' +
        '<div class="item-sub">' + x.source + ' · P ' + round(x.p,1) + 'g · C ' + round(x.c,1) + 'g · F ' + round(x.f,1) + 'g</div></div>' +
        '<div class="item-side"><b>' + round(x.kcal) + '</b><span class="note">kcal</span><button class="del" data-del="' + x.id + '">×</button></div></div>';
    }).join('');
    box.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        state.foodLogs = state.foodLogs.filter(x => x.id !== btn.dataset.del);
        save();
        renderAll();
      };
    });
  }

  function handlePhotoInput() {
    const input = el('photoInput');
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const img = el('mealPhoto');
      img.src = URL.createObjectURL(file);
      img.style.display = 'block';
      el('photoPlaceholder').style.display = 'none';
      photoDish = [];
      renderDish();
      toast('照片已载入，请选择/校正食物和份量');
    };
  }

  function renderDish() {
    el('dishComponents').innerHTML = photoDish.map((x,i) =>
      '<span class="dish-chip">' + x.icon + ' ' + x.name + ' ' + round(x.grams) + 'g <b data-rm="' + i + '">×</b></span>'
    ).join('');
    el('dishComponents').querySelectorAll('[data-rm]').forEach(x => x.onclick = () => {
      photoDish.splice(Number(x.dataset.rm),1);
      renderDish();
    });
    const total = photoDish.reduce((a,x) => {
      a.kcal += x.kcal;a.p += x.p;a.c += x.c;a.f += x.f;return a;
    },{kcal:0,p:0,c:0,f:0});
    el('dishTotal').textContent = photoDish.length
      ? '餐盘合计约 ' + round(total.kcal) + ' kcal · P ' + round(total.p,1) + 'g · C ' + round(total.c,1) + 'g'
      : '尚未加入餐盘内容';
  }

  function renderSteps() {
    const a = activityBurn();
    const goal = Math.max(1, Number(state.profile.stepGoal || 8000));
    el('stepsValue').textContent = a.steps;
    el('stepKcal').textContent = round(a.stepKcal);
    el('stepGoalText').textContent = goal;
    el('stepsRing').style.setProperty('--p', clamp(a.steps / goal * 100,0,100) + '%');
    el('manualSteps').value = state.manualSteps[today()] || '';
    el('activityKcalLabel').textContent = round(a.total) + ' kcal';
    state.stepHistory[today()] = a.steps;
    save();
  }

  function renderExerciseTypes() {
    const types = allExerciseTypes();
    if (!types.find(x => x.id === selectedExercise)) selectedExercise = types[0].id;
    const box = el('exerciseTypes');
    box.innerHTML = types.map(x =>
      '<button data-type="' + x.id + '" class="' + (x.id === selectedExercise ? 'on' : '') + '">' +
      (x.icon || '✨') + '<br>' + x.label + '</button>'
    ).join('');
    box.querySelectorAll('[data-type]').forEach(btn => {
      btn.onclick = () => {
        selectedExercise = btn.dataset.type;
        renderExerciseTypes();
        renderExerciseEstimate();
      };
    });
    renderExerciseEstimate();
  }

  function exerciseCalc(type, min) {
    const def = allExerciseTypes().find(x => x.id === type) || allExerciseTypes()[0];
    const weight = profileMetrics().w;
    return Number(def.met || 1.3) * weight * (Number(min || 0) / 60);
  }

  function renderExerciseEstimate() {
    const def = allExerciseTypes().find(x => x.id === selectedExercise) || allExerciseTypes()[0];
    const kcal = exerciseCalc(selectedExercise, el('exerciseMin').value);
    const suffix = def.category === 'meditation'
      ? ' · 冥想热量仅作低强度能量估算'
      : ' · MET 粗略估算';
    el('exerciseEstimate').textContent = '约 ' + round(kcal) + ' kcal' + suffix;
  }

  function renderExerciseLog() {
    const logs = todayExercise().slice().reverse();
    const box = el('exerciseLog');
    if (!logs.length) {
      box.innerHTML = '<div class="empty">今天还没有运动/冥想记录</div>';
      return;
    }
    box.innerHTML = logs.map(x => {
      const d = allExerciseTypes().find(t => t.id === x.type) || {
        label:x.label || '自定义项目', icon:x.icon || '✨', category:x.category || 'exercise'
      };
      return '<div class="item"><div class="item-icon">' + (x.icon || d.icon) + '</div><div class="item-main"><div class="item-title">' +
        (x.label || d.label) + ' · ' + round(x.min) + ' 分钟</div><div class="item-sub">' +
        (x.note || (d.category === 'meditation' ? '冥想/呼吸' : '无备注')) +
        '</div></div><div class="item-side"><b>' + round(x.kcal) + '</b><span class="note">kcal</span><button class="del" data-exdel="' + x.id + '">×</button></div></div>';
    }).join('');
    box.querySelectorAll('[data-exdel]').forEach(btn => {
      btn.onclick = () => {
        state.exerciseLogs = state.exerciseLogs.filter(x => x.id !== btn.dataset.exdel);
        save();renderAll();
      };
    });
  }

  function recoveryModel(item, atHours) {
    if (!item || !item.lastTs) return {readiness:100,tau:18,hours:999};
    const elapsed = atHours == null
      ? Math.max(0,(Date.now() - Number(item.lastTs)) / 3600000)
      : Math.max(0,Number(atHours));
    const rpe = clamp(Number(item.rpe || 7),1,10);
    const duration = clamp(Number(item.duration || 45),5,240);
    const soreness = clamp(Number(item.soreness || 0),0,5);
    const sleep = clamp(Number(item.sleep || 7),0,14);
    const loadFactor = clamp((rpe / 7) * Math.sqrt(duration / 45), 0.6, 1.9);
    const sleepFactor = sleep < 6 ? 1.30 : sleep < 7 ? 1.14 : sleep >= 8 ? 0.92 : 1.0;
    const sorenessFactor = 1 + soreness * 0.11;
    const tau = 19 * loadFactor * sleepFactor * sorenessFactor;
    let readiness = 100 * (1 - Math.exp(-elapsed / tau));
    if (atHours == null && soreness >= 4 && elapsed < 48) readiness = Math.min(readiness,55);
    if (atHours == null && soreness >= 3 && elapsed < 24) readiness = Math.min(readiness,45);
    return {readiness:clamp(readiness,0,100),tau,hours:elapsed};
  }

  function recoveryStatus(item) {
    const m = recoveryModel(item);
    if (!item || !item.lastTs) return {cls:'good',text:'可安排训练',meta:'暂无近期记录',readiness:100};
    const s = Number(item.soreness || 0);
    if (m.readiness < 45 || s >= 4) return {cls:'bad',text:'优先恢复',meta:round(m.hours) + ' 小时前训练 · 酸痛 ' + s + '/5',readiness:m.readiness};
    if (m.readiness < 75 || s >= 2) return {cls:'mid',text:'恢复中',meta:round(m.hours) + ' 小时前训练 · 酸痛 ' + s + '/5',readiness:m.readiness};
    return {cls:'good',text:'就绪度较高',meta:round(m.hours) + ' 小时前训练 · 酸痛 ' + s + '/5',readiness:m.readiness};
  }

  function recoveryCurveSvg(item) {
    const w = 340, h = 125, padX = 26, padY = 14;
    const points = [];
    for (let hr=0; hr<=96; hr+=8) {
      const v = recoveryModel(item,hr).readiness;
      const x = padX + hr/96*(w-padX-8);
      const y = h-padY - v/100*(h-padY*2);
      points.push([x,y,hr,v]);
    }
    const poly = points.map(p => p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const nowH = item && item.lastTs ? Math.min(96,Math.max(0,(Date.now()-Number(item.lastTs))/3600000)) : 96;
    const nowV = recoveryModel(item,nowH).readiness;
    const nx = padX + nowH/96*(w-padX-8);
    const ny = h-padY - nowV/100*(h-padY*2);
    return '<svg viewBox="0 0 '+w+' '+h+'">' +
      '<line x1="'+padX+'" y1="'+(h-padY)+'" x2="'+(w-8)+'" y2="'+(h-padY)+'" stroke="#314238"/>' +
      '<line x1="'+padX+'" y1="'+padY+'" x2="'+padX+'" y2="'+(h-padY)+'" stroke="#314238"/>' +
      '<polyline points="'+poly+'" fill="none" stroke="#9ee36d" stroke-width="3"/>' +
      '<circle cx="'+nx+'" cy="'+ny+'" r="5" fill="#f2cb6b"/>' +
      '<text x="2" y="18" fill="#7f8d84" font-size="9">100%</text>' +
      '<text x="'+padX+'" y="'+(h-2)+'" fill="#7f8d84" font-size="9">0h</text>' +
      '<text x="'+(w/2-10)+'" y="'+(h-2)+'" fill="#7f8d84" font-size="9">48h</text>' +
      '<text x="'+(w-30)+'" y="'+(h-2)+'" fill="#7f8d84" font-size="9">96h</text>' +
      '</svg>';
  }

  function renderRecoveryAdvanced() {
    const def = muscleDefs.find(x => x[0] === selectedMuscle) || muscleDefs[2];
    const item = state.recovery[selectedMuscle] || {};
    const status = recoveryStatus(item);
    if (el('recoveryMuscleName')) el('recoveryMuscleName').textContent = def[1];
    if (el('recoveryReadiness')) el('recoveryReadiness').textContent = round(status.readiness);
    if (el('recoveryCurve')) el('recoveryCurve').innerHTML = recoveryCurveSvg(item);
    if (el('recoveryRpe')) el('recoveryRpe').value = item.rpe || 7;
    if (el('recoverySoreness')) el('recoverySoreness').value = item.soreness == null ? 2 : item.soreness;
    if (el('recoveryDuration')) el('recoveryDuration').value = item.duration || 45;
    if (el('recoverySleep')) el('recoverySleep').value = item.sleep || 7;
    if (el('recoveryEvidenceNote')) {
      el('recoveryEvidenceNote').textContent =
        '研究提示阻力训练后的肌蛋白合成可升高至约 48 小时，但个体差异很大；延迟性肌肉酸痛常在约 24–72 小时较明显。这里显示的是训练管理“就绪度估算”，不是肌肉损伤检测。';
    }

    document.querySelectorAll('.muscle-zone').forEach(z => {
      const id = z.dataset.muscle;
      const s = recoveryStatus(state.recovery[id] || {});
      z.classList.remove('state-green','state-yellow','state-red','selected');
      z.classList.add(s.cls === 'bad' ? 'state-red' : s.cls === 'mid' ? 'state-yellow' : 'state-green');
      if (id === selectedMuscle) z.classList.add('selected');
    });
  }

  function renderRecovery() {
    const box = el('muscleGrid');
    box.innerHTML = muscleDefs.map(([id,name]) => {
      const item = state.recovery[id] || {};
      const r = recoveryStatus(item);
      let sore = '';
      for (let i=0;i<=5;i++) sore += '<button data-sore="' + id + ':' + i + '" class="' + (Number(item.soreness||0)===i?'on':'') + '">' + i + '</button>';
      return '<div class="muscle ' + r.cls + '"><div class="between"><div class="name">' + name + '</div><button class="btn ghost" data-trained="' + id + '" style="padding:7px 8px;font-size:10px">今天练了</button></div>' +
        '<div class="ready">' + r.text + ' · ' + round(r.readiness) + '%</div><div class="meta">' + r.meta + '</div><div class="soreness">' + sore + '</div></div>';
    }).join('');

    box.querySelectorAll('[data-trained]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.trained;
      state.recovery[id] = {...(state.recovery[id]||{}),lastTs:Date.now(),soreness:2,rpe:7,duration:45,sleep:7};
      selectedMuscle=id;
      save();renderRecovery();toast('已记录训练');
    });
    box.querySelectorAll('[data-sore]').forEach(btn => btn.onclick = () => {
      const [id,score] = btn.dataset.sore.split(':');
      state.recovery[id] = {...(state.recovery[id]||{}),soreness:Number(score)};
      selectedMuscle=id;
      save();renderRecovery();
    });
    renderRecoveryAdvanced();
  }

  function renderProfile() {
    const p = state.profile;
    el('sex').value = p.sex;
    el('age').value = p.age;
    el('height').value = p.height;
    el('weight').value = p.weight;
    el('goal').value = p.goal;
    el('activityLevel').value = String(p.activityLevel);
    el('stepGoal').value = p.stepGoal;
    el('manualCalGoal').value = p.manualCalGoal || '';
    el('eatStart').value = p.eatStart || '12:00';
    el('eatHours').value = String(p.eatHours || 8);
    el('diabetesSwitch').classList.toggle('on', !!p.diabetes);
    el('goutSwitch').classList.toggle('on', !!p.gout);
    el('hypertensionSwitch').classList.toggle('on', !!p.hypertension);
    el('heartDiseaseSwitch').classList.toggle('on', !!p.heartDisease);
    el('priorMISwitch').classList.toggle('on', !!p.priorMI);
    el('priorStrokeSwitch').classList.toggle('on', !!p.priorStroke);
    el('fastingSwitch').classList.toggle('on', !!p.fasting);

    const contacts = p.emergencyContacts || [];
    const c1 = contacts[0] || {};
    const c2 = contacts[1] || {};
    el('ice1Name').value = c1.name || '';
    el('ice1Relation').value = c1.relation || '';
    el('ice1Phone').value = c1.phone || '';
    el('ice2Name').value = c2.name || '';
    el('ice2Relation').value = c2.relation || '';
    el('ice2Phone').value = c2.phone || '';

    const m = profileMetrics();
    el('profileCalc').innerHTML =
      'BMI <b>' + round(m.bmi,1) + '</b> · BMR 约 <b>' + round(m.bmr) + '</b> kcal · TDEE 约 <b>' + round(m.tdee) +
      '</b> kcal · 当前热量目标约 <b>' + round(m.calGoal) + '</b> kcal。<br>蛋白参考 ' + round(m.proteinGoal) +
      'g/日，碳水参考 ' + round(m.carbGoal) + 'g/日；这些是运动营养估算，不是疾病治疗处方。';

    el('weightEntry').value = p.weight || '';
    renderWeightCharts();
  }

  function renderWeightCharts() {
    const list = state.weightLogs.slice().sort((a,b) => a.date.localeCompare(b.date)).slice(-10);
    if (!list.length && state.profile.weight) list.push({date:today(),weight:Number(state.profile.weight)});
    const html = weightChartSvg(list);
    el('weightChart').innerHTML = html;
    el('profileWeightChart').innerHTML = html;
  }

  function weightChartSvg(list) {
    if (!list.length) return '<div class="empty">暂无体重趋势</div>';
    const w = 320, h = 90, pad = 12;
    const vals = list.map(x => Number(x.weight));
    let min = Math.min(...vals), max = Math.max(...vals);
    if (max - min < 1) { min -= .5; max += .5; }
    const pts = list.map((x,i) => {
      const px = list.length === 1 ? w/2 : pad + i * (w-2*pad)/(list.length-1);
      const py = h-pad - (Number(x.weight)-min)/(max-min)*(h-2*pad);
      return [px,py,x];
    });
    const poly = pts.map(p => p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const circles = pts.map(p => '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3"></circle>').join('');
    const first = list[0], last = list[list.length-1];
    return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><polyline points="'+poly+'"></polyline>'+circles+
      '<text x="2" y="10">'+round(max,1)+'kg</text><text x="2" y="'+(h-2)+'">'+round(min,1)+'kg</text>'+
      '<text x="'+(w-70)+'" y="10">'+last.date.slice(5)+'</text></svg>';
  }

  function inLastDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    const start = new Date();
    start.setHours(0,0,0,0);
    start.setDate(start.getDate() - (days - 1));
    return d >= start && d <= new Date();
  }

  function reportAggregate(days) {
    loadNativeStepHistory(days);
    const food = state.foodLogs.filter(x => inLastDays(x.date,days));
    const exercise = state.exerciseLogs.filter(x => inLastDays(x.date,days));
    const behavior = state.behaviorLogs.filter(x => inLastDays(x.date,days));
    const weights = state.weightLogs.filter(x => inLastDays(x.date,days)).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const nutrition = sumNutrition(food);
    const activeDays = new Set();
    food.forEach(x=>activeDays.add(x.date));
    exercise.forEach(x=>activeDays.add(x.date));
    behavior.forEach(x=>activeDays.add(x.date));
    Object.keys(state.stepHistory||{}).filter(d=>inLastDays(d,days)).forEach(d=>activeDays.add(d));
    weights.forEach(x=>activeDays.add(x.date));

    let stepSum=0,stepDays=0;
    Object.entries(state.stepHistory||{}).forEach(([d,v])=>{
      if(inLastDays(d,days)){stepSum+=Number(v||0);stepDays++;}
    });
    const exerciseMin = exercise.reduce((a,x)=>a+Number(x.min||0),0);
    const exerciseKcal = exercise.reduce((a,x)=>a+Number(x.kcal||0),0);
    const cigarettes = behavior.reduce((a,x)=>a+Number(x.cigarettes||0),0);
    const alcohol = behavior.reduce((a,x)=>a+ethanolGrams(x.beerMl,x.beerAbv)+ethanolGrams(x.baijiuMl,x.baijiuAbv),0);
    const lateHours = behavior.reduce((a,x)=>a+Number(x.lateHours||0),0);
    const redFoods = food.filter(x => {
      if (x.riskStatus) return x.riskStatus === 'red';
      return evaluateFoodRisk(x.foodId).status === 'red';
    }).length;
    const meditationMin = exercise.filter(x => {
      const def=allExerciseTypes().find(t=>t.id===x.type);
      return (x.category || (def&&def.category)) === 'meditation';
    }).reduce((a,x)=>a+Number(x.min||0),0);
    const weightDelta = weights.length >= 2 ? Number(weights[weights.length-1].weight)-Number(weights[0].weight) : null;

    const daily = [];
    for(let i=days-1;i>=0;i--){
      const d=dateOffset(-i);
      const f=sumNutrition(state.foodLogs.filter(x=>x.date===d));
      const ex=state.exerciseLogs.filter(x=>x.date===d).reduce((a,x)=>a+Number(x.kcal||0),0);
      const st=Number((state.stepHistory||{})[d]||0);
      daily.push({date:d,intake:f.kcal,burn:ex+stepCalories(st)});
    }

    return {
      days,food,exercise,behavior,weights,nutrition,exerciseMin,exerciseKcal,cigarettes,alcohol,lateHours,
      redFoods,meditationMin,weightDelta,avgSteps:stepDays?stepSum/stepDays:0,
      completeness:Math.round(activeDays.size/days*100),daily
    };
  }

  function reportTrendSvg(daily) {
    const w=340,h=105,p=12;
    const vals=daily.flatMap(x=>[x.intake,x.burn]);
    const max=Math.max(1,...vals);
    const pts=(key)=>daily.map((x,i)=>{
      const px=p+(daily.length===1?0:i*(w-2*p)/(daily.length-1));
      const py=h-p-(Number(x[key]||0)/max)*(h-2*p);
      return px.toFixed(1)+','+py.toFixed(1);
    }).join(' ');
    return '<svg viewBox="0 0 '+w+' '+h+'">' +
      '<polyline points="'+pts('intake')+'" fill="none" stroke="#9ee36d" stroke-width="2.5"/>' +
      '<polyline points="'+pts('burn')+'" fill="none" stroke="#77bdfb" stroke-width="2.5"/>' +
      '<text x="12" y="12" fill="#9ee36d" font-size="9">摄入</text><text x="48" y="12" fill="#77bdfb" font-size="9">活动消耗</text>' +
      '</svg>';
  }

  function renderReport() {
    if (!el('reportMetrics')) return;
    const a=reportAggregate(reportDays);
    el('reportRange').textContent = '最近 ' + reportDays + ' 天';
    el('reportCompleteness').textContent = a.completeness;
    el('reportHeadline').textContent = a.completeness < 35
      ? '数据还比较少，先持续记录趋势'
      : (reportDays===7 ? '本周变化概览' : '本月变化概览');

    const metrics=[
      [round(a.avgSteps),'平均步数'],
      [round(a.exerciseMin),'运动分钟'],
      [round(a.meditationMin),'冥想分钟'],
      [round(a.nutrition.kcal/a.days),'日均摄入 kcal'],
      [round(a.nutrition.p/a.days,1)+'g','日均蛋白'],
      [round(a.nutrition.c/a.days,1)+'g','日均碳水'],
      [round(a.cigarettes),'香烟总支数'],
      [round(a.alcohol,1)+'g','纯酒精'],
      [round(a.lateHours,1)+'h','熬夜时长'],
      [a.redFoods,'红色风险食物']
    ];
    if(a.weightDelta!=null) metrics.push([(a.weightDelta>0?'+':'')+round(a.weightDelta,1)+'kg','体重变化']);
    el('reportMetrics').innerHTML=metrics.map(x=>'<div class="report-metric"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join('');
    el('reportTrendChart').innerHTML=reportTrendSvg(a.daily);

    const insights=[];
    if(a.avgSteps>0) insights.push({c:a.avgSteps>=8000?'good':'warn',t:'平均步数 '+round(a.avgSteps)+'；重点看长期趋势，不强求每天同一数字。'});
    if(a.cigarettes>0) insights.push({c:'bad',t:'本周期记录吸烟 '+round(a.cigarettes)+' 支。吸烟不存在安全支数，减少暴露本身就是改进。'});
    if(a.alcohol>0) insights.push({c:'warn',t:'本周期纯酒精约 '+round(a.alcohol,1)+'g；不把非零饮酒解释成“安全”。'});
    if(a.redFoods>0) insights.push({c:'warn',t:'疾病联动红色食物记录 '+a.redFoods+' 次，可从“频率和份量”两个维度逐步减少。'});
    if(a.meditationMin>0) insights.push({c:'good',t:'冥想/呼吸累计 '+round(a.meditationMin)+' 分钟，作为压力管理记录，不与运动热量等价。'});
    if(a.weightDelta!=null) insights.push({c:'good',t:'体重从本周期首条到末条变化 '+(a.weightDelta>0?'+':'')+round(a.weightDelta,1)+'kg；单周期变化应结合目标和更长时间观察。'});
    if(!insights.length) insights.push({c:'warn',t:'继续记录饮食、运动、睡眠与体重，报告会随着数据积累变得更有意义。'});
    el('reportInsights').innerHTML=insights.map(x=>'<div class="report-insight '+x.c+'">'+x.t+'</div>').join('');
  }

  function syncTodayMetricsToNative() {
    try {
      if (!(window.FitBridge && typeof FitBridge.upsertDailyMetricsJson === 'function')) return;
      const n = sumNutrition(todayFood());
      const a = activityBurn();
      const ex = todayExercise();
      const b = todayBehavior();
      const meditationMin = ex.filter(x => {
        const def = allExerciseTypes().find(t => t.id === x.type);
        return (x.category || (def && def.category)) === 'meditation';
      }).reduce((sum,x)=>sum+Number(x.min||0),0);
      const exerciseMin = ex.reduce((sum,x)=>sum+Number(x.min||0),0);
      const alcohol = ethanolGrams(b.beerMl,b.beerAbv) + ethanolGrams(b.baijiuMl,b.baijiuAbv);
      const redFoodCount = todayFood().filter(x => {
        if (x.riskStatus) return x.riskStatus === 'red';
        return x.foodId ? evaluateFoodRisk(x.foodId).status === 'red' : false;
      }).length;
      const latestWeight = state.weightLogs
        .filter(x=>x.date<=today())
        .slice()
        .sort((x,y)=>x.date.localeCompare(y.date))
        .slice(-1)[0];
      FitBridge.upsertDailyMetricsJson(JSON.stringify({
        date: today(),
        intakeKcal: n.kcal,
        proteinG: n.p,
        carbsG: n.c,
        fatG: n.f,
        steps: a.steps,
        activityKcal: a.total,
        exerciseMin,
        meditationMin,
        weightKg: latestWeight ? Number(latestWeight.weight) : Number(state.profile.weight || 0),
        cigarettes: Number(b.cigarettes || 0),
        alcoholG: alcohol,
        lateHours: Number(b.lateHours || 0),
        redFoodCount
      }));
    } catch (e) {}
  }

  function renderVersionAudit() {
    if (!el('auditAppVersion')) return;
    let audit = null;
    try {
      if (window.FitBridge && typeof FitBridge.getVersionAuditJson === 'function') {
        audit = parseBridgeJson(FitBridge.getVersionAuditJson(), null);
      }
    } catch (e) {}

    if (!audit) {
      el('auditAppVersion').textContent = '未知';
      el('auditSchemaVersion').textContent = '--';
      el('auditRuleVersion').textContent = '--';
      el('auditContentVersion').textContent = '--';
      el('auditEvidenceVersion').textContent = '--';
      el('auditGitSha').textContent = '--';
      el('auditHistory').textContent = '当前无法读取版本审计数据。';
      return;
    }

    el('auditAppVersion').textContent = audit.app_version || '--';
    el('auditSchemaVersion').textContent = audit.schema_version == null ? '--' : String(audit.schema_version);
    el('auditRuleVersion').textContent = audit.rule_version || '--';
    el('auditContentVersion').textContent = audit.content_version || '--';
    el('auditEvidenceVersion').textContent = audit.evidence_version || '--';
    el('auditGitSha').textContent = String(audit.git_sha || '--').slice(0,12);

    const history = Array.isArray(audit.history) ? audit.history : [];
    if (!history.length) {
      el('auditHistory').textContent = '这是当前设备记录到的第一个可审计版本。';
    } else {
      const text = history.slice(0,5).map(x =>
        'v' + x.app_version + ' · code ' + x.version_code + ' · schema ' + x.schema_version
      ).join(' ｜ ');
      el('auditHistory').textContent = '本机版本历史：' + text;
    }
  }

  function renderAll() {
    renderHome();
    renderFoodLog();
    renderSteps();
    renderExerciseLog();
    renderRecovery();
    renderProfile();
    renderEmergency();
    renderBehavior();
    renderZhuangzi();
    renderFoodControls();
    renderReport();
    renderVersionAudit();
    syncTodayMetricsToNative();
  }

  function bind() {
    document.querySelectorAll('.nav-btn').forEach(n => n.onclick = () => {
      const page = n.dataset.page;
      document.querySelectorAll('.page').forEach(p => p.classList.toggle('on',p.id === page));
      document.querySelectorAll('.nav-btn').forEach(x => x.classList.toggle('on',x === n));
      window.scrollTo(0,0);
      if (page === 'activity') renderSteps();
      if (page === 'profile') renderProfile();
    });

    el('addFoodBtn').onclick = () => {
      const food = getFoodById(el('foodSelect').value);
      const grams = Number(el('foodGram').value);
      if (!grams || grams <= 0) return toast('请输入有效重量');
      addFoodLog(food,grams,'手动记录');
      toast('已记入今日');
    };

    el('addPhotoFoodBtn').onclick = () => {
      const food = getFoodById(el('photoFoodSelect').value);
      const grams = Number(el('photoFoodGram').value);
      if (!grams || grams <= 0) return toast('请输入有效重量');
      const n = calcFood(food,grams);
      photoDish.push({...food,grams,...n});
      renderDish();
      toast('已加入照片餐盘');
    };

    el('saveDishBtn').onclick = () => {
      if (!photoDish.length) return toast('先加入至少一种食物');
      photoDish.forEach(x => {
        state.foodLogs.push({
          id:uid(),date:today(),name:x.name,foodId:x.id,grams:x.grams,
          kcal:x.kcal,p:x.p,c:x.c,f:x.f,source:'拍照餐盘',
          riskStatus:evaluateFoodRisk(x.id).status || 'neutral'
        });
      });
      photoDish = [];
      save();renderDish();renderAll();toast('照片餐盘已记入今日');
    };

    el('saveManualStepsBtn').onclick = () => {
      const n = Math.max(0, Number(el('manualSteps').value || 0));
      state.manualSteps[today()] = n;
      save();
      try {
        if (window.FitBridge && typeof FitBridge.requestStepPermission === 'function') {
          FitBridge.requestStepPermission();
        } else {
          postIosNative('requestActivityPermission');
        }
      } catch (e) {}
      renderAll();
      toast('步数已刷新');
    };

    el('exerciseMin').oninput = renderExerciseEstimate;
    el('addExerciseBtn').onclick = () => {
      const min = Number(el('exerciseMin').value);
      if (!min || min <= 0) return toast('请输入运动时长');
      const kcal = exerciseCalc(selectedExercise,min);
      const def = allExerciseTypes().find(x=>x.id===selectedExercise) || allExerciseTypes()[0];
      state.exerciseLogs.push({
        id:uid(),date:today(),type:selectedExercise,min,kcal,note:el('exerciseNote').value.trim(),
        label:def.label,icon:def.icon,category:def.category,met:def.met
      });
      el('exerciseNote').value = '';
      save();renderAll();toast('运动已记录');
    };

    el('toggleCustomActivityBtn').onclick = () => el('customActivityForm').classList.toggle('on');
    el('saveCustomActivityBtn').onclick = () => {
      const name=String(el('customActivityName').value||'').trim();
      if(!name) return toast('请输入项目名称');
      const category=el('customActivityCategory').value;
      const defaultMet=category==='meditation'?1.3:category==='mobility'?2.3:4.0;
      const met=clamp(Number(el('customActivityMet').value||defaultMet),1,20);
      const icon=String(el('customActivityIcon').value||'').trim() || (category==='meditation'?'🧘':category==='mobility'?'🤸':'✨');
      const id='custom_'+uid();
      state.customActivities.push({id,label:name,icon,met,category,custom:true});
      selectedExercise=id;
      save();
      el('customActivityName').value='';
      el('customActivityMet').value='';
      el('customActivityIcon').value='';
      el('customActivityForm').classList.remove('on');
      renderExerciseTypes();
      toast('自定义项目已保存');
    };

    document.querySelectorAll('.body-side').forEach(btn=>btn.onclick=()=>{
      document.querySelectorAll('.body-side').forEach(x=>x.classList.toggle('on',x===btn));
      el('bodyFront').classList.toggle('on',btn.dataset.side==='front');
      el('bodyBack').classList.toggle('on',btn.dataset.side==='back');
      renderRecoveryAdvanced();
    });
    document.querySelectorAll('.muscle-zone').forEach(z=>z.onclick=()=>{
      selectedMuscle=z.dataset.muscle;
      renderRecoveryAdvanced();
    });
    el('recordRecoveryTrainingBtn').onclick=()=>{
      state.recovery[selectedMuscle]={
        ...(state.recovery[selectedMuscle]||{}),
        lastTs:Date.now(),
        rpe:clamp(Number(el('recoveryRpe').value||7),1,10),
        soreness:clamp(Number(el('recoverySoreness').value||0),0,5),
        duration:clamp(Number(el('recoveryDuration').value||45),5,240),
        sleep:clamp(Number(el('recoverySleep').value||7),0,14)
      };
      save();renderRecovery();toast('该肌群训练已记录');
    };
    el('refreshRecoveryBtn').onclick=()=>{
      state.recovery[selectedMuscle]={
        ...(state.recovery[selectedMuscle]||{}),
        rpe:clamp(Number(el('recoveryRpe').value||7),1,10),
        soreness:clamp(Number(el('recoverySoreness').value||0),0,5),
        duration:clamp(Number(el('recoveryDuration').value||45),5,240),
        sleep:clamp(Number(el('recoverySleep').value||7),0,14)
      };
      save();renderRecoveryAdvanced();
    };

    document.querySelectorAll('.report-tab').forEach(btn=>btn.onclick=()=>{
      reportDays=Number(btn.dataset.reportDays||7);
      document.querySelectorAll('.report-tab').forEach(x=>x.classList.toggle('on',x===btn));
      renderReport();
    });

    el('saveProfileBtn').onclick = () => {
      const p = state.profile;
      p.sex = el('sex').value;
      p.age = clamp(Number(el('age').value || 40),14,100);
      p.height = clamp(Number(el('height').value || 175),100,230);
      p.weight = clamp(Number(el('weight').value || 70),30,300);
      p.goal = el('goal').value;
      p.activityLevel = Number(el('activityLevel').value);
      p.stepGoal = Math.max(1000,Number(el('stepGoal').value || 8000));
      p.manualCalGoal = el('manualCalGoal').value ? Number(el('manualCalGoal').value) : '';
      save();renderAll();toast('身体资料已保存');
    };

    el('diabetesSwitch').onclick = () => {
      state.profile.diabetes = !state.profile.diabetes;save();renderAll();
    };
    el('goutSwitch').onclick = () => {
      state.profile.gout = !state.profile.gout;save();renderAll();
    };
    el('hypertensionSwitch').onclick = () => {
      state.profile.hypertension = !state.profile.hypertension;save();renderAll();
    };
    el('heartDiseaseSwitch').onclick = () => {
      state.profile.heartDisease = !state.profile.heartDisease;save();renderAll();
    };
    el('priorMISwitch').onclick = () => {
      state.profile.priorMI = !state.profile.priorMI;save();renderAll();
    };
    el('priorStrokeSwitch').onclick = () => {
      state.profile.priorStroke = !state.profile.priorStroke;save();renderAll();
    };
    el('fastingSwitch').onclick = () => {
      state.profile.fasting = !state.profile.fasting;save();renderAll();
    };
    el('saveFastingBtn').onclick = () => {
      state.profile.eatStart = el('eatStart').value || '12:00';
      state.profile.eatHours = Number(el('eatHours').value || 8);
      save();renderAll();toast('饮食窗口已保存');
    };

    ['beerMl','beerAbv','baijiuMl','baijiuAbv','cigarettes','lateHours'].forEach(id => {
      if (el(id)) el(id).addEventListener('input', () => {
        const draft = {
          cigarettes: Number(el('cigarettes').value || 0),
          beerMl: Number(el('beerMl').value || 0),
          beerAbv: Number(el('beerAbv').value || 0),
          baijiuMl: Number(el('baijiuMl').value || 0),
          baijiuAbv: Number(el('baijiuAbv').value || 0),
          lateHours: Number(el('lateHours').value || 0)
        };
        const g = ethanolGrams(draft.beerMl,draft.beerAbv) + ethanolGrams(draft.baijiuMl,draft.baijiuAbv);
        if (el('alcoholCalc')) el('alcoholCalc').textContent =
          '纯酒精估算：' + round(g,1) + ' g。保存后计入今日负 Buff。';
      });
    });

    el('saveBehaviorBtn').onclick = () => {
      const entry = {
        date: today(),
        cigarettes: Math.max(0, Number(el('cigarettes').value || 0)),
        beerMl: Math.max(0, Number(el('beerMl').value || 0)),
        beerAbv: clamp(Number(el('beerAbv').value || 0), 0, 20),
        baijiuMl: Math.max(0, Number(el('baijiuMl').value || 0)),
        baijiuAbv: clamp(Number(el('baijiuAbv').value || 0), 0, 80),
        lateHours: clamp(Number(el('lateHours').value || 0), 0, 24)
      };
      state.behaviorLogs = state.behaviorLogs.filter(x => x.date !== entry.date);
      state.behaviorLogs.push(entry);
      state.behaviorLogs = state.behaviorLogs.slice(-400);
      save();
      renderAll();
      toast('今日负 Buff 已保存');
    };

    el('saveEmergencyContactsBtn').onclick = () => {
      state.profile.emergencyContacts = [
        {
          name:String(el('ice1Name').value || '').trim(),
          relation:String(el('ice1Relation').value || '').trim(),
          phone:sanitizePhone(el('ice1Phone').value)
        },
        {
          name:String(el('ice2Name').value || '').trim(),
          relation:String(el('ice2Relation').value || '').trim(),
          phone:sanitizePhone(el('ice2Phone').value)
        }
      ];
      save();
      renderEmergency();
      toast('紧急联系人已保存');
    };

    el('call120Btn').onclick = () => callNumber('120');
    el('profileCall120Btn').onclick = () => callNumber('120');
    el('profileCallPrimaryBtn').onclick = () => {
      const c = (state.profile.emergencyContacts || [])[0] || {};
      callNumber(c.phone);
    };

    el('skipOnboardingBtn').onclick = () => completeOnboarding(true);
    el('saveOnboardingBtn').onclick = () => completeOnboarding(false);

    el('openZhuangziBtn').onclick = openZhuangziModule;
    el('zhuangziPrevBtn').onclick = () => {
      zhuangziViewDay = Math.max(1, zhuangziViewDay - 1);
      renderZhuangzi();
    };
    el('zhuangziNextBtn').onclick = () => {
      const max = Number((zhuangziStatus && zhuangziStatus.total_days) || 30);
      zhuangziViewDay = Math.min(max, zhuangziViewDay + 1);
      renderZhuangzi();
    };
    el('zhuangziCheckBtn').onclick = () => {
      const item = getZhuangziDay(zhuangziViewDay);
      if (!item) return toast('本地庄子数据暂不可用');
      try {
        if (window.FitBridge && typeof FitBridge.setZhuangziCheckin === 'function') {
          const ok = FitBridge.setZhuangziCheckin(zhuangziViewDay, !item.checked);
          if (ok) {
            zhuangziStatus = null;
            renderZhuangzi();
            toast(item.checked ? '已取消完成标记' : '今天的养心练习已完成');
          }
        }
      } catch (e) {
        toast('保存失败，请稍后重试');
      }
    };

    el('addWeightBtn').onclick = () => {
      const date = el('weightDate').value || today();
      const weight = Number(el('weightEntry').value);
      if (!weight || weight < 30 || weight > 300) return toast('请输入有效体重');
      state.weightLogs = state.weightLogs.filter(x => x.date !== date);
      state.weightLogs.push({date,weight});
      if (date === today()) state.profile.weight = weight;
      save();renderAll();toast('体重记录已保存');
    };
  }

  renderDate();
  loadFoodCatalog();
  renderFoodControls();
  renderExerciseTypes();
  handlePhotoInput();
  bind();
  renderDish();
  const firstZhuangzi = loadZhuangziStatus();
  if (firstZhuangzi) zhuangziViewDay = Number(firstZhuangzi.current_day || 1);
  renderAll();
  showOnboardingIfNeeded();
  setInterval(() => {
    renderFasting();
    renderSteps();
    renderHome();
  }, 30000);
})();