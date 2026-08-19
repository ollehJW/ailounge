# AI Lounge Frontend Portal 통합 가이드

## 1. 목적

이 문서는 독립 Vue 애플리케이션인 `frontend_vue`의 AI STUDIO 및 AX COMMUNITY 기능을
`future/data_catalog_portal/source/frontend/nuxt-project` Portal에 통합할 때 필요한 조치를 정리한다.

최종 목표는 다음과 같다.

- Portal의 상단 메뉴, Breadcrumb, 페이지 제목, Footer를 공통으로 사용한다.
- 메뉴 등록, 메뉴 노출, 역할별 접근 권한은 Portal 메뉴 DB와 권한 체계를 단일 기준으로 사용한다.
- 로그인, 세션 유지, 사용자 식별과 관리자 권한 판정은 Portal 인증 체계를 단일 기준으로 사용한다.
- Portal 인증 사용자의 신원을 AI Lounge Backend까지 안전하게 전달한다.
- AI STUDIO와 AX COMMUNITY는 검증된 Portal 사용자 식별자로 AI Lounge 도메인 DB의 데이터를 조회한다.
- AI Lounge 페이지는 Portal의 Nuxt Router에서 관리한다.
- Portal CSS와 AI Lounge CSS가 서로 침범하지 않는다.
- 기존 FastAPI Backend와 `/ai-lounge-api` 전용 경로로 통신한다.

권장 방식은 독립 번들을 Portal 안에 중첩 마운트하는 방식이 아니라, Vue 컴포넌트와 기능 코드를
Nuxt 소스에 이관하는 방식이다. `embedded` 모드는 이관이 완료되기 전 화면과 레이아웃을 검증하기 위한
중간 단계로 사용한다.

## 2. 현재 기준

### 독립 애플리케이션

- 위치: `frontend_vue`
- Vue: `3.5.40`
- Pinia: `2.3.1`
- Vue Router: `4.6.4`
- Vite: `7.x`
- 개발 포트: `9001`
- AI Lounge Backend: FastAPI, 포트 `9002`
- API 전용 Prefix: `/ai-lounge-api`

### Portal

- 위치: `future/data_catalog_portal/source/frontend/nuxt-project`
- Nuxt: `3.17.5`
- 현재 설치 결과 기준 Vue: `3.5.40`
- 현재 설치 결과 기준 Pinia: `2.3.1`
- 현재 설치 결과 기준 Vue Router: `4.6.4`
- Portal 메뉴는 DB 정보와 Portal Store의 현재 메뉴 정보를 사용한다.

통합 전 Portal의 `package-lock.json` 기준 실제 설치 버전을 다시 확인한다. `package.json`의 범위 표기만 보고
버전을 판단하지 않는다.

## 3. 영구 유지할 조치와 임시 조치

### 영구 유지

- 모든 AI Lounge DOM의 최상위 `.ai-lounge-scope`
- `styles/isolation.css`의 Portal 전역 스타일 방어 규칙
- `AILoungeNotoSans` 고유 폰트명
- `ai-lounge-*` 접두사의 keyframes 및 body 상태 클래스
- Teleport 팝업의 `.ai-lounge-scope ai-lounge-overlay` 래퍼
- `utils/bodyScrollLock.js`의 중첩 모달 대응 참조 카운트
- `/ai-lounge-api` 전용 API 경로

### Portal 구조 확정 후 재검토

- Portal `layouts/user.vue`의 `/studio`, `/community` 경로 판별
- `.wrapper`, `.header-sub`, `.sub-menu-wrap`의 `min-width` 예외
- `VITE_LAYOUT_MODE`, `VITE_ROUTER_BASE`, `VITE_APP_BASE`
- 독립 `App.vue`, `AppLayout.vue`, `EmbeddedLayout.vue`
- 독립 Vue Router와 Router Guard
- 독립 로그인 페이지 및 Local Storage 기반 인증 Store

## 4. 권장 통합 순서

