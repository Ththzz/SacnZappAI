# 01 — Project Overview

## Objective

เพิ่ม AI Health Chat ภาษาไทยให้ ScanZapp AI เพื่อช่วยผู้ใช้:

- ถามคำถามทั่วไปเกี่ยวกับอาหาร โภชนาการ นิสัยการกิน และการดื่มน้ำ
- อธิบายข้อมูลจากมื้ออาหาร ประวัติการสแกน โปรไฟล์ และเป้าหมายของผู้ใช้
- สรุปแนวโน้มแบบระมัดระวัง โดยไม่ทำหน้าที่วินิจฉัยโรค
- แนบรูปอาหารเพื่อวิเคราะห์และพูดคุยต่อในบริบทเดียวกัน
- เก็บ ค้นหา ตั้งชื่อ ปักหมุด archive และลบบทสนทนาของตนเอง

## Business goal

- เพิ่มประโยชน์จากข้อมูลที่ ScanZapp AI เก็บอยู่แล้ว
- เปลี่ยนผลสแกนอาหารจากข้อมูลครั้งเดียวเป็นคำแนะนำที่เข้าใจง่าย
- เพิ่ม engagement โดยยังคง privacy, medical safety และต้นทุน AI ที่ควบคุมได้
- สร้าง foundation ที่รองรับ provider/model ใหม่โดยไม่ผูก UI กับ vendor

## Primary users

1. ผู้ใช้ทั่วไปที่ต้องการเข้าใจโภชนาการของตน
2. ผู้ใช้ที่มีเป้าหมาย เช่น ลดน้ำหนัก เพิ่มกล้ามเนื้อ หรือดูแลสุขภาพทั่วไป
3. ผู้ดูแลระบบที่ต้องดู aggregate operational metrics โดยไม่มีสิทธิ์อ่านบทสนทนาส่วนตัวโดยปริยาย

## User journey

```text
Authenticated user
  → opens Health Chat
  → sees consent when required
  → starts or selects a conversation
  → types a question or attaches a food image
  → server validates auth, consent, ownership, input, and rate limit
  → context builder selects minimal relevant user data
  → AI service streams a safety-checked response
  → server persists the final messages and usage metadata
  → user can retry, copy, search, archive, pin, or delete
```

## Main capabilities

- Streaming chat with cancel and retry
- Markdown rendering through an allowlisted, sanitized renderer
- Conversation lifecycle and search
- Optional use of user profile, settings, meals, water logs, and scan results
- Consent and context visibility controls
- Food image upload and analysis
- Short-term conversation context and bounded long-term summary
- Medical and food-safety guardrails
- Rate limiting, observability, audit events, and cost controls

## Out of scope for the first production release

- Clinical diagnosis, emergency triage automation, prescriptions, dosage changes, or treatment plans
- Autonomous actions such as modifying meals, goals, settings, or health records without explicit confirmation
- Access to another user's data, including by admin, unless a separate audited support workflow is approved
- Training models with user content
- Open web browsing or retrieval from arbitrary URLs
- Voice chat, wearable integration, multi-user conversations, and clinician portal
- Claims that calorie or nutrient estimates are exact

## High-level architecture

```text
Next.js page and client chat shell
  → same-origin Route Handlers
    → authentication / consent / ownership / rate limit
      → context builder
        → Prisma repositories
      → AI service adapter
        → OpenAI-compatible provider
      → streaming response + persistence
```

## Success criteria

- A signed-in user can create and continue a private conversation
- First useful streamed content normally appears within the target in `09-performance-and-cost.md`
- No endpoint can read or mutate a conversation without ownership validation
- Context is transparent: the UI indicates which categories may be used
- AI distinguishes estimates from facts and follows the escalation rules in `04-ai-behavior.md`
- Refreshing the page preserves completed messages without duplicating partial responses
- Tests cover auth, ownership, consent, injection, streaming interruption, and data isolation
- Production logs do not contain prompts, health details, full model output, secrets, or raw images

## Agent prompt

```text
Build only the capabilities requested for the current implementation phase. Start by
mapping the requested behavior to existing ScanZapp AI pages, APIs, Prisma models, and
authentication helpers. State what already exists, what is missing, and what will remain
out of scope. Preserve current meal scanning, history, profile, water, settings, and
admin behavior. Prefer a thin vertical slice that can be tested end to end.
```

