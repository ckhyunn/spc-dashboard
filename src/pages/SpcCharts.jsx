import { useState, useMemo, useRef, useEffect } from 'react'
import {
  calcXbarR, calcXbarS, calcIMR,
  applyNelsonRules, getViolatedIndices,
} from '../utils/spcCalc'
import './SpcCharts.css'

// ── 강의록 09 기준 Nelson Rules 8가지 ──────────────────────
const NELSON_RULES_META = [
  { n:1, color:'#DC2626', short:'관리이탈',   crit:'1점이 ±3σ(UCL/LCL) 초과',         meaning:'이상원인에 의한 급격한 변동',          severity:'high' },
  { n:2, color:'#8B5CF6', short:'중심선편중', crit:'연속 9점이 중심선 한쪽에 집중',    meaning:'공정 평균의 이동 또는 편향',           severity:'mid'  },
  { n:3, color:'#D97706', short:'단조추세',   crit:'연속 6점이 단조 증가 또는 감소',   meaning:'공정 평균의 점진적 드리프트',          severity:'mid'  },
  { n:4, color:'#059669', short:'교대패턴',   crit:'연속 14점이 교대로 증감 반복',      meaning:'주기적 패턴 (설비·재료 교대 등)',      severity:'mid'  },
  { n:5, color:'#0891B2', short:'±2σ이탈',   crit:'3점 중 2점이 ±2σ 초과 (같은 방향)','meaning':'공정 분산 급격 증가',                severity:'mid'  },
  { n:6, color:'#7C3AED', short:'±1σ이탈',   crit:'5점 중 4점이 ±1σ 초과 (같은 방향)','meaning':'공정 평균 서서히 이동',              severity:'low'  },
  { n:7, color:'#D97706', short:'과도안정',   crit:'연속 15점이 모두 ±1σ 이내',        meaning:'데이터 조작 의심 또는 측정 오류',      severity:'low'  },
  { n:8, color:'#6366F1', short:'±1σ외부',   crit:'연속 8점이 모두 ±1σ 바깥 (양쪽)',  meaning:'두 분포 혼재 또는 공정 분리',          severity:'low'  },
]
const RULE_COLOR = Object.fromEntries(NELSON_RULES_META.map(r => [r.n, r.color]))
const SEV_LABEL  = { high:'높음', mid:'보통', low:'낮음' }
const SEV_BADGE  = { high:'badge--red', mid:'badge--amber', low:'badge--cyan' }

const CHART_TYPES = [
  { id:'Xbar-R', label:'X̄-R 관리도',  sub:'부분군 크기 2~9',  icon:'∿' },
  { id:'Xbar-S', label:'X̄-S 관리도',  sub:'부분군 크기 10+', icon:'∿' },
  { id:'I-MR',   label:'I-MR 관리도', sub:'부분군 크기 1',   icon:'∿' },
]