### 4.1 작업 기준 확정

1. 최종 Portal 경로를 먼저 확정한다.
   - 권장: `/studio/**`, `/community/**`
2. Portal 메뉴 DB에 들어갈 메뉴 ID, 경로, 표시명, 설명, 정렬 순서와 역할별 권한을 확정한다.
   - AI STUDIO와 AX COMMUNITY의 메뉴 노출 및 접근 허용 여부는 Portal 메뉴 DB와 Portal 권한 Store가 결정한다.
   - AI Lounge에서 별도의 메뉴 권한 테이블이나 독립 Router Guard를 운영하지 않는다.
3. Portal 인증 사용자와 AI Lounge 도메인 데이터의 매칭 기준을 확정한다.
   - 권장 키: Portal의 변경되지 않는 사내 사용자 식별자
   - 이메일이나 표시 이름만으로 사용자를 식별하지 않는다.
   - 게시글, 아이디어, 자산, 댓글, 즐겨찾기 등 사용자 소유 데이터는 이 식별자를 `user_id`로 참조한다.
   - 기존 AI Lounge `user` 테이블을 유지한다면 로그인 계정 저장소가 아니라 Portal 사용자 ID에 연결된 도메인 프로필 또는 호환 정보로만 사용한다.
4. `/ai-lounge-api`를 FastAPI `9002`로 전달할 Reverse Proxy 위치를 확정한다.

### 4.2 의존성 병합

Portal에 없는 AI Lounge 직접 의존성만 추가한다.

```bash
npm install dompurify@3.4.13 lucide-vue-next@0.468.0 marked@15.0.6
```

Vue, Pinia, Vue Router를 별도 중복 설치하지 않는다. Portal의 Nuxt 호환 버전을 기준으로 사용한다.
설치 후에는 반드시 lockfile을 함께 검토한다.

`@vitejs/plugin-vue`와 독립 Vite는 Nuxt가 제공하므로 Portal에 추가하지 않는다. `marked`가 다른 패키지의
간접 의존성으로 이미 존재하더라도 AI Lounge가 직접 import하므로 Portal의 직접 의존성으로 명시한다.

### 4.3 소스 배치

권장 배치는 다음과 같다.

```text
assets/ai-lounge/           # 이미지, 폰트, CSS
components/ai-lounge/       # 공통 컴포넌트, 자산 상세, Q&A, 등록 컴포넌트
composables/ai-lounge/      # API, 사용자 Adapter, 브라우저 유틸리티
pages/studio/               # AI STUDIO Nuxt 페이지
pages/community/            # AX COMMUNITY Nuxt 페이지
stores/ai-lounge/           # Portal Store와 분리가 필요한 기능 상태만 배치
```

기존 `frontend_vue/src/pages` 파일은 Nuxt 페이지에 바로 복사하는 것보다, 화면 컴포넌트와 Nuxt 페이지
래퍼를 분리하는 것이 좋다. Nuxt 페이지는 메뉴 메타와 사용자 컨텍스트를 연결하고, 실제 화면은
`components/ai-lounge/pages` 같은 위치에서 렌더링하도록 구성한다.

## 5. 레이아웃 통합

### 중간 통합 단계

독립 앱을 임시로 하위 경로에 마운트한다면 다음 설정을 사용한다.

```env
VITE_LAYOUT_MODE=embedded
VITE_ROUTER_BASE=/ai-lounge/
VITE_APP_BASE=/ai-lounge/
```

`embedded` 모드에서는 독립 상단 메뉴, Breadcrumb, 페이지 제목, Footer를 렌더링하지 않는다.

### 최종 통합 단계

