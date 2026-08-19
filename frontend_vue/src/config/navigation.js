export const NAV_SECTIONS = [
  {
    id: "studio",
    label: "AI STUDIO",
    home: "/studio",
    heading: "검증된 AI를 실행력으로",
    description: "과제를 발굴하고 완성된 AI 자산을 등록·탐색·확산합니다.",
    items: [
      { to: "/studio", eyebrow: "OVERVIEW", label: "소개", description: "AI STUDIO의 역할과 운영 현황" },
      { to: "/studio/dx-discovery", eyebrow: "DEFINE", label: "DX 과제 발굴", description: "Agent와 대화하며 업무 과제 구체화" },
      { to: "/studio/assets", eyebrow: "REUSE", label: "AI 자산 라이브러리", description: "검증된 자산 탐색과 현업 확산" },
      { to: "/studio/assets/register", eyebrow: "SHARE", label: "AI 자산 등록", description: "완성 자산 등록과 확산 패키지 생성" },
    ],
  },
  {
    id: "community",
    label: "AX COMMUNITY",
    home: "/community/tech-news",
    heading: "함께 나누는 AI 경험",
    description: "AI 소식과 업무 활용 경험, 새로운 아이디어를 공유합니다.",
    items: [
      { to: "/community/tech-news", eyebrow: "NEWS", label: "AI Tech News", description: "위아 소식과 외부 AI 동향, BP 사례" },
      { to: "/community/ai-usage", eyebrow: "PRACTICE", label: "나만의 AI 활용법", description: "업무에서 직접 시도한 경험과 교훈" },
      { to: "/community/ideas", eyebrow: "IDEA", label: "AI 아이디어 공모", description: "현장의 문제와 AI 적용 아이디어 제안" },
    ],
  },
];
