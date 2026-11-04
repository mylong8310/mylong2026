/* FitBalance art direction v0.2: reversible view transformation, business logic untouched */
(function(){
 const root=document.getElementById('home');
 if(!root)return;
 const originalSections=Array.from(root.children).filter(n=>n.classList&&n.classList.contains('section'));
 const lowerModules=originalSections.slice(2);
 const trend=lowerModules.find(n=>n.querySelector&&n.querySelector('#homeCalGoal'));
 if(trend){
   const target=trend.querySelector('#homeCalGoal');
   const stat=target&&target.closest('.stat');
   if(stat)stat.remove();
   const grid=trend.querySelector('.grid3');
   if(grid)grid.classList.replace('grid3','grid2');
 }
 root.innerHTML=`
 <div class="home-intro">
   <div class="home-edition"><span class="edition-mark"></span> DAILY / 001 <span class="intro-line"></span> YOUR BODY, IN FOCUS</div>
   <h1>今天的<span>节奏。</span></h1>
   <p>饮食、活动与身体状态，一眼看清。</p>
 </div>
 <div class="hero energy-hero">
   <div class="hero-kicker"><span>01 <span class="slash">/</span> ENERGY BALANCE</span><span class="hero-kicker-right"><i></i> 实时记录</span></div>
   <div class="energy-main">
     <div class="energy-readout"><div class="energy-label">今日净摄入</div>
       <div class="energy-value"><strong id="balanceKcal">0</strong><span>kcal</span></div>
       <div class="energy-caption">摄入减去已记录的活动消耗</div>
     </div>
     <div class="dial-wrap" role="group" aria-label="今日摄入热量相对目标的比例">
       <svg class="energy-dial" viewBox="0 0 140 140" aria-hidden="true">
         <circle class="dial-track" cx="70" cy="70" r="53"/>
         <circle id="intakeDialArc" class="dial-arc" cx="70" cy="70" r="53" transform="rotate(-90 70 70)" stroke-dasharray="0 333.01"/>
         <circle class="dial-inner" cx="70" cy="70" r="43"/>
         <path class="dial-crosshair" d="M70 7v6M70 127v6M7 70h6M127 70h6"/>
       </svg>
       <div class="dial-center"><span>已摄入</span><strong id="intakePct">0%</strong></div>
     </div>
   </div>
   <div class="energy-target-line"><span>热量目标（估算）</span><b><span id="homeCalGoal">--</span><small>kcal</small></b></div>
   <div class="hero-guidance" id="heroHint">记录摄入与活动，了解今日能量平衡。</div>
   <button type="button" class="primary-action" id="quickRecordFoodBtn"><span class="action-plus">＋</span><span>记录一餐</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
 </div>
 <div class="two-metrics" aria-label="今日摄入和活动消耗">
   <div class="metric-panel metric-intake">
     <div class="metric-overline"><span class="metric-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v7c0 3 2 5 5 5v5M11 4v7c0 3-2 5-5 5M18 4v17M18 4a4 4 0 0 1 4 4v6h-4"/></svg></span><span>摄入</span><span class="metric-index">02</span></div>
     <div class="metric-figure"><span id="homeIntake">0</span><small>kcal</small></div>
     <div class="metric-bottom"><span>相对热量目标</span><div class="metric-track"><i id="intakeBarMini"></i></div></div>
   </div>
   <div class="metric-panel metric-burn">
     <div class="metric-overline"><span class="metric-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h5l3-7 4 14 3-7h5"/></svg></span><span>活动消耗</span><span class="metric-index">03</span></div>
     <div class="metric-figure"><span id="homeBurn">0</span><small>kcal</small></div>
     <div class="metric-bottom"><span>步行与运动记录</span><span class="metric-led"></span></div>
   </div>
 </div>
 <div class="step-panel">
   <div class="step-head"><div><div class="step-overline">04 / MOVEMENT</div><div class="step-title">今日步数</div></div>
     <button id="quickRecordActivityBtn" class="step-arrow" type="button" aria-label="前往运动记录"><svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button></div>
   <div class="step-data"><div><strong id="homeSteps">0</strong><span>步</span></div><span class="step-goal">目标 <b id="stepTargetHome">8000</b></span></div>
   <div class="step-ruler" role="progressbar" aria-label="今日步数完成度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="stepHomeProgress"><i id="stepBarHome"></i></div>
 </div>
 <div class="section macro-section">
   <div class="section-title"><h2>营养进度</h2><span id="macroGoalLabel">基于当前资料估算</span></div>
   <div class="grid2">
     <div class="macro"><div class="macro-head"><span class="macro-symbol protein-symbol">P</span><span class="macro-name">蛋白质</span></div><div class="macro-value"><strong id="proteinNow">0</strong><span> / <span id="proteinGoal">0</span> g</span></div><div class="progress"><div class="bar" id="proteinBar"></div></div></div>
     <div class="macro"><div class="macro-head"><span class="macro-symbol carb-symbol">C</span><span class="macro-name">碳水</span></div><div class="macro-value"><strong id="carbNow">0</strong><span> / <span id="carbGoal">0</span> g</span></div><div class="progress"><div class="bar" id="carbBar"></div></div></div>
   </div>
 </div>
 `;
 for(const module of lowerModules)root.appendChild(module);
 function updateMeters(){
   const num=id=>Number((document.getElementById(id)?.textContent||'0').replace(/[,，]/g,''))||0;
   const intake=Math.max(0,num('homeIntake')),target=Math.max(1,num('homeCalGoal'));
   const pct=Math.max(0,Math.min(100,100*intake/target));
   const dial=document.getElementById('intakeDialArc');
   if(dial)dial.setAttribute('stroke-dasharray',(pct/100*333.01).toFixed(2)+' 333.01');
   const label=document.getElementById('intakePct');
   if(label)label.textContent=Math.round(pct)+'%';
   const bar=document.getElementById('intakeBarMini');
   if(bar)bar.style.width=pct+'%';
   const steps=Math.max(0,num('homeSteps')),stepGoal=Math.max(1,num('stepGoalText')||8000);
   const ratio=Math.max(0,Math.min(100,100*steps/stepGoal));
   const goalLabel=document.getElementById('stepTargetHome');
   if(goalLabel)goalLabel.textContent=String(stepGoal);
   const stepBar=document.getElementById('stepBarHome');
   if(stepBar)stepBar.style.width=ratio+'%';
   const progress=document.getElementById('stepHomeProgress');
   if(progress)progress.setAttribute('aria-valuenow',String(Math.round(ratio)));
 }
 for(const id of ['homeIntake','homeSteps','homeCalGoal','stepGoalText']){
   const node=document.getElementById(id);
   if(node)new MutationObserver(updateMeters).observe(node,{subtree:true,characterData:true,childList:true});
 }
 const jump=page=>document.querySelector('.nav-btn[data-page="'+page+'"]')?.click();
 document.getElementById('quickRecordFoodBtn')?.addEventListener('click',()=>jump('nutrition'));
 document.getElementById('quickRecordActivityBtn')?.addEventListener('click',()=>jump('activity'));
 document.addEventListener('DOMContentLoaded',updateMeters);
 updateMeters();
})();