- Portal의 `layouts/user.vue`가 공통 Header, Breadcrumb, 페이지 제목, Footer를 담당한다.
- AI Lounge 페이지는 `.ai-lounge-scope`로 감싼 콘텐츠만 렌더링한다.
- `AppLayout.vue`의 Portal 유사 헤더와 Footer를 사용하지 않는다.
- Portal이 이미 페이지 제목을 표시한다면 AI Lounge 페이지 내부의 중복 제목을 제거한다.
- Portal 메뉴 정보가 준비되기 전에 `getTab.currentMenuInfo`를 무조건 참조하지 않도록 방어한다.

## 6. Router 이관

현재 독립 라우트는 `frontend_vue/src/router/index.js`에 있다. 다음 경로를 Nuxt 파일 기반 라우트로 이관한다.

| 현재 경로 | 화면 |
| --- | --- |
| `/studio` | AI STUDIO 소개 |
| `/studio/dx-discovery` | DX 과제 발굴 |
| `/studio/assets` | AI 자산 라이브러리 |
| `/studio/assets/register` | AI 자산 등록 |
| `/community/tech-news` | AI Tech News |
| `/community/ai-usage` | 나만의 AI 활용법 |
| `/community/ideas` | AI 아이디어 공모 |

각 AI Lounge Nuxt 페이지에는 다음 메타를 부여하는 방식을 권장한다.

```ts
definePageMeta({
  layout: "user",
  aiLounge: true
});
```

`RouterLink`는 `NuxtLink`로, 독립 `useRouter` 및 `useRoute` import는 Nuxt composable 사용 방식으로 변경한다.
직접 URL 접속과 새로고침에서도 Portal 메뉴 Store가 올바르게 복원되는지 확인한다.

메뉴 등록과 접근 권한은 Nuxt 페이지 파일의 존재 여부가 아니라 Portal 메뉴 DB 및 역할별 메뉴 매핑을
기준으로 한다. `/studio/**`, `/community/**` 페이지를 추가하기 전에 각 경로를 Portal 메뉴 DB에 등록하고,
일반 사용자와 관리자 역할에 필요한 메뉴만 부여한다. Portal 전역 메뉴 Middleware를 우회하기 위해
AI Lounge 경로 전체를 권한 검사 예외로 추가하지 않는다.

### 반드시 남겨둘 최종 To-Do

Nuxt 라우트 이관과 Portal 인증 전환이 완료되면 다음 독립 구현을 제거한다.

- `frontend_vue/src/router/index.js`
- 독립 Router Guard
- `frontend_vue/src/pages/LoginPage.vue`
- `frontend_vue/src/layouts/AppLayout.vue`
- 독립 앱 전용 `App.vue` 부트스트랩
- `VITE_ROUTER_BASE`, `VITE_APP_BASE`, `VITE_LAYOUT_MODE`

여기서 제거 대상은 AI Lounge가 직접 생성한 독립 Vue Router 구성이다. Nuxt와 기존 Portal이 사용하는
`vue-router` 패키지까지 무조건 제거하면 안 된다.

## 7. 인증 및 사용자 매칭

### 통합 원칙

Portal을 인증과 사용자 권한의 단일 원천으로 사용한다.

- 사용자는 Portal에서만 로그인한다.
- 세션 갱신, 로그아웃, 사용자 식별과 Portal 메뉴 권한은 Portal 인증 체계를 따른다.
- AI STUDIO와 AX COMMUNITY는 별도 로그인 세션이나 비밀번호를 운영하지 않는다.
- AI Lounge Frontend는 Portal User Store를 통해 현재 사용자 정보를 읽는다.
- FastAPI는 검증된 Portal 사용자 식별자를 기준으로 AI Lounge 도메인 DB를 조회하고 작성자 및 소유권을 판정한다.
- 메뉴 접근 권한은 Portal이 판정하고, 데이터 수정·삭제·관리자 작업 권한은 FastAPI가 다시 검증한다.

권장 요청 흐름은 다음과 같다.

