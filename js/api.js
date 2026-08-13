// ================================================================
// api.js — Unified data layer for Grow A Grade+ (Demo Mode)
// Storage: localStorage (gag_*) with embedded demo seed data.
// Reference datasets (curriculum, pretests, TCAS catalog, alumni,
// MOU, uni-news, survey) live in js/data.js — load that FIRST.
// Production: swap load/save for /api/data/:type (Cloudflare R2).
// ================================================================

// ── Schemas (mirror of Cloudflare Function schemas, for XML export) ──
const SCHEMAS = {
  users:         { root:'users',         item:'user',    id:'id', fields:['id','username','role','displayName','email','active','houseId','studentId'], lists:{permissions:{sep:'|',child:'permission'}} },
  students:      { root:'students',       item:'student', id:'id', fields:['id','displayName','plan','level','prevGPAX','prevCredits','houseId'] },
  houses:        { root:'houses',         item:'house',   id:'id', fields:['id','name','color','desc'], lists:{keywords:{sep:'|',child:'keyword'}} },
  tcasPrograms:  { root:'tcasPrograms',   item:'program', id:'id', fields:['id','university','faculty','round','minGPAX','quota'] },
  grades:        { root:'grades',         item:'grade',   id:'id', fields:['id','studentId','subject','group','credit','grade','level','term'] },
  targets:       { root:'targets',        item:'target',  id:'id', fields:['id','studentId','programId'] },
  news:          { root:'news',           item:'item',    id:'id', fields:['id','authorId','title','body','image','expireAt','at'], lists:{targetHouses:{sep:'|',child:'house'}} },
  pretests:      { root:'pretests',       item:'pretest', id:'id', fields:['id','studentId','houseId','score','status','takenAt'] },
  pretestResults:{ root:'pretestResults', item:'result',  id:'id', fields:['id','studentId','houseId','setKey','score','correct','total','completedAt'] },
  studentHouses: { root:'studentHouses',  item:'link',    id:'id', fields:['id','studentId','houseId'] },
  plans:         { root:'plans',          item:'plan',    id:'id', fields:['id','studentId','title','date','done'] },
  practice:      { root:'practice',       item:'log',     id:'id', fields:['id','studentId','date'] },
  threads:       { root:'threads',        item:'thread',  id:'id', fields:['id','houseId','title','body','authorId','at'] },
  replies:       { root:'replies',        item:'reply',   id:'id', fields:['id','threadId','body','authorId','at'] },
  chatMessages:  { root:'chatMessages',   item:'msg',     id:'id', fields:['id','fromId','toId','body','at'] },
  auditLogs:     { root:'auditLogs',      item:'log',     id:'id', fields:['id','actorId','action','entity','entityId','at'] },
};

// ── Grade point mapping (letters → numeric, for legacy/import) ──── //
const GRADE_POINTS = { 'A+':4.0,'A':4.0,'A-':3.7,'B+':3.3,'B':3.0,'B-':2.7,'C+':2.3,'C':2.0,'C-':1.7,'D+':1.3,'D':1.0,'F':0 };

// Numeric grade (0–4) → display label
function gradeLabel(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  return n.toFixed(1);
}

// ── Build the TCAS catalog (60 faculties) from data.js TCAS_DATA ── //
function buildTcasPrograms() {
  const src = (typeof window !== 'undefined' && window.TCAS_DATA) ? window.TCAS_DATA : [];
  return src.map((t, i) => ({
    id: 'p' + String(i + 1).padStart(3, '0'),
    university: t.uni,
    faculty: t.fac,
    round: String((i % 4) + 1),
    minGPAX: Number(t.min).toFixed(2),
    quota: String(40 + (i * 13) % 180)
  }));
}
function _programIdByUniFac(programs, uni, fac) {
  const p = programs.find(x => x.university === uni && x.faculty === fac);
  return p ? p.id : null;
}

