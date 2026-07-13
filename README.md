# LAN Chat Pro v0.2

نسخة React/Vite بواجهة محادثة مناسبة للجوال، وتسجيل دخول Supabase Auth.

## التشغيل المحلي

```bash
npm install
cp .env.example .env
npm run dev
```

أضف إلى `.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

بدون المتغيرات يعمل التطبيق في وضع Demo للمعاينة.

## Supabase

شغّل ملف `supabase/schema.sql` من SQL Editor.

## Vercel

أضف متغيرات البيئة نفسها في Project Settings > Environment Variables، ثم Redeploy.