```text
Portal 로그인
  -> Portal이 사용자와 메뉴 권한을 확인
  -> AI STUDIO 또는 AX COMMUNITY 페이지 진입
  -> Portal 인증 토큰 또는 신뢰 가능한 교환 토큰을 FastAPI에 전달
  -> FastAPI가 토큰에서 Portal user_id와 역할을 검증
  -> 해당 user_id로 AI Lounge DB의 게시글, 아이디어, 자산, 댓글, 즐겨찾기 등을 조회
```

현재 `frontend_vue/src/stores/auth.js`는 다음 독립 인증을 사용한다.

- `/api/auth/login`
- `ailounge_token`, `ailounge_user` Local Storage
- 독립 로그인 페이지

최종 통합에서는 Portal 인증 사용자를 기준으로 다음 Adapter를 제공한다.

```ts
type AiLoungeUser = {
  user_id: string;
  login_id?: string;
  email?: string;
  org_name?: string;
  displayed_name: string;
  job_title?: string;
  is_admin: boolean;
};
```

권장 구조는 `useAiLoungeUser()`가 Portal User Store를 읽고 위 형태로 정규화하는 방식이다. 각 페이지가
Portal Store 구조를 직접 참조하지 않도록 한다.

Portal 사용자 필드와 AI Lounge 사용자 필드의 매핑은 통합 시 명시적으로 정의한다. 특히 Portal과 기존
AI Lounge의 `user_id`가 서로 다른 식별 체계라면 임의로 덮어쓰지 말고 별도 매핑 또는 데이터 이관을
수행한다. `job_title`처럼 Portal에 없는 필드는 Portal 사용자 API에 추가하거나 선택 정보로 처리한다.
관리자 여부도 브라우저가 전달한 값이 아니라 Portal 역할과 서버의 역할 매핑으로 결정한다.

보안상 브라우저가 보낸 `user_id`만 FastAPI에서 신뢰하면 안 된다. 다음 중 하나를 적용한다.

1. Portal Backend가 인증된 사용자 정보로 서명된 AI Lounge용 토큰을 발급한다.
2. 인증된 Reverse Proxy가 검증된 사용자 헤더를 주입하고 FastAPI는 해당 Proxy 요청만 허용한다.
3. FastAPI가 Portal의 JWT를 직접 검증한다.

사용자가 작성자·관리자 권한을 임의로 변경할 수 없도록 `is_admin`, 작성자 `user_id`는 서버에서 검증한다.

### 관리자 권한 매핑

기존 AI Lounge의 `is_admin` 단일 값은 Portal의 역할 및 권한 코드를 기준으로 대체한다. 계정 관리,
Tech News 작성·관리, Idea 심사, AI 자산 심사, 운영 자산 관리 권한을 하나의 관리자 여부로 묶지 않고
업무별 권한으로 분리하는 것을 원칙으로 한다.

통합 전에 다음 형식의 권한 매핑표를 확정한다.

| AI Lounge 기능 | Portal 역할·권한 코드 | Backend 검증 권한 |
| --- | --- | --- |
| Tech News 작성·관리 | 확정 필요 | `tech_news:manage` |
| Idea 심사 | 확정 필요 | `idea:review` |
| AI 자산 심사 | 확정 필요 | `ai_asset:review` |
| 운영 자산 활성화·삭제 | 확정 필요 | `ai_asset:operate` |
| 계정 관리 | Portal 사용자 관리 정책 확인 | `user:manage` |

- 메뉴 노출은 Portal 메뉴 권한으로 결정한다.
- API 실행 권한은 FastAPI가 Portal 토큰의 역할·권한을 기준으로 다시 검증한다.
- Frontend가 전달한 `is_admin` 또는 권한 문자열은 권한 판정 근거로 사용하지 않는다.
- 한 사용자가 복수 역할을 보유할 수 있도록 권한 합산 규칙을 정의한다.
- 기존 관리자 계정은 Portal 역할로 이관한 후 독립 `is_admin` 의존성을 제거한다.

## 8. API 통합

현재 API Client는 `/api/**` 요청을 `/ai-lounge-api/**`로 변환한다. 이 경로는 Portal Java API의
`/api/**`와 분리하기 위해 유지한다.

