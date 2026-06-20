import { useMemo } from 'react'
import {
  calcCapability, capabilityGrade, calcXbarR,
  applyNelsonRules, getProcessStatus,
} from '../utils/spcCalc'
import './Dashboard.css'

export default function Dashboard({ appData, onNavigate, processes = [], processStatuses = [] }) {
  const { subgroups = [], spec = { USL: 120, LSL: 80, target: 100 }, flatData = [], attrData = [] } = appData || {}

  const cap = useMemo(() =>
    flatData.length > 0 ? calcCapability(flatData, subgroups, spec.USL, spec.LSL) : null
  , [flatData, subgroups, spec])

  const xbarR  = useMemo(() => subgroups.length > 0 ? calcXbarR(subgroups) : null, [subgroups])
  const violations = useMemo(() => {
    if (!xbarR) return []
    return applyNelsonRules(xbarR.xBar.points, xbarR.xBar.CL, xbarR.xBar.UCL, xbarR.xBar.LCL)
  }, [xbarR])

  const status = getProcessStatus(cap, violations)
  const statusConfig = {
    good:    { label: '관리상태',   color: 'green', icon: '✓', desc: '공정이 정상 범위 내에서 운전 중입니다.' },
    warning: { label: '주의 필요',  color: 'amber', icon: '⚠', desc: '공정능력이 기준치에 근접하거나 이상 패턴이 감지됩니다.' },
    bad:     { label: '비관리상태', color: 'red',   icon: '✕', desc: '공정능력 부족 또는 이상원인 변동이 탐지되었습니다.' },
    unknown: { label: '분석 전',    color: 'cyan',  icon: '○', desc: '데이터를 입력하고 분석을 실행하세요.' },
  }
  const s = statusConfig[status]
  const cpkGrade = cap ? capabilityGrade(cap.Cpk) : null

  const totalSamples = attrData.reduce((a, r) => a + r.sampleSize, 0)
  const totalDefects = attrData.reduce((a, r) => a + r.defects, 0)
  const defectRate   = totalSamples > 0 ? (totalDefects / totalSamples * 100).toFixed(3) : '—'

  // 공정별 요약 (멀티 공정)
  const processSummary = useMemo(() =>
    processes.map((p, i) => {
      const flat = p.subgroups.flat()
      if (!flat.length) return null
      const c = calcCapability(flat, p.subgroups, p.spec.USL, p.spec.LSL)
      const xr = calcXbarR(p.subgroups)
      const v  = applyNelsonRules(xr.xBar.points, xr.xBar.CL, xr.xBar.UCL, xr.xBar.LCL)
      const st = processStatuses[i] || 'unknown'
      return { name: p.name, c, v, st }
    }).filter(Boolean)
  , [processes, processStatuses])

  return (
    <div className="dashboard-page animate-slide-up">

      {/* ── Process Status Banner ── */}
      <div className={`status-banner status-banner--${s.color}`}>
        <div className="status-banner-icon">{s.icon}</div>
        <div className="status-banner-content">
          <h2 className="status-banner-title">{s.label}</h2>
          <p className="status-banner-desc">{s.desc}</p>
        </div>
        <div className="status-banner-meta">
          <p className="section-label">USL / LSL</p>
          <p className="mono" style={{fontSize:'1.1rem', fontWeight:700}}>{spec.USL} / {spec.LSL}</p>
          <p style={{fontSize:'11px', opacity:.7}}>Target: {spec.target}</p>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="dashboard-kpi-row">
        <KPICard label="Cpk" value={cap ? cap.Cpk.toFixed(3) : '—'}
          sub="단기 공정능력 (치우침 반영)"
          color={cpkGrade?.color || 'cyan'}
          badge={cpkGrade ? `등급 ${cpkGrade.grade}` : '분석 전'}
          onClick={() => onNavigate('capability')} />
        <KPICard label="Cp" value={cap ? cap.Cp.toFixed(3) : '—'}
          sub="단기 공정능력 (산포만)"
          color={cap ? capabilityGrade(cap.Cp).color : 'cyan'}
          onClick={() => onNavigate('capability')} />
        <KPICard label="Pp" value={cap ? cap.Pp.toFixed(3) : '—'}
          sub="장기 공정능력 (산포만)"
          color={cap ? capabilityGrade(cap.Pp).color : 'cyan'}
          onClick={() => onNavigate('capability')} />
        <KPICard label="Ppk" value={cap ? cap.Ppk.toFixed(3) : '—'}
          sub="장기 공정능력 (치우침)"
          color={cap ? capabilityGrade(cap.Ppk).color : 'cyan'}
          onClick={() => onNavigate('capability')} />
        <KPICard label="Nelson 이상" value={violations.length}
          sub="Xbar-R 관리도 기준"
          color={violations.length > 0 ? 'red' : 'green'}
          badge={violations.length > 0 ? '이상 감지' : '정상'}
          onClick={() => onNavigate('spc')} />
        <KPICard label="PPM" value={cap ? cap.PPM.toLocaleString() : '—'}
          sub="불량 추정량 (per million)"
          color={cap && cap.PPM < 1000 ? 'green' : cap && cap.PPM < 10000 ? 'amber' : 'red'}
          onClick={() => onNavigate('capability')} />
        <KPICard label="불량률" value={defectRate === '—' ? '—' : `${defectRate}%`}
          sub={`계수형 — ${attrData.length}개 로트`}
          color="purple" onClick={() => onNavigate('attribute')} />
      </div>

      {/* ── 2-col: 통계량 + 빠른 이동 ── */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title-row">
            <span className="section-heading"><span className="icon-badge">≡</span> 공정 통계량</span>
            <button className="btn btn-ghost" style={{fontSize:'12px'}} onClick={() => onNavigate('capability')}>
              상세 보기 →
            </button>
          </div>
          {cap ? (
            <div className="process-stats-grid">
              <StatRow label="전체 평균 (x̄)"           value={cap.xBar.toFixed(4)} />
              <StatRow label="σ_within (단기 표준편차)"  value={cap.sigma_within.toFixed(4)} />
              <StatRow label="σ_overall (장기 표준편차)" value={cap.sigma_overall.toFixed(4)} />
              <StatRow label="Cp/Pp 비율"               value={(cap.sigma_overall > 0 ? (cap.sigma_within / cap.sigma_overall) : 1).toFixed(3)} />
              <StatRow label="CPU"                      value={cap.CPU.toFixed(4)} />
              <StatRow label="CPL"                      value={cap.CPL.toFixed(4)} />
              <StatRow label="데이터 수 (N)"             value={`${cap.n}개 (${cap.k}군)`} />
            </div>
          ) : (
            <p style={{color:'var(--text-muted)', fontSize:'13px', padding:'20px 0', textAlign:'center'}}>
              데이터를 입력해주세요
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="section-heading"><span className="icon-badge">◈</span> 빠른 이동</span>
          </div>
          <div className="quick-nav-grid">
            {[
              { id:'data',       icon:'⊞', label:'데이터 입력',    desc:'CSV 업로드, 수동 입력', color:'cyan'   },
              { id:'capability', icon:'◎', label:'공정능력분석',   desc:'Cp, Cpk, Pp, Ppk',     color:'green'  },
              { id:'spc',        icon:'∿', label:'관리도 (SPC)',   desc:'Xbar-R, I-MR + Nelson', color:'purple' },
              { id:'attribute',  icon:'⊡', label:'계수형 관리도', desc:'P, NP, C, U 관리도',    color:'amber'  },
            ].map(item => (
              <button key={item.id} className={`quick-nav-item quick-nav-${item.color}`}
                onClick={() => onNavigate(item.id)}>
                <span className="quick-nav-icon">{item.icon}</span>
                <div>
                  <div className="quick-nav-label">{item.label}</div>
                  <div className="quick-nav-desc">{item.desc}</div>
                </div>
                <span className="quick-nav-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 공정별 요약 테이블 ── */}
      {processSummary.length > 0 && (
        <div className="card">
          <div className="card-title-row">
            <span className="section-heading"><span className="icon-badge">▣</span> 공정별 요약</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="data-table" style={{fontSize:'12px'}}>
              <thead>
                <tr>
                  <th>공정명</th><th>평균 X̄</th><th>σ_overall</th>
                  <th>Cp</th><th>Cpk</th><th>Pp</th><th>Ppk</th>
                  <th>Nelson 위반</th><th>상태</th>
                </tr>
              </thead>
              <tbody>
                {processSummary.map((p, i) => {
                  const stColor = p.st === 'good' ? 'green' : p.st === 'warning' ? 'amber' : 'red'
                  const stLabel = p.st === 'good' ? '양호' : p.st === 'warning' ? '주의' : '이상'
                  return (
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{p.name}</td>
                      <td className="mono">{p.c.xBar.toFixed(3)}</td>
                      <td className="mono">{p.c.sigma_overall.toFixed(4)}</td>
                      <td className="mono">{p.c.Cp.toFixed(3)}</td>
                      <td className="mono">{p.c.Cpk.toFixed(3)}</td>
                      <td className="mono">{p.c.Pp.toFixed(3)}</td>
                      <td className="mono">{p.c.Ppk.toFixed(3)}</td>
                      <td style={{color: p.v.length > 0 ? 'var(--red)' : 'var(--text-muted)'}}>
                        {p.v.length}건
                      </td>
                      <td><span className={`badge badge--${stColor}`}>{stLabel}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Capability Grade Guide ── */}
      <div className="card">
        <div className="card-title-row">
          <span className="section-heading"><span className="icon-badge">▣</span> 공정능력 등급 기준 (강의록)</span>
        </div>
        <div className="grade-guide-row">
          {[
            { label:'0등급', range:'Cp ≥ 1.67', desc:'매우 충분',  color:'green' },
            { label:'1등급', range:'Cp ≥ 1.33', desc:'충분',       color:'green' },
            { label:'2등급', range:'Cp ≥ 1.00', desc:'보통',       color:'amber' },
            { label:'3등급', range:'Cp ≥ 0.67', desc:'모자람',     color:'amber' },
            { label:'4등급', range:'Cp < 0.67',  desc:'매우 부족', color:'red'   },
          ].map(g => (
            <div key={g.label} className="grade-item">
              <span className={`badge badge--${g.color}`}>{g.label}</span>
              <p className="mono" style={{fontSize:'11px', margin:'4px 0', color:'var(--text-secondary)'}}>{g.range}</p>
              <p style={{fontSize:'12px', color:`var(--${g.color})`}}>{g.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, sub, color, badge, onClick }) {
  return (
    <div className={`card kpi-dash-card kpi-dash-${color}`} onClick={onClick} style={{cursor:'pointer'}}>
      <div className="kpi-dash-top">
        <span className="kpi-dash-label mono">{label}</span>
        {badge && <span className={`badge badge--${color}`}>{badge}</span>}
      </div>
      <div className={`kpi-dash-value mono color-${color}`}>{value}</div>
      <p className="kpi-dash-sub">{sub}</p>
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="stat-row">
      <span className="stat-row-label">{label}</span>
      <span className="stat-row-value mono">{value}</span>
    </div>
  )
}
