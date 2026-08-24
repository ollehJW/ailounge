export const NAV_SECTIONS = [
  {
    id: "studio",
    label: "AI STUDIO",
    home: "/aistudio",
    heading: "검증된 AI를 실행력으로",
    description: "과제를 발굴하고 완성된 AI 자산을 등록·탐색·확산합니다.",
    items: [
      { to: "/aistudio", eyebrow: "OVERVIEW", label: "소개", description: "AI STUDIO의 역할과 운영 현황" },
      { to: "/aistudio/dx-discovery", eyebrow: "DEFINE", label: "DX 과제 발굴", description: "Agent와 대화하며 업무 과제 구체화" },
      { to: "/aistudio/assets", eyebrow: "REUSE", label: "AI 자산 라이브러리", description: "검증된 자산 탐색과 현업 확산" },
      { to: "/aistudio/assets/register", eyebrow: "SHARE", label: "AI 자산 등록", description: "완성 자산 등록과 확산 패키지 생성" },
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
  {
    id: "connected",
    label: "연계 서비스",
    home: "/connected/calendar",
    heading: "업무 효율 WIA 서비스",
    description: "AI 일정과 업무 자동화 서비스를 한 곳에서 빠르게 이용합니다.",
    items: [
      { to: "/connected/calendar", eyebrow: "CALENDAR", label: "AI Calendar", description: "AI 학회·세미나 및 주요 일정을 한눈에 확인" },
      { href: "http://10.217.183.72:9602/", eyebrow: "REPORT", label: "WIA Report", description: "업무 보고서를 자동 작성하고 작성 이력을 관리하는 플랫폼", external: true },
      { href: "https://10.217.183.72:9702/", eyebrow: "MEETING", label: "WIA Meet", description: "AI로 회의록을 자동 작성하고 회의 이력을 관리하는 플랫폼", external: true },
    ],
  },
  {
    id: "administration",
    label: "MANAGEMENT",
    home: "/administration/ideas",
    heading: "AI 서비스 운영 관리",
    description: "아이디어와 AI 자산을 심사하고 Tech News 콘텐츠를 관리합니다.",
    items: [
      { to: "/administration/ideas", eyebrow: "REVIEW", label: "Idea 심사", description: "접수된 AI 아이디어 검토와 결과 관리" },
      { to: "/administration/assets", eyebrow: "ASSET", label: "AI 자산 관리", description: "자산 등록 심사와 운영 상태 관리" },
      { to: "/administration/tech-news", eyebrow: "CONTENT", label: "Tech News 관리", description: "Tech News 작성, 수정과 게시물 관리" },
    ],
  },
];
