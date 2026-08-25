# AI Lounge → Data Catalog Portal 통합 가이드

## 1. 목적과 최우선 원칙

이 문서는 `frontend_vue`의 AI Lounge 화면을 아래 Nuxt Portal에 통합할 때 필요한 작업과 검증 기준을 정의한다.

- 통합 대상: `frontend_vue`
- 대상 Portal: `future/data_catalog_portal/source/frontend/nuxt-project`
- AI Lounge API: `backend` (Portal 백엔드와 별도 포트로 운영)
- Data Catalog API: `future/data_catalog_server`

통합의 최우선 원칙은 **기존 Portal 기능, 화면, 라우트, 인증, 권한, CSS를 훼손하지 않는 것**이다.

다음 항목은 반드시 지킨다.

1. Portal 기존 파일을 AI Lounge 파일로 통째로 덮어쓰지 않는다.
2. Portal의 `package.json`, `package-lock.json`, `nuxt.config.ts`, `app.vue`, `layouts/**`, `plugins/ofetch.ts`, `store/auth.ts`, `store/user.ts`, `middleware/menu.global.ts`를 복사본으로 교체하지 않는다.
3. Portal 공통 CSS 파일을 AI Lounge 디자인에 맞추기 위해 수정하지 않는다.
4. AI Lounge CSS는 모든 선택자를 AI Lounge 범위 안으로 제한한 후에만 Portal에 등록한다.
5. Portal의 기존 `$ofetch` 기본 URL을 AI Lounge API 주소로 변경하지 않는다.
6. Portal 인증·메뉴 권한 검사를 우회하기 위해 AI Lounge 경로를 무조건 공개 경로나 권한 검사 예외로 등록하지 않는다.
7. 모든 변경은 작은 단위로 적용하고, 각 단계에서 Portal 회귀 테스트를 통과한 후 다음 단계로 진행한다.
8. Portal 회귀가 발견되면 다음 단계로 진행하지 않고 해당 변경을 롤백한다.

---

## 2. 현재 구조 요약

### 2.1 Portal

- Nuxt `3.17.5`
- Vue `^3.4.21`
- Vue Router `^4.3.0`
- Pinia `^2.1.7`
- `ssr: false`
- `pages/**` 기반 Nuxt 파일 라우팅
- `layouts/user.vue`, `layouts/admin.vue` 등 기존 Portal 레이아웃 사용
- `middleware/menu.global.ts`에서 로그인 및 메뉴 권한 검사
- `plugins/ofetch.ts`에서 Data Catalog API 호출, 토큰 갱신, 로더 및 공통 오류 처리
- `runtimeConfig.public.baseURL`은 Data Catalog API 전용
- 전역 CSS는 `nuxt.config.ts`의 `css` 목록에서 관리

### 2.2 AI Lounge

- Vite 기반 Vue SPA
- `src/pages/**` 파일 구조를 `import.meta.glob`으로 라우팅
- 브라우저 `fetch` 기반 `apiFetch()` 사용
- `VITE_API_BASE`로 별도 AI Lounge API 포트 직접 호출
- 독립 `App.vue`, `main.js`, `AppLayout.vue`, `EmbeddedLayout.vue` 보유
- 자체 인증 저장소 및 `/sign-in` 화면 보유
- AI Lounge 전용 CSS 다수 보유

---

## 3. 통합 대상과 복사 금지 대상

### 3.1 통합 대상

다음 코드는 Portal 구조에 맞게 경로와 import를 조정한 후 통합한다.

- `frontend_vue/src/pages/aistudio/**`
- `frontend_vue/src/pages/community/**`
- `frontend_vue/src/pages/connected/**`
- `frontend_vue/src/pages/administration/**`
- `frontend_vue/src/components/**`
- `frontend_vue/src/assets/**`
- `frontend_vue/src/styles/**`
- `frontend_vue/src/utils/**`
- AI Lounge API 호출에 필요한 코드

### 3.2 그대로 복사하지 않는 파일

다음 파일은 독립 Vite 앱용이므로 Portal에 그대로 복사하지 않는다.

- `frontend_vue/src/main.js`
- `frontend_vue/src/App.vue`
- `frontend_vue/src/layouts/AppLayout.vue`
- `frontend_vue/src/layouts/EmbeddedLayout.vue`
- `frontend_vue/vite.config.js`
- `frontend_vue/index.html`
- `frontend_vue/.env.example`
- `frontend_vue/src/pages/sign-in/index.vue`
- `frontend_vue/src/stores/auth.js`

`sign-in`과 자체 인증 저장소는 Portal 인증 체계를 사용하도록 교체한 뒤 제거하는 것이 기본 방침이다.

---

## 4. 권장 디렉터리 배치

Portal의 기존 파일과 이름 충돌을 막기 위해 페이지 외의 모든 AI Lounge 코드는 `ai-lounge` 네임스페이스에 둔다.

```text
nuxt-project/
├── pages/
│   ├── aistudio/
│   ├── community/
│   ├── connected/
│   └── administration/
├── components/
│   └── ai-lounge/
├── composables/
│   └── ai-lounge/
├── plugins/
│   └── ai-lounge-fetch.client.ts
├── assets/
│   └── ai-lounge/
│       ├── images/
│       ├── fonts/
│       └── styles/
└── utils/
    └── ai-lounge/
```

필수 규칙:

- `components/BaseModal.vue`처럼 일반적인 이름을 Portal 최상위 `components`에 바로 넣지 않는다.
- `components/ai-lounge/BaseModal.vue`처럼 별도 디렉터리에 둔다.
- 명시적 import는 `@/components/ai-lounge/BaseModal.vue`처럼 변경한다.
- Portal은 `components: true`이므로 자동 등록되는 컴포넌트 이름도 기존 컴포넌트와 충돌하지 않는지 확인한다.
- 가능하면 컴포넌트 이름도 `AiLoungeBaseModal`, `AiLoungeAssetCard`처럼 고유하게 변경한다.
- 이미지와 폰트를 Portal 기존 `assets` 경로에 같은 이름으로 덮어쓰지 않는다.