// ── Embedded Demo Seed Data ─────────────────────────────────────── //
function buildSeed() {
  const tcasPrograms = buildTcasPrograms();
  const pid = (uni, fac) => _programIdByUniFac(tcasPrograms, uni, fac);

  const users = [
    { id:'u001', username:'admin',      role:'admin',    displayName:'ผู้ดูแลระบบ (Admin)', email:'admin@school.ac.th', active:'true', houseId:'', studentId:'', permissions:['house:manage','guidance:manage','tcas:manage','users:manage','system:manage','analytics:view'] },
    { id:'g001', username:'guidance01', role:'guidance', displayName:'ครูสมศรี ปัญญาดี (ครูแนะแนว)', email:'g001@school.ac.th', active:'true', houseId:'', studentId:'', permissions:['guidance:manage','tcas:manage','analytics:view'] },
    { id:'s001', username:'student01',  role:'student',  displayName:'สมชาย เรียนดี', email:'s001@school.ac.th', active:'true', houseId:'2', studentId:'s001', permissions:[] },
    { id:'s12345', username:'s12345',   role:'student',  displayName:'นางสาวปณิดา เจริญสุข', email:'s12345@school.ac.th', active:'true', houseId:'1', studentId:'s12345', permissions:[] },
    { id:'s67890', username:'s67890',   role:'student',  displayName:'นางสาวพัชราภรณ์ วิศวการ', email:'s67890@school.ac.th', active:'true', houseId:'3', studentId:'s67890', permissions:[] },
  ];
  const houseNames = {
    1:'บ้านวิทยาศาสตร์สุขภาพ', 2:'บ้านวิศวกรรมศาสตร์', 3:'บ้านธุรกิจ', 4:'บ้านสถาปัตยกรรม',
    5:'บ้านสังคมศาสตร์', 6:'บ้านภาษา', 7:'บ้านศิลปิน', 8:'บ้านนานาชาติ', 9:'บ้านนี้มีรัก'
  };
  const teacherNames = {
    1:'ครูสมหญิง พลอยใส', 2:'ครูวิษณุ เกียรติเกรียง', 3:'ครูธนพล วงศ์พานิช', 4:'ครูสิริมา ศิลป์สง่า',
    5:'ครูประภาส ยุติธรรม', 6:'ครูอลิสา วาจาสิทธิ์', 7:'ครูชาญชัย ศิลปกรรม', 8:'ครูคริส โดโนแวน', 9:'ครูมาลี ใจเอื้อ'
  };
  for (let h = 1; h <= 9; h++) {
    users.push({ id:'t00'+h, username:'teacher0'+h, role:'teacher', displayName:teacherNames[h]+' ('+houseNames[h]+')', email:'t00'+h+'@school.ac.th', active:'true', houseId:String(h), studentId:'', permissions:['house:manage'] });
  }

  // ── Mock students (6 per house = 54) + 3 featured ──
  const femaleFirst = ['กมลชนก','กนกวรรณ','จิราภรณ์','ชลธิดา','ณัฐชยา','ธัญพิชชา','นลินี','เบญจวรรณ','ปรียานุช','มยุรา','ลลิตา','ศศิธร','สุทธิดา','อรพินท์','ไพลิน','สุดารัตน์','อัญชลี','วิภาดา','พัชราภรณ์','สิรินทรา','ศิริลักษณ์','วรรณวิสา','สิริพร','ปวีณา','รุ่งนภา','ขวัญฤดี','พัชรินทร์','นภัสสร','เพ็ญศรี','จันทิมา','ศิริวรรณ','วนิดา','สุภาพร','รัตนาพร','กมลวรรณ','นารีรัตน์','อารียา','สุทธาสินี','ณิชชา','พิมพ์พิมล','พัชริดา','รุ่งทิพย์','จิรนันท์','ปิยธิดา','ชลลดา','พรทิพย์','พิมลวรรณ','สุพัตรา','อัจฉรา','ทิพวรรณ','วรรณภา','จุฑารัตน์','สุจิรา','ธนัญญา'];
  const femaleLast  = ['ใจดี','สว่างวงศ์','รุ่งเรือง','วิริยะ','มานะ','สมบูรณ์','พิทักษ์','ทรัพย์สิริ','โชติช่วง','แสนดี','ก้าวหน้า','สุขใจ','ยิ้มแย้ม','มีสุข','ชูชีพ','พรหมมินทร์','วงศ์สุวรรณ','อุดมทรัพย์','พงษ์สวัสดิ์','กิจขยัน','ค้าดี','เจริญผล','แก้วมณี','ศรีสุวรรณ','ทองดี','ประสิทธิ์','รักษาดี','ดีเลิศ'];
  const planPool = ['วิทย์-คณิต','ศิลป์-คำนวณ','ศิลป์-ฝรั่งเศส','วิทย์-เอไอ','ศิลป์-คหกรรม'];

  const students = [
    { id:'s001',   displayName:'สมชาย เรียนดี',            plan:'วิทย์-คณิต', level:'ม.6', prevGPAX:'3.75', prevCredits:'40', houseId:'2' },
    { id:'s12345', displayName:'นางสาวปณิดา เจริญสุข',      plan:'วิทย์-คณิต', level:'ม.6', prevGPAX:'3.92', prevCredits:'40', houseId:'1' },
    { id:'s67890', displayName:'นางสาวพัชราภรณ์ วิศวการ',    plan:'ศิลป์-คำนวณ',level:'ม.6', prevGPAX:'3.40', prevCredits:'40', houseId:'3' },
  ];
  const studentHouses = [
    { id:'sh1', studentId:'s12345', houseId:'1' }, { id:'sh2', studentId:'s12345', houseId:'2' },
    { id:'sh3', studentId:'s001',   houseId:'2' }, { id:'sh4', studentId:'s67890', houseId:'3' },
  ];
  let shN = 5;
  for (let h = 1; h <= 9; h++) {
    for (let i = 1; i <= 6; i++) {
      const idx = (h - 1) * 6 + (i - 1);
      const id = 's30' + h + i;
      const name = 'นางสาว' + femaleFirst[idx % femaleFirst.length] + ' ' + femaleLast[idx % femaleLast.length];
      const level = i <= 2 ? 'ม.4' : (i <= 4 ? 'ม.5' : 'ม.6');
      users.push({ id, username:id, role:'student', displayName:name, email:id+'@school.ac.th', active:'true', houseId:String(h), studentId:id, permissions:[] });
      students.push({ id, displayName:name, plan:planPool[(h + i) % planPool.length], level, prevGPAX:(3 + ((idx * 7) % 100) / 100).toFixed(2), prevCredits:String(level==='ม.4'?12:level==='ม.5'?28:40), houseId:String(h) });
      studentHouses.push({ id:'sh'+(shN++), studentId:id, houseId:String(h) });
    }
  }

  const houses = [
    { id:'1', name:'บ้านวิทยาศาสตร์สุขภาพ', color:'#E11D48', desc:'แพทย์ เภสัช พยาบาล ทันตะ สหเวช สัตวแพทย์', keywords:['แพทย์','เภสัช','พยาบาล','ทันต','สหเวช','สัตวแพทย์','จิตวิทยา','การแพทย์','วิทยาศาสตร์การแพทย์'] },
    { id:'2', name:'บ้านวิศวกรรมศาสตร์',    color:'#2563EB', desc:'วิศวกรรม เทคโนโลยีสารสนเทศ', keywords:['วิศวกรรม','คอมพิวเตอร์','สารสนเทศ','เทคโนโลยี','การบิน','ซอฟต์แวร์','ซอฟท์แวร์'] },
    { id:'3', name:'บ้านธุรกิจ',            color:'#D97706', desc:'พาณิชยศาสตร์ บริหารธุรกิจ เศรษฐศาสตร์', keywords:['บัญชี','บริหารธุรกิจ','เศรษฐศาสตร์','การจัดการ','การตลาด','พาณิชย'] },
    { id:'4', name:'บ้านสถาปัตยกรรม',        color:'#EA580C', desc:'สถาปัตยกรรม ออกแบบภายใน ภูมิสถาปัตย์', keywords:['สถาปัตยกรรม','มัณฑนศิลป์','ออกแบบภายใน','ออกแบบผลิตภัณฑ์','ออกแบบแฟชั่น','นิเทศศิลป์'] },
    { id:'5', name:'บ้านสังคมศาสตร์',        color:'#059669', desc:'นิติศาสตร์ สังคมศาสตร์ โบราณคดี', keywords:['นิติศาสตร์','สังคมศาสตร์','สังคมสงเคราะห์','โบราณคดี','รัฐศาสตร์','นโยบาย'] },
    { id:'6', name:'บ้านภาษา',              color:'#7C3AED', desc:'อักษรศาสตร์ มนุษยศาสตร์ ศิลปศาสตร์', keywords:['อักษรศาสตร์','มนุษยศาสตร์','ศิลปศาสตร์','ภาษา','ล่าม','แปล','วรรณกรรม'] },
    { id:'7', name:'บ้านศิลปิน',            color:'#BE185D', desc:'นิเทศศาสตร์ ศิลปกรรมศาสตร์ ดนตรี', keywords:['นิเทศศาสตร์','ศิลปกรรม','ดนตรี','การแสดง','ภาพยนตร์','ดิจิทัลมีเดีย','บรอดแคสติ้ง','ภาพพิมพ์','จิตรกรรม','อนิเมชั่น'] },
    { id:'8', name:'บ้านนานาชาติ',          color:'#0891B2', desc:'หลักสูตรนานาชาติทั้งหมด', keywords:['นานาชาติ','International','B.B.A','IELTS','SAT'] },
    { id:'9', name:'บ้านนี้มีรัก',           color:'#4F46E5', desc:'ส่งเสริมความสนใจ ค้นหาความถนัด', keywords:['การศึกษา','ครุศาสตร์','จิตวิทยา','คหกรรม','การท่องเที่ยว','โรงแรม','ครัวไทย','อาหาร'] }
  ];

  // ── Grades (numeric 0–4) for demo students ──
  const grades = [];
  let grN = 1;
  const addGrade = (studentId, subject, group, credit, grade, level, term) =>
    grades.push({ id:'gr'+String(grN++).padStart(3,'0'), studentId, subject, group, credit:String(credit), grade:String(grade), level, term });
  // s001 — ม.4/ม.5 filled
  addGrade('s001','คณิตศาสตร์ 1','คณิตศาสตร์',1.0,3.5,'ม.4','เทอม 1');
  addGrade('s001','ฟิสิกส์ 2','วิทยาศาสตร์',2.0,4.0,'ม.4','เทอม 1');
  addGrade('s001','เคมี 1.5','วิทยาศาสตร์',1.5,3.0,'ม.4','เทอม 1');
  addGrade('s001','ภาษาอังกฤษ 1','ภาษาต่างประเทศ',1.0,4.0,'ม.4','เทอม 1');
  addGrade('s001','คณิตศาสตร์ 1','คณิตศาสตร์',1.0,4.0,'ม.4','เทอม 2');
  addGrade('s001','ฟิสิกส์ 2','วิทยาศาสตร์',2.0,3.5,'ม.4','เทอม 2');
  addGrade('s001','ชีววิทยา','วิทยาศาสตร์',1.5,4.0,'ม.5','เทอม 1');
  addGrade('s001','ภาษาอังกฤษ 3','ภาษาต่างประเทศ',1.0,3.5,'ม.5','เทอม 1');
  // s12345 — strong
  addGrade('s12345','ชีววิทยาระดับเซลล์','วิทยาศาสตร์',1.5,4.0,'ม.5','เทอม 1');
  addGrade('s12345','เคมีอินทรีย์','วิทยาศาสตร์',1.5,4.0,'ม.5','เทอม 1');
  addGrade('s12345','คณิตศาสตร์การแพทย์','คณิตศาสตร์',1.0,3.5,'ม.5','เทอม 1');
  addGrade('s12345','ภาษาอังกฤษการแพทย์','ภาษาต่างประเทศ',1.0,4.0,'ม.5','เทอม 2');

  // ── Targets (reference the new program ids) ──
  const rawTargets = [
    ['s12345','เทคโนโลยีพระจอมเกล้าธนบุรี','คณะวิศวกรรมศาสตร์ สาขาวิชาวิศวกรรมคอมพิวเตอร์'],
    ['s12345','มหิดล','คณะแพทยศาสตร์ศิริราชพยาบาล'],
    ['s001','เทคโนโลยีพระจอมเกล้าธนบุรี','คณะวิศวกรรมศาสตร์ สาขาวิชาวิศวกรรมคอมพิวเตอร์'],
    ['s001','จุฬาลงกรณ์','คณะวิศวกรรมศาสตร์ สาขาวิศวกรรมไฟฟ้า'],
    ['s67890','ธรรมศาสตร์','คณะพาณิชยศาสตร์และการบัญชี สาขาบริหารธุรกิจบัณฑิต'],
  ];
  const targets = [];
  let tgN = 1;
  rawTargets.forEach(([sid, uni, fac]) => { const p = pid(uni, fac); if (p) targets.push({ id:'tg'+String(tgN++).padStart(3,'0'), studentId:sid, programId:p }); });

  // ── Pretest aggregate status per house ──
  const pretests = [
    { id:'pt001', studentId:'s12345', houseId:'1', score:'88', status:'completed', takenAt:'2025-05-15' },
    { id:'pt002', studentId:'s001',   houseId:'2', score:'72', status:'completed', takenAt:'2025-05-15' },
  ];
  let ptN = 3;
  for (let h = 1; h <= 9; h++) {
    for (let i = 1; i <= 6; i++) {
      const id = 's30' + h + i;
      pretests.push({ id:'pt'+String(ptN++).padStart(3,'0'), studentId:id, houseId:String(h), score:String(40 + (h*i*7) % 55), status:'completed', takenAt:'2025-05-15' });
    }
  }

  // ── News ──
  const today = new Date();
  const plusDays = d => { const x = new Date(today); x.setDate(x.getDate() + d); return x.toISOString().slice(0,10); };
  const news = [
    { id:'n001', authorId:'g001', title:'กำหนดการรับสมัคร TCAS อย่างเป็นทางการ', body:'ระบบ MYTCAS เปิดให้ยืนยันตัวตนแล้ว นักเรียนชั้น ม.6 เข้าเช็คกำหนดการรอบ Portfolio, Quota, Admission และ Direct Admission ได้ที่เว็บไซต์หลัก พร้อมดาวน์โหลดคู่มือการยื่นพอร์ต', image:'', targetHouses:['all'], expireAt:plusDays(120), at:plusDays(-2) },
    { id:'n002', authorId:'t001', title:'เสวนา "เส้นทางสู่หมอ" คณะแพทยศาสตร์', body:'บ้านวิทยาศาสตร์สุขภาพขอเชิญนักเรียนและผู้ปกครองเข้าร่วมเสวนา พบรุ่นพี่จากแพทย์ศิริราชและจุฬาฯ วันเสาร์ที่ 18 เวลา 09.00-12.00 น.', image:'', targetHouses:['1'], expireAt:plusDays(60), at:plusDays(-4) },
    { id:'n003', authorId:'t002', title:'เวิร์กชอป AI Engineering & Robotics', body:'บ้านวิศวกรรมศาสตร์จัดกิจกรรมเสริมทักษะการเขียนโค้ด Python และ IoT รุ่นที่ 3 ผู้ที่ประสงค์นำผลงานใส่ Portfolio ให้ลงทะเบียนภายในวันศุกร์นี้', image:'', targetHouses:['2'], expireAt:plusDays(30), at:plusDays(-5) },
    { id:'n004', authorId:'t003', title:'การแข่งขันแผนธุรกิจ BBA Challenge', body:'เชิญชวนน้องๆ บ้านธุรกิจรวมทีม 3-5 คน ส่งข้อเสนอโครงการนวัตกรรมธุรกิจระดับเยาวชน อบรมทักษะ Pitching พร้อมพี่เลี้ยงจากคณะพาณิชยศาสตร์ฯ', image:'', targetHouses:['3'], expireAt:plusDays(25), at:plusDays(-6) },
  ];

  // ── Forum threads + replies ──
  const threads = [
    { id:'th001', houseId:'2', title:'สงสัยโจทย์ฟิสิกส์เรื่องการเคลื่อนที่แบบโพรเจกไทล์', body:'ถ้าโยนวัตถุขึ้นทำมุม 45 องศา ระยะทางในแนวราบหายังไงครับ อยากได้วิธีคิดแบบละเอียด', authorId:'s001', at:plusDays(-3) },
    { id:'th002', houseId:'1', title:'เตรียมตัวสอบ A-Level ชีววิทยายังไงดี', body:'เหลือเวลาอีก 2 เดือน อยากได้แนวทางอ่านหนังสือกับเทคนิคจำระบบต่างๆ ค่ะ', authorId:'s12345', at:plusDays(-2) },
  ];
  const replies = [
    { id:'rp001', threadId:'th001', body:'ใช้สูตร R = v²sin(2θ)/g ครับ แทน θ=45 จะได้ระยะไกลสุดพอดี', authorId:'t002', at:plusDays(-3) },
  ];

  const auditLogs = [
    { id:'log001', actorId:'u001', action:'import', entity:'users',        entityId:'users.xml',        at:plusDays(-30)+'T09:00:00' },
    { id:'log002', actorId:'g001', action:'import', entity:'tcasPrograms', entityId:'tcasPrograms.xml', at:plusDays(-30)+'T10:30:00' },
  ];

  return {
    users, students, houses, tcasPrograms, grades, targets, news,
    pretests, pretestResults: [], studentHouses, plans: [], practice: [],
    threads, replies, chatMessages: [], auditLogs
  };
}

