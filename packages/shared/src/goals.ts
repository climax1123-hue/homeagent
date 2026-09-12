export type RecordVisibility = 'family' | 'private';
export type GoalStatus = 'active' | 'paused' | 'completed';

export type Goal = {
  id: string;
  householdId: string;
  ownerUserId: string;
  visibility: RecordVisibility;
  title: string;
  description: string;
  targetDate: string | null;
  status: GoalStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export type GoalInput = Pick<
  Goal,
  | 'householdId'
  | 'ownerUserId'
  | 'visibility'
  | 'title'
  | 'description'
  | 'targetDate'
  | 'status'
  | 'progress'
>;

export function validateGoal(input: GoalInput): string | null {
  if (!input.title.trim()) return '목표 제목을 입력해 주세요.';
  if (input.title.trim().length > 80) return '목표 제목은 80자 이내로 입력해 주세요.';
  if (input.description.length > 1000) return '설명은 1,000자 이내로 입력해 주세요.';
  if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100)
    return '진행률은 0부터 100 사이의 정수로 입력해 주세요.';
  if (input.status === 'completed' && input.progress !== 100)
    return '완료한 목표의 진행률은 100%여야 합니다.';
  return null;
}

export type Dday = {
  id: string;
  householdId: string;
  ownerUserId: string;
  visibility: RecordVisibility;
  title: string;
  targetDate: string;
  memo: string;
  repeatYearly: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DdayInput = Pick<
  Dday,
  'householdId' | 'ownerUserId' | 'visibility' | 'title' | 'targetDate' | 'memo' | 'repeatYearly'
>;

export function validateDday(input: DdayInput): string | null {
  if (!input.title.trim()) return '디데이 제목을 입력해 주세요.';
  if (input.title.trim().length > 80) return '디데이 제목은 80자 이내로 입력해 주세요.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) return '기준일을 입력해 주세요.';
  if (input.memo.length > 500) return '메모는 500자 이내로 입력해 주세요.';
  return null;
}
