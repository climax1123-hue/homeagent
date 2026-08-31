# 운영 환경변수

## Vercel — 브라우저 공개 값

| 이름                            | 값/설명                                    |
| ------------------------------- | ------------------------------------------ |
| `VITE_SUPABASE_URL`             | `https://tbvwtghrpcuhygwqlmyo.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key                   |
| `VITE_APP_URL`                  | Vercel Production HTTPS URL                |

Vercel에 `service_role`, DB 비밀번호, Google secret, refresh token을 등록하지 않는다.

## Supabase Edge Function 비밀값

- `APP_URL`: Vercel Production URL
- `ALLOWED_ORIGINS`: Vercel Production URL과 필요한 Preview URL
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`: `https://tbvwtghrpcuhygwqlmyo.supabase.co/functions/v1/google-calendar-callback`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- 알림용 VAPID 및 cron 비밀값

Google Cloud Console OAuth 클라이언트에는 위 callback URL을 정확히 등록한다.
