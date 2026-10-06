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
    recovery: {},
    behaviorLogs: []
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
    recovery: state.recovery || {},
    behaviorLogs: Array.isArray(state.behaviorLogs) ? state.behaviorLogs : []
  };
  if (!Array.isArray(state.profile.emergencyContacts)) {
    state.profile.emergencyContacts = defaults.profile.emergencyContacts.map(x => ({...x}));
  }
  while (state.profile.emergencyContacts.length < 2) {
    state.profile.emergencyContacts.push({name:'', relation:'', phone:''});
  }

  const foods = [
    {id:'rice',name:'熟米饭',icon:'🍚',kcal:116,p:2.6,c:25.9,f:0.3,purine:'low'},
    {id:'noodle',name:'熟面条',icon:'🍜',kcal:137,p:4.5,c:25.0,f:2.0,purine:'low'},
    {id:'oats',name:'燕麦',icon:'🌾',kcal:389,p:16.9,c:66.3,f:6.9,purine:'low'},
    {id:'chicken',name:'鸡胸肉',icon:'🍗',kcal:165,p:31.0,c:0,f:3.6,purine:'moderate'},
    {id:'egg',name:'鸡蛋',icon:'🥚',kcal:143,p:13.0,c:0.7,f:9.5,purine:'low'},
    {id:'beef',name:'瘦牛肉',icon:'🥩',kcal:250,p:26.0,c:0,f:15.0,purine:'high'},
    {id:'tofu',name:'豆腐',icon:'◻️',kcal:76,p:8.1,c:1.9,f:4.8,purine:'low'},
    {id:'salmon',name:'三文鱼',icon:'🐟',kcal:208,p:20.0,c:0,f:13.0,purine:'moderate'},
    {id:'milk',name:'全脂牛奶',icon:'🥛',kcal:61,p:3.2,c:4.8,f:3.3,purine:'low'},
    {id:'yogurt',name:'原味酸奶',icon:'🥣',kcal:63,p:5.2,c:7.0,f:1.5,purine:'low'},
    {id:'banana',name:'香蕉',icon:'🍌',kcal:89,p:1.1,c:23.0,f:0.3,purine:'low'},
    {id:'apple',name:'苹果',icon:'🍎',kcal:52,p:0.3,c:14.0,f:0.2,purine:'low'},
    {id:'potato',name:'土豆',icon:'🥔',kcal:77,p:2.0,c:17.0,f:0.1,purine:'low'},
    {id:'sweetpotato',name:'红薯',icon:'🍠',kcal:86,p:1.6,c:20.1,f:0.1,purine:'low'},
    {id:'broccoli',name:'西兰花',icon:'🥦',kcal:34,p:2.8,c:6.6,f:0.4,purine:'low'},
    {id:'peanut',name:'花生',icon:'🥜',kcal:567,p:25.8,c:16.1,f:49.2,purine:'low'},
    {id:'avocado',name:'牛油果',icon:'🥑',kcal:160,p:2.0,c:8.5,f:14.7,purine:'low'},
    {id:'shrimp',name:'虾',icon:'🦐',kcal:99,p:24.0,c:0.2,f:0.3,purine:'high'}
  ];

  const exerciseTypes = [
    {id:'walk',label:'走路',icon:'🚶',met:3.5},
    {id:'run',label:'跑步',icon:'🏃',met:8.3},
    {id:'strength',label:'力量',icon:'🏋️',met:5.0},
    {id:'cycle',label:'骑行',icon:'🚴',met:6.8}
  ];
  let selectedExercise = 'walk';
  let photoDish = [];

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
  window.FitNative.receiveSteps = function(value) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) {
      iosStepCache = n;
      try { renderSteps(); renderHome(); } catch (e) {}
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
          el('stepSource').textContent = 'Android 步数传感器';
          return n;
        }
        if (n === -2) el('stepSource').textContent = '需要活动识别权限';
        else el('stepSource').textContent = '设备无步数传感器';
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

  function foodOptionHtml() {
    return foods.map(f => '<option value="' + f.id + '">' + f.icon + ' ' + f.name + '</option>').join('');
  }

  function renderFoodControls() {
    el('foodSelect').innerHTML = foodOptionHtml();
    el('photoFoodSelect').innerHTML = foodOptionHtml();

    const quick = foods.slice(0, 8);
    el('quickFoods').innerHTML = quick.map(f =>
      '<button class="quick" data-food="' + f.id + '">' + f.icon + ' ' + f.name + '</button>'
    ).join('');
    el('quickFoods').querySelectorAll('[data-food]').forEach(btn => {
      btn.onclick = () => {
        el('foodSelect').value = btn.dataset.food;
        renderFoodEstimate();
      };
    });

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

  function conditionFoodWarning(food, calc) {
    const p = state.profile;
    const notes = [];
    if (p.diabetes && calc.c >= 30) notes.push('本份碳水约 ' + round(calc.c,1) + 'g，注意与当餐计划、血糖监测和用药配合');
    if (p.gout && food.purine === 'high') notes.push('痛风模式：该食物属于较高嘌呤选择，建议控制频率和份量');
    if (p.gout && food.purine === 'moderate') notes.push('痛风模式：适量摄入，注意全天总量与补水');
    return notes.join('；');
  }

  function renderFoodEstimate() {
    const food = getFoodById(el('foodSelect').value);
    const grams = Number(el('foodGram').value || 0);
    const n = calcFood(food, grams);
    let text = round(n.kcal) + ' kcal · 蛋白 ' + round(n.p,1) + 'g · 碳水 ' + round(n.c,1) + 'g · 脂肪 ' + round(n.f,1) + 'g';
    const w = conditionFoodWarning(food,n);
    if (w) text += ' ｜ ' + w;
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
    state.foodLogs.push({
      id: uid(), date: today(), name: food.name, foodId: food.id, grams: Number(grams),
      kcal:n.kcal,p:n.p,c:n.c,f:n.f,source:source || '手动'
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
  }

  function renderExerciseTypes() {
    const box = el('exerciseTypes');
    box.innerHTML = exerciseTypes.map(x =>
      '<button data-type="' + x.id + '" class="' + (x.id === selectedExercise ? 'on' : '') + '">' + x.icon + '<br>' + x.label + '</button>'
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
    const def = exerciseTypes.find(x => x.id === type) || exerciseTypes[0];
    const weight = profileMetrics().w;
    return def.met * weight * (Number(min || 0) / 60);
  }

  function renderExerciseEstimate() {
    const kcal = exerciseCalc(selectedExercise, el('exerciseMin').value);
    el('exerciseEstimate').textContent = '约 ' + round(kcal) + ' kcal（估算）';
  }

  function renderExerciseLog() {
    const logs = todayExercise().slice().reverse();
    const box = el('exerciseLog');
    if (!logs.length) {
      box.innerHTML = '<div class="empty">今天还没有运动记录</div>';
      return;
    }
    box.innerHTML = logs.map(x => {
      const d = exerciseTypes.find(t => t.id === x.type) || exerciseTypes[0];
      return '<div class="item"><div class="item-icon">' + d.icon + '</div><div class="item-main"><div class="item-title">' +
        d.label + ' · ' + round(x.min) + ' 分钟</div><div class="item-sub">' + (x.note || '无备注') +
        '</div></div><div class="item-side"><b>' + round(x.kcal) + '</b><span class="note">kcal</span><button class="del" data-exdel="' + x.id + '">×</button></div></div>';
    }).join('');
    box.querySelectorAll('[data-exdel]').forEach(btn => {
      btn.onclick = () => {
        state.exerciseLogs = state.exerciseLogs.filter(x => x.id !== btn.dataset.exdel);
        save();renderAll();
      };
    });
  }

  function recoveryStatus(item) {
    if (!item || !item.lastTs) return {cls:'good',text:'可安排训练',meta:'暂无近期记录'};
    const h = Math.max(0,(Date.now() - Number(item.lastTs)) / 3600000);
    const s = Number(item.soreness || 0);
    if (s >= 4 || h < 24) return {cls:'bad',text:'优先恢复',meta:round(h) + ' 小时前训练 · 酸痛 ' + s + '/5'};
    if (s >= 2 || h < 48) return {cls:'mid',text:'谨慎安排',meta:round(h) + ' 小时前训练 · 酸痛 ' + s + '/5'};
    return {cls:'good',text:'恢复较充分',meta:round(h) + ' 小时前训练 · 酸痛 ' + s + '/5'};
  }

  function renderRecovery() {
    const box = el('muscleGrid');
    box.innerHTML = muscleDefs.map(([id,name]) => {
      const item = state.recovery[id] || {};
      const r = recoveryStatus(item);
      let sore = '';
      for (let i=0;i<=5;i++) sore += '<button data-sore="' + id + ':' + i + '" class="' + (Number(item.soreness||0)===i?'on':'') + '">' + i + '</button>';
      return '<div class="muscle ' + r.cls + '"><div class="between"><div class="name">' + name + '</div><button class="btn ghost" data-trained="' + id + '" style="padding:7px 8px;font-size:10px">今天练了</button></div>' +
        '<div class="ready">' + r.text + '</div><div class="meta">' + r.meta + '</div><div class="soreness">' + sore + '</div></div>';
    }).join('');

    box.querySelectorAll('[data-trained]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.trained;
      state.recovery[id] = {lastTs:Date.now(),soreness:2};
      save();renderRecovery();toast('已记录训练');
    });
    box.querySelectorAll('[data-sore]').forEach(btn => btn.onclick = () => {
      const [id,score] = btn.dataset.sore.split(':');
      state.recovery[id] = {...(state.recovery[id]||{}),soreness:Number(score)};
      save();renderRecovery();
    });
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

  function renderAll() {
    renderHome();
    renderFoodLog();
    renderSteps();
    renderExerciseLog();
    renderRecovery();
    renderProfile();
    renderEmergency();
    renderBehavior();
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
          kcal:x.kcal,p:x.p,c:x.c,f:x.f,source:'拍照餐盘'
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
      state.exerciseLogs.push({
        id:uid(),date:today(),type:selectedExercise,min,kcal,note:el('exerciseNote').value.trim()
      });
      el('exerciseNote').value = '';
      save();renderAll();toast('运动已记录');
    };

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
  renderFoodControls();
  renderExerciseTypes();
  handlePhotoInput();
  bind();
  renderDish();
  renderAll();
  showOnboardingIfNeeded();
  setInterval(() => {
    renderFasting();
    renderSteps();
    renderHome();
  }, 30000);
})();