export default function SpcCharts({ appData }) {
  const { subgroups = [] } = appData || {}
  const [chartType, setChartType] = useState('Xbar-R')
  const [movWindow, setMovWindow] = useState(2)
  const [removedGroups, setRemovedGroups] = useState([])
  const [phase, setPhase]               = useState(1)
  const [redrawHistory, setRedrawHistory] = useState([])

  const activeSubgroups = useMemo(() => {
    if (phase === 1 || !removedGroups.length) return subgroups
    return subgroups.filter((_, i) => !removedGroups.includes(i))
  }, [subgroups, removedGroups, phase])

  const chartData = useMemo(() => {
    if (!activeSubgroups.length) return null
    if (chartType === 'Xbar-R') return calcXbarR(activeSubgroups)
    if (chartType === 'Xbar-S') return calcXbarS(activeSubgroups)
    if (chartType === 'I-MR')   return calcIMR(activeSubgroups.map(sg => sg[0]), movWindow)
    return null
  }, [activeSubgroups, chartType, movWindow])

  const charts = chartData ? Object.values(chartData).filter(v => v?.points) : []
  const chart1 = charts[0] || null
  const chart2 = charts[1] || null
  const chartLabel1 = chartType === 'I-MR' ? 'I'  : 'X̄'
  const chartLabel2 = chartType === 'Xbar-S' ? 'S' : chartType === 'I-MR' ? 'MR' : 'R'

  const violations1 = useMemo(() =>
    chart1 ? applyNelsonRules(chart1.points, chart1.CL, chart1.UCL, chart1.LCL) : []
  , [chart1])
  const violations2 = useMemo(() =>
    chart2 ? applyNelsonRules(chart2.points, chart2.CL, chart2.UCL, chart2.LCL) : []
  , [chart2])

  const allViolations  = [...violations1, ...violations2]
  const violatedSet1   = getViolatedIndices(violations1)
  const violatedSet2   = getViolatedIndices(violations2)
  const isControlled   = allViolations.length === 0

  const handleRedraw = () => {
    const toRemove = new Set([...violatedSet1, ...violatedSet2])
    const newRemoved = [...new Set([...removedGroups, ...toRemove])]
    setRemovedGroups(newRemoved)
    setPhase(2)
    setRedrawHistory(prev => [...prev, {
      step: prev.length + 1,
      removedLots: [...toRemove].map(i => i + 1),
      ucl: chart1?.UCL?.toFixed(4),
      cl:  chart1?.CL?.toFixed(4),
      violsBefore: allViolations.length,
    }])
  }
  const handleReset = () => {
    setRemovedGroups([]); setPhase(1); setRedrawHistory([])
  }

  // 위반 Lot 상세
  const violationDetails = useMemo(() => {
    const map = new Map()
    ;[...violations1, ...violations2].forEach(v => {
      v.points.forEach(idx => {
        if (!map.has(idx)) map.set(idx, new Set())
        map.get(idx).add(v.ruleNo)
      })
    })
    return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([idx, ruleSet]) => {
      const rules = [...ruleSet].sort((a,b)=>a-b)
      const worstSev = rules.reduce((w,r) => {
        const s = NELSON_RULES_META[r-1]?.severity || 'low'
        return w==='high'||s==='high' ? 'high' : w==='mid'||s==='mid' ? 'mid' : 'low'
      }, 'low')
      return { idx, lotNum:idx+1, xVal:chart1?.points[idx], rules, worstSev }
    })
  }, [violations1, violations2, chart1])

  if (!subgroups.length) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">∿</div>
        <h3>데이터를 먼저 입력해주세요</h3>
        <p>데이터 입력 탭에서 측정값을 입력하면 계량형 관리도가 생성됩니다.</p>
      </div>
    )
  }

  return (
    <div className="spc-page animate-slide-up">

      {/* ── 헤더 ── */}
      <div className="page-header">
        <div>
          <p className="section-label">Step 04</p>
          <h2 className="page-title">계량형 관리도 (SPC)</h2>
          <p className="page-desc">
            Xbar-R · Xbar-S · I-MR &nbsp;|&nbsp; Nelson Rules 8가지 자동 적용
            {phase === 2 && ` | Phase 2: ${removedGroups.length}개 부분군 제거됨`}
          </p>
        </div>
        <span className={`badge ${isControlled ? 'badge--green' : 'badge--red'}`}>
          <span className={`status-dot status-dot--${isControlled?'green':'red'} ${!isControlled?'status-dot--pulse':''}`}/>
          {isControlled ? '관리상태' : `Nelson 위반 ${allViolations.length}건 탐지`}
        </span>
      </div>

      {/* ── 관리도 유형 선택 ── */}
      <div className="chart-type-selector">
        {CHART_TYPES.map(ct => (
          <button key={ct.id}
            className={`chart-type-btn ${chartType===ct.id?'active':''}`}
            onClick={() => { setChartType(ct.id); handleReset() }}>
            <span className="chart-type-icon">{ct.icon}</span>
            <div>
              <div className="chart-type-label">{ct.label}</div>
              <div className="chart-type-sub">{ct.sub}</div>
            </div>
          </button>
        ))}
        {chartType === 'I-MR' && (
          <div className="form-group">
            <label className="label">이동범위 윈도우(w)</label>
            <select className="input input-mono" style={{width:'80px'}} value={movWindow}
              onChange={e => setMovWindow(parseInt(e.target.value))}>
              {[2,3,4,5].map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Nelson 위반 배너 ── */}
      {allViolations.length > 0 && (
        <div className="card violations-card animate-fade-in">
          <div className="violations-header">
            <span className="section-heading">
              <span style={{color:'var(--red)'}}>⚠</span>
              Nelson Rules 이상 탐지 — {allViolations.length}건
            </span>
            <div style={{display:'flex', gap:'8px'}}>
              <button className="btn btn-danger" onClick={handleRedraw}>
                ✂ 이상점 제거 후 재작성
              </button>
              {phase === 2 && <button className="btn btn-ghost" onClick={handleReset}>↩ 초기화</button>}
            </div>
          </div>
          <div className="violations-list">
            {allViolations.map((v, i) => {
              const meta = NELSON_RULES_META[v.ruleNo - 1]
              return (
                <div key={i} className="violation-item">
                  <span className="violation-rule"
                    style={{background: meta.color+'20', color: meta.color}}>
                    Rule {v.ruleNo} — {meta.short}
                  </span>
                  <span className="violation-desc">{meta.crit}</span>
                  <span className="violation-pts">해당 점: Lot {v.points.map(p=>p+1).join(', ')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── X̄ / I 관리도 ── */}
      {chart1 && (
        <div className="card chart-card-full">
          <div className="card-title-row">
            <span className="section-heading">
              <span className="icon-badge">∿</span>
              {chartLabel1} 관리도 &nbsp;
              <span className="badge badge--brown" style={{fontSize:'10px'}}>{chartType}</span>
            </span>
            <div className="chart-stats-pills">
              <span className="badge badge--brown">CL = {chart1.CL.toFixed(4)}</span>
              <span className="badge badge--red">UCL = {chart1.UCL.toFixed(4)}</span>
              <span className="badge badge--red">LCL = {Math.max(0,chart1.LCL).toFixed(4)}</span>
            </div>
          </div>
          <ControlChart
            points={chart1.points} CL={chart1.CL} UCL={chart1.UCL} LCL={chart1.LCL}
            violations={violations1} violatedSet={violatedSet1}
            label={chartLabel1} color="#8B6F47" />
        </div>
      )}

      {/* ── R / S / MR 관리도 ── */}
      {chart2 && (
        <div className="card chart-card-full">
          <div className="card-title-row">
            <span className="section-heading">
              <span className="icon-badge">∿</span>
              {chartLabel2} 관리도
            </span>
            <div className="chart-stats-pills">
              <span className="badge badge--brown">CL = {chart2.CL.toFixed(4)}</span>
              <span className="badge badge--red">UCL = {chart2.UCL.toFixed(4)}</span>
              <span className="badge badge--red">LCL = {Math.max(0,chart2.LCL).toFixed(4)}</span>
            </div>
          </div>
          <ControlChart
            points={chart2.points} CL={chart2.CL} UCL={chart2.UCL} LCL={chart2.LCL}
            violations={violations2} violatedSet={violatedSet2}
            label={chartLabel2} color="#7C3AED" />
        </div>
      )}

      {/* ── Nelson Rules 판정표 (강의록 09 기준) ── */}
      <div className="card">
        <div className="card-title-row">
          <span className="section-heading">
            <span className="icon-badge">▣</span>
            Nelson Rules 판정 기준 (8가지) — 강의록 09
          </span>
        </div>
        <div className="nelson-grid">
          {NELSON_RULES_META.map(r => {
            const active = violations1.some(v=>v.ruleNo===r.n) || violations2.some(v=>v.ruleNo===r.n)
            return (
              <div key={r.n} className={`nelson-item ${active ? 'violated' : ''}`}>
                <div className="nelson-num"
                  style={{background: r.color+'22', color: r.color}}>
                  {r.n}
                </div>
                <div className="nelson-desc">
                  <div style={{fontWeight:700, marginBottom:'2px', fontSize:'11px'}}>
                    Rule {r.n} — {r.short}
                  </div>
                  <div style={{fontSize:'10px', lineHeight:'1.4'}}>{r.crit}</div>
                  {active && (
                    <span className="badge badge--red" style={{fontSize:'9px', marginTop:'4px'}}>
                      ⚠ 감지됨
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 위반 Lot 상세 목록 ── */}
      <div className="card">
        <div className="card-title-row">
          <span className="section-heading">
            <span className="icon-badge">▣</span> 위반 Lot 상세 목록
          </span>
          <span className={`badge ${violationDetails.length>0?'badge--red':'badge--green'}`}>
            {violationDetails.length>0 ? `위반 Lot ${violationDetails.length}건` : '모든 Lot 정상'}
          </span>
        </div>
        {violationDetails.length === 0 ? (
          <p style={{textAlign:'center', color:'var(--text-muted)', fontSize:'13px', padding:'24px 0'}}>
            ✓ 모든 Lot이 Nelson Rules를 통과하였습니다.
          </p>
        ) : (
          <div style={{overflowX:'auto', maxHeight:'320px', overflowY:'auto'}}>
            <table className="data-table" style={{minWidth:'580px'}}>
              <thead>
                <tr>
                  <th>Lot</th><th>X̄ 값</th><th>위반 규칙</th><th>심각도</th><th>의미</th>
                </tr>
              </thead>
              <tbody>
                {violationDetails.map(row => (
                  <tr key={row.idx}>
                    <td style={{fontWeight:700}}>Lot {row.lotNum}</td>
                    <td className="mono">{row.xVal?.toFixed(4) ?? '—'}</td>
                    <td>
                      {row.rules.map(rn => {
                        const meta = NELSON_RULES_META[rn-1]
                        return (
                          <span key={rn} className="badge" style={{
                            background: meta.color+'18', color: meta.color,
                            marginRight:'4px', fontSize:'10px', border:`1px solid ${meta.color}40`
                          }}>
                            Rule {rn} — {meta.short}
                          </span>
                        )
                      })}
                    </td>
                    <td>
                      <span className={`badge ${SEV_BADGE[row.worstSev]}`}>
                        {SEV_LABEL[row.worstSev]}
                      </span>
                    </td>
                    <td style={{fontSize:'11px', color:'var(--text-secondary)', lineHeight:'1.5'}}>
                      {row.rules.map(rn => NELSON_RULES_META[rn-1]?.meaning).join(' / ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 관리도 재작성 이력 ── */}
      {redrawHistory.length > 0 && (
        <div className="card">
          <div className="card-title-row">
            <span className="section-heading">
              <span className="icon-badge">↺</span> 관리도 재작성 이력
            </span>
            <span className="badge badge--cyan">{redrawHistory.length}단계</span>
          </div>
          <div style={{fontSize:'12px', color:'var(--text-secondary)', marginBottom:'12px',
            padding:'10px 12px', background:'var(--bg-elevated)', borderRadius:'8px'}}>
            강의록 절차: <strong>① 이탈점 발견 → ② 이상원인 제거 → ③ 관리도 재작성 → ④ 반복</strong>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
            {redrawHistory.map((h,i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:'10px',
                padding:'9px 12px', background:'var(--bg-elevated)', borderRadius:'8px',
                border:'1px solid var(--border-subtle)', flexWrap:'wrap'}}>
                <span className="badge badge--brown">{h.step}단계</span>
                <span style={{fontSize:'11px', color:'var(--text-secondary)'}}>
                  UCL: <strong className="mono">{h.ucl}</strong>
                </span>
                <span style={{fontSize:'11px', color:'var(--text-secondary)'}}>
                  CL: <strong className="mono">{h.cl}</strong>
                </span>
                <span style={{fontSize:'11px', color:'var(--red)'}}>
                  제거 전 이상: <strong>{h.violsBefore}건</strong>
                </span>
                <span style={{fontSize:'11px', color:'var(--text-muted)'}}>
                  제거 Lot: {h.removedLots.map(l=>`Lot ${l}`).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 관리도 통계량 ── */}
      {chart1 && (
        <div className="card">
          <div className="card-title-row" style={{marginBottom:'16px'}}>
            <span className="section-heading">
              <span className="icon-badge">≡</span> 관리도 통계량
            </span>
          </div>
          <div className="stats-detail-grid">
            <StatD label={`${chartLabel1}-bar (전체평균)`} value={chart1.CL.toFixed(4)} />
            <StatD label="UCL" value={chart1.UCL.toFixed(4)} color="red" />
            <StatD label="LCL" value={Math.max(0,chart1.LCL).toFixed(4)} color="red" />
            {chart2 && <>
              <StatD label={`${chartLabel2} UCL`} value={chart2.UCL.toFixed(4)} color="red" />
              <StatD label={`${chartLabel2} CL`}  value={chart2.CL.toFixed(4)} />
            </>}
            <StatD label="부분군 수 (k)" value={activeSubgroups.length} />
            <StatD label="이상점 수" value={allViolations.length}
              color={allViolations.length>0?'red':'green'} />
            <StatD label="공정 판정"
              value={isControlled?'관리상태':'비관리상태'}
              color={isControlled?'green':'red'} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatD({ label, value, color }) {
  return (
    <div className="stat-detail-item">
      <span className="stat-detail-label">{label}</span>
      <span className={`stat-detail-value mono ${color?`color-${color}`:''}`}>{value}</span>
    </div>
  )
}

// ── 관리도 Canvas (4번 — 선명도 개선) ────────────────────────
function ControlChart({ points, CL, UCL, LCL, violations, violatedSet, label, color }) {
  const canvasRef = useRef()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !points.length) return
    const dpr = window.devicePixelRatio || 1
    const dW = 720, dH = 260
    canvas.width  = dW * dpr
    canvas.height = dH * dpr
    canvas.style.width  = dW + 'px'
    canvas.style.height = dH + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const W = dW, H = dH
    const PAD = { top:36, right:110, bottom:42, left:58 }
    const iW = W - PAD.left - PAD.right
    const iH = H - PAD.top  - PAD.bottom
    const n  = points.length
    const sigma = (UCL - CL) / 3

    // Y 범위
    const allY = [...points, UCL, LCL]
    const yMin = Math.min(...allY) - sigma * 0.6
    const yMax = Math.max(...allY) + sigma * 0.6
    const yRange = yMax - yMin || 1

    const xC = i  => PAD.left + (n <= 1 ? iW/2 : (i / (n-1)) * iW)
    const yC = v  => PAD.top  + iH - ((v - yMin) / yRange) * iH

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, W, H)

    // ── σ 구간 배경 ──
    ;[
      { from: CL - sigma,   to: CL + sigma,   fill: 'rgba(139,111,71,0.04)' },
      { from: CL - 2*sigma, to: CL - sigma,   fill: 'rgba(139,111,71,0.07)' },
      { from: CL + sigma,   to: CL + 2*sigma, fill: 'rgba(139,111,71,0.07)' },
    ].forEach(z => {
      const y0 = yC(Math.min(z.to, yMax))
      const y1 = yC(Math.max(z.from, yMin))
      ctx.fillStyle = z.fill
      ctx.fillRect(PAD.left, y0, iW, y1 - y0)
    })

    // ── 격자선 ──
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * iH
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + iW, y); ctx.stroke()
    }

    // ── ±σ 보조선 ──
    ;[-2,-1,1,2].forEach(s => {
      const v = CL + s * sigma
      if (v < yMin || v > yMax) return
      const yy = yC(v)
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath(); ctx.moveTo(PAD.left, yy); ctx.lineTo(PAD.left + iW, yy); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#9C9690'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${s > 0 ? '+' : ''}${s}σ`, PAD.left - 5, yy + 4)
    })

    // ── 관리한계선 ──
    const drawHLine = (v, c, dash, lbl) => {
      const yy = yC(v)
      if (yy < PAD.top - 8 || yy > PAD.top + iH + 8) return
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash(dash)
      ctx.beginPath(); ctx.moveTo(PAD.left, yy); ctx.lineTo(PAD.left + iW, yy); ctx.stroke()
      ctx.setLineDash([])
      // 오른쪽 라벨 박스
      ctx.font = 'bold 11px monospace'
      const tw = ctx.measureText(lbl).width
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.roundRect(PAD.left + iW + 5, yy - 9, tw + 10, 18, 3)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      ctx.fillText(lbl, PAD.left + iW + 10, yy + 4)
    }
    drawHLine(UCL,             '#DC2626', [7, 4], `UCL=${UCL.toFixed(3)}`)
    drawHLine(CL,              '#16A34A', [5, 3], `CL=${CL.toFixed(3)}`)
    drawHLine(Math.max(0, LCL),'#DC2626', [7, 4], `LCL=${Math.max(0,LCL).toFixed(3)}`)

    // ── 데이터 선 ──
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5     // ← 4번: 선 굵기 개선
    ctx.lineJoin = 'round'
    ctx.setLineDash([])
    points.forEach((v, i) => { i === 0 ? ctx.moveTo(xC(i), yC(v)) : ctx.lineTo(xC(i), yC(v)) })
    ctx.stroke()

    // ── 데이터 점 ──
    points.forEach((v, i) => {
      const oob      = v > UCL || v < LCL
      const violated = violatedSet.has(i)
      const x = xC(i), y = yC(v)

      // 이상점 후광
      if (oob || violated) {
        ctx.beginPath()
        ctx.arc(x, y, 13, 0, Math.PI * 2)
        ctx.fillStyle = oob ? 'rgba(220,38,38,0.15)' : 'rgba(217,119,6,0.15)'
        ctx.fill()
      }

      // 점
      ctx.beginPath()
      ctx.arc(x, y, oob ? 7 : violated ? 6 : 5, 0, Math.PI * 2)  // ← 4번: 점 크기 개선
      ctx.fillStyle = oob ? '#DC2626' : violated ? '#D97706' : color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()

      // 위반 Rule 번호 라벨
      if (violated || oob) {
        const ruleNos = violations
          .filter(v2 => v2.points.includes(i))
          .map(v2 => v2.ruleNo)
        if (ruleNos.length > 0) {
          const lbl = ruleNos.map(r => `R${r}`).join(',')
          ctx.fillStyle = oob ? '#DC2626' : '#D97706'
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(lbl, x, y - 16)
        }
      }
    })

    // ── X축 레이블 ──
    ctx.fillStyle = '#9C9690'
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(n / 14))
    for (let i = 0; i < n; i += step) {
      ctx.fillText(i + 1, xC(i), PAD.top + iH + 22)
    }
    ctx.fillText('Lot', PAD.left + iW / 2, PAD.top + iH + 38)

    // ── Y축 레이블 ──
    ctx.save()
    ctx.translate(16, PAD.top + iH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = '#5C5650'
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, 0, 0)
    ctx.restore()

    // ── 테두리 ──
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.strokeRect(PAD.left, PAD.top, iW, iH)
  }, [points, CL, UCL, LCL, violations, violatedSet, label, color])

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} style={{width:'100%', height:'auto', borderRadius:'8px'}} />
    </div>
  )
}
