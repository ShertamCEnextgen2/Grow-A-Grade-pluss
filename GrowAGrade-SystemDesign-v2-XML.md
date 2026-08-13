# Grow A Grade+ — System Design v2 (จัดเก็บด้วย XML · นำเข้าด้วย CSV)

> ปรับจากฉบับเดิม: **เปลี่ยนการจัดเก็บจาก PostgreSQL → ไฟล์ XML ใน object storage**
> เส้นทางข้อมูล: `admin อัปโหลด CSV → ระบบแปลงเป็น XML → เก็บเป็นไฟล์ใน object storage → หน้าเว็บอ่าน XML มาแสดง`
>
> คงไว้: สิทธิ์ครูแนะแนวจัดการ TCAS (ข้อ 1) และ DFD 3 ระดับ (ข้อ 3)
> ไฟล์ประกอบ: `02-DFD-Context.mermaid`, `03-DFD-Level1.mermaid`, `04-DFD-Level2-TCAS.mermaid`, `01-ERD.mermaid` (ใช้เป็น *logical model*), เดโมกดใช้ได้จริง `admin-console-demo.html`

---

## 1. การเปลี่ยนสิทธิ์: ครูแนะแนวจัดการ TCAS (คงเดิม)

เพิ่ม permission `tcas:manage` แยกจาก `system:manage` เพื่อมอบเฉพาะ TCAS ให้ครูแนะแนว โดยไม่เปิดสิทธิ์จัดการผู้ใช้/หลักสูตรทั้งหมด

| Permission | ความหมาย | student | ครูบ้าน | ครูแนะแนว | admin |
|---|---|:--:|:--:|:--:|:--:|
| `house:manage` | จัดการบ้านที่ดูแล (roster บ้าน, ข่าวบ้าน) | – | ✅ | – | ✅ |
| `guidance:manage` | ดู roster ทั้งโรงเรียน, ข่าวแนะแนว | – | – | ✅ | ✅ |
| **`tcas:manage`** | **เพิ่ม/แก้/ลบ ข้อมูลโครงการ TCAS** | – | – | **✅** | ✅ |
| `users:manage` | จัดการผู้ใช้ + reset password | – | – | – | ✅ |
| `system:manage` | จัดการหลักสูตร/บ้าน/ตั้งค่าระบบ | – | – | – | ✅ |
| `analytics:view` | รายงานทั้งโรงเรียน | – | – | ✅ | ✅ |

ครูแนะแนวและ admin ใช้ component `TcasProgramsEditor` ตัวเดียวกัน ตัดสินสิทธิ์ด้วย `can(user,'tcas:manage')` ทุกการแก้ไขบันทึกลง `auditLogs.xml`

---

## 2. การจัดเก็บข้อมูลด้วย XML (แทน PostgreSQL)

### 2.1 หลักการ
- **แต่ละ entity = 1 ไฟล์ XML** เก็บใน object storage (Cloudflare R2)
- ความสัมพันธ์ระหว่าง entity อ้างอิงด้วย **id** ข้ามไฟล์ (แทน foreign key)
- ไฟล์ `01-ERD.mermaid` เดิมยังใช้ได้ในฐานะ **logical data model** — บอกว่ามี entity อะไร สัมพันธ์กันอย่างไร ส่วน *ระดับกายภาพ* คือไฟล์ XML หนึ่งไฟล์ต่อหนึ่ง entity

### 2.2 แบ่งข้อมูลเป็น 2 กลุ่มตามที่มา
| กลุ่ม | ใครเขียน | วิธีเขียน | ตัวอย่างไฟล์ |
|---|---|---|---|
| **ข้อมูลตั้งต้น/อ้างอิง** | admin / ครูแนะแนว | **อัปโหลด CSV → แปลงเป็น XML** | `users.xml`, `students.xml`, `houses.xml`, `tcasPrograms.xml`, `curriculum.xml` |
| **ข้อมูลที่เกิดจากการใช้งาน** | แอป (ผู้ใช้กระทำ) | แอปเขียน XML ผ่าน API | `grades.xml`, `targets.xml`, `pretests.xml`, `studentHouses.xml`, `plans.xml`, `news.xml`, `threads.xml`, `chatMessages.xml`, `auditLogs.xml` |

> จุดสำคัญ: **CSV import ใช้กับกลุ่มแรก** (ข้อมูลที่ admin เตรียมเป็นชุด) ส่วนกลุ่มสองแอปเขียนเองระหว่างใช้งาน แต่ทั้งคู่ *จัดเก็บเป็น XML เหมือนกัน*

