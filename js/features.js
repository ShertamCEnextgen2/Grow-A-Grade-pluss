// ================================================================
// features.js — GAG: all ex/ features re-implemented on the
// bouncebox design + js/api.js data layer. Shared by every page.
// Requires: data.js, xml-utils.js, api.js, auth.js (loaded first).
// ================================================================
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtDate = d => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}); } catch { return d; } };
  const icon = () => { if (window.lucide) lucide.createIcons(); };
  const uid = p => (p||'x') + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36);

  const GRADE_OPTS = [4,3.5,3,2.5,2,1.5,1,0];
  const TERM_ORDER = [['ม.4','เทอม 1'],['ม.4','เทอม 2'],['ม.5','เทอม 1'],['ม.5','เทอม 2'],['ม.6','เทอม 1'],['ม.6','เทอม 2']];
  const CALC_END_IDX = TERM_ORDER.findIndex(t => t[0]==='ม.6' && t[1]==='เทอม 1');

  // ── generic modal (injected into <body>) ──────────────────────── //
  function modal(html, wide) {
    let root = $('gag-modal-root');
    if (!root) { root = document.createElement('div'); root.id = 'gag-modal-root'; document.body.appendChild(root); }
    root.innerHTML =
      `<div class="modal-overlay open" onclick="if(event.target===this)GAG.closeModal()">
         <div class="modal" style="${wide?'max-width:820px;width:92%':''}">${html}</div>
       </div>`;
    icon();
  }
  function closeModal() { const r = $('gag-modal-root'); if (r) r.innerHTML = ''; }

  function toast(msg) {
    let t = $('gag-toast');
    if (!t) { t = document.createElement('div'); t.id = 'gag-toast';
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0F172A;color:#fff;padding:12px 20px;border-radius:12px;z-index:9999;font-size:14px;box-shadow:0 10px 25px rgba(0,0,0,.25);max-width:90%;text-align:center';
      document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.transition='opacity .4s'; t.style.opacity='0'; }, 2600);
  }

  // ── shared bits ───────────────────────────────────────────────── //
  const currentPlan = student => student ? window.normalizePlanName(student.plan) : '';
  const houseBadge = h => h ? `<span class="chip" style="background:${h.color}22;color:${h.color}">${esc(h.name)}</span>` : '';

  function visibleNews(houseIds) {
    const now = new Date();
    return API.getAll('news')
      .filter(n => !n.expireAt || new Date(n.expireAt) >= now)
      .filter(n => { const t = n.targetHouses || []; return t.includes('all') || t.some(id => houseIds.includes(String(id))); })
      .sort((a,b) => new Date(b.at||0) - new Date(a.at||0));
  }
  function newsCardHTML(n) {
    const author = API.userById(n.authorId);
    const scope = (n.targetHouses||[]).includes('all')
      ? '<span class="chip chip-neutral text-xs">ประกาศทั่วไป</span>'
      : '<span class="chip chip-coral text-xs">เฉพาะบ้าน</span>';
    return `<div class="card elevated news-card" style="cursor:pointer" onclick="GAG.newsDetail('${n.id}')">
      ${n.image ? `<div style="margin:-4px -4px 12px;border-radius:12px 12px 0 0;overflow:hidden;max-height:150px"><img src="${n.image}" style="width:100%;object-fit:cover"></div>` : ''}
      <div class="flex justify-between items-center mb-sm">${scope}<span class="news-meta text-xs text-sub">${fmtDate(n.at)}</span></div>
      <h3 class="news-title font-head mb-sm">${esc(n.title)}</h3>
      <p class="news-body text-sm text-sub" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(n.body)}</p>
      <div class="text-xs font-bold text-teal" style="margin-top:8px">โดย ${esc(author?author.displayName:'ระบบ')}</div>
    </div>`;
  }
  function newsDetail(id) {
    const n = API.getById('news', id); if (!n) return;
    const author = API.userById(n.authorId);
    const houses = (n.targetHouses||[]).includes('all') ? [{name:'ทุกบ้าน',color:'#2563EB'}] : (n.targetHouses||[]).map(h=>API.houseById(h)).filter(Boolean);
    modal(`<div class="modal-header"><h3 class="modal-title font-head">${esc(n.title)}</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        ${n.image ? `<img src="${n.image}" style="width:100%;border-radius:12px;margin-bottom:14px">` : ''}
        <div class="flex gap-sm mb-sm" style="flex-wrap:wrap">${houses.map(h=>`<span class="chip" style="background:${h.color}22;color:${h.color}">${esc(h.name)}</span>`).join('')}</div>
        <p style="line-height:1.9;white-space:pre-wrap">${esc(n.body)}</p>
        <div class="text-xs text-sub" style="margin-top:14px">โดย ${esc(author?author.displayName:'ระบบ')} · ${fmtDate(n.at)}${n.expireAt?` · ลบอัตโนมัติ ${fmtDate(n.expireAt)}`:''}</div>
      </div>`);
  }

  // ════════════════════════════════════════════════════════════════
  //  STUDENT FEATURES
  // ════════════════════════════════════════════════════════════════
  function studentCtx() {
    const u = Auth.getUser();
    const sid = u.studentId || u.id;
    const student = API.studentById(sid);
    const houses = API.housesOf(sid);
    return { u, sid, student, houses };
  }

  // ── Overview ──
  function overview(el) {
    const { sid, student, houses } = studentCtx();
    const gpax = API.calcGPAX(sid);
    const targets = API.filter('targets', t => t.studentId === sid);
    const pretests = API.pretestsOf(sid);
    const practice = API.filter('practice', p => p.studentId === sid);
    const weekCount = practice.filter(p => (Date.now()-new Date(p.date))/(864e5) <= 7).length;
    const houseIds = houses.map(h => h.id);
    const news = visibleNews(houseIds).slice(0,3);
    const minG = API.targetMinGPAX(sid);

    el.innerHTML = `
      <div class="page-header"><div class="page-title-group">
        <h1 class="page-title">สวัสดี, ${esc(student?student.displayName:'นักเรียน')}</h1>
        <p class="page-sub">ภาพรวมการเรียนและเป้าหมายของคุณ</p></div></div>

      <div class="stats-grid mb-lg">
        <div class="stat-card"><div class="stat-icon coral"><i data-lucide="trending-up"></i></div><div><div class="stat-label">GPAX ปัจจุบัน</div><div class="stat-value">${gpax.toFixed(2)}</div></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i data-lucide="home"></i></div><div><div class="stat-label">บ้านที่สังกัด</div><div class="stat-value">${houses.length}</div></div></div>
        <div class="stat-card"><div class="stat-icon yellow"><i data-lucide="target"></i></div><div><div class="stat-label">คณะเป้าหมาย</div><div class="stat-value">${targets.length}</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><i data-lucide="calendar-check"></i></div><div><div class="stat-label">ฝึกฝนสัปดาห์นี้</div><div class="stat-value">${weekCount}</div></div></div>
      </div>

      <div class="grid-2 mb-lg">
        <div class="card elevated">
          <div class="card-head"><h3 class="card-title font-head"><i data-lucide="home"></i> บ้านของฉัน</h3></div>
          <div class="flex gap-sm" style="flex-wrap:wrap">${houses.length?houses.map(houseBadge).join(''):'<span class="text-sub">ยังไม่ได้สังกัดบ้าน</span>'}</div>
          <div class="progress-wrap mb-md" style="margin-top:16px"><div class="progress-bar coral" style="width:${gpax/4*100}%"></div></div>
          <p class="text-sub text-sm">GPAX ${gpax.toFixed(2)} / เกณฑ์คณะเป้าหมายสูงสุด ${minG.toFixed(2)}</p>
        </div>
        <div class="card elevated">
          <div class="card-head"><h3 class="card-title font-head">สถานะแบบทดสอบวัดบ้าน</h3></div>
          ${houses.length?houses.map(h=>{
            const pt = pretests.find(p => p.houseId === h.id);
            const isSurvey = h.id === '9';
            return `<div class="flex justify-between items-center" style="padding:9px 0;border-bottom:1px solid var(--border)">
              <span class="flex items-center gap-sm"><span class="traffic-dot" style="background:${h.color}"></span>${esc(h.name)}</span>
              ${pt && pt.status==='completed'
                ? `<span class="chip chip-success">${isSurvey?'ประเมินแล้ว':pt.score+'/100'}</span>`
                : '<span class="chip chip-warning">ยังไม่ได้ทำ</span>'}</div>`;
          }).join(''):'<p class="text-sub">—</p>'}
        </div>
      </div>

      <div class="section-header"><div class="section-icon yellow"><i data-lucide="newspaper"></i></div><h2 class="section-title font-head">ข่าวสารล่าสุด</h2></div>
      <div class="grid-3">${news.length?news.map(newsCardHTML).join(''):'<p class="text-sub">ยังไม่มีข่าวสาร</p>'}</div>`;
    icon();
  }

  // ── Grades + required-grade calculator + curriculum autoload ──
  const TM_KEY = sid => `gag_termManual_${sid}`;
  const getManual = (sid,lv,tm) => (JSON.parse(localStorage.getItem(TM_KEY(sid))||'[]')).find(x=>x.lv===lv&&x.tm===tm)||null;
  const saveManual = (sid,lv,tm,gpa,cr) => { const l=(JSON.parse(localStorage.getItem(TM_KEY(sid))||'[]')).filter(x=>!(x.lv===lv&&x.tm===tm)); l.push({lv,tm,gpa,cr}); localStorage.setItem(TM_KEY(sid),JSON.stringify(l)); };
  let PRIOR = [];

  function grades(el) {
    const { sid, student } = studentCtx();
    const gs = API.filter('grades', g => g.studentId === sid);
    const gpax = API.calcGPAX(sid);
    const groups = [...new Set(gs.map(g=>g.group))];
    const minG = API.targetMinGPAX(sid);
    const plan = currentPlan(student) || 'ไม่ระบุ';

    let tc = parseFloat(student?.prevCredits)||0, tp = (parseFloat(student?.prevGPAX)||0) * tc;
    gs.forEach(g => { const cr=parseFloat(g.credit)||0; tc+=cr; tp+=cr*parseFloat(g.grade); });
    let totalCurriculumCr = 0;
    for(let i=0; i<=CALC_END_IDX; i++){ totalCurriculumCr += window.getTermCurriculumCredits(plan, TERM_ORDER[i][0], TERM_ORDER[i][1]); }
    const remainingCr = Math.max(0, totalCurriculumCr - tc);
    let remainMsg = '';
    if (remainingCr > 0) {
      const required = (minG * totalCurriculumCr - tp) / remainingCr;
      if (required <= 0) remainMsg = `<div class="chip chip-success text-xs" style="margin-top:10px;display:inline-flex;padding:6px 12px">GPAX ปัจจุบันถึงเกณฑ์เป้าหมายแล้ว!</div>`;
      else if (required > 4) remainMsg = `<div class="chip chip-error text-xs" style="margin-top:10px;display:inline-flex;padding:6px 12px">ขาดอีก ${remainingCr.toFixed(1)} กิต แต่ต้องทำเฉลี่ย > 4.00 (เป็นไปไม่ได้)</div>`;
      else remainMsg = `<div class="chip chip-warning text-xs" style="margin-top:10px;display:inline-flex;padding:6px 12px">เหลือ ${remainingCr.toFixed(1)} กิต ต้องทำเฉลี่ยอย่างน้อย ${required.toFixed(2)}</div>`;
    } else {
      if (gpax >= minG) remainMsg = `<div class="chip chip-success text-xs" style="margin-top:10px;display:inline-flex;padding:6px 12px">หน่วยกิตครบ และผ่านเกณฑ์แล้ว!</div>`;
      else remainMsg = `<div class="chip chip-error text-xs" style="margin-top:10px;display:inline-flex;padding:6px 12px">หน่วยกิตครบ แต่เกรดไม่ถึงเกณฑ์</div>`;
    }

    el.innerHTML = `
      <div class="page-header"><div class="page-title-group">
        <h1 class="page-title"><i data-lucide="line-chart"></i> วิเคราะห์ผลการเรียน</h1>
        <p class="page-sub">แผนการเรียน: <b>${esc(plan)}</b> · GPAX รวม ${gpax.toFixed(2)}</p></div></div>

      <div class="grid-2 mb-lg">
        <div class="card elevated">
          <div class="card-head"><h3 class="card-title font-head">GPAX รวม</h3></div>
          <div class="flex items-center gap-md mb-sm"><div class="gpax-big text-coral">${gpax.toFixed(2)}</div><div class="gpax-label">/ 4.00</div></div>
          <div class="progress-wrap"><div class="progress-bar coral" style="width:${gpax/4*100}%"></div></div>
          <div class="flex items-center justify-between" style="margin-top:8px">
            <p class="text-sub text-xs">เกณฑ์ขั้นต่ำเป้าหมาย: <b>${minG.toFixed(2)}</b></p>
          </div>
          ${remainMsg}
        </div>
        <div class="card elevated">
          <div class="card-head"><h3 class="card-title font-head">GPA ตามกลุ่มสาระ</h3></div>
          ${groups.length?groups.map(g=>{const v=API.calcGroupGPA(sid,g);return `<div class="flex justify-between items-center" style="padding:6px 0;border-bottom:1px solid var(--border)"><span>${esc(g)}</span><b>${v!=null?v.toFixed(2):'—'}</b></div>`;}).join(''):'<p class="text-sub">ยังไม่มีข้อมูลเกรด</p>'}
        </div>
      </div>

      <div class="card elevated mb-lg" style="border:2px dashed var(--teal)">
        <div class="card-head"><h3 class="card-title font-head"><i data-lucide="target"></i> เกรดขั้นต่ำที่ต้องทำ เพื่อให้ถึงเกณฑ์คณะเป้าหมาย</h3></div>
        <p class="text-sub text-sm mb-md">เลือกชั้นปี/เทอมที่อยากรู้ แล้วกด “โหลดรายวิชาก่อนหน้า” ระบบจะดึงรายวิชาจริงตามหลักสูตรของคุณ (ม.4 เทอม 1 → เทอมก่อนหน้า) ให้กรอกเกรดจริง แล้วคำนวณเกรดเฉลี่ยขั้นต่ำที่ต้องทำ เทียบเกณฑ์ <b>${minG.toFixed(2)}</b></p>
        <div class="flex gap-sm items-center" style="flex-wrap:wrap">
          <select class="select" id="calc-lv" style="width:120px" onchange="GAG._calcTm()"><option>ม.4</option><option>ม.5</option><option selected>ม.6</option></select>
          <select class="select" id="calc-tm" style="width:130px" onchange="GAG._calcClear()"><option>เทอม 1</option><option>เทอม 2</option></select>
          <button class="btn btn-secondary btn-sm" onclick="GAG.prepareCalc()"><i data-lucide="download"></i> โหลดรายวิชาก่อนหน้า</button>
        </div>
        <div id="calc-prior" style="margin-top:12px"></div>
        <div id="calc-result" style="margin-top:12px"></div>
      </div>

      <div class="card elevated">
        <div class="table-toolbar">
          <h3 class="card-title font-head" style="margin:0">รายวิชาทั้งหมด</h3>
          <div class="flex gap-sm">
            <select class="select" id="grade-lv" style="width:120px"><option value="">ทุกระดับชั้น</option><option>ม.4</option><option>ม.5</option><option>ม.6</option></select>
            <select class="select" id="grade-tm" style="width:120px"><option value="">ทุกเทอม</option><option>เทอม 1</option><option>เทอม 2</option></select>
            <button class="btn btn-surface btn-sm" onclick="GAG.autoLoadCurriculum()"><i data-lucide="book-open"></i> โหลดหลักสูตร</button>
            <button class="btn btn-primary btn-sm" onclick="GAG.addGradeModal()"><i data-lucide="plus"></i> เพิ่มวิชา</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table"><thead><tr><th>วิชา</th><th>กลุ่มสาระ</th><th>หน่วยกิต</th><th>ชั้น/เทอม</th><th>เกรด</th><th></th></tr></thead>
          <tbody id="grade-body"></tbody></table>
        </div>
      </div>`;
    $('grade-lv').onchange = renderGradeRows; $('grade-tm').onchange = renderGradeRows;
    renderGradeRows(); icon();
  }
  function renderGradeRows() {
    const { sid } = studentCtx();
    const lv = $('grade-lv').value, tm = $('grade-tm').value;
    const gs = API.filter('grades', g => g.studentId===sid && (!lv||g.level===lv) && (!tm||g.term===tm));
    const body = $('grade-body');
    if (!gs.length) { body.innerHTML = `<tr><td colspan="6" class="text-center text-sub" style="padding:24px">ยังไม่มีข้อมูลเกรด — กด “โหลดหลักสูตร” หรือ “เพิ่มวิชา”</td></tr>`; return; }
    body.innerHTML = gs.map(g => {
      const v = parseFloat(g.grade);
      const cls = v>=3.5?'chip-success':v>=2.5?'chip-teal':v>=1.5?'chip-warning':v>0?'chip-coral':'chip-error';
      const opts = GRADE_OPTS.map(o=>`<option value="${o}" ${v===o?'selected':''}>${o.toFixed(1)}</option>`).join('');
      return `<tr>
        <td class="font-bold">${esc(g.subject)}</td>
        <td><span class="chip chip-neutral text-xs">${esc(g.group)}</span></td>
        <td>${parseFloat(g.credit).toFixed(1)}</td>
        <td>${esc(g.level)} ${esc(g.term)}</td>
        <td class="flex items-center gap-sm"><span class="chip ${cls}">${v.toFixed(1)}</span>
          <select class="select" style="width:80px;height:34px" onchange="GAG.setGrade('${g.id}',this.value)">${opts}</select></td>
        <td><button class="icon-btn text-error" onclick="GAG.delGrade('${g.id}')"><i data-lucide="trash-2"></i></button></td>
      </tr>`;
    }).join('');
    icon();
  }
  function setGrade(id,val){ const g=API.getById('grades',id); if(g){ g.grade=String(parseFloat(val)); API.upsert('grades',g); refreshGrades(); } }
  function delGrade(id){ API.delete('grades',id); refreshGrades(); }
  function refreshGrades(){ const el=document.querySelector('.tab-content.active')||document.getElementById('tab-grades'); if(el) grades(el); }

  function addGradeModal() {
    const groups = ['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','ภาษาต่างประเทศ','สังคมศึกษา','สุขศึกษาและพลศึกษา','ศิลปะ','การงานอาชีพและเทคโนโลยี'];
    modal(`<div class="modal-header"><h3 class="modal-title font-head">เพิ่มวิชา</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">ชื่อวิชา</label><input class="input" id="ag-sub" placeholder="เช่น คณิตศาสตร์เพิ่มเติม"></div>
        <div class="form-group"><label class="form-label">กลุ่มสาระ</label><select class="select" id="ag-grp">${groups.map(g=>`<option>${g}</option>`).join('')}</select></div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">เกรด</label><select class="select" id="ag-grade">${GRADE_OPTS.map(o=>`<option value="${o}">${o.toFixed(1)}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">หน่วยกิต</label><input class="input" id="ag-cr" type="number" value="1" step="0.5" min="0.5" max="4"></div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">ชั้น</label><select class="select" id="ag-lv"><option>ม.4</option><option>ม.5</option><option>ม.6</option></select></div>
          <div class="form-group"><label class="form-label">เทอม</label><select class="select" id="ag-tm"><option>เทอม 1</option><option>เทอม 2</option></select></div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.addGrade()">บันทึก</button></div>`);
  }
  function addGrade() {
    const { sid } = studentCtx();
    const sub = $('ag-sub').value.trim(); if(!sub){ toast('กรุณากรอกชื่อวิชา'); return; }
    API.upsert('grades',{ id:uid('gr'), studentId:sid, subject:sub, group:$('ag-grp').value, credit:$('ag-cr').value, grade:String(parseFloat($('ag-grade').value)), level:$('ag-lv').value, term:$('ag-tm').value });
    closeModal(); refreshGrades();
  }
  function autoLoadCurriculum() {
    const { sid, student } = studentCtx();
    const plan = currentPlan(student);
    const lv = $('grade-lv').value || 'ม.4', tm = $('grade-tm').value || 'เทอม 1';
    const key = `${lv} ${tm}`;
    const subs = window.CURRICULUM_DATA[plan] && window.CURRICULUM_DATA[plan][key];
    if (!subs || !subs.length) { toast(`ไม่พบหลักสูตรแผน "${plan}" ${key}`); return; }
    API.filter('grades', g => g.studentId===sid && g.level===lv && g.term===tm).forEach(g => API.delete('grades', g.id));
    subs.forEach(s => API.upsert('grades',{ id:uid('gr'), studentId:sid, subject:s.sub, group:s.grp, credit:String(s.cr), grade:'4', level:lv, term:tm }));
    toast(`โหลด ${subs.length} วิชา (${plan} ${key})`); refreshGrades();
  }

  // required calc
  function _calcTm(){ const lv=$('calc-lv').value,tm=$('calc-tm');[...tm.options].forEach(o=>{ if(o.value==='เทอม 2'){ o.disabled=(lv==='ม.6'); if(lv==='ม.6'&&tm.value==='เทอม 2')tm.value='เทอม 1'; }}); _calcClear(); }
  function _calcClear(){ PRIOR=[]; if($('calc-prior'))$('calc-prior').innerHTML=''; if($('calc-result'))$('calc-result').innerHTML=''; }
  function prepareCalc() {
    const { sid, student } = studentCtx();
    const lv=$('calc-lv').value, tm=$('calc-tm').value;
    const idx = TERM_ORDER.findIndex(t=>t[0]===lv&&t[1]===tm);
    if (idx>CALC_END_IDX){ toast('TCAS ใช้ GPAX ถึง ม.6 เทอม 1 เท่านั้น'); return; }
    PRIOR = TERM_ORDER.slice(0,idx);
    $('calc-result').innerHTML='';
    const box=$('calc-prior');
    if (!PRIOR.length){ box.innerHTML=`<p class="text-sub text-sm">${lv} ${tm} เป็นเทอมแรก ไม่มีเทอมก่อนหน้า</p><button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="GAG.calcRequired('${lv}','${tm}')">คำนวณ</button>`; return; }
    const plan = currentPlan(student);
    if(!plan){ box.innerHTML='<p class="text-error text-sm">ไม่พบแผนการเรียนของคุณ</p>'; return; }
    // auto-fill prior-term subjects (default 4.0) if not present
    PRIOR.forEach(([plv,ptm]) => {
      const has = API.filter('grades',g=>g.studentId===sid&&g.level===plv&&g.term===ptm).length;
      if (has) return;
      const subs = window.CURRICULUM_DATA[plan] && window.CURRICULUM_DATA[plan][`${plv} ${ptm}`];
      if (subs) subs.forEach(s=>API.upsert('grades',{id:uid('gr'),studentId:sid,subject:s.sub,group:s.grp,credit:String(s.cr),grade:'4',level:plv,term:ptm}));
    });
    const opts = v => GRADE_OPTS.map(o=>`<option value="${o}" ${v===o?'selected':''}>${o.toFixed(1)}</option>`).join('');
    const sections = PRIOR.map(([plv,ptm]) => {
      const tg = API.filter('grades',g=>g.studentId===sid&&g.level===plv&&g.term===ptm);
      if (!tg.length) { const m=getManual(sid,plv,ptm); return `<div class="card" style="background:var(--surface,#f8fafc);margin-bottom:10px;padding:12px">
        <div class="font-bold text-sm mb-sm">${plv} ${ptm} <span class="text-sub text-xs">(ไม่พบรายวิชา กรอกเกรดเฉลี่ยแทน)</span></div>
        <div class="grid-2"><div class="form-group"><label class="form-label">GPA</label><input class="input" id="mt-gpa-${plv}-${ptm}" type="number" step="0.01" min="0" max="4" value="${m?m.gpa:''}"></div>
        <div class="form-group"><label class="form-label">หน่วยกิตรวม</label><input class="input" id="mt-cr-${plv}-${ptm}" type="number" step="0.5" min="0.5" value="${m?m.cr:''}"></div></div></div>`; }
      return `<div style="margin-bottom:12px"><div class="font-bold text-sm mb-sm"><i data-lucide="book-open" style="width:14px;height:14px"></i> ${plv} ${ptm}</div>
        <div class="table-wrap"><table class="table"><thead><tr><th>วิชา</th><th>หน่วยกิต</th><th>เกรด</th></tr></thead><tbody>
        ${tg.map(g=>`<tr><td>${esc(g.subject)}</td><td>${parseFloat(g.credit).toFixed(1)}</td><td><select class="select" style="width:80px;height:34px" onchange="GAG.setGrade('${g.id}',this.value)">${opts(parseFloat(g.grade))}</select></td></tr>`).join('')}
        </tbody></table></div></div>`;
    }).join('');
    box.innerHTML = `<p class="text-sub text-sm mb-sm">ระบบดึงรายวิชาตามหลักสูตรตั้งแต่ ม.4 เทอม 1 ถึงเทอมก่อนหน้า <b>${lv} ${tm}</b> (ค่าเริ่มต้น 4.0) แก้ให้ตรงจริงแล้วกดคำนวณ</p>${sections}
      <button class="btn btn-primary btn-sm" onclick="GAG.calcRequired('${lv}','${tm}')"><i data-lucide="calculator"></i> คำนวณเกรดขั้นต่ำ</button>`;
    icon();
  }
  function calcRequired(lv,tm) {
    const { sid, student } = studentCtx();
    const st = student || {};
    let tc = parseFloat(st.prevCredits)||0, tp = (parseFloat(st.prevGPAX)||0)*tc;
    for (const [plv,ptm] of PRIOR) {
      const tg = API.filter('grades',g=>g.studentId===sid&&g.level===plv&&g.term===ptm);
      if (tg.length){ tg.forEach(g=>{ const cr=parseFloat(g.credit)||0; tc+=cr; tp+=cr*parseFloat(g.grade); }); continue; }
      const gpa=parseFloat(($(`mt-gpa-${plv}-${ptm}`)||{}).value), cr=parseFloat(($(`mt-cr-${plv}-${ptm}`)||{}).value);
      if (isNaN(gpa)||isNaN(cr)||cr<=0){ toast(`กรอกเกรดเฉลี่ยและหน่วยกิตของ ${plv} ${ptm} ให้ครบ`); return; }
      saveManual(sid,plv,ptm,gpa,cr); tc+=cr; tp+=gpa*cr;
    }
    const minG = API.targetMinGPAX(sid);
    const plan = currentPlan(student);
    const targetTC = window.getTermCurriculumCredits(plan,lv,tm);
    const required = (minG*(tc+targetTC)-tp)/targetTC;
    const box=$('calc-result');
    if (required<=0) box.innerHTML=`<div class="chip chip-success" style="display:block;padding:14px;line-height:1.7"><i data-lucide="check-circle" style="width:14px;height:14px"></i> คุณถึงเกณฑ์แล้ว! แม้ ${lv} ${tm} ได้ 0 ทุกวิชา GPAX รวมก็ยังไม่ต่ำกว่าเกณฑ์ ${minG.toFixed(2)}</div>`;
    else if (required>4) box.innerHTML=`<div class="chip chip-error" style="display:block;padding:14px;line-height:1.7"><i data-lucide="x-circle" style="width:14px;height:14px"></i> ต้องได้เฉลี่ย ${required.toFixed(2)} ใน ${lv} ${tm} ซึ่งเกิน 4.00 จึงเป็นไปไม่ได้ภายในเทอมเดียว แนะนำปรึกษาครูแนะแนวหรือพิจารณาคณะสำรอง</div>`;
    else { const steps=[0,1,1.5,2,2.5,3,3.5,4]; const sug=steps.find(s=>s>=required-1e-9);
      box.innerHTML=`<div class="chip ${required>3.25?'chip-warning':'chip-success'}" style="display:block;padding:14px;line-height:1.7"><b>ต้องทำเกรดเฉลี่ยอย่างน้อย ${required.toFixed(2)}</b> ใน <b>${lv} ${tm}</b> (~${targetTC} หน่วยกิต) เพื่อให้ GPAX ถึงเกณฑ์ ${minG.toFixed(2)}</div>
      <p class="text-sub text-sm" style="margin-top:8px"><i data-lucide="lightbulb" style="width:14px;height:14px;color:var(--yellow)"></i> เกรดเป็นขั้น แนะนำตั้งเป้าอย่างน้อย <b>${sug!=null?sug.toFixed(1):'4.0'}</b> ทุกวิชาเพื่อความชัวร์</p>`; }
  }

  // ── TCAS targets ──
  function tcas(el) {
    const { sid, student, houses } = studentCtx();
    const gpax = API.calcGPAX(sid);
    const targets = API.filter('targets', t => t.studentId === sid);
    el.innerHTML = `
      <div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="target"></i> เป้าหมาย TCAS</h1><p class="page-sub">GPAX ปัจจุบัน ${gpax.toFixed(2)} — ไฟจราจรเทียบเกณฑ์ขั้นต่ำแต่ละคณะ</p></div>
        <div class="page-actions"><button class="btn btn-primary btn-md" onclick="GAG.addTargetModal()"><i data-lucide="plus"></i> เพิ่มเป้าหมาย</button></div></div>
      <div class="grid-2" id="tcas-list"></div>`;
    renderTargets(sid, gpax); icon();
  }
  function renderTargets(sid, gpax) {
    const list = $('tcas-list'); const targets = API.filter('targets', t => t.studentId===sid);
    if (!targets.length){ list.innerHTML = `<div class="card p-xl text-center" style="grid-column:1/-1"><div style="display:flex;justify-content:center;margin-bottom:12px"><i data-lucide="target" style="width:48px;height:48px;stroke-width:1.5;color:var(--text-hint)"></i></div><h3 class="font-head">ยังไม่มีเป้าหมาย</h3><p class="text-sub">เพิ่มคณะในฝันเพื่อติดตามความคืบหน้า</p></div>`; icon(); return; }
    list.innerHTML = targets.map(t => {
      const p = API.getById('tcasPrograms', t.programId); if(!p) return '';
      const st = API.statusColor(gpax, p.minGPAX);
      const [lbl,chip] = st==='green'?['ผ่านเกณฑ์','chip-success']:st==='yellow'?['ใกล้เคียง','chip-warning']:['ยังไม่ถึง','chip-error'];
      return `<div class="card elevated tcas-card">
        <div class="flex justify-between items-start mb-sm"><span class="flex items-center gap-sm"><span class="traffic-dot ${st}"></span><span class="chip chip-teal text-xs">รอบ ${p.round}</span></span>
          <button class="icon-btn text-error" onclick="GAG.delTarget('${t.id}')"><i data-lucide="trash-2"></i></button></div>
        <h3 class="card-title font-head text-coral mb-xs">${esc(p.university)}</h3>
        <div class="font-bold mb-md">${esc(p.faculty)}</div>
        <div class="flex justify-between items-center text-sm" style="border-top:1px solid var(--border);padding-top:8px">
          <div><div class="text-sub text-xs">ขั้นต่ำ</div><div class="font-bold">${p.minGPAX}</div></div>
          <div><div class="text-sub text-xs">GPAX คุณ</div><div class="font-bold">${gpax.toFixed(2)}</div></div>
          <span class="chip ${chip}">${lbl}</span></div></div>`;
    }).join(''); icon();
  }
  function addTargetModal() {
    const { sid, houses } = studentCtx();
    const houseIds = houses.map(h=>h.id);
    const kws = houses.flatMap(h=>h.keywords||[]);
    const all = API.getAll('tcasPrograms');
    const owned = new Set(API.filter('targets',t=>t.studentId===sid).map(t=>t.programId));
    // suggest programs matching the student's house keywords first
    const match = p => houseIds.includes('9') || kws.some(k => (p.faculty||'').includes(k));
    const progs = all.filter(p=>!owned.has(p.id)).sort((a,b)=> (match(b)?1:0)-(match(a)?1:0) || a.university.localeCompare(b.university));
    modal(`<div class="modal-header"><h3 class="modal-title font-head">เพิ่มเป้าหมาย TCAS</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">ค้นหา</label><input class="input" id="tg-q" placeholder="พิมพ์ชื่อมหาวิทยาลัย/คณะ" oninput="GAG._filterTargets()"></div>
        <div class="form-group"><label class="form-label">เลือกหลักสูตร (แนะนำจากบ้านของคุณก่อน)</label>
          <select class="select" id="tg-sel" size="10" style="height:auto">
          ${progs.map(p=>`<option value="${p.id}" data-t="${esc((p.university+' '+p.faculty).toLowerCase())}">${match(p)?'⭐ ':''}${esc(p.university)} — ${esc(p.faculty)} (ขั้นต่ำ ${p.minGPAX})</option>`).join('')}
          </select></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.saveTarget()">บันทึกเป้าหมาย</button></div>`, true);
  }
  function _filterTargets(){ const q=$('tg-q').value.toLowerCase(); [...$('tg-sel').options].forEach(o=>{ o.style.display = o.dataset.t.includes(q)?'':'none'; }); }
  function saveTarget(){ const { sid } = studentCtx(); const pid=$('tg-sel').value; if(!pid){ toast('เลือกหลักสูตร'); return; }
    API.upsert('targets',{ id:uid('tg'), studentId:sid, programId:pid }); closeModal();
    renderTargets(sid, API.calcGPAX(sid)); toast('เพิ่มเป้าหมายแล้ว'); }
  function delTarget(id){ const { sid } = studentCtx(); if(confirm('ลบเป้าหมายนี้?')){ API.delete('targets',id); renderTargets(sid, API.calcGPAX(sid)); } }

  // ── News tab (all visible) ──
  function newsTab(el) {
    const { houses } = studentCtx();
    const list = visibleNews(houses.map(h=>h.id));
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="newspaper"></i> ข่าวสาร</h1><p class="page-sub">ประกาศจากครูแนะแนวและบ้านของคุณ</p></div></div>
      <div class="grid-2">${list.length?list.map(newsCardHTML).join(''):'<p class="text-sub">ยังไม่มีข่าวสาร</p>'}</div>`;
    icon();
  }

  // ── Planner ──
  function planner(el) {
    const { sid } = studentCtx();
    const plans = API.filter('plans', p=>p.studentId===sid).sort((a,b)=> (a.done-b.done) || new Date(a.date)-new Date(b.date));
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="calendar"></i> วางแผนการเรียน</h1><p class="page-sub">รายการสิ่งที่ต้องทำ/ทบทวน</p></div></div>
      <div class="card elevated mb-lg"><div class="flex gap-sm" style="flex-wrap:wrap">
        <input class="input" id="pl-title" placeholder="เพิ่มรายการ เช่น ทบทวนสูตรเคมี" style="flex:1;min-width:200px">
        <input class="input" id="pl-date" type="date" style="width:180px">
        <button class="btn btn-primary btn-md" onclick="GAG.addPlan()"><i data-lucide="plus"></i> เพิ่ม</button></div></div>
      <div id="pl-list">${plans.length?plans.map(p=>`
        <div class="card ${p.done?'':'elevated'} flex justify-between items-center" style="margin-bottom:10px;${p.done?'opacity:.6':''}">
          <label class="flex items-center gap-sm" style="flex:1;cursor:pointer"><input type="checkbox" ${p.done?'checked':''} onchange="GAG.togPlan('${p.id}')"><span style="${p.done?'text-decoration:line-through':''}">${esc(p.title)}</span></label>
          <div class="flex items-center gap-md"><span class="text-sub text-sm">${fmtDate(p.date)}</span><button class="icon-btn text-error" onclick="GAG.delPlan('${p.id}')"><i data-lucide="trash-2"></i></button></div>
        </div>`).join(''):'<p class="text-sub text-center" style="padding:30px">ยังไม่มีรายการ เริ่มเพิ่มได้เลย</p>'}</div>`;
    icon();
  }
  function addPlan(){ const { sid } = studentCtx(); const t=$('pl-title').value.trim(); if(!t){ toast('กรอกรายการ'); return; }
    API.upsert('plans',{ id:uid('pl'), studentId:sid, title:t, date:$('pl-date').value||new Date().toISOString().slice(0,10), done:false }); rerender(planner); }
  function togPlan(id){ const p=API.getById('plans',id); if(p){ p.done=!p.done; API.upsert('plans',p); rerender(planner); } }
  function delPlan(id){ API.delete('plans',id); rerender(planner); }

  // ── Pretest (timed) + Survey ──
  let _pt = { timer:null, deadline:null, active:null };
  function pretest(el) {
    GAG._el = el;
    const { sid, houses } = studentCtx();
    const agg = API.pretestsOf(sid);
    const results = API.filter('pretestResults', r=>r.studentId===sid);
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="clipboard-list"></i> ทดสอบวัดระดับ</h1><p class="page-sub">ข้อสอบจำลองแนว TGAT/TPAT/A-Level จับเวลา 30 นาที/ชุด</p></div></div>
      ${!houses.length?'<p class="text-sub">ยังไม่ได้สังกัดบ้าน</p>':houses.map(h=>{
        const hid = parseInt(h.id);
        if (hid===9){ const done=agg.find(p=>p.houseId==='9'&&p.status==='completed');
          return `<div class="card elevated mb-lg" style="border-top:4px solid ${h.color}"><div class="card-head"><h3 class="card-title font-head">${esc(h.name)} (แบบสอบถาม)</h3></div>
            <p class="text-sub text-sm mb-md">${esc(h.desc||'')}</p>
            ${done?`<span style="display:inline-flex;align-items:center;gap:4px;color:var(--green)"><i data-lucide="check" style="width:14px;height:14px"></i> ประเมินแล้ว</span> <button class="btn btn-ghost btn-sm" onclick="GAG.startSurvey()">ทำใหม่</button>`:`<button class="btn btn-secondary btn-md" onclick="GAG.startSurvey()">ทำแบบสอบถาม</button>`}</div>`; }
        const setKeys = window.HOUSE_TEST_SETS[hid]||[];
        return `<div class="card elevated mb-lg" style="border-top:4px solid ${h.color}"><div class="card-head"><h3 class="card-title font-head">${esc(h.name)}</h3></div>
          <p class="text-sub text-sm mb-md">${esc(h.desc||'')}</p>
          <div class="flex flex-col gap-sm">${!setKeys.length?'<p class="text-sub text-sm">ยังไม่มีชุดข้อสอบ</p>':setKeys.map(sk=>{
            const set=window.PRETEST_SETS[sk]; const r=results.find(x=>x.houseId===h.id&&x.setKey===sk);
            return `<div class="flex justify-between items-center" style="border:1px solid var(--border);border-radius:12px;padding:12px 16px;flex-wrap:wrap;gap:10px">
              <div><div class="font-bold">${esc(set.subject)}</div><div class="text-sub text-xs">${set.qs.length} ข้อ · ⏱ ${Math.round(set.duration/60)} นาที</div></div>
              ${r?`<div class="flex items-center gap-sm"><span class="chip ${r.score>=76?'chip-success':r.score>=36?'chip-warning':'chip-error'}">${r.score}/100</span><button class="btn btn-ghost btn-sm" onclick="GAG.startTest(${hid},'${sk}')">ทำใหม่</button></div>`
                :`<button class="btn btn-primary btn-sm" onclick="GAG.startTest(${hid},'${sk}')">เริ่มทำ</button>`}</div>`;
          }).join('')}</div></div>`;
      }).join('')}`;
    icon();
  }
  function startSurvey() {
    const el = GAG._el;
    el.innerHTML = `<div style="max-width:820px;margin:0 auto">
      <div class="card elevated mb-lg" style="background:linear-gradient(135deg,#FFB6C1,#FFD1DC);color:#7a2a44"><h2 class="font-head"><i data-lucide="heart"></i> แบบสอบถามค้นหาความถนัด</h2><p>บ้านนี้มีรัก — ตอบ 4 ข้อเพื่อวิเคราะห์บ้านการเรียนรู้ที่เหมาะกับคุณ</p></div>
      ${window.SURVEY_QUESTIONS.map((q,i)=>`<div class="card elevated mb-lg"><div class="text-sub text-xs mb-sm">ข้อ ${i+1}</div><div class="font-bold mb-md">${esc(q.q)}</div>
        ${q.o.map((o,j)=>`<label class="flex items-center gap-sm" style="padding:8px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer"><input type="radio" name="sq${i}" value="${o.val}" ${j===0?'checked':''}><span>${esc(o.text)}</span></label>`).join('')}</div>`).join('')}
      <div class="text-center"><button class="btn btn-primary btn-lg" onclick="GAG.submitSurvey()"><i data-lucide="send"></i> ส่งแบบสอบถาม</button></div></div>`;
  }
  function submitSurvey() {
    const { sid } = studentCtx();
    const counts={}; window.SURVEY_QUESTIONS.forEach((q,i)=>{ const v=document.querySelector(`input[name=sq${i}]:checked`).value; counts[v]=(counts[v]||0)+1; });
    let best=1,bc=0; for(const k in counts){ if(counts[k]>bc){bc=counts[k];best=parseInt(k);} }
    const rec = API.houseById(best) || API.houseById('1');
    const ex = API.filter('pretests',p=>p.studentId===sid&&p.houseId==='9')[0];
    API.upsert('pretests',{ id:ex?ex.id:uid('pt'), studentId:sid, houseId:'9', score:'100', status:'completed', takenAt:new Date().toISOString().slice(0,10) });
    GAG._el.innerHTML = `<div style="max-width:600px;margin:40px auto"><div class="card elevated text-center" style="padding:36px">
      <div style="display:flex;justify-content:center;margin-bottom:12px"><i data-lucide="sparkles" style="width:48px;height:48px;stroke-width:1.5;color:var(--yellow)"></i></div><h3 class="font-head" style="margin:12px 0">ผลวิเคราะห์ความสนใจ</h3>
      <span class="chip chip-success" style="font-size:1rem;padding:8px 18px">บ้านที่แนะนำ: ${esc(rec.name)}</span>
      <p style="margin:18px 0">แนะนำให้เข้าร่วมกิจกรรมแนะแนวของ <b>${esc(rec.name)}</b> เพื่อพัฒนาจุดเด่นและค้นพบวิชาที่เหมาะสม</p>
      <button class="btn btn-primary" onclick="GAG.pretest(GAG._el)">← กลับหน้าทดสอบ</button></div></div>`;
    icon();
  }
  function startTest(hid, sk) {
    const set = window.PRETEST_SETS[sk]; if(!set) return;
    const house = API.houseById(hid);
    _pt.active = { hid:String(hid), sk }; _pt.deadline = Date.now()+set.duration*1000;
    GAG._el.innerHTML = `<div style="max-width:820px;margin:0 auto">
      <div class="card elevated mb-lg" style="position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div><h2 class="font-head">${esc(set.subject)}</h2><p class="text-sub text-sm">${esc(house?house.name:'')} · ${set.qs.length} ข้อ · เต็ม 100</p></div>
        <div class="text-center"><div class="text-sub text-xs">เวลาที่เหลือ</div><div id="pt-timer" class="font-head" style="font-size:1.5rem">--:--</div></div></div>
      ${set.qs.map((q,i)=>`<div class="card elevated mb-lg"><div class="text-sub text-xs mb-sm">ข้อ ${i+1}</div><div class="font-bold mb-md">${esc(q.q)}</div>
        ${q.o.map((o,j)=>`<label class="flex items-center gap-sm" style="padding:8px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer"><input type="radio" name="ptq${i}" value="${j}"><span>${esc(o)}</span></label>`).join('')}</div>`).join('')}
      <div class="text-center"><button class="btn btn-primary btn-lg" onclick="GAG.submitTest(false)"><i data-lucide="send"></i> ส่งคำตอบ</button></div></div>`;
    tick(); _pt.timer = setInterval(tick, 1000);
  }
  function tick() {
    const el=$('pt-timer'); if(!el||!_pt.deadline){ if(_pt.timer)clearInterval(_pt.timer); return; }
    const r=Math.max(0,Math.round((_pt.deadline-Date.now())/1000));
    el.textContent = `${String(Math.floor(r/60)).padStart(2,'0')}:${String(r%60).padStart(2,'0')}`;
    if(r<=60) el.style.color='#EF4444';
    if(r<=0) submitTest(true);
  }
  function submitTest(auto) {
    if(!_pt.active) return; const { sid } = studentCtx(); const { hid, sk } = _pt.active; const set=window.PRETEST_SETS[sk];
    if(_pt.timer){ clearInterval(_pt.timer); _pt.timer=null; }
    let correct=0; set.qs.forEach((q,i)=>{ const s=document.querySelector(`input[name=ptq${i}]:checked`); if(s&&parseInt(s.value)===q.a)correct++; });
    const score=Math.round(correct/set.qs.length*100);
    const ex = API.filter('pretestResults',r=>r.studentId===sid&&r.houseId===hid&&r.setKey===sk)[0];
    API.upsert('pretestResults',{ id:ex?ex.id:uid('pr'), studentId:sid, houseId:hid, setKey:sk, score:String(score), correct:String(correct), total:String(set.qs.length), completedAt:new Date().toISOString() });
    // recalc house aggregate
    const rs = API.filter('pretestResults',r=>r.studentId===sid&&r.houseId===hid);
    const avg = Math.round(rs.reduce((s,r)=>s+parseInt(r.score),0)/rs.length);
    const agg = API.filter('pretests',p=>p.studentId===sid&&p.houseId===hid)[0];
    API.upsert('pretests',{ id:agg?agg.id:uid('pt'), studentId:sid, houseId:hid, score:String(avg), status:'completed', takenAt:new Date().toISOString().slice(0,10) });
    _pt.active=null; _pt.deadline=null;
    const rec = API.getPracRec(score); const house=API.houseById(hid);
    GAG._el.innerHTML = `<div style="max-width:600px;margin:40px auto"><div class="card elevated text-center" style="padding:36px">
      ${auto?'<div class="chip chip-warning" style="margin-bottom:12px"><i data-lucide="clock"></i> หมดเวลา ระบบส่งให้อัตโนมัติ</div>':''}
      <div class="text-sub">ผลคะแนน ${esc(set.subject)} (${esc(house?house.name:'')})</div>
      <div class="gpax-big" style="color:${rec.color};font-size:3.5rem">${score}<span style="font-size:1.4rem">/100</span></div>
      <div style="margin:14px 0"><span class="chip" style="background:${rec.color}22;color:${rec.color}">ระดับ: ${rec.lvl}</span></div>
      <p><i data-lucide="calendar"></i> แนะนำฝึกฝนอย่างน้อย <b style="color:${rec.color}">${rec.days} วัน/สัปดาห์</b></p>
      <p class="text-sub text-sm">ถูก ${correct} จาก ${set.qs.length} ข้อ</p>
      <div class="flex gap-sm justify-center" style="margin-top:18px"><button class="btn btn-ghost" onclick="GAG.pretest(GAG._el)">← กลับ</button><button class="btn btn-primary" onclick="GAG.go('practice')">ไปห้องฝึกฝน →</button></div></div>`;
    icon();
  }

  // ── Practice ──
  function practice(el) {
    const { sid } = studentCtx();
    const done = API.filter('pretests',p=>p.studentId===sid&&p.status==='completed');
    if(!done.length){ el.innerHTML=`<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="dumbbell"></i> ห้องฝึกฝนโจทย์</h1></div></div>
      <div class="card elevated text-center" style="padding:50px"><div style="display:flex;justify-content:center;margin-bottom:12px"><i data-lucide="lock" style="width:48px;height:48px;stroke-width:1.5;color:var(--text-hint)"></i></div><h3 class="font-head" style="margin:12px 0">ทำแบบทดสอบก่อน</h3><p class="text-sub mb-md">ทำ Pre-Test อย่างน้อย 1 บ้านเพื่อปลดล็อกห้องฝึกฝน</p><button class="btn btn-primary" onclick="GAG.go('pretest')">ไปหน้าแบบทดสอบ</button></div>`; icon(); return; }
    const logs = API.filter('practice',p=>p.studentId===sid);
    const today = new Date().toISOString().slice(0,10);
    const didToday = logs.some(l=>l.date===today);
    const week = logs.filter(l=>(Date.now()-new Date(l.date))/864e5<=7).length;
    const best = done.reduce((a,b)=>parseInt(a.score)>parseInt(b.score)?a:b);
    const rec = API.getPracRec(best.score);
    const days=[]; for(let i=27;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(d.toISOString().slice(0,10)); }
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="dumbbell"></i> ห้องฝึกฝนโจทย์</h1><p class="page-sub">เป้าหมายจากผลประเมินของคุณ</p></div></div>
      <div class="grid-2 mb-lg">
        <div class="card elevated"><div class="stat-label">เป้าหมายต่อสัปดาห์</div><div class="stat-value" style="color:${rec.color}">${rec.days} วัน</div><div class="text-sub text-sm">ระดับ: ${rec.lvl}</div></div>
        <div class="card elevated"><div class="stat-label">ทำแล้วสัปดาห์นี้</div><div class="stat-value">${week} วัน</div><div class="progress-wrap" style="margin-top:8px"><div class="progress-bar" style="width:${Math.min(100,week/parseInt(rec.days)*100)}%;background:${rec.color}"></div></div></div>
      </div>
      <div class="card elevated mb-lg">
        <h3 class="card-title font-head"><i data-lucide="download"></i> คลังข้อสอบเก่า (PDF)</h3>
        <p class="text-sub text-sm mb-md">ดาวน์โหลดข้อสอบเก่าเพื่อนำไปฝึกฝนด้วยตัวเอง</p>
        <div class="flex gap-sm flex-wrap">
          <button class="btn btn-surface btn-sm" onclick="GAG.toast('ดาวน์โหลดไฟล์ TGAT.pdf สำเร็จ')"><i data-lucide="file-text"></i> TGAT</button>
          <button class="btn btn-surface btn-sm" onclick="GAG.toast('ดาวน์โหลดไฟล์ TPAT3.pdf สำเร็จ')"><i data-lucide="file-text"></i> TPAT3 (ความถนัดวิศวะ)</button>
          <button class="btn btn-surface btn-sm" onclick="GAG.toast('ดาวน์โหลดไฟล์ A-Level_Math1.pdf สำเร็จ')"><i data-lucide="file-text"></i> A-Level คณิต 1</button>
          <button class="btn btn-surface btn-sm" onclick="GAG.toast('ดาวน์โหลดไฟล์ A-Level_Physics.pdf สำเร็จ')"><i data-lucide="file-text"></i> A-Level ฟิสิกส์</button>
          <button class="btn btn-surface btn-sm" onclick="GAG.toast('ดาวน์โหลดไฟล์ A-Level_English.pdf สำเร็จ')"><i data-lucide="file-text"></i> A-Level ภาษาอังกฤษ</button>
        </div>
      </div>
      <div class="card elevated"><div class="table-toolbar"><h3 class="card-title font-head" style="margin:0"><i data-lucide="calendar-days"></i> ปฏิทินฝึกฝน (28 วันล่าสุด)</h3>
        ${didToday?'<span style="display:inline-flex;align-items:center;gap:4px;color:var(--green)"><i data-lucide="check" style="width:14px;height:14px"></i> เช็คอินแล้ววันนี้</span>':'<button class="btn btn-secondary btn-sm" onclick="GAG.checkIn()"><i data-lucide="check-circle-2"></i> เช็คอินวันนี้</button>'}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:12px">
        ${['จ','อ','พ','พฤ','ศ','ส','อา'].map(d=>`<div class="text-center text-xs text-sub font-bold">${d}</div>`).join('')}
        ${days.map(d=>{ const on=logs.some(l=>l.date===d); const t=d===today; return `<div class="text-center" style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;border:1px solid ${t?'var(--primary,#2563EB)':'var(--border)'};${on?'background:#22C55E22':''}"><span class="text-xs">${new Date(d).getDate()}</span>${on?'<span class="text-xs">✓</span>':''}</div>`; }).join('')}</div></div>`;
    icon();
  }
  function checkIn(){ const { sid } = studentCtx(); const today=new Date().toISOString().slice(0,10);
    if(!API.filter('practice',p=>p.studentId===sid&&p.date===today).length) API.upsert('practice',{id:uid('pc'),studentId:sid,date:today}); rerender(practice); }

  // ── Seniors ──
  function seniors(el) {
    const { houses } = studentCtx(); const ids = houses.map(h=>parseInt(h.id));
    const list = window.ALUMNI.filter(a=>ids.includes(a.hId));
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="graduation-cap"></i> ทำเนียบรุ่นพี่</h1><p class="page-sub">รุ่นพี่ในบ้านที่คุณสังกัด</p></div></div>
      <div class="grid-3">${list.length?list.map(s=>{const h=API.houseById(s.hId);return `<div class="card elevated text-center">
        <div style="display:flex;justify-content:center;margin-bottom:12px"><i data-lucide="user-check" style="width:40px;height:40px;stroke-width:1.5;color:var(--primary)"></i></div><h3 class="font-head" style="margin:6px 0">${esc(s.name)}</h3>
        <span class="chip chip-teal text-xs">รอบ TCAS ${s.rd}</span>
        <p class="text-sm" style="margin:10px 0"><b>${esc(s.fac)}</b><br>${esc(s.dept)}<br><span class="text-coral">${esc(s.uni)}</span></p>
        <p class="text-xs text-sub" style="border-top:1px solid var(--border);padding-top:8px">${esc(s.sc)}</p></div>`;}).join(''):'<p class="text-sub">ยังไม่มีข้อมูลรุ่นพี่ในบ้านของคุณ</p>'}</div>`;
    icon();
  }

  // ── University news (ทปอ.) ──
  function uniNews(el) {
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="newspaper"></i> ข่าว ทปอ. / มหาวิทยาลัย</h1></div></div>
      <div class="flex flex-col gap-md">${window.UNI_NEWS.map(n=>`<div class="card elevated"><div class="flex justify-between items-center mb-sm"><span class="chip chip-info">${esc(n.source)}</span><span class="text-sub text-xs">${fmtDate(n.at)}</span></div><h3 class="font-head mb-sm">${esc(n.title)}</h3><p class="text-sub text-sm">${esc(n.body)}</p></div>`).join('')}</div>`;
    icon();
  }

  // ── MOU ──
  function mou(el) {
    const { sid } = studentCtx(); const gpax = API.calcGPAX(sid);
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="handshake"></i> MOU มหาวิทยาลัย</h1><p class="page-sub">เปรียบเทียบเกณฑ์ขั้นต่ำกับ GPAX ปัจจุบัน (${gpax.toFixed(2)})</p></div></div>
      <div class="grid-2">${window.MOU_LIST.map(mo=>{ const pass=gpax>=mo.minGpa; return `<div class="card elevated" style="border-top:4px solid ${pass?'#22C55E':'var(--border)'}">
        <h3 class="card-title font-head mb-xs">${esc(mo.fac)}</h3><div class="font-bold text-coral mb-sm">มหาวิทยาลัย${esc(mo.uni)}</div>
        <p class="text-sub text-sm mb-md">เกณฑ์ขั้นต่ำ: GPAX ${mo.minGpa.toFixed(2)}</p>
        ${pass?`<span style="display:inline-flex;align-items:center;gap:4px;color:var(--green)"><i data-lucide="check-circle-2" style="width:16px;height:16px"></i> ผ่านเกณฑ์</span>`:`<span style="display:inline-flex;align-items:center;gap:4px;color:var(--red)"><i data-lucide="x-circle" style="width:16px;height:16px"></i> ขาดอีก ${(mo.minGpa-gpax).toFixed(2)}</span>`}</div>`; }).join('')}</div>`;
    icon();
  }

  // ════════════════════════════════════════════════════════════════
  //  SHARED: Forum + Chat + student-grades modal
  // ════════════════════════════════════════════════════════════════
  function forum(el) {
    const u = Auth.getUser();
    const isStudent = u.role==='student';
    const houseIds = isStudent ? API.housesOf(u.studentId||u.id).map(h=>h.id) : (u.role==='teacher'? [u.houseId] : API.getAll('houses').map(h=>h.id));
    const threads = API.filter('threads',t=>houseIds.includes(t.houseId)).sort((a,b)=>new Date(b.at)-new Date(a.at));
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="message-square"></i> ถามตอบปัญหาโจทย์</h1></div>
      ${isStudent?'<div class="page-actions"><button class="btn btn-primary btn-md" onclick="GAG.newThread()"><i data-lucide="plus"></i> ตั้งกระทู้</button></div>':''}</div>
      <div class="flex flex-col gap-md">${threads.length?threads.map(t=>{ const h=API.houseById(t.houseId); const a=API.userById(t.authorId); const rc=API.filter('replies',r=>r.threadId===t.id).length;
        return `<div class="card elevated" style="cursor:pointer" onclick="GAG.openThread('${t.id}')">
          <div class="flex justify-between items-center mb-sm"><span class="text-sm">${esc(a?a.displayName:'?')} · ${houseBadge(h)}</span><span class="chip chip-neutral text-xs">${rc} คำตอบ</span></div>
          <h3 class="font-head mb-xs">${esc(t.title)}</h3><p class="text-sub text-sm">${esc(t.body.slice(0,120))}${t.body.length>120?'…':''}</p>
          <div class="text-xs text-sub" style="margin-top:6px">${fmtDate(t.at)}</div></div>`; }).join(''):'<p class="text-sub text-center" style="padding:30px">ยังไม่มีกระทู้ในบ้านของคุณ</p>'}</div>`;
    GAG._forumEl = el; icon();
  }
  function newThread() {
    const u = Auth.getUser(); const houses = API.housesOf(u.studentId||u.id);
    modal(`<div class="modal-header"><h3 class="modal-title font-head">ตั้งกระทู้ใหม่</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">บ้าน</label><select class="select" id="nt-h">${houses.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">หัวข้อ</label><input class="input" id="nt-t" placeholder="เช่น สงสัยโจทย์ฟิสิกส์..."></div>
        <div class="form-group"><label class="form-label">รายละเอียด</label><textarea class="input" id="nt-b" rows="4" placeholder="อธิบายคำถาม..."></textarea></div>
      </div><div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.postThread()">โพสต์</button></div>`);
  }
  function postThread() {
    const u = Auth.getUser(); const t=$('nt-t').value.trim(), b=$('nt-b').value.trim(); if(!t||!b){ toast('กรอกให้ครบ'); return; }
    API.upsert('threads',{ id:uid('th'), houseId:$('nt-h').value, title:t, body:b, authorId:u.id, at:new Date().toISOString() });
    closeModal(); forum(GAG._forumEl);
  }
  function openThread(id) {
    const t=API.getById('threads',id); if(!t) return; const u=Auth.getUser();
    const rs=API.filter('replies',r=>r.threadId===id).sort((a,b)=>new Date(a.at)-new Date(b.at));
    const h=API.houseById(t.houseId); const a=API.userById(t.authorId);
    GAG._forumEl.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="GAG.forum(GAG._forumEl)" style="margin-bottom:14px"><i data-lucide="arrow-left"></i> กลับ</button>
      <div class="card elevated mb-lg" style="border-top:4px solid ${h?h.color:'#2563EB'}">
        <div class="flex items-center gap-sm mb-sm"><b>${esc(a?a.displayName:'?')}</b>${houseBadge(h)}<span class="text-sub text-xs">${fmtDate(t.at)}</span></div>
        <h2 class="font-head mb-sm">${esc(t.title)}</h2><p style="line-height:1.9;white-space:pre-wrap">${esc(t.body)}</p></div>
      <h3 class="font-head mb-md"><i data-lucide="message-circle"></i> คำตอบ (${rs.length})</h3>
      ${rs.map(r=>{ const ra=API.userById(r.authorId); return `<div class="card mb-md"><div class="flex items-center gap-sm mb-sm"><b>${esc(ra?ra.displayName:'?')}</b><span class="text-sub text-xs">${fmtDate(r.at)}</span></div><p style="line-height:1.8;white-space:pre-wrap">${esc(r.body)}</p></div>`; }).join('')}
      <div class="card elevated"><h4 class="font-head mb-sm"><i data-lucide="edit-3"></i> เขียนคำตอบ</h4><textarea class="input" id="rp-b" rows="3" placeholder="เขียนคำตอบ/เฉลย..."></textarea>
        <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="GAG.postReply('${id}')">ส่งคำตอบ</button></div>`;
    icon();
  }
  function postReply(tid) {
    const u=Auth.getUser(); const b=$('rp-b').value.trim(); if(!b){ toast('เขียนคำตอบก่อน'); return; }
    API.upsert('replies',{ id:uid('rp'), threadId:tid, body:b, authorId:u.id, at:new Date().toISOString() });
    openThread(tid);
  }

  // Chat
  let _peer = null;
  function chat(el) {
    const u = Auth.getUser();
    let contacts;
    if (u.role==='student') { contacts = API.housesOf(u.studentId||u.id).map(h=>API.houseTeacher(h.id)).filter(Boolean);
      // de-dup
      const seen=new Set(); contacts=contacts.filter(c=>!seen.has(c.id)&&seen.add(c.id)); }
    else { contacts = API.filter('users',x=>x.role==='student'&&x.houseId===u.houseId); }
    if (!_peer && contacts.length) _peer = contacts[0].id;
    chatLayout(el, u, contacts, u.role==='student'?'กับครู':'กับนักเรียน');
  }
  function chatLayout(el, u, contacts, suffix) {
    const peer = _peer; const peerUser = peer?API.userById(peer):null;
    const msgs = peer?API.filter('chatMessages',m=>(m.fromId===u.id&&m.toId===peer)||(m.fromId===peer&&m.toId===u.id)).sort((a,b)=>new Date(a.at)-new Date(b.at)):[];
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="message-circle"></i> แชท${suffix}</h1></div></div>
      <div class="flex gap-md" style="align-items:flex-start;flex-wrap:wrap">
        <div class="card elevated" style="width:250px;flex-shrink:0;padding:10px">
          ${contacts.length?contacts.map(c=>`<div class="nav-item ${peer===c.id?'active':''}" style="cursor:pointer" onclick="GAG.selectPeer('${c.id}')">${esc(c.displayName||c.username)}</div>`).join(''):'<p class="text-sub text-sm" style="padding:8px">ไม่มีรายชื่อติดต่อ</p>'}
        </div>
        <div class="card elevated" style="flex:1;min-width:280px;min-height:440px;display:flex;flex-direction:column">
          ${!peer?'<p class="text-sub" style="margin:auto">เลือกผู้ติดต่อทางซ้าย</p>':`
          <div class="font-bold" style="border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:12px">${esc(peerUser?peerUser.displayName:'')}</div>
          <div id="chat-log" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:400px">
            ${msgs.length?msgs.map(m=>`<div style="align-self:${m.fromId===u.id?'flex-end':'flex-start'};max-width:75%;background:${m.fromId===u.id?'var(--primary,#2563EB)':'#F1F5F9'};color:${m.fromId===u.id?'#fff':'#0F172A'};padding:8px 12px;border-radius:14px"><div>${esc(m.body)}</div><div style="font-size:.65rem;opacity:.7;margin-top:2px">${fmtDate(m.at)}</div></div>`).join(''):'<p class="text-sub" style="margin:auto">ยังไม่มีข้อความ ทักทายกันเลย</p>'}
          </div>
          <div class="flex gap-sm"><input class="input" id="chat-in" placeholder="พิมพ์ข้อความ..." style="flex:1" onkeydown="if(event.key==='Enter')GAG.sendChat()"><button class="btn btn-primary" onclick="GAG.sendChat()">ส่ง</button></div>`}
        </div></div>`;
    GAG._chatEl = el; const log=$('chat-log'); if(log) log.scrollTop=log.scrollHeight; icon();
  }
  function selectPeer(id){ _peer=id; chat(GAG._chatEl); }
  function sendChat(){ const u=Auth.getUser(); const inp=$('chat-in'); if(!inp||!_peer) return; const b=inp.value.trim(); if(!b) return;
    API.upsert('chatMessages',{ id:uid('cm'), fromId:u.id, toId:_peer, body:b, at:new Date().toISOString() }); chat(GAG._chatEl); }

  function studentGradesModal(sid) {
    const st = API.studentById(sid) || API.userById(sid);
    const gs = API.filter('grades',g=>g.studentId===sid);
    const gpax = API.calcGPAX(sid); const groups=[...new Set(gs.map(g=>g.group))]; const minG=API.targetMinGPAX(sid);
    const targets = API.filter('targets',t=>t.studentId===sid);
    modal(`<div class="modal-header"><h3 class="modal-title font-head">ผลการเรียน: ${esc(st?st.displayName:sid)}</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="flex items-center gap-md mb-md"><div class="gpax-big text-coral">${gpax.toFixed(2)}</div><div><div class="text-sub text-sm">GPAX รวม</div><div class="text-xs text-sub">เกณฑ์เป้าหมาย ${minG.toFixed(2)}</div></div></div>
        <div class="progress-wrap mb-md"><div class="progress-bar coral" style="width:${gpax/4*100}%"></div></div>
        ${groups.length?`<div class="grid-2 mb-md">${groups.map(g=>{const v=API.calcGroupGPA(sid,g);return `<div class="flex justify-between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span class="text-sm">${esc(g)}</span><b>${v!=null?v.toFixed(2):'—'}</b></div>`;}).join('')}</div>`:'<p class="text-sub">ยังไม่มีข้อมูลเกรด</p>'}
        <div class="text-sub text-xs mb-sm">คณะเป้าหมาย</div>${targets.length?targets.map(t=>{const p=API.getById('tcasPrograms',t.programId);return p?`<div class="text-sm">• ${esc(p.university)} — ${esc(p.faculty)} (ขั้นต่ำ ${p.minGPAX})</div>`:'';}).join(''):'<div class="text-sub text-sm">—</div>'}
      </div>`, true);
  }

  // ════════════════════════════════════════════════════════════════
  //  STAFF: teacher / guidance / admin
  // ════════════════════════════════════════════════════════════════
  function teacherHouse(){ const u=Auth.getUser(); return API.houseById(u.houseId); }
  function studentsInHouse(hid){
    const links = API.filter('studentHouses', l => l.houseId===String(hid));
    const ids = [...new Set(links.map(l=>l.studentId))];
    return ids.map(id => {
      const st = API.studentById(id) || API.userById(id);
      const gpax = API.calcGPAX(id);
      return { id, name:(st&&st.displayName)||id, plan:(st&&st.plan)||'—', level:(st&&st.level)||'—', gpax, status:API.statusColor(gpax,API.targetMinGPAX(id)) };
    });
  }
  const statusDot = s => `<span class="traffic-dot ${s}"></span>`;

  function teacherOverview(el) {
    const house = teacherHouse(); const studs = studentsInHouse(house.id);
    const avgG = studs.length ? studs.reduce((s,x)=>s+x.gpax,0)/studs.length : 0;
    const pts = studs.map(s=>API.pretestsOf(s.id).find(p=>p.houseId===house.id)).filter(Boolean);
    const avgP = pts.length ? pts.reduce((s,p)=>s+parseInt(p.score),0)/pts.length : 0;
    const g=studs.filter(s=>s.status==='green').length, y=studs.filter(s=>s.status==='yellow').length, r=studs.filter(s=>s.status==='red').length;
    const tot=Math.max(studs.length,1);
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title">แผงควบคุม: <span style="color:${house.color}">${esc(house.name)}</span></h1><p class="page-sub">ภาพรวมนักเรียนในบ้านที่คุณดูแล</p></div></div>
      <div class="stats-grid mb-lg">
        <div class="stat-card"><div class="stat-icon teal"><i data-lucide="users"></i></div><div><div class="stat-label">จำนวนนักเรียน</div><div class="stat-value">${studs.length}</div></div></div>
        <div class="stat-card"><div class="stat-icon coral"><i data-lucide="trending-up"></i></div><div><div class="stat-label">GPAX เฉลี่ย</div><div class="stat-value">${avgG.toFixed(2)}</div></div></div>
        <div class="stat-card"><div class="stat-icon yellow"><i data-lucide="clipboard-check"></i></div><div><div class="stat-label">Pre-Test เฉลี่ย</div><div class="stat-value">${avgP.toFixed(0)}</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><i data-lucide="alert-triangle"></i></div><div><div class="stat-label">ต่ำกว่าเกณฑ์</div><div class="stat-value">${r}</div></div></div>
      </div>
      <div class="card elevated"><div class="card-head"><h3 class="card-title font-head">สัดส่วนสถานะนักเรียน</h3></div>
        <div class="flex gap-md mb-md" style="flex-wrap:wrap"><span class="flex items-center gap-sm">${statusDot('green')}<b>${g}</b> ผ่านเกณฑ์ดี</span><span class="flex items-center gap-sm">${statusDot('yellow')}<b>${y}</b> ใกล้เคียง</span><span class="flex items-center gap-sm">${statusDot('red')}<b>${r}</b> ต่ำกว่าเกณฑ์</span></div>
        <div style="display:flex;height:18px;border-radius:9px;overflow:hidden;border:1px solid var(--border)">
          <div style="width:${g/tot*100}%;background:#22C55E"></div><div style="width:${y/tot*100}%;background:#FFB020"></div><div style="width:${r/tot*100}%;background:#EF4444"></div></div>
      </div>`;
    icon();
  }

  function rosterTable(house) {
    const studs = studentsInHouse(house.id);
    if (!studs.length) return `<p class="text-sub">ยังไม่มีนักเรียนในบ้านนี้</p>`;
    const isSurvey = house.id==='9';
    return ['ม.6','ม.5','ม.4'].map(lv => {
      const rows = studs.filter(s=>s.level===lv);
      if (!rows.length) return '';
      return `<h4 class="font-head" style="margin:16px 0 8px;border-left:4px solid ${house.color};padding-left:8px"><i data-lucide="graduation-cap"></i> ระดับชั้น ${lv}</h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>สถานะ</th><th>ชื่อ-นามสกุล</th><th>รหัส</th><th>GPAX</th><th>แผน</th><th>Pre-Test</th><th>XML</th></tr></thead><tbody>
        ${rows.map(s=>{ const pt=API.pretestsOf(s.id).find(p=>p.houseId===house.id);
          return `<tr><td>${statusDot(s.status)}</td>
          <td><a href="#" onclick="GAG.studentGradesModal('${s.id}');return false" class="text-teal font-bold">${esc(s.name)}</a></td>
          <td>${esc(s.id)}</td><td><b>${s.gpax.toFixed(2)}</b></td><td>${esc(s.plan)}</td>
          <td>${pt?`<span class="chip ${parseInt(pt.score)>=76?'chip-success':parseInt(pt.score)>=36?'chip-warning':'chip-error'}">${isSurvey?'ประเมินแล้ว':pt.score+'/100'}</span>`:'<span class="text-sub">—</span>'}</td>
          <td><button class="btn-pill-xs btn-pill-slate" onclick="GAG.exportStudentXML('${s.id}')" title="ส่งออก XML ข้อมูลรายบุคคล"><i data-lucide="file-code"></i> XML</button></td></tr>`; }).join('')}
        </tbody></table></div>`;
    }).join('');
  }
  function roster(el) {
    const house = teacherHouse();
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title">รายชื่อนักเรียน: <span style="color:${house.color}">${esc(house.name)}</span></h1>
      <p class="page-sub">${statusDot('green')} ดี &nbsp; ${statusDot('yellow')} ใกล้เคียง &nbsp; ${statusDot('red')} ต่ำกว่า — คลิกชื่อเพื่อดูผลการเรียน</p></div></div>
      <div class="card elevated">${rosterTable(house)}</div>`;
    icon();
  }
  function rosterAll(el) {
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="users"></i> ข้อมูลนักเรียนทุกบ้าน</h1>
      <p class="page-sub">${statusDot('green')} ดี &nbsp; ${statusDot('yellow')} ใกล้เคียง &nbsp; ${statusDot('red')} ต่ำกว่า</p></div></div>
      ${API.getAll('houses').map(h=>`<div class="card elevated mb-lg" style="border-top:4px solid ${h.color}"><h3 class="font-head mb-sm" style="color:${h.color}"><i data-lucide="home"></i> ${esc(h.name)}</h3>${rosterTable(h)}</div>`).join('')}`;
    icon();
  }

  // News authoring (teacher = own house, guidance = any houses)
  let _newsImg = '';
  function handleNewsImg(input) {
    const f = input.files[0]; if(!f) return; const rd=new FileReader();
    rd.onload = e => { _newsImg=e.target.result; const p=$('news-img-prev'); if(p) p.innerHTML=`<img src="${_newsImg}" style="max-height:160px;border-radius:10px;margin-top:8px">`; };
    rd.readAsDataURL(f);
  }
  function newsForm(scope) {
    const today = new Date().toISOString().slice(0,10);
    const housePicker = scope==='guidance' ? `
      <div class="form-group"><label class="form-label">ส่งให้บ้าน</label>
        <label class="flex items-center gap-sm" style="margin-bottom:8px;font-weight:600"><input type="checkbox" id="news-all" onchange="GAG._toggleAllHouses(this.checked)"> ทุกบ้าน</label>
        <div class="grid-2">${API.getAll('houses').map(h=>`<label class="flex items-center gap-sm" style="border:1px solid var(--border);border-radius:10px;padding:7px 10px"><input type="checkbox" class="news-h" value="${h.id}"> <span class="traffic-dot" style="background:${h.color}"></span> ${esc(h.name)}</label>`).join('')}</div></div>` : '';
    return `<div class="card elevated mb-lg" style="max-width:680px">
      <div class="card-head"><h3 class="card-title font-head"><i data-lucide="edit"></i> สร้างข่าว/ประกาศ</h3></div>
      <div class="form-group"><label class="form-label">รูปโปสเตอร์ (ถ้ามี)</label><input type="file" class="input" accept="image/*" onchange="GAG.handleNewsImg(this)"><div id="news-img-prev"></div></div>
      <div class="form-group"><label class="form-label">หัวข้อ</label><input class="input" id="news-title" placeholder="เช่น ติว TGAT รวมทุกบ้าน"></div>
      <div class="form-group"><label class="form-label">เนื้อหา</label><textarea class="input" id="news-body" rows="4" placeholder="รายละเอียด..."></textarea></div>
      <div class="form-group"><label class="form-label">ลบอัตโนมัติเมื่อพ้นวันที่</label><input type="date" class="input" id="news-exp" min="${today}"></div>
      ${housePicker}
      <button class="btn btn-primary" onclick="GAG.saveNews('${scope}')"><i data-lucide="send"></i> ส่งข่าว</button></div>`;
  }
  function _toggleAllHouses(on){ document.querySelectorAll('.news-h').forEach(cb=>{ cb.checked=on; cb.disabled=on; }); }
  function newsListHTML(filterFn) {
    const now=new Date();
    const list = API.getAll('news').filter(n=>!n.expireAt||new Date(n.expireAt)>=now).filter(filterFn).sort((a,b)=>new Date(b.at)-new Date(a.at));
    if (!list.length) return '<p class="text-sub">ยังไม่มีข่าวที่ส่ง</p>';
    return list.map(n=>{ const hs=(n.targetHouses||[]).includes('all')?'<span class="chip chip-info">ทุกบ้าน</span>':(n.targetHouses||[]).map(id=>{const h=API.houseById(id);return h?`<span class="chip" style="background:${h.color}22;color:${h.color}">${esc(h.name)}</span>`:'';}).join(' ');
      return `<div class="card mb-md"><div class="flex justify-between items-center mb-sm" style="flex-wrap:wrap;gap:6px"><span>${hs}</span><div class="flex items-center gap-sm">${n.expireAt?`<span class="text-sub text-xs"><i data-lucide="clock" style="width:12px;height:12px"></i> ${fmtDate(n.expireAt)}</span>`:''}<button class="icon-btn text-error" onclick="GAG.delNews('${n.id}')"><i data-lucide="trash-2"></i></button></div></div>
        <h4 class="font-head mb-xs">${esc(n.title)}</h4><p class="text-sub text-sm">${esc(n.body.slice(0,140))}${n.body.length>140?'…':''}</p><div class="text-xs text-sub" style="margin-top:6px">${fmtDate(n.at)}</div></div>`; }).join('');
  }
  function houseNews(el) {
    const house = teacherHouse(); _newsImg='';
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="newspaper"></i> ประกาศบ้าน <span style="color:${house.color}">${esc(house.name)}</span></h1><p class="page-sub">ส่งเฉพาะนักเรียนในบ้านที่คุณดูแล</p></div></div>
      ${newsForm('teacher')}<h3 class="font-head mb-md">ประกาศที่ส่งแล้ว</h3><div id="news-list">${newsListHTML(n=>(n.targetHouses||[]).includes(house.id))}</div>`;
    icon();
  }
  function newsManage(el) {
    _newsImg='';
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="newspaper"></i> จัดการข่าวสาร</h1><p class="page-sub">ส่งข่าวถึงบ้านที่เลือกหรือทุกบ้าน</p></div></div>
      ${newsForm('guidance')}<h3 class="font-head mb-md">ข่าวที่ส่งแล้ว</h3><div id="news-list">${newsListHTML(()=>true)}</div>`;
    icon();
  }
  function saveNews(scope) {
    const u = Auth.getUser();
    const title=$('news-title').value.trim(), body=$('news-body').value.trim(), exp=$('news-exp').value;
    if(!title||!body){ toast('กรอกหัวข้อและเนื้อหา'); return; }
    if(!exp){ toast('เลือกวันลบอัตโนมัติ'); return; }
    let houses;
    if (scope==='teacher') houses=[u.houseId];
    else if ($('news-all')&&$('news-all').checked) houses=['all'];
    else { houses=[...document.querySelectorAll('.news-h:checked')].map(c=>c.value); if(!houses.length){ toast('เลือกอย่างน้อย 1 บ้าน'); return; } }
    API.upsert('news',{ id:uid('n'), authorId:u.id, title, body, image:_newsImg||'', targetHouses:houses, expireAt:exp, at:new Date().toISOString() });
    _newsImg=''; toast('ส่งข่าวแล้ว');
    if (scope==='teacher') houseNews(document.querySelector('.tab-content.active')); else newsManage(document.querySelector('.tab-content.active'));
  }
  function delNews(id){ API.delete('news',id); const el=document.querySelector('.tab-content.active'); const list=$('news-list'); if(list){ const u=Auth.getUser(); list.innerHTML = u.role==='teacher'?newsListHTML(n=>(n.targetHouses||[]).includes(u.houseId)):newsListHTML(()=>true); icon(); } }

  function history(el) {
    const house = teacherHouse();
    const base = 3.0 + (parseInt(house.id)%5)*0.08;
    const years = ['2566','2567','2568'].map((yr,i)=>{
      const grad = 28 + (parseInt(house.id)+i)%12;
      const port=Math.round(grad*0.35), quota=Math.round(grad*0.28), adm=Math.round(grad*0.22), direct=grad-port-quota-adm;
      return { yr, avg:(base+i*0.05).toFixed(2), grad, port, quota, adm, direct };
    });
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="trending-up"></i> ข้อมูลย้อนหลัง 3 ปี: <span style="color:${house.color}">${esc(house.name)}</span></h1><p class="page-sub">แนวโน้มผลการเรียนและรอบที่สอบติดของรุ่นพี่ (ข้อมูลจำลอง)</p></div></div>
      <div class="grid-3">${years.map(y=>{ const tot=y.grad;
        return `<div class="card elevated" style="border-top:4px solid ${house.color}"><div class="stat-label">ปีการศึกษา ${y.yr}</div><div class="stat-value" style="font-size:1.5rem">GPAX ${y.avg}</div>
        <div class="text-sub text-xs mb-sm">จบ ${y.grad} คน · สอบติดครบ</div>
        <div style="display:flex;height:10px;border-radius:6px;overflow:hidden;margin:8px 0">
          <div style="width:${y.port/tot*100}%;background:#7CADD3"></div><div style="width:${y.quota/tot*100}%;background:#F3C34F"></div><div style="width:${y.adm/tot*100}%;background:#E89BB6"></div><div style="width:${y.direct/tot*100}%;background:#8CB69D"></div></div>
        <div class="text-xs text-sub" style="line-height:1.9"><span style="color:#7CADD3">●</span> พอร์ต ${y.port} · <span style="color:#F3C34F">●</span> โควตา ${y.quota}<br><span style="color:#E89BB6">●</span> แอดมิชชั่น ${y.adm} · <span style="color:#8CB69D">●</span> รับตรง ${y.direct}</div></div>`; }).join('')}</div>`;
    icon();
  }

  // Guidance / admin: TCAS program editor (tcas:manage)
  function tcasEditor(el) {
    const progs = API.getAll('tcasPrograms');
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="graduation-cap"></i> จัดการโครงการ TCAS</h1><p class="page-sub">เพิ่ม/แก้/ลบ คณะและเกณฑ์ขั้นต่ำ (${progs.length} รายการ)</p></div>
      <div class="page-actions"><button class="btn btn-surface btn-md" onclick="API.downloadXML('tcasPrograms')"><i data-lucide="download"></i> ส่งออก XML</button><button class="btn btn-primary btn-md" onclick="GAG.programModal()"><i data-lucide="plus"></i> เพิ่มโครงการ</button></div></div>
      <div class="card elevated"><div class="table-toolbar"><input class="input" id="prog-q" placeholder="ค้นหา..." oninput="GAG._filterProg()" style="max-width:300px"></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>มหาวิทยาลัย</th><th>คณะ/สาขา</th><th>รอบ</th><th>ขั้นต่ำ</th><th>โควตา</th><th></th></tr></thead><tbody id="prog-body">
      ${progs.map(p=>progRow(p)).join('')}</tbody></table></div></div>`;
    icon();
  }
  function progRow(p){ return `<tr data-t="${esc((p.university+' '+p.faculty).toLowerCase())}"><td>${esc(p.university)}</td><td>${esc(p.faculty)}</td><td>${esc(p.round)}</td><td><b>${esc(p.minGPAX)}</b></td><td>${esc(p.quota)}</td>
    <td class="flex gap-sm"><button class="icon-btn" onclick="GAG.programModal('${p.id}')"><i data-lucide="pencil"></i></button><button class="icon-btn text-error" onclick="GAG.delProgram('${p.id}')"><i data-lucide="trash-2"></i></button></td></tr>`; }
  function _filterProg(){ const q=$('prog-q').value.toLowerCase(); document.querySelectorAll('#prog-body tr').forEach(tr=>{ tr.style.display=tr.dataset.t.includes(q)?'':'none'; }); }
  function programModal(id) {
    const p = id?API.getById('tcasPrograms',id):{ id:'', university:'', faculty:'', round:'3', minGPAX:'3.00', quota:'100' };
    modal(`<div class="modal-header"><h3 class="modal-title font-head">${id?'แก้ไข':'เพิ่ม'}โครงการ TCAS</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">มหาวิทยาลัย</label><input class="input" id="pg-uni" value="${esc(p.university)}"></div>
        <div class="form-group"><label class="form-label">คณะ/สาขา</label><input class="input" id="pg-fac" value="${esc(p.faculty)}"></div>
        <div class="grid-2"><div class="form-group"><label class="form-label">รอบ</label><select class="select" id="pg-round">${[1,2,3,4].map(r=>`<option ${String(r)===p.round?'selected':''}>${r}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">GPAX ขั้นต่ำ</label><input class="input" id="pg-min" type="number" step="0.01" min="0" max="4" value="${esc(p.minGPAX)}"></div></div>
        <div class="form-group"><label class="form-label">โควตา</label><input class="input" id="pg-quota" type="number" value="${esc(p.quota)}"></div>
      </div><div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.saveProgram('${id||''}')">บันทึก</button></div>`);
  }
  function saveProgram(id) {
    const uni=$('pg-uni').value.trim(), fac=$('pg-fac').value.trim();
    if(!uni||!fac){ toast('กรอกมหาวิทยาลัยและคณะ'); return; }
    API.upsert('tcasPrograms',{ id:id||uid('p'), university:uni, faculty:fac, round:$('pg-round').value, minGPAX:parseFloat($('pg-min').value).toFixed(2), quota:$('pg-quota').value });
    closeModal(); tcasEditor(document.querySelector('.tab-content.active')); toast('บันทึกแล้ว');
  }
  function delProgram(id){ if(confirm('ลบโครงการนี้?')){ API.delete('tcasPrograms',id); tcasEditor(document.querySelector('.tab-content.active')); } }

  function analytics(el) {
    const houses = API.getAll('houses');
    const studs = API.getAll('students');
    const school = studs.length ? studs.reduce((s,st)=>s+API.calcGPAX(st.id),0)/studs.length : 0;
    const perHouse = houses.map(h=>{ const list=studsByHouse(h.id); const avg=list.length?list.reduce((s,x)=>s+API.calcGPAX(x),0)/list.length:0; return { h, n:list.length, avg }; });
    const maxAvg = 4;
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="bar-chart-3"></i> รายงานทั้งโรงเรียน</h1></div></div>
      <div class="stats-grid mb-lg">
        <div class="stat-card"><div class="stat-icon teal"><i data-lucide="users"></i></div><div><div class="stat-label">นักเรียนทั้งหมด</div><div class="stat-value">${studs.length}</div></div></div>
        <div class="stat-card"><div class="stat-icon coral"><i data-lucide="trending-up"></i></div><div><div class="stat-label">GPAX เฉลี่ยโรงเรียน</div><div class="stat-value">${school.toFixed(2)}</div></div></div>
        <div class="stat-card"><div class="stat-icon yellow"><i data-lucide="home"></i></div><div><div class="stat-label">จำนวนบ้าน</div><div class="stat-value">${houses.length}</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><i data-lucide="target"></i></div><div><div class="stat-label">คณะใน TCAS</div><div class="stat-value">${API.getAll('tcasPrograms').length}</div></div></div>
      </div>
      <div class="card elevated"><div class="card-head"><h3 class="card-title font-head">GPAX เฉลี่ยรายบ้าน</h3></div>
        ${perHouse.map(x=>`<div style="margin-bottom:10px"><div class="flex justify-between text-sm"><span>${esc(x.h.name)} (${x.n})</span><b>${x.avg.toFixed(2)}</b></div><div class="progress-wrap"><div class="progress-bar" style="width:${x.avg/maxAvg*100}%;background:${x.h.color}"></div></div></div>`).join('')}</div>`;
    icon();
  }
  function studsByHouse(hid){ return [...new Set(API.filter('studentHouses',l=>l.houseId===String(hid)).map(l=>l.studentId))]; }

  // Admin: users
  function usersAdmin(el) {
    const users = API.getAll('users');
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="users"></i> จัดการผู้ใช้</h1><p class="page-sub">${users.length} บัญชี</p></div>
      <div class="page-actions"><button class="btn btn-surface btn-md" onclick="API.downloadXML('users')"><i data-lucide="download"></i> ส่งออก XML</button><button class="btn btn-primary btn-md" onclick="GAG.userModal()"><i data-lucide="user-plus"></i> เพิ่มผู้ใช้</button></div></div>
      <div class="card elevated"><div class="table-toolbar"><input class="input" id="u-q" placeholder="ค้นหา..." oninput="GAG._filterUsers()" style="max-width:300px"></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อ-นามสกุล</th><th>บทบาท</th><th>บ้าน</th><th>สถานะ</th><th></th></tr></thead><tbody id="u-body">
      ${users.map(u=>userRow(u)).join('')}</tbody></table></div></div>`;
    icon();
  }
  function userRow(u){ const h=u.houseId?API.houseById(u.houseId):null; const active=String(u.active)!=='false';
    return `<tr data-t="${esc((u.username+' '+u.displayName).toLowerCase())}"><td class="font-bold">${esc(u.username)}</td><td>${esc(u.displayName)}</td>
    <td><span class="chip chip-neutral text-xs">${esc(Auth.getRoleLabel(u.role))}</span></td><td>${h?esc(h.name):'—'}</td>
    <td><span class="chip ${active?'chip-success':'chip-error'}">${active?'ใช้งาน':'ปิด'}</span></td>
    <td class="flex gap-sm"><button class="icon-btn" onclick="GAG.toggleUser('${u.id}')" title="สลับสถานะ"><i data-lucide="power"></i></button><button class="icon-btn text-error" onclick="GAG.delUser('${u.id}')"><i data-lucide="trash-2"></i></button></td></tr>`; }
  function _filterUsers(){ const q=$('u-q').value.toLowerCase(); document.querySelectorAll('#u-body tr').forEach(tr=>{ tr.style.display=tr.dataset.t.includes(q)?'':'none'; }); }
  function userModal() {
    modal(`<div class="modal-header"><h3 class="modal-title font-head">เพิ่มผู้ใช้</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">ชื่อผู้ใช้</label><input class="input" id="nu-user"></div>
        <div class="form-group"><label class="form-label">ชื่อ-นามสกุล</label><input class="input" id="nu-name"></div>
        <div class="grid-2"><div class="form-group"><label class="form-label">บทบาท</label><select class="select" id="nu-role" onchange="GAG._nuHouse()"><option value="student">นักเรียน</option><option value="teacher">ครูบ้าน</option><option value="guidance">ครูแนะแนว</option><option value="admin">ผู้ดูแลระบบ</option></select></div>
        <div class="form-group" id="nu-house-wrap"><label class="form-label">บ้าน</label><select class="select" id="nu-house">${API.getAll('houses').map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></div></div>
        <div class="form-group"><label class="form-label">รหัสผ่าน</label><input class="input" id="nu-pass" value="1234"></div>
      </div><div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.saveUser()">บันทึก</button></div>`);
  }
  function _nuHouse(){ const r=$('nu-role').value; $('nu-house-wrap').style.display=(r==='guidance'||r==='admin')?'none':''; }
  function saveUser() {
    const user=$('nu-user').value.trim(), name=$('nu-name').value.trim(), role=$('nu-role').value;
    if(!user||!name){ toast('กรอกให้ครบ'); return; }
    if (API.filter('users',x=>x.username===user).length){ toast('ชื่อผู้ใช้ซ้ำ'); return; }
    const id = uid(role[0]);
    const house = (role==='guidance'||role==='admin')?'':$('nu-house').value;
    const perms = role==='teacher'?['house:manage']:role==='guidance'?['guidance:manage','tcas:manage','analytics:view']:role==='admin'?['house:manage','guidance:manage','tcas:manage','users:manage','system:manage','analytics:view']:[];
    API.upsert('users',{ id, username:user, role, displayName:name, email:user+'@school.ac.th', active:'true', houseId:house, studentId:role==='student'?id:'', permissions:perms });
    if (role==='student'){ API.upsert('students',{ id, displayName:name, plan:'วิทย์-คณิต', level:'ม.4', prevGPAX:'3.00', prevCredits:'0', houseId:house }); API.upsert('studentHouses',{ id:uid('sh'), studentId:id, houseId:house }); }
    closeModal(); usersAdmin(document.querySelector('.tab-content.active')); toast('เพิ่มผู้ใช้แล้ว (รหัสผ่านตั้งต้น 1234)');
  }
  function toggleUser(id){ const u=API.userById(id); if(u){ u.active=String(u.active)==='false'?'true':'false'; API.upsert('users',u); usersAdmin(document.querySelector('.tab-content.active')); } }
  function delUser(id){ const me=Auth.getUser(); if(id===me.id){ toast('ลบบัญชีตัวเองไม่ได้'); return; } if(confirm('ลบผู้ใช้นี้?')){ API.delete('users',id); usersAdmin(document.querySelector('.tab-content.active')); } }

  // Admin: CSV import
  const IMPORT_TYPES = { users:'ผู้ใช้', students:'นักเรียน', houses:'บ้าน', tcasPrograms:'โครงการ TCAS', grades:'เกรด' };
  function importCsv(el) {
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="upload"></i> นำเข้าข้อมูล CSV</h1><p class="page-sub">อัปโหลด CSV → แปลงเป็น XML → เก็บลงระบบ (แถวแรกเป็นชื่อคอลัมน์, มีคอลัมน์ id, ค่าหลายค่าคั่นด้วย |)</p></div></div>
      <div class="card elevated mb-lg" style="max-width:720px;border-top:4px solid var(--coral)">
        <h3 class="font-head mb-sm"><i data-lucide="file-spreadsheet"></i> ตัวอย่างไฟล์ CSV สำหรับนำเข้า (Sample CSV Templates)</h3>
        <p class="text-sub text-sm mb-md">ดาวน์โหลดไฟล์ตัวอย่าง (รองรับภาษาไทย UTF-8) เพื่อดูโครงสร้างคอลัมน์และข้อมูลตัวอย่างก่อนทำการอัปโหลดเข้าสู่ระบบ</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn btn-surface btn-sm" onclick="API.downloadSampleCSV('curriculum')"><i data-lucide="book"></i> ตัวอย่าง CSV รายวิชา/แผน</button>
          <button class="btn btn-surface btn-sm" onclick="API.downloadSampleCSV('users')"><i data-lucide="users"></i> ตัวอย่าง CSV ผู้ใช้งาน</button>
          <button class="btn btn-surface btn-sm" onclick="API.downloadSampleCSV('students')"><i data-lucide="user"></i> ตัวอย่าง CSV นักเรียน</button>
          <button class="btn btn-surface btn-sm" onclick="API.downloadSampleCSV('houses')"><i data-lucide="home"></i> ตัวอย่าง CSV บ้าน</button>
          <button class="btn btn-surface btn-sm" onclick="API.downloadSampleCSV('tcasPrograms')"><i data-lucide="target"></i> ตัวอย่าง CSV TCAS</button>
          <button class="btn btn-surface btn-sm" onclick="API.downloadSampleCSV('grades')"><i data-lucide="bar-chart-2"></i> ตัวอย่าง CSV เกรด</button>
        </div>
      </div>
      <div class="card elevated" style="max-width:720px">
        <div class="form-group"><label class="form-label">ชนิดข้อมูล</label><select class="select" id="imp-type">${Object.entries(IMPORT_TYPES).map(([k,v])=>`<option value="${k}">${v} (${k})</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">ไฟล์ CSV</label><input type="file" class="input" id="imp-file" accept=".csv,text/csv"></div>
        <div class="form-group"><label class="form-label">หรือวางข้อความ CSV</label><textarea class="input" id="imp-text" rows="6" placeholder="id,university,faculty,round,minGPAX,quota&#10;p900,จุฬาฯ,คณะทดสอบ,3,3.50,100"></textarea></div>
        <button class="btn btn-primary" onclick="GAG.doImport()"><i data-lucide="upload"></i> นำเข้า</button>
        <div id="imp-result" style="margin-top:14px"></div>
      </div>`;
    $('imp-file').addEventListener('change', e => { const f=e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=ev=>{ $('imp-text').value=ev.target.result; }; rd.readAsText(f,'utf-8'); });
    icon();
  }
  function doImport() {
    const type=$('imp-type').value; const text=$('imp-text').value.trim();
    const box=$('imp-result');
    if(!text){ box.innerHTML='<div class="chip chip-error">ไม่มีข้อมูล</div>'; return; }
    const { headers, records } = XMLUtils.parseCSV(text);
    if(!headers.includes('id')){ box.innerHTML='<div class="chip chip-error">ต้องมีคอลัมน์ id</div>'; return; }
    const ids=new Set(); for(const r of records){ if(!r.id){ box.innerHTML='<div class="chip chip-error">มีแถว id ว่าง</div>'; return; } if(ids.has(r.id)){ box.innerHTML='<div class="chip chip-error">id ซ้ำ: '+r.id+'</div>'; return; } ids.add(r.id); }
    // expand pipe-lists per schema
    const s=SCHEMAS[type];
    records.forEach(r=>{ if(s&&s.lists) Object.keys(s.lists).forEach(f=>{ if(typeof r[f]==='string') r[f]=r[f].split('|').map(x=>x.trim()).filter(Boolean); }); });
    API.importRecords(type, records);
    box.innerHTML=`<div class="chip chip-success">นำเข้าสำเร็จ ${records.length} รายการ → ${type}.xml</div>`;
    toast('นำเข้า '+records.length+' รายการ');
  }

  // ── Admin: Curriculum & Learning Plans Management ("ผู้ดูแลระบบ สามารถอัพโหลด เปลี่ยนแก้ไขรายวิชา แต่ละแผนการเรียน") ──
  let _activeCurrPlan = '';
  let _activeCurrTerm = 'ม.4 เทอม 1';
  function curriculumAdmin(el) {
    const plans = API.getPlans();
    if (!_activeCurrPlan || !plans.includes(_activeCurrPlan)) {
      _activeCurrPlan = plans[0] || 'วิทย์-คณิต';
    }
    const terms = ['ม.4 เทอม 1', 'ม.4 เทอม 2', 'ม.5 เทอม 1', 'ม.5 เทอม 2', 'ม.6 เทอม 1', 'ม.6 เทอม 2'];
    const curr = API.getCurriculum();
    const planSubjects = (curr[_activeCurrPlan] && curr[_activeCurrPlan][_activeCurrTerm]) ? curr[_activeCurrPlan][_activeCurrTerm] : [];

    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="book"></i> จัดการรายวิชาและแผนการเรียน</h1><p class="page-sub">เพิ่ม/แก้ไข/ลบ รายวิชาในแต่ละแผนการเรียนและระดับชั้น พร้อมรองรับการอัปโหลด CSV และส่งออก XML</p></div>
      <div class="page-actions">
        <button class="btn btn-surface btn-md" onclick="API.downloadSampleCSV('curriculum')"><i data-lucide="download"></i> ตัวอย่าง CSV</button>
        <button class="btn btn-surface btn-md" onclick="GAG.importCurriculumCSVModal()"><i data-lucide="upload"></i> นำเข้า CSV รายวิชา</button>
        <button class="btn btn-secondary btn-md" onclick="API.exportCurriculumXML()"><i data-lucide="file-code"></i> ส่งออก XML</button>
      </div></div>
      
      <!-- Learning Plan Selector -->
      <div class="card elevated mb-lg" style="border-top:4px solid var(--coral)">
        <div class="flex justify-between items-center mb-sm" style="flex-wrap:wrap;gap:10px">
          <h3 class="font-head"><i data-lucide="layout-grid"></i> แผนการเรียนทั้งหมด (${plans.length} แผน)</h3>
          <div class="flex gap-sm">
            <button class="btn btn-primary btn-sm" onclick="GAG.addLearningPlanModal()"><i data-lucide="plus"></i> เพิ่มแผนการเรียน</button>
            <button class="btn btn-surface btn-sm" onclick="GAG.editLearningPlanModal('${_activeCurrPlan}')"><i data-lucide="pencil"></i> แก้ไขชื่อแผน</button>
            <button class="btn btn-surface text-error btn-sm" onclick="GAG.delLearningPlan('${_activeCurrPlan}')"><i data-lucide="trash-2"></i> ลบแผนนี้</button>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${plans.map(p => `<button class="chip ${p===_activeCurrPlan ? 'chip-coral font-bold' : 'chip-neutral'}" style="cursor:pointer;font-size:14px;padding:8px 16px" onclick="GAG._selectCurrPlan('${p}')">${esc(p)}</button>`).join('')}
        </div>
      </div>

      <!-- Term Selector & Subject Table -->
      <div class="card elevated">
        <div class="flex justify-between items-center mb-md" style="flex-wrap:wrap;gap:10px">
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${terms.map(t => `<button class="chip ${t===_activeCurrTerm ? 'chip-teal font-bold' : 'chip-neutral'}" style="cursor:pointer;padding:6px 14px" onclick="GAG._selectCurrTerm('${t}')">${t}</button>`).join('')}
          </div>
          <button class="btn btn-primary btn-sm" onclick="GAG.addSubjectModal()"><i data-lucide="plus"></i> เพิ่มรายวิชาในเทอมนี้</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>ลำดับ</th><th>ชื่อรายวิชา</th><th>กลุ่มสาระการเรียนรู้</th><th>หน่วยกิต</th><th>จัดการ</th></tr>
            </thead>
            <tbody>
              ${!planSubjects.length ? `<tr><td colspan="5" class="text-center text-sub py-md">ยังไม่มีรายวิชาในเทอมนี้ — คลิก + เพิ่มรายวิชา หรือนำเข้า CSV</td></tr>` : 
                planSubjects.map((sub, idx) => `
                <tr>
                  <td class="text-xs text-sub">${idx+1}</td>
                  <td class="font-bold">${esc(sub.sub)}</td>
                  <td><span class="chip chip-neutral text-xs">${esc(sub.grp)}</span></td>
                  <td><b>${esc(sub.cr)}</b></td>
                  <td class="flex gap-sm">
                    <button class="icon-btn" onclick="GAG.editSubjectModal(${idx})" title="แก้ไขรายวิชา"><i data-lucide="pencil"></i></button>
                    <button class="icon-btn text-error" onclick="GAG.delSubject(${idx})" title="ลบรายวิชา"><i data-lucide="trash-2"></i></button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    icon();
  }
  function _selectCurrPlan(p) { _activeCurrPlan = p; curriculumAdmin(document.querySelector('.tab-content.active')); }
  function _selectCurrTerm(t) { _activeCurrTerm = t; curriculumAdmin(document.querySelector('.tab-content.active')); }

  function addLearningPlanModal() {
    modal(`<div class="modal-header"><h3 class="modal-title font-head">เพิ่มแผนการเรียนใหม่</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">ชื่อแผนการเรียน</label><input class="input" id="new-plan-name" placeholder="เช่น ศิลป์-เกาหลี, วิทย์-นวัตกรรม"></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.saveNewLearningPlan()">บันทึกแผน</button></div>`);
  }
  function saveNewLearningPlan() {
    const name = $('new-plan-name').value.trim();
    if (!name) { toast('กรุณาระบุชื่อแผนการเรียน'); return; }
    const plans = API.getPlans();
    if (plans.includes(name)) { toast('มีแผนการเรียนนี้อยู่แล้ว'); return; }
    plans.push(name);
    API.savePlans(plans);
    _activeCurrPlan = name;
    closeModal();
    curriculumAdmin(document.querySelector('.tab-content.active'));
    toast('เพิ่มแผนการเรียนเรียบร้อย!');
  }
  function editLearningPlanModal(plan) {
    modal(`<div class="modal-header"><h3 class="modal-title font-head">แก้ไขชื่อแผนการเรียน</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">ชื่อแผนการเรียน</label><input class="input" id="edit-plan-name" value="${esc(plan)}"></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.saveEditLearningPlan('${esc(plan)}')">บันทึก</button></div>`);
  }
  function saveEditLearningPlan(oldName) {
    const newName = $('edit-plan-name').value.trim();
    if (!newName) { toast('กรุณาระบุชื่อแผนการเรียน'); return; }
    const plans = API.getPlans();
    const idx = plans.indexOf(oldName);
    if (idx !== -1) plans[idx] = newName;
    API.savePlans(plans);
    const curr = API.getCurriculum();
    if (curr[oldName]) {
      curr[newName] = curr[oldName];
      delete curr[oldName];
      API.saveCurriculum(curr);
    }
    _activeCurrPlan = newName;
    closeModal();
    curriculumAdmin(document.querySelector('.tab-content.active'));
    toast('แก้ไขชื่อแผนเรียบร้อย!');
  }
  function delLearningPlan(plan) {
    const plans = API.getPlans();
    if (plans.length <= 1) { toast('ไม่สามารถลบแผนการเรียนสุดท้ายได้'); return; }
    if (confirm(`คุณต้องการลบแผนการเรียน "${plan}" หรือไม่?`)) {
      const idx = plans.indexOf(plan);
      if (idx !== -1) plans.splice(idx, 1);
      API.savePlans(plans);
      _activeCurrPlan = plans[0];
      curriculumAdmin(document.querySelector('.tab-content.active'));
      toast('ลบแผนการเรียนแล้ว');
    }
  }

  function addSubjectModal() {
    modal(`<div class="modal-header"><h3 class="modal-title font-head">เพิ่มรายวิชาใน ${_activeCurrPlan} (${_activeCurrTerm})</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">ชื่อรายวิชา</label><input class="input" id="curr-sub-name" placeholder="เช่น ฟิสิกส์เพิ่มเติม 1"></div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">กลุ่มสาระการเรียนรู้</label>
            <select class="select" id="curr-sub-grp">
              <option value="คณิตศาสตร์">คณิตศาสตร์</option>
              <option value="วิทยาศาสตร์">วิทยาศาสตร์</option>
              <option value="ภาษาต่างประเทศ">ภาษาต่างประเทศ</option>
              <option value="ภาษาไทย">ภาษาไทย</option>
              <option value="สังคมศึกษาฯ">สังคมศึกษาฯ</option>
              <option value="ศิลปะ/การงาน/สุขศึกษา">ศิลปะ/การงาน/สุขศึกษา</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">หน่วยกิต</label><input class="input" type="number" step="0.5" min="0.5" max="3" value="1.5" id="curr-sub-cr"></div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.saveSubject(-1)">บันทึก</button></div>`);
  }
  function editSubjectModal(idx) {
    const curr = API.getCurriculum();
    const subjects = (curr[_activeCurrPlan] && curr[_activeCurrPlan][_activeCurrTerm]) ? curr[_activeCurrPlan][_activeCurrTerm] : [];
    const sub = subjects[idx] || { sub:'', grp:'คณิตศาสตร์', cr:'1.5' };
    modal(`<div class="modal-header"><h3 class="modal-title font-head">แก้ไขรายวิชา</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">ชื่อรายวิชา</label><input class="input" id="curr-sub-name" value="${esc(sub.sub)}"></div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">กลุ่มสาระการเรียนรู้</label>
            <select class="select" id="curr-sub-grp">
              ${['คณิตศาสตร์','วิทยาศาสตร์','ภาษาต่างประเทศ','ภาษาไทย','สังคมศึกษาฯ','ศิลปะ/การงาน/สุขศึกษา'].map(g=>`<option ${g===sub.grp?'selected':''}>${g}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">หน่วยกิต</label><input class="input" type="number" step="0.5" min="0.5" max="3" value="${esc(sub.cr)}" id="curr-sub-cr"></div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.saveSubject(${idx})">บันทึก</button></div>`);
  }
  function saveSubject(idx) {
    const name = $('curr-sub-name').value.trim();
    const grp  = $('curr-sub-grp').value;
    const cr   = $('curr-sub-cr').value || '1.0';
    if (!name) { toast('กรุณากรอกชื่อรายวิชา'); return; }
    const curr = API.getCurriculum();
    if (!curr[_activeCurrPlan]) curr[_activeCurrPlan] = {};
    if (!curr[_activeCurrPlan][_activeCurrTerm]) curr[_activeCurrPlan][_activeCurrTerm] = [];
    const subjects = curr[_activeCurrPlan][_activeCurrTerm];
    if (idx === -1) {
      subjects.push({ sub:name, grp:grp, cr:String(cr) });
    } else {
      subjects[idx] = { sub:name, grp:grp, cr:String(cr) };
    }
    API.saveCurriculum(curr);
    closeModal();
    curriculumAdmin(document.querySelector('.tab-content.active'));
    toast('บันทึกรายวิชาเรียบร้อย!');
  }
  function delSubject(idx) {
    if (confirm('คุณต้องการลบรายวิชานี้ออกจากแผนหรือไม่?')) {
      const curr = API.getCurriculum();
      if (curr[_activeCurrPlan] && curr[_activeCurrPlan][_activeCurrTerm]) {
        curr[_activeCurrPlan][_activeCurrTerm].splice(idx, 1);
        API.saveCurriculum(curr);
        curriculumAdmin(document.querySelector('.tab-content.active'));
        toast('ลบรายวิชาเรียบร้อย');
      }
    }
  }

  function importCurriculumCSVModal() {
    modal(`<div class="modal-header"><h3 class="modal-title font-head">นำเข้า CSV รายวิชา / แผนการเรียน</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <p class="text-sub text-sm mb-md">รูปแบบคอลัมน์ CSV: <code style="background:var(--surface);padding:2px 6px;border-radius:4px">plan,term,subject,group,credit</code><br>สามารถคลิกปุ่ม <b>ตัวอย่าง CSV</b> เพื่อดาวน์โหลดรูปแบบไฟล์ที่ถูกต้อง</p>
        <div class="form-group"><label class="form-label">เลือกไฟล์ CSV</label><input type="file" class="input" id="imp-curr-file" accept=".csv,text/csv"></div>
        <div class="form-group"><label class="form-label">หรือวางข้อความ CSV</label><textarea class="input" id="imp-curr-text" rows="5" placeholder="plan,term,subject,group,credit&#10;วิทย์-คณิต,ม.4 เทอม 1,คณิตศาสตร์เพิ่มเติม 1,คณิตศาสตร์,1.5"></textarea></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="GAG.closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="GAG.doImportCurriculum()"><i data-lucide="upload"></i> นำเข้าทันที</button></div>`);
    $('imp-curr-file').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = ev => { $('imp-curr-text').value = ev.target.result; };
      rd.readAsText(f, 'utf-8');
    });
  }
  function doImportCurriculum() {
    const text = $('imp-curr-text').value.trim();
    if (!text) { toast('กรุณาระบุข้อมูล CSV'); return; }
    const { headers, records } = XMLUtils.parseCSV(text);
    if (!headers.includes('subject') || !headers.includes('group')) {
      toast('ต้องมีคอลัมน์ subject, group และ credit');
      return;
    }
    const curr = API.getCurriculum();
    const plans = API.getPlans();
    let added = 0;
    records.forEach(r => {
      const plan = r.plan || _activeCurrPlan || 'วิทย์-คณิต';
      const term = r.term || _activeCurrTerm || 'ม.4 เทอม 1';
      if (!plans.includes(plan)) plans.push(plan);
      if (!curr[plan]) curr[plan] = {};
      if (!curr[plan][term]) curr[plan][term] = [];
      curr[plan][term].push({ sub: r.subject, grp: r.group || 'วิทยาศาสตร์', cr: String(r.credit || '1.5') });
      added++;
    });
    API.savePlans(plans);
    API.saveCurriculum(curr);
    closeModal();
    curriculumAdmin(document.querySelector('.tab-content.active'));
    toast(`นำเข้าสำเร็จ ${added} รายวิชา!`);
  }

  // ── XML System Export & Individual Student XML Modal ("ให้เซฟไฟล์ลง XML ข้อมูลรายบุคคล ลง xml") ──
  function saveSystemXML() {
    API.exportCurriculumXML();
    toast('ส่งออกไฟล์ XML โครงสร้างรายวิชาและแผนการเรียนแล้ว!');
  }
  function exportStudentXML(studentId) {
    if (API.exportStudentIndividualXML(studentId)) {
      toast('ส่งออก XML ข้อมูลรายบุคคลเรียบร้อย!');
    } else {
      toast('ไม่พบข้อมูลนักเรียน');
    }
  }
  function exportIndividualXMLModal() {
    const students = API.getAll('students');
    modal(`<div class="modal-header"><h3 class="modal-title font-head"><i data-lucide="file-code-2"></i> ส่งออกข้อมูลรายบุคคลเป็นไฟล์ XML</h3><button class="icon-btn" onclick="GAG.closeModal()"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <p class="text-sub text-sm mb-md">ระบบจะสร้างไฟล์ XML ที่มีข้อมูลโปรไฟล์ ผลการเรียนทุกรายวิชา เป้าหมาย TCAS และคะแนนสอบทั้งหมดของนักเรียนแต่ละคน</p>
        <div class="form-group"><label class="form-label">เลือกนักเรียน</label>
          <select class="select" id="xml-student-select">
            ${students.map(s => `<option value="${s.id}">${esc(s.displayName)} (รหัส ${s.id} · ${s.plan})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer" style="flex-wrap:wrap;gap:8px">
        <button class="btn btn-ghost" onclick="GAG.closeModal()">ปิด</button>
        <button class="btn btn-surface" onclick="API.exportAllStudentsXML(); GAG.closeModal()"><i data-lucide="users"></i> ดาวน์โหลด XML ทุกคน</button>
        <button class="btn btn-primary" onclick="GAG.exportStudentXML($('xml-student-select').value); GAG.closeModal()"><i data-lucide="user-check"></i> ดาวน์โหลดคนนี้</button>
      </div>`);
  }

  function auditLog(el) {
    const logs = API.getAll('auditLogs').slice(0,200);
    el.innerHTML = `<div class="page-header"><div class="page-title-group"><h1 class="page-title"><i data-lucide="scroll-text"></i> บันทึกการทำงาน (Audit Log)</h1><p class="page-sub">${logs.length} รายการล่าสุด</p></div>
      <div class="page-actions"><button class="btn btn-surface btn-md" onclick="API.downloadXML('auditLogs')"><i data-lucide="download"></i> ส่งออก XML</button></div></div>
      <div class="card elevated"><div class="table-wrap"><table class="table"><thead><tr><th>เวลา</th><th>ผู้กระทำ</th><th>การกระทำ</th><th>ข้อมูล</th></tr></thead><tbody>
      ${logs.map(l=>{ const a=API.userById(l.actorId); return `<tr><td class="text-xs">${new Date(l.at).toLocaleString('th-TH')}</td><td>${esc(a?a.displayName:l.actorId)}</td><td><span class="chip chip-neutral text-xs">${esc(l.action)}</span></td><td class="text-sm">${esc(l.entity)} · ${esc(l.entityId||'')}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    icon();
  }

  // ── helpers used by pages ──
  function rerender(fn){ const el=document.querySelector('.tab-content.active'); if(el) fn(el); }
  function go(tab){ const nav=document.querySelector(`.nav-item[data-tab="tab-${tab}"]`); if(nav) nav.click(); }

  // export
  window.GAG = {
    esc, fmtDate, closeModal, toast, newsDetail,
    overview, grades, tcas, newsTab, planner, pretest, practice, seniors, uniNews, mou,
    renderGradeRows, setGrade, delGrade, addGradeModal, addGrade, autoLoadCurriculum,
    _calcTm, _calcClear, prepareCalc, calcRequired,
    addTargetModal, _filterTargets, saveTarget, delTarget,
    addPlan, togPlan, delPlan,
    startSurvey, submitSurvey, startTest, submitTest, checkIn,
    forum, newThread, postThread, openThread, postReply,
    chat, selectPeer, sendChat, studentGradesModal, go,
    teacherOverview, roster, rosterAll, houseNews, newsManage, saveNews, delNews,
    handleNewsImg, _toggleAllHouses, history,
    tcasEditor, programModal, saveProgram, delProgram, _filterProg, analytics,
    usersAdmin, userModal, saveUser, toggleUser, delUser, _filterUsers, _nuHouse,
    curriculumAdmin, _selectCurrPlan, _selectCurrTerm, addLearningPlanModal, saveNewLearningPlan, editLearningPlanModal, saveEditLearningPlan, delLearningPlan, addSubjectModal, editSubjectModal, saveSubject, delSubject, importCurriculumCSVModal, doImportCurriculum,
    saveSystemXML, exportStudentXML, exportIndividualXMLModal,
    importCsv, doImport, auditLog,
    _el:null, _forumEl:null, _chatEl:null
  };
})();
