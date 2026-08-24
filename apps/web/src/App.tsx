import { Button } from '@home/design-system';
import { PRODUCT_NAME } from '@home/shared';

export function App() {
  return (
    <main className="app-shell">
      <section className="welcome">
        <p className="eyebrow">HOME OS</p>
        <h1>{PRODUCT_NAME}</h1>
        <p>일정, 가계부, 디데이와 목표를 한곳에서 관리합니다.</p>
        <Button>프로젝트 준비 완료</Button>
      </section>
    </main>
  );
}