### 2.3 ผังไฟล์ใน object storage
```
data/
├── users.xml           # ผู้ใช้ + สิทธิ์ (CSV import)
├── students.xml        # โปรไฟล์นักเรียน (CSV import)
├── houses.xml          # 9 บ้าน (CSV import)
├── tcasPrograms.xml    # โครงการ TCAS (CSV import — ครูแนะแนว)
├── curriculum.xml      # หลักสูตร 7 แผน (CSV import)
├── pretestSets.xml     # ชุดข้อสอบวัดบ้าน (CSV import)
├── grades.xml          # เกรด (แอปเขียน)
├── targets.xml         # คณะเป้าหมาย (แอปเขียน)
├── pretests.xml        # ผลทำ pretest (แอปเขียน)
├── studentHouses.xml   # คะแนนความถนัดต่อบ้าน (แอปเขียน)
├── plans.xml           # แผนส่วนตัว (แอปเขียน)
├── news.xml            # ข่าว (แอปเขียน)
├── threads.xml         # ฟอรัม + reply ซ้อนใน thread (แอปเขียน)
├── chatMessages.xml    # แชท (แอปเขียน)
└── auditLogs.xml       # log การกระทำ admin/ครู (แอปเขียน)
```

### 2.4 โครงสร้าง XML แต่ละไฟล์
รากไฟล์ = ชื่อชุด, item = หนึ่งเรคคอร์ด, `id` เป็น attribute:

| ไฟล์ | root | item | id | ฟิลด์หลัก |
|---|---|---|---|---|
| users.xml | `users` | `user` | id | username, role, displayName, email, active, permissions/permission* |
| students.xml | `students` | `student` | id (=userId) | displayName, plan, prevGPAX, prevCredits |
| grades.xml | `grades` | `grade` | id | studentId, subject, group, credit, grade, level, term |
| tcasPrograms.xml | `tcasPrograms` | `program` | id | university, faculty, round, minGPAX, quota |
| targets.xml | `targets` | `target` | id | studentId, programId |
| houses.xml | `houses` | `house` | id | name, color, keywords/keyword* |
| pretests.xml | `pretests` | `pretest` | id | studentId, houseId, setCode, score, takenAt |
| news.xml | `news` | `item` | id | authorId, targetHouses/house*, body, expireAt |
| threads.xml | `threads` | `thread` | id | authorId, title, body, replies/reply* |
| chatMessages.xml | `chatMessages` | `msg` | id | fromId, toId, body, sentAt |
| auditLogs.xml | `auditLogs` | `log` | id | actorId, action, entity, entityId, at |

*= element ซ้อนหลายค่า (list)

ตัวอย่าง `tcasPrograms.xml` (ครูแนะแนวจัดการ):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<tcasPrograms>
  <program id="p001">
    <university>จุฬาลงกรณ์มหาวิทยาลัย</university>
    <faculty>วิศวกรรมศาสตร์</faculty>
    <round>3</round>
    <minGPAX>3.50</minGPAX>
    <quota>120</quota>
  </program>
</tcasPrograms>
```

ตัวอย่าง `users.xml` (สิทธิ์เก็บเป็น element ซ้อน):
```xml
<users>
  <user id="t01">
    <username>t01</username>
    <role>teacher</role>
    <displayName>ครูแนะแนว สมชาย</displayName>
    <permissions>
      <permission>guidance:manage</permission>
      <permission>tcas:manage</permission>
    </permissions>
  </user>
</users>
```

ตัวอย่าง `houses.xml` (keywords หลายค่า):
```xml
<houses>
  <house id="2">
    <name>บ้านวิศวกรรมศาสตร์</name>
    <color>#7CADD3</color>
    <keywords>
      <keyword>วิศวกรรม</keyword>
      <keyword>คอมพิวเตอร์</keyword>
    </keywords>
  </house>
</houses>
```

### 2.5 กติกาแปลง CSV → XML
| ใน CSV | กลายเป็น XML |
|---|---|
| แถวแรก (header) | ชื่อ element ลูก |
| คอลัมน์ `id` | attribute `id` ของ item |
| แต่ละแถว | หนึ่ง item element |
| ค่าที่คั่นด้วย `\|` (เช่น keywords, permissions) | element ลูกซ้ำหลายตัว |
| อักขระ `& < > "` | escape เป็น entity อัตโนมัติ |

ตัวอย่าง CSV ที่ครูแนะแนวอัปโหลดเข้า `tcasPrograms.xml`:
```csv
id,university,faculty,round,minGPAX,quota
p001,จุฬาลงกรณ์มหาวิทยาลัย,วิศวกรรมศาสตร์,3,3.50,120
p002,มหาวิทยาลัยมหิดล,แพทยศาสตร์,1,3.75,80
```
บันทึก UTF-8 (ภาษาไทย) · comma ในค่าใส่ `"..."` ครอบ · validate: header ครบ, id ไม่ว่าง/ไม่ซ้ำ, ฟิลด์ตัวเลขต้องเป็นตัวเลข (ดูการทำงานจริงในเดโม `admin-console-demo.html`)

