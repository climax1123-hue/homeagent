import type { LedgerCommonCode } from '@home/shared';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAccess, useAuth } from '../auth/auth';
import '../ledger/ledger.css';

const text = (input: unknown) => String(input ?? '');

export function CommonCodesPage() {
  const { client, user } = useAuth();
  const { access } = useAccess();
  const active = access?.kind === 'active' && access.role === 'admin' ? access : null;
  const [codes, setCodes] = useState<LedgerCommonCode[]>([]);
  const [group, setGroup] = useState('payment_method_type');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const householdId = active?.householdId;
  const load = useCallback(async () => {
    if (!householdId) return;
    const { data, error: reason } = await client.from('common_codes').select('*').eq('household_id', householdId).order('group_key').order('sort_order');
    if (reason) throw new Error('공통코드를 불러오지 못했습니다.');
    setCodes((data ?? []).map((row) => ({ id:text(row.id), householdId:text(row.household_id), groupKey:text(row.group_key), groupLabel:text(row.group_label), code:text(row.code), label:text(row.label), sortOrder:Number(row.sort_order), isSystem:Boolean(row.is_system), isAdminEditable:Boolean(row.is_admin_editable), isActive:Boolean(row.is_active) })));
  }, [client, householdId]);
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : '오류가 발생했습니다.')); }, [load]);
  const groups = useMemo(() => Array.from(new Map(codes.map((item) => [item.groupKey, item.groupLabel ?? item.groupKey])).entries()), [codes]);
  const selected = codes.filter((item) => item.groupKey === group);
  const editable = selected.some((item) => item.isAdminEditable);
  if (!active || !user) return null;
  const add = async (event: FormEvent) => { event.preventDefault(); const { error: reason } = await client.from('common_codes').insert({ household_id:active.householdId, group_key:group, group_label:selected[0]?.groupLabel ?? group, code, label:label.trim(), sort_order:(selected.at(-1)?.sortOrder ?? 0)+10, is_system:false, is_admin_editable:true, created_by:user.id }); if(reason){setError('코드를 추가하지 못했습니다. 코드값 중복 여부를 확인해 주세요.');return;} setCode('');setLabel('');await load(); };
  const toggle = async (item: LedgerCommonCode) => { const { error: reason } = await client.from('common_codes').update({is_active:!item.isActive}).eq('id',item.id); if(reason){setError('보호된 코드는 변경할 수 없습니다.');return;} await load(); };
  return <section className="ledger-page"><header className="ledger-header"><div><p className="ledger-eyebrow">관리자 설정</p><h1>공통코드 관리</h1></div></header>{error&&<p className="ledger-error" role="alert">{error}</p>}<section className="ledger-form ledger-settings common-code-page"><label>코드 그룹<select value={group} onChange={(event)=>setGroup(event.target.value)}>{groups.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><p className="ledger-help">업무 화면의 선택값을 한곳에서 확인합니다. 권한·상태·계산 규칙 코드는 안전을 위해 잠겨 있습니다.</p>{editable&&<form className="ledger-inline-form" onSubmit={add}><input aria-label="코드값" required pattern="[a-z][a-z0-9_]{1,39}" placeholder="prepaid" value={code} onChange={(event)=>setCode(event.target.value)}/><input aria-label="코드명" required placeholder="선불카드" value={label} onChange={(event)=>setLabel(event.target.value)}/><button className="primary">추가</button></form>}<ul className="ledger-settings-list">{selected.map((item)=><li key={item.id}><span><b>{item.label}</b><small>{item.code} · {item.isAdminEditable?'관리자 편집 가능':'시스템 보호'}</small></span>{item.isAdminEditable&&<button onClick={()=>toggle(item)}>{item.isActive?'비활성화':'활성화'}</button>}</li>)}</ul></section></section>;
}
