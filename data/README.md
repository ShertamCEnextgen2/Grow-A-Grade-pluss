# ไฟล์ข้อมูล XML และตัวอย่าง CSV — Grow A Grade+

โฟลเดอร์นี้เก็บ **ไฟล์ข้อมูลจริงในรูปแบบ XML** (หนึ่ง entity = หนึ่งไฟล์) ตามที่ออกแบบไว้ใน
`GrowAGrade-SystemDesign-v2-XML.md` ข้อ 2.3 — ใช้เป็นข้อมูลตั้งต้น (seed) สำหรับอัปโหลดขึ้น
Cloudflare R2 และเป็นรูปแบบเดียวกับที่ Pages Function (`functions/api/[[path]].js`) อ่าน/เขียน

## ไฟล์ XML (ข้อมูลจริง)

| ไฟล์ | เก็บอะไร | ฟิลด์หลัก |
|---|---|---|
| `tcasPrograms.xml` | **โครงการ TCAS** — มหาวิทยาลัย, คณะ, GPAX ขั้นต่ำ | university, faculty, round, **minGPAX**, quota |
| `grades.xml` | **ผลการเรียนรายวิชา** (เกรดเฉลี่ยแต่ละวิชาที่ใช้เทียบเกณฑ์) | studentId, subject, group, credit, **grade**, level, term |
| `students.xml` | **ข้อมูลนักเรียน** (โปรไฟล์) | displayName, plan, level, prevGPAX, prevCredits, houseId |
| `users.xml` | **ผู้ใช้ระบบ** (นักเรียน/ครูบ้าน/ครูแนะแนว/admin) + สิทธิ์ | username, role, displayName, email, houseId |
| `houses.xml` | 9 บ้านสายการเรียน + keywords | name, color, desc, keywords |

> ข้อ 1 ของโจทย์ = `tcasPrograms.xml` (ชื่อมหาวิทยาลัย/คณะ/GPAX ขั้นต่ำ) คู่กับ `grades.xml`
> (ผลเฉลี่ยแต่ละวิชา) · ข้อ 2 = `students.xml` + `users.xml`

## ตัวอย่าง CSV (`samples/`)

ไฟล์ CSV ต้นแบบ (UTF-8 + BOM รองรับภาษาไทยใน Excel) สำหรับให้ Admin กรอกข้อมูลแล้วอัปโหลด:
`users.csv`, `students.csv`, `houses.csv`, `tcasPrograms.csv`, `grades.csv`, `curriculum.csv`

หน้า **Admin → นำเข้า CSV** มีปุ่มดาวน์โหลดตัวอย่างเหล่านี้ในตัว (ปุ่ม “ตัวอย่าง CSV …”)

## เส้นทางข้อมูล (Admin เพิ่มนักเรียน/ครู)

```
Admin กรอก/แก้ไฟล์ CSV  →  อัปโหลดหน้า "นำเข้า CSV"  →  ระบบ parse + ตรวจสอบ (id ไม่ว่าง/ไม่ซ้ำ)
   →  แปลงเป็น XML (โครงสร้างตามตารางบน)  →  จัดเก็บ  →  ทุกหน้าอ่าน XML มาแสดง
```

- โหมด demo: จัดเก็บใน `localStorage` (คีย์ `gag_*`) และดูผลลัพธ์ XML ได้ด้วยปุ่ม “ส่งออก XML”
- โหมดจริง (Cloudflare): `POST /api/import/:type` (CSV→XML→R2) และ `GET /api/data/:type` (อ่าน XML)
  ดูขั้นตอน deploy ใน `GrowAGrade-SystemDesign-v2-XML.md` ข้อ 4

## สร้าง/รีเฟรชไฟล์ XML เหล่านี้ใหม่

ไฟล์ XML ที่นี่ถูกสร้างจากชุดข้อมูล seed ของแอป (`API.toXML(type)`) จึงตรงกับ schema เป๊ะ
สามารถส่งออกชุดเต็มได้จากในแอป: **Admin → ปุ่ม “ให้เซฟไฟล์ลง XML” / “ข้อมูลรายบุคคล ลง xml”**
หรือปุ่ม “ส่งออก XML” ในแต่ละหน้า