개발용 Vite Proxy는 최종 배포 Proxy가 아니다. Portal 운영 환경의 Web Server 또는 Gateway에서 다음과
같은 라우팅을 구성해야 한다.

```text
/api/**             -> Portal Spring Backend
/ai-lounge-api/**   -> AI Lounge FastAPI:9002/api/**
```

로컬 개발 중에는 Portal `nuxt.config.ts`의 `vite.server.proxy`에 별도 경로를 추가한다.

```ts
"/ai-lounge-api": {
  target: "http://127.0.0.1:9002",
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/ai-lounge-api/, "/api")
}
```

통합 시 확인할 항목:

- 파일 업로드 요청의 크기 제한과 timeout
- 다운로드 및 HTML View 응답의 Content-Type/Content-Disposition
- LLM 요청처럼 오래 걸리는 API의 Gateway timeout
- 동일 Origin 구성 시 불필요한 CORS 제거
- 401 응답을 Portal 로그아웃으로 처리할지 AI Lounge 권한 오류로 처리할지 구분

### API 오류 및 세션 만료 처리

Portal API와 AI Lounge API가 서로 다른 오류 팝업을 중복으로 표시하지 않도록 AI Lounge 전용 API
Client에서 다음 처리 규칙을 공통 적용한다.

| 상태 | 처리 원칙 |
| --- | --- |
| `401 Unauthorized` | Portal 세션 갱신 후 원 요청을 한 번만 재시도하고, 갱신 실패 시 Portal 로그인 절차로 이동 |
| `403 Forbidden` | 로그아웃시키지 않고 메뉴 또는 기능 접근 권한이 없음을 안내 |
| `404 Not Found` | 삭제되었거나 접근할 수 없는 데이터로 안내 |
| `409 Conflict` | 중복 처리나 심사 상태 변경 등 도메인 충돌 메시지를 표시 |
| `413 Payload Too Large` | 허용 파일 크기와 함께 업로드 용량 초과를 안내 |
| `422 Unprocessable Entity` | Backend 필드 검증 메시지를 입력 UI에 연결 |
| `429 Too Many Requests` | 잠시 후 재시도하도록 안내하고 자동 중복 요청을 차단 |
| `5xx` | Portal 공통 장애 안내를 사용하되 LLM timeout 등 복구 가능한 오류는 구분 |

- 동시에 여러 요청이 `401`을 반환해도 세션 갱신 요청은 한 번만 수행하도록 refresh 요청을 공유한다.
- 재시도는 최대 한 번으로 제한해 무한 갱신 루프를 방지한다.
- 사용자 취소, 네트워크 단절, timeout과 서버 오류를 구분한다.
- Portal의 전역 오류 처리와 AI Lounge의 도메인 오류 중 한 곳만 사용자 메시지를 표시하도록 한다.
- 파일 다운로드와 HTML 응답은 JSON 오류를 가정하지 말고 응답 Content-Type을 확인한다.

## 9. CSS 격리

### 콘텐츠 보안 정책

AI Lounge는 Markdown, 사용자 작성 HTML, `iframe srcdoc`, 붙여넣기 이미지와 외부 링크를 처리하므로
Portal 통합 시 다음 정책을 공통 적용한다.

- 모든 사용자 작성 HTML과 Markdown 렌더링 결과는 DOMPurify로 정제한 후 `v-html`에 전달한다.
- 허용할 HTML 태그, 속성, 이미지 소스와 URL 프로토콜을 allowlist로 명시한다.
- `script`, 이벤트 핸들러 속성, 위험한 `style`, `javascript:` URL은 제거한다.
- `marked`와 DOMPurify를 Portal의 직접 의존성으로 고정하고 버전 변경 시 렌더링 회귀 테스트를 수행한다.
- 외부 링크는 `target="_blank"` 사용 시 `rel="noopener noreferrer"`를 함께 적용한다.
- 자산 등록서의 `iframe srcdoc`에는 필요한 최소 `sandbox` 권한만 부여하고 Portal CSP와 함께 검증한다.
- 붙여넣기 이미지를 base64로 본문에 무제한 저장하지 않는다. 허용 크기와 MIME을 검증한 후 Backend에
  업로드하고 정제된 파일 URL을 본문에 저장하는 방식을 우선한다.
