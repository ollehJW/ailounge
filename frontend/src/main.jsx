import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  Bot,
  Building2,
  ChevronDown,
  Code2,
  ExternalLink,
  FilePenLine,
  Home,
  KeyRound,
  LogIn,
  LogOut,
  Newspaper,
  NotebookPen,
  Pencil,
  ShieldCheck,
  Trash2,
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
    items: [
      { id: 'data-explore', label: '데이터 탐색' },
      { id: 'data-load', label: '데이터 적재 요청' },
    ],
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
    items: [
      { id: 'code-intro', label: '소개' },
      { id: 'code-workspace', label: '내 워크스페이스' },
      { id: 'code-team', label: '팀 노트북' },
      { id: 'code-openlab', label: '오픈랩' },
    ],
  },
  {
    id: 'ax-community',
    label: 'AX COMMUNITY',
    icon: Newspaper,
    defaultPage: 'tech-news',
    items: [
      { id: 'tech-news', label: 'Tech News' },
      { id: 'ai-blog', label: 'AI Blog' },
      { id: 'gen-ai-proposal', label: 'Gen AI Proposal' },
    ],
  },
];

const externalLinks = [
  { label: 'WIA Report', href: 'http://10.217.183.72:9602/', icon: FilePenLine },
  { label: 'WIA Meet', href: 'https://10.217.183.34:9702/', icon: NotebookPen },
];

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
  const [accountMessage, setAccountMessage] = useState('');
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${authToken}` }), [authToken]);
  const isAdminView = Boolean(authUser?.is_admin);

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
    setAccountMessage('');
    setAccountError('');
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setAccountError('');
    setAccountMessage('');
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
      setAccountMessage(editingUserId ? '계정을 수정했습니다.' : '계정을 추가했습니다.');
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
    setAccountMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${account.user_id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw await apiError(response, '계정을 삭제하지 못했습니다.');
      setAccountMessage('계정을 삭제했습니다.');
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
            <button className="side-item active" type="button" onClick={() => setActivePage('accounts')}>
              <ShieldCheck size={17} />
              <span className="side-name">계정 관리</span>
            </button>
          ) : (
            <>
              <button className={`side-item ${activePage === 'home' ? 'active' : ''}`} type="button" onClick={() => setActivePage('home')}>
                <Home size={17} />
                <span className="side-name">Home</span>
              </button>

              {navGroups.map((group) => {
                const Icon = group.icon;
                const isOpen = openGroups.has(group.id);
                const isActive = group.items.some((item) => item.id === activePage);

                return (
                  <div className="side-group" key={group.id}>
                    <button className={`side-item side-group-btn ${isActive ? 'active' : ''}`} type="button" aria-expanded={isOpen} onClick={() => toggleGroup(group)}>
                      <Icon size={17} />
                      {group.status ? (
                        <span className="side-label-wrap">
                          <span className="side-name">{group.label}</span>
                          <span className="side-status">{group.status}</span>
                        </span>
                      ) : (
                        <span className="side-name">{group.label}</span>
                      )}
                      <ChevronDown className={`chev ${isOpen ? 'open' : ''}`} size={14} />
                    </button>
                    {isOpen && (
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
        {isAdminView && (
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
                {accountMessage && <div className="form-message">{accountMessage}</div>}

                <div className="form-actions">
                  {editingUserId && <button className="line-btn" type="button" onClick={resetAccountForm}>취소</button>}
                  <button className="primary-btn" type="submit" disabled={isSavingAccount}>
                    {isSavingAccount ? <span className="btn-spinner" /> : <UserPlus size={16} />}
                    {editingUserId ? '수정 저장' : '계정 추가'}
                  </button>
                </div>
              </form>

              <section className="account-panel account-list-panel">
                <div className="account-panel-head">
                  <span>ACCOUNTS</span>
                  <h2>계정 리스트</h2>
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
                      ) : accounts.length === 0 ? (
                        <tr><td colSpan="6" className="table-empty">등록된 계정이 없습니다.</td></tr>
                      ) : accounts.map((account) => (
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
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
