import { KeyRound, LogIn, UserRound } from 'lucide-react';

export default function LoginPage({
  isCheckingSession,
  loginId,
  password,
  error,
  isSubmitting,
  onLoginIdChange,
  onPasswordChange,
  onSubmit,
}) {
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
        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-card-head">
            <span>SECURE ACCESS</span>
            <h1>AI Lounge 로그인</h1>
            <p>사번과 비밀번호로 접속하세요.</p>
          </div>
          {error && <div className="login-error">{error}</div>}
          <label className="login-field">
            <span><UserRound size={14} /> 사번</span>
            <input autoComplete="username" value={loginId} onChange={(event) => onLoginIdChange(event.target.value)} placeholder="사번" required />
          </label>
          <label className="login-field">
            <span><KeyRound size={14} /> 비밀번호</span>
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="password" required />
          </label>
          <button className="login-submit primary-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <span className="btn-spinner" /> : <LogIn size={16} />}
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}