---

## 5. 페이지 및 메뉴 매핑

| Portal 메뉴 | URL | AI Lounge 원본 | Portal 대상 |
|---|---|---|---|
| AI STUDIO - 소개 | `/aistudio` | `src/pages/aistudio/index.vue` | `pages/aistudio/index.vue` |
| AI STUDIO - DX 과제 발굴 | `/aistudio/dx-discovery` | `src/pages/aistudio/dx-discovery/index.vue` | `pages/aistudio/dx-discovery/index.vue` |
| AI STUDIO - AI 자산 라이브러리 | `/aistudio/assets` | `src/pages/aistudio/assets/index.vue` | `pages/aistudio/assets/index.vue` |
| AI STUDIO - AI 자산 등록 | `/aistudio/assets/register` | `src/pages/aistudio/assets/register.vue` | `pages/aistudio/assets/register.vue` |
| AX COMMUNITY - AI Tech News | `/community/tech-news` | `src/pages/community/tech-news/index.vue` | `pages/community/tech-news/index.vue` |
| AX COMMUNITY - 나만의 AI 활용법 | `/community/ai-usage` | `src/pages/community/ai-usage/index.vue` | `pages/community/ai-usage/index.vue` |
| AX COMMUNITY - AI 아이디어 공모 | `/community/ideas` | `src/pages/community/ideas/index.vue` | `pages/community/ideas/index.vue` |
| 연계 서비스 - AI Calendar | `/connected/calendar` | `src/pages/connected/calendar/index.vue` | `pages/connected/calendar/index.vue` |
| MANAGEMENT - Idea 심사 | `/administration/ideas` | `src/pages/administration/ideas/index.vue` | `pages/administration/ideas/index.vue` |
| MANAGEMENT - AI 자산 관리 | `/administration/assets` | `src/pages/administration/assets/index.vue` | `pages/administration/assets/index.vue` |
| MANAGEMENT - Tech News 관리 | `/administration/tech-news` | `src/pages/administration/tech-news/index.vue` | `pages/administration/tech-news/index.vue` |

### 5.1 라우트 충돌 확인

통합 전에 Portal의 기존 `pages/**`와 위 경로가 겹치지 않는지 다시 확인한다.

```bash
find pages -type f -name '*.vue' | sort
```

현재 확인된 Portal 최상위 경로와 `aistudio`, `community`, `connected`, `administration`은 겹치지 않는다. 이후 Portal 개발 중 새 경로가 추가될 수 있으므로 실제 통합 시점에 다시 검사한다.

### 5.2 Nuxt 페이지 메타

AI Lounge 페이지에는 Portal에서 식별 가능한 메타를 둔다.

```vue
<script setup lang="ts">
definePageMeta({
  layout: "user",
  aiLounge: true
});
</script>
```

주의사항:

- Portal `layouts/user.vue`는 이미 `route.meta.aiLounge`를 확인할 수 있으므로 경로 문자열을 계속 늘리기보다 메타를 사용한다.
- 기존 코드에 남아 있는 `/studio` 검사는 신규 `/aistudio`와 다르다. 메타 기반 동작을 우선 사용한다.
- MANAGEMENT 페이지가 `user` 레이아웃인지 `admin` 레이아웃인지 운영 정책을 먼저 확정한다.
- 레이아웃 정책이 확정되기 전 Portal 공통 레이아웃 구조를 임의로 변경하지 않는다.
- AI Lounge 페이지 때문에 Portal 전체 `min-width`, header, footer 크기를 변경하지 않는다.
- 필요한 반응형 예외는 `route.meta.aiLounge`일 때만 적용한다.

### 5.3 정적 HTML 별칭

Portal의 `pages:extend` 훅은 라우트에 `/index.html` 별칭을 추가한다. 중첩 깊이가 깊은 `/aistudio/assets/register`까지 별칭이 생성되는지 확인한다.

다음 URL을 모두 직접 새로고침해서 확인한다.

- `/aistudio`
- `/aistudio/index.html`
- `/aistudio/assets/register`
- `/aistudio/assets/register/index.html`

깊은 자식 라우트의 별칭이 누락되면 `pages:extend`의 재귀 처리를 검토하되, 기존 Portal 라우트 별칭 결과가 바뀌지 않는 테스트를 먼저 작성한다.

---

## 6. Portal 메뉴 및 권한 연동

Portal의 `middleware/menu.global.ts`는 로그인 여부뿐 아니라 현재 URL이 사용자의 `roleMenu`에 존재하는지 검사한다.

따라서 페이지 파일만 복사하면 접근 권한 오류가 발생할 수 있다.

필수 작업:

1. Portal 메뉴 데이터에 AI Lounge 상위·하위 메뉴를 등록한다.
2. 각 메뉴의 `menu_path`를 실제 Nuxt URL과 정확히 맞춘다.
3. 메뉴별 권한을 기존 Portal 권한 모델로 할당한다.
4. 사용자 초기화 시 `roleMenu`에 신규 메뉴가 포함되는지 확인한다.
5. Breadcrumb와 `currentMenuInfo`에 title, description, `menu_id_path`가 정상 설정되는지 확인한다.
6. 권한이 없는 사용자가 직접 URL로 접근했을 때 기존 Portal 방식으로 차단되는지 확인한다.

금지사항:

- AI Lounge 전체 경로를 `ROLE_FREE_URL`에 추가해 권한 검사를 우회하지 않는다.
- 메뉴 데이터를 준비하지 않은 상태에서 `searchMenuPath()`를 약화하지 않는다.
- AI Lounge 통합을 이유로 기존 Portal 메뉴 경로를 변경하지 않는다.

