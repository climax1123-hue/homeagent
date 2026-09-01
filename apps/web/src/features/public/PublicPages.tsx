import { Link } from 'react-router-dom';
import './public-pages.css';

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="public-page">
      <header className="public-header">
        <Link className="public-brand" to="/">
          우리집
        </Link>
        <nav aria-label="공개 페이지 메뉴">
          <Link to="/privacy">개인정보처리방침</Link>
          <Link className="public-login-link" to="/login">
            로그인
          </Link>
        </nav>
      </header>
      {children}
    </main>
  );
}

export function PublicHomePage() {
  return (
    <PublicLayout>
      <section className="public-hero">
        <p className="public-eyebrow">FAMILY HOME OS</p>
        <h1>가족의 일상과 살림을 한곳에서 관리합니다.</h1>
        <p>
          우리집은 승인된 가족 구성원이 일정과 가계부를 안전하게 공유하는 가족용 웹
          서비스입니다. Google Calendar 연결은 사용자가 선택한 일정을 본인의 캘린더에
          동기화할 때만 사용합니다.
        </p>
        <Link className="public-primary-action" to="/login">
          우리집 시작하기
        </Link>
      </section>
      <section className="public-features" aria-label="주요 기능">
        <article>
          <h2>가족 일정</h2>
          <p>가족·개인 일정을 구분하고 반복 일정과 알림을 관리합니다.</p>
        </article>
        <article>
          <h2>Google Calendar</h2>
          <p>내가 만든 일정을 내 Google Calendar로 안전하게 내보냅니다.</p>
        </article>
        <article>
          <h2>가족 가계부</h2>
          <p>가족·개인 장부, 거래 명세 가져오기와 지출 분석을 지원합니다.</p>
        </article>
      </section>
    </PublicLayout>
  );
}

export function PrivacyPage() {
  return (
    <PublicLayout>
      <article className="privacy-content">
        <p className="public-eyebrow">PRIVACY</p>
        <h1>개인정보처리방침</h1>
        <p className="privacy-updated">시행일: 2026년 9월 1일</p>

        <h2>수집하는 정보</h2>
        <p>
          서비스는 계정 관리에 이메일 주소를 사용하며, 가족 일정과 가계부 등 사용자가 직접
          입력한 데이터를 저장합니다. Google Calendar를 연결하면 Google 계정 이메일과 연결
          토큰을 처리합니다.
        </p>

        <h2>Google 사용자 데이터의 이용</h2>
        <p>
          Google Calendar 권한은 사용자가 우리집에서 만든 일정을 본인이 소유한 Google
          Calendar에 생성·수정·삭제하는 기능에만 사용합니다. Google 사용자 데이터를 광고,
          판매 또는 제3자의 AI 모델 학습에 사용하지 않습니다.
        </p>

        <h2>저장과 보호</h2>
        <p>
          업무 데이터는 가족 공간별로 분리하며 데이터베이스 접근 정책을 적용합니다. Google
          OAuth 갱신 토큰은 서버에서 암호화하여 저장하고 브라우저에 노출하지 않습니다.
        </p>

        <h2>공유와 보유</h2>
        <p>
          개인정보를 외부에 판매하지 않습니다. 서비스 제공에 필요한 Google과 Supabase,
          Vercel의 인프라를 제외하고 사용자 데이터를 임의로 공유하지 않습니다. 사용자가
          Google Calendar 연결을 해제하면 저장된 연결 정보와 토큰을 삭제합니다.
        </p>

        <h2>문의</h2>
        <p>
          개인정보 및 Google Calendar 연동 관련 문의는{' '}
          <a href="mailto:climax1123@gmail.com">climax1123@gmail.com</a>으로 연락할 수 있습니다.
        </p>
      </article>
    </PublicLayout>
  );
}
