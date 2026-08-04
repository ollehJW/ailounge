import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  Bot,
  Bold,
  Building2,
  ChevronDown,
  Clock3,
  Code2,
  ExternalLink,
  Eye,
  FilePenLine,
  Home,
  Heart,
  Plus,
  Search,
  Sparkles,
  Wand2,
  KeyRound,
  LogIn,
  LogOut,
  Newspaper,
  NotebookPen,
  Send,
  Pencil,
  ShieldCheck,
  Trash2,
  Underline,
  UserPlus,
  UserRound,
} from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const emptyAccountForm = {
  login_id: '',
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
  { label: 'WIA Meet', href: 'https://10.217.183.34:9702/', icon: NotebookPen },
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
  '심사중': 'reviewing',
  '선정': 'selected',
  '미선정': 'rejected',
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
const ideaAttachmentName = (attachment) => (typeof attachment === 'string' ? attachment : attachment.original_name);
const aiUsageAuthor = (post) => [post?.author_org, post?.author_name, post?.author_job_title].filter(Boolean).join(' ') || 'AI Lounge';
const withApiAssetUrls = (html = '') => html.replace(/src="\/api\//g, `src="${API_BASE}/api/`);

const previewText = (html, limit = 50) => {
  const text = stripHtml(html);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}....`;
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
  const [aiUsagePosts, setAiUsagePosts] = useState([]);
  const [aiIdeas, setAiIdeas] = useState([]);
  const [selectedAiIdea, setSelectedAiIdea] = useState(null);
  const [ideaToDelete, setIdeaToDelete] = useState(null);
  const [aiIdeaForm, setAiIdeaForm] = useState(emptyAiIdeaForm);
  const [aiIdeaMessage, setAiIdeaMessage] = useState('');
  const [isAiIdeaSuccessOpen, setIsAiIdeaSuccessOpen] = useState(false);
  const [aiIdeaError, setAiIdeaError] = useState('');
  const [isLoadingAiIdeas, setIsLoadingAiIdeas] = useState(false);
  const [isSubmittingAiIdea, setIsSubmittingAiIdea] = useState(false);
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
  const [selectedAiUsagePostId, setSelectedAiUsagePostId] = useState('');
  const [selectedAiUsagePost, setSelectedAiUsagePost] = useState(null);
  const [aiUsageEditorFormat, setAiUsageEditorFormat] = useState({ bold: false, underline: false, color: '#243047' });
  const [isAiUsageColorOpen, setIsAiUsageColorOpen] = useState(false);
  const aiUsageEditorRef = useRef(null);
  const aiUsageSelectionRef = useRef(null);
  const aiIdeaFileInputRef = useRef(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${authToken}` }), [authToken]);
  const isAdminView = Boolean(authUser?.is_admin);
  const adminPage = activePage === 'tech-news-write' ? 'tech-news-write' : 'accounts';
  const orgFilterOptions = useMemo(() => Array.from(new Set(accounts.map((account) => account.org_name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')), [accounts]);
  const filteredAccounts = useMemo(() => (orgFilter === 'all' ? accounts : accounts.filter((account) => account.org_name === orgFilter)), [accounts, orgFilter]);
  const hotAiUsagePosts = useMemo(() => [...aiUsagePosts].sort((a, b) => b.like_count - a.like_count || b.created_at.localeCompare(a.created_at)).slice(0, 3), [aiUsagePosts]);
  const hottestAiUsagePost = hotAiUsagePosts[hotAiUsageIndex] || hotAiUsagePosts[0] || null;
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
              <button className={`side-item ${adminPage === 'tech-news-write' ? 'active' : ''}`} type="button" onClick={() => { setAccountError(''); setActivePage('tech-news-write'); }}>
                <Newspaper size={17} />
                <span className="side-name">Tech News 작성하기</span>
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
            <b>{authUser.displayed_name}</b>
            <span><Building2 size={11} /> {authUser.org_name} · {authUser.job_title}</span>
          </div>
          <button className="side-logout" type="button" aria-label="로그아웃" onClick={handleLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main" aria-label="콘텐츠 영역">
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
                <p>작성한 제안은 DX추진랩에 전달되고, 업무 영향도와 AI 적용 가능성을 검토한 뒤 결과 상태가 업데이트됩니다.</p>
              </div>
              <div className="ai-idea-guide-steps">
                <div className="ai-idea-guide-step">
                  <b>01</b>
                  <strong>접수완료</strong>
                  <span>제안 내용과 첨부자료가 DX추진랩 검토 목록에 등록됩니다.</span>
                </div>
                <div className="ai-idea-guide-step">
                  <b>02</b>
                  <strong>심사중</strong>
                  <span>문제 명확성, 데이터 확보 가능성, 기대 효과를 기준으로 검토합니다.</span>
                </div>
                <div className="ai-idea-guide-step selected">
                  <b>03A</b>
                  <strong>선정</strong>
                  <span>PoC 또는 과제화를 위해 담당자와 후속 논의를 진행합니다.</span>
                </div>
                <div className="ai-idea-guide-step rejected">
                  <b>03B</b>
                  <strong>미선정</strong>
                  <span>현재 추진은 어렵지만, 보완 의견을 바탕으로 재제안할 수 있습니다.</span>
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
                  <Send size={18} />
                </div>

                <label className="form-field">
                  <span>제목</span>
                  <input value={aiIdeaForm.title} onChange={(event) => updateAiIdeaField('title', event.target.value)} placeholder="예: 설비 알람 원인 자동 분류" required />
                </label>

                <label className="form-field">
                  <span>문제 정의</span>
                  <textarea value={aiIdeaForm.problem_definition} onChange={(event) => updateAiIdeaField('problem_definition', event.target.value)} placeholder="현재 업무에서 어떤 문제가 반복되는지 작성해 주세요." rows="4" required />
                </label>

                <label className="form-field">
                  <span>제안 내용</span>
                  <textarea value={aiIdeaForm.proposal} onChange={(event) => updateAiIdeaField('proposal', event.target.value)} placeholder="AI를 어떻게 적용하면 좋을지 구체적으로 작성해 주세요." rows="5" required />
                </label>

                <label className="form-field">
                  <span>예상 효과</span>
                  <textarea value={aiIdeaForm.effect} onChange={(event) => updateAiIdeaField('effect', event.target.value)} placeholder="시간 절감, 오류 감소, 표준화 등 기대 효과를 작성해 주세요." rows="3" required />
                </label>

                <div className="form-field">
                  <span>참고자료</span>
                  <input
                    ref={aiIdeaFileInputRef}
                    className="ai-idea-file-input"
                    type="file"
                    multiple
                    onChange={(event) => { updateAiIdeaFiles(event.target.files); event.target.value = ''; }}
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

        {isAdminView && adminPage === 'accounts' && (
          <section className="content account-page">
            <div className="account-head">
              <div>
                <span>ADMIN</span>
                <h1>계정 관리</h1>
                <p>AI Lounge 접속 계정을 추가하고 권한과 기본 정보를 관리합니다.</p>
              </div>
              <button className="line-btn" type="button" onClick={loadAccounts} disabled={isLoadingAccounts}>새로고침</button>
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
                        <th>조직</th>
                        <th>직책</th>
                        <th>권한</th>
                        <th>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingAccounts ? (
                        <tr><td colSpan="6" className="table-empty">계정 목록을 불러오는 중입니다.</td></tr>
                      ) : filteredAccounts.length === 0 ? (
                        <tr><td colSpan="6" className="table-empty">조건에 맞는 계정이 없습니다.</td></tr>
                      ) : filteredAccounts.map((account) => (
                        <tr key={account.user_id}>
                          <td>{account.login_id}</td>
                          <td>{account.displayed_name}</td>
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
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
