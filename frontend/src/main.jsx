import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Bold,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Database,
  Download,
  ExternalLink,
  Eye,
  FilePenLine,
  GitBranch,
  Home,
  Heart,
  Plus,
  Search,
  Sparkles,
  Star,
  Wand2,
  KeyRound,
  LogIn,
  LogOut,
  Layers3,
  Mail,
  MessageCircle,
  Newspaper,
  NotebookPen,
  Send,
  Pencil,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Underline,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const emptyAccountForm = {
  login_id: '',
  email: '',
  org_name: '',
  displayed_name: '',
  job_title: '',
  password: '',
  is_admin: false,
};

const navGroups = [
  {
    id: 'data-studio',
    label: 'DATA STUDIO',
    status: '11월 OPEN',
    icon: BarChart3,
    defaultPage: 'data-explore',
    disabled: true,
    items: [],
  },
  {
    id: 'ai-studio',
    label: 'AI STUDIO',
    icon: Bot,
    defaultPage: 'intro',
    items: [
      { id: 'intro', label: '소개' },
      { id: 'dx-discovery', label: 'DX 과제 발굴' },
      { id: 'explore', label: 'AI 자산 탐색' },
      { id: 'registry', label: 'AI 자산 등록' },
    ],
  },
  {
    id: 'code-studio',
    label: 'CODE STUDIO',
    status: '2027 OPEN',
    icon: Code2,
    defaultPage: 'code-intro',
    disabled: true,
    items: [],
  },
  {
    id: 'ax-community',
    label: 'AX COMMUNITY',
    icon: Newspaper,
    defaultPage: 'tech-news',
    items: [
      { id: 'tech-news', label: 'AI Tech News' },
      { id: 'ai-blog', label: '나만의 AI 활용법' },
      { id: 'gen-ai-proposal', label: 'AI 아이디어 공모' },
    ],
  },
];

const externalLinks = [
  { label: 'WIA Report', href: 'http://10.217.183.72:9602/', icon: FilePenLine },
  { label: 'WIA Meet', href: 'https://10.217.183.72:9702/', icon: NotebookPen },
];

const emptyAiIdeaForm = {
  title: '',
  problem_definition: '',
  proposal: '',
  effect: '',
  attachments: [],
};

const aiIdeaStatusClass = {
  '접수완료': 'received',
  '선정': 'selected',
  '미선정': 'rejected',
};

const assetApprovalStatusMeta = {
  submitted: { label: '제출 완료', className: 'submitted' },
  approved: { label: '승인', className: 'approved' },
  rejected: { label: '반려', className: 'rejected' },
};


const dxInitialMessages = [
  { role: 'agent', text: '어떤 업무가 가장 힘드신가요? 편하게 이야기해주시면, 대화를 통해 과제를 구체화하고 과제 정의서와 참고할 Data·AI 자산까지 정리해드릴게요.' },
];

const dxTaskDefinition = {
  title: '과제 발굴 중...',
  process: '업무 영역 미정',
  description: 'Agent가 대화를 통해 내용을 채우는 영역입니다.',
};

const assetBusinessAreas = ['생산·제조', '품질', 'R&D·설계', 'SCM·구매·물류', '영업·마케팅', '경영지원', '안전·환경·보건', 'IT·DX', '공통'];
const assetDataTypes = ['테이블·정형데이터', '시계열 데이터', '센서·IoT 데이터', '문서·텍스트', '이미지', '영상', '음성', '로그', 'CAD·도면', '코드', '웹·외부 데이터', '복합 데이터'];
const assetMaturityLevels = ['아이디어', 'PoC', 'Pilot', '운영'];
const assetTaskTypes = ['예측', '탐지', '분류', '검색', '질의응답', '요약', '생성', '추출', '추천', '분석', '최적화', '자동화'];
const assetImplementationTypes = ['ML', 'DL', 'Computer Vision', 'LLM', 'RAG', 'Agent', 'Rule-Based', 'Hybrid'];
const createAssetTechItem = (overrides = {}) => ({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, ...overrides });
const createAssetImageItem = (overrides = {}) => ({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, fileName: '', previewUrl: '', file: null, caption: '', description: '', ...overrides });
const assetRegistrySteps = [
  ['자산 명세서 작성', '담당자 정보, 자산 개요, 과제 정의, 데이터, 기술·성능 지표를 작성합니다.'],
  ['자산 연동', 'GitHub/GitLab 저장소를 연결해 실제 코드·데이터 구조를 확인합니다.'],
  ['확산 패키지 생성', 'LLM이 저장소를 분석해 Claude Skill 파일을 자동 생성합니다.'],
  ['최종 제출 및 승인', '필독 사항 동의 후 제출하면 거버넌스 검토를 거쳐 카탈로그에 공개됩니다.'],
];

const assetGuideExamples = {
  problem: '예: 8개 생산 라인의 불량 데이터를 매주 취합하지만, 라인별 MES 다운로드 포맷과 불량 유형 코드가 달라 담당자가 직접 정리합니다. 동일한 불량도 담당자마다 다르게 분류되어 재확인이 반복되고, 임원 보고서 작성에 매주 3~4시간이 소요됩니다.',
  asIs: '예: 매주 월요일 담당자가 MES에서 라인별 불량 데이터를 엑셀로 내려받습니다. 이후 피벗테이블로 라인별·유형별 현황을 만들고, 전주 대비 증감 그래프와 보고 코멘트를 수작업으로 PPT에 옮깁니다.',
  toBe: '예: MES 데이터를 업로드하면 표준 컬럼으로 자동 정리되고, 공정별 불량 코드가 표준 불량 유형으로 자동 매핑됩니다. 집계표와 증감 그래프가 자동 생성되며, 주요 증감 원인과 보고 코멘트 초안을 AI가 작성합니다.',
  effect: '예: 보고서 작성 시간을 주당 3~4시간에서 1시간 이내로 단축합니다. 불량 유형 분류 기준을 표준화해 재확인 시간을 줄이고, 담당자가 단순 취합보다 원인 분석과 개선 활동에 집중할 수 있게 합니다.',
  data: '예: MES 불량 이력 데이터와 불량 유형 매핑 기준표를 사용합니다. MES 데이터는 라인명, 발생일시, 품번, 공정명, 불량 유형 코드, 불량 내용 메모, 조치 결과 컬럼을 포함하며, 기준표는 공정별 코드와 표준 불량 유형의 매핑 정보를 담습니다.',
};

const formatSkillFileSize = (content = '') => {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const buildSkillFileTree = (files) => {
  const root = { type: 'directory', name: 'root', children: [] };
  files.forEach((file) => {
    const parts = file.path.split('/').filter(Boolean);
    let current = root;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      let node = current.children.find((child) => child.name === part && child.type === (isFile ? 'file' : 'directory'));
      if (!node) {
        node = isFile
          ? { type: 'file', name: part, path: file.path, content: file.content, size: formatSkillFileSize(file.content) }
          : { type: 'directory', name: part, children: [] };
        current.children.push(node);
      }
      current = node;
    });
  });

  const sortNodes = (nodes) => nodes
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((node) => (node.type === 'directory' ? { ...node, children: sortNodes(node.children) } : node));

  return sortNodes(root.children);
};

const getSkillFileIcon = (name) => {
  if (name === 'CLAUDE.md' || name === 'SKILL.md' || name.endsWith('.md')) return '📄';
  if (name.endsWith('.mjs') || name.endsWith('.js')) return '🟢';
  if (name.endsWith('.py')) return '🐍';
  return '📄';
};


const emptyAiUsageForm = {
  title: '',
  category: '확산 사례',
  content: '',
};

const aiUsageCategoryClass = {
  '확산 사례': 'spread',
  '실패·교훈': 'lesson',
  'Tip 공유': 'tip',
};

const aiUsageCategoryOptions = ['전체', '확산 사례', '실패·교훈', 'Tip 공유'];
const aiUsageTextColors = [
  ['#243047', '기본색'],
  ['#062983', '파란색'],
  ['#d12435', '빨간색'],
  ['#168a53', '초록색'],
  ['#7c3aed', '보라색'],
  ['#c26a00', '주황색'],
];

const stripHtml = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const formatViewCount = (value) => Number(value || 0).toLocaleString('ko-KR');
const formatDate = (value) => (value ? String(value).slice(0, 10) : '');
const formatAssetFileSize = (value) => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};
const formatDxSessionDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const dxMessagesFromApi = (messages = []) => messages.map((message) => ({ role: message.role, text: message.content }));
const ideaAttachmentName = (attachment) => (typeof attachment === 'string' ? attachment : attachment.original_name);
const aiUsageAuthor = (post) => [post?.author_org, post?.author_name, post?.author_job_title].filter(Boolean).join(' ') || 'AI Lounge';
const ideaAuthor = (idea) => [idea?.author_org, idea?.author_name, idea?.author_job_title].filter(Boolean).join(' ') || '작성자 정보 없음';
const dxFieldLabels = [
  ['business_area', '업무 영역'],
  ['target_work', '적용 업무'],
  ['current_process', '현재 업무 방식'],
  ['pain_points', 'Pain Points'],
  ['problem_scale', '문제 발생 규모'],
  ['solution_direction', '해결 방향'],
  ['required_data', '필요 데이터'],
  ['quantitative_effect', '기대 정량 효과'],
  ['qualitative_effect', '기대 정성 효과'],
  ['beneficiaries', '수혜 대상'],
];
const dxBulletFieldKeys = new Set(['pain_points', 'quantitative_effect', 'qualitative_effect', 'beneficiaries']);