- 파일 업로드는 Frontend 확장자 검사만 신뢰하지 않고 Backend에서 MIME, 크기, 파일명과 저장 경로를 검증한다.
- CSP에는 실제로 필요한 `img-src`, `frame-src`, `style-src`, API 연결 대상만 허용한다.
- 기존 게시물도 출력 시 동일한 정제 정책을 적용하고, 정책 변경으로 제거되는 콘텐츠가 있는지 사전 점검한다.

### 필수 Root

AI Lounge 화면과 Teleport 콘텐츠는 반드시 다음 Scope 내부에 있어야 한다.

```html
<div class="ai-lounge-scope">
  <!-- AI Lounge content -->
</div>
```

### Import 순서

```text
styles/tokens.css
styles/isolation.css
styles.css
기능별 CSS
```

### PostCSS

현재 `postcss.config.js`는 다음 위치의 CSS에만 `.ai-lounge-scope`를 붙인다.

- `/frontend_vue/src/`
- `/assets/ai-lounge/`

최종 배치 경로가 다르면 `isAiLoungeSource` 조건을 수정한다. Portal 공통 CSS, CKEditor, 기타 외부
라이브러리 CSS에는 이 Plugin을 적용하지 않는다.

Portal에는 현재 별도 PostCSS 설정 파일이 없으므로 통합 시 `frontend_vue/postcss.config.js`의 Scope
Plugin을 Portal 빌드 설정에 등록해야 한다. 파일을 그대로 복사한 뒤 끝내지 말고, Nuxt 빌드 산출 CSS에서
`.studio-page`, `.community-page` 같은 대표 선택자가 `.ai-lounge-scope` 아래로 컴파일됐는지 확인한다.

AI Lounge CSS 진입 파일을 `assets/ai-lounge/index.css`로 만든다면 Portal 공통 CSS보다 뒤에 로드한다.

```ts
// nuxt.config.ts
css: [
  "~/assets/style-product/main.scss",
  "~/assets/style-product/css/common.css",
  "~/assets/style-product/css/style.css",
  "~/assets/style-product/css/dev.css",
  "vue-final-modal/style.css",
  "~/assets/ai-lounge/index.css"
]
```

`index.css` 내부 순서는 `tokens.css`, `isolation.css`, 공통 `styles.css`, 기능별 CSS 순으로 유지한다.

주의할 전역 요소:

- `@font-face`: `AILoungeNotoSans` 이름 유지
- `@keyframes`: `ai-lounge-*` 접두사 유지
- body 스크롤 잠금: `body.ai-lounge-modal-open`과 `bodyScrollLock.js` 사용
- Teleport: Popup Root에도 `.ai-lounge-scope ai-lounge-overlay` 유지
- CSS 변수: `.ai-lounge-scope` 내부에서 선언

## 10. Portal `min-width` 임시 예외

현재 Portal `layouts/user.vue`에는 AI Lounge 경로에서만 다음 고정 폭을 완화하는 임시 코드가 있다.

- `.wrapper`: `1600px` -> `320px`
- 최상단 `.header-sub`: `1600px` -> `320px`
- `.sub-menu-wrap`: `1520px` -> 현재 viewport 기준

현재 판별 조건은 `/studio`, `/community` 경로 또는 `route.meta.aiLounge`다. 최종 Portal 레이아웃이나
경로가 변경되면 이 코드를 그대로 복사하지 말고 실제 DOM과 메뉴 경로에 맞게 다시 작성한다.

