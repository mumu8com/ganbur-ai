# Ganbur AI

تطبيق مساعد ذكاء اصطناعي عربي مبني بـ Next.js.

## التشغيل
1. انسخ `.env.example` إلى `.env.local`.
2. أضف `OPENAI_API_KEY`.
3. شغّل `npm install` ثم `npm run dev`.

## الأمان
مفتاح OpenAI لا يُرسل إلى المتصفح؛ يتم استخدامه داخل Route على الخادم فقط.
