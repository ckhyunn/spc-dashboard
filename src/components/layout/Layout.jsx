import { useState } from 'react'
import './Layout.css'

const NAV_ITEMS = [
  { id: 'dashboard',  icon: '◈', label: '대시보드' },
  { id: 'capability', icon: '◎', label: '공정능력분석' },
  { id: 'spc',        icon: '∿', label: '계량형 관리도' },
  { id: 'attribute',  icon: '⊡', label: '계수형 관리도' },
  { id: 'data',       icon: '⊞', label: '데이터 입력' },
]

const STATUS_CONFIG = {
  good:    { label: '관리상태',   cls: 'badge--green' },
  warning: { label: '주의 필요',  cls: 'badge--amber' },
  bad:     { label: '비관리상태', cls: 'badge--red' },
  unknown: { label: '분석 전',    cls: 'badge--cyan' },
}

const DOT_CLS = { good: 'dot--green', warning: 'dot--amber', bad: 'dot--red', unknown: 'dot--muted' }

export default function Layout({
  children, activePage, onNavigate, processStatus,
  processes = [], processStatuses = [], currentProcId,
  onSelectProcess, onRenameProcess,
  currentSpec, onSpecChange, appData,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal]     = useState('')

  const s = STATUS_CONFIG[processStatus] || STATUS_CONFIG.unknown

  const flatData  = appData?.flatData || []
  const sampleCount = flatData.length
  const xBar = sampleCount > 0 ? (flatData.reduce((a,v)=>a+v,0)/sampleCount).toFixed(3) : '—'
  const sStd = sampleCount > 1
    ? Math.sqrt(flatData.reduce((a,v,_,arr)=>{const m=arr.reduce((s,x)=>s+x,0)/arr.length;return a+(v-m)**2},0)/(sampleCount-1)).toFixed(4)
    : '—'

  const startEdit = (p, e) => {
    e.stopPropagation()
    setEditingId(p.id)
    setEditVal(p.name)
  }
  const commitEdit = (id) => {
    if (editVal.trim()) onRenameProcess?.(id, editVal.trim())
    setEditingId(null)
  }

  return (
    <div className="shell">
      {/* ── Topbar ── */}
      <div className="topbar">
        <button className="collapse-btn" onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '☰' : '✕'}
        </button>
        <div className="topbar-logo">⚙</div>
        <span className="topbar-title">공정관리</span>
        <span className={`badge ${s.cls}`} style={{fontSize:'12px', padding:'3px 10px'}}>
          {s.label}
        </span>
        <div className="topbar-right">
          <button className="btn btn-ghost" style={{fontSize:'12px'}} onClick={() => onNavigate('data')}>
            ⊞ 데이터 입력
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {NAV_ITEMS.map(item => (
          <div
            key={item.id}
            className={`tab ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="tab-icon">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>

      <div className="body">
        {/* ── Sidebar ── */}
        <div className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
          {!collapsed && (
            <>
              {/* 공정 목록 */}
              <div className="sl">공정 목록</div>
              {processes.map((p, i) => (
                <div
                  key={p.id}
                  className={`si ${p.id === currentProcId ? 'active' : ''}`}
                  onClick={() => onSelectProcess?.(p.id)}
                >
                  <span className={`dot ${DOT_CLS[processStatuses[i]] || 'dot--muted'}`} />
                  {editingId === p.id ? (
                    <input
                      className="proc-name-input"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => commitEdit(p.id)}
                      onKeyDown={e => { if(e.key==='Enter') commitEdit(p.id); if(e.key==='Escape') setEditingId(null) }}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="proc-name" onDoubleClick={e => startEdit(p, e)}>{p.name}</span>
                  )}
                </div>
              ))}
              <div className="edit-hint">✏ 이름 더블클릭으로 편집</div>

              {/* 규격 설정 */}
              <div className="sl">규격 설정</div>
              <div className="spec-box">
                {[
                  { key: 'USL', label: 'USL' },
                  { key: 'LSL', label: 'LSL' },
                  { key: 'target', label: '목표값' },
                ].map(({ key, label }) => (
                  <div className="spec-row" key={key}>
                    <span>{label}</span>
                    <input
                      className="spec-inp"
                      type="number"
                      step="0.1"
                      value={currentSpec?.[key] ?? ''}
                      onChange={e => onSpecChange?.({ ...currentSpec, [key]: parseFloat(e.target.value) })}
                    />
                  </div>
                ))}
              </div>

              {/* 데이터 현황 */}
              <div className="sl">데이터 현황</div>
              <div className="side-info">
                <div>샘플 수 <strong>{sampleCount}</strong></div>
                <div>평균 X̄ <strong>{xBar}</strong></div>
                <div>표준편차 σ <strong>{sStd}</strong></div>
              </div>
            </>
          )}
        </div>

        {/* ── Content ── */}
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  )
}