기존 Portal 페이지에는 해당 예외가 적용되면 안 된다. 통합 후 데이터 검색, 관리자, 지원 페이지의
1600px 레이아웃이 유지되는지 회귀 확인한다.

## 11. 상태 관리

- 사용자·인증·현재 메뉴와 메뉴 접근 권한은 Portal Store 및 Portal Backend를 단일 기준으로 사용한다.
- AI Lounge Store에는 Portal 사용자 정보의 복사본이나 별도 로그인 상태를 영구 저장하지 않는다.
- AI Lounge API 요청은 Portal 사용자 컨텍스트를 사용하며, 응답 데이터는 검증된 Portal `user_id`를 기준으로 조회한다.
- AI Lounge 도메인 상태만 별도 Pinia Store로 유지한다.
- 페이지 전환 후에도 유지되어야 하는 상태와 팝업 내부 임시 상태를 구분한다.
- 독립 앱의 Local Storage 인증 데이터는 최종 통합 후 사용하지 않는다.
- Portal SSR 실행 시 `window`, `document`, `localStorage` 직접 접근은 `onMounted` 또는 브라우저 유틸을 사용한다.

## 12. 검증 체크리스트

### 빌드

```bash
source "$HOME/.nvm/nvm.sh"
nvm use 24
npm ci
npm run build:dev
```

- Nuxt Client 및 SSR 빌드가 모두 성공해야 한다.
- `frontend_vue`의 독립 `npm run build`도 통합 완료 전까지 유지 검증한다.
- CKEditor의 기존 CSS 경고와 AI Lounge 통합 오류를 구분한다.

### 기능

- Portal 로그인 후 별도 AI Lounge 로그인 없이 진입 가능
- Portal 메뉴 DB와 역할별 권한에 따라 AI STUDIO 및 AX COMMUNITY 메뉴 노출이 달라짐
- Portal 사용자 ID를 기준으로 본인의 게시글, 아이디어, 자산, 댓글, 즐겨찾기가 정확히 조회됨
- 다른 사용자의 `user_id`를 요청에 넣어도 소유 데이터 수정·삭제 권한을 획득할 수 없음
- 일반 사용자와 관리자 메뉴/권한 분리
- 직접 URL 접근 및 새로고침 정상 동작
- 모든 목록, 작성, 수정, 삭제, 첨부, 다운로드 API 정상 동작
- 장시간 LLM 요청 및 Skill 생성 진행 상태 정상 동작
- 모달을 중첩해서 열고 닫아도 body 스크롤이 정상 복구됨
- 자산 상세 Drawer, 이미지 원본 Popup, 뉴스/아이디어 Popup 정상 동작

### UI 회귀

- Portal Header, GNB, Breadcrumb, Footer 중복 없음
- AI Lounge Typography와 Portal Typography가 서로 변경되지 않음
- Portal의 `img { width:100% }`, `body *`, form reset이 AI Lounge를 깨지 않음
- AI Lounge CSS가 기존 Portal 페이지에 적용되지 않음
- 320px, 768px, 1280px, 1600px 이상에서 수평 넘침과 텍스트 겹침 확인
- Teleport 팝업이 Portal Header 뒤에 가려지지 않음

## 13. 완료 기준

다음 조건을 모두 충족해야 통합이 완료된 것으로 본다.

1. AI Lounge의 모든 라우트, 메뉴 노출과 역할별 접근 권한이 Nuxt Router 및 Portal 메뉴 DB에서 관리된다.
2. Portal 인증 사용자만으로 AI Lounge Backend 권한 검증과 사용자별 도메인 데이터 조회가 가능하다.
3. 독립 로그인, 독립 Router, 독립 Header/Footer가 제거됐다.
4. `/ai-lounge-api` 운영 Proxy가 구성됐다.
5. CSS Scope 및 Popup Scope 검증이 완료됐다.
6. 기존 Portal 주요 페이지와 AI Lounge 전체 기능의 회귀 테스트를 통과했다.