let SEED = buildSeed();

// ── API Object ────────────────────────────────────────────────── //
const API = {
  load(type) {
    const raw = localStorage.getItem(`gag_${type}`);
    if (raw) { try { return JSON.parse(raw); } catch { /**/ } }
    return SEED[type] ? JSON.parse(JSON.stringify(SEED[type])) : [];
  },
  save(type, data) { localStorage.setItem(`gag_${type}`, JSON.stringify(data)); },
  reset(type)      { localStorage.removeItem(`gag_${type}`); },
  resetAll()       { Object.keys(SEED).forEach(t => API.reset(t)); },

  getAll(type)      { return this.load(type); },
  getById(type, id) { return this.load(type).find(r => r.id === id) || null; },
  filter(type, fn)  { return this.load(type).filter(fn); },

  nextId(type, prefix) {
    const data = this.load(type);
    return (prefix || type.slice(0,2)) + Date.now().toString(36) + Math.floor(Math.random()*1000);
  },

  upsert(type, record) {
    const data = this.load(type);
    const idx  = data.findIndex(r => r.id === record.id);
    if (idx >= 0) data[idx] = record; else data.push(record);
    this.save(type, data);
    this._audit('upsert', type, record.id);
    return record;
  },
  delete(type, id) {
    this.save(type, this.load(type).filter(r => r.id !== id));
    this._audit('delete', type, id);
  },
  importRecords(type, records) {
    this.save(type, records);
    this._audit('import', type, `${type}.xml`);
  },

  toXML(type)       { const s = SCHEMAS[type]; return s ? XMLUtils.buildXML(s, this.load(type)) : ''; },
  downloadXML(type) { XMLUtils.downloadXML(this.toXML(type), `${type}.xml`); },

  // ── Domain helpers ──────────────────────────────────────────── //
  userById(id)   { return this.getById('users', id); },
  houseById(id)  { return this.getById('houses', String(id)); },
  studentById(id){ return this.getById('students', id); },

  /** Houses a student belongs to (multi), fallback to their primary houseId */
  housesOf(studentId) {
    let links = this.filter('studentHouses', h => h.studentId === studentId);
    if (!links.length) {
      const st = this.studentById(studentId);
      if (st && st.houseId) links = [{ houseId: st.houseId }];
    }
    return links.map(l => this.houseById(l.houseId)).filter(Boolean);
  },

  /** GPAX from numeric grades (falls back to prevGPAX) */
  calcGPAX(studentId) {
    const grades = this.filter('grades', g => g.studentId === studentId);
    let tc = 0, tp = 0;
    grades.forEach(g => {
      const cr = parseFloat(g.credit) || 0;
      let gp = parseFloat(g.grade);
      if (isNaN(gp)) gp = GRADE_POINTS[g.grade] ?? 0;
      tc += cr; tp += gp * cr;
    });
    if (tc > 0) return Math.round((tp / tc) * 100) / 100;
    const st = this.studentById(studentId);
    return st ? (parseFloat(st.prevGPAX) || 0) : 0;
  },

  /** GPA for one subject group */
  calcGroupGPA(studentId, group) {
    const gs = this.filter('grades', g => g.studentId === studentId && g.group === group);
    if (!gs.length) return null;
    let tc = 0, tp = 0;
    gs.forEach(g => { const cr = parseFloat(g.credit)||0; let gp = parseFloat(g.grade); if (isNaN(gp)) gp = GRADE_POINTS[g.grade] ?? 0; tc += cr; tp += gp*cr; });
    return tc > 0 ? tp / tc : null;
  },

  /** Highest minGPAX among a student's target programs (default 3.0) */
  targetMinGPAX(studentId) {
    let max = 0;
    this.filter('targets', t => t.studentId === studentId).forEach(t => {
      const p = this.getById('tcasPrograms', t.programId);
      if (p && parseFloat(p.minGPAX) > max) max = parseFloat(p.minGPAX);
    });
    return max || 3.0;
  },

  /** Pretest aggregate rows for a student */
  pretestsOf(studentId) { return this.filter('pretests', p => p.studentId === studentId); },

  /** Practice recommendation from a pretest score */
  getPracRec(score) {
    const s = parseFloat(score) || 0;
    if (s <= 35) return { days:'5-7', lvl:'เข้มข้น', color:'#FF6B6B' };
    if (s <= 75) return { days:'3-5', lvl:'ปานกลาง', color:'#FFB020' };
    return { days:'2', lvl:'รักษาระดับ', color:'#22C55E' };
  },

  /** Traffic-light status for GPAX vs a minimum */
  statusColor(gpax, minGPAX) {
    const diff = parseFloat(gpax) - parseFloat(minGPAX);
    if (diff >= 0.25) return 'green';
    if (diff >= 0)    return 'yellow';
    return 'red';
  },
  tcasStatus(gpax, minGPAX) { return this.statusColor(gpax, minGPAX); },

  /** House teacher user for a house id (for chat routing) */
  houseTeacher(houseId) {
    return this.filter('users', u => u.role === 'teacher' && u.houseId === String(houseId))[0] || null;
  },

  _audit(action, entity, entityId) {
    const user = (typeof Auth !== 'undefined') ? Auth.getUser() : null;
    const logs = this.load('auditLogs');
    logs.unshift({ id:'log'+Date.now(), actorId:user?.id||'system', action, entity, entityId, at:new Date().toISOString() });
    this.save('auditLogs', logs.slice(0, 500));
  },

  // ── Curriculum & Learning Plans Storage ──
  getPlans() {
    const saved = localStorage.getItem('gag_plans_list');
    if (saved) {
      try { return JSON.parse(saved); } catch(e){}
    }
    return (typeof window !== 'undefined' && window.PLANS) ? [...window.PLANS] : ['วิทย์-คณิต', 'ศิลป์-คำนวณ', 'ศิลป์-ภาษา', 'วิทย์-เอไอ'];
  },
  savePlans(plans) {
    localStorage.setItem('gag_plans_list', JSON.stringify(plans));
    this._audit('update', 'learningPlans', plans.length + ' plans');
  },
  getCurriculum() {
    const saved = localStorage.getItem('gag_curriculum_data');
    if (saved) {
      try { return JSON.parse(saved); } catch(e){}
    }
    return (typeof window !== 'undefined' && window.CURRICULUM_DATA) ? JSON.parse(JSON.stringify(window.CURRICULUM_DATA)) : {};
  },
  saveCurriculum(data) {
    localStorage.setItem('gag_curriculum_data', JSON.stringify(data));
    this._audit('update', 'curriculumData', 'updated subjects');
  },

  // ── File Download Helper ──
  _downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ── Export XML for Curriculum & Learning Plans ──
  exportCurriculumXML() {
    const plans = this.getPlans();
    const curr = this.getCurriculum();
    const escX = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<schoolCurriculum exportDate="${new Date().toISOString()}">\n`;
    xml += `  <learningPlans>\n`;
    plans.forEach((p, idx) => {
      xml += `    <plan id="plan_${idx+1}" name="${escX(p)}">\n`;
      const terms = curr[p] || {};
      Object.keys(terms).forEach(termName => {
        xml += `      <term name="${escX(termName)}">\n`;
        const subjects = terms[termName] || [];
        subjects.forEach((sub, sIdx) => {
          xml += `        <subject id="sub_${sIdx+1}">\n`;
          xml += `          <name>${escX(sub.sub)}</name>\n`;
          xml += `          <group>${escX(sub.grp)}</group>\n`;
          xml += `          <credit>${escX(sub.cr)}</credit>\n`;
          xml += `        </subject>\n`;
        });
        xml += `      </term>\n`;
      });
      xml += `    </plan>\n`;
    });
    xml += `  </learningPlans>\n</schoolCurriculum>`;
    this._downloadFile('curriculum_data.xml', xml, 'application/xml;charset=utf-8;');
  },

  // ── Export Individual Student XML ("ข้อมูลรายบุคคล ลง xml") ──
  exportStudentIndividualXML(studentId) {
    const st = this.studentById(studentId);
    if (!st) return false;
    const user = this.filter('users', u => u.id === studentId || u.studentId === studentId)[0] || {};
    const house = this.houseById(st.houseId) || {};
    const gpax = this.calcGPAX(studentId);
    const grades = this.filter('grades', g => g.studentId === studentId);
    const targets = this.filter('targets', t => t.studentId === studentId);
    const pretests = this.filter('pretests', p => p.studentId === studentId);
    const escX = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<studentProfile id="${escX(st.id)}" generatedAt="${new Date().toISOString()}">\n`;
    xml += `  <personalData>\n`;
    xml += `    <id>${escX(st.id)}</id>\n`;
    xml += `    <displayName>${escX(st.displayName)}</displayName>\n`;
    xml += `    <username>${escX(user.username || st.id)}</username>\n`;
    xml += `    <email>${escX(user.email || '')}</email>\n`;
    xml += `    <learningPlan>${escX(st.plan || 'วิทย์-คณิต')}</learningPlan>\n`;
    xml += `    <level>${escX(st.level || 'ม.4')}</level>\n`;
    xml += `    <house id="${escX(st.houseId || '')}">${escX(house.name || '')}</house>\n`;
    xml += `    <gpax>${gpax}</gpax>\n`;
    xml += `  </personalData>\n`;
    xml += `  <academicGrades count="${grades.length}">\n`;
    grades.forEach(g => {
      xml += `    <grade id="${escX(g.id)}">\n`;
      xml += `      <subject>${escX(g.subject)}</subject>\n`;
      xml += `      <group>${escX(g.group)}</group>\n`;
      xml += `      <credit>${escX(g.credit)}</credit>\n`;
      xml += `      <score>${escX(g.grade)}</score>\n`;
      xml += `      <term>${escX(g.term || '')}</term>\n`;
      xml += `      <level>${escX(g.level || '')}</level>\n`;
      xml += `    </grade>\n`;
    });
    xml += `  </academicGrades>\n`;
    xml += `  <tcasTargets count="${targets.length}">\n`;
    targets.forEach(t => {
      const p = this.getById('tcasPrograms', t.programId);
      if (p) {
        xml += `    <target id="${escX(t.id)}">\n`;
        xml += `      <university>${escX(p.university)}</university>\n`;
        xml += `      <faculty>${escX(p.faculty)}</faculty>\n`;
        xml += `      <round>${escX(p.round)}</round>\n`;
        xml += `      <minGPAX>${escX(p.minGPAX)}</minGPAX>\n`;
        xml += `    </target>\n`;
      }
    });
    xml += `  </tcasTargets>\n`;
    xml += `  <pretestScores count="${pretests.length}">\n`;
    pretests.forEach(pt => {
      xml += `    <pretest id="${escX(pt.id)}">\n`;
      xml += `      <score>${escX(pt.score)}</score>\n`;
      xml += `      <status>${escX(pt.status)}</status>\n`;
      xml += `      <takenAt>${escX(pt.takenAt || '')}</takenAt>\n`;
      xml += `    </pretest>\n`;
    });
    xml += `  </pretestScores>\n`;
    xml += `</studentProfile>`;

    this._downloadFile(`student_${st.id}_profile.xml`, xml, 'application/xml;charset=utf-8;');
    this._audit('export', 'studentXML', st.id);
    return true;
  },

  // ── Export All Students XML Bundle ──
  exportAllStudentsXML() {
    const students = this.getAll('students');
    const escX = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<allStudentsProfiles count="${students.length}" generatedAt="${new Date().toISOString()}">\n`;
    students.forEach(st => {
      const house = this.houseById(st.houseId) || {};
      const gpax = this.calcGPAX(st.id);
      const grades = this.filter('grades', g => g.studentId === st.id);
      xml += `  <student id="${escX(st.id)}" displayName="${escX(st.displayName)}" plan="${escX(st.plan)}" level="${escX(st.level)}" house="${escX(house.name)}" gpax="${gpax}" gradeCount="${grades.length}" />\n`;
    });
    xml += `</allStudentsProfiles>`;
    this._downloadFile('all_students_profiles.xml', xml, 'application/xml;charset=utf-8;');
    this._audit('export', 'allStudentsXML', `${students.length} students`);
    return true;
  },

  // ── Download Sample CSV Files for Admin ("หน้า admin ให้มีตัวอย่าง ไฟล์ CSV ด้วย") ──
  downloadSampleCSV(type) {
    const BOM = '\uFEFF'; // UTF-8 BOM so Microsoft Excel reads Thai characters properly
    let filename = `${type}_sample.csv`;
    let content = '';
    if (type === 'curriculum') {
      content = `plan,term,subject,group,credit\nวิทย์-คณิต,ม.4 เทอม 1,คณิตศาสตร์เพิ่มเติม 1,คณิตศาสตร์,1.5\nวิทย์-คณิต,ม.4 เทอม 1,ฟิสิกส์ 1,วิทยาศาสตร์,1.5\nวิทย์-คณิต,ม.4 เทอม 1,เคมี 1,วิทยาศาสตร์,1.5\nศิลป์-คำนวณ,ม.4 เทอม 1,คณิตศาสตร์พื้นฐาน 1,คณิตศาสตร์,1.0\nศิลป์-คำนวณ,ม.4 เทอม 1,ภาษาอังกฤษเพื่อการสื่อสาร 1,ภาษาต่างประเทศ,1.5`;
    } else if (type === 'users') {
      content = `id,username,displayName,role,email,houseId,active\nu001,somchai01,สมชาย เรียนเก่ง,student,somchai@school.ac.th,1,true\nu002,teacher01,ครูสมหญิง ประจำบ้าน,teacher,teacher01@school.ac.th,2,true\nu003,guidance01,ครูสมศรี แนะแนว,guidance,guidance01@school.ac.th,,true`;
    } else if (type === 'students') {
      content = `id,displayName,plan,level,prevGPAX,prevCredits,houseId\ns001,สมชาย เรียนเก่ง,วิทย์-คณิต,ม.4,3.75,0,1\ns002,สมหญิง รักเรียน,ศิลป์-คำนวณ,ม.5,3.50,20,2\ns003,ปณิดา คนขยัน,วิทย์-เอไอ,ม.6,3.85,40,3`;
    } else if (type === 'houses') {
      content = `id,name,color,desc\n1,บ้านวิทยาศาสตร์สุขภาพ,#22C55E,สำหรับผู้ที่สนใจการแพทย์และสุขภาพ\n2,บ้านวิศวกรรมศาสตร์,#2563EB,สำหรับผู้ที่สนใจวิศวะและนวัตกรรม\n3,บ้านธุรกิจ,#D97706,สำหรับผู้ที่สนใจบริหารธุรกิจและการประกอบการ`;
    } else if (type === 'tcasPrograms') {
      content = `id,university,faculty,round,minGPAX,quota\np101,จุฬาลงกรณ์มหาวิทยาลัย,วิศวกรรมศาสตร์ (คอมพิวเตอร์),3,3.50,80\np102,มหาวิทยาลัยมหิดล,แพทยศาสตร์ศิริราชพยาบาล,1,3.80,30\np103,มหาวิทยาลัยเกษตรศาสตร์,บริหารธุรกิจ,3,3.00,120`;
    } else if (type === 'grades') {
      content = `id,studentId,subject,group,credit,grade,level,term\ng101,s001,คณิตศาสตร์เพิ่มเติม 1,คณิตศาสตร์,1.5,4.0,ม.4,ม.4 เทอม 1\ng102,s001,ฟิสิกส์ 1,วิทยาศาสตร์,1.5,3.5,ม.4,ม.4 เทอม 1\ng103,s001,ภาษาอังกฤษพื้นฐาน 1,ภาษาต่างประเทศ,1.0,4.0,ม.4,ม.4 เทอม 1`;
    } else {
      content = `id,name,value\n1,ตัวอย่าง 1,ทดสอบ`;
    }
    this._downloadFile(filename, BOM + content, 'text/csv;charset=utf-8;');
  },

  /** Reseed demo dataset when schema version changes */
  init() {
    const VER = '3.0';
    if (localStorage.getItem('gag_schema_version') !== VER) {
      Object.keys(localStorage).filter(k => k.startsWith('gag_')).forEach(k => localStorage.removeItem(k));
      SEED = buildSeed();
      localStorage.setItem('gag_schema_version', VER);
      console.log('✅ Grow A Grade+ v3: demo dataset initialised (ex features ported)');
    }
  }
};

API.init();

window.API = API;
window.SCHEMAS = SCHEMAS;
window.SEED = SEED;
window.GRADE_POINTS = GRADE_POINTS;
window.gradeLabel = gradeLabel;
