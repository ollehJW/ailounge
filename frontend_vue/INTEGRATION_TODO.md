# Portal 통합 To-Do

- AI Lounge를 Portal 레이아웃 안에서 렌더링할 때 `VITE_LAYOUT_MODE=embedded`를 사용한다.
- 독립 번들을 Portal 하위 경로에 임시 마운트한다면 `VITE_ROUTER_BASE`와 `VITE_APP_BASE`를 해당 경로로 맞춘다.
- 독립 로그인 상태를 인증된 Portal 사용자 컨텍스트로 교체한다.
- AI Lounge 라우트 정의를 Portal Nuxt Router로 이관한다.
- Nuxt 라우트 이관이 끝나면 `vue-router`, `src/router/index.js`, 독립 Router Guard를 제거한다.
- 최종 Portal 경로와 레이아웃 구조가 확정되면 Portal의 경로별 `min-width` 예외를 다시 확인한다.