### 2.6 ข้อแลกเปลี่ยน (trade-offs ของการใช้ XML)
- ✅ ตรงโจทย์ (เก็บเป็นไฟล์จริง, admin นำเข้าด้วย CSV), setup เบา, ย้ายที่ง่ายเพราะเป็นแค่ไฟล์
- ⚠️ **Query จำกัด** — เหมาะ "อ่านทั้งไฟล์แล้วกรองใน memory" ไม่มี JOIN/index แบบ DB ถ้าข้อมูลโตมากหรือค้นซับซ้อนควรพิจารณา Cloudflare D1
- ⚠️ **เขียนพร้อมกัน** — เขียนทับทั้งไฟล์ (last-write-wins) เหมาะกรณี admin เป็นผู้แก้ข้อมูลอ้างอิง; ไฟล์ที่ผู้ใช้เขียนบ่อย (chat/grades) ควรแยกไฟล์ย่อยหรือ append เพื่อลดชนกัน
- ⚠️ **ขนาด** — โหลดทั้งไฟล์มา parse ที่ client เหมาะ < หลักพันเรคคอร์ด/ไฟล์ เกินนั้นแบ่งไฟล์ (เช่น `grades/{studentId}.xml`)

---

## 3. Data Flow Diagram (คงเดิม — data store คือไฟล์ XML)

โครง DFD ไม่เปลี่ยน เพราะ "data store" ในเชิง DFD เป็นแนวคิด ไม่ผูกกับเทคโนโลยี — เพียงตีความว่าแต่ละ store = ไฟล์ XML

| Store ใน DFD | ไฟล์ XML |
|---|---|
| D1 Users / Permissions | `users.xml` |
| D2 Grades | `grades.xml` |
| D3 Houses / Pretests | `houses.xml`, `pretests.xml`, `studentHouses.xml` |
| D4 TCAS / Targets | `tcasPrograms.xml`, `targets.xml` |
| D5 News / Forum / Chat | `news.xml`, `threads.xml`, `chatMessages.xml` |
| D6 Audit Log | `auditLogs.xml` |

- **Context (`02-DFD-Context.mermaid`)** — ครูแนะแนวมีลูกศร "เพิ่ม/แก้ข้อมูล TCAS" เข้าระบบ
- **Level 1 (`03-DFD-Level1.mermaid`)** — 6 โปรเซสหลัก อ่าน/เขียนไฟล์ XML ตามตารางบน
- **Level 2 (`04-DFD-Level2-TCAS.mermaid`)** — เจาะโปรเซส 4.0: 4.1 ครูแนะแนว CRUD `tcasPrograms.xml` (ผ่าน CSV import) → 4.2 นักเรียนตั้งเป้าเขียน `targets.xml` → 4.3 เทียบ GPAX (อ่าน `grades.xml` + `tcasPrograms.xml`) → 4.4 ออกสถานะไฟ/คำแนะนำ

---

## 4. Deployment บน Cloudflare (Pages + Functions + R2)

```
   Cloudflare Pages ──fetch──► Pages Functions ──PUT/GET .xml──► R2 bucket
   (หน้าเว็บ static)          (/api/import/:type,             (data/*.xml)
                               /api/data/:type)
```