특히 `layouts/user.vue`의 `subjectClass`는 `currentMenuInfo.menu_id_path[0]`을 사용하므로, 메뉴 정보 없이 페이지부터 노출하면 런타임 오류가 발생할 수 있다. 메뉴 데이터와 페이지 배포 순서를 함께 관리한다.

---

## 7. API 분리 및 호출 방식

### 7.1 원칙

Data Catalog API와 AI Lounge API는 서로 다른 포트로 운영한다.

```text
Portal $ofetch       → Data Catalog API 포트 → /api/**
AI Lounge API client → AI Lounge API 포트   → /api/**
```

포트가 다르므로 각 백엔드 내부 경로가 모두 `/api/**`여도 충돌하지 않는다. 단, AI Lounge 요청이 Portal의 기존 `$ofetch` 기본 주소로 전송되지 않도록 별도 클라이언트를 사용한다.

### 7.2 환경변수

Portal에 다음 환경변수를 별도로 추가한다.

```dotenv
NUXT_PUBLIC_API_URL=http://data-catalog-host:data-catalog-port
NUXT_PUBLIC_AI_LOUNGE_API_URL=http://ai-lounge-host:ai-lounge-port
```

`nuxt.config.ts`에는 기존 `baseURL`을 변경하지 않고 새 키만 추가한다.

```ts
const aiLoungeApiUrl = process.env.NUXT_PUBLIC_AI_LOUNGE_API_URL;

runtimeConfig: {
  public: {
    baseURL: apiUrl,
    aiLoungeBaseURL: aiLoungeApiUrl,
    supersetUrl,
    jupyterUrl
  }
}
```

### 7.3 별도 API 클라이언트

Portal의 `plugins/ofetch.ts`를 AI Lounge 주소로 변경하지 않는다. 별도 플러그인 또는 composable을 추가한다.

권장 이름:

- `plugins/ai-lounge-fetch.client.ts`
- 주입 이름: `$aiLoungeFetch`
- 설정 키: `runtimeConfig.public.aiLoungeBaseURL`

예시:

```ts
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const aiLoungeFetch = $fetch.create({
    baseURL: config.public.aiLoungeBaseURL,
    onRequest({ options }) {
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${useAuthStore().accessToken}`);
      options.headers = headers;
    }
  });

  return {
    provide: {
      aiLoungeFetch
    }
  };
});
```

AI Lounge 요청에도 Portal access token을 `Authorization: Bearer <token>` 형태로 넣는다. Portal의 refresh 로직을 복제하거나 별도의 refresh token을 만들지 말고 기존 `useAuthStore().refresh()`와 동시 갱신 제어를 재사용한다. Refresh token은 Portal 백엔드에만 전송하며 AI Lounge 백엔드에는 전달하지 않는다.

### 7.4 현재 `apiFetch()` 이관

현재 AI Lounge 코드는 Native `Response`를 기준으로 다음 패턴을 사용한다.

```js
const response = await apiFetch("/api/assets/catalog");
if (!response.ok) {
  // 오류 처리
}
const data = await response.json();
```

Nuxt `$fetch`는 JSON 데이터를 바로 반환하므로 무조건 교체하면 기존 코드가 깨진다.

선택지는 다음 두 가지다.

1. 1차 통합에서는 기존 `apiFetch()` 인터페이스를 유지하고 내부 API base만 Nuxt runtime config에서 받는다.
2. 이후 별도 작업으로 모든 호출부를 `$aiLoungeFetch` 반환 형식에 맞게 변경한다.

Portal 무손상과 변경 범위 최소화를 위해 1차 통합에서는 1번을 권장한다.

### 7.5 응답에 포함된 파일 URL

AI Lounge 백엔드는 일부 응답에 `/api/**` 상대경로를 포함한다.

- 뉴스 커버 이미지
- 자산 슬라이드
- 첨부파일 다운로드
- Skill ZIP
- AI 활용 게시글 본문 이미지

이 URL은 반드시 AI Lounge API Origin과 결합해야 한다. Portal Origin의 `/api/**`로 직접 요청되면 Data Catalog API로 잘못 전달될 수 있다.

현재 `resolveApiUrl()`, `resolveApiHtml()`, `normalizeApiHtml()`의 역할을 Nuxt 통합 후에도 유지하거나 동일한 기능을 별도 composable로 이관한다.

### 7.6 CORS와 보안 헤더

별도 포트는 서로 다른 Origin이다. AI Lounge 백엔드 CORS에 실제 Portal Origin을 명시적으로 추가한다.

예:

```text
https://portal.example.internal
```

주의사항:

- 운영 환경에서 `allow_origins=["*"]`로 해결하지 않는다.
- 인증 쿠키를 사용할 경우 wildcard Origin과 credentials를 함께 사용하지 않는다.
- `Authorization`, `Content-Type` 등 필요한 헤더의 preflight가 정상인지 확인한다.
- Portal에 CSP가 있다면 `connect-src`에 AI Lounge API Origin을 추가한다.
- 이미지가 별도 API 포트에서 제공되면 CSP `img-src`도 확인한다.
- 다운로드 응답의 CORS 및 노출 헤더를 확인한다.

---

## 8. 인증 통합

현재 AI Lounge의 자체 로그인과 Portal 인증을 동시에 유지하면 사용자 상태가 이중화된다.

통합 목표:

- 로그인과 로그아웃은 Portal이 담당한다.
- AI Lounge 페이지 접근 권한은 Portal 메뉴 권한이 담당한다.
- AI Lounge API 호출에 필요한 사용자 식별 정보는 Portal 인증 컨텍스트에서 전달한다.
- `frontend_vue/src/pages/sign-in/index.vue`는 Portal에 복사하지 않는다.
- `frontend_vue/src/stores/auth.js`는 Portal의 `store/auth.ts`를 덮어쓰지 않는다.
- `ailounge_token`, `ailounge_user` 로컬 스토리지 의존성을 제거한다.

### 8.1 현재 Portal 내부의 사용자 전달 방식

Portal은 페이지를 이동할 때 사용자 객체를 URL query, route params 또는 component props로 전달하지 않는다. 로그인 시 발급받은 access token과 Pinia 전역 스토어를 사용한다.

```text
Portal 로그인
  → 응답의 x-access-token을 useAuthStore에 저장
  → access token의 JWT payload를 디코딩
  → 사용자 정보와 메뉴 권한을 useUserStore에 저장
  → 각 Portal 페이지가 useUserStore().getUser를 직접 조회
  → API 요청 시 Portal $ofetch가 Authorization 헤더를 자동 첨부
```

브라우저를 새로고침하면 메모리의 access token이 사라지므로 Portal 초기화 plugin이 HttpOnly refresh token 쿠키를 이용해 `/api/refresh`를 호출한다. 새 access token을 받은 뒤 `useUserStore().setDefault()`로 사용자 상태와 메뉴를 다시 구성한다.

현재 Portal JWT와 사용자 스토어에서 확인되는 주요 필드는 다음과 같다.

| 필드 | 용도 |
|---|---|
| `user_id` | 사용자 고유 식별자 및 업무 데이터 소유자 키 |
| `username` | 사용자 표시 이름 |
| `authority` | Portal 권한 구분 |
| `dept_id` | 부서 식별자 |
| `dept_nm` | 부서 표시 이름 |
| `user_email` | 사용자 이메일 |
| `last_login` | 최근 로그인 정보 |
| `role_id` | 역할 식별자 |
| `user_role_name` | 역할 표시 이름 |
| `digital_thread_auth` | Digital Thread 권한 여부 |

AI Lounge 페이지도 화면 표시에는 동일한 `useUserStore().getUser`를 사용한다. 사용자 정보를 복사한 별도 AI Lounge store를 만들지 않는다.

```ts
const userStore = useUserStore();

const userId = computed(() => userStore.getUser.user_id);
const username = computed(() => userStore.getUser.username);
const departmentName = computed(() => userStore.getUser.dept_nm);
```

위 값은 화면 표시와 UI 분기에만 사용한다. 데이터 접근 통제의 근거로 브라우저가 보낸 `user_id`를 신뢰하지 않는다.

### 8.2 AI Lounge API로 전달하는 값

메뉴 진입 시 사용자 객체를 한 번 전송하는 방식이 아니라, 모든 AI Lounge API 요청에 현재 Portal access token을 첨부한다.

```http
GET /api/assets/catalog HTTP/1.1
Authorization: Bearer <Portal access token>
```

다음 방식은 사용하지 않는다.

```http
GET /api/assets/catalog?user_id=10001
```

```json
{
  "title": "게시물",
  "user_id": "10001"
}
```

URL이나 body의 `user_id`는 사용자가 다른 값으로 변경할 수 있다. AI Lounge 백엔드는 서명이 검증된 token에서 `user_id`를 추출하고, 요청 query/body에 같은 이름의 값이 있더라도 소유자 판정에는 사용하지 않는다.

### 8.3 AI Lounge 백엔드 인증 및 데이터 격리

AI Lounge 백엔드는 공통 인증 dependency 또는 middleware에서 다음을 수행한다.

1. `Authorization` 헤더에서 Bearer token을 추출한다.
2. token 서명, 허용 알고리즘, 만료 시간과 필수 claim을 검증한다.
3. 가능하면 `issuer`와 `audience`도 검증한다.
4. 검증된 payload로 `CurrentUser`를 생성한다.
5. endpoint는 직접 token을 디코딩하지 않고 `CurrentUser`를 주입받는다.

현재 Portal은 access token을 HMAC256으로 서명한다. 단기 연동 시 AI Lounge 백엔드가 같은 signing secret을 환경변수 또는 배포 Secret으로 받아 검증할 수 있으나, 소스 저장소에 secret을 기록하지 않는다. 공유 HMAC secret을 가진 서비스는 Portal token을 발급할 수도 있으므로 장기적으로는 Portal이 개인키로 서명하고 AI Lounge가 공개키/JWKS로 검증하는 RS256 방식이 더 안전하다.

단순한 `jwtDecode`, 서명 검증을 끈 decode, 프론트가 전달한 claim 복사만으로 인증을 완료하지 않는다.

업무 데이터에는 다음 규칙을 강제한다.

- 생성: 요청 body의 `user_id`를 무시하고 `CurrentUser.user_id`를 저장한다.
- 단건 조회: 리소스 ID와 `CurrentUser.user_id`를 함께 조건으로 사용한다.
- 목록 조회: 기본적으로 `WHERE user_id = :current_user_id`를 적용한다.
- 수정·삭제: 소유자 또는 명시적으로 허용된 관리자만 수행한다.
- 관리자 기능: 프론트 메뉴 노출 여부가 아니라 검증된 token의 권한을 백엔드에서 다시 검사한다.
- 다른 사용자의 리소스 접근 실패는 내부 존재 여부를 과도하게 노출하지 않도록 403/404 정책을 통일한다.

예시:

```sql
SELECT *
FROM ai_usage_posts
WHERE usage_post_id = :post_id
  AND user_id = :current_user_id;
```

```sql
UPDATE ai_usage_posts
SET title = :title
WHERE usage_post_id = :post_id
  AND user_id = :current_user_id;
```

### 8.4 사용자 테이블 처리 원칙

AI Lounge가 Portal 인증을 사용하면 자체 `login_id`, `password`, `user_sessions`로 로그인할 필요가 없다. 다만 기존 업무 테이블의 외래키 유지와 작성자 이름·부서·이메일 표시에 필요하면 인증 기능이 없는 최소 사용자 참조 테이블을 둘 수 있다.

```text
Portal JWT          → 인증, 현재 사용자 및 권한 판정
외부 사용자 참조표 → 이름·부서·이메일 표시와 외래키 유지
업무 테이블         → Portal user_id를 소유자 키로 저장
```

사용자 참조 정보가 필요하면 검증된 JWT claim 또는 신뢰할 수 있는 Portal 내부 API 응답으로 upsert한다. 브라우저가 임의로 제출한 이름·부서·이메일로 기존 사용자를 갱신하지 않는다. 비밀번호, refresh token, 로그인 실패 횟수 등 Portal 인증 전용 정보는 AI Lounge DB에 복제하지 않는다.

### 8.5 토큰 만료와 오류 처리

Portal access token은 현재 설정상 유효기간이 짧으므로 AI Lounge 전용 API 클라이언트도 기존 Portal refresh 절차와 동기화해야 한다.

- 만료 직전 또는 401 발생 시 기존 `useAuthStore().refresh()`를 사용한다.
- 여러 요청이 동시에 실패해도 refresh 요청은 한 번만 실행한다.
- 갱신 성공 후 새 access token으로 원래 요청을 한 번만 재시도한다.
- AI Lounge의 일반적인 401/서버 장애가 무한 refresh나 Portal 전체 로그아웃으로 이어지지 않게 한다.
- refresh token은 AI Lounge API, localStorage, URL, 로그에 노출하지 않는다.
- 403은 인증 만료가 아니라 권한 부족으로 처리하여 refresh를 반복하지 않는다.

### 8.6 인증 연동 확인 사항

백엔드 인증 연동 시 다음을 확정한다.

1. AI Lounge 백엔드가 Portal access token을 직접 검증할 수 있는가?
2. 별도 인증 서비스가 Portal과 AI Lounge에 같은 사용자 ID를 제공하는가?
3. Portal의 `user_id`, 사번, 조직, 관리자 여부를 AI Lounge 모델과 어떻게 매핑하는가?
4. 토큰 만료 시 Portal refresh 동작을 그대로 사용할 수 있는가?
5. AI Lounge 요청의 401이 Portal 전체 로그아웃을 발생시켜야 하는가?
6. Portal token에 `issuer`, `audience`, key rotation 정책을 추가할 것인가?
7. 기존 AI Lounge 데이터의 사용자 ID를 Portal `user_id`와 어떻게 이관할 것인가?

임시 방편으로 Portal 인증 검사를 제거하거나 고정 사용자를 넣지 않는다. 인증 연동이 완료되지 않았다면 AI Lounge 메뉴를 제한된 테스트 권한에만 노출한다.

---

## 9. CSS 무손상 통합

이 절은 통합 전에 반드시 완료해야 하는 차단 조건이다.

### 9.1 현재 확인된 위험

`frontend_vue/src/styles.css`에는 다음과 같은 전역 선택자가 존재한다.

```css
* { ... }
button, input, select, textarea { ... }
button, a { ... }
ul, ol { ... }
img { ... }
```

이 CSS를 Portal 전역에 그대로 등록하면 기존 Portal의 여백, 폰트, 버튼, 링크, 목록, 이미지, form control이 변경될 수 있다.

`.ai-lounge-scope`용 `isolation.css`가 있더라도 위 전역 선택자가 Portal 전체에 먼저 적용되므로 충분한 격리가 아니다.

또한 다음처럼 일반적인 클래스 이름도 충돌 가능성이 있다.

- `.modal-backdrop`
- `.modal-close`
- `.content-state`
- `.primary-button`
- `.form-error`
- `.spin`
- `.page-container`

### 9.2 필수 수정 원칙

AI Lounge CSS의 모든 일반 선택자를 `.ai-lounge-scope` 아래로 제한한다.

```css
/* 금지 */
* {
  box-sizing: border-box;
}