const renderDxFieldValue = (key, value) => {
  if (key === 'required_data' && Array.isArray(value)) {
    if (!value.length) return <p>Agent가 대화를 통해 내용을 채우는 영역입니다.</p>;
    return (
      <div className="dx-data-list">
        {value.map((item, index) => {
          const dataName = typeof item === 'object' && item ? item.data_name : item;
          const description = typeof item === 'object' && item ? item.description : '';
          return (
            <div className="dx-data-item" key={`required-data-${index}`}>
              <strong>{dataName || '데이터명 미정'}</strong>
              {description && <p>{description}</p>}
            </div>
          );
        })}
      </div>
    );
  }
  if (Array.isArray(value)) {
    if (!value.length) return <p>Agent가 대화를 통해 내용을 채우는 영역입니다.</p>;
    return (
      <ul className="dx-template-bullets">
        {value.map((item, index) => (
          <li key={`${key}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }
  if (dxBulletFieldKeys.has(key) && value) {
    return (
      <ul className="dx-template-bullets">
        <li>{value}</li>
      </ul>
    );
  }
  return <p>{value || 'Agent가 대화를 통해 내용을 채우는 영역입니다.'}</p>;
};

const normalizeDxList = (value) => {
  if (Array.isArray(value)) return value.filter((item) => String(item || '').trim());
  if (!value) return [];
  return String(value).split(/[,/·]/).map((item) => item.trim()).filter(Boolean);
};

const normalizeDxRequiredData = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'object' && item) {
      return { data_name: item.data_name || item.name || '데이터명 미정', description: item.description || item.desc || '' };
    }
    return { data_name: String(item), description: '' };
  }).filter((item) => item.data_name || item.description);
};

const resolveDxDocFields = (fields) => {
  const source = fields || {};
  return {
    project_title: source.project_title || dxTaskDefinition.title,
    business_area: source.business_area || dxTaskDefinition.process,
    target_work: source.target_work || dxTaskDefinition.description,
    current_process: source.current_process || 'Agent가 대화를 통해 내용을 채우는 영역입니다.',
    pain_points: normalizeDxList(source.pain_points),
    problem_scale: source.problem_scale || 'Agent가 대화를 통해 내용을 채우는 영역입니다.',
    solution_direction: source.solution_direction || 'Agent가 대화를 통해 내용을 채우는 영역입니다.',
    required_data: normalizeDxRequiredData(source.required_data),
    quantitative_effect: normalizeDxList(source.quantitative_effect),
    qualitative_effect: normalizeDxList(source.qualitative_effect),
    beneficiaries: normalizeDxList(source.beneficiaries),
  };
};

const escapeDxHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '\"': '&quot;',
}[char]));

const dxFileSafeName = (value) => String(value || '과제정의서')
  .replace(/[\\/:*?"<>|]/g, '_')
  .replace(/\s+/g, '_')
  .slice(0, 80);

const buildDxDefinitionHtml = (d) => {
  const listItems = (items) => items.map((item) => `<li>${escapeDxHtml(item)}</li>`).join('');
  const dataRows = (d.required_data.length ? d.required_data : [{ data_name: '데이터명 미정', description: '' }])
    .map((item) => `<div class="datarow"><div class="dataname">${escapeDxHtml(item.data_name)}</div><div class="datadesc">${escapeDxHtml(item.description)}</div></div>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeDxHtml(d.project_title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--paper:#F5F6F3;--panel:#FFFFFF;--line:#DCE0DD;--line-strong:#B9C0BB;--ink:#16233A;--ink-soft:#51617A;--steel:#5C7A96;--amber:#C97D00;--red:#B5432F;--green:#2F7D52;}*{box-sizing:border-box;margin:0;padding:0;}body{background:linear-gradient(var(--line) 1px,transparent 1px) 0 0/100% 32px,linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/32px 100%,var(--paper);font-family:'IBM Plex Sans KR',sans-serif;color:var(--ink);padding:48px 20px 80px;line-height:1.6;}.sheet{max-width:920px;margin:0 auto;background:var(--panel);border:1px solid var(--line-strong);box-shadow:0 1px 0 var(--line-strong),0 24px 60px -30px rgba(22,35,58,.25);}.titleblock{padding:28px 40px 24px;border-bottom:2px solid var(--ink);}h1.taskname{font-size:clamp(26px,4vw,36px);font-weight:700;line-height:1.3;margin-bottom:18px;}.business-line{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}.business-label{display:inline-flex;align-items:center;gap:7px;border:1px solid #e6b75f;background:#fff8e8;color:#a86b00;padding:7px 10px;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:800;letter-spacing:.12em;line-height:1;white-space:nowrap;}.business-label:before{content:'';width:6px;height:6px;background:#c97d00;transform:rotate(45deg);}.business-line strong{font-size:15px;font-weight:700;}.section{padding:26px 40px;border-bottom:1px solid var(--line);}.section:last-child{border-bottom:none;}.sec-head{display:flex;align-items:baseline;gap:10px;margin-bottom:16px;}.sec-num{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--amber);font-weight:600;}.sec-title{font-size:17px;font-weight:600;}.sec-body{font-size:15px;color:var(--ink-soft);white-space:pre-wrap;}.grid2{display:grid;grid-template-columns:1fr 1fr;}.grid2 .section{border-bottom:none;}.grid2 .section:first-child{border-right:1px solid var(--line);}.painlist{list-style:none;display:flex;flex-direction:column;gap:10px;}.painlist li{display:flex;gap:10px;align-items:flex-start;font-size:14.5px;color:var(--ink-soft);}.painlist li:before{content:'';flex:none;width:8px;height:8px;margin-top:6px;background:var(--red);border-radius:1px;}.efflist li:before{background:var(--green);}.datatable{border:1px solid var(--line-strong);}.datarow{display:flex;border-bottom:1px solid var(--line);}.datarow:last-child{border-bottom:none;}.dataname{flex:0 0 168px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:600;background:#EDF2F6;color:var(--ink);padding:12px 14px;display:flex;align-items:center;}.datadesc{flex:1;font-size:14px;color:var(--ink-soft);padding:12px 16px;display:flex;align-items:center;background:var(--panel);}.cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}.card{border:1px solid var(--line-strong);padding:16px;background:var(--paper);font-size:13.5px;color:var(--ink-soft);line-height:1.55;}.card:before{content:'＋ ';color:var(--green);font-weight:600;}.benefrow{display:flex;flex-wrap:wrap;gap:10px;}.benef{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink);border:1px solid var(--line-strong);padding:8px 12px;background:var(--panel);}.benef .dot{width:7px;height:7px;background:var(--steel);border-radius:50%;}@media(max-width:680px){.grid2,.cards3{grid-template-columns:1fr;}.grid2 .section:first-child{border-right:none;border-bottom:1px solid var(--line);}.titleblock,.section{padding-left:24px;padding-right:24px;}.datarow{flex-direction:column;}.dataname{flex:none;}}
</style>
</head>
<body>
<div class="sheet">
<div class="titleblock"><h1 class="taskname">${escapeDxHtml(d.project_title)}</h1><div class="business-line"><span class="business-label">업무 영역</span><strong>${escapeDxHtml(d.business_area)}</strong></div></div>
<div class="section"><div class="sec-head"><span class="sec-num">SEC.01</span><span class="sec-title">적용 업무</span></div><p class="sec-body">${escapeDxHtml(d.target_work)}</p></div>
<div class="grid2"><div class="section"><div class="sec-head"><span class="sec-num">SEC.02</span><span class="sec-title">현재 업무 방식</span></div><p class="sec-body">${escapeDxHtml(d.current_process)}</p></div><div class="section"><div class="sec-head"><span class="sec-num">SEC.03</span><span class="sec-title">Pain Points</span></div><ul class="painlist">${listItems(d.pain_points)}</ul></div></div>
<div class="section"><div class="sec-head"><span class="sec-num">SEC.04</span><span class="sec-title">문제 발생 규모</span></div><p class="sec-body">${escapeDxHtml(d.problem_scale)}</p></div>
<div class="section"><div class="sec-head"><span class="sec-num">SEC.05</span><span class="sec-title">해결 방향</span></div><p class="sec-body">${escapeDxHtml(d.solution_direction)}</p></div>
<div class="section"><div class="sec-head"><span class="sec-num">SEC.06</span><span class="sec-title">필요 데이터</span></div><div class="datatable">${dataRows}</div></div>
<div class="section"><div class="sec-head"><span class="sec-num">SEC.07</span><span class="sec-title">기대 정량 효과</span></div><ul class="painlist efflist">${listItems(d.quantitative_effect)}</ul></div>
<div class="section"><div class="sec-head"><span class="sec-num">SEC.08</span><span class="sec-title">기대 정성 효과</span></div><div class="cards3">${d.qualitative_effect.map((item) => `<div class="card">${escapeDxHtml(item)}</div>`).join('')}</div></div>
<div class="section"><div class="sec-head"><span class="sec-num">SEC.09</span><span class="sec-title">수혜 대상</span></div><div class="benefrow">${d.beneficiaries.map((item) => `<div class="benef"><span class="dot"></span>${escapeDxHtml(item)}</div>`).join('')}</div></div>
</div>
</body>
</html>`;
};


const withApiAssetUrls = (html = '') => html.replace(/src="\/api\//g, `src="${API_BASE}/api/`);

const previewText = (html, limit = 50) => {
  const text = stripHtml(html);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}....`;
};

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('클립보드 복사를 지원하지 않는 브라우저입니다.');
};

const emptyDiffusionCaseForm = {
  title: '',
  stage: '',
  applied_work: '',
  customization: '',
  effect: '',
  git_url: '',
};

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem('ailounge_token') || '');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(authToken));
  const [activePage, setActivePage] = useState('home');
  const [openGroups, setOpenGroups] = useState(() => new Set(navGroups.map((group) => group.id)));
  const [assetRegistryStep, setAssetRegistryStep] = useState(0);
  const [isAssetRegistrySubmitted, setIsAssetRegistrySubmitted] = useState(false);
  const [isAssetNoData, setIsAssetNoData] = useState(false);
  const [selectedAssetTasks, setSelectedAssetTasks] = useState([]);
  const [selectedAssetImplementations, setSelectedAssetImplementations] = useState([]);
  const [assetModelItems, setAssetModelItems] = useState(() => [createAssetTechItem()]);
  const [assetStackItems, setAssetStackItems] = useState(() => [createAssetTechItem()]);
  const [assetBeforeAfterItems, setAssetBeforeAfterItems] = useState(() => [createAssetTechItem()]);
  const [assetKpiItems, setAssetKpiItems] = useState(() => [createAssetTechItem()]);
  const [assetImageItems, setAssetImageItems] = useState(() => [createAssetImageItem()]);
  const [assetTrainFiles, setAssetTrainFiles] = useState([]);
  const [assetValidationFiles, setAssetValidationFiles] = useState([]);
  const [assetSampleFiles, setAssetSampleFiles] = useState([]);
  const [hasAssetTrainValidationSplit, setHasAssetTrainValidationSplit] = useState(false);
  const [skillGenerationStatus, setSkillGenerationStatus] = useState('idle');
  const [myAiAssets, setMyAiAssets] = useState([]);
  const [isLoadingMyAiAssets, setIsLoadingMyAiAssets] = useState(false);
  const [myAiAssetsError, setMyAiAssetsError] = useState("");
  const [assetFeedbackTarget, setAssetFeedbackTarget] = useState(null);
  const [adminAssets, setAdminAssets] = useState([]);
  const [isLoadingAdminAssets, setIsLoadingAdminAssets] = useState(false);
  const [adminAssetsError, setAdminAssetsError] = useState("");
  const [adminAssetTab, setAdminAssetTab] = useState("requests");
  const [adminAssetQuery, setAdminAssetQuery] = useState("");
  const [assetReviewTarget, setAssetReviewTarget] = useState(null);
  const [assetReviewForm, setAssetReviewForm] = useState({ status: "", comment: "" });
  const [isReviewingAsset, setIsReviewingAsset] = useState(false);
  const [assetActivationId, setAssetActivationId] = useState("");
  const [assetDeleteTarget, setAssetDeleteTarget] = useState(null);
  const [isDeletingAsset, setIsDeletingAsset] = useState(false);
  const [isAssetDocumentOpen, setIsAssetDocumentOpen] = useState(false);
  const [assetDocumentHtml, setAssetDocumentHtml] = useState("");
  const [assetDocumentTitle, setAssetDocumentTitle] = useState("");
  const [assetDocumentError, setAssetDocumentError] = useState("");
  const [assetDocumentLoadingId, setAssetDocumentLoadingId] = useState("");
  const [isSkillProgressOpen, setIsSkillProgressOpen] = useState(false);
  const [skillGenerationPhase, setSkillGenerationPhase] = useState('idle');
  const [skillGenerationStepIndex, setSkillGenerationStepIndex] = useState(0);
  const [assetSkillPlan, setAssetSkillPlan] = useState(null);
  const [skillGenerationError, setSkillGenerationError] = useState('');
  const [selectedSkillSlugs, setSelectedSkillSlugs] = useState([]);
  const [generatedAssetSkillFiles, setGeneratedAssetSkillFiles] = useState([]);
  const [selectedSkillFilePath, setSelectedSkillFilePath] = useState('');
  const [assetSubmitAgreements, setAssetSubmitAgreements] = useState({ share: false, factual: false, security: false });
  const [isSubmittingAsset, setIsSubmittingAsset] = useState(false);
  const [assetSubmitError, setAssetSubmitError] = useState('');
  const [assetDraft, setAssetDraft] = useState({});
  const [assetDraftId, setAssetDraftId] = useState('');
  const [assetRepoTree, setAssetRepoTree] = useState([]);
  const [isCloningAssetRepo, setIsCloningAssetRepo] = useState(false);
  const [isStagingAssetSpec, setIsStagingAssetSpec] = useState(false);
  const [assetRepoErrorMessage, setAssetRepoErrorMessage] = useState('');
  const [isAssetSampleLoaded, setIsAssetSampleLoaded] = useState(false);
  const [isAssetSpecReady, setIsAssetSpecReady] = useState(false);
  const [assetSpecSectionStatus, setAssetSpecSectionStatus] = useState({});
  const [assetSampleVersion, setAssetSampleVersion] = useState(0);
  const [openAssetGuides, setOpenAssetGuides] = useState({});
  const [assetTagInput, setAssetTagInput] = useState('');
  const [assetTags, setAssetTags] = useState([]);
  const [assetCatalog, setAssetCatalog] = useState([]);
  const [introSummary, setIntroSummary] = useState(null);
  const [isLoadingIntroSummary, setIsLoadingIntroSummary] = useState(false);
  const [introSummaryError, setIntroSummaryError] = useState('');
  const [isLoadingAssetCatalog, setIsLoadingAssetCatalog] = useState(false);
  const [assetCatalogError, setAssetCatalogError] = useState('');
  const [assetCatalogQuery, setAssetCatalogQuery] = useState('');
  const [assetCatalogSort, setAssetCatalogSort] = useState('popular');
  const [assetCatalogFilters, setAssetCatalogFilters] = useState({});
  const [assetRecommendationQuery, setAssetRecommendationQuery] = useState('');
  const [assetRecommendations, setAssetRecommendations] = useState([]);
  const [isRecommendingAssets, setIsRecommendingAssets] = useState(false);
  const [assetRecommendationError, setAssetRecommendationError] = useState('');
  const [hasAssetRecommendationRun, setHasAssetRecommendationRun] = useState(false);
  const [assetBookmarks, setAssetBookmarks] = useState(() => new Set());
  const [selectedCatalogAsset, setSelectedCatalogAsset] = useState(null);
  const [selectedCatalogTab, setSelectedCatalogTab] = useState('overview');
  const [isLoadingCatalogDetail, setIsLoadingCatalogDetail] = useState(false);
  const [catalogDetailError, setCatalogDetailError] = useState('');
  const [catalogSlideIndex, setCatalogSlideIndex] = useState(0);
  const [isCatalogRepoCopied, setIsCatalogRepoCopied] = useState(false);
  const [assetDiffusionCases, setAssetDiffusionCases] = useState({});
  const [isDiffusionCaseFormOpen, setIsDiffusionCaseFormOpen] = useState(false);
  const [diffusionCaseForm, setDiffusionCaseForm] = useState(emptyDiffusionCaseForm);
  const [diffusionCaseError, setDiffusionCaseError] = useState('');
  const [isLoadingDiffusionCases, setIsLoadingDiffusionCases] = useState(false);
  const [isSavingDiffusionCase, setIsSavingDiffusionCase] = useState(false);
  const [editingDiffusionCaseId, setEditingDiffusionCaseId] = useState('');
  const [deletingDiffusionCaseId, setDeletingDiffusionCaseId] = useState('');
  const [assetQaThreads, setAssetQaThreads] = useState({});
  const [assetQaDraft, setAssetQaDraft] = useState('');
  const [assetQaReplyTarget, setAssetQaReplyTarget] = useState('');
  const [assetQaReplyDraft, setAssetQaReplyDraft] = useState('');
  const [assetQaError, setAssetQaError] = useState('');
  const [isLoadingAssetQa, setIsLoadingAssetQa] = useState(false);
  const [isSavingAssetQa, setIsSavingAssetQa] = useState(false);
  const [editingAssetQaQuestionId, setEditingAssetQaQuestionId] = useState('');
  const [assetQaQuestionEditDraft, setAssetQaQuestionEditDraft] = useState('');
  const [deletingAssetQaQuestionId, setDeletingAssetQaQuestionId] = useState('');
  const [editingAssetQaReplyId, setEditingAssetQaReplyId] = useState('');
  const [assetQaEditDraft, setAssetQaEditDraft] = useState('');
  const [deletingAssetQaReplyId, setDeletingAssetQaReplyId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [editingUserId, setEditingUserId] = useState('');
  const [accountError, setAccountError] = useState('');
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [orgFilter, setOrgFilter] = useState('all');
  const [newsList, setNewsList] = useState([]);
  const [selectedNewsId, setSelectedNewsId] = useState('');
  const [selectedNews, setSelectedNews] = useState(null);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsMarkdown, setNewsMarkdown] = useState('');
  const [newsSource, setNewsSource] = useState('');
  const [newsCover, setNewsCover] = useState(null);
  const [isPublishingNews, setIsPublishingNews] = useState(false);
  const [isDraftingNews, setIsDraftingNews] = useState(false);
  const [newsAdminTab, setNewsAdminTab] = useState('write');
  const [editingNewsId, setEditingNewsId] = useState('');
  const [dxMessages, setDxMessages] = useState(dxInitialMessages);
  const [dxSessions, setDxSessions] = useState([]);
  const [activeDxSessionId, setActiveDxSessionId] = useState('');
  const [dxInput, setDxInput] = useState('');
  const [isDxTyping, setIsDxTyping] = useState(false);
  const [isLoadingDxSessions, setIsLoadingDxSessions] = useState(false);
  const [dxError, setDxError] = useState('');
  const [dxDefinitionFields, setDxDefinitionFields] = useState(null);
  const [dxRecommendedDataIds, setDxRecommendedDataIds] = useState([]);
  const [dxRecommendedAssetIds, setDxRecommendedAssetIds] = useState([]);
  const [isDxResultVisible, setIsDxResultVisible] = useState(false);
  const [aiUsagePosts, setAiUsagePosts] = useState([]);
  const [aiIdeas, setAiIdeas] = useState([]);
  const [adminIdeas, setAdminIdeas] = useState([]);
  const [selectedAiIdea, setSelectedAiIdea] = useState(null);
  const [ideaToDelete, setIdeaToDelete] = useState(null);
  const [aiIdeaForm, setAiIdeaForm] = useState(emptyAiIdeaForm);
  const [aiIdeaMessage, setAiIdeaMessage] = useState('');
  const [isAiIdeaSuccessOpen, setIsAiIdeaSuccessOpen] = useState(false);
  const [aiIdeaError, setAiIdeaError] = useState('');
  const [isLoadingAiIdeas, setIsLoadingAiIdeas] = useState(false);
  const [isSubmittingAiIdea, setIsSubmittingAiIdea] = useState(false);
  const [isLoadingAdminIdeas, setIsLoadingAdminIdeas] = useState(false);
  const [adminIdeaError, setAdminIdeaError] = useState('');
  const [isUpdatingIdeaStatus, setIsUpdatingIdeaStatus] = useState(false);
  const [ideaReviewTarget, setIdeaReviewTarget] = useState(null);
  const [ideaReviewForm, setIdeaReviewForm] = useState({ status: '', comment: '' });
  const [aiUsageForm, setAiUsageForm] = useState(emptyAiUsageForm);
  const [aiUsageQuery, setAiUsageQuery] = useState('');
  const [aiUsageCategoryFilter, setAiUsageCategoryFilter] = useState('전체');
  const [aiUsageSort, setAiUsageSort] = useState('latest');
  const [isAiUsageComposerOpen, setIsAiUsageComposerOpen] = useState(false);
  const [isLoadingAiUsagePosts, setIsLoadingAiUsagePosts] = useState(false);
  const [aiUsageError, setAiUsageError] = useState('');
  const [isSavingAiUsagePost, setIsSavingAiUsagePost] = useState(false);
  const [editingAiUsagePostId, setEditingAiUsagePostId] = useState('');
  const [hotAiUsageIndex, setHotAiUsageIndex] = useState(0);
  const skillGenerationSteps = useMemo(() => {
    const candidates = assetSkillPlan?.candidates || [];
    return [
      { id: 'claude', label: 'CLAUDE.md 생성' },
      ...selectedSkillSlugs.map((slug) => {
        const candidate = candidates.find((item) => item.slug === slug);
        return { id: slug, label: `${candidate?.title || slug} 생성`, slug };
      }),
    ];
  }, [assetSkillPlan, selectedSkillSlugs]);
  const assetRegistryStepCompletion = [
    Boolean(assetDraftId || assetDraft.asset_id),
    assetRepoTree.length > 0,
    skillGenerationStatus === 'done',
    isAssetRegistrySubmitted,
  ];
  const assetRegistryMaxAccessibleStep = !assetRegistryStepCompletion[0] ? 0 : !assetRegistryStepCompletion[1] ? 1 : !assetRegistryStepCompletion[2] ? 2 : 3;
  const [selectedAiUsagePostId, setSelectedAiUsagePostId] = useState('');
  const [selectedAiUsagePost, setSelectedAiUsagePost] = useState(null);
  const [aiUsageEditorFormat, setAiUsageEditorFormat] = useState({ bold: false, underline: false, color: '#243047' });
  const [isAiUsageColorOpen, setIsAiUsageColorOpen] = useState(false);
  const dxReplyTimerRef = useRef(null);
  const aiUsageEditorRef = useRef(null);
  const aiUsageSelectionRef = useRef(null);
  const aiIdeaFileInputRef = useRef(null);
  const assetRegistryRef = useRef(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${authToken}` }), [authToken]);
  const isAdminView = Boolean(authUser?.is_admin);
  const adminPage = ['accounts', 'tech-news-write', 'idea-review', 'asset-management'].includes(activePage) ? activePage : 'accounts';
  const orgFilterOptions = useMemo(() => Array.from(new Set(accounts.map((account) => account.org_name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')), [accounts]);
  const filteredAccounts = useMemo(() => (orgFilter === 'all' ? accounts : accounts.filter((account) => account.org_name === orgFilter)), [accounts, orgFilter]);
  const hotAiUsagePosts = useMemo(() => [...aiUsagePosts].sort((a, b) => b.like_count - a.like_count || b.created_at.localeCompare(a.created_at)).slice(0, 3), [aiUsagePosts]);
  const hottestAiUsagePost = hotAiUsagePosts[hotAiUsageIndex] || hotAiUsagePosts[0] || null;
  const pendingReviewIdeas = useMemo(() => adminIdeas.filter((idea) => idea.status === '접수완료'), [adminIdeas]);
  const completedReviewIdeas = useMemo(() => adminIdeas.filter((idea) => ['선정', '미선정'].includes(idea.status)), [adminIdeas]);
  const pendingAdminAssets = useMemo(() => adminAssets.filter((asset) => asset.approval_status === "submitted"), [adminAssets]);
  const operatingAdminAssets = useMemo(() => adminAssets.filter((asset) => asset.approval_status === "approved"), [adminAssets]);
  const rejectedAdminAssets = useMemo(() => adminAssets.filter((asset) => asset.approval_status === "rejected"), [adminAssets]);
  const filteredOperatingAdminAssets = useMemo(() => {
    const query = adminAssetQuery.trim().toLocaleLowerCase("ko");
    if (!query) return operatingAdminAssets;
    return operatingAdminAssets.filter((asset) => asset.asset_name.toLocaleLowerCase("ko").includes(query));
  }, [operatingAdminAssets, adminAssetQuery]);

  const assetCatalogFilterGroups = [
    { key: 'business_area', label: '업무 영역', options: assetBusinessAreas },
    { key: 'task_types', label: 'Task 유형', options: assetTaskTypes },
    { key: 'implementation_types', label: '구현 방식', options: assetImplementationTypes },
    { key: 'data_type', label: 'Data 유형', options: assetDataTypes },
    { key: 'maturity_level', label: '자산 성숙도', options: assetMaturityLevels },
  ];
  const filteredAssetCatalog = useMemo(() => {
    const query = assetCatalogQuery.trim().toLocaleLowerCase('ko');
    const result = assetCatalog.filter((asset) => {
      const searchable = [asset.asset_name, asset.description, asset.business_area, asset.data_type, ...(asset.task_types || []), ...(asset.implementation_types || []), ...(asset.tags || [])].join(' ').toLocaleLowerCase('ko');
      if (query && !searchable.includes(query)) return false;
      return Object.entries(assetCatalogFilters).every(([key, selected]) => {
        if (!selected?.length) return true;
        const value = asset[key];
        return Array.isArray(value) ? value.some((item) => selected.includes(item)) : selected.includes(value);
      });
    });
    return [...result].sort((a, b) => assetCatalogSort === 'latest'
      ? String(b.updated_at).localeCompare(String(a.updated_at))
      : Number(b.diffusion_attempt_count || 0) - Number(a.diffusion_attempt_count || 0) || String(b.updated_at).localeCompare(String(a.updated_at)));
  }, [assetCatalog, assetCatalogQuery, assetCatalogFilters, assetCatalogSort]);
  const bookmarkedAssetCatalog = useMemo(() => assetCatalog.filter((asset) => assetBookmarks.has(asset.asset_id)), [assetCatalog, assetBookmarks]);
  const recommendedAssetCatalog = useMemo(() => assetRecommendations.map((recommendation) => {
    const asset = assetCatalog.find((item) => item.asset_id === recommendation.asset_id);
    return asset ? { ...asset, recommendation } : null;
  }).filter(Boolean), [assetCatalog, assetRecommendations]);
  const aiIdeaCompletedFieldCount = ['title', 'problem_definition', 'proposal', 'effect'].filter((field) => aiIdeaForm[field].trim()).length;
  const filteredAiUsagePosts = useMemo(() => {
    const query = aiUsageQuery.trim().toLowerCase();
    const filtered = aiUsagePosts.filter((post) => {
      const matchesCategory = aiUsageCategoryFilter === '전체' || post.category === aiUsageCategoryFilter;
      const matchesQuery = !query || [post.title, post.category, post.content_text, post.author_name, post.author_org, post.author_job_title].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
    return [...filtered].sort((a, b) => {
      if (aiUsageSort === 'popular') return b.like_count - a.like_count || b.created_at.localeCompare(a.created_at);
      return b.created_at.localeCompare(a.created_at) || b.like_count - a.like_count;
    });
  }, [aiUsagePosts, aiUsageQuery, aiUsageCategoryFilter, aiUsageSort]);

  useEffect(() => {
    if (!authToken) {
      setIsCheckingSession(false);
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('세션이 만료되었습니다.');
        const user = await response.json();
        setAuthUser(user);
        if (user.is_admin) setActivePage('accounts');
      })
      .catch(() => {
        window.localStorage.removeItem('ailounge_token');
        setAuthToken('');
        setAuthUser(null);
      })
      .finally(() => setIsCheckingSession(false));
  }, [authToken]);

  useEffect(() => {
    if (isAdminView) loadAccounts();
  }, [isAdminView]);

  useEffect(() => {
    if (authUser && ((!isAdminView && activePage === 'tech-news') || (isAdminView && activePage === 'tech-news-write'))) loadNewsList();
  }, [authUser, isAdminView, activePage]);

  useEffect(() => {
    if (selectedNewsId) loadNewsDetail(selectedNewsId);
    else setSelectedNews(null);
  }, [selectedNewsId]);


  useEffect(() => {
    if (authUser && !isAdminView && activePage === 'ai-blog') loadAiUsagePosts();
  }, [authUser, isAdminView, activePage]);

  useEffect(() => {
    if (authUser && !isAdminView && activePage === 'gen-ai-proposal') loadAiIdeas();
  }, [authUser, isAdminView, activePage]);

  useEffect(() => {
    if (authUser && isAdminView && activePage === 'idea-review') loadAdminIdeas();
  }, [authUser, isAdminView, activePage]);

  useEffect(() => {
    if (authUser && isAdminView && activePage === "asset-management") loadAdminAssets();
  }, [authUser, isAdminView, activePage]);

  useEffect(() => {
    if (authUser && !isAdminView && activePage === 'intro') loadIntroSummary();
  }, [authUser, isAdminView, activePage]);

  useEffect(() => {
    if (authUser && !isAdminView && activePage === 'explore') loadAssetCatalog();
  }, [authUser, isAdminView, activePage]);

  useEffect(() => {
    if (authUser && !isAdminView && activePage === 'dx-discovery') loadDxSessions();
  }, [authUser, isAdminView, activePage]);

  useEffect(() => {
    if (selectedAiUsagePostId) loadAiUsagePostDetail(selectedAiUsagePostId);
    else setSelectedAiUsagePost(null);
  }, [selectedAiUsagePostId]);


  useEffect(() => {
    if (hotAiUsagePosts.length === 0) return undefined;
    setHotAiUsageIndex((current) => (current >= hotAiUsagePosts.length ? 0 : current));
    const timer = window.setInterval(() => {
      setHotAiUsageIndex((current) => (current + 1) % hotAiUsagePosts.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hotAiUsagePosts.length]);

  useEffect(() => {
    if (!isAiUsageComposerOpen) return undefined;
    const handleSelectionChange = () => updateAiUsageEditorFormat();
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [isAiUsageComposerOpen]);

  const apiError = async (response, fallback) => {
    const data = await response.json().catch(() => ({}));
    return new Error(data.detail || fallback);
  };

  const addAssetModelItem = () => setAssetModelItems((items) => [...items, createAssetTechItem()]);
  const addAssetStackItem = () => setAssetStackItems((items) => [...items, createAssetTechItem()]);
  const addAssetBeforeAfterItem = () => setAssetBeforeAfterItems((items) => [...items, createAssetTechItem()]);
  const addAssetKpiItem = () => setAssetKpiItems((items) => [...items, createAssetTechItem()]);
  const addAssetImageItem = () => setAssetImageItems((items) => [...items, createAssetImageItem()]);
  const removeAssetModelItem = (id) => setAssetModelItems((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
  const removeAssetStackItem = (id) => setAssetStackItems((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
  const removeAssetBeforeAfterItem = (id) => setAssetBeforeAfterItems((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
  const removeAssetKpiItem = (id) => setAssetKpiItems((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
  const removeAssetImageItem = (id) => setAssetImageItems((items) => {
    const target = items.find((item) => item.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    return items.length > 1 ? items.filter((item) => item.id !== id) : items;
  });
  const updateAssetImageFile = (id, file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAssetImageItems((items) => items.map((item) => {
      if (item.id !== id) return item;
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return { ...item, fileName: file.name, previewUrl, file };
    }));
  };
  const moveAssetImageItem = (id, direction) => {
    setAssetImageItems((items) => {
      const index = items.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };
  const startSkillGeneration = async () => {
    if (skillGenerationStatus === 'loading') return;
    const assetId = assetDraftId || assetDraft.asset_id || '';
    if (!assetId) {
      setAssetSubmitError('먼저 자산 명세서 작성 단계에서 다음을 눌러 임시 저장하세요.');
      return;
    }
    setSkillGenerationStatus('loading');
    setSkillGenerationError('');
    setAssetSkillPlan(null);
    setGeneratedAssetSkillFiles([]);
    setSelectedSkillFilePath('');
    setSelectedSkillSlugs([]);
    setSkillGenerationStepIndex(0);
    setSkillGenerationPhase('planning');
    setIsSkillProgressOpen(true);
    try {
      const response = await fetch(`${API_BASE}/api/assets/${assetId}/skill-plan`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, 'Skill 후보 생성에 실패했습니다.');
      const plan = await response.json();
      const defaultSlugs = plan.selected_skill_slugs?.length
        ? plan.selected_skill_slugs
        : (plan.candidates || []).filter((candidate) => candidate.recommended).map((candidate) => candidate.slug);
      setAssetSkillPlan(plan);
      setSelectedSkillSlugs(defaultSlugs);
      setSkillGenerationPhase('selecting');
    } catch (error) {
      setSkillGenerationError(error.message);
      setSkillGenerationStatus('idle');
      setSkillGenerationPhase('error');
    }
  };
  const toggleGeneratedSkillCandidate = (slug) => {
    if (skillGenerationPhase !== 'selecting') return;
    setSelectedSkillSlugs((items) => (items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug]));
  };
  const confirmGeneratedSkillSelection = async () => {
    if (!selectedSkillSlugs.length || skillGenerationPhase !== "selecting") return;
    const assetId = assetDraftId || assetDraft.asset_id || "";
    if (!assetId) return;
    const steps = skillGenerationSteps;
    setSkillGenerationError("");
    setSkillGenerationStepIndex(0);
    setSkillGenerationPhase("generating");
    try {
      const response = await fetch(API_BASE + "/api/assets/" + assetId + "/skills/generate", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ selected_skill_slugs: selectedSkillSlugs }),
      });
      if (!response.ok) throw await apiError(response, "Skill 파일 생성에 실패했습니다.");
      if (!response.body) throw new Error("Skill 생성 진행 상태를 수신할 수 없습니다.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completedData = null;
      const processEventLine = (line) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === "error") throw new Error(event.message || "Skill 파일 생성에 실패했습니다.");
        const stepIndex = steps.findIndex((step) => step.id === event.step_id);
        if (event.type === "step_started" && stepIndex >= 0) {
          setSkillGenerationStepIndex(stepIndex);
        }
        if (event.type === "step_completed" && stepIndex >= 0) {
          setSkillGenerationStepIndex(stepIndex + 1);
        }
        if (event.type === "completed") completedData = event;
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach(processEventLine);
        if (done) break;
      }
      processEventLine(buffer);
      if (!completedData) throw new Error("Skill 생성 완료 결과를 수신하지 못했습니다.");

      const files = completedData.files || [];
      setGeneratedAssetSkillFiles(files);
      setSelectedSkillFilePath(files[0]?.path || "");
      setSkillGenerationStepIndex(steps.length);
      setSkillGenerationStatus("done");
      setSkillGenerationPhase("done");
      setIsSkillProgressOpen(false);
    } catch (error) {
      setSkillGenerationError(error.message);
      setSkillGenerationStatus("idle");
      setSkillGenerationPhase("error");
    }
  };
  const selectedSkillFile = generatedAssetSkillFiles.find((file) => file.path === selectedSkillFilePath);
  const renderSkillTreeNode = (node, depth = 0) => {
    if (node.type === 'directory') {
      return (
        <div className="asset-reg-tree-dir" key={`${node.name}-${depth}`}>
          <div className="asset-reg-tree-dir-label" style={{ paddingLeft: `${depth * 16}px` }}>
            <span className="asset-reg-tree-caret">▾</span><span>📁</span><b>{node.name}</b>
          </div>
          <div>{node.children.map((child) => renderSkillTreeNode(child, depth + 1))}</div>
        </div>
      );
    }
    return (
      <button
        className={`asset-reg-tree-file ${selectedSkillFilePath === node.path ? 'active' : ''}`}
        type="button"
        key={node.path}
        style={{ paddingLeft: `${depth * 16 + 22}px` }}
        onClick={() => setSelectedSkillFilePath(node.path)}
      >
        <span>{getSkillFileIcon(node.name)}</span><b>{node.name}</b><em>{node.size}</em>
      </button>
    );
  };
  const isAssetSubmitEnabled = Object.values(assetSubmitAgreements).every(Boolean);
  const toggleAssetSubmitAgreement = (key) => {
    setAssetSubmitAgreements((items) => ({ ...items, [key]: !items[key] }));
  };
  const toggleAssetGuide = (guideKey) => {
    setOpenAssetGuides((items) => ({ ...items, [guideKey]: !items[guideKey] }));
  };
  const toggleAssetTask = (task) => {
    setSelectedAssetTasks((items) => (items.includes(task) ? items.filter((item) => item !== task) : [...items, task]));
  };
  const toggleAssetImplementation = (implementation) => {
    setSelectedAssetImplementations((items) => (
      items.includes(implementation) ? items.filter((item) => item !== implementation) : [...items, implementation]
    ));
  };
  const addAssetTag = () => {
    const value = assetTagInput.trim();
    if (!value) return;
    setAssetTags((items) => (items.some((item) => item.toLowerCase() === value.toLowerCase()) ? items : [...items, value]));
    setAssetTagInput('');
  };
  const handleAssetTagKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addAssetTag();
  };
  const removeAssetTag = (tag) => {
    setAssetTags((items) => items.filter((item) => item !== tag));
  };

  const getAssetFieldValue = (name) => assetRegistryRef.current?.querySelector(`[name="${name}"]`)?.value.trim() || '';
  const hasAssetField = (name) => Boolean(assetRegistryRef.current?.querySelector(`[name="${name}"]`));
  const collectAssetRows = (selector, keys) => Array.from(assetRegistryRef.current?.querySelectorAll(selector) || [])
    .map((row) => Object.fromEntries(keys.map((key) => [key, row.querySelector(`[data-field="${key}"]`)?.value.trim() || ''])))
    .filter((row) => Object.values(row).some(Boolean));
  const syncAssetSpecRows = (payload) => {
    setAssetModelItems((items) => (payload.models.length ? payload.models.map((item, index) => createAssetTechItem({ ...items[index], ...item })) : items));
    setAssetStackItems((items) => (payload.tech_stacks.length ? payload.tech_stacks.map((item, index) => createAssetTechItem({ ...items[index], ...item })) : items));
    setAssetBeforeAfterItems((items) => (
      payload.before_after_metrics.length ? payload.before_after_metrics.map((item, index) => createAssetTechItem({ ...items[index], ...item })) : items
    ));
    setAssetKpiItems((items) => (
      payload.performance_metrics.length ? payload.performance_metrics.map((item, index) => createAssetTechItem({ ...items[index], ...item })) : items
    ));
    setAssetImageItems((items) => items.map((item, index) => ({ ...item, ...(payload.slides[index] || {}) })));
  };
  const assetRowsComplete = (selector, requiredKeys) => {
    const rows = Array.from(assetRegistryRef.current?.querySelectorAll(selector) || []);
    return rows.length > 0 && rows.every((row) => requiredKeys.every((key) => row.querySelector(`[data-field="${key}"]`)?.value.trim()));
  };
  const getAssetSpecSectionStatus = () => {
    const fieldReady = (name) => Boolean(getAssetFieldValue(name));
    const owner = ['owner_name', 'owner_job_title', 'owner_org', 'owner_email'].every(fieldReady);
    const basic = ['asset_name', 'asset_description', 'business_area', 'maturity_level'].every(fieldReady)
      && selectedAssetTasks.length > 0
      && selectedAssetImplementations.length > 0
      && assetTags.length > 0;
    const definition = ['problem_definition', 'as_is_workflow', 'to_be_workflow', 'ai_effect'].every(fieldReady);
    const data = isAssetNoData || (
      fieldReady('data_type')
      && fieldReady('data_description')
      && (hasAssetTrainValidationSplit ? Boolean(assetTrainFiles[0] && assetValidationFiles[0]) : Boolean(assetSampleFiles[0]))
    );
    const tech = assetRowsComplete('.asset-reg-model-item', ['model_name', 'description'])
      && assetRowsComplete('.asset-reg-stack-item', ['stack_name', 'description']);
    const metrics = assetRowsComplete('.asset-reg-before-after-item', ['metric_name', 'before_value', 'after_value', 'improvement_rate'])
      && assetRowsComplete('.asset-reg-kpi-item', ['metric_name', 'value', 'description']);
    const slideRows = Array.from(assetRegistryRef.current?.querySelectorAll('.asset-reg-slide-image-card') || []);
    const screens = assetImageItems.length > 0
      && assetImageItems.every((item) => item.file)
      && slideRows.length === assetImageItems.length
      && slideRows.every((row) => row.querySelector('[data-field="caption"]')?.value.trim() && row.querySelector('[data-field="description"]')?.value.trim());
    return { owner, basic, definition, data, tech, metrics, screens };
  };
  const getAssetSpecMissingFields = () => {
    const status = getAssetSpecSectionStatus();
    const labels = { owner: '담당자 정보', basic: '자산 기본 정보', definition: '과제 정의', data: '데이터', tech: '적용 기술', metrics: '성능 지표', screens: '자산 활용 화면' };
    return Object.entries(status).filter(([, ready]) => !ready).map(([key]) => labels[key]);
  };
  const refreshAssetSpecReady = () => {
    window.requestAnimationFrame(() => {
      const status = getAssetSpecSectionStatus();
      setAssetSpecSectionStatus(status);
      setIsAssetSpecReady(Object.values(status).every(Boolean));
    });
  };
  const renderAssetSectionLabel = (label, statusKey) => {
    const ready = Boolean(assetSpecSectionStatus[statusKey]);
    return (
      <div className={`asset-reg-section-label ${ready ? 'complete' : 'incomplete'}`}>
        <span>{label}</span>
        <em>{ready ? '✓' : '×'}</em>
      </div>
    );
  };
  const captureAssetDraft = () => {
    const currentStepPayload = {
      owner_name: getAssetFieldValue('owner_name'),
      owner_job_title: getAssetFieldValue('owner_job_title'),
      owner_org: getAssetFieldValue('owner_org'),
      owner_email: getAssetFieldValue('owner_email'),
      asset_name: getAssetFieldValue('asset_name'),
      description: getAssetFieldValue('asset_description'),
      business_area: getAssetFieldValue('business_area'),
      maturity_level: getAssetFieldValue('maturity_level'),
      task_types: selectedAssetTasks,
      implementation_types: selectedAssetImplementations,
      tags: assetTags,
      problem_definition: getAssetFieldValue('problem_definition'),
      as_is_workflow: getAssetFieldValue('as_is_workflow'),
      to_be_workflow: getAssetFieldValue('to_be_workflow'),
      ai_effect: getAssetFieldValue('ai_effect'),
      has_data: !isAssetNoData,
      has_train_validation_split: hasAssetTrainValidationSplit,
      data_type: isAssetNoData ? '' : getAssetFieldValue('data_type'),
      data_description: isAssetNoData ? '' : getAssetFieldValue('data_description'),
      models: collectAssetRows('.asset-reg-model-item', ['model_name', 'description', 'reference_url']),
      tech_stacks: collectAssetRows('.asset-reg-stack-item', ['stack_name', 'description', 'reference_url']),
      before_after_metrics: collectAssetRows('.asset-reg-before-after-item', ['metric_name', 'before_value', 'after_value', 'improvement_rate']),
      performance_metrics: collectAssetRows('.asset-reg-kpi-item', ['metric_name', 'value', 'description']),
      slides: Array.from(assetRegistryRef.current?.querySelectorAll('.asset-reg-slide-image-card') || []).map((row, index) => ({
        caption: row.querySelector('[data-field="caption"]')?.value.trim() || '',
        description: row.querySelector('[data-field="description"]')?.value.trim() || '',
        sort_order: index + 1,
      })),
      repo_url: getAssetFieldValue('repo_url'),
      repo_branch: getAssetFieldValue('repo_branch'),
    };
    if (assetRegistryStep === 0) syncAssetSpecRows(currentStepPayload);
    setAssetDraft((current) => {
      const next = { ...current };
      Object.entries(currentStepPayload).forEach(([key, value]) => {
        const isEmptyArray = Array.isArray(value) && value.length === 0;
        const shouldForceDataValue = ['has_data', 'has_train_validation_split'].includes(key)
          || (['data_type', 'data_description'].includes(key) && (assetRegistryStep === 0 || hasAssetField(key)));
        if (value !== '' && !isEmptyArray) next[key] = value;
        if (shouldForceDataValue) next[key] = value;
      });
      return next;
    });
    return currentStepPayload;
  };
  const goToAssetRegistryStep = (step) => {
    if (step > assetRegistryMaxAccessibleStep) return;
    captureAssetDraft();
    setAssetRegistryStep(step);
  };
  const resetAssetRegistry = () => {
    setIsAssetRegistrySubmitted(false);
    setAssetRegistryStep(0);
    setIsAssetNoData(false);
    setSelectedAssetTasks([]);
    setSelectedAssetImplementations([]);
    setAssetModelItems([createAssetTechItem()]);
    setAssetStackItems([createAssetTechItem()]);
    setAssetBeforeAfterItems([createAssetTechItem()]);
    setAssetKpiItems([createAssetTechItem()]);
    setAssetImageItems([createAssetImageItem()]);
    setAssetTrainFiles([]);
    setAssetValidationFiles([]);
    setAssetSampleFiles([]);
    setHasAssetTrainValidationSplit(false);
    setSkillGenerationStatus('idle');
    setIsSkillProgressOpen(false);
    setSkillGenerationPhase('idle');
    setSkillGenerationStepIndex(0);
    setAssetSkillPlan(null);
    setSkillGenerationError('');
    setSelectedSkillSlugs([]);
    setGeneratedAssetSkillFiles([]);
    setSelectedSkillFilePath('');
    setAssetSubmitAgreements({ share: false, factual: false, security: false });
    setOpenAssetGuides({});
    setAssetTagInput('');
    setAssetTags([]);
    setAssetSubmitError('');
    setAssetDraft({});
    setAssetDraftId('');
    setAssetRepoTree([]);
    setIsCloningAssetRepo(false);
    setIsStagingAssetSpec(false);
    setAssetRepoErrorMessage('');
    setIsAssetSampleLoaded(false);
    setIsAssetSpecReady(false);
    setAssetSpecSectionStatus({});
    setAssetSampleVersion((version) => version + 1);
  };
  const loadIntroSummary = async () => {
    setIsLoadingIntroSummary(true);
    setIntroSummaryError('');
    try {
      const response = await fetch(API_BASE + '/api/assets/intro/summary', { headers: authHeaders });
      if (!response.ok) throw await apiError(response, 'AI STUDIO 운영 현황을 불러오지 못했습니다.');
      setIntroSummary(await response.json());
    } catch (error) {
      setIntroSummaryError(error.message);
    } finally {
      setIsLoadingIntroSummary(false);
    }
  };

  const loadAssetCatalog = async () => {
    setIsLoadingAssetCatalog(true);
    setAssetCatalogError('');
    try {
      const response = await fetch(API_BASE + '/api/assets/catalog', { headers: authHeaders });
      if (!response.ok) throw await apiError(response, 'AI 자산을 불러오지 못했습니다.');
      const assets = await response.json();
      setAssetCatalog(assets);
      setAssetBookmarks(new Set(assets.filter((asset) => asset.is_bookmarked).map((asset) => asset.asset_id)));
    } catch (error) {
      setAssetCatalogError(error.message);
    } finally {
      setIsLoadingAssetCatalog(false);
    }
  };

  const requestAssetRecommendations = async (event) => {
    event.preventDefault();
    const query = assetRecommendationQuery.trim();
    if (query.length < 5 || isRecommendingAssets) return;
    setIsRecommendingAssets(true);
    setAssetRecommendationError('');
    setAssetRecommendations([]);
    setHasAssetRecommendationRun(false);
    try {
      const response = await fetch(API_BASE + '/api/assets/recommendations', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw await apiError(response, 'AI 자산을 추천하지 못했습니다.');
      const data = await response.json();
      setAssetRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      setHasAssetRecommendationRun(true);
    } catch (error) {
      setAssetRecommendationError(error.message);
    } finally {
      setIsRecommendingAssets(false);
    }
  };

  const toggleAssetCatalogFilter = (key, value) => {
    setAssetCatalogFilters((current) => {
      const selected = current[key] || [];
      return { ...current, [key]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] };
    });
  };

  const toggleAssetBookmark = async (assetId, event) => {
    event?.stopPropagation();
    const wasBookmarked = assetBookmarks.has(assetId);
    setAssetBookmarks((current) => {
      const next = new Set(current);
      if (wasBookmarked) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
    setAssetCatalog((current) => current.map((asset) => asset.asset_id === assetId ? { ...asset, is_bookmarked: !wasBookmarked } : asset));
    try {
      const response = await fetch(API_BASE + '/api/assets/catalog/' + assetId + '/bookmark', {
        method: wasBookmarked ? 'DELETE' : 'POST',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, '즐겨찾기를 변경하지 못했습니다.');
    } catch (error) {
      setAssetBookmarks((current) => {
        const next = new Set(current);
        if (wasBookmarked) next.add(assetId);
        else next.delete(assetId);
        return next;
      });
      setAssetCatalog((current) => current.map((asset) => asset.asset_id === assetId ? { ...asset, is_bookmarked: wasBookmarked } : asset));
      setAssetCatalogError(error.message);
    }
  };

  const openAssetCatalogDetail = async (asset) => {
    setSelectedCatalogAsset(asset);
    setSelectedCatalogTab('overview');
    setCatalogSlideIndex(0);
    setCatalogDetailError('');
    setIsCatalogRepoCopied(false);
    setIsLoadingCatalogDetail(true);
    try {
      const response = await fetch(API_BASE + '/api/assets/catalog/' + asset.asset_id, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, 'AI 자산 상세 정보를 불러오지 못했습니다.');
      const detail = await response.json();
      setSelectedCatalogAsset(detail);
      setAssetCatalog((current) => current.map((item) => item.asset_id === detail.asset_id ? { ...item, view_count: detail.view_count } : item));
    } catch (error) {
      setCatalogDetailError(error.message);
    } finally {
      setIsLoadingCatalogDetail(false);
    }
  };

  const closeAssetCatalogDetail = () => {
    setSelectedCatalogAsset(null);
    setCatalogDetailError('');
    setIsCatalogRepoCopied(false);
    setIsDiffusionCaseFormOpen(false);
    setDiffusionCaseError('');
  };

  const copyCatalogRepositoryUrl = async (repoUrl) => {
    try {
      await copyTextToClipboard(repoUrl);
      setCatalogDetailError('');
      setIsCatalogRepoCopied(true);
      window.setTimeout(() => setIsCatalogRepoCopied(false), 1500);
    } catch (error) {
      setIsCatalogRepoCopied(false);
      setCatalogDetailError(error.message || 'Git 저장소 주소를 복사하지 못했습니다.');
    }
  };

  const syncDiffusionCompletedCount = (assetId, count) => {
    const nextCount = Number(count || 0);
    setAssetCatalog((current) => current.map((asset) => asset.asset_id === assetId
      ? { ...asset, diffusion_completed_count: nextCount }
      : asset));
    setSelectedCatalogAsset((current) => current?.asset_id === assetId
      ? { ...current, diffusion_completed_count: nextCount }
      : current);
  };

  const loadAssetDiffusionCases = async (assetId) => {
    setIsLoadingDiffusionCases(true);
    setDiffusionCaseError('');
    try {
      const response = await fetch(`${API_BASE}/api/assets/catalog/${assetId}/diffusion-cases`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, '확산 사례를 불러오지 못했습니다.');
      const cases = await response.json();
      setAssetDiffusionCases((current) => ({ ...current, [assetId]: cases }));
    } catch (error) {
      setDiffusionCaseError(error.message);
    } finally {
      setIsLoadingDiffusionCases(false);
    }
  };

  const selectAssetCatalogTab = (key) => {
    setSelectedCatalogTab(key);
    if (key === 'demo') setCatalogSlideIndex(0);
    if (key === 'diffusion-cases' && selectedCatalogAsset) {
      loadAssetDiffusionCases(selectedCatalogAsset.asset_id);
    }
    if (key === 'qa' && selectedCatalogAsset) {
      loadAssetQa(selectedCatalogAsset.asset_id);
      setAssetQaReplyTarget('');
      setAssetQaReplyDraft('');
      setEditingAssetQaQuestionId('');
      setAssetQaQuestionEditDraft('');
      setEditingAssetQaReplyId('');
      setAssetQaEditDraft('');
    }
  };

  const updateQaQuestion = (assetId, questionId, updater) => {
    setAssetQaThreads((current) => ({
      ...current,
      [assetId]: (current[assetId] || []).map((question) => question.qa_post_id === questionId
        ? updater(question)
        : question),
    }));
  };

  const loadAssetQa = async (assetId) => {
    setIsLoadingAssetQa(true);
    setAssetQaError('');
    try {
      const response = await fetch(`${API_BASE}/api/assets/catalog/${assetId}/qa`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, 'Q&A를 불러오지 못했습니다.');
      const questions = await response.json();
      setAssetQaThreads((current) => ({ ...current, [assetId]: questions }));
    } catch (error) {
      setAssetQaError(error.message);
    } finally {
      setIsLoadingAssetQa(false);
    }
  };

  const submitAssetQaQuestion = async (event) => {
    event.preventDefault();
    const content = assetQaDraft.trim();
    if (!selectedCatalogAsset || !content) return;
    const assetId = selectedCatalogAsset.asset_id;
    setIsSavingAssetQa(true);
    setAssetQaError('');
    try {
      const response = await fetch(`${API_BASE}/api/assets/catalog/${assetId}/qa/questions`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, topic: '적용 문의' }),
      });
      if (!response.ok) throw await apiError(response, '질문을 등록하지 못했습니다.');
      const question = await response.json();
      setAssetQaThreads((current) => ({ ...current, [assetId]: [question, ...(current[assetId] || [])] }));
      setAssetQaDraft('');
    } catch (error) {
      setAssetQaError(error.message);
    } finally {
      setIsSavingAssetQa(false);
    }
  };

  const toggleAssetQaHelpful = async (question) => {
    if (!selectedCatalogAsset) return;
    const assetId = selectedCatalogAsset.asset_id;
    try {
      const response = await fetch(
        `${API_BASE}/api/assets/catalog/${assetId}/qa/questions/${question.qa_post_id}/helpful`,
        { method: question.helpful_by_me ? 'DELETE' : 'POST', headers: authHeaders },
      );
      if (!response.ok) throw await apiError(response, '도움돼요를 변경하지 못했습니다.');
      const result = await response.json();
      updateQaQuestion(assetId, question.qa_post_id, (current) => ({ ...current, ...result }));
    } catch (error) {
      setAssetQaError(error.message);
    }
  };

  const openAssetQaReply = (questionId) => {
    setAssetQaReplyTarget((current) => current === questionId ? '' : questionId);
    setAssetQaReplyDraft('');
    setAssetQaError('');
  };

  const submitAssetQaReply = async (event, questionId) => {
    event.preventDefault();
    const content = assetQaReplyDraft.trim();
    if (!selectedCatalogAsset || !content) return;
    const assetId = selectedCatalogAsset.asset_id;
    setIsSavingAssetQa(true);
    setAssetQaError('');
    try {
      const response = await fetch(
        `${API_BASE}/api/assets/catalog/${assetId}/qa/questions/${questionId}/replies`,
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        },
      );
      if (!response.ok) throw await apiError(response, '답글을 등록하지 못했습니다.');
      const reply = await response.json();
      updateQaQuestion(assetId, questionId, (question) => ({ ...question, replies: [...question.replies, reply] }));
      setAssetQaReplyTarget('');
      setAssetQaReplyDraft('');
    } catch (error) {
      setAssetQaError(error.message);
    } finally {
      setIsSavingAssetQa(false);
    }
  };

  const startEditAssetQaReply = (reply) => {
    setEditingAssetQaQuestionId('');
    setAssetQaQuestionEditDraft('');
    setEditingAssetQaReplyId(reply.qa_post_id);
    setAssetQaEditDraft(reply.content);
    setAssetQaError('');
  };

  const startEditAssetQaQuestion = (question) => {
    setEditingAssetQaReplyId('');
    setAssetQaEditDraft('');
    setEditingAssetQaQuestionId(question.qa_post_id);
    setAssetQaQuestionEditDraft(question.content);
    setAssetQaError('');
  };

  const saveAssetQaQuestion = async (event, questionId) => {
    event.preventDefault();
    const content = assetQaQuestionEditDraft.trim();
    if (!selectedCatalogAsset || !content) return;
    const assetId = selectedCatalogAsset.asset_id;
    setIsSavingAssetQa(true);
    setAssetQaError('');
    try {
      const response = await fetch(`${API_BASE}/api/assets/catalog/${assetId}/qa/posts/${questionId}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw await apiError(response, '질문을 수정하지 못했습니다.');
      const question = await response.json();
      updateQaQuestion(assetId, questionId, () => question);
      setEditingAssetQaQuestionId('');
      setAssetQaQuestionEditDraft('');
    } catch (error) {
      setAssetQaError(error.message);
    } finally {
      setIsSavingAssetQa(false);
    }
  };

  const deleteAssetQaQuestion = async (question) => {
    if (!selectedCatalogAsset || !window.confirm('이 질문을 삭제할까요? 등록된 답글도 모두 함께 삭제됩니다.')) return;
    const assetId = selectedCatalogAsset.asset_id;
    setDeletingAssetQaQuestionId(question.qa_post_id);
    setAssetQaError('');
    try {
      const response = await fetch(`${API_BASE}/api/assets/catalog/${assetId}/qa/posts/${question.qa_post_id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, '질문을 삭제하지 못했습니다.');
      setAssetQaThreads((current) => ({
        ...current,
        [assetId]: (current[assetId] || []).filter((item) => item.qa_post_id !== question.qa_post_id),
      }));
      if (assetQaReplyTarget === question.qa_post_id) {
        setAssetQaReplyTarget('');
        setAssetQaReplyDraft('');
      }
      setEditingAssetQaQuestionId('');
      setAssetQaQuestionEditDraft('');
    } catch (error) {
      setAssetQaError(error.message);
    } finally {
      setDeletingAssetQaQuestionId('');
    }
  };

  const saveAssetQaReply = async (event, questionId) => {
    event.preventDefault();
    const content = assetQaEditDraft.trim();
    if (!selectedCatalogAsset || !content) return;
    const assetId = selectedCatalogAsset.asset_id;
    setIsSavingAssetQa(true);
    setAssetQaError('');
    try {
      const response = await fetch(
        `${API_BASE}/api/assets/catalog/${assetId}/qa/posts/${editingAssetQaReplyId}`,
        {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        },
      );
      if (!response.ok) throw await apiError(response, '답글을 수정하지 못했습니다.');
      const reply = await response.json();
      updateQaQuestion(assetId, questionId, (question) => ({
        ...question,
        replies: question.replies.map((item) => item.qa_post_id === reply.qa_post_id ? reply : item),
      }));
      setEditingAssetQaReplyId('');
      setAssetQaEditDraft('');
    } catch (error) {
      setAssetQaError(error.message);
    } finally {
      setIsSavingAssetQa(false);
    }
  };

  const deleteAssetQaReply = async (questionId, reply) => {
    if (!selectedCatalogAsset || !window.confirm('이 답글을 삭제할까요?')) return;
    const assetId = selectedCatalogAsset.asset_id;
    setDeletingAssetQaReplyId(reply.qa_post_id);
    setAssetQaError('');
    try {
      const response = await fetch(
        `${API_BASE}/api/assets/catalog/${assetId}/qa/posts/${reply.qa_post_id}`,
        { method: 'DELETE', headers: authHeaders },
      );
      if (!response.ok) throw await apiError(response, '답글을 삭제하지 못했습니다.');
      updateQaQuestion(assetId, questionId, (question) => ({
        ...question,
        replies: question.replies.filter((item) => item.qa_post_id !== reply.qa_post_id),
      }));
    } catch (error) {
      setAssetQaError(error.message);
    } finally {
      setDeletingAssetQaReplyId('');
    }
  };

  const openDiffusionCaseForm = () => {
    setEditingDiffusionCaseId('');
    setDiffusionCaseForm(emptyDiffusionCaseForm);
    setDiffusionCaseError('');
    setIsDiffusionCaseFormOpen(true);
  };

  const startEditDiffusionCase = (item) => {
    setEditingDiffusionCaseId(item.diffusion_case_id);
    setDiffusionCaseForm({
      title: item.title,
      stage: item.stage,
      applied_work: item.applied_work,
      customization: item.customization,
      effect: item.effect,
      git_url: item.git_url || '',
    });
    setDiffusionCaseError('');
    setIsDiffusionCaseFormOpen(true);
  };

  const closeDiffusionCaseForm = () => {
    if (isSavingDiffusionCase) return;
    setIsDiffusionCaseFormOpen(false);
    setEditingDiffusionCaseId('');
    setDiffusionCaseError('');
  };

  const updateDiffusionCaseField = (field, value) => {
    setDiffusionCaseForm((current) => ({ ...current, [field]: value }));
  };

  const submitDiffusionCase = async (event) => {
    event.preventDefault();
    if (!selectedCatalogAsset) return;
    const requiredFields = ['title', 'stage', 'applied_work', 'customization', 'effect'];
    if (requiredFields.some((field) => !diffusionCaseForm[field].trim())) {
      setDiffusionCaseError('필수 항목을 모두 입력하세요.');
      return;
    }
    const assetId = selectedCatalogAsset.asset_id;
    setIsSavingDiffusionCase(true);
    setDiffusionCaseError('');
    try {
      const response = await fetch(
        `${API_BASE}/api/assets/catalog/${assetId}/diffusion-cases${editingDiffusionCaseId ? `/${editingDiffusionCaseId}` : ''}`,
        {
          method: editingDiffusionCaseId ? 'PUT' : 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(
            Object.entries(diffusionCaseForm).map(([key, value]) => [key, value.trim() || null]),
          )),
        },
      );
      if (!response.ok) throw await apiError(response, editingDiffusionCaseId ? '확산 사례를 수정하지 못했습니다.' : '확산 사례를 등록하지 못했습니다.');
      const result = await response.json();
      setAssetDiffusionCases((current) => {
        const cases = current[assetId] || [];
        const nextCases = editingDiffusionCaseId
          ? cases.map((item) => item.diffusion_case_id === editingDiffusionCaseId ? result.case : item)
          : [result.case, ...cases];
        return { ...current, [assetId]: nextCases };
      });
      syncDiffusionCompletedCount(assetId, result.diffusion_completed_count);
      setIsDiffusionCaseFormOpen(false);
      setEditingDiffusionCaseId('');
    } catch (error) {
      setDiffusionCaseError(error.message);
    } finally {
      setIsSavingDiffusionCase(false);
    }
  };

  const deleteDiffusionCase = async (item) => {
    if (!selectedCatalogAsset || !window.confirm(`'${item.title}' 확산 사례를 삭제할까요?`)) return;
    const assetId = selectedCatalogAsset.asset_id;
    setDeletingDiffusionCaseId(item.diffusion_case_id);
    setDiffusionCaseError('');
    try {
      const response = await fetch(
        `${API_BASE}/api/assets/catalog/${assetId}/diffusion-cases/${item.diffusion_case_id}`,
        { method: 'DELETE', headers: authHeaders },
      );
      if (!response.ok) throw await apiError(response, '확산 사례를 삭제하지 못했습니다.');
      const result = await response.json();
      setAssetDiffusionCases((current) => ({
        ...current,
        [assetId]: (current[assetId] || []).filter((caseItem) => caseItem.diffusion_case_id !== item.diffusion_case_id),
      }));
      syncDiffusionCompletedCount(assetId, result.diffusion_completed_count);
    } catch (error) {
      setDiffusionCaseError(error.message);
    } finally {
      setDeletingDiffusionCaseId('');
    }
  };

  const downloadCatalogFile = async (path, fallbackName) => {
    try {
      const response = await fetch(API_BASE + path, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, '파일을 내려받지 못했습니다.');
      const diffusionAttemptHeader = response.headers.get('X-Diffusion-Attempt-Count');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      if (path.endsWith('/skills.zip') && diffusionAttemptHeader !== null) {
        const diffusionAttemptCount = Number(diffusionAttemptHeader);
        if (!Number.isFinite(diffusionAttemptCount)) return;
        setAssetCatalog((current) => current.map((asset) => asset.asset_id === selectedCatalogAsset?.asset_id
          ? { ...asset, diffusion_attempt_count: diffusionAttemptCount }
          : asset));
        setSelectedCatalogAsset((current) => current ? { ...current, diffusion_attempt_count: diffusionAttemptCount } : current);
      }
    } catch (error) {
      setCatalogDetailError(error.message);
    }
  };

  const openAssetRegistrationDocument = async (asset) => {
    setIsAssetDocumentOpen(true);
    setAssetDocumentTitle(asset.asset_name);
    setAssetDocumentHtml("");
    setAssetDocumentError("");
    setAssetDocumentLoadingId(asset.asset_id);
    try {
      const response = await fetch(API_BASE + "/api/assets/" + asset.asset_id + "/registration-document", { headers: authHeaders });
      if (!response.ok) throw await apiError(response, "AI 자산 등록서를 불러오지 못했습니다.");
      setAssetDocumentHtml(await response.text());
    } catch (error) {
      setAssetDocumentError(error.message);
    } finally {
      setAssetDocumentLoadingId("");
    }
  };
  const closeAssetRegistrationDocument = () => {
    setIsAssetDocumentOpen(false);
    setAssetDocumentHtml("");
    setAssetDocumentError("");
    setAssetDocumentLoadingId("");
  };
  const loadMyAiAssets = async () => {
    setIsLoadingMyAiAssets(true);
    setMyAiAssetsError("");
    try {
      const response = await fetch(API_BASE + "/api/assets/mine", { headers: authHeaders });
      if (!response.ok) throw await apiError(response, "나의 AI 자산 등록 기록을 불러오지 못했습니다.");
      setMyAiAssets(await response.json());
    } catch (error) {
      setMyAiAssetsError(error.message);
    } finally {
      setIsLoadingMyAiAssets(false);
    }
  };
  const loadAdminAssets = async () => {
    setIsLoadingAdminAssets(true);
    setAdminAssetsError("");
    try {
      const response = await fetch(API_BASE + "/api/admin/assets", { headers: authHeaders });
      if (!response.ok) throw await apiError(response, "AI 자산 목록을 불러오지 못했습니다.");
      setAdminAssets(await response.json());
    } catch (error) {
      setAdminAssetsError(error.message);
    } finally {
      setIsLoadingAdminAssets(false);
    }
  };
  const openAssetReviewForm = (asset) => {
    setAssetReviewTarget(asset);
    setAssetReviewForm({ status: "", comment: "" });
    setAdminAssetsError("");
  };
  const closeAssetReviewForm = () => {
    if (isReviewingAsset) return;
    setAssetReviewTarget(null);
    setAssetReviewForm({ status: "", comment: "" });
    setAdminAssetsError("");
  };
  const submitAssetReview = async (event) => {
    event.preventDefault();
    if (!assetReviewTarget) return;
    setIsReviewingAsset(true);
    setAdminAssetsError("");
    try {
      const response = await fetch(API_BASE + "/api/admin/assets/" + assetReviewTarget.asset_id + "/status", {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: assetReviewForm.status, review_comment: assetReviewForm.comment.trim() }),
      });
      if (!response.ok) throw await apiError(response, "AI 자산 심사를 완료하지 못했습니다.");
      const updatedAsset = await response.json();
      setAdminAssets((current) => current.map((asset) => (asset.asset_id === updatedAsset.asset_id ? updatedAsset : asset)));
      setAssetReviewTarget(null);
      setAssetReviewForm({ status: "", comment: "" });
    } catch (error) {
      setAdminAssetsError(error.message);
    } finally {
      setIsReviewingAsset(false);
    }
  };
  const toggleAdminAssetActivation = async (asset) => {
    if (assetActivationId) return;
    setAssetActivationId(asset.asset_id);
    setAdminAssetsError("");
    try {
      const response = await fetch(API_BASE + "/api/admin/assets/" + asset.asset_id + "/activation", {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !asset.is_active }),
      });
      if (!response.ok) throw await apiError(response, "자산 활성 상태를 변경하지 못했습니다.");
      const updatedAsset = await response.json();
      setAdminAssets((current) => current.map((item) => (item.asset_id === updatedAsset.asset_id ? updatedAsset : item)));
    } catch (error) {
      setAdminAssetsError(error.message);
    } finally {
      setAssetActivationId("");
    }
  };
  const openAssetDeleteConfirm = (asset) => {
    setAssetDeleteTarget(asset);
    setAdminAssetsError("");
  };
  const closeAssetDeleteConfirm = () => {
    if (isDeletingAsset) return;
    setAssetDeleteTarget(null);
    setAdminAssetsError("");
  };
  const deleteAdminAsset = async () => {
    if (!assetDeleteTarget || isDeletingAsset) return;
    setIsDeletingAsset(true);
    setAdminAssetsError("");
    try {
      const response = await fetch(API_BASE + "/api/admin/assets/" + assetDeleteTarget.asset_id, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, "AI 자산을 삭제하지 못했습니다.");
      setAdminAssets((current) => current.filter((asset) => asset.asset_id !== assetDeleteTarget.asset_id));
      setAssetDeleteTarget(null);
    } catch (error) {
      setAdminAssetsError(error.message);
    } finally {
      setIsDeletingAsset(false);
    }
  };
  const fetchAssetSampleFile = async (fileInfo) => {
    if (!fileInfo?.url) return null;
    const response = await fetch(`${API_BASE}${fileInfo.url}`, { headers: authHeaders });
    if (!response.ok) throw await apiError(response, '샘플 파일을 불러오지 못했습니다.');
    const blob = await response.blob();
    return new File([blob], fileInfo.original_name || fileInfo.stored_name || 'sample.file', { type: fileInfo.content_type || blob.type || 'application/octet-stream' });
  };
  // TODO: Remove this sample preset loader after AI asset registration QA/testing is complete.
  const loadAssetSamplePreset = async () => {
    if (isAssetSampleLoaded || !authToken) return;
    try {
      const response = await fetch(`${API_BASE}/api/assets/sample`, { headers: authHeaders });
      if (!response.ok) return;
      const sample = await response.json();
      const payload = sample.payload || {};
      const nextDraft = { ...payload, asset_id: '' };
      delete nextDraft.staged_by;
      delete nextDraft.staged_at;
      nextDraft.owner_email = nextDraft.owner_email || nextDraft.user_email || 'jongwook.lee@hyundai-wia.com';
      delete nextDraft.user_id;
      delete nextDraft.user_email;
      setAssetDraft(nextDraft);
      setAssetDraftId('');
      setSelectedAssetTasks(Array.isArray(payload.task_types) ? payload.task_types : []);
      setSelectedAssetImplementations(Array.isArray(payload.implementation_types) ? payload.implementation_types : []);
      setAssetTags(Array.isArray(payload.tags) ? payload.tags : []);
      setIsAssetNoData(!payload.has_data);
      setHasAssetTrainValidationSplit(Boolean(payload.has_train_validation_split));
      setAssetModelItems((Array.isArray(payload.models) && payload.models.length ? payload.models : [{}]).map((item) => createAssetTechItem(item)));
      setAssetStackItems((Array.isArray(payload.tech_stacks) && payload.tech_stacks.length ? payload.tech_stacks : [{}]).map((item) => createAssetTechItem(item)));
      setAssetBeforeAfterItems((Array.isArray(payload.before_after_metrics) && payload.before_after_metrics.length ? payload.before_after_metrics : [{}]).map((item) => createAssetTechItem(item)));
      setAssetKpiItems((Array.isArray(payload.performance_metrics) && payload.performance_metrics.length ? payload.performance_metrics : [{}]).map((item) => createAssetTechItem(item)));
      const sortedSlides = Array.isArray(sample.slides) ? [...sample.slides].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : [];
      const slideItems = await Promise.all(sortedSlides.map(async (slide) => {
        const file = await fetchAssetSampleFile(slide);
        return createAssetImageItem({
          fileName: file?.name || slide.original_name || '',
          previewUrl: file ? URL.createObjectURL(file) : '',
          file,
          caption: slide.caption || '',
          description: slide.description || '',
        });
      }));
      setAssetImageItems(slideItems.length ? slideItems : [createAssetImageItem()]);
      const dataFiles = Array.isArray(sample.data_files) ? sample.data_files : [];
      const sampleFile = dataFiles.find((file) => file.role === 'sample');
      const trainFile = dataFiles.find((file) => file.role === 'train');
      const validationFile = dataFiles.find((file) => file.role === 'validation');
      setAssetSampleFiles(sampleFile ? [await fetchAssetSampleFile(sampleFile)].filter(Boolean) : []);
      setAssetTrainFiles(trainFile ? [await fetchAssetSampleFile(trainFile)].filter(Boolean) : []);
      setAssetValidationFiles(validationFile ? [await fetchAssetSampleFile(validationFile)].filter(Boolean) : []);
      setAssetSampleVersion((version) => version + 1);
    } finally {
      setIsAssetSampleLoaded(true);
    }
  };
  useEffect(() => {
    if (activePage === 'registry') loadAssetSamplePreset();
  }, [activePage, isAssetSampleLoaded, authToken]);
  useEffect(() => {
    if (authUser && !isAdminView && activePage === 'registry') loadMyAiAssets();
  }, [authUser, isAdminView, activePage]);
  useEffect(() => {
    if (activePage !== 'registry' || assetRegistryStep !== 0) return undefined;
    const timer = window.setTimeout(refreshAssetSpecReady, 0);
    return () => window.clearTimeout(timer);
  }, [activePage, assetRegistryStep, selectedAssetTasks, selectedAssetImplementations, assetTags, isAssetNoData, hasAssetTrainValidationSplit, assetTrainFiles, assetValidationFiles, assetSampleFiles, assetImageItems, assetModelItems, assetStackItems, assetBeforeAfterItems, assetKpiItems, assetDraft, assetSampleVersion]);
  const buildAssetFormData = (formPayload) => {
    const formData = new FormData();
    formData.append('payload_json', JSON.stringify(formPayload));
    assetImageItems.forEach((item) => { if (item.file) formData.append('slides', item.file); });
    assetTrainFiles.forEach((file) => formData.append('train_files', file));
    assetValidationFiles.forEach((file) => formData.append('validation_files', file));
    assetSampleFiles.forEach((file) => formData.append('sample_files', file));
    return formData;
  };
  const buildAssetPayload = (livePayload = {}) => ({
    ...assetDraft,
    ...livePayload,
    asset_id: assetDraftId || assetDraft.asset_id || livePayload.asset_id || '',
    task_types: selectedAssetTasks.length ? selectedAssetTasks : assetDraft.task_types || [],
    implementation_types: selectedAssetImplementations.length ? selectedAssetImplementations : assetDraft.implementation_types || [],
    tags: assetTags.length ? assetTags : assetDraft.tags || [],
    skill_files: skillGenerationStatus === 'done' ? generatedAssetSkillFiles.map(({ path, content }) => ({ path, content })) : [],
  });
  const attachAssetSlidesMeta = (payload, livePayload = {}) => {
    payload.slides = assetImageItems
      .map((item, index) => ({ item, meta: (livePayload.slides || assetDraft.slides || [])[index] || {} }))
      .filter(({ item }) => item.file)
      .map(({ meta }, index) => ({ caption: meta.caption || '', description: meta.description || '', sort_order: index + 1 }));
    return payload;
  };
  const validateAssetUploadSizes = () => {
    const maxAssetDataFileSize = 10 * 1024 * 1024;
    if (assetTrainFiles[0]?.size > maxAssetDataFileSize) throw new Error('학습 샘플 데이터는 10MB 이하 파일 1개만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.');
    if (assetValidationFiles[0]?.size > maxAssetDataFileSize) throw new Error('검증 샘플 데이터는 10MB 이하 파일 1개만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.');
    if (assetSampleFiles[0]?.size > maxAssetDataFileSize) throw new Error('샘플 데이터는 10MB 이하 파일 1개만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.');
  };
  const stageAssetSpecification = async () => {
    setAssetSubmitError('');
    const missingFields = getAssetSpecMissingFields();
    if (missingFields.length > 0) {
      setAssetSubmitError(`필수 항목을 모두 입력하세요. (${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? ' 외' : ''})`);
      setIsAssetSpecReady(false);
      setAssetSpecSectionStatus({});
      return;
    }
    setIsStagingAssetSpec(true);
    try {
      const livePayload = captureAssetDraft();
      const payload = attachAssetSlidesMeta(buildAssetPayload(livePayload), livePayload);
      validateAssetUploadSizes();
      const response = await fetch(`${API_BASE}/api/assets/staging`, {
        method: 'POST',
        headers: authHeaders,
        body: buildAssetFormData(payload),
      });
      if (!response.ok) throw await apiError(response, 'AI 자산 임시 저장에 실패했습니다.');
      const stagedAsset = await response.json();
      const stagedPayload = { ...payload, asset_id: stagedAsset.asset_id };
      setAssetDraftId(stagedAsset.asset_id);
      setAssetDraft((current) => ({ ...current, ...stagedPayload }));
      setAssetRegistryStep(1);
    } catch (error) {
      setAssetSubmitError(error.message);
    } finally {
      setIsStagingAssetSpec(false);
    }
  };
  const cloneAssetRepository = async () => {
    const livePayload = captureAssetDraft();
    const repoUrl = livePayload.repo_url || assetDraft.repo_url || '';
    const repoBranch = livePayload.repo_branch || assetDraft.repo_branch || '';
    if (!repoUrl) {
      setAssetRepoErrorMessage('Git URL을 입력하세요.');
      return;
    }
    setIsCloningAssetRepo(true);
    setAssetRepoErrorMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/assets/repository/clone`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl, repo_branch: repoBranch || null, asset_id: assetDraftId || assetDraft.asset_id || null }),
      });
      if (!response.ok) throw await apiError(response, 'Git 저장소를 연결하지 못했습니다.');
      const data = await response.json();
      setAssetDraftId(data.asset_id);
      setAssetRepoTree(data.tree || []);
      setSkillGenerationStatus('idle');
      setAssetSkillPlan(null);
      setSelectedSkillSlugs([]);
      setGeneratedAssetSkillFiles([]);
      setSelectedSkillFilePath('');
      setAssetDraft((current) => ({ ...current, asset_id: data.asset_id, repo_url: repoUrl, repo_branch: repoBranch }));
    } catch (error) {
      setAssetRepoTree([]);
      setAssetRepoErrorMessage(error.message);
    } finally {
      setIsCloningAssetRepo(false);
    }
  };
  const renderAssetRepoTree = (items) => (
    <ul>
      {items.map((item) => (
        <li key={item.path} className={item.type === 'directory' ? 'directory' : 'file'}>
          <span>{item.type === 'directory' ? 'DIR' : 'FILE'}</span>{item.name}
          {item.children?.length > 0 && renderAssetRepoTree(item.children)}
        </li>
      ))}
    </ul>
  );
  const submitAssetRegistration = async () => {
    setAssetSubmitError('');
    setIsSubmittingAsset(true);
    try {
      const livePayload = assetRegistryStep === 0 || assetRegistryStep === 1 ? captureAssetDraft() : {};
      const payload = attachAssetSlidesMeta(buildAssetPayload(livePayload), livePayload);
      validateAssetUploadSizes();
      const response = await fetch(`${API_BASE}/api/assets`, {
        method: 'POST',
        headers: authHeaders,
        body: buildAssetFormData(payload),
      });
      if (!response.ok) throw await apiError(response, 'AI 자산 등록에 실패했습니다.');
      await response.json();
      await loadMyAiAssets();
      setIsAssetRegistrySubmitted(true);
    } catch (error) {
      setAssetSubmitError(error.message);
    } finally {
      setIsSubmittingAsset(false);
    }
  };

  const applyDxSessionDetail = (detail) => {
    setActiveDxSessionId(detail.session_id);
    setDxMessages(detail.messages?.length ? dxMessagesFromApi(detail.messages) : dxInitialMessages);
    setDxDefinitionFields(detail.fields || null);
    setDxRecommendedDataIds(detail.recommended_data_ids || []);
    setDxRecommendedAssetIds(detail.recommended_asset_ids || []);
    setIsDxResultVisible(detail.status === '과제 발굴 완료');
  };

  const loadDxSessions = async () => {
    setIsLoadingDxSessions(true);
    setDxError('');
    try {
      const response = await fetch(`${API_BASE}/api/dx-discovery/sessions`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, 'DX 과제 발굴 이력을 불러오지 못했습니다.');
      const sessions = await response.json();
      setDxSessions(sessions);
      if (sessions.length > 0) {
        await openDxSession(sessions[0].session_id, false);
      } else {
        await createDxSession(false);
      }
    } catch (error) {
      setDxError(error.message);
    } finally {
      setIsLoadingDxSessions(false);
    }
  };

  const createDxSession = async (refreshList = true) => {
    setDxError('');
    setIsDxResultVisible(false);
    setDxDefinitionFields(null);
    setDxRecommendedDataIds([]);
    setDxRecommendedAssetIds([]);
    setDxMessages(dxInitialMessages);
    setDxInput('');
    try {
      const response = await fetch(`${API_BASE}/api/dx-discovery/sessions`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, '새 과제 발굴 세션을 만들지 못했습니다.');
      const detail = await response.json();
      applyDxSessionDetail(detail);
      if (refreshList) await loadDxSessions();
      else setDxSessions((current) => [detail, ...current]);
      return detail;
    } catch (error) {
      setDxError(error.message);
      return null;
    }
  };

  const openDxSession = async (sessionId, showLoading = true) => {
    if (!sessionId) return;
    if (showLoading) setIsLoadingDxSessions(true);
    setDxError('');
    try {
      const response = await fetch(`${API_BASE}/api/dx-discovery/sessions/${sessionId}`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, 'DX 과제 발굴 세션을 불러오지 못했습니다.');
      applyDxSessionDetail(await response.json());
    } catch (error) {
      setDxError(error.message);
    } finally {
      if (showLoading) setIsLoadingDxSessions(false);
    }
  };

  const deleteDxSession = async (sessionId, event) => {
    event.stopPropagation();
    if (!sessionId) return;
    try {
      const response = await fetch(`${API_BASE}/api/dx-discovery/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, 'DX 과제 발굴 이력을 삭제하지 못했습니다.');
      const nextSessions = dxSessions.filter((session) => session.session_id !== sessionId);
      setDxSessions(nextSessions);
      if (activeDxSessionId === sessionId) {
        if (nextSessions.length > 0) await openDxSession(nextSessions[0].session_id, false);
        else await createDxSession(false);
      }
    } catch (error) {
      setDxError(error.message);
    }
  };

  const submitDxMessage = async (event) => {
    event.preventDefault();
    const message = dxInput.trim();
    if (!message || isDxTyping) return;
    let sessionId = activeDxSessionId;
    if (!sessionId) {
      const created = await createDxSession(false);
      if (!created) return;
      sessionId = created.session_id;
    }
    const nextMessages = [...dxMessages, { role: 'user', text: message }];
    setDxMessages(nextMessages);
    setDxInput('');
    setDxError('');
    setIsDxResultVisible(false);
    setIsDxTyping(true);

    try {
      const response = await fetch(`${API_BASE}/api/dx-discovery/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!response.ok) throw await apiError(response, 'DX 과제 발굴 Agent 응답을 불러오지 못했습니다.');
      const detail = await response.json();
      applyDxSessionDetail(detail);
      setDxSessions((current) => [detail, ...current.filter((session) => session.session_id !== detail.session_id)]);
    } catch (error) {
      setDxError(error.message);
      setDxMessages((current) => [...current, { role: 'agent', text: '응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.' }]);
    } finally {
      setIsDxTyping(false);
    }
  };

  const resetDxDiscovery = () => {
    if (dxReplyTimerRef.current) window.clearTimeout(dxReplyTimerRef.current);
    dxReplyTimerRef.current = null;
    createDxSession();
  };


  const downloadDxDefinition = () => {
    const fields = resolveDxDocFields(dxDefinitionFields);
    const html = buildDxDefinitionHtml(fields);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `과제정의서_${dxFileSafeName(fields.project_title)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const loadAccounts = async () => {
    setIsLoadingAccounts(true);
    setAccountError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/users`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, '계정 목록을 불러오지 못했습니다.');
      setAccounts(await response.json());
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setIsLoadingAccounts(false);
    }
  };


  const loadNewsList = async () => {
    setIsLoadingNews(true);
    setNewsError('');
    try {
      const response = await fetch(`${API_BASE}/api/news`);
      if (!response.ok) throw await apiError(response, '뉴스 목록을 불러오지 못했습니다.');
      const data = await response.json();
      setNewsList(data);
    } catch (error) {
      setNewsError(error.message);
    } finally {
      setIsLoadingNews(false);
    }
  };

  const fetchNewsDetail = async (newsId, { countView = true } = {}) => {
    const response = await fetch(`${API_BASE}/api/news/${newsId}?count_view=${countView ? 'true' : 'false'}`);
    if (!response.ok) throw await apiError(response, '뉴스를 불러오지 못했습니다.');
    return response.json();
  };

  const loadNewsDetail = async (newsId) => {
    setNewsError('');
    try {
      const detail = await fetchNewsDetail(newsId);
      setSelectedNews(detail);
      setNewsList((current) => current.map((news) => (news.news_id === detail.news_id ? { ...news, view_count: detail.view_count } : news)));
      return detail;
    } catch (error) {
      setNewsError(error.message);
      setSelectedNews(null);
    }
  };

  const resetNewsForm = () => {
    setEditingNewsId('');
    setNewsTitle('');
    setNewsMarkdown('');
    setNewsSource('');
    setNewsCover(null);
  };

  const loadAiUsagePosts = async () => {
    setIsLoadingAiUsagePosts(true);
    setAiUsageError('');
    try {
      const response = await fetch(`${API_BASE}/api/usage-posts`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, 'AI 활용법 목록을 불러오지 못했습니다.');
      setAiUsagePosts(await response.json());
    } catch (error) {
      setAiUsageError(error.message);
    } finally {
      setIsLoadingAiUsagePosts(false);
    }
  };

  const loadAiUsagePostDetail = async (usagePostId, { countView = true, openDetail = true } = {}) => {
    setAiUsageError('');
    try {
      const response = await fetch(`${API_BASE}/api/usage-posts/${usagePostId}?count_view=${countView ? 'true' : 'false'}`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, 'AI 활용법 게시글을 불러오지 못했습니다.');
      const detail = await response.json();
      if (openDetail) setSelectedAiUsagePost(detail);
      setAiUsagePosts((current) => current.map((post) => (post.usage_post_id === detail.usage_post_id ? { ...post, ...detail, content_html: undefined } : post)));
      return detail;
    } catch (error) {
      setAiUsageError(error.message);
      if (openDetail) setSelectedAiUsagePost(null);
    }
  };

  const updateAiUsagePostInList = (updatedPost) => {
    setAiUsagePosts((current) => current.map((post) => (post.usage_post_id === updatedPost.usage_post_id ? { ...post, ...updatedPost } : post)));
    setSelectedAiUsagePost((current) => (current?.usage_post_id === updatedPost.usage_post_id ? { ...current, ...updatedPost } : current));
  };

  const publishNews = async (event) => {
    event.preventDefault();
    setNewsError('');
    setIsPublishingNews(true);

    if (!newsMarkdown.trim()) {
      setNewsError('본문을 입력하세요.');
      setIsPublishingNews(false);
      return;
    }

    const formData = new FormData();
    formData.append('title', newsTitle.trim());
    formData.append('markdown', newsMarkdown);
    if (newsCover) formData.append('cover_image', newsCover);

    try {
      const response = await fetch(`${API_BASE}/api/admin/news${editingNewsId ? `/${editingNewsId}` : ''}`, {
        method: editingNewsId ? 'PUT' : 'POST',
        headers: authHeaders,
        body: formData,
      });
      if (!response.ok) throw await apiError(response, editingNewsId ? '뉴스를 수정하지 못했습니다.' : '뉴스를 발행하지 못했습니다.');
      const saved = await response.json();
      resetNewsForm();
      await loadNewsList();
      setSelectedNewsId(saved.news_id);
    } catch (error) {
      setNewsError(error.message);
    } finally {
      setIsPublishingNews(false);
    }
  };


  const draftNewsMarkdown = async () => {
    setNewsError('');
    setIsDraftingNews(true);

    try {
      const response = await fetch(`${API_BASE}/api/admin/news/draft`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: newsSource.trim() }),
      });
      if (!response.ok) throw await apiError(response, '마크다운 초안을 생성하지 못했습니다.');

      const data = await response.json();
      const markdown = data.markdown || '';
      setNewsMarkdown(markdown);

      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      if (!newsTitle.trim() && titleMatch) setNewsTitle(titleMatch[1].trim());
    } catch (error) {
      setNewsError(error.message);
    } finally {
      setIsDraftingNews(false);
    }
  };

  const startEditNews = async (news) => {
    setNewsError('');
    try {
      const detail = await fetchNewsDetail(news.news_id, { countView: false });
      setEditingNewsId(detail.news_id);
      setNewsTitle(detail.title);
      setNewsMarkdown(detail.markdown || '');
      setNewsSource('');
      setNewsCover(null);
      setNewsAdminTab('write');
    } catch (error) {
      setNewsError(error.message);
    }
  };

  const deleteNews = async (news) => {
    if (!window.confirm(`${news.title} 뉴스를 삭제할까요?`)) return;
    setNewsError('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/news/${news.news_id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, '뉴스를 삭제하지 못했습니다.');
      if (selectedNewsId === news.news_id) setSelectedNewsId('');
      if (editingNewsId === news.news_id) resetNewsForm();
      await loadNewsList();
    } catch (error) {
      setNewsError(error.message);
    }
  };


  const loadAiIdeas = async () => {
    setIsLoadingAiIdeas(true);
    setAiIdeaError('');
    try {
      const response = await fetch(`${API_BASE}/api/ideas`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, '아이디어 목록을 불러오지 못했습니다.');
      setAiIdeas(await response.json());
    } catch (error) {
      setAiIdeaError(error.message);
    } finally {
      setIsLoadingAiIdeas(false);
    }
  };

  const loadAdminIdeas = async () => {
    setIsLoadingAdminIdeas(true);
    setAdminIdeaError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/ideas`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, '심사 아이디어 목록을 불러오지 못했습니다.');
      setAdminIdeas(await response.json());
    } catch (error) {
      setAdminIdeaError(error.message);
    } finally {
      setIsLoadingAdminIdeas(false);
    }
  };

  const openIdeaReviewForm = (idea) => {
    setIdeaReviewTarget(idea);
    setIdeaReviewForm({ status: idea.status === '선정' || idea.status === '미선정' ? idea.status : '', comment: idea.review_comment || '' });
    setAdminIdeaError('');
  };

  const closeIdeaReviewForm = () => {
    setIdeaReviewTarget(null);
    setIdeaReviewForm({ status: '', comment: '' });
  };

  const submitIdeaReview = async (event) => {
    event.preventDefault();
    if (!ideaReviewTarget) return;
    setAdminIdeaError('');
    setIsUpdatingIdeaStatus(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/ideas/${ideaReviewTarget.idea_id}/status`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: ideaReviewForm.status, review_comment: ideaReviewForm.comment.trim() }),
      });
      if (!response.ok) throw await apiError(response, '심사 상태를 변경하지 못했습니다.');
      const updatedIdea = await response.json();
      setAdminIdeas((current) => current.map((idea) => (idea.idea_id === updatedIdea.idea_id ? updatedIdea : idea)));
      setSelectedAiIdea((current) => (current?.idea_id === updatedIdea.idea_id ? updatedIdea : current));
      closeIdeaReviewForm();
    } catch (error) {
      setAdminIdeaError(error.message);
    } finally {
      setIsUpdatingIdeaStatus(false);
    }
  };

  const updateAiIdeaField = (field, value) => {
    setAiIdeaForm((current) => ({ ...current, [field]: value }));
    setAiIdeaMessage('');
    setAiIdeaError('');
  };

  const updateAiIdeaFiles = (files) => {
    setAiIdeaForm((current) => {
      const existingKeys = new Set(current.attachments.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const nextFiles = [...current.attachments];
      Array.from(files || []).forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          nextFiles.push(file);
        }
      });
      return { ...current, attachments: nextFiles };
    });
    setAiIdeaMessage('');
    setAiIdeaError('');
  };

  const removeAiIdeaFile = (index) => {
    setAiIdeaForm((current) => ({ ...current, attachments: current.attachments.filter((_, fileIndex) => fileIndex !== index) }));
    setAiIdeaMessage('');
    setAiIdeaError('');
  };

  const downloadIdeaAttachment = async (attachment) => {
    if (!attachment.url) return;
    setAiIdeaError('');
    try {
      const response = await fetch(`${API_BASE}${attachment.url}`, { headers: authHeaders });
      if (!response.ok) throw await apiError(response, '첨부파일을 내려받지 못했습니다.');
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = ideaAttachmentName(attachment);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setAiIdeaError(error.message);
    }
  };

  const deleteAiIdea = async () => {
    if (!ideaToDelete) return;
    setAiIdeaError('');
    try {
      const response = await fetch(`${API_BASE}/api/ideas/${ideaToDelete.idea_id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, '아이디어를 삭제하지 못했습니다.');
      setAiIdeas((current) => current.filter((idea) => idea.idea_id !== ideaToDelete.idea_id));
      if (selectedAiIdea?.idea_id === ideaToDelete.idea_id) setSelectedAiIdea(null);
      setIdeaToDelete(null);
    } catch (error) {
      setAiIdeaError(error.message);
    }
  };

  const submitAiIdea = async (event) => {
    event.preventDefault();
    setAiIdeaError('');
    setAiIdeaMessage('');
    setIsSubmittingAiIdea(true);

    const formData = new FormData();
    formData.append('title', aiIdeaForm.title.trim());
    formData.append('problem_definition', aiIdeaForm.problem_definition.trim());
    formData.append('proposal', aiIdeaForm.proposal.trim());
    formData.append('effect', aiIdeaForm.effect.trim());
    aiIdeaForm.attachments.forEach((file) => formData.append('attachments', file));

    try {
      const response = await fetch(`${API_BASE}/api/ideas`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });
      if (!response.ok) throw await apiError(response, '아이디어를 접수하지 못했습니다.');
      const createdIdea = await response.json();
      setAiIdeas((current) => [createdIdea, ...current]);
      setAiIdeaForm(emptyAiIdeaForm);
      setAiIdeaMessage('DX추진랩에 아이디어가 접수되었습니다.');
      setIsAiIdeaSuccessOpen(true);
    } catch (error) {
      setAiIdeaError(error.message);
    } finally {
      setIsSubmittingAiIdea(false);
    }
  };

  const updateAiUsageField = (field, value) => {
    setAiUsageForm((current) => ({ ...current, [field]: value }));
  };

  const syncAiUsageEditor = () => {
    updateAiUsageField('content', aiUsageEditorRef.current?.innerHTML || '');
  };

  const selectionIsInsideAiUsageEditor = () => {
    const editor = aiUsageEditorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return false;
    const node = selection.anchorNode;
    return Boolean(node && editor.contains(node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode));
  };

  const rememberAiUsageSelection = () => {
    const selection = window.getSelection();
    if (!selectionIsInsideAiUsageEditor() || !selection || selection.rangeCount === 0) return;
    aiUsageSelectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreAiUsageSelection = () => {
    const editor = aiUsageEditorRef.current;
    const range = aiUsageSelectionRef.current;
    const selection = window.getSelection();
    if (!editor || !range || !selection) {
      editor?.focus();
      return null;
    }
    editor.focus();
    selection.removeAllRanges();
    selection.addRange(range);
    return range;
  };

  const updateAiUsageEditorFormat = () => {
    if (!selectionIsInsideAiUsageEditor()) return;
    rememberAiUsageSelection();
    const rawColor = document.queryCommandValue('foreColor');
    setAiUsageEditorFormat((current) => ({
      ...current,
      bold: document.queryCommandState('bold'),
      underline: document.queryCommandState('underline'),
      color: rawColor || current.color,
    }));
  };

  const applyAiUsageInlineStyle = (createWrapper, fallbackCommand, fallbackValue = null) => {
    const editor = aiUsageEditorRef.current;
    const range = restoreAiUsageSelection();
    if (!editor || !range) return;

    if (!range.collapsed && editor.contains(range.commonAncestorContainer)) {
      const wrapper = createWrapper();
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
      const nextRange = document.createRange();
      nextRange.selectNodeContents(wrapper);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      aiUsageSelectionRef.current = nextRange.cloneRange();
    } else {
      document.execCommand(fallbackCommand, false, fallbackValue);
      rememberAiUsageSelection();
    }

    syncAiUsageEditor();
    updateAiUsageEditorFormat();
  };

  const applyAiUsageBold = () => {
    applyAiUsageInlineStyle(() => document.createElement('strong'), 'bold');
  };

  const applyAiUsageUnderline = () => {
    applyAiUsageInlineStyle(() => document.createElement('u'), 'underline');
  };

  const applyAiUsageColor = (color) => {
    applyAiUsageInlineStyle(() => {
      const span = document.createElement('span');
      span.style.color = color;
      return span;
    }, 'foreColor', color);
    setAiUsageEditorFormat((current) => ({ ...current, color }));
    setIsAiUsageColorOpen(false);
  };

  const handleAiUsagePaste = (event) => {
    const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      document.execCommand('insertImage', false, reader.result);
      syncAiUsageEditor();
    };
    reader.readAsDataURL(file);
  };

  const closeAiUsageComposer = () => {
    setIsAiUsageComposerOpen(false);
    setEditingAiUsagePostId('');
    setAiUsageForm(emptyAiUsageForm);
    if (aiUsageEditorRef.current) aiUsageEditorRef.current.innerHTML = '';
    aiUsageSelectionRef.current = null;
    setIsAiUsageColorOpen(false);
    setAiUsageEditorFormat({ bold: false, underline: false, color: '#243047' });
  };

  const openAiUsageComposer = () => {
    setEditingAiUsagePostId('');
    setAiUsageForm(emptyAiUsageForm);
    if (aiUsageEditorRef.current) aiUsageEditorRef.current.innerHTML = '';
    setIsAiUsageComposerOpen(true);
  };

  const startEditAiUsagePost = async (post, event) => {
    event?.stopPropagation();
    setAiUsageError('');
    try {
      const detail = post.content_html ? post : await loadAiUsagePostDetail(post.usage_post_id, { countView: false, openDetail: false });
      setEditingAiUsagePostId(detail.usage_post_id);
      setAiUsageForm({ title: detail.title, category: detail.category, content: detail.content_html || '' });
      setSelectedAiUsagePostId('');
      setSelectedAiUsagePost(null);
      setIsAiUsageComposerOpen(true);
      window.requestAnimationFrame(() => {
        if (aiUsageEditorRef.current) aiUsageEditorRef.current.innerHTML = withApiAssetUrls(detail.content_html || '');
      });
    } catch (error) {
      setAiUsageError(error.message);
    }
  };

  const submitAiUsagePost = async (event) => {
    event.preventDefault();
    const content = aiUsageEditorRef.current?.innerHTML || aiUsageForm.content;
    const cleanContent = content.trim();
    if (!cleanContent || cleanContent === '<br>') return;

    setIsSavingAiUsagePost(true);
    setAiUsageError('');
    try {
      const response = await fetch(`${API_BASE}/api/usage-posts${editingAiUsagePostId ? `/${editingAiUsagePostId}` : ''}`, {
        method: editingAiUsagePostId ? 'PUT' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiUsageForm.title.trim(),
          category: aiUsageForm.category,
          content_html: cleanContent,
        }),
      });
      if (!response.ok) throw await apiError(response, editingAiUsagePostId ? 'AI 활용법 게시글을 수정하지 못했습니다.' : 'AI 활용법 게시글을 저장하지 못했습니다.');
      const savedPost = await response.json();
      if (editingAiUsagePostId) updateAiUsagePostInList(savedPost);
      else setAiUsagePosts((current) => [{ ...savedPost, content_html: undefined }, ...current]);
      closeAiUsageComposer();
    } catch (error) {
      setAiUsageError(error.message);
    } finally {
      setIsSavingAiUsagePost(false);
    }
  };

  const toggleAiUsageLike = async (postId, event) => {
    event?.stopPropagation();
    setAiUsageError('');
    try {
      const response = await fetch(`${API_BASE}/api/usage-posts/${postId}/like`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, '좋아요를 반영하지 못했습니다.');
      updateAiUsagePostInList(await response.json());
    } catch (error) {
      setAiUsageError(error.message);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: loginId.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '로그인에 실패했습니다.');

      window.localStorage.setItem('ailounge_token', data.access_token);
      setAuthToken(data.access_token);
      setAuthUser(data.user);
      setActivePage(data.user.is_admin ? 'accounts' : 'home');
      setPassword('');
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('ailounge_token');
    setAuthToken('');
    setAuthUser(null);
    setLoginId('');
    setPassword('');
    setActivePage('home');
    setAccounts([]);
    setAccountForm(emptyAccountForm);
    setEditingUserId('');
    setOrgFilter('all');
    setNewsList([]);
    setSelectedNewsId('');
    setSelectedNews(null);
    setNewsTitle('');
    setNewsMarkdown('');
    setNewsSource('');
    setNewsCover(null);
  };

  const toggleGroup = (group) => {
    setActivePage(group.defaultPage);
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(group.id)) next.delete(group.id);
      else next.add(group.id);
      return next;
    });
  };

  const updateAccountField = (field, value) => {
    setAccountForm((current) => ({ ...current, [field]: value }));
  };

  const resetAccountForm = () => {
    setAccountForm(emptyAccountForm);
    setEditingUserId('');
    setAccountError('');
  };

  const startEditAccount = (account) => {
    setEditingUserId(account.user_id);
    setAccountForm({
      login_id: account.login_id,
      email: account.email,
      org_name: account.org_name,
      displayed_name: account.displayed_name,
      job_title: account.job_title,
      password: '',
      is_admin: account.is_admin,
    });
    setAccountError('');
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setAccountError('');
    setIsSavingAccount(true);

    const payload = {
      login_id: accountForm.login_id.trim(),
      email: accountForm.email.trim(),
      org_name: accountForm.org_name.trim(),
      displayed_name: accountForm.displayed_name.trim(),
      job_title: accountForm.job_title.trim(),
      password: accountForm.password,
      is_admin: accountForm.is_admin,
    };
    if (editingUserId && !payload.password) delete payload.password;

    try {
      const response = await fetch(`${API_BASE}/api/admin/users${editingUserId ? `/${editingUserId}` : ''}`, {
        method: editingUserId ? 'PUT' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw await apiError(response, '계정을 저장하지 못했습니다.');
      resetAccountForm();
      await loadAccounts();
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setIsSavingAccount(false);
    }
  };

  const deleteAccount = async (account) => {
    if (!window.confirm(`${account.displayed_name} 계정을 삭제할까요?`)) return;
    setAccountError('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${account.user_id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, '계정을 삭제하지 못했습니다.');
      await loadAccounts();
    } catch (error) {
      setAccountError(error.message);
    }
  };

  const renderAssetCatalogDetailTab = () => {
    const asset = selectedCatalogAsset;
    if (!asset || isLoadingCatalogDetail) return <div className="asset-catalog-detail-loading"><span className="loading-spinner" /> 자산 정보를 불러오고 있습니다.</div>;
    if (catalogDetailError) return <div className="asset-catalog-detail-error">{catalogDetailError}</div>;
    if (selectedCatalogTab === 'overview') return (
      <div className="asset-detail-definition">
        <section className="problem"><header><span>01</span>문제 정의</header><p>{asset.problem_definition}</p></section>
        <div className="asset-detail-workflow"><section><header><span>02</span>As-Is Workflow</header><p>{asset.as_is_workflow}</p></section><ArrowRight size={20} /><section><header><span>03</span>To-Be Workflow</header><p>{asset.to_be_workflow}</p></section></div>
        <section className="effect"><header><span>04</span>AI 개선 효과</header><p>{asset.ai_effect}</p></section>
      </div>
    );
    if (selectedCatalogTab === 'tech') return (
      <div className="asset-detail-stack">
        <section><h3>모델 / 알고리즘</h3>{(asset.models || []).length ? asset.models.map((item, index) => <article key={index}><b>{item.model_name || item.name}</b><p>{item.description}</p>{item.reference_url && <a href={item.reference_url} target="_blank" rel="noreferrer">참조 링크 <ExternalLink size={12} /></a>}</article>) : <p className="asset-detail-empty-copy">등록된 모델 정보가 없습니다.</p>}</section>
        <section><h3>기술 스택</h3>{(asset.tech_stacks || []).length ? asset.tech_stacks.map((item, index) => <article key={index}><b>{item.stack_name || item.name}</b><p>{item.description}</p>{item.reference_url && <a href={item.reference_url} target="_blank" rel="noreferrer">참조 링크 <ExternalLink size={12} /></a>}</article>) : <p className="asset-detail-empty-copy">등록된 기술 스택 정보가 없습니다.</p>}</section>
      </div>
    );
    if (selectedCatalogTab === 'data') return (
      <div className="asset-detail-data">
        <section className="asset-detail-copy"><h3>데이터 설명</h3><p>{asset.has_data ? (asset.data_description || '등록된 데이터 설명이 없습니다.') : '이 자산은 별도 데이터 첨부 없이 활용할 수 있습니다.'}</p>{asset.data_type && <span>{asset.data_type}</span>}</section>
        {asset.has_data && <section><h3>샘플 데이터</h3><div className="asset-detail-download-list">{(asset.data_files || []).map((file) => <article key={file.data_file_id}><Database size={18} /><div><b>{file.file_name}</b><span>{file.data_role === 'train' ? '학습' : file.data_role === 'validation' ? '검증' : '샘플'} · {formatAssetFileSize(file.file_size)}</span></div><button type="button" onClick={() => downloadCatalogFile(file.download_url, file.file_name)}><Download size={14} />Download</button></article>)}</div>{!(asset.data_files || []).length && <p className="asset-detail-empty-copy">첨부된 샘플 데이터가 없습니다.</p>}</section>}
      </div>
    );
    if (selectedCatalogTab === 'performance') return (
      <div className="asset-detail-performance">
        <section className="asset-performance-section">
          <header className="asset-performance-title"><div><span>WORKFLOW IMPACT</span><h3>Before / After 비교</h3></div><small>{(asset.before_after_metrics || []).length}개 개선 항목</small></header>
          {(asset.before_after_metrics || []).length ? (
            <div className="asset-performance-comparisons">
              {asset.before_after_metrics.map((item, index) => (
                <article key={index}>
                  <div className="asset-performance-metric"><span>{String(index + 1).padStart(2, '0')}</span><b>{item.metric_name}</b><em>{item.improvement_rate}</em></div>
                  <div className="asset-performance-values"><div className="before"><small>BEFORE</small><strong>{item.before_value}</strong></div><span className="asset-performance-arrow"><ArrowRight size={17} /></span><div className="after"><small>AFTER</small><strong>{item.after_value}</strong></div></div>
                </article>
              ))}
            </div>
          ) : <p className="asset-detail-empty-copy">등록된 비교 지표가 없습니다.</p>}
        </section>
        <section className="asset-performance-section">
          <header className="asset-performance-title"><div><span>PERFORMANCE KPI</span><h3>성능 지표</h3></div></header>
          {(asset.performance_metrics || []).length ? (
            <div className="asset-performance-kpis">
              {asset.performance_metrics.map((item, index) => (
                <article key={index}><div className="asset-kpi-icon"><CheckCircle2 size={18} /></div><div className="asset-kpi-copy"><span>{item.metric_name}</span><p>{item.description}</p></div><b>{item.value}</b></article>
              ))}
            </div>
          ) : <p className="asset-detail-empty-copy">등록된 성능 지표가 없습니다.</p>}
        </section>
      </div>
    );
    if (selectedCatalogTab === 'demo') {
      const slides = asset.slides || [];
      const slide = slides[catalogSlideIndex] || slides[0];
      return slide ? <div className="asset-detail-demo"><div className="asset-demo-stage"><img src={API_BASE + slide.url} alt={slide.caption || asset.asset_name} /></div><div className="asset-demo-caption"><span>{String(catalogSlideIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span><div><b>{slide.caption || '자산 활용 화면'}</b><p>{slide.description}</p></div><div><button type="button" aria-label="이전 이미지" disabled={catalogSlideIndex === 0} onClick={() => setCatalogSlideIndex((index) => index - 1)}>←</button><button type="button" aria-label="다음 이미지" disabled={catalogSlideIndex >= slides.length - 1} onClick={() => setCatalogSlideIndex((index) => index + 1)}>→</button></div></div></div> : <div className="asset-detail-empty"><Layers3 size={26} /><b>등록된 자산 활용 화면이 없습니다.</b></div>;
    }
    if (selectedCatalogTab === 'qa') {
      const questions = assetQaThreads[asset.asset_id] || [];
      return (
        <section className="asset-qa">
          <header className="asset-qa-head"><span>ASSET Q&amp;A</span><h3>Q&amp;A · 적용 경험 공유</h3><p>자산 담당자와 사용자들이 적용 방법, 데이터 구조, 성능 기준과 운영 경험을 나누는 공간입니다.</p></header>
          <form className="asset-qa-compose" onSubmit={submitAssetQaQuestion}>
            <div className="asset-qa-avatar"><UserRound size={18} /></div>
            <div><textarea value={assetQaDraft} onChange={(event) => setAssetQaDraft(event.target.value)} placeholder="이 자산의 적용 방법, 데이터 구조, 성능 기준에 대해 질문해 보세요." /><footer><span>{authUser?.org_name} · {authUser?.displayed_name}</span><button type="submit" disabled={isSavingAssetQa || !assetQaDraft.trim()}><MessageCircle size={14} />{isSavingAssetQa ? '등록 중...' : '질문 등록'}</button></footer></div>
          </form>
          {assetQaError && <div className="asset-qa-error">{assetQaError}</div>}
          {isLoadingAssetQa ? <div className="asset-qa-state"><span className="loading-spinner" /> Q&amp;A를 불러오고 있습니다.</div> : questions.length === 0 ? <div className="asset-qa-state empty"><MessageCircle size={23} /><b>아직 등록된 질문이 없습니다</b><span>이 자산에 대해 궁금한 내용을 첫 질문으로 남겨보세요.</span></div> : (
            <div className="asset-qa-list">
              {questions.map((question) => (
                <article className="asset-qa-item" key={question.qa_post_id}>
                  <div className="asset-qa-avatar"><UserRound size={17} /></div>
                  <div className="asset-qa-content">
                    <header><div><b>{question.writer_name}</b>{question.writer_job_title && <em>{question.writer_job_title}</em>}</div><div className="asset-qa-question-meta"><span>{formatDate(question.created_at)} · {question.topic}</span>{question.can_edit && <div className="asset-qa-question-tools"><button type="button" aria-label="질문 수정" onClick={() => startEditAssetQaQuestion(question)}><Pencil size={12} /></button><button className="delete" type="button" aria-label="질문 삭제" disabled={deletingAssetQaQuestionId === question.qa_post_id} onClick={() => deleteAssetQaQuestion(question)}><Trash2 size={12} /></button></div>}</div></header>
                    {editingAssetQaQuestionId === question.qa_post_id ? <form className="asset-qa-question-edit" onSubmit={(event) => saveAssetQaQuestion(event, question.qa_post_id)}><textarea autoFocus value={assetQaQuestionEditDraft} onChange={(event) => setAssetQaQuestionEditDraft(event.target.value)} /><div><button type="button" disabled={isSavingAssetQa} onClick={() => setEditingAssetQaQuestionId('')}>취소</button><button type="submit" disabled={isSavingAssetQa || !assetQaQuestionEditDraft.trim()}>{isSavingAssetQa ? '저장 중...' : '수정 완료'}</button></div></form> : <p>{question.content}</p>}
                    {question.replies.map((reply) => (
                      <div className="asset-qa-reply" key={reply.qa_post_id}>
                        <header><b>{reply.writer_name}</b>{reply.writer_job_title && <em>{reply.writer_job_title}</em>}{reply.is_owner && <span>자산 담당자</span>}<small>{formatDate(reply.created_at)}</small>{reply.can_edit && <div className="asset-qa-reply-tools"><button type="button" aria-label="답글 수정" onClick={() => startEditAssetQaReply(reply)}><Pencil size={12} /></button><button className="delete" type="button" aria-label="답글 삭제" disabled={deletingAssetQaReplyId === reply.qa_post_id} onClick={() => deleteAssetQaReply(question.qa_post_id, reply)}><Trash2 size={12} /></button></div>}</header>
                        {editingAssetQaReplyId === reply.qa_post_id ? <form className="asset-qa-reply-edit" onSubmit={(event) => saveAssetQaReply(event, question.qa_post_id)}><textarea autoFocus value={assetQaEditDraft} onChange={(event) => setAssetQaEditDraft(event.target.value)} /><div><button type="button" disabled={isSavingAssetQa} onClick={() => setEditingAssetQaReplyId('')}>취소</button><button type="submit" disabled={isSavingAssetQa || !assetQaEditDraft.trim()}>{isSavingAssetQa ? '저장 중...' : '수정 완료'}</button></div></form> : <p>{reply.content}</p>}
                      </div>
                    ))}
                    <div className="asset-qa-actions"><button className={question.helpful_by_me ? 'active' : ''} type="button" onClick={() => toggleAssetQaHelpful(question)}><ThumbsUp size={13} fill={question.helpful_by_me ? 'currentColor' : 'none'} />도움돼요 {question.helpful_count}</button><button type="button" onClick={() => openAssetQaReply(question.qa_post_id)}>답글</button></div>
                    {assetQaReplyTarget === question.qa_post_id && <form className="asset-qa-reply-compose" onSubmit={(event) => submitAssetQaReply(event, question.qa_post_id)}><textarea autoFocus value={assetQaReplyDraft} onChange={(event) => setAssetQaReplyDraft(event.target.value)} placeholder="답글을 작성하세요." /><div><button type="button" disabled={isSavingAssetQa} onClick={() => setAssetQaReplyTarget('')}>취소</button><button type="submit" disabled={isSavingAssetQa || !assetQaReplyDraft.trim()}>{isSavingAssetQa ? '등록 중...' : '답글 등록'}</button></div></form>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      );
    }
    if (selectedCatalogTab === 'diffusion-cases') {
      const cases = assetDiffusionCases[asset.asset_id] || [];
      return (
        <div className="asset-diffusion-cases">
          <header className="asset-diffusion-case-toolbar">
            <div><span>DIFFUSION CASES</span><h3>확산 사례 목록 <small>· 총 {cases.length}건</small></h3></div>
            <button type="button" onClick={openDiffusionCaseForm}><Plus size={14} />사례 등록</button>
          </header>
          {isLoadingDiffusionCases ? (
            <div className="asset-diffusion-case-state"><span className="loading-spinner" /> 확산 사례를 불러오고 있습니다.</div>
          ) : diffusionCaseError && !isDiffusionCaseFormOpen ? (
            <div className="asset-diffusion-case-state error"><span>{diffusionCaseError}</span><button type="button" onClick={() => loadAssetDiffusionCases(asset.asset_id)}>다시 시도</button></div>
          ) : cases.length === 0 ? (
            <div className="asset-diffusion-case-empty"><GitBranch size={25} /><b>아직 등록된 확산 사례가 없습니다</b><p>이 자산을 업무에 적용한 경험을 첫 사례로 공유해보세요.</p></div>
          ) : (
            <div className="asset-diffusion-case-list">
              {cases.map((item) => (
                <article className="asset-diffusion-case-card" key={item.diffusion_case_id}>
                  <header>
                    <div><span>{item.writer_org}</span><h4>{item.title}</h4><small>{item.writer_name}{item.writer_job_title ? ` ${item.writer_job_title}` : ''} · {formatDate(item.created_at)}</small></div>
                    <div className="asset-diffusion-case-card-tools">
                      <em className={`stage-${item.stage}`}>{item.stage_label}</em>
                      {item.can_edit && <span><button type="button" aria-label="확산 사례 수정" onClick={() => startEditDiffusionCase(item)}><Pencil size={13} /></button><button className="delete" type="button" aria-label="확산 사례 삭제" disabled={deletingDiffusionCaseId === item.diffusion_case_id} onClick={() => deleteDiffusionCase(item)}><Trash2 size={13} /></button></span>}
                    </div>
                  </header>
                  <div className="asset-diffusion-case-fields">
                    <section><b>적용 업무</b><p>{item.applied_work}</p></section>
                    <section><b>수정·활용 방식</b><p>{item.customization}</p></section>
                    <section><b>적용 효과</b><p>{item.effect}</p></section>
                  </div>
                  {item.git_url && <footer><GitBranch size={14} /><code>{item.git_url}</code><button type="button" onClick={() => copyTextToClipboard(item.git_url).catch(() => {})}>Copy</button></footer>}
                </article>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="asset-detail-diffusion">
        <section className="asset-vibe-guide"><span>VIBE CODING GUIDE</span><h3>Claude와 함께 우리 업무에 맞게 확산하세요</h3><p>Git 저장소와 확산 패키지를 준비한 뒤, 업무 환경과 데이터 구조에 맞춰 자연어로 변경 사항을 요청할 수 있습니다.</p><ol>{['Git 저장소를 내려받아 프로젝트 폴더를 준비합니다.', 'Skills ZIP을 내려받아 프로젝트 루트에 압축 해제합니다.', 'Claude Coding Agent에서 프로젝트를 열어 자산 구조를 확인합니다.', '적용 업무, 데이터 경로, 운영 환경과 검증 기준을 설명합니다.', '수정된 코드를 실행하고 실제 업무 기준으로 결과를 검증합니다.'].map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol></section>
        <div className="asset-diffusion-actions"><section><GitBranch size={20} /><div><b>Git 저장소</b><p>{asset.repo_url || '등록된 Git 주소가 없습니다.'}</p></div>{asset.repo_url && <button className={isCatalogRepoCopied ? 'copied' : ''} type="button" onClick={() => copyCatalogRepositoryUrl(asset.repo_url)}>{isCatalogRepoCopied ? 'Copied' : 'Copy'}</button>}</section><section><Download size={20} /><div><b>확산 패키지</b><p>CLAUDE.md와 재사용 가능한 Skills를 포함합니다.</p></div><button type="button" disabled={!asset.skill_download_url} onClick={() => downloadCatalogFile(asset.skill_download_url, asset.asset_name + '_skills.zip')}>Download</button></section></div>
      </div>
    );
  };

  if (isCheckingSession) {
    return (
      <div className="login-shell">
        <div className="session-loading">
          <span className="loading-spinner" />
          <b>세션 확인 중</b>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <main className="login-shell">
        <section className="login-panel" aria-label="AI Lounge 로그인">
          <div className="login-brand">
            <span className="wia-mark login-wia-mark">WIA</span>
            <div>
              <b>AI Lounge</b>
              <p>HYUNDAI WIA AI 자산과 업무 도구를 한 곳에서 연결합니다.</p>
            </div>
          </div>

          <form className="login-card" onSubmit={handleLogin}>
            <div className="login-card-head">
              <span>SECURE ACCESS</span>
              <h1>AI Lounge 로그인</h1>
              <p>사번과 비밀번호로 접속하세요.</p>
            </div>

            {loginError && <div className="login-error">{loginError}</div>}

            <label className="login-field">
              <span><UserRound size={14} /> 사번</span>
              <input autoComplete="username" value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="사번" required />
            </label>

            <label className="login-field">
              <span><KeyRound size={14} /> 비밀번호</span>
              <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password" required />
            </label>

            <button className="login-submit primary-btn" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? <span className="btn-spinner" /> : <LogIn size={16} />}
              로그인
            </button>
          </form>
        </section>
      </main>
    );
  }

  const dxDocFields = resolveDxDocFields(dxDefinitionFields);
  const introBusinessMax = Math.max(1, ...(introSummary?.business_distribution || []).map((item) => Number(item.count || 0)));
  const introActivityMax = Math.max(1, ...(introSummary?.monthly_activity || []).flatMap((item) => [Number(item.registrations || 0), Number(item.downloads || 0)]));

  return (
    <div className="portal-shell">
      <aside className="sidebar" aria-label="AI Lounge 사이드 메뉴">
        <div className="side-logo">
          <span className="wia-mark">WIA</span>
          <span className="logo-title">AI Lounge</span>
        </div>

        <nav className="side-nav">
          {isAdminView ? (
            <>
              <button className={`side-item ${adminPage === 'accounts' ? 'active' : ''}`} type="button" onClick={() => { setNewsError(''); setActivePage('accounts'); }}>
                <ShieldCheck size={17} />
                <span className="side-name">계정 관리</span>
              </button>
              <button className={"side-item " + (adminPage === "asset-management" ? "active" : "")} type="button" onClick={() => { setAccountError(""); setNewsError(""); setActivePage("asset-management"); }}>
                <Bot size={17} />
                <span className="side-name">AI 자산 관리</span>
              </button>
              <button className={`side-item ${adminPage === 'tech-news-write' ? 'active' : ''}`} type="button" onClick={() => { setAccountError(''); setActivePage('tech-news-write'); }}>
                <Newspaper size={17} />
                <span className="side-name">Tech News 작성하기</span>
              </button>
              <button className={`side-item ${adminPage === 'idea-review' ? 'active' : ''}`} type="button" onClick={() => { setAccountError(''); setNewsError(''); setActivePage('idea-review'); }}>
                <FilePenLine size={17} />
                <span className="side-name">Idea 심사</span>
              </button>
            </>
          ) : (
            <>
              <button className={`side-item ${activePage === 'home' ? 'active' : ''}`} type="button" onClick={() => setActivePage('home')}>
                <Home size={17} />
                <span className="side-name">Home</span>
              </button>

              {navGroups.map((group) => {
                const Icon = group.icon;
                const hasItems = group.items.length > 0;
                const isDisabled = Boolean(group.disabled);
                const isOpen = !isDisabled && hasItems && openGroups.has(group.id);
                const isActive = !isDisabled && (activePage === group.defaultPage || group.items.some((item) => item.id === activePage));

                return (
                  <div className="side-group" key={group.id}>
                    <button className={`side-item side-group-btn ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`} type="button" aria-expanded={isOpen} disabled={isDisabled} onClick={() => (hasItems ? toggleGroup(group) : setActivePage(group.defaultPage))}>
                      <Icon size={17} />
                      {group.status ? (
                        <span className="side-label-wrap">
                          <span className="side-name">{group.label}</span>
                          <span className="side-status">{group.status}</span>
                        </span>
                      ) : (
                        <span className="side-name">{group.label}</span>
                      )}
                      {!isDisabled && hasItems && <ChevronDown className={`chev ${isOpen ? 'open' : ''}`} size={14} />}
                    </button>
                    {!isDisabled && hasItems && isOpen && (
                      <div className="side-subnav">
                        {group.items.map((item) => (
                          <button className={`side-subitem ${activePage === item.id ? 'active' : ''}`} key={item.id} type="button" onClick={() => setActivePage(item.id)}>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="side-divider" />

              {externalLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a className="side-item side-external-link" href={link.href} key={link.label} target="_blank" rel="noreferrer">
                    <Icon size={17} />
                    <span className="side-name">{link.label}</span>
                    <ExternalLink className="side-ext-ico" size={13} />
                  </a>
                );
              })}
            </>
          )}
        </nav>

        <div className="side-user">
          <div className="avatar">{authUser.displayed_name?.slice(0, 1) || 'W'}</div>
          <div className="side-user-info">
            <div className="side-user-name">
              <b>{authUser.displayed_name}</b>
              <em title={authUser.job_title}>· {authUser.job_title}</em>
            </div>
            <div className="side-user-meta">
              <span title={authUser.org_name}><Building2 size={11} /><em>{authUser.org_name}</em></span>
            </div>
          </div>
          <button className="side-logout" type="button" aria-label="로그아웃" onClick={handleLogout}>
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <main className="main" aria-label="콘텐츠 영역">
        {!isAdminView && activePage === 'intro' && (
          <section className="content ai-intro-page" aria-label="AI STUDIO 소개">
            <section className="ai-intro-hero">
              <div className="ai-intro-hero-copy">
                <span>AI STUDIO</span>
                <h1>검증된 AI를<br />전사의 실행력으로.</h1>
                <p>업무 과제를 구체화하고, 완성된 AI 자산을 등록·탐색·확산해 개인의 개발 결과를 조직의 역량으로 연결합니다.</p>
              </div>
            </section>

            <nav className="ai-intro-entry-grid" aria-label="AI STUDIO 주요 기능">
              <button type="button" onClick={() => setActivePage('dx-discovery')}>
                <span className="ai-intro-entry-icon"><Sparkles size={20} /></span>
                <small>01 · DEFINE</small><b>업무 과제 구체화</b>
                <p>Agent와 대화하며 현장의 문제를 실행 가능한 DX 과제로 구체화합니다.</p>
                <em>DX 과제 발굴로 이동 <ArrowRight size={13} /></em>
              </button>
              <button type="button" onClick={() => setActivePage('explore')}>
                <span className="ai-intro-entry-icon"><Search size={20} /></span>
                <small>02 · REUSE</small><b>검증 자산 탐색·확산</b>
                <p>승인된 운영 자산을 업무와 기술 기준으로 찾고 코드·Skill과 적용 경험을 확인합니다.</p>
                <em>AI 자산 탐색으로 이동 <ArrowRight size={13} /></em>
              </button>
              <button type="button" onClick={() => setActivePage('registry')}>
                <span className="ai-intro-entry-icon"><Plus size={20} /></span>
                <small>03 · SHARE</small><b>완성 자산 등록·공유</b>
                <p>코드·데이터·활용 화면과 확산 패키지를 갖춘 재사용 가능한 자산으로 등록합니다.</p>
                <em>AI 자산 등록으로 이동 <ArrowRight size={13} /></em>
              </button>
            </nav>

            <section className="ai-intro-section">
              <header className="ai-intro-section-head">
                <span>WHY AI STUDIO</span>
                <h2>AI 개발 결과가 조직의 자산이 되는 구조</h2>
                <p>과제 발굴부터 검증된 자산의 재사용과 현업 확산까지 하나의 흐름으로 연결합니다.</p>
              </header>
              <div className="ai-intro-value-grid">
                <article><div><Sparkles size={18} /></div><small>01 · 발굴</small><h3>막연한 문제를 과제로</h3><p>대화를 통해 업무 방식과 Pain Point를 정리하고 과제 정의서로 구체화합니다.</p></article>
                <article><div><ShieldCheck size={18} /></div><small>02 · 등록</small><h3>검증 가능한 자산화</h3><p>명세, 저장소, 데이터, 성능과 활용 화면을 함께 관리해 신뢰할 수 있는 자산을 만듭니다.</p></article>
                <article><div><Layers3 size={18} /></div><small>03 · 탐색</small><h3>필요한 자산을 빠르게</h3><p>업무 영역, Task, 구현 방식과 데이터 유형을 기준으로 운영 자산을 탐색합니다.</p></article>
                <article><div><GitBranch size={18} /></div><small>04 · 확산</small><h3>적용 경험까지 축적</h3><p>Skill과 저장소를 활용해 확산을 시도하고 실제 적용 사례와 Q&amp;A를 다시 공유합니다.</p></article>
              </div>
            </section>

            <section className="ai-intro-process">
              <header className="ai-intro-section-head">
                <span>DIFFUSION PROCESS</span>
                <h2>AI 자산 확산의 4단계</h2>
                <p>새로운 과제를 찾는 순간부터 현업 적용 경험이 다시 플랫폼에 쌓일 때까지 이어집니다.</p>
              </header>
              <ol>
                <li><span>01</span><div><b>과제 발굴</b><p>업무 문제와 기대 효과를 정의합니다.</p></div></li>
                <li><span>02</span><div><b>등록·심사</b><p>자산을 명세화하고 거버넌스 검토를 거칩니다.</p></div></li>
                <li><span>03</span><div><b>탐색·확산 시도</b><p>적합한 자산의 코드와 Skill을 업무에 적용합니다.</p></div></li>
                <li><span>04</span><div><b>적용·사례 공유</b><p>성과와 수정 방식을 남겨 확산 완료로 연결합니다.</p></div></li>
              </ol>
            </section>

            <section className="ai-intro-section ai-intro-impact">
              <header className="ai-intro-section-head">
                <span>AI ASSET IMPACT</span>
                <h2>AI 자산 운영 현황</h2>
                <p>현재 운영 중인 자산의 탐색과 확산 활동을 실제 데이터로 확인합니다.</p>
              </header>

              {isLoadingIntroSummary && <div className="ai-intro-status"><span className="loading-spinner" /> 운영 현황을 불러오고 있습니다.</div>}
              {!isLoadingIntroSummary && introSummaryError && <div className="ai-intro-status error"><span>{introSummaryError}</span><button type="button" onClick={loadIntroSummary}>다시 시도</button></div>}
              {!isLoadingIntroSummary && !introSummaryError && introSummary && (
                <>
                  <div className="ai-intro-kpis">
                    <article><span><Bot size={17} /></span><b>{formatViewCount(introSummary.totals.asset_count)}</b><small>운영 자산</small></article>
                    <article><span><Eye size={17} /></span><b>{formatViewCount(introSummary.totals.view_count)}</b><small>누적 조회 수</small></article>
                    <article><span><Download size={17} /></span><b>{formatViewCount(introSummary.totals.diffusion_attempt_count)}</b><small>누적 다운로드 수</small></article>
                    <article><span><CheckCircle2 size={17} /></span><b>{formatViewCount(introSummary.totals.diffusion_completed_count)}</b><small>확산 완료</small></article>
                  </div>

                  <div className="ai-intro-dashboard">
                    <article className="ai-intro-chart ai-intro-monthly">
                      <header><div><small>6 MONTH ACTIVITY</small><h3>월별 등록 및 다운로드</h3></div><div className="ai-intro-legend"><span><i className="registered" />등록</span><span><i className="downloaded" />다운로드</span></div></header>
                      <div className="ai-intro-bars">
                        {introSummary.monthly_activity.map((item) => (
                          <div key={item.month} tabIndex="0" aria-label={`${item.label} 등록 ${item.registrations}건, 다운로드 ${item.downloads}건`}>
                            <div className="ai-intro-bar-pair">
                              <i className="registered" style={{ height: `${Math.max(4, Number(item.registrations || 0) / introActivityMax * 100)}%` }} />
                              <i className="downloaded" style={{ height: `${Math.max(4, Number(item.downloads || 0) / introActivityMax * 100)}%` }} />
                            </div>
                            <span>{item.label}</span>
                            <div className="ai-intro-chart-tooltip" role="tooltip">
                              <strong>{item.label}</strong>
                              <span><i className="registered" />등록 <b>{item.registrations}건</b></span>
                              <span><i className="downloaded" />다운로드 <b>{item.downloads}건</b></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="ai-intro-chart">
                      <header><div><small>BUSINESS AREA</small><h3>업무 영역별 자산</h3></div></header>
                      <div className="ai-intro-distribution">
                        {introSummary.business_distribution.length ? introSummary.business_distribution.map((item) => (
                          <div key={item.label}><span><b>{item.label}</b><em>{item.count}</em></span><i><b style={{ width: `${Number(item.count || 0) / introBusinessMax * 100}%` }} /></i></div>
                        )) : <p>운영 중인 자산이 없습니다.</p>}
                      </div>
                    </article>

                    <article className="ai-intro-chart ai-intro-top-assets">
                      <header><div><small>TOP ASSETS</small><h3>누적 다운로드 상위 자산</h3></div><button type="button" onClick={() => setActivePage('explore')}>전체 보기 <ArrowRight size={13} /></button></header>
                      <div>
                        {introSummary.top_assets.length ? introSummary.top_assets.map((asset, index) => (
                          <button type="button" key={asset.asset_id} onClick={() => { setActivePage('explore'); openAssetCatalogDetail(asset); }}>
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <div><b>{asset.asset_name}</b><small>{asset.business_area} · {asset.maturity_level}</small></div>
                            <em>{formatViewCount(asset.diffusion_attempt_count)}회</em>
                          </button>
                        )) : <p>운영 중인 자산이 없습니다.</p>}
                      </div>
                    </article>
                  </div>
                </>
              )}
            </section>

          </section>
        )}

        {!isAdminView && activePage === 'explore' && (
          <section className="content asset-catalog-page" aria-label="AI 자산 탐색">
            <div className="account-head">
              <div>
                <span>AI STUDIO</span>
                <h1>AI 자산 라이브러리</h1>
                <p>검증된 AI 모델, Agent와 업무 자동화 자산을 탐색하고 우리 조직의 업무에 맞게 확산할 수 있습니다.</p>
              </div>
            </div>
            <section className={'asset-recommendation-panel' + (recommendedAssetCatalog.length ? ' has-results' : '')}>
              <div className="asset-recommendation-intro">
                <div className="asset-recommendation-icon"><Sparkles size={20} /></div>
                <div><span>AI ASSET MATCH</span><h2>해결하려는 과제를 알려주세요</h2><p>운영 중인 AI 자산을 분석해 업무에 적합한 자산과 활용 방향을 추천합니다.</p></div>
              </div>
              <form className="asset-recommendation-form" onSubmit={requestAssetRecommendations}>
                <textarea value={assetRecommendationQuery} maxLength={1000} onChange={(event) => setAssetRecommendationQuery(event.target.value)} placeholder="예: 생산라인별 품질 데이터를 취합해 주간 보고서를 자동으로 작성하고 싶어요." aria-label="해결하려는 과제" />
                <button type="submit" disabled={assetRecommendationQuery.trim().length < 5 || isRecommendingAssets || isLoadingAssetCatalog || assetCatalog.length === 0}>
                  {isRecommendingAssets ? <><span className="loading-spinner" /> 분석 중</> : <><Wand2 size={16} /> 자산 추천</>}
                </button>
              </form>
              {isRecommendingAssets && <div className="asset-recommendation-progress"><span className="loading-spinner" /><div><b>등록된 자산을 분석하고 있습니다</b><small>과제 적합성과 활용 가능성을 비교해 최대 3개를 선별합니다.</small></div></div>}
              {!isRecommendingAssets && assetRecommendationError && <div className="asset-recommendation-error">{assetRecommendationError}</div>}
              {!isRecommendingAssets && !assetRecommendationError && assetRecommendations.length > 0 && recommendedAssetCatalog.length === 0 && <div className="asset-recommendation-error">추천된 자산 정보를 현재 목록에서 찾을 수 없습니다.</div>}
              {!isRecommendingAssets && !assetRecommendationError && hasAssetRecommendationRun && assetRecommendations.length === 0 && <div className="asset-recommendation-empty">현재 과제와 충분히 일치하는 운영 자산을 찾지 못했습니다. 업무 목적이나 처리 방식을 조금 더 구체적으로 작성해보세요.</div>}
              {recommendedAssetCatalog.length > 0 && (
                <div className="asset-recommendation-results">
                  <header><div><span>RECOMMENDED ASSETS</span><h3>이 과제에 적합한 자산</h3></div><small>{recommendedAssetCatalog.length}개 추천</small></header>
                  <div className="asset-recommendation-grid">
                    {recommendedAssetCatalog.map((asset, index) => (
                      <article key={asset.asset_id} tabIndex="0" role="button" onClick={() => openAssetCatalogDetail(asset)} onKeyDown={(event) => { if (event.key === 'Enter') openAssetCatalogDetail(asset); }}>
                        <div className="asset-recommendation-rank"><span>0{index + 1}</span><b>{asset.recommendation.score}</b><small>적합도</small></div>
                        <div className="asset-recommendation-content">
                          <span>{asset.business_area} · {asset.maturity_level}</span>
                          <h4>{asset.asset_name}</h4>
                          <p>{asset.description}</p>
                          <dl><div><dt>추천 이유</dt><dd>{asset.recommendation.reason}</dd></div><div><dt>수정·활용 방향</dt><dd>{asset.recommendation.adaptation}</dd></div></dl>
                          <button type="button">자산 상세보기 <ArrowRight size={13} /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
            <section className="asset-collection-section">
              <header>
                <div><span>MY COLLECTION</span><h2>내 컬렉션</h2><p>관심 자산을 모아두고 상세 정보와 확산 현황을 빠르게 확인합니다.</p></div>
                <small><Star size={13} fill="currentColor" />{bookmarkedAssetCatalog.length}개 저장됨</small>
              </header>
              {bookmarkedAssetCatalog.length > 0 ? (
                <div className="asset-catalog-grid asset-collection-catalog-grid">
                  {bookmarkedAssetCatalog.map((asset) => (
                    <article className="asset-catalog-card" key={asset.asset_id} tabIndex="0" role="button" onClick={() => openAssetCatalogDetail(asset)} onKeyDown={(event) => { if (event.key === 'Enter') openAssetCatalogDetail(asset); }}>
                      <div className="asset-card-top"><span className={'asset-maturity ' + asset.maturity_level}>{asset.maturity_level}</span><button className="active" type="button" aria-label="내 컬렉션에서 제거" onClick={(event) => toggleAssetBookmark(asset.asset_id, event)}><Star size={16} fill="currentColor" /></button></div>
                      <div className="asset-card-title"><small>{asset.business_area}</small><h2>{asset.asset_name}</h2><p>{asset.description}</p></div>
                      <dl><div><dt>Task 유형</dt><dd>{(asset.task_types || []).join(' · ') || '미분류'}</dd></div><div><dt>구현 방식</dt><dd>{(asset.implementation_types || []).join(' · ') || '미분류'}</dd></div><div><dt>Data 유형</dt><dd>{asset.data_type || '데이터 없음'}</dd></div></dl>
                      <div className="asset-card-tags">{(asset.tags || []).slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}</div>
                      <footer><span className="asset-card-foot-stats"><em title="조회 수"><Eye size={11} />{formatViewCount(asset.view_count)}</em><i /><span><b>{formatViewCount(asset.diffusion_completed_count)}</b>회 확산 완료 / <b>{formatViewCount(asset.diffusion_attempt_count)}</b>회 확산 시도</span></span><button type="button">보기 <ArrowRight size={13} /></button></footer>
                    </article>
                  ))}
                </div>
              ) : <div className="asset-collection-empty"><Star size={17} /><span>관심 자산의 별표를 누르면 이곳에서 빠르게 확인할 수 있습니다.</span></div>}
            </section>
            <div className="asset-catalog-layout">
              <aside className="asset-catalog-filter">
                <header><h2>필터</h2><button type="button" onClick={() => setAssetCatalogFilters({})}>초기화</button></header>
                {assetCatalogFilterGroups.map((group) => <section key={group.key}><div><b>{group.label}</b><span>{group.options.length}</span></div><div className="asset-filter-options">{group.options.map((option) => <button className={(assetCatalogFilters[group.key] || []).includes(option) ? 'active' : ''} type="button" key={option} onClick={() => toggleAssetCatalogFilter(group.key, option)}>{option}</button>)}</div></section>)}
              </aside>
              <div className="asset-catalog-main">
                <div className="asset-catalog-search"><Search size={17} /><input type="search" value={assetCatalogQuery} onChange={(event) => setAssetCatalogQuery(event.target.value)} placeholder="자산명, 설명, 태그로 검색..." /></div>
                <div className="asset-catalog-toolbar"><div><b>{filteredAssetCatalog.length}</b>개 자산 표시<span>{Object.values(assetCatalogFilters).flat().length ? ' · 선택한 필터 적용 중' : ' · 전체 운영 자산'}</span></div><div><button className={assetCatalogSort === 'popular' ? 'active' : ''} type="button" onClick={() => setAssetCatalogSort('popular')}>인기순</button><button className={assetCatalogSort === 'latest' ? 'active' : ''} type="button" onClick={() => setAssetCatalogSort('latest')}>최신순</button></div></div>
                <div className="asset-catalog-results-scroll">
                {isLoadingAssetCatalog && <div className="asset-catalog-message"><span className="loading-spinner" /> 운영 자산을 불러오고 있습니다.</div>}
                {!isLoadingAssetCatalog && assetCatalogError && <div className="asset-catalog-message error">{assetCatalogError}</div>}
                {!isLoadingAssetCatalog && !assetCatalogError && filteredAssetCatalog.length === 0 && <div className="asset-catalog-empty"><Search size={24} /><b>조건에 맞는 자산이 없습니다</b><span>검색어나 필터 조건을 조정해보세요.</span></div>}
                <div className="asset-catalog-grid">{filteredAssetCatalog.map((asset) => (
                  <article className="asset-catalog-card" key={asset.asset_id} tabIndex="0" role="button" onClick={() => openAssetCatalogDetail(asset)} onKeyDown={(event) => { if (event.key === 'Enter') openAssetCatalogDetail(asset); }}>
                    <div className="asset-card-top"><span className={'asset-maturity ' + asset.maturity_level}>{asset.maturity_level}</span><button className={assetBookmarks.has(asset.asset_id) ? 'active' : ''} type="button" aria-label="내 컬렉션 저장" onClick={(event) => toggleAssetBookmark(asset.asset_id, event)}><Star size={16} fill={assetBookmarks.has(asset.asset_id) ? 'currentColor' : 'none'} /></button></div>
                    <div className="asset-card-title"><small>{asset.business_area}</small><h2>{asset.asset_name}</h2><p>{asset.description}</p></div>
                    <dl><div><dt>Task 유형</dt><dd>{(asset.task_types || []).join(' · ') || '미분류'}</dd></div><div><dt>구현 방식</dt><dd>{(asset.implementation_types || []).join(' · ') || '미분류'}</dd></div><div><dt>Data 유형</dt><dd>{asset.data_type || '데이터 없음'}</dd></div></dl>
                    <div className="asset-card-tags">{(asset.tags || []).slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}</div>
                    <footer><span className="asset-card-foot-stats"><em title="조회 수"><Eye size={11} />{formatViewCount(asset.view_count)}</em><i /><span><b>{formatViewCount(asset.diffusion_completed_count)}</b>회 확산 완료 / <b>{formatViewCount(asset.diffusion_attempt_count)}</b>회 확산 시도</span></span><button type="button">보기 <ArrowRight size={13} /></button></footer>
                  </article>))}</div>
                </div>
              </div>
            </div>
            {selectedCatalogAsset && <><button className="asset-detail-backdrop" type="button" aria-label="상세 닫기" onClick={closeAssetCatalogDetail} /><aside className="asset-detail-drawer" aria-label="AI 자산 상세">
              <header className="asset-detail-head"><button type="button" aria-label="닫기" onClick={closeAssetCatalogDetail}><X size={18} /></button><span>{selectedCatalogAsset.business_area}</span><h2>{selectedCatalogAsset.asset_name}</h2><p>{selectedCatalogAsset.description}</p><div className="asset-detail-owner"><div className="asset-detail-owner-icon"><UserRound size={16} /></div><span><b>{selectedCatalogAsset.owner_name || '자산 담당자'} <em>{selectedCatalogAsset.owner_job_title}</em></b><small>{selectedCatalogAsset.owner_org}</small>{selectedCatalogAsset.owner_email && <button type="button" title="이메일 주소 복사" onClick={() => copyTextToClipboard(selectedCatalogAsset.owner_email).catch(() => {})}><Mail size={11} />{selectedCatalogAsset.owner_email}</button>}</span></div><dl><div><dt>{selectedCatalogAsset.maturity_level}</dt><dd>자산 성숙도</dd></div><div><dt>{formatViewCount(selectedCatalogAsset.view_count)}</dt><dd>조회 수</dd></div><div><dt>{formatViewCount(selectedCatalogAsset.diffusion_attempt_count)}</dt><dd>확산 시도</dd></div><div><dt>{formatViewCount(selectedCatalogAsset.diffusion_completed_count)}</dt><dd>확산 완료</dd></div><div><dt>{formatDate(selectedCatalogAsset.updated_at)}</dt><dd>업데이트</dd></div></dl></header>
              <nav className="asset-detail-tabs">{[['overview', '과제 설명'], ['tech', '적용 기술'], ['data', '데이터'], ['performance', '성능 지표'], ['demo', '자산 활용'], ['diffusion', '확산 가이드'], ['diffusion-cases', '확산 사례'], ['qa', 'Q&A']].map(([key, label]) => <button className={selectedCatalogTab === key ? 'active' : ''} type="button" key={key} onClick={() => selectAssetCatalogTab(key)}>{label}</button>)}</nav>
              <div className="asset-detail-body">{renderAssetCatalogDetailTab()}</div>
            </aside></>}
            {isDiffusionCaseFormOpen && selectedCatalogAsset && (
              <div className="asset-diffusion-case-backdrop" role="presentation" onMouseDown={closeDiffusionCaseForm}>
                <form className="asset-diffusion-case-modal" onSubmit={submitDiffusionCase} onMouseDown={(event) => event.stopPropagation()}>
                  <button className="asset-diffusion-case-close" type="button" aria-label="닫기" onClick={closeDiffusionCaseForm}><X size={18} /></button>
                  <header><span>DIFFUSION CASE</span><h2>{editingDiffusionCaseId ? '확산 사례 수정' : '확산 사례 등록'}</h2><p><b>{selectedCatalogAsset.asset_name}</b>을 실제 업무에 적용한 경험을 공유합니다.</p></header>
                  <div className="asset-diffusion-case-form-grid">
                    <label><span>사례 제목 *</span><input value={diffusionCaseForm.title} onChange={(event) => updateDiffusionCaseField('title', event.target.value)} placeholder="자산을 적용한 업무와 핵심 결과가 드러나도록 작성하세요." /></label>
                    <label><span>확산 단계 *</span><div className="asset-diffusion-stage-select"><select value={diffusionCaseForm.stage} onChange={(event) => updateDiffusionCaseField('stage', event.target.value)}><option value="">선택</option><option value="poc">PoC</option><option value="pilot">Pilot</option><option value="production">운영</option></select><ChevronDown size={15} /></div></label>
                    <label className="full"><span>적용 업무 *</span><textarea value={diffusionCaseForm.applied_work} onChange={(event) => updateDiffusionCaseField('applied_work', event.target.value)} placeholder="이 자산을 어떤 업무·공정·프로세스에 적용했는지 작성하세요." /></label>
                    <label className="full"><span>수정·활용 방식 *</span><textarea value={diffusionCaseForm.customization} onChange={(event) => updateDiffusionCaseField('customization', event.target.value)} placeholder="원본 자산을 업무 환경에 맞게 어떻게 수정하고 활용했는지 작성하세요." /></label>
                    <label className="full"><span>적용 효과 *</span><textarea value={diffusionCaseForm.effect} onChange={(event) => updateDiffusionCaseField('effect', event.target.value)} placeholder="적용 후 확인된 정량적·정성적 효과를 작성하세요." /></label>
                    <label className="full"><span>공유 코드 Git URL <small>선택</small></span><input type="url" value={diffusionCaseForm.git_url} onChange={(event) => updateDiffusionCaseField('git_url', event.target.value)} placeholder="https://git.hyundai-wia.com/..." /></label>
                  </div>
                  {diffusionCaseError && <p className="asset-diffusion-case-error">{diffusionCaseError}</p>}
                  <footer><button type="button" disabled={isSavingDiffusionCase} onClick={closeDiffusionCaseForm}>취소</button><button type="submit" disabled={isSavingDiffusionCase}>{isSavingDiffusionCase ? '저장 중...' : editingDiffusionCaseId ? '수정 완료' : '사례 등록'}</button></footer>
                </form>
              </div>
            )}
          </section>
        )}

        {!isAdminView && activePage === 'registry' && (
          <section className="content asset-registry-page" aria-label="AI 자산 등록" ref={assetRegistryRef}>
            <div className="account-head">
              <div>
                <span>AI STUDIO</span>
                <h1>AI 자산 등록</h1>
                <p>개발 완료한 AI 모델·코드·업무 자동화 자산을 전사에서 재사용할 수 있도록 등록 요청서를 작성합니다.</p>
              </div>
            </div>

            <section className="asset-reg-guide" aria-label="자산 등록 절차">
              <div className="asset-reg-guide-label">자산 등록 절차</div>
              <div className="asset-reg-guide-steps">
                {assetRegistrySteps.map(([title, desc], index) => (
                  <React.Fragment key={title}>
                    <div className="asset-reg-guide-step">
                      <div className="asset-reg-guide-num">{index + 1}</div>
                      <div><b>{title}</b><span>{desc}</span></div>
                    </div>
                    {index < assetRegistrySteps.length - 1 && <div className="asset-reg-guide-arrow">→</div>}
                  </React.Fragment>
                ))}
              </div>
            </section>

            <section className="asset-reg-history" aria-label="나의 AI 자산 등록 기록">
              <header className="asset-reg-history-head">
                <div><span>MY ASSETS</span><h2>나의 AI 자산 등록 기록</h2><p>제출한 자산의 심사 상태를 확인할 수 있습니다.</p></div>
                <strong>{myAiAssets.length}건</strong>
              </header>
              <div className="asset-reg-history-body" aria-live="polite">
                {isLoadingMyAiAssets && <div className="asset-reg-history-message"><span className="asset-reg-spinner" /> 등록 기록을 불러오고 있습니다.</div>}
                {!isLoadingMyAiAssets && myAiAssetsError && <div className="asset-reg-history-message error">{myAiAssetsError}</div>}
                {!isLoadingMyAiAssets && !myAiAssetsError && myAiAssets.length === 0 && <div className="asset-reg-history-empty"><ShieldCheck size={22} /><b>아직 제출한 AI 자산이 없습니다</b><span>등록을 완료하면 이곳에서 심사 상태를 확인할 수 있습니다.</span></div>}
                {!isLoadingMyAiAssets && !myAiAssetsError && myAiAssets.length > 0 && (
                  <div className="asset-reg-history-list">
                    {myAiAssets.map((asset) => {
                      const statusMeta = assetApprovalStatusMeta[asset.approval_status] || assetApprovalStatusMeta.submitted;
                      return (
                        <article className="asset-reg-history-item" key={asset.asset_id}>
                          <div className="asset-reg-history-mark"><Bot size={17} /></div>
                          <div className="asset-reg-history-info">
                            <b>{asset.asset_name}</b>
                            <span>{asset.business_area} · {asset.maturity_level}</span>
                          </div>
                          <time>{formatDate(asset.created_at)}</time>
                          <div className="asset-reg-history-actions">
                            <button className="asset-reg-history-view" type="button" disabled={assetDocumentLoadingId === asset.asset_id} onClick={() => openAssetRegistrationDocument(asset)}><Eye size={13} />{assetDocumentLoadingId === asset.asset_id ? "Loading" : "View"}</button>
                            {["approved", "rejected"].includes(asset.approval_status) && <button className="asset-reg-history-view feedback" type="button" onClick={() => setAssetFeedbackTarget(asset)}><FilePenLine size={13} />심사평</button>}
                          </div>
                          <em className={"asset-reg-history-status " + statusMeta.className}>{statusMeta.label}</em>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {!isAssetRegistrySubmitted && (
              <div className="asset-reg-flow" aria-label="등록 단계">
                {assetRegistrySteps.map(([title], index) => {
                  const isComplete = assetRegistryStepCompletion[index];
                  const isLocked = index > assetRegistryMaxAccessibleStep;
                  return (
                    <React.Fragment key={title}>
                      <button
                        className={"asset-reg-flow-step " + (assetRegistryStep === index ? "active " : "") + (isComplete ? "done " : "") + (isLocked ? "locked" : "")}
                        type="button"
                        disabled={isLocked}
                        title={isLocked ? "이전 단계를 완료하면 이동할 수 있습니다." : title}
                        onClick={() => goToAssetRegistryStep(index)}
                      >
                        <span>{isComplete ? "✓" : index + 1}</span>
                        <b>{title}</b>
                      </button>
                      {index < assetRegistrySteps.length - 1 && <i />}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {!isAssetRegistrySubmitted && assetRegistryStep === 0 && (
              <section className="asset-reg-card" key={`asset-spec-${assetSampleVersion}`}>
                <header className="asset-reg-card-head">
                  <span>Step 1 / 4</span>
                  <h2>자산 명세서 작성</h2>
                  <p>담당자 정보, 자산 기본 정보, 과제 정의, 데이터, 기술 및 성능 지표를 순서대로 작성합니다.</p>
                </header>
                <div className="asset-reg-card-body" onInput={refreshAssetSpecReady} onChange={refreshAssetSpecReady}>
                  {renderAssetSectionLabel('담당자 정보', 'owner')}
                  <div className="asset-reg-form-grid">
                    <label><span>이름 *</span><input name="owner_name" defaultValue={assetDraft.owner_name || authUser.displayed_name || ''} placeholder="예: 홍길동" /></label>
                    <label><span>직급 *</span><input name="owner_job_title" defaultValue={assetDraft.owner_job_title || authUser.job_title || ''} placeholder="예: 책임매니저" /></label>
                    <label><span>조직명 *</span><input name="owner_org" defaultValue={assetDraft.owner_org || authUser.org_name || ''} placeholder="예: DX추진랩" /></label>
                    <label><span>이메일 *</span><input name="owner_email" type="email" defaultValue={assetDraft.owner_email || 'jongwook.lee@hyundai-wia.com'} placeholder="예: gildong@hyundai-wia.com" /></label>
                  </div>

                  {renderAssetSectionLabel('자산 기본 정보', 'basic')}
                  <div className="asset-reg-form-grid">
                    <label className="full"><span>자산명 *</span><input name="asset_name" defaultValue={assetDraft.asset_name || ''} placeholder="예: 가공품 표면 결함 자동 검출 모델" /></label>
                    <label className="full"><span>설명 *</span><textarea name="asset_description" defaultValue={assetDraft.description || ''} rows="3" placeholder="이 자산이 해결하는 문제와 핵심 기능을 2-3문장으로 설명하세요." /></label>
                    <div className="asset-reg-two-row full">
                      <label><span>업무 영역 *</span><select name="business_area" defaultValue={assetDraft.business_area || ''}><option value="">선택</option><option>생산·제조</option><option>품질</option><option>R&D·설계</option><option>SCM·구매·물류</option><option>영업·마케팅</option><option>경영지원</option><option>안전·환경·보건</option><option>IT·DX</option><option>공통</option></select></label>
                      <label><span>자산 성숙도 *</span><select name="maturity_level" defaultValue={assetDraft.maturity_level || '아이디어'}><option>아이디어</option><option>PoC</option><option>Pilot</option><option>운영</option></select></label>
                    </div>
                    <div className="asset-reg-chip-field full">
                      <div className="asset-reg-chip-label"><span>Task 유형 *</span><small>복수 선택 가능</small></div>
                      <div>
                        {assetTaskTypes.map((item) => (
                          <button className={selectedAssetTasks.includes(item) ? 'active' : ''} type="button" key={item} aria-pressed={selectedAssetTasks.includes(item)} onClick={() => toggleAssetTask(item)}>{item}</button>
                        ))}
                      </div>
                    </div>
                    <div className="asset-reg-chip-field full">
                      <div className="asset-reg-chip-label"><span>구현 방식 *</span><small>복수 선택 가능</small></div>
                      <div>
                        {assetImplementationTypes.map((item) => (
                          <button className={selectedAssetImplementations.includes(item) ? 'active' : ''} type="button" key={item} aria-pressed={selectedAssetImplementations.includes(item)} onClick={() => toggleAssetImplementation(item)}>{item}</button>
                        ))}
                      </div>
                    </div>
                    <div className="asset-reg-tag-field full">
                      <label><span>태그 *</span><input value={assetTagInput} placeholder="태그 입력 후 Enter" onChange={(event) => setAssetTagInput(event.target.value)} onKeyDown={handleAssetTagKeyDown} onBlur={addAssetTag} /></label>
                      {assetTags.length > 0 && (
                        <div className="asset-reg-tag-list">
                          {assetTags.map((tag) => (
                            <button type="button" key={tag} onClick={() => removeAssetTag(tag)}>{tag}<span>×</span></button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {renderAssetSectionLabel('과제 정의', 'definition')}
                  <div className="asset-reg-textarea-stack">
                    <div className="asset-reg-guided-field">
                      <div className="asset-reg-field-label"><span>문제 정의 *</span><button type="button" aria-label="문제 정의 작성 예시 보기" onClick={() => toggleAssetGuide('problem')}>?</button></div>
                      <textarea name="problem_definition" defaultValue={assetDraft.problem_definition || ''} rows="3" placeholder="현재 어떤 문제가 발생하고 있는지 설명하세요." />
                      {openAssetGuides.problem && <div className="asset-reg-guide-example">{assetGuideExamples.problem}</div>}
                    </div>
                    <div className="asset-reg-guided-field">
                      <div className="asset-reg-field-label"><span>As-Is Workflow *</span><button type="button" aria-label="As-Is Workflow 작성 예시 보기" onClick={() => toggleAssetGuide('asIs')}>?</button></div>
                      <textarea name="as_is_workflow" defaultValue={assetDraft.as_is_workflow || ''} rows="3" placeholder="AI 도입 이전의 현재 업무 방식을 설명하세요." />
                      {openAssetGuides.asIs && <div className="asset-reg-guide-example">{assetGuideExamples.asIs}</div>}
                    </div>
                    <div className="asset-reg-guided-field">
                      <div className="asset-reg-field-label"><span>To-Be Workflow *</span><button type="button" aria-label="To-Be Workflow 작성 예시 보기" onClick={() => toggleAssetGuide('toBe')}>?</button></div>
                      <textarea name="to_be_workflow" defaultValue={assetDraft.to_be_workflow || ''} rows="3" placeholder="AI 도입 후 목표하는 업무 방식을 설명하세요." />
                      {openAssetGuides.toBe && <div className="asset-reg-guide-example">{assetGuideExamples.toBe}</div>}
                    </div>
                    <div className="asset-reg-guided-field">
                      <div className="asset-reg-field-label"><span>AI 개선 효과 *</span><button type="button" aria-label="AI 개선 효과 작성 예시 보기" onClick={() => toggleAssetGuide('effect')}>?</button></div>
                      <textarea name="ai_effect" defaultValue={assetDraft.ai_effect || ''} rows="3" placeholder="기대하는 정량·정성 효과를 구체적으로 작성하세요." />
                      {openAssetGuides.effect && <div className="asset-reg-guide-example">{assetGuideExamples.effect}</div>}
                    </div>
                  </div>

                  {renderAssetSectionLabel('데이터 *', 'data')}
                  <div className={`asset-reg-data-box ${isAssetNoData ? 'disabled' : ''}`}>
                    <label className="asset-reg-check"><input type="checkbox" checked={isAssetNoData} onChange={(event) => setIsAssetNoData(event.target.checked)} /> 데이터 없음 (해당 자산에 첨부할 데이터가 없습니다)</label>
                    <label><span>Data 유형</span><select name="data_type" defaultValue={assetDraft.data_type || ''} disabled={isAssetNoData}><option value="">선택</option><option>테이블·정형데이터</option><option>시계열 데이터</option><option>센서·IoT 데이터</option><option>문서·텍스트</option><option>이미지</option><option>영상</option><option>음성</option><option>로그</option><option>CAD·도면</option><option>코드</option><option>웹·외부 데이터</option><option>복합 데이터</option></select></label>
                    <div className="asset-reg-guided-field">
                      <div className="asset-reg-field-label"><span>데이터 설명</span><button type="button" aria-label="데이터 설명 작성 예시 보기" onClick={() => toggleAssetGuide('data')}>?</button></div>
                      <textarea name="data_description" defaultValue={assetDraft.data_description || ''} rows="3" placeholder="데이터의 구조, 수집 방식, 레이블 기준 등을 설명하세요." disabled={isAssetNoData} />
                      {openAssetGuides.data && <div className="asset-reg-guide-example">{assetGuideExamples.data}</div>}
                    </div>
                    <div className="asset-reg-subsection-title-row">
                      <div className="asset-reg-subsection-title">데이터 첨부</div>
                      <label className="asset-reg-inline-check"><input type="checkbox" checked={hasAssetTrainValidationSplit} disabled={isAssetNoData} onChange={(event) => { setHasAssetTrainValidationSplit(event.target.checked); setAssetTrainFiles([]); setAssetValidationFiles([]); setAssetSampleFiles([]); }} /> 학습 / 검증 구분</label>
                    </div>
                    <div className={`asset-reg-upload-grid ${hasAssetTrainValidationSplit ? '' : 'single'}`}>
                      {hasAssetTrainValidationSplit ? (
                        <>
                          <label><input name="train_files" type="file" disabled={isAssetNoData} onChange={(event) => setAssetTrainFiles(event.target.files?.[0] ? [event.target.files[0]] : [])} /><small className="asset-reg-upload-action">파일 선택</small><b>학습 샘플 데이터</b><span>{assetTrainFiles[0]?.name || 'CSV · Parquet · XLSX · JSON · ZIP · 파일 1개 · 최대 10MB'}</span><em>여러 데이터는 ZIP으로 묶어 업로드하세요.</em></label>
                          <label><input name="validation_files" type="file" disabled={isAssetNoData} onChange={(event) => setAssetValidationFiles(event.target.files?.[0] ? [event.target.files[0]] : [])} /><small className="asset-reg-upload-action">파일 선택</small><b>검증 샘플 데이터</b><span>{assetValidationFiles[0]?.name || 'CSV · Parquet · XLSX · JSON · ZIP · 파일 1개 · 최대 10MB'}</span><em>여러 데이터는 ZIP으로 묶어 업로드하세요.</em></label>
                        </>
                      ) : (
                        <label><input name="sample_files" type="file" disabled={isAssetNoData} onChange={(event) => setAssetSampleFiles(event.target.files?.[0] ? [event.target.files[0]] : [])} /><small className="asset-reg-upload-action">파일 선택</small><b>샘플 데이터</b><span>{assetSampleFiles[0]?.name || 'CSV · Parquet · XLSX · JSON · ZIP · 파일 1개 · 최대 10MB'}</span><em>여러 데이터는 ZIP으로 묶어 업로드하세요.</em></label>
                      )}
                    </div>
                  </div>

                  {renderAssetSectionLabel('적용 기술', 'tech')}
                  <div className="asset-reg-tech-stack">
                    <section className="asset-reg-tech-block">
                      <h3>모델 / 알고리즘 *</h3>
                      {assetModelItems.map((item, index) => (
                        <div className="asset-reg-tech-item asset-reg-model-item" key={item.id}>
                          <div className="asset-reg-tech-item-head">
                            <span>Model Note {index + 1}</span>
                            {assetModelItems.length > 1 && <button type="button" aria-label="모델 항목 삭제" onClick={() => removeAssetModelItem(item.id)}>삭제</button>}
                          </div>
                          <input data-field="model_name" defaultValue={item.model_name || ''} placeholder="모델명 (예: XGBoost)" />
                          <input data-field="description" defaultValue={item.description || ''} placeholder="설명 (예: 센서 피처 기반 불량 확률 예측 모델)" />
                          <input data-field="reference_url" defaultValue={item.reference_url || ''} placeholder="참조 URL (선택)" />
                        </div>
                      ))}
                      <button className="asset-reg-dashed-add" type="button" onClick={addAssetModelItem}>+ 모델 추가</button>
                    </section>
                    <section className="asset-reg-tech-block">
                      <h3>기술 스택 *</h3>
                      {assetStackItems.map((item, index) => (
                        <div className="asset-reg-tech-item asset-reg-stack-item" key={item.id}>
                          <div className="asset-reg-tech-item-head">
                            <span>Stack Note {index + 1}</span>
                            {assetStackItems.length > 1 && <button type="button" aria-label="스택 항목 삭제" onClick={() => removeAssetStackItem(item.id)}>삭제</button>}
                          </div>
                          <input data-field="stack_name" defaultValue={item.stack_name || ''} placeholder="라이브러리·프레임워크명 (예: PyTorch)" />
                          <input data-field="description" defaultValue={item.description || ''} placeholder="용도 설명 (예: 이미지 모델 학습 및 추론)" />
                          <input data-field="reference_url" defaultValue={item.reference_url || ''} placeholder="참조 URL (선택)" />
                        </div>
                      ))}
                      <button className="asset-reg-dashed-add" type="button" onClick={addAssetStackItem}>+ 스택 추가</button>
                    </section>
                  </div>

                  {renderAssetSectionLabel('성능 지표', 'metrics')}
                  <div className="asset-reg-perf-grid">
                    <div>
                      <h3>Before / After 비교 * <small>(예: 처리시간, 수작업 시간, 오류 건수)</small></h3>
                      {assetBeforeAfterItems.map((item, index) => (
                        <div className="asset-reg-perf-item asset-reg-before-after-item" key={item.id}>
                          <div className="asset-reg-perf-row"><input data-field="metric_name" defaultValue={item.metric_name || ''} placeholder="측정 항목 (예: 처리시간)" /><input data-field="before_value" defaultValue={item.before_value || ''} placeholder="이전 값 (예: 4시간)" /><input data-field="after_value" defaultValue={item.after_value || ''} placeholder="이후 값 (예: 1시간)" /><input data-field="improvement_rate" defaultValue={item.improvement_rate || ''} placeholder="개선율 (예: 75%)" /></div>
                          {assetBeforeAfterItems.length > 1 && <button type="button" aria-label={`Before / After 항목 ${index + 1} 삭제`} onClick={() => removeAssetBeforeAfterItem(item.id)}>삭제</button>}
                        </div>
                      ))}
                      <button className="asset-reg-dashed-add" type="button" onClick={addAssetBeforeAfterItem}>+ 항목 추가</button>
                    </div>
                    <div>
                      <h3>성능 지표 * <small>(예: 정확도, F1-score, 응답시간)</small></h3>
                      {assetKpiItems.map((item, index) => (
                        <div className="asset-reg-perf-item asset-reg-kpi-item" key={item.id}>
                          <div className="asset-reg-perf-row kpi"><input data-field="metric_name" defaultValue={item.metric_name || ''} placeholder="지표명 (예: 정확도)" /><input data-field="value" defaultValue={item.value || ''} placeholder="값 (예: 94.2%)" /><input data-field="description" defaultValue={item.description || ''} placeholder="설명 (예: 검증 데이터 기준)" /></div>
                          {assetKpiItems.length > 1 && <button type="button" aria-label={`성능 지표 ${index + 1} 삭제`} onClick={() => removeAssetKpiItem(item.id)}>삭제</button>}
                        </div>
                      ))}
                      <button className="asset-reg-dashed-add" type="button" onClick={addAssetKpiItem}>+ 지표 추가</button>
                    </div>
                  </div>

                  {renderAssetSectionLabel('자산 활용 화면 *', 'screens')}
                  <p className="asset-reg-section-guide">이 자산이 실제 업무에서 어떻게 활용되는지 보여주는 시연 이미지를 업로드하세요.<br />자산 카드의 적용 탭에 슬라이드로 표시됩니다.</p>
                  <div className="asset-reg-slide-images">
                    {assetImageItems.map((item, index) => (
                      <section className="asset-reg-slide-image-card" key={item.id}>
                        <div className="asset-reg-slide-order">{String(index + 1).padStart(2, '0')}</div>
                        <label className="asset-reg-slide-thumb">
                          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => updateAssetImageFile(item.id, event.target.files?.[0])} />
                          <small className="asset-reg-upload-action">{item.previewUrl ? '이미지 변경' : '이미지 선택'}</small>
                          {item.previewUrl ? <img src={item.previewUrl} alt={item.fileName || '자산 활용 화면 미리보기'} /> : <b>이미지 첨부</b>}
                          <span>{item.fileName || 'PNG · JPG · GIF · WEBP'}</span>
                        </label>
                        <div className="asset-reg-slide-info">
                          <input data-field="caption" defaultValue={item.caption || ''} placeholder="캡션 (예: 불량 검출 결과 화면)" />
                          <textarea data-field="description" defaultValue={item.description || ''} rows="3" placeholder="설명 (예: 표면 이미지에서 스크래치 영역을 박스로 표시하고, 불량 확률을 함께 보여줍니다.)" />
                        </div>
                        <div className="asset-reg-slide-actions">
                          <button type="button" disabled={index === 0} onClick={() => moveAssetImageItem(item.id, -1)}>↑</button>
                          <button type="button" disabled={index === assetImageItems.length - 1} onClick={() => moveAssetImageItem(item.id, 1)}>↓</button>
                          {assetImageItems.length > 1 && <button className="asset-reg-slide-delete" type="button" onClick={() => removeAssetImageItem(item.id)}>삭제</button>}
                        </div>
                      </section>
                    ))}
                    <button className="asset-reg-dashed-add" type="button" onClick={addAssetImageItem}>+ 이미지 추가</button>
                  </div>
                </div>
                {assetSubmitError && <p className="asset-reg-submit-error asset-reg-step-error">{assetSubmitError}</p>}
                <footer className="asset-reg-nav"><span /><button className="primary-btn" type="button" disabled={!isAssetSpecReady || isStagingAssetSpec} onClick={stageAssetSpecification}>{isStagingAssetSpec ? '임시 저장 중...' : '다음'}</button></footer>
              </section>
            )}

            {!isAssetRegistrySubmitted && assetRegistryStep === 1 && (
              <section className="asset-reg-card">
                <header className="asset-reg-card-head"><span>Step 2 / 4</span><h2>자산 연동</h2><p>GitHub 또는 GitLab 저장소를 연결하면 코드 구조가 자산에 자동으로 연결됩니다.</p></header>
                <div className="asset-reg-card-body">
                  <div className="asset-reg-repo-panel">
                    <div className="asset-reg-repo-grid">
                      <input name="repo_url" defaultValue={assetDraft.repo_url || ''} placeholder="저장소 URL (예: https://github.com/hyundai-wia/asset-name)" />
                      <input name="repo_branch" defaultValue={assetDraft.repo_branch || ''} placeholder="브랜치명 (예: main)" />
                      <button type="button" disabled={isCloningAssetRepo} onClick={cloneAssetRepository}>{isCloningAssetRepo ? '연결 중...' : '연결'}</button>
                    </div>
                    <div className="asset-reg-file-tree">
                      <div>저장소 구조 <span>{assetDraft.repo_branch || 'default branch'}</span></div>
                      {isCloningAssetRepo ? <p>Git 저장소를 가져오는 중입니다.</p> : assetRepoTree.length ? renderAssetRepoTree(assetRepoTree) : <p>Git을 연결하면 이 영역에 폴더 구조가 표시됩니다.</p>}
                    </div>
                  </div>
                </div>
                <footer className="asset-reg-nav"><button className="line-btn" type="button" onClick={() => goToAssetRegistryStep(0)}>이전</button><button className="primary-btn" type="button" disabled={assetRepoTree.length === 0} title={assetRepoTree.length === 0 ? "Git 저장소를 연결한 후 이동할 수 있습니다." : ""} onClick={() => goToAssetRegistryStep(2)}>다음</button></footer>
              </section>
            )}

            {!isAssetRegistrySubmitted && assetRegistryStep === 2 && (
              <section className="asset-reg-card">
                <header className="asset-reg-card-head"><span>Step 3 / 4</span><h2>확산 패키지 생성</h2><p>LLM이 연동된 저장소의 코드·README를 분석하여 Claude Skill 파일을 자동 생성합니다.</p></header>
                <div className="asset-reg-card-body">
                  <div className={`asset-reg-skill-trigger ${skillGenerationStatus === 'loading' ? 'loading' : ''}`}>
                    <div><Sparkles size={18} /><b>LLM 기반 자동 생성</b><span>저장소 구조, README, 설정 파일을 분석해 Skill 정의 파일과 실행 보조 스크립트를 작성합니다.</span></div>
                    {skillGenerationStatus !== 'done' && (
                      <button className="primary-btn asset-reg-skill-generate" type="button" disabled={skillGenerationStatus === 'loading'} onClick={startSkillGeneration}>
                        {skillGenerationStatus === 'loading' && <span className="asset-reg-spinner" />}
                        {skillGenerationStatus === 'loading' ? '생성중...' : '✦ Skill 자동 생성'}
                      </button>
                    )}
                  </div>
                  {skillGenerationStatus === 'loading' && (
                    <div className="asset-reg-skill-loading"><span className="asset-reg-spinner" /><div><b>Skill 파일을 생성하고 있습니다</b><p>저장소 구조, README, 설정 파일을 분석 중입니다. 잠시만 기다려주세요.</p></div></div>
                  )}
                  {skillGenerationStatus === 'done' && (
                    <div className="asset-reg-skill-result">
                      <section className="asset-reg-skill-section">
                        <div className="asset-reg-skill-result-head"><span>📂</span><b>생성된 Skill 파일 구조</b></div>
                        <div className="asset-reg-skill-explorer">
                          <div className="asset-reg-skill-tree">
                            <div className="asset-reg-skill-tree-head"><span>생성된 파일</span><em>{generatedAssetSkillFiles.length} files</em></div>
                            <div className="asset-reg-skill-tree-body">
                              {buildSkillFileTree(generatedAssetSkillFiles).map((node) => renderSkillTreeNode(node))}
                            </div>
                          </div>
                          <div className="asset-reg-skill-viewer">
                            {selectedSkillFile ? <><div>{selectedSkillFile.path}</div><pre>{selectedSkillFile.content}</pre></> : <p>← 파일을 클릭하면 내용이 표시됩니다</p>}
                          </div>
                        </div>
                      </section>
                    </div>
                  )}
                </div>
                <footer className="asset-reg-nav"><button className="line-btn" type="button" onClick={() => goToAssetRegistryStep(1)}>이전</button><button className="primary-btn" type="button" disabled={skillGenerationStatus !== "done"} title={skillGenerationStatus !== "done" ? "확산 패키지 생성을 완료한 후 이동할 수 있습니다." : ""} onClick={() => goToAssetRegistryStep(3)}>다음</button></footer>
              </section>
            )}

            {!isAssetRegistrySubmitted && assetRegistryStep === 3 && (
              <section className="asset-reg-card">
                <header className="asset-reg-card-head"><span>Step 4 / 4</span><h2>최종 제출</h2><p>아래 내용을 확인하고 동의하면 최종 제출이 가능합니다.</p></header>
                <div className="asset-reg-card-body"><div className="asset-reg-submit-notice"><Clock3 size={20} /><div><b>승인까지 약 7일이 소요됩니다</b><span>제출된 자산은 거버넌스 검토(보안·라이선스·품질 게이트)를 거친 후 AI Studio에 공개됩니다. 검토 결과는 등록 담당자 이메일로 안내됩니다.</span></div></div><div className="asset-reg-agree-list"><label><input type="checkbox" checked={assetSubmitAgreements.share} onChange={() => toggleAssetSubmitAgreement('share')} /> 과제 정보 및 코드가 AI Studio를 통해 전사 모든 부서에 공유될 수 있음을 확인하였습니다.</label><label><input type="checkbox" checked={assetSubmitAgreements.factual} onChange={() => toggleAssetSubmitAgreement('factual')} /> 등록 자산의 주요 정보가 실제 구현 내용과 사용 결과를 바탕으로 작성되었음을 확인합니다.</label><label><input type="checkbox" checked={assetSubmitAgreements.security} onChange={() => toggleAssetSubmitAgreement('security')} /> 등록 자산에 개인정보, 영업비밀, 외부 반출 제한 정보가 포함되지 않았음을 확인합니다.</label></div>{assetSubmitError && <p className="asset-reg-submit-error">{assetSubmitError}</p>}</div>
                <footer className="asset-reg-nav"><button className="line-btn" type="button" onClick={() => goToAssetRegistryStep(2)}>이전</button><button className="primary-btn" type="button" disabled={!isAssetSubmitEnabled || isSubmittingAsset} onClick={submitAssetRegistration}>{isSubmittingAsset ? '제출 중...' : '제출'}</button></footer>
              </section>
            )}

            {isAssetRegistrySubmitted && (
              <section className="asset-reg-done-card"><div>✓</div><h2>제출이 완료되었습니다</h2><p>AI 자산 등록 요청이 접수되었습니다. 거버넌스 검토 후 AI Studio에 공개되며, 결과는 이메일로 안내됩니다.</p><button className="line-btn" type="button" onClick={resetAssetRegistry}>새 자산 등록</button></section>
            )}
          </section>
        )}

        {!isAdminView && activePage === 'dx-discovery' && (
          <section className="content dx-discovery-page">
            <div className="account-head">
              <div>
                <span>AI STUDIO</span>
                <h1>DX 과제 발굴</h1>
                <p>AI Agent와 대화하며 막연한 아이디어를 구체적인 업무 과제로 다듬어보세요. 대화가 끝나면 과제 정의서가 자동으로 정리되고, 관련된 데이터와 AI 자산도 함께 추천해드립니다.</p>
              </div>
            </div>

            <div className="dx-chat-workspace">
              <aside className="dx-session-sidebar" aria-label="DX 과제 발굴 채팅 이력">
                <button className="dx-new-chat-btn" type="button" onClick={resetDxDiscovery} disabled={isLoadingDxSessions}>
                  <Plus size={15} />
                  새 채팅
                </button>
                <div className="dx-session-head">
                  <span>채팅 이력</span>
                  <b>{dxSessions.length}</b>
                </div>
                <div className="dx-session-list">
                  {isLoadingDxSessions && <div className="dx-session-empty">이력을 불러오는 중입니다.</div>}
                  {!isLoadingDxSessions && dxSessions.length === 0 && <div className="dx-session-empty">저장된 채팅 이력이 없습니다.</div>}
                  {!isLoadingDxSessions && dxSessions.map((session) => (
                    <button className={`dx-session-item ${activeDxSessionId === session.session_id ? 'active' : ''}`} type="button" key={session.session_id} onClick={() => openDxSession(session.session_id)}>
                      <strong>{session.title}</strong>
                      <small><Clock3 size={11} /> {formatDxSessionDate(session.updated_at)}<em className={session.status === '과제 발굴 완료' ? 'done' : 'progress'}>{session.status}</em></small>
                      <span className="dx-session-delete" role="button" tabIndex="0" aria-label={`${session.title} 이력 삭제`} onClick={(event) => deleteDxSession(session.session_id, event)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') deleteDxSession(session.session_id, event); }}>
                        <Trash2 size={13} />
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="dx-chat-panel" aria-label="DX 과제 발굴 채팅">
                <div className="dx-chat-header">
                  <span className="dx-agent-dot" />
                  <div>
                    <strong>DX 과제 발굴 Agent</strong>
                  </div>
                </div>
                <div className="dx-chat-body">
                  {dxMessages.map((message, index) => (
                    <div className={`dx-msg ${message.role}`} key={`${message.role}-${index}`}>
                      <div className="dx-avatar">{message.role === 'agent' ? <Bot size={16} /> : <UserRound size={15} />}</div>
                      <div className="dx-bubble">{message.text}</div>
                    </div>
                  ))}
                  {isDxTyping && (
                    <div className="dx-msg agent dx-typing-msg">
                      <div className="dx-avatar"><Bot size={16} /></div>
                      <div className="dx-typing-bubble" aria-label="챗봇 입력 중">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}
                </div>
                {dxError && <div className="dx-chat-error">{dxError}</div>}
                <form className="dx-input-bar" onSubmit={submitDxMessage}>
                  <textarea value={dxInput} onChange={(event) => setDxInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitDxMessage(event); } }} placeholder="해결하고 싶은 업무 과제를 자유롭게 설명해 주세요." rows="1" disabled={isDxTyping} />
                  <button className="primary-btn" type="submit" aria-label="전송" disabled={isDxTyping || !dxInput.trim()}><Send size={16} /></button>
                </form>
              </section>
            </div>

            {isDxResultVisible && (
            <section className="dx-results visible" aria-label="DX 과제 발굴 결과">
              <div className="dx-result-toolbar">
                <button className="line-btn dx-download-btn" type="button" onClick={downloadDxDefinition}>
                  <Download size={15} />
                  과제정의서 다운로드
                </button>
              </div>
              <article className="dx-doc-sheet">
                <div className="dx-doc-titleblock">
                  <h2 className="dx-doc-taskname">{dxDocFields.project_title}</h2>
                  <div className="dx-doc-business-line">
                    <span className="dx-doc-business-label">업무 영역</span>
                    <strong>{dxDocFields.business_area}</strong>
                  </div>
                </div>

                <section className="dx-doc-section">
                  <div className="dx-doc-sec-head"><span>SEC.01</span><strong>적용 업무</strong></div>
                  <p className="dx-doc-body-text">{dxDocFields.target_work}</p>
                </section>

                <div className="dx-doc-grid2">
                  <section className="dx-doc-section">
                    <div className="dx-doc-sec-head"><span>SEC.02</span><strong>현재 업무 방식</strong></div>
                    <p className="dx-doc-body-text">{dxDocFields.current_process}</p>
                  </section>
                  <section className="dx-doc-section">
                    <div className="dx-doc-sec-head"><span>SEC.03</span><strong>Pain Points</strong></div>
                    <ul className="dx-doc-list pain">
                      {(dxDocFields.pain_points.length ? dxDocFields.pain_points : ['Agent가 대화를 통해 내용을 채우는 영역입니다.']).map((item, index) => <li key={`pain-${index}`}>{item}</li>)}
                    </ul>
                  </section>
                </div>

                <section className="dx-doc-section">
                  <div className="dx-doc-sec-head"><span>SEC.04</span><strong>문제 발생 규모</strong></div>
                  <p className="dx-doc-body-text">{dxDocFields.problem_scale}</p>
                </section>

                <section className="dx-doc-section">
                  <div className="dx-doc-sec-head"><span>SEC.05</span><strong>해결 방향</strong></div>
                  <p className="dx-doc-body-text">{dxDocFields.solution_direction}</p>
                </section>

                <section className="dx-doc-section">
                  <div className="dx-doc-sec-head"><span>SEC.06</span><strong>필요 데이터</strong></div>
                  <div className="dx-doc-data-table">
                    {(dxDocFields.required_data.length ? dxDocFields.required_data : [{ data_name: '데이터명 미정', description: 'Agent가 대화를 통해 내용을 채우는 영역입니다.' }]).map((item, index) => (
                      <div className="dx-doc-data-row" key={`required-data-${index}`}>
                        <div className="dx-doc-data-name">{item.data_name}</div>
                        <div className="dx-doc-data-desc">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="dx-doc-section">
                  <div className="dx-doc-sec-head"><span>SEC.07</span><strong>기대 정량 효과</strong></div>
                  <ul className="dx-doc-list effect">
                    {(dxDocFields.quantitative_effect.length ? dxDocFields.quantitative_effect : ['Agent가 대화를 통해 내용을 채우는 영역입니다.']).map((item, index) => <li key={`quant-${index}`}>{item}</li>)}
                  </ul>
                </section>

                <section className="dx-doc-section">
                  <div className="dx-doc-sec-head"><span>SEC.08</span><strong>기대 정성 효과</strong></div>
                  <div className="dx-doc-cards">
                    {(dxDocFields.qualitative_effect.length ? dxDocFields.qualitative_effect : ['Agent가 대화를 통해 내용을 채우는 영역입니다.']).map((item, index) => (
                      <div className="dx-doc-card" key={`qual-${index}`}>{item}</div>
                    ))}
                  </div>
                </section>

                <section className="dx-doc-section">
                  <div className="dx-doc-sec-head"><span>SEC.09</span><strong>수혜 대상</strong></div>
                  <div className="dx-doc-benef-row">
                    {(dxDocFields.beneficiaries.length ? dxDocFields.beneficiaries : ['Agent가 대화를 통해 내용을 채우는 영역입니다.']).map((item, index) => (
                      <div className="dx-doc-benef" key={`benef-${index}`}><span />{item}</div>
                    ))}
                  </div>
                </section>

              </article>

              <div className="dx-rec-row">
                <section className="dx-rec-panel">
                  <div className="dx-rec-head"><span className="dx-rec-icon ds">D</span><strong>추천 Data</strong></div>
                  <div className="dx-rec-list">
                    {dxRecommendedDataIds.length === 0 && <div className="dx-rec-empty">추천 Data는 추천 로직 연동 후 표시됩니다.</div>}
                    {dxRecommendedDataIds.map((id) => (
                      <article className="dx-rec-card" key={id}>
                        <div className="dx-rec-card-ico ds">D</div>
                        <div><h3>{id}</h3><p>추천 Data ID</p></div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="dx-rec-panel">
                  <div className="dx-rec-head"><span className="dx-rec-icon ai">AI</span><strong>추천 AI 자산</strong></div>
                  <div className="dx-rec-list">
                    {dxRecommendedAssetIds.length === 0 && <div className="dx-rec-empty">추천 AI 자산은 추천 로직 연동 후 표시됩니다.</div>}
                    {dxRecommendedAssetIds.map((id) => (
                      <article className="dx-rec-card" key={id}>
                        <div className="dx-rec-card-ico ai">AI</div>
                        <div><h3>{id}</h3><p>추천 AI 자산 ID</p></div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </section>
            )}
          </section>
        )}

        {!isAdminView && activePage === 'tech-news' && (
          <section className="content tech-news-page">
            <div className="account-head">
              <div>
                <span>AX COMMUNITY</span>
                <h1>AI Tech News</h1>
                <p>최신 AI 기술 동향 뉴스를 확인합니다.</p>
              </div>
            </div>

            {newsError && <div className="form-error">{newsError}</div>}

            {isLoadingNews ? (
              <div className="news-empty">뉴스 목록을 불러오는 중입니다.</div>
            ) : newsList.length === 0 ? (
              <div className="news-empty">등록된 Tech News가 없습니다.</div>
            ) : (
              <div className="news-card-grid">
                {newsList.map((news) => (
                  <button className="news-card" type="button" key={news.news_id} onClick={() => setSelectedNewsId(news.news_id)}>
                    <div className="news-thumb">
                      {news.cover_image_url ? (
                        <img src={`${API_BASE}${news.cover_image_url}`} alt="" />
                      ) : (
                        <div className="news-thumb-placeholder">AI</div>
                      )}
                    </div>
                    <div className="news-card-body">
                      <span className="news-category">AI TECH NEWS</span>
                      <h2>{news.title}</h2>
                      <div className="news-card-footer">
                        <span>{news.created_at.slice(0, 10)}</span>
                        <span className="news-view-count"><Eye size={14} />{formatViewCount(news.view_count)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedNewsId && (
              <div className="news-modal-backdrop" role="presentation" onMouseDown={() => setSelectedNewsId('')}>
                <article className="news-modal" role="dialog" aria-modal="true" aria-label="AI Tech News 상세" onMouseDown={(event) => event.stopPropagation()}>
                  <button className="news-modal-close" type="button" aria-label="닫기" onClick={() => setSelectedNewsId('')}>×</button>
                  {selectedNews ? (
                    <>
                      {selectedNews.cover_image_url && <img className="news-modal-cover" src={`${API_BASE}${selectedNews.cover_image_url}`} alt="" />}
                      <div className="news-detail-head">
                        <div className="news-detail-meta">
                          <span>{selectedNews.created_at.slice(0, 10)}</span>
                          <span className="news-view-count"><Eye size={14} />{formatViewCount(selectedNews.view_count)}</span>
                        </div>
                        <h2>{selectedNews.title}</h2>
                      </div>
                      <div className="markdown-report">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedNews.markdown}</ReactMarkdown>
                      </div>
                    </>
                  ) : (
                    <div className="news-empty">게시글을 불러오는 중입니다.</div>
                  )}
                </article>
              </div>
            )}
          </section>
        )}

        {!isAdminView && activePage === 'ai-blog' && (
          <section className="content ai-usage-page">
            <div className="account-head">
              <div>
                <span>AX COMMUNITY</span>
                <h1>나만의 AI 활용법</h1>
                <p>업무에서 실제로 써본 AI 활용 경험을 자유롭게 공유하고, 도움이 된 글에 좋아요를 남깁니다.</p>
              </div>
            </div>

            {aiUsageError && <div className="form-error">{aiUsageError}</div>}

            {hottestAiUsagePost && (
              <section className="ai-usage-hot" aria-label="이번 주 추천 활용법">
                <div className="hot-label"><Sparkles size={16} /><span>이번 주 가장 핫한 활용법</span><b>TOP {hotAiUsageIndex + 1}</b></div>
                <div className="hot-content" key={hottestAiUsagePost.usage_post_id} role="button" tabIndex={0} onClick={() => setSelectedAiUsagePostId(hottestAiUsagePost.usage_post_id)} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedAiUsagePostId(hottestAiUsagePost.usage_post_id); }}>
                  <div className="hot-content-top">
                    <span className={`ai-usage-chip ${aiUsageCategoryClass[hottestAiUsagePost.category] || 'spread'}`}>{hottestAiUsagePost.category}</span>
                    <div className="hot-dots" aria-label="추천 활용법 슬라이드">
                      {hotAiUsagePosts.map((post, index) => (
                        <button className={`hot-dot ${index === hotAiUsageIndex ? 'active' : ''}`} type="button" key={post.usage_post_id} aria-label={`${index + 1}번째 추천 보기`} onClick={(event) => { event.stopPropagation(); setHotAiUsageIndex(index); }} />
                      ))}
                    </div>
                  </div>
                  <h2>{hottestAiUsagePost.title}</h2>
                  <p className="hot-preview">{previewText(hottestAiUsagePost.content_text, 80)}</p>
                  <div className="hot-meta-row">
                    <span className="news-view-count"><Eye size={14} />{formatViewCount(hottestAiUsagePost.view_count)}</span>
                    <span>좋아요 {hottestAiUsagePost.like_count}</span>
                    <span>{aiUsageAuthor(hottestAiUsagePost)}</span>
                  </div>
                  <div className="ai-usage-card-actions">
                    <span>{aiUsageAuthor(hottestAiUsagePost)} · {formatDate(hottestAiUsagePost.created_at)}</span>
                    <button className={`like-btn ${hottestAiUsagePost.liked_by_me ? 'liked' : ''}`} type="button" onClick={(event) => toggleAiUsageLike(hottestAiUsagePost.usage_post_id, event)}>
                      <Heart size={15} fill={hottestAiUsagePost.liked_by_me ? 'currentColor' : 'none'} />
                      {hottestAiUsagePost.like_count}
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="ai-usage-board">
              <div className="ai-usage-toolbar">
                <div>
                  <span>BOARD</span>
                  <h2>활용법 게시판</h2>
                </div>
                <div className="ai-usage-toolbar-actions">
                  <label className="ai-usage-search">
                    <Search size={15} />
                    <input value={aiUsageQuery} onChange={(event) => setAiUsageQuery(event.target.value)} placeholder="제목, 내용, 경험 유형 검색" />
                  </label>
                  <button className="primary-btn ai-usage-write-btn" type="button" onClick={openAiUsageComposer}>
                    <Plus size={16} />
                    게시글 작성
                  </button>
                </div>
              </div>

              <div className="ai-usage-filter-row" aria-label="활용법 게시판 필터">
                <div className="ai-usage-filter-group" aria-label="경험 유형 필터">
                  {aiUsageCategoryOptions.map((category) => (
                    <button
                      className={`ai-usage-filter ${aiUsageCategoryFilter === category ? 'active' : ''} ${aiUsageCategoryClass[category] || ''}`}
                      type="button"
                      key={category}
                      onClick={() => setAiUsageCategoryFilter(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="ai-usage-sort-group" aria-label="정렬 기준">
                  <button className={`ai-usage-sort ${aiUsageSort === 'latest' ? 'active' : ''}`} type="button" onClick={() => setAiUsageSort('latest')}>최신순</button>
                  <button className={`ai-usage-sort ${aiUsageSort === 'popular' ? 'active' : ''}`} type="button" onClick={() => setAiUsageSort('popular')}>인기순</button>
                </div>
              </div>

              <div className="ai-usage-card-grid">
                {isLoadingAiUsagePosts ? (
                  <div className="news-empty ai-usage-empty">활용법 게시글을 불러오는 중입니다.</div>
                ) : filteredAiUsagePosts.length === 0 ? (
                  <div className="news-empty ai-usage-empty">검색 결과가 없습니다.</div>
                ) : filteredAiUsagePosts.map((post) => {
                  const isLiked = post.liked_by_me;
                  return (
                    <article className="ai-usage-card" key={post.usage_post_id} role="button" tabIndex={0} onClick={() => setSelectedAiUsagePostId(post.usage_post_id)} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedAiUsagePostId(post.usage_post_id); }}>
                      <div className="ai-usage-card-top">
                        <span className={`ai-usage-chip ${aiUsageCategoryClass[post.category] || 'spread'}`}>{post.category}</span>
                        <span className="ai-usage-date"><Clock3 size={12} /> {formatDate(post.created_at)}</span>
                      </div>
                      <h3>{post.title}</h3>
                      <p className="ai-usage-preview">{previewText(post.content_text)}</p>
                      <div className="ai-usage-card-actions">
                        <span>{aiUsageAuthor(post)}</span>
                        <span className="news-view-count ai-usage-view-count"><Eye size={14} />{formatViewCount(post.view_count)}</span>
                        <div className="ai-usage-card-action-cluster">
                          <button className={`like-btn ${isLiked ? 'liked' : ''}`} type="button" onClick={(event) => toggleAiUsageLike(post.usage_post_id, event)}>
                            <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
                            {post.like_count}
                          </button>
                          {post.user_id === authUser?.user_id && (
                            <button className="icon-line-btn ai-usage-card-edit" type="button" aria-label="수정" onClick={(event) => startEditAiUsagePost(post, event)}>
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {selectedAiUsagePost && (
              <div className="news-modal-backdrop" role="presentation" onMouseDown={() => setSelectedAiUsagePostId('')}>
                <article className="ai-usage-detail-modal" role="dialog" aria-modal="true" aria-label="AI 활용법 상세" onMouseDown={(event) => event.stopPropagation()}>
                  <button className="news-modal-close" type="button" aria-label="닫기" onClick={() => setSelectedAiUsagePostId('')}>×</button>
                  <div className="ai-usage-detail-head">
                    <span className={`ai-usage-chip ${aiUsageCategoryClass[selectedAiUsagePost.category] || 'spread'}`}>{selectedAiUsagePost.category}</span>
                    <h2>{selectedAiUsagePost.title}</h2>
                    <div className="ai-usage-card-actions">
                      <span>{aiUsageAuthor(selectedAiUsagePost)} · {formatDate(selectedAiUsagePost.created_at)}</span>
                      <button className={`like-btn ${selectedAiUsagePost.liked_by_me ? 'liked' : ''}`} type="button" onClick={(event) => toggleAiUsageLike(selectedAiUsagePost.usage_post_id, event)}>
                        <Heart size={15} fill={selectedAiUsagePost.liked_by_me ? 'currentColor' : 'none'} />
                        {selectedAiUsagePost.like_count}
                      </button>
                    </div>
                  </div>
                  <div className="ai-usage-detail-body" dangerouslySetInnerHTML={{ __html: withApiAssetUrls(selectedAiUsagePost.content_html) }} />
                </article>
              </div>
            )}

            {isAiUsageComposerOpen && (
              <div className="news-modal-backdrop" role="presentation" onMouseDown={closeAiUsageComposer}>
                <form className="ai-usage-compose-modal" onSubmit={submitAiUsagePost} onMouseDown={(event) => event.stopPropagation()}>
                  <button className="news-modal-close ai-usage-compose-close" type="button" aria-label="닫기" onClick={closeAiUsageComposer}>×</button>
                  <div className="compose-head">
                    <div className="compose-icon"><Sparkles size={20} /></div>
                    <div>
                      <span>SHARE</span>
                      <h2>{editingAiUsagePostId ? '활용법 수정' : '활용법 작성'}</h2>
                    </div>
                  </div>

                  <label className="form-field">
                    <span>제목</span>
                    <input value={aiUsageForm.title} onChange={(event) => updateAiUsageField('title', event.target.value)} placeholder="예: 내가 써본 AI 활용법" required />
                  </label>

                  <label className="form-field ai-usage-category-field">
                    <span>경험 유형</span>
                    <div className={`ai-usage-category-select ${aiUsageCategoryClass[aiUsageForm.category] || 'spread'}`}>
                      <select value={aiUsageForm.category} onChange={(event) => updateAiUsageField('category', event.target.value)}>
                        <option>확산 사례</option>
                        <option>실패·교훈</option>
                        <option>Tip 공유</option>
                      </select>
                      <span className="ai-usage-category-preview">{aiUsageForm.category}</span>
                      <ChevronDown size={16} />
                    </div>
                  </label>

                  <div className="form-field">
                    <span>내용</span>
                    <div className="ai-usage-editor-toolbar" aria-label="본문 서식">
                      <button
                        className={`editor-tool-btn ${aiUsageEditorFormat.bold ? 'active' : ''}`}
                        type="button"
                        title="굵게"
                        aria-label="굵게"
                        aria-pressed={aiUsageEditorFormat.bold}
                        onMouseDown={(event) => { event.preventDefault(); applyAiUsageBold(); }}
                      >
                        <Bold size={15} />
                      </button>
                      <button
                        className={`editor-tool-btn ${aiUsageEditorFormat.underline ? 'active' : ''}`}
                        type="button"
                        title="밑줄"
                        aria-label="밑줄"
                        aria-pressed={aiUsageEditorFormat.underline}
                        onMouseDown={(event) => { event.preventDefault(); applyAiUsageUnderline(); }}
                      >
                        <Underline size={15} />
                      </button>
                      <div className="editor-color-menu" aria-label="글 색상">
                        <button
                          className={`editor-color-main ${isAiUsageColorOpen ? 'active' : ''}`}
                          type="button"
                          title="글 색상"
                          aria-label="글 색상"
                          aria-expanded={isAiUsageColorOpen}
                          style={{ '--current-text-color': aiUsageEditorFormat.color }}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setIsAiUsageColorOpen((current) => !current)}
                        >
                          <span className="editor-color-letter">A</span>
                          <ChevronDown size={12} />
                        </button>
                        {isAiUsageColorOpen && (
                          <div className="editor-color-palette" role="menu">
                            {aiUsageTextColors.map(([color, label]) => (
                              <button
                                className="editor-color-option"
                                type="button"
                                key={color}
                                role="menuitem"
                                title={label}
                                aria-label={label}
                                style={{ '--swatch-color': color }}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => applyAiUsageColor(color)}
                              >
                                <span className="editor-color-swatch" />
                                <span>{label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className="ai-usage-rich-editor"
                      contentEditable
                      ref={aiUsageEditorRef}
                      role="textbox"
                      aria-multiline="true"
                      data-placeholder="어떤 상황에서 AI를 어떻게 활용했는지 자유롭게 작성해 주세요. 이미지는 복사 후 붙여넣기로 넣을 수 있습니다."
                      onInput={() => { syncAiUsageEditor(); updateAiUsageEditorFormat(); }}
                      onKeyUp={updateAiUsageEditorFormat}
                      onMouseUp={updateAiUsageEditorFormat}
                      onBlur={rememberAiUsageSelection}
                      onPaste={handleAiUsagePaste}
                      suppressContentEditableWarning
                    />
                  </div>

                  <div className="form-actions">
                    <button className="line-btn" type="button" onClick={closeAiUsageComposer}>취소</button>
                    <button className="primary-btn" type="submit" disabled={isSavingAiUsagePost}>
                      <Plus size={16} />
                      {isSavingAiUsagePost ? (editingAiUsagePostId ? '수정 중' : '게시 중') : (editingAiUsagePostId ? '수정 완료' : '게시')}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {!isAdminView && activePage === 'gen-ai-proposal' && (
          <section className="content ai-idea-page">
            <div className="account-head">
              <div>
                <span>AX COMMUNITY</span>
                <h1>AI 아이디어 공모</h1>
                <p>업무 현장의 문제와 AI 적용 아이디어를 DX추진랩에 제안합니다.</p>
              </div>
            </div>

            <section className="ai-idea-guide" aria-label="AI 아이디어 공모 진행 안내">
              <div className="ai-idea-guide-intro">
                <span>PROCESS GUIDE</span>
                <h2>아이디어를 보내면 이렇게 진행됩니다</h2>
                <p>작성한 제안은 DX추진랩에 전달되며, 업무 영향도와 AI 적용 가능성 검토 후 심사평과 함께 결과가 업데이트됩니다.</p>
              </div>
              <div className="ai-idea-guide-steps">
                <div className="ai-idea-guide-step">
                  <b>01</b>
                  <strong>접수완료</strong>
                  <span>제안 내용과 첨부자료가 DX추진랩 검토 목록에 등록됩니다.</span>
                </div>
                <div className="ai-idea-guide-step review">
                  <b>02</b>
                  <strong>심사</strong>
                  <span>DX추진랩이 제안 내용을 검토하고, 결과와 함께 심사평을 제공합니다.</span>
                </div>
                <div className="ai-idea-guide-step selected">
                  <b>03A</b>
                  <strong>선정</strong>
                  <span>PoC 또는 과제화를 위해 담당자와 후속 논의를 진행합니다.</span>
                </div>
                <div className="ai-idea-guide-step rejected">
                  <b>03B</b>
                  <strong>미선정</strong>
                  <span>현재 추진은 어렵지만, 심사평을 바탕으로 보완 방향을 확인할 수 있습니다.</span>
                </div>
              </div>
            </section>

            <div className="ai-idea-layout">
              <section className="ai-idea-panel ai-idea-list-panel">
                <div className="ai-idea-panel-head">
                  <div>
                    <span>MY IDEAS</span>
                    <h2>내가 보낸 아이디어</h2>
                  </div>
                  <b>{aiIdeas.length}건</b>
                </div>

                <div className="ai-idea-list">
                  {isLoadingAiIdeas && <div className="empty-state">아이디어 목록을 불러오는 중입니다.</div>}
                  {!isLoadingAiIdeas && aiIdeas.length === 0 && <div className="empty-state">아직 보낸 아이디어가 없습니다.</div>}
                  {!isLoadingAiIdeas && aiIdeas.map((idea) => (
                    <article
                      className="ai-idea-card"
                      key={idea.idea_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedAiIdea(idea)}
                      onKeyDown={(event) => { if (event.key === 'Enter') setSelectedAiIdea(idea); }}
                    >
                      <div className="ai-idea-card-top">
                        <time>{formatDate(idea.created_at)}</time>
                        <div className="ai-idea-card-tools">
                          <span className={`ai-idea-status ${aiIdeaStatusClass[idea.status] || 'received'}`}>{idea.status}</span>
                          <button
                            className="ai-idea-delete-btn"
                            type="button"
                            aria-label={`${idea.title} 삭제`}
                            onClick={(event) => { event.stopPropagation(); setIdeaToDelete(idea); }}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <h3>{idea.title}</h3>
                    </article>
                  ))}
                </div>
              </section>

              <form className="ai-idea-panel ai-idea-form" onSubmit={submitAiIdea}>
                <div className="ai-idea-panel-head">
                  <div>
                    <span>SUBMIT</span>
                    <h2>아이디어 작성</h2>
                  </div>
                  <div className="ai-idea-form-progress">
                    <div><span><b>{aiIdeaCompletedFieldCount}</b>/4</span><small>필수 항목 작성</small></div>
                    <i><b style={{ width: `${aiIdeaCompletedFieldCount / 4 * 100}%` }} /></i>
                  </div>
                </div>

                <label className="form-field">
                  <span className="ai-idea-field-label"><em>01</em><b>제목</b><small>필수</small>{aiIdeaForm.title.trim() ? <CheckCircle2 size={15} /> : <i />}</span>
                  <input value={aiIdeaForm.title} onChange={(event) => updateAiIdeaField('title', event.target.value)} placeholder="예: 설비 알람 원인 자동 분류" required />
                </label>

                <label className="form-field">
                  <span className="ai-idea-field-label"><em>02</em><b>문제 정의</b><small>필수</small>{aiIdeaForm.problem_definition.trim() ? <CheckCircle2 size={15} /> : <i />}</span>
                  <textarea value={aiIdeaForm.problem_definition} onChange={(event) => updateAiIdeaField('problem_definition', event.target.value)} placeholder="현재 업무에서 어떤 문제가 반복되는지 작성해 주세요." rows="4" required />
                </label>

                <label className="form-field">
                  <span className="ai-idea-field-label"><em>03</em><b>제안 내용</b><small>필수</small>{aiIdeaForm.proposal.trim() ? <CheckCircle2 size={15} /> : <i />}</span>
                  <textarea value={aiIdeaForm.proposal} onChange={(event) => updateAiIdeaField('proposal', event.target.value)} placeholder="AI를 어떻게 적용하면 좋을지 구체적으로 작성해 주세요." rows="5" required />
                </label>

                <label className="form-field">
                  <span className="ai-idea-field-label"><em>04</em><b>예상 효과</b><small>필수</small>{aiIdeaForm.effect.trim() ? <CheckCircle2 size={15} /> : <i />}</span>
                  <textarea value={aiIdeaForm.effect} onChange={(event) => updateAiIdeaField('effect', event.target.value)} placeholder="시간 절감, 오류 감소, 표준화 등 기대 효과를 작성해 주세요." rows="3" required />
                </label>

                <div className="form-field">
                  <span className="ai-idea-field-label"><em>05</em><b>참고자료</b><small>선택</small>{aiIdeaForm.attachments.length > 0 ? <CheckCircle2 size={15} /> : <i />}</span>
                  <input
                    ref={aiIdeaFileInputRef}
                    className="ai-idea-file-input"
                    type="file"
                    multiple
                    onChange={(event) => { const selectedFiles = Array.from(event.target.files || []); updateAiIdeaFiles(selectedFiles); event.target.value = ''; }}
                  />
                  <button className="ai-idea-file-drop" type="button" onClick={() => aiIdeaFileInputRef.current?.click()}>
                    <Plus size={18} />
                    <strong>파일 선택</strong>
                    <em>{aiIdeaForm.attachments.length > 0 ? `${aiIdeaForm.attachments.length}개 파일이 선택되었습니다.` : '문서, 이미지, 표 파일 등을 여러 개 첨부할 수 있습니다.'}</em>
                  </button>
                  {aiIdeaForm.attachments.length > 0 && (
                    <div className="ai-idea-file-list">
                      {aiIdeaForm.attachments.map((file, index) => (
                        <div className="ai-idea-file-item" key={`${file.name}-${file.size}-${file.lastModified}`}>
                          <span>{file.name}</span>
                          <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
                          <button type="button" aria-label={`${file.name} 제거`} onClick={() => removeAiIdeaFile(index)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {aiIdeaError && <div className="form-error">{aiIdeaError}</div>}
                <div className="form-actions ai-idea-actions">
                  <button className="line-btn" type="button" onClick={() => { setAiIdeaForm(emptyAiIdeaForm); setAiIdeaMessage(''); setIsAiIdeaSuccessOpen(false); }}>초기화</button>
                  <button className="primary-btn" type="submit" disabled={isSubmittingAiIdea}><Send size={16} />{isSubmittingAiIdea ? '접수 중...' : '아이디어 보내기'}</button>
                </div>
              </form>
            </div>

            {ideaToDelete && (
              <div className="news-modal-backdrop" role="presentation" onMouseDown={() => setIdeaToDelete(null)}>
                <article className="ai-idea-confirm-modal" role="dialog" aria-modal="true" aria-label="아이디어 삭제 확인" onMouseDown={(event) => event.stopPropagation()}>
                  <button className="news-modal-close ai-idea-confirm-close" type="button" aria-label="닫기" onClick={() => setIdeaToDelete(null)}>×</button>
                  <div className="ai-idea-confirm-icon"><Trash2 size={22} /></div>
                  <h2>아이디어를 삭제할까요?</h2>
                  <p><strong>{ideaToDelete.title}</strong> 제안은 삭제 후 되돌릴 수 없습니다.</p>
                  <div className="ai-idea-confirm-actions">
                    <button className="line-btn" type="button" onClick={() => setIdeaToDelete(null)}>아니오</button>
                    <button className="primary-btn danger" type="button" onClick={deleteAiIdea}>예</button>
                  </div>
                </article>
              </div>
            )}

            {isAiIdeaSuccessOpen && aiIdeaMessage && (
              <div className="news-modal-backdrop" role="presentation" onMouseDown={() => setIsAiIdeaSuccessOpen(false)}>
                <article className="ai-idea-success-modal" role="dialog" aria-modal="true" aria-label="아이디어 접수 완료" onMouseDown={(event) => event.stopPropagation()}>
                  <button className="news-modal-close ai-idea-success-close" type="button" aria-label="닫기" onClick={() => setIsAiIdeaSuccessOpen(false)}>×</button>
                  <div className="ai-idea-success-icon"><Send size={22} /></div>
                  <h2>접수 완료</h2>
                  <p>{aiIdeaMessage}</p>
                  <button className="primary-btn" type="button" onClick={() => setIsAiIdeaSuccessOpen(false)}>확인</button>
                </article>
              </div>
            )}

            {selectedAiIdea && (
              <div className="news-modal-backdrop" role="presentation" onMouseDown={() => setSelectedAiIdea(null)}>
                <article className="ai-idea-proposal-modal" role="dialog" aria-modal="true" aria-label="AI 아이디어 제안서" onMouseDown={(event) => event.stopPropagation()}>
                  <button className="news-modal-close ai-idea-proposal-close" type="button" aria-label="닫기" onClick={() => setSelectedAiIdea(null)}>×</button>
                  <header className="ai-idea-proposal-head">
                    <div className="ai-idea-proposal-title">
                      <span>AI IDEA PROPOSAL</span>
                      <h2>{selectedAiIdea.title}</h2>
                      <p>DX추진랩 검토 대상 제안서</p>
                    </div>
                    <div className="ai-idea-proposal-meta">
                      <div><span>상태</span><strong className={`proposal-status ${aiIdeaStatusClass[selectedAiIdea.status] || 'received'}`}>{selectedAiIdea.status}</strong></div>
                      <div><span>제출일</span><strong>{formatDate(selectedAiIdea.created_at)}</strong></div>
                    </div>
                  </header>

                  {selectedAiIdea.status !== '접수완료' && selectedAiIdea.review_comment && (
                    <section className={`idea-review-result-panel ${aiIdeaStatusClass[selectedAiIdea.status] || 'received'}`}>
                      <div>
                        <span>심사 완료</span>
                        <strong>{selectedAiIdea.status}</strong>
                      </div>
                      <div className="idea-review-result-message">{selectedAiIdea.review_comment}</div>
                      {selectedAiIdea.reviewed_at && <time>{formatDate(selectedAiIdea.reviewed_at)}</time>}
                    </section>
                  )}

                  <div className="ai-idea-proposal-body">
                    <section className="ai-idea-proposal-section">
                      <span>01</span>
                      <div>
                        <h3>문제 정의</h3>
                        <p>{selectedAiIdea.problem_definition}</p>
                      </div>
                    </section>
                    <section className="ai-idea-proposal-section">
                      <span>02</span>
                      <div>
                        <h3>제안 내용</h3>
                        <p>{selectedAiIdea.proposal}</p>
                      </div>
                    </section>
                    <section className="ai-idea-proposal-section highlight">
                      <span>03</span>
                      <div>
                        <h3>예상 효과</h3>
                        <p>{selectedAiIdea.effect}</p>
                      </div>
                    </section>
                    <section className="ai-idea-proposal-section">
                      <span>04</span>
                      <div>
                        <h3>참고자료</h3>
                        {selectedAiIdea.attachments?.length > 0 ? (
                          <div className="ai-idea-proposal-files">
                            {selectedAiIdea.attachments.map((attachment) => attachment.url ? <button key={attachment.attachment_id} type="button" onClick={() => downloadIdeaAttachment(attachment)}>{ideaAttachmentName(attachment)}</button> : <b key={ideaAttachmentName(attachment)}>{ideaAttachmentName(attachment)}</b>)}
                          </div>
                        ) : (
                          <p>첨부된 참고자료가 없습니다.</p>
                        )}
                      </div>
                    </section>
                  </div>
                </article>
              </div>
            )}
          </section>
        )}

        {isAdminView && adminPage === "asset-management" && (
          <section className="content admin-asset-page">
            <div className="account-head">
              <div>
                <span>ADMIN</span>
                <h1>AI 자산 관리</h1>
                <p>접수된 AI 자산을 심사하고 승인된 운영 자산을 관리합니다.</p>
              </div>
            </div>

            <div className="admin-asset-tabs" role="tablist" aria-label="AI 자산 관리 분류">
              <button className={adminAssetTab === "requests" ? "active" : ""} type="button" role="tab" aria-selected={adminAssetTab === "requests"} onClick={() => setAdminAssetTab("requests")}>
                <span>자산 등록 요청</span><b>{pendingAdminAssets.length}</b>
              </button>
              <button className={adminAssetTab === "operating" ? "active" : ""} type="button" role="tab" aria-selected={adminAssetTab === "operating"} onClick={() => setAdminAssetTab("operating")}>
                <span>운영 자산</span><b>{operatingAdminAssets.length}</b>
              </button>
              <button className={adminAssetTab === "rejected" ? "active" : ""} type="button" role="tab" aria-selected={adminAssetTab === "rejected"} onClick={() => setAdminAssetTab("rejected")}>
                <span>반려 자산</span><b>{rejectedAdminAssets.length}</b>
              </button>
            </div>

            {adminAssetsError && !assetReviewTarget && <div className="form-error">{adminAssetsError}</div>}

            <section className="admin-asset-panel">
              <header className="admin-asset-panel-head">
                <div>
                  <span>{adminAssetTab === "requests" ? "REGISTRATION REQUESTS" : adminAssetTab === "operating" ? "APPROVED ASSETS" : "REJECTED ASSETS"}</span>
                  <h2>{adminAssetTab === "requests" ? "자산 등록 요청 리스트" : adminAssetTab === "operating" ? "실제 운영중인 자산 목록" : "반려된 자산 목록"}</h2>
                </div>
                <div className="admin-asset-panel-tools">
                  {adminAssetTab === "operating" && (
                    <div className="admin-asset-search">
                      <Search size={16} aria-hidden="true" />
                      <input type="search" value={adminAssetQuery} onChange={(event) => setAdminAssetQuery(event.target.value)} placeholder="자산 이름으로 검색" aria-label="운영 자산 이름 검색" />
                    </div>
                  )}
                  <b>{adminAssetTab === "requests" ? pendingAdminAssets.length : adminAssetTab === "operating" ? filteredOperatingAdminAssets.length : rejectedAdminAssets.length}건</b>
                </div>
              </header>

              <div className="admin-asset-list">
                {isLoadingAdminAssets ? (
                  <div className="admin-asset-empty"><span className="asset-reg-spinner" /> 자산 목록을 불러오고 있습니다.</div>
                ) : adminAssetTab === "requests" ? (
                  pendingAdminAssets.length === 0 ? <div className="admin-asset-empty"><ShieldCheck size={22} /><b>대기 중인 등록 요청이 없습니다</b></div> : pendingAdminAssets.map((asset) => (
                    <article className="admin-asset-row" key={asset.asset_id}>
                      <div className="admin-asset-icon"><Bot size={18} /></div>
                      <div className="admin-asset-info">
                        <div><h3>{asset.asset_name}</h3><span className="admin-asset-status submitted">심사 대기</span></div>
                        <p>{asset.description}</p>
                        <div className="admin-asset-meta"><span>{asset.business_area}</span><span>{asset.maturity_level}</span><span>{asset.owner_org} · {asset.owner_name} {asset.owner_job_title}</span><time>{formatDate(asset.submitted_at || asset.created_at)}</time></div>
                      </div>
                      <div className="admin-asset-actions">
                        <button type="button" disabled={assetDocumentLoadingId === asset.asset_id} onClick={() => openAssetRegistrationDocument(asset)}><Eye size={14} />{assetDocumentLoadingId === asset.asset_id ? "Loading" : "View"}</button>
                        <button className="review" type="button" onClick={() => openAssetReviewForm(asset)}><ShieldCheck size={14} />심사</button>
                      </div>
                    </article>
                  ))
                ) : adminAssetTab === "operating" ? (
                  filteredOperatingAdminAssets.length === 0 ? <div className="admin-asset-empty"><Search size={22} /><b>{adminAssetQuery.trim() ? "검색 결과가 없습니다" : "운영중인 AI 자산이 없습니다"}</b></div> : filteredOperatingAdminAssets.map((asset) => (
                    <article className={"admin-asset-row operating " + (asset.is_active ? "" : "inactive")} key={asset.asset_id}>
                      <div className={"admin-asset-icon approved " + (asset.is_active ? "" : "inactive")}><Bot size={18} /></div>
                      <div className="admin-asset-info">
                        <div><h3>{asset.asset_name}</h3><span className={"admin-asset-status " + (asset.is_active ? "approved" : "inactive")}>{asset.is_active ? "활성" : "비활성"}</span></div>
                        <p>{asset.description}</p>
                        <div className="admin-asset-meta"><span>{asset.business_area}</span><span>{asset.maturity_level}</span><span>{asset.owner_org} · {asset.owner_name}</span><time>승인 {formatDate(asset.reviewed_at)}</time></div>
                      </div>
                      <div className="admin-asset-metrics">
                        <span><b>{asset.view_count}</b>조회</span>
                        <span><b>{asset.diffusion_attempt_count}</b>확산 시도</span>
                        <span><b>{asset.diffusion_completed_count}</b>확산 완료</span>
                      </div>
                      <div className="admin-asset-ops">
                        <label className="admin-asset-toggle" title={asset.is_active ? "자산 비활성화" : "자산 활성화"}>
                          <input type="checkbox" checked={asset.is_active} disabled={assetActivationId === asset.asset_id} onChange={() => toggleAdminAssetActivation(asset)} />
                          <span aria-hidden="true" />
                          <em>{assetActivationId === asset.asset_id ? "변경 중" : asset.is_active ? "활성" : "비활성"}</em>
                        </label>
                        <div className="admin-asset-icon-actions">
                          <button type="button" title="자산 등록서 보기" aria-label="자산 등록서 보기" disabled={assetDocumentLoadingId === asset.asset_id} onClick={() => openAssetRegistrationDocument(asset)}><Eye size={15} /></button>
                          <button className="delete" type="button" title="자산 삭제" aria-label="자산 삭제" onClick={() => openAssetDeleteConfirm(asset)}><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  rejectedAdminAssets.length === 0 ? <div className="admin-asset-empty"><ShieldCheck size={22} /><b>반려된 AI 자산이 없습니다</b></div> : rejectedAdminAssets.map((asset) => (
                    <article className="admin-asset-row rejected" key={asset.asset_id}>
                      <div className="admin-asset-icon rejected"><Bot size={18} /></div>
                      <div className="admin-asset-info">
                        <div><h3>{asset.asset_name}</h3><span className="admin-asset-status rejected">반려</span></div>
                        <p>{asset.description}</p>
                        <div className="admin-asset-meta"><span>{asset.business_area}</span><span>{asset.maturity_level}</span><span>{asset.owner_org} · {asset.owner_name} {asset.owner_job_title}</span><time>심사 {formatDate(asset.reviewed_at)}</time></div>
                      </div>
                      <div className="admin-asset-actions">
                        <button type="button" disabled={assetDocumentLoadingId === asset.asset_id} onClick={() => openAssetRegistrationDocument(asset)}><Eye size={14} />{assetDocumentLoadingId === asset.asset_id ? "Loading" : "View"}</button>
                        <button className="delete" type="button" onClick={() => openAssetDeleteConfirm(asset)}><Trash2 size={14} />삭제</button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            {assetDeleteTarget && (
              <div className="news-modal-backdrop admin-asset-delete-backdrop" role="presentation" onMouseDown={closeAssetDeleteConfirm}>
                <article className="admin-asset-delete-modal" role="dialog" aria-modal="true" aria-label="AI 자산 삭제 확인" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="admin-asset-delete-icon"><Trash2 size={20} /></div>
                  <div className="admin-asset-delete-copy">
                    <span>DELETE ASSET</span>
                    <h2>{assetDeleteTarget.approval_status === "rejected" ? "반려 자산을 삭제할까요?" : "운영 자산을 삭제할까요?"}</h2>
                    <strong>{assetDeleteTarget.asset_name}</strong>
                    <p>자산 정보와 연결된 데이터가 DB에서 삭제되며, workspace의 자산 파일도 함께 제거됩니다. 삭제 후에는 복구할 수 없습니다.</p>
                  </div>
                  {adminAssetsError && <div className="form-error">{adminAssetsError}</div>}
                  <div className="admin-asset-delete-actions">
                    <button className="line-btn" type="button" disabled={isDeletingAsset} onClick={closeAssetDeleteConfirm}>취소</button>
                    <button className="primary-btn danger" type="button" disabled={isDeletingAsset} onClick={deleteAdminAsset}>{isDeletingAsset ? "삭제 중..." : "삭제"}</button>
                  </div>
                </article>
              </div>
            )}

            {assetReviewTarget && (
              <div className="news-modal-backdrop admin-asset-review-backdrop" role="presentation" onMouseDown={closeAssetReviewForm}>
                <form className="admin-asset-review-modal" onSubmit={submitAssetReview} onMouseDown={(event) => event.stopPropagation()}>
                  <button className="news-modal-close admin-asset-review-close" type="button" aria-label="닫기" onClick={closeAssetReviewForm}>×</button>
                  <div className="admin-asset-review-head">
                    <span>ASSET REVIEW</span>
                    <h2>AI 자산 심사</h2>
                    <p>{assetReviewTarget.asset_name}</p>
                  </div>
                  <label className="form-field">
                    <span>심사 결과</span>
                    <div className="admin-asset-review-choice">
                      <button className={assetReviewForm.status === "approved" ? "approve active" : "approve"} type="button" onClick={() => setAssetReviewForm((current) => ({ ...current, status: "approved" }))}>Approve</button>
                      <button className={assetReviewForm.status === "rejected" ? "reject active" : "reject"} type="button" onClick={() => setAssetReviewForm((current) => ({ ...current, status: "rejected" }))}>Reject</button>
                    </div>
                  </label>
                  <label className="form-field">
                    <span>심사 메시지</span>
                    <textarea value={assetReviewForm.comment} onChange={(event) => setAssetReviewForm((current) => ({ ...current, comment: event.target.value }))} placeholder="승인 또는 반려 사유와 필요한 후속 조치를 작성하세요." rows="6" required />
                  </label>
                  {adminAssetsError && <div className="form-error">{adminAssetsError}</div>}
                  <div className="admin-asset-review-actions">
                    <button className="line-btn" type="button" disabled={isReviewingAsset} onClick={closeAssetReviewForm}>취소</button>
                    <button className="primary-btn" type="submit" disabled={isReviewingAsset || !assetReviewForm.status || !assetReviewForm.comment.trim()}>{isReviewingAsset ? "처리 중..." : "심사 완료"}</button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {isAdminView && adminPage === 'idea-review' && (
          <section className="content idea-review-page">
            <div className="account-head">
              <div>
                <span>ADMIN</span>
                <h1>Idea 심사</h1>
                <p>DX추진랩에 접수된 AI 아이디어를 검토하고 심사 상태를 관리합니다.</p>
              </div>
            </div>

            {adminIdeaError && <div className="form-error">{adminIdeaError}</div>}

            <div className="idea-review-layout">
              {[
                { title: '심사 필요', count: pendingReviewIdeas.length, items: pendingReviewIdeas },
                { title: '심사 완료', count: completedReviewIdeas.length, items: completedReviewIdeas },
              ].map((column) => (
                <section className="idea-review-column" key={column.title}>
                  <div className="idea-review-column-head">
                    <div>
                      <span>IDEA REVIEW</span>
                      <h2>{column.title}</h2>
                    </div>
                    <b>{column.count}건</b>
                  </div>
                  <div className="idea-review-list">
                    {isLoadingAdminIdeas ? (
                      <div className="empty-state">아이디어 목록을 불러오는 중입니다.</div>
                    ) : column.items.length === 0 ? (
                      <div className="empty-state">표시할 아이디어가 없습니다.</div>
                    ) : column.items.map((idea) => (
                      <article
                        className={`idea-review-card ${column.title === '심사 완료' ? `completed ${aiIdeaStatusClass[idea.status] || 'received'}` : ''}`}
                        key={idea.idea_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedAiIdea(idea)}
                        onKeyDown={(event) => { if (event.key === 'Enter') setSelectedAiIdea(idea); }}
                      >
                        {column.title === '심사 완료' && <span className={`idea-review-result-ribbon ${aiIdeaStatusClass[idea.status] || 'received'}`}>{idea.status}</span>}
                        <h3>{idea.title}</h3>
                        <div className="idea-review-card-meta">
                          <span>{ideaAuthor(idea)}</span>
                          <time>{formatDate(idea.created_at)}</time>
                        </div>
                        <div className="idea-review-card-status-row"><span className="idea-review-result-badge placeholder" aria-hidden="true">대기</span></div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {ideaReviewTarget && (
              <div className="news-modal-backdrop idea-review-submit-backdrop" role="presentation" onMouseDown={closeIdeaReviewForm}>
                <form className="idea-review-submit-modal" onSubmit={submitIdeaReview} onMouseDown={(event) => event.stopPropagation()}>
                  <button className="news-modal-close idea-review-submit-close" type="button" aria-label="닫기" onClick={closeIdeaReviewForm}>×</button>
                  <div className="idea-review-submit-head">
                    <span>IDEA REVIEW</span>
                    <h2>심사 의견 작성</h2>
                    <p>{ideaReviewTarget.title}</p>
                  </div>
                  <label className="form-field">
                    <span>심사 결과</span>
                    <div className="idea-review-choice">
                      {['선정', '미선정'].map((statusOption) => (
                        <button
                          key={statusOption}
                          className={ideaReviewForm.status === statusOption ? 'active' : ''}
                          type="button"
                          onClick={() => setIdeaReviewForm((current) => ({ ...current, status: statusOption }))}
                        >
                          {statusOption}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label className="form-field">
                    <span>심사 의견</span>
                    <textarea
                      value={ideaReviewForm.comment}
                      onChange={(event) => setIdeaReviewForm((current) => ({ ...current, comment: event.target.value }))}
                      placeholder="선정 또는 미선정 사유와 후속 안내를 작성하세요."
                      rows="6"
                      required
                    />
                  </label>
                  {adminIdeaError && <div className="form-error">{adminIdeaError}</div>}
                  <div className="form-actions">
                    <button className="line-btn" type="button" onClick={closeIdeaReviewForm}>취소</button>
                    <button className="primary-btn" type="submit" disabled={isUpdatingIdeaStatus || !ideaReviewForm.status || !ideaReviewForm.comment.trim()}>보내기</button>
                  </div>
                </form>
              </div>
            )}

            {selectedAiIdea && (
              <div className="news-modal-backdrop" role="presentation" onMouseDown={() => setSelectedAiIdea(null)}>
                <article className="ai-idea-proposal-modal" role="dialog" aria-modal="true" aria-label="AI 아이디어 제안서" onMouseDown={(event) => event.stopPropagation()}>
                  <button className="news-modal-close ai-idea-proposal-close" type="button" aria-label="닫기" onClick={() => setSelectedAiIdea(null)}>×</button>
                  <header className="ai-idea-proposal-head">
                    <div className="ai-idea-proposal-title">
                      <span>AI IDEA PROPOSAL</span>
                      <h2>{selectedAiIdea.title}</h2>
                      <p>{ideaAuthor(selectedAiIdea)}</p>
                    </div>
                    <div className="ai-idea-proposal-meta">
                      <div><span>상태</span><strong className={`proposal-status ${aiIdeaStatusClass[selectedAiIdea.status] || 'received'}`}>{selectedAiIdea.status}</strong></div>
                      <div><span>제출일</span><strong>{formatDate(selectedAiIdea.created_at)}</strong></div>
                    </div>
                  </header>

                  {selectedAiIdea.status === '접수완료' ? (
                    <div className="idea-review-actions">
                      <span>심사 의견을 작성해 결과를 전송하세요.</span>
                      <button className="primary-btn" type="button" onClick={() => openIdeaReviewForm(selectedAiIdea)}>심사</button>
                    </div>
                  ) : selectedAiIdea.review_comment && (
                    <section className={`idea-review-result-panel ${aiIdeaStatusClass[selectedAiIdea.status] || 'received'}`}>
                      <div>
                        <span>심사 완료</span>
                        <strong>{selectedAiIdea.status}</strong>
                      </div>
                      <div className="idea-review-result-message">{selectedAiIdea.review_comment}</div>
                      {selectedAiIdea.reviewed_at && <time>{formatDate(selectedAiIdea.reviewed_at)}</time>}
                    </section>
                  )}

                  <div className="ai-idea-proposal-body">
                    <section className="ai-idea-proposal-section">
                      <span>01</span>
                      <div><h3>문제 정의</h3><p>{selectedAiIdea.problem_definition}</p></div>
                    </section>
                    <section className="ai-idea-proposal-section">
                      <span>02</span>
                      <div><h3>제안 내용</h3><p>{selectedAiIdea.proposal}</p></div>
                    </section>
                    <section className="ai-idea-proposal-section highlight">
                      <span>03</span>
                      <div><h3>예상 효과</h3><p>{selectedAiIdea.effect}</p></div>
                    </section>
                    <section className="ai-idea-proposal-section">
                      <span>04</span>
                      <div>
                        <h3>참고자료</h3>
                        {selectedAiIdea.attachments?.length > 0 ? (
                          <div className="ai-idea-proposal-files">
                            {selectedAiIdea.attachments.map((attachment) => attachment.url ? <button key={attachment.attachment_id} type="button" onClick={() => downloadIdeaAttachment(attachment)}>{ideaAttachmentName(attachment)}</button> : <b key={ideaAttachmentName(attachment)}>{ideaAttachmentName(attachment)}</b>)}
                          </div>
                        ) : (
                          <p>첨부된 참고자료가 없습니다.</p>
                        )}
                      </div>
                    </section>
                  </div>
                </article>
              </div>
            )}
          </section>
        )}

        {isAdminView && adminPage === 'accounts' && (
          <section className="content account-page">
            <div className="account-head">
              <div>
                <span>ADMIN</span>
                <h1>계정 관리</h1>
                <p>AI Lounge 접속 계정을 추가하고 권한과 기본 정보를 관리합니다.</p>
              </div>
            </div>

            <div className="account-layout">
              <form className="account-panel account-form" onSubmit={saveAccount}>
                <div className="account-panel-head">
                  <span>{editingUserId ? 'EDIT' : 'CREATE'}</span>
                  <h2>{editingUserId ? '계정 수정' : '계정 추가'}</h2>
                </div>

                <div className="form-row">
                  <label className="form-field">
                    <span>사번</span>
                    <input value={accountForm.login_id} onChange={(event) => updateAccountField('login_id', event.target.value)} required />
                  </label>
                  <label className="form-field">
                    <span>이름</span>
                    <input value={accountForm.displayed_name} onChange={(event) => updateAccountField('displayed_name', event.target.value)} required />
                  </label>
                </div>
                <label className="form-field">
                  <span>이메일</span>
                  <input type="email" value={accountForm.email} onChange={(event) => updateAccountField('email', event.target.value)} placeholder="name@hyundai-wia.com" required />
                </label>
                <div className="form-row">
                  <label className="form-field">
                    <span>조직</span>
                    <input value={accountForm.org_name} onChange={(event) => updateAccountField('org_name', event.target.value)} required />
                  </label>
                  <label className="form-field">
                    <span>직책</span>
                    <input value={accountForm.job_title} onChange={(event) => updateAccountField('job_title', event.target.value)} required />
                  </label>
                </div>
                <label className="form-field">
                  <span>{editingUserId ? '새 비밀번호' : '비밀번호'}</span>
                  <input type="password" value={accountForm.password} onChange={(event) => updateAccountField('password', event.target.value)} required={!editingUserId} />
                </label>
                <label className="check-field">
                  <input type="checkbox" checked={accountForm.is_admin} onChange={(event) => updateAccountField('is_admin', event.target.checked)} />
                  <span>관리자 계정</span>
                </label>

                {accountError && <div className="form-error">{accountError}</div>}

                <div className="form-actions">
                  {editingUserId && <button className="line-btn" type="button" onClick={resetAccountForm}>취소</button>}
                  <button className="primary-btn" type="submit" disabled={isSavingAccount}>
                    {isSavingAccount ? <span className="btn-spinner" /> : <UserPlus size={16} />}
                    {editingUserId ? '수정 저장' : '계정 추가'}
                  </button>
                </div>
              </form>

              <section className="account-panel account-list-panel">
                <div className="account-panel-head account-list-head">
                  <div>
                    <span>ACCOUNTS</span>
                    <h2>계정 리스트</h2>
                  </div>
                  <label className="account-filter">
                    <span>조직</span>
                    <select value={orgFilter} onChange={(event) => setOrgFilter(event.target.value)}>
                      <option value="all">전체</option>
                      {orgFilterOptions.map((orgName) => <option value={orgName} key={orgName}>{orgName}</option>)}
                    </select>
                  </label>
                </div>

                <div className="account-table-wrap">
                  <table className="account-table">
                    <thead>
                      <tr>
                        <th>사번</th>
                        <th>이름</th>
                        <th>이메일</th>
                        <th>조직</th>
                        <th>직책</th>
                        <th>권한</th>
                        <th>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingAccounts ? (
                        <tr><td colSpan="7" className="table-empty">계정 목록을 불러오는 중입니다.</td></tr>
                      ) : filteredAccounts.length === 0 ? (
                        <tr><td colSpan="7" className="table-empty">조건에 맞는 계정이 없습니다.</td></tr>
                      ) : filteredAccounts.map((account) => (
                        <tr key={account.user_id}>
                          <td>{account.login_id}</td>
                          <td>{account.displayed_name}</td>
                          <td className="account-email-cell">{account.email || '-'}</td>
                          <td>{account.org_name}</td>
                          <td>{account.job_title}</td>
                          <td><span className={`role-badge ${account.is_admin ? 'admin' : ''}`}>{account.is_admin ? '관리자' : '사용자'}</span></td>
                          <td>
                            <div className="table-actions">
                              <button className="icon-line-btn" type="button" aria-label="수정" onClick={() => startEditAccount(account)}><Pencil size={14} /></button>
                              <button className="icon-line-btn danger" type="button" aria-label="삭제" onClick={() => deleteAccount(account)} disabled={account.user_id === authUser.user_id}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </section>
        )}
        {isAdminView && adminPage === 'tech-news-write' && (
          <section className="content news-admin-page">
            <div className="account-head">
              <div>
                <span>AX COMMUNITY</span>
                <h1>Tech News 작성하기</h1>
                <p>마크다운 본문과 커버 이미지를 등록해 AI Tech News 게시글을 발행합니다.</p>
              </div>
            </div>

            <div className="news-admin-tabs" role="tablist" aria-label="Tech News 관리 탭">
              <button className={`news-admin-tab ${newsAdminTab === 'write' ? 'active' : ''}`} type="button" role="tab" aria-selected={newsAdminTab === 'write'} onClick={() => setNewsAdminTab('write')}>작성</button>
              <button className={`news-admin-tab ${newsAdminTab === 'manage' ? 'active' : ''}`} type="button" role="tab" aria-selected={newsAdminTab === 'manage'} onClick={() => { setNewsAdminTab('manage'); loadNewsList(); }}>관리</button>
            </div>

            {newsAdminTab === 'write' ? (
              <form className="news-editor" onSubmit={publishNews}>
                <section className="news-editor-panel">
                  <div className="account-panel-head">
                    <span>{editingNewsId ? 'EDIT' : 'WRITE'}</span>
                    <h2>{editingNewsId ? '게시글 수정' : '게시글 작성'}</h2>
                  </div>
                  <label className="form-field">
                    <span>제목</span>
                    <input value={newsTitle} onChange={(event) => setNewsTitle(event.target.value)} required />
                  </label>
                  <label className="form-field">
                    <span>커버 이미지</span>
                    <input key={editingNewsId || 'new-cover'} type="file" accept="image/*" onChange={(event) => setNewsCover(event.target.files?.[0] || null)} />
                  </label>
                  <label className="form-field">
                    <span>기사 소스</span>
                    <textarea className="source-input" value={newsSource} onChange={(event) => setNewsSource(event.target.value)} placeholder="기사 원문, 주요 문단, 메모를 붙여 넣으세요." />
                  </label>
                  <button className="line-btn draft-btn" type="button" onClick={draftNewsMarkdown} disabled={isDraftingNews || !newsSource.trim()}>
                    {isDraftingNews ? <span className="btn-spinner blue" /> : <Wand2 size={16} />}
                    마크다운 자동 작성
                  </button>
                  {newsError && <div className="form-error">{newsError}</div>}
                  <div className="form-actions">
                    {editingNewsId && <button className="line-btn" type="button" onClick={resetNewsForm}>취소</button>}
                    <button className="primary-btn" type="submit" disabled={isPublishingNews}>
                      {isPublishingNews ? <span className="btn-spinner" /> : <Send size={16} />}
                      {editingNewsId ? '수정 저장' : '발행'}
                    </button>
                  </div>
                </section>

                <section className="news-editor-panel preview-panel">
                  <div className="account-panel-head">
                    <span>PREVIEW</span>
                    <h2>미리보기</h2>
                  </div>
                  <div className="editable-preview">
                    <h1>{newsTitle || '제목을 입력하세요'}</h1>
                    <textarea
                      className="markdown-preview-editor"
                      value={newsMarkdown}
                      onChange={(event) => setNewsMarkdown(event.target.value)}
                      placeholder="기사 소스를 붙여 넣고 마크다운 자동 작성을 누르거나, 여기에 직접 본문을 작성하세요."
                    />
                  </div>
                </section>
              </form>
            ) : (
              <section className="news-editor-panel news-manage-panel">
                <div className="account-panel-head account-list-head">
                  <div>
                    <span>MANAGE</span>
                    <h2>작성된 글 관리</h2>
                  </div>
                  <button className="line-btn" type="button" onClick={loadNewsList} disabled={isLoadingNews}>새로고침</button>
                </div>

                {newsError && <div className="form-error">{newsError}</div>}

                <div className="account-table-wrap news-manage-table-wrap">
                  <table className="account-table news-manage-table">
                    <thead>
                      <tr>
                        <th>커버</th>
                        <th>제목</th>
                        <th>작성일</th>
                        <th>수정일</th>
                        <th>조회수</th>
                        <th>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingNews ? (
                        <tr><td colSpan="6" className="table-empty">뉴스 목록을 불러오는 중입니다.</td></tr>
                      ) : newsList.length === 0 ? (
                        <tr><td colSpan="6" className="table-empty">작성된 Tech News가 없습니다.</td></tr>
                      ) : newsList.map((news) => (
                        <tr key={news.news_id}>
                          <td>
                            <div className="manage-news-thumb">
                              {news.cover_image_url ? <img src={`${API_BASE}${news.cover_image_url}`} alt="" /> : <span>AI</span>}
                            </div>
                          </td>
                          <td><b className="manage-news-title">{news.title}</b></td>
                          <td>{news.created_at.slice(0, 10)}</td>
                          <td>{news.updated_at.slice(0, 10)}</td>
                          <td><span className="news-view-count manage-view-count"><Eye size={14} />{formatViewCount(news.view_count)}</span></td>
                          <td>
                            <div className="table-actions">
                              <button className="icon-line-btn" type="button" aria-label="수정" onClick={() => startEditNews(news)}><Pencil size={14} /></button>
                              <button className="icon-line-btn danger" type="button" aria-label="삭제" onClick={() => deleteNews(news)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </section>
        )}


      {assetFeedbackTarget && (
        <div className="news-modal-backdrop asset-feedback-backdrop" role="presentation" onMouseDown={() => setAssetFeedbackTarget(null)}>
          <article className="asset-feedback-modal" role="dialog" aria-modal="true" aria-label="AI 자산 심사평" onMouseDown={(event) => event.stopPropagation()}>
            <button className="news-modal-close asset-feedback-close" type="button" aria-label="닫기" onClick={() => setAssetFeedbackTarget(null)}>×</button>
            <header><span>ASSET REVIEW</span><h2>심사평</h2></header>
            <dl>
              <div><dt>심사 날짜</dt><dd>{formatDate(assetFeedbackTarget.reviewed_at)}</dd></div>
              <div><dt>심사평</dt><dd>{assetFeedbackTarget.review_comment || "등록된 심사평이 없습니다."}</dd></div>
            </dl>
          </article>
        </div>
      )}

      {isAssetDocumentOpen && (
        <div className="news-modal-backdrop asset-document-backdrop" role="presentation" onMouseDown={closeAssetRegistrationDocument}>
          <article className="asset-document-modal" role="dialog" aria-modal="true" aria-label="AI 자산 등록서" onMouseDown={(event) => event.stopPropagation()}>
            <header className="asset-document-modal-head">
              <div><span>AI 자산 등록서</span><b>{assetDocumentTitle}</b></div>
              <button type="button" aria-label="닫기" onClick={closeAssetRegistrationDocument}>×</button>
            </header>
            <div className="asset-document-modal-body">
              {assetDocumentLoadingId && <div className="asset-document-loading"><span className="asset-reg-spinner" /><b>자산 등록서를 구성하고 있습니다</b><p>등록 정보와 첨부 파일을 불러오는 중입니다.</p></div>}
              {!assetDocumentLoadingId && assetDocumentError && <div className="asset-document-error"><b>등록서를 불러오지 못했습니다</b><p>{assetDocumentError}</p></div>}
              {!assetDocumentLoadingId && !assetDocumentError && assetDocumentHtml && <iframe title={assetDocumentTitle + " 자산 등록서"} srcDoc={assetDocumentHtml} sandbox="allow-scripts allow-popups" />}
            </div>
          </article>
        </div>
      )}

      {isSkillProgressOpen && (
        <div className="news-modal-backdrop asset-reg-skill-progress-backdrop" role="presentation">
          <article className="asset-reg-skill-progress-modal" role="dialog" aria-modal="true" aria-label="Skill 자동 생성 진행">
            <header className="asset-reg-skill-progress-head">
              <span><Sparkles size={16} /> 확산 패키지 생성</span>
              <h2>{skillGenerationPhase === 'selecting' ? 'Skill 후보를 선택하세요' : skillGenerationPhase === 'error' ? 'Skill 생성 실패' : 'Skill 자동 생성 진행중'}</h2>
              <p>{skillGenerationPhase === 'planning' ? '자산 명세서와 저장소 구조를 분석해 확산 가치가 높은 Skill 후보군을 추출하고 있습니다.' : skillGenerationPhase === 'selecting' ? '생성할 Skill을 직접 선택할 수 있습니다. 추천 후보는 기본 선택되어 있습니다.' : skillGenerationPhase === 'error' ? '아래 오류를 확인한 뒤 다시 시도하세요.' : '선택된 Skill과 CLAUDE.md를 순차적으로 생성하고 있습니다.'}</p>
            </header>

            {skillGenerationPhase === 'planning' && (
              <div className="asset-reg-plan-loading">
                <span className="asset-reg-spinner" />
                <div>
                  <b>Skill Generation Planning</b>
                  <p>후보군 추출, 확산 점수 계산, reference_files 선정 절차를 진행합니다.</p>
                </div>
              </div>
            )}

            {skillGenerationPhase === 'selecting' && (
              <>
                <div className="asset-reg-skill-plan-summary">
                  <b>Planning 결과</b>
                  <p>{assetSkillPlan?.asset_summary || '자산 요약 정보가 없습니다.'}</p>
                </div>
                <div className="asset-reg-skill-candidate-list">
                  {(assetSkillPlan?.candidates || []).map((candidate) => {
                    const checked = selectedSkillSlugs.includes(candidate.slug);
                    return (
                      <button className={`asset-reg-skill-candidate ${checked ? 'selected' : ''}`} type="button" key={candidate.slug} onClick={() => toggleGeneratedSkillCandidate(candidate.slug)}>
                        <span className="asset-reg-skill-check">{checked ? '✓' : ''}</span>
                        <div>
                          <div className="asset-reg-skill-candidate-top">
                            <strong>{candidate.title}</strong>
                            <em>{candidate.slug}</em>
                            {candidate.recommended && <small>Recommended</small>}
                          </div>
                          <p>{candidate.reusable_pattern}</p>
                          <div className="asset-reg-skill-score"><span>Diffusion Score</span><b>{candidate.diffusion_score}</b></div>
                          <blockquote>{candidate.reason}</blockquote>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <footer className="asset-reg-skill-progress-actions">
                  <button className="line-btn" type="button" onClick={() => { setIsSkillProgressOpen(false); setSkillGenerationStatus('idle'); setSkillGenerationPhase('idle'); setSkillGenerationError(''); }}>취소</button>
                  <button className="primary-btn" type="button" disabled={!selectedSkillSlugs.length} onClick={confirmGeneratedSkillSelection}>선택 완료</button>
                </footer>
              </>
            )}


            {skillGenerationPhase === 'error' && (
              <div className="asset-reg-skill-error">
                <b>생성 작업을 완료하지 못했습니다</b>
                <p>{skillGenerationError}</p>
                <button className="primary-btn" type="button" onClick={() => { setIsSkillProgressOpen(false); setSkillGenerationPhase('idle'); setSkillGenerationError(''); }}>확인</button>
              </div>
            )}
            {skillGenerationPhase === 'generating' && (
              <div className="asset-reg-generation-steps">
                {skillGenerationSteps.map((step, index) => (
                  <div className={`asset-reg-generation-step ${index < skillGenerationStepIndex ? 'done' : ''} ${index === skillGenerationStepIndex ? 'active' : ''}`} key={step.id}>
                    <span>{index < skillGenerationStepIndex ? '✓' : index + 1}</span>
                    <div>
                      <b>{step.label}</b>
                      <p>{index < skillGenerationStepIndex ? '생성 완료' : index === skillGenerationStepIndex ? 'AI가 파일을 분석하고 생성하고 있습니다. 작업에 다소 시간이 걸릴 수 있습니다.' : '대기 중'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      )}

      {assetRepoErrorMessage && (
        <div className="news-modal-backdrop" role="presentation" onMouseDown={() => setAssetRepoErrorMessage('')}>
          <article className="asset-reg-repo-error-modal" role="dialog" aria-modal="true" aria-label="Git 저장소 연결 실패" onMouseDown={(event) => event.stopPropagation()}>
            <div className="asset-reg-repo-error-icon">!</div>
            <span>Git 연결 실패</span>
            <h2>저장소를 연결하지 못했습니다</h2>
            <div className="asset-reg-repo-error-message">{assetRepoErrorMessage}</div>
            <button className="primary-btn" type="button" onClick={() => setAssetRepoErrorMessage('')}>확인</button>
          </article>
        </div>
      )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