### 4.1 API — `functions/api/[[path]].js`
```js
function parseCSV(text){
  text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
    else{if(c==='"')q=true;else if(c===','){row.push(cur);cur='';}
      else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur='';}else cur+=c;}}
  if(cur!==''||row.length){row.push(cur);rows.push(row);}
  const clean=rows.filter(r=>r.some(v=>v.trim()!==''));
  const headers=clean[0].map(h=>h.trim());
  const records=clean.slice(1).map(r=>{const o={};headers.forEach((h,i)=>o[h]=(r[i]??'').trim());return o;});
  return {headers,records};
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const SCHEMAS={
  users:{root:'users',item:'user',id:'id',fields:['id','username','role','displayName','email'],required:['id','username','role'],list:{permissions:{sep:'|',child:'permission'}}},
  students:{root:'students',item:'student',id:'id',fields:['id','displayName','plan','email'],required:['id','displayName']},
  tcas:{root:'tcasPrograms',item:'program',id:'id',fields:['id','university','faculty','round','minGPAX','quota'],required:['id','university','faculty']},
  houses:{root:'houses',item:'house',id:'id',fields:['id','name','color','keywords'],required:['id','name'],list:{keywords:{sep:'|',child:'keyword'}}}
};

function buildXML(s,records){
  let out=`<?xml version="1.0" encoding="UTF-8"?>\n<${s.root}>\n`;
  for(const rec of records){
    out+=`  <${s.item} ${s.id}="${esc(rec[s.id])}">\n`;
    for(const f of s.fields){ if(f===s.id) continue; const val=rec[f]??'';
      if(s.list&&s.list[f]){const c=s.list[f];out+=`    <${f}>\n`;
        val.split(c.sep).map(v=>v.trim()).filter(Boolean).forEach(v=>out+=`      <${c.child}>${esc(v)}</${c.child}>\n`);
        out+=`    </${f}>\n`;
      } else out+=`    <${f}>${esc(val)}</${f}>\n`;
    }
    out+=`  </${s.item}>\n`;
  }
  return out+`</${s.root}>\n`;
}

export async function onRequest({request,env,params}){
  const [action,type]=params.path||[];
  const s=SCHEMAS[type]; if(!s) return new Response('unknown type',{status:404});

  if(action==='import'&&request.method==='POST'){
    // ตรวจสิทธิ์: import ได้เฉพาะผู้มี tcas:manage / system:manage
    if(request.headers.get('x-admin-token')!==env.ADMIN_TOKEN) return new Response('unauthorized',{status:401});
    const {headers,records}=parseCSV(await request.text());
    const missing=s.required.filter(r=>!headers.includes(r));
    if(missing.length) return json({error:'ขาดคอลัมน์: '+missing.join(', ')},400);
    const ids=new Set();
    for(const r of records){ if(!r[s.id])return json({error:'มีแถว id ว่าง'},400);
      if(ids.has(r[s.id]))return json({error:'id ซ้ำ: '+r[s.id]},400); ids.add(r[s.id]); }
    await env.DATA.put(`data/${s.root}.xml`,buildXML(s,records),{httpMetadata:{contentType:'application/xml'}});
    return json({ok:true,count:records.length,key:`data/${s.root}.xml`});
  }

  if(action==='data'&&request.method==='GET'){
    const obj=await env.DATA.get(`data/${s.root}.xml`);
    if(!obj) return new Response('not found',{status:404});
    return new Response(obj.body,{headers:{'content-type':'application/xml; charset=utf-8'}});
  }
  return new Response('method not allowed',{status:405});
}
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}});
```

### 4.2 `wrangler.toml`
```toml
name = "grow-a-grade"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

[[r2_buckets]]
binding = "DATA"
bucket_name = "grow-a-grade-data"
```

### 4.3 ฝั่ง frontend
```js
// admin/ครูแนะแนว นำเข้า CSV
await fetch('/api/import/tcas',{method:'POST',
  headers:{'content-type':'text/csv','x-admin-token':token}, body:csvString});

// ทุกหน้าอ่าน XML มาแสดง
const xml=await fetch('/api/data/tcas').then(r=>r.text());
const doc=new DOMParser().parseFromString(xml,'application/xml');
const programs=[...doc.getElementsByTagName('program')].map(el=>({
  id:el.getAttribute('id'),
  university:el.querySelector('university')?.textContent,
  minGPAX:parseFloat(el.querySelector('minGPAX')?.textContent||'0')
}));
```

### 4.4 ขั้นตอน deploy
1. `npx wrangler r2 bucket create grow-a-grade-data`
2. วาง `functions/api/[[path]].js`, `wrangler.toml`, และ frontend build ใน `dist/`
3. `npx wrangler pages secret put ADMIN_TOKEN`
4. `npx wrangler pages deploy dist` (หรือเชื่อม Git ใน Pages dashboard)
5. เข้า `*.pages.dev` → หน้า admin อัปโหลด CSV → เขียนเป็น XML ลง R2 → หน้าอื่นอ่านทันที
6. (ทางเลือก) ผูก custom domain — Cloudflare ให้ HTTPS อัตโนมัติ

---

## 5. ลำดับงานที่แนะนำ (ฉบับ XML)
1. สร้าง R2 bucket + วาง Function/wrangler ตามข้อ 4
2. ทำหน้า **Admin Data Console** (ใช้เดโม `admin-console-demo.html` เป็นฐาน) ให้ครบชนิดข้อมูลกลุ่มแรก
3. ทำ `TcasProgramsEditor` ให้ครูแนะแนว/admin ใช้ร่วม (guard `tcas:manage`) — แก้แล้วเรียก `/api/import/tcas`
4. หน้าฝั่งนักเรียน/ครูอ่านผ่าน `/api/data/*` แล้ว parse XML
5. Deploy ขึ้น Cloudflare Pages → ใส่ข้อมูลตั้งต้นด้วย CSV → เชิญผู้ใช้ 3 role ทดสอบ

> ก่อนเปิดใช้จริง: เปลี่ยน `x-admin-token` เป็น auth จริง (Cloudflare Access / JWT), ตรวจสิทธิ์ที่ Function ทุกครั้ง, และแยกไฟล์ที่เขียนบ่อยเพื่อลด last-write-wins