/* 허용 */
.ai-lounge-scope,
.ai-lounge-scope *,
.ai-lounge-scope *::before,
.ai-lounge-scope *::after {
  box-sizing: border-box;
}
```

```css
/* 금지 */
button,
input {
  font: inherit;
}

/* 허용 */
.ai-lounge-scope button,
.ai-lounge-scope input {
  font: inherit;
}
```

일반 클래스도 다음 중 하나로 처리한다.

1. 모든 선택자 앞에 `.ai-lounge-scope`를 붙인다.
2. 클래스 자체를 `.ai-lounge-*`로 변경한다.
3. Vue `<style scoped>` 또는 CSS Modules로 이관한다.

### 9.3 AI Lounge 루트 보장

독립 `App.vue`는 Portal에 복사하지 않으므로 기존 `.ai-lounge-scope` 루트도 자동으로 생기지 않는다.

모든 AI Lounge 페이지는 반드시 다음과 같은 루트를 가져야 한다.

```vue
<template>
  <div class="ai-lounge-scope">
    <!-- AI Lounge 페이지 -->
  </div>
</template>
```

공통 `AiLoungePageScope.vue` 컴포넌트를 만들어 페이지 루트를 감싸는 방법도 가능하다.

라우트 전환 후에도 Modal, Drawer, Lightbox가 이 루트의 자손인지 확인한다. `Teleport to="body"`를 사용하면 범위 밖으로 이동하므로 다음 중 하나를 적용한다.

- Teleport 대상 요소에도 `ai-lounge-scope`를 부여한다.
- Portal modal container와 충돌하지 않는 AI Lounge 전용 container를 사용한다.
- Teleport되는 컴포넌트의 모든 클래스 자체를 `ai-lounge-*`로 네임스페이스화한다.

### 9.4 CSS 변수, 폰트 및 애니메이션

- `:root`에 AI Lounge CSS 변수를 추가하지 않는다.
- CSS 변수는 `.ai-lounge-scope`에 선언한다.
- Portal 기존 변수 이름을 재정의하지 않는다.
- `AILoungeNotoSans`처럼 고유한 font-family 이름을 유지한다.
- Portal 기존 폰트 파일과 같은 경로 또는 이름으로 덮어쓰지 않는다.
- keyframe 이름은 `ai-lounge-*` 접두사를 유지한다.
- `.spin`처럼 범용 클래스는 `.ai-lounge-spin`으로 바꾸거나 범위 선택자를 적용한다.

### 9.5 body 및 스크롤 상태

AI Lounge Modal은 `body.ai-lounge-modal-open`을 사용한다.

- Portal이 사용하는 body class와 이름이 겹치지 않는지 확인한다.
- Modal 종료, 컴포넌트 unmount, 라우트 이동, API 오류 시 class가 반드시 제거되는지 확인한다.
- Portal의 기존 스크롤 잠금과 동시에 실행될 때 한쪽이 다른 쪽의 상태를 해제하지 않도록 reference count 또는 소유권을 구분한다.
- AI Lounge 코드가 Portal의 body style 전체를 덮어쓰지 않도록 한다.

### 9.6 z-index 충돌

다음 UI를 Portal header, Portal modal, loader, alert와 함께 확인한다.

- AI Lounge BaseModal
- Asset Drawer
- 이미지 Lightbox
- 전역 Loader
- Portal `vue-final-modal`
- Portal alert

임의로 Portal z-index를 변경하지 않는다. AI Lounge 쪽 z-index 범위를 정하고 Portal UI의 우선순위 정책에 맞춘다.

### 9.7 CSS 로딩 방식

AI Lounge CSS를 Portal 공통 CSS 파일에 합쳐 넣지 않는다.

권장:

- `assets/ai-lounge/styles/**`로 분리
- AI Lounge 페이지 또는 공통 scope component에서 import
- 모든 선택자가 scope 처리되었는지 확인한 뒤 필요할 경우에만 `nuxt.config.ts`에 추가

Nuxt에서 lazy-loaded 페이지 CSS가 한 번 로드된 뒤 문서에 남을 수 있으므로 “AI Lounge 경로에서만 import했다”는 사실만으로 격리가 보장되지는 않는다. 선택자 scope가 최종 방어선이다.

---

## 10. Portal 레이아웃 무손상

AI Lounge 독립 `AppLayout.vue`의 Header, Breadcrumb, Footer를 Portal에 함께 렌더링하면 이중 Header/Footer가 생긴다.

통합 시:

- Portal의 기존 `user` 또는 `admin` layout만 사용한다.
- AI Lounge `AppLayout.vue`는 복사하지 않는다.
- Portal Breadcrumb와 메뉴 제목을 사용할지 AI Lounge 내부 제목을 사용할지 화면별로 결정한다.
- 중복 제목이 생기면 AI Lounge 경로에서만 Portal `contents-top`을 숨기는 방식으로 처리한다.
- Portal 전체 `.contents-top`, `.contents`, `.wrapper`, `.main-sub` 스타일을 수정하지 않는다.
- 예외 CSS는 반드시 `.wrapper-ai-lounge` 또는 `route.meta.aiLounge`에 한정한다.
- Portal의 Main, Search, My, Support, Admin 페이지 DOM 구조를 변경하지 않는다.

Portal `layouts/user.vue`에 이미 `wrapper-ai-lounge` 분기가 있으므로 이를 활용하되, 기존 Portal 경로에 해당 클래스가 붙지 않는지 확인한다.

---

## 11. JavaScript 및 상태 오염 방지

### 11.1 전역 이벤트

- AI Lounge 이벤트 이름은 `ailounge:*` 접두사를 유지한다.
- `window.addEventListener`는 `onBeforeUnmount`에서 반드시 제거한다.
- Portal이 사용하는 이벤트 이름을 재사용하지 않는다.

### 11.2 타이머와 임시 리소스

- `setInterval`, `setTimeout`은 페이지 이탈 시 정리한다.
- `URL.createObjectURL()` 결과는 사용 후 revoke한다.
- 업로드 미리보기, Modal, Drawer가 페이지 이탈 후 남지 않는지 확인한다.

### 11.3 Store

- Portal `store/auth.ts`, `store/user.ts`를 수정하거나 덮어쓰지 않는다.
- AI Lounge 전용 store가 필요하면 `useAiLounge*` 이름을 사용한다.
- Pinia store ID도 `aiLounge*` 접두사를 사용한다.
- Portal persisted state key와 같은 로컬 스토리지 키를 사용하지 않는다.
- Portal 사용자 객체를 AI Lounge에서 직접 변경하지 않고 읽기 전용으로 사용한다.

### 11.4 전역 등록

- Portal `nuxtApp.provide` 이름과 충돌하지 않도록 `$aiLoungeFetch`처럼 고유 이름을 사용한다.
- `$ofetch`, `$PAGE`, Portal 공통 formatter를 재정의하지 않는다.
- 전역 Vue directive나 plugin을 추가할 때 기존 이름을 먼저 검색한다.

---

## 12. 패키지 통합

공통 패키지 선언 버전은 Portal 기준을 유지한다.

```json
{
  "pinia": "^2.1.7",
  "vue": "^3.4.21",
  "vue-router": "^4.3.0"
}
```

AI Lounge가 추가로 사용하는 패키지:

```json
{
  "dompurify": "^3.4.13",
  "marked": "^15.0.6"
}
```

아이콘은 `lucide-vue-next` 패키지를 설치하지 않고 `src/icons/lucide/`에 포함된 사용 아이콘 49종과 로컬 Vue 렌더러를 사용한다. 동봉된 `src/icons/lucide/LICENSE`를 유지한다.

통합 규칙:

1. AI Lounge `package.json`을 Portal에 복사하지 않는다.
2. Portal `package.json`에는 `dompurify`, `marked`만 추가한다.
3. Portal의 다른 패키지 버전을 AI Lounge 기준으로 일괄 변경하지 않는다.
4. Portal 프로젝트 디렉터리에서 정상적인 package manager 명령으로 lockfile을 갱신한다.
5. lockfile을 AI Lounge lockfile로 교체하지 않는다.
6. 설치 후 `npm audit`과 Portal 전체 빌드를 실행한다.
7. CKEditor, vue-final-modal, Pinia, Vue Router가 중복 설치되지 않았는지 `npm ls`로 확인한다.

---

## 13. HTML, Markdown 및 XSS

- Tech News Markdown은 `marked.parse()` 결과를 반드시 `DOMPurify.sanitize()`한 후 `v-html`로 렌더링한다.
- AI 활용 게시글 `content_html`은 백엔드 정화 결과만 렌더링한다.
- Portal의 기존 `v-html` 정책을 약화하지 않는다.
- DOMPurify 허용 태그·속성을 Portal 전체 기준으로 넓히지 않는다.
- AI Lounge 전용 sanitizer 설정이 필요하면 별도 함수로 둔다.
- 외부 URL은 `http:`, `https:` 등 허용 scheme을 검증한다.
- 새 창 링크에는 필요한 `rel="noopener noreferrer"`를 적용한다.

---

## 14. 단계별 통합 순서

### 단계 0: Portal 기준선 확보

- 통합 전 Portal 브랜치와 commit을 기록한다.
- `npm ci` 후 Portal build 결과를 보관한다.
- 주요 Portal 화면의 스크린샷을 데스크톱·모바일 크기로 저장한다.
- 주요 API 호출 및 로그인·로그아웃 결과를 기록한다.
- 브라우저 콘솔 오류와 Network 실패 요청을 기록한다.

중단 조건:

- 통합 전부터 Portal build나 핵심 기능이 실패하면 먼저 기준선을 복구한다.

### 단계 1: 패키지만 추가

- `dompurify`, `marked`만 추가하고 로컬 아이콘 모듈은 소스와 함께 복사한다.
- Portal build와 기존 화면 회귀 테스트를 수행한다.

중단 조건:

- 기존 dependency가 업그레이드·다운그레이드되거나 중복 Vue가 생기면 롤백한다.

### 단계 2: 네임스페이스 디렉터리 생성

- `components/ai-lounge`, `assets/ai-lounge`, `utils/ai-lounge`를 추가한다.
- 기존 Portal 파일을 이동하거나 이름 변경하지 않는다.
- AI Lounge import 경로를 네임스페이스 경로로 수정한다.

중단 조건:

- 기존 Portal 컴포넌트 자동 등록 이름과 충돌하면 AI Lounge 컴포넌트 이름을 변경한다.

### 단계 3: CSS 격리 완료

- 모든 전역 선택자를 `.ai-lounge-scope`로 제한한다.
- 일반 클래스 이름을 네임스페이스화한다.
- AI Lounge 루트 밖의 Portal DOM에 스타일이 적용되지 않는지 확인한다.

중단 조건:

- AI Lounge 페이지 방문 전후로 기존 Portal 요소의 computed style이 달라지면 다음 단계로 진행하지 않는다.

### 단계 4: API 클라이언트 추가

- `aiLoungeBaseURL` runtime config를 추가한다.
- 기존 `baseURL`과 `$ofetch`는 변경하지 않는다.
- AI Lounge API 클라이언트만 별도 추가한다.
- CORS와 CSP를 설정한다.

중단 조건:

- Data Catalog 요청이 AI Lounge 포트로 가거나 AI Lounge 요청이 Data Catalog 포트로 가면 롤백한다.

### 단계 5: 페이지와 메뉴 추가

- 한 번에 전체 페이지를 넣지 말고 메뉴 그룹 단위로 추가한다.
- 권장 순서: `aistudio` → `community` → `connected` → `administration`.
- 메뉴 데이터, 권한, Breadcrumb를 함께 추가한다.

중단 조건:

- 기존 Portal URL이 다른 컴포넌트로 매칭되거나 catch-all 라우트로 빠지면 해당 그룹을 롤백한다.

### 단계 6: 인증 연결

- AI Lounge 화면 표시에는 Portal `useUserStore()`를 재사용한다.
- 모든 AI Lounge API 요청에 Portal access token을 Bearer token으로 연결한다.
- AI Lounge 백엔드는 token을 검증하고 `user_id`를 서버 측에서 추출한다.
- 생성·조회·수정·삭제 쿼리에 검증된 현재 사용자 기준의 데이터 격리를 적용한다.
- 자체 로그인 페이지와 자체 auth store는 배포 대상에서 제외한다.
- 401, 403, token refresh, logout 동작을 검증한다.

중단 조건:

- AI Lounge API 오류가 기존 Portal 세션을 비정상적으로 종료하거나 refresh loop를 만들면 롤백한다.

### 단계 7: 전체 회귀 테스트

- 아래 테스트 매트릭스를 전부 수행한다.
- 실패 항목이 하나라도 있으면 배포하지 않는다.

---

## 15. 필수 회귀 테스트 매트릭스

### 15.1 기존 Portal 기능

- 로그인
- SSO callback 및 오류 페이지
- 로그아웃
- 토큰 refresh
- Portal Main
- 통합검색 목록 및 상세
- 카테고리 검색
- 표준 단어·용어·도메인
- My Dashboard
- 즐겨찾기
- 데이터 요청
- 게시판 및 첨부파일
- 관리자 메뉴
- 사용자·부서·권한 관리
- CKEditor 입력 및 이미지 업로드
- Portal Modal, Alert, Loader
- Superset 및 Jupyter 연결

### 15.2 AI Lounge 기능

- AI STUDIO 소개
- DX 과제 발굴 세션 생성·조회·대화·삭제
- 자산 목록·검색·상세·북마크·추천
- 자산 등록·파일 업로드·저장소·Skill 생성
- Tech News 조회·작성·수정·삭제·커버 이미지
- AI 활용법 조회·작성·수정·본문 이미지·좋아요
- 아이디어 등록·조회·삭제·첨부파일
- Calendar
- Idea 심사
- 자산 심사·활성화·삭제

### 15.3 CSS 회귀

각 화면을 AI Lounge 방문 전과 방문 후에 비교한다.

- Portal header 높이, 폭, 메뉴 위치
- Portal footer
- 공통 button, input, select, checkbox, radio
- table header와 row
- link 색상과 underline
- list marker
- image 크기
- font family, font size, line height
- Portal Modal 크기와 z-index
- body scroll
- 반응형 min-width

권장 viewport:

- 1920×1080
- 1440×900
- 1280×720
- 768×1024
- 390×844

### 15.4 API 분리

브라우저 Network에서 확인한다.

- Data Catalog 요청은 Data Catalog 포트로만 전달된다.
- AI Lounge 요청은 AI Lounge 포트로만 전달된다.
- 두 서비스 모두 내부 경로는 `/api/**`를 유지한다.
- AI Lounge 이미지·첨부파일·ZIP도 AI Lounge 포트로 전달된다.
- CORS preflight가 실패하지 않는다.
- Portal의 기존 `$ofetch` baseURL이 변경되지 않았다.

### 15.5 라우팅

- 메뉴 클릭
- 브라우저 뒤로·앞으로
- 직접 URL 입력
- 새로고침
- Query string 유지
- 잘못된 URL의 기존 Portal catch-all 동작
- 권한 없는 URL 접근
- `/index.html` 별칭

### 15.6 빌드 및 정적 분석

```bash
npm ci
npm run build:dev
npm run build
npm audit
```

- TypeScript 오류 확인
- 브라우저 콘솔 오류 0건 확인
- 중복 Vue/Pinia/Vue Router 확인
- 사용하지 않는 import와 dead code 확인
- 기존 보안성 검토 재실행

---

## 16. 배포 체크리스트

- [ ] `NUXT_PUBLIC_API_URL`이 Data Catalog API를 가리킨다.
- [ ] `NUXT_PUBLIC_AI_LOUNGE_API_URL`이 AI Lounge API를 가리킨다.
- [ ] AI Lounge 백엔드 CORS에 Portal Origin이 등록됐다.
- [ ] AI Lounge API의 모든 보호 endpoint가 Portal Bearer token을 검증한다.
- [ ] 요청 query/body의 `user_id`가 소유자 판정에 사용되지 않는다.
- [ ] 사용자별 목록·단건·수정·삭제 데이터 격리 테스트를 통과했다.
- [ ] 일반 사용자와 관리자 권한 검사가 백엔드에서도 수행된다.
- [ ] Portal refresh token이 AI Lounge API 또는 로그에 전달되지 않는다.
- [ ] CSP `connect-src`, `img-src`가 별도 API Origin을 허용한다.
- [ ] AI Lounge health endpoint가 정상이다.
- [ ] Portal menu 및 role 데이터가 먼저 또는 함께 배포된다.
- [ ] AI Lounge API 배포 후 Portal 메뉴를 활성화한다.
- [ ] 정적 파일 cache invalidation 정책을 확인했다.
- [ ] 직접 URL 새로고침을 확인했다.
- [ ] 운영 로그에서 404, 401, CORS 오류가 없는지 확인했다.
- [ ] 롤백용 이전 Portal artifact를 보관했다.

---

## 17. 롤백 전략

통합 변경은 제거 가능한 additive change로 유지한다.

권장 롤백 단위:

1. Portal 메뉴에서 AI Lounge 항목 비활성화
2. AI Lounge 페이지 라우트 제거
3. AI Lounge 전용 plugin/composable 제거
4. `aiLoungeBaseURL` 설정 제거
5. `components/ai-lounge`, `assets/ai-lounge` 제거
6. AI Lounge 전용 세 패키지 제거

롤백 시에도 다음 Portal 파일을 통째로 과거 버전으로 덮어쓰지 않는다.

- `nuxt.config.ts`
- `layouts/user.vue`
- `middleware/menu.global.ts`
- `plugins/ofetch.ts`
- `package.json`

각 파일에서 AI Lounge를 위해 추가한 최소 변경만 되돌린다. 통합 기간 중 다른 Portal 개발자가 만든 변경을 함께 제거하지 않도록 한다.

---

## 18. 완료 기준

다음 조건을 모두 만족해야 통합 완료로 판단한다.

- [ ] AI Lounge 페이지가 Portal Nuxt 파일 라우팅으로 동작한다.
- [ ] 기존 Portal 경로와 충돌하지 않는다.
- [ ] 기존 Portal 로그인·SSO·권한·메뉴가 동일하게 동작한다.
- [ ] AI Lounge는 Portal 인증 컨텍스트를 사용한다.
- [ ] AI Lounge 페이지는 별도 사용자 store 없이 Portal `useUserStore()`를 사용한다.
- [ ] AI Lounge 백엔드는 검증된 Portal token에서 `user_id`를 추출한다.
- [ ] 모든 사용자 소유 데이터가 검증된 `user_id`로 격리된다.
- [ ] Data Catalog API와 AI Lounge API가 포트별로 정확히 분리된다.
- [ ] AI Lounge CSS가 Portal DOM에 영향을 주지 않는다.
- [ ] AI Lounge 방문 전후 Portal computed style 차이가 없다.
- [ ] Portal 기존 Modal, Loader, Alert, CKEditor가 정상 동작한다.
- [ ] 데스크톱 및 모바일 회귀 테스트를 통과한다.
- [ ] Portal production build와 development build가 모두 성공한다.
- [ ] npm audit 및 보안성 검토를 통과한다.
- [ ] 운영 배포 후 404, CORS, 인증 오류가 없다.
- [ ] AI Lounge 변경만 독립적으로 롤백할 수 있다.

이 기준 중 하나라도 만족하지 않으면 “통합 완료”로 처리하지 않는다.
