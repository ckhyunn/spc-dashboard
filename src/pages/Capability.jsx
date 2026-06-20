import { useMemo, useRef, useEffect } from 'react'
import {
  calcCapability, capabilityGrade, calcCpm,
  normalityTest, normalPDF, qqPlotData, mean, std
} from '../utils/spcCalc'
import './Capability.css'

export default function ProcessCapability({ appData }) {
  const { subgroups = [], spec = { USL: 120, LSL: 80, target: 100 }, flatData = [] } = appData || {}

  const cap = useMemo(() =>
    flatData.length > 0 ? calcCapability(flatData, subgroups, spec.USL, spec.LSL) : null
  , [flatData, subgroups, spec])

  const cpm = useMemo(() =>
    flatData.length > 0 ? calcCpm(flatData, spec.USL, spec.LSL, spec.target) : null
  , [flatData, spec])

  const normality = useMemo(() => flatData.length >= 3 ? normalityTest(flatData) : null, [flatData])
  const qqData    = useMemo(() => flatData.length > 2   ? qqPlotData(flatData)  : [], [flatData])

  if (!cap || flatData.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">◎</div>
        <h3>데이터를 먼저 입력해주세요</h3>
        <p>데이터 입력 탭에서 측정값과 규격을 설정하면 분석이 시작됩니다.</p>
      </div>
    )
  }

  const cpGrade  = capabilityGrade(cap.Cp)
  const cpkGrade = capabilityGrade(cap.Cpk)
  const ppGrade  = capabilityGrade(cap.Pp)
  const ppkGrade = capabilityGrade(cap.Ppk)
  const cpmGrade = cpm !== null ? capabilityGrade(cpm) : null

  const sigmaRatio = cap.sigma_overall > 0 ? (cap.sigma_within / cap.sigma_overall) : 1

  return (
    <div className="capability-page animate-slide-up">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <p className="section-label">Step 03</p>
          <h2 className="page-title">공정능력분석</h2>
          <p className="page-desc">
            USL={spec.USL} / LSL={spec.LSL} / Target={spec.target} &nbsp;|&nbsp;
            N={flatData.length} ({subgroups.length}개 부분군 × {subgroups[0]?.length || 0}개)
          </p>
        </div>
        <div>
          {normality && (
            <span className={`badge badge--${normality.color}`}>
              정규성 {normality.label} (점수: {normality.totalScore})
            </span>
          )}
        </div>
      </div>

      {/* ── 히스토그램 stat 요약 ── */}
      <div className="hist-stats-row">
        {[
          { label:'Cp (단기)',  val: cap.Cp,  grade: cpGrade },
          { label:'Cpk (단기)', val: cap.Cpk, grade: cpkGrade },
          { label:'Pp (장기)',  val: cap.Pp,  grade: ppGrade },
          { label:'Ppk (장기)', val: cap.Ppk, grade: ppkGrade },
          { label:'규격 내 비율', val: null, text: ((1 - cap.PPM/1e6)*100).toFixed(2)+'%', color: cap.PPM < 2700 ? 'green' : cap.PPM < 10000 ? 'amber' : 'red' },
          { label:'불량률 PPM',  val: null, text: cap.PPM.toLocaleString(), color: cap.PPM < 1000 ? 'green' : cap.PPM < 10000 ? 'amber' : 'red' },
        ].map((item, i) => (
          <div key={i} className="hist-stat-box">
            <div className="hist-stat-label">{item.label}</div>
            <div className={`hist-stat-val mono color-${item.grade?.color || item.color}`}>
              {item.val !== null ? item.val.toFixed(3) : item.text}
            </div>
          </div>
        ))}
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="kpi-row">
        <CapabilityKPI label="Cp"  value={cap.Cp}  grade={cpGrade}  sub="단기 공정능력 (산포만 반영)" formula="(USL-LSL) / 6σ_within" />
        <CapabilityKPI label="Cpk" value={cap.Cpk} grade={cpkGrade} sub="단기 공정능력 (치우침 반영)" formula="min(CPU, CPL)" highlight />
        <CapabilityKPI label="Pp"  value={cap.Pp}  grade={ppGrade}  sub="장기 공정능력 (산포만 반영)" formula="(USL-LSL) / 6σ_overall" />
        <CapabilityKPI label="Ppk" value={cap.Ppk} grade={ppkGrade} sub="장기 공정능력 (치우침 반영)" formula="min(PPU, PPL)" />
      </div>

      {/* ── Charts Row ── */}
      <div className="charts-row">
        <div className="card chart-card">
          <div className="card-title-row">
            <span className="section-heading"><span className="icon-badge">▦</span> 공정능력 히스토그램</span>
          </div>
          <HistogramChart data={flatData} spec={spec} cap={cap} />
        </div>
        <div className="card chart-card">
          <div className="card-title-row">
            <span className="section-heading"><span className="icon-badge">⊹</span> Q-Q Plot</span>
          </div>
          <QQChart qqData={qqData} />
        </div>
      </div>

      {/* ── 단기 vs 장기 비교 ── */}
      <div className="card">
        <div className="card-title-row" style={{marginBottom:'16px'}}>
          <span className="section-heading"><span className="icon-badge">≡</span> 단기 (Cp/Cpk) vs 장기 (Pp/Ppk) 비교</span>
        </div>
        <div className="cap-compare-grid">
          <div className="cap-col">
            <div className="cap-col-title">단기 공정능력 <span className="badge badge--cyan" style={{fontSize:'10px'}}>σ_within</span></div>
            {[
              ['Cp',       cap.Cp.toFixed(4)],
              ['Cpk',      cap.Cpk.toFixed(4)],
              ['CPU',      cap.CPU.toFixed(4)],
              ['CPL',      cap.CPL.toFixed(4)],
              ['Cpm',      cpm !== null ? cpm.toFixed(4) : '—'],
              ['σ_within', cap.sigma_within.toFixed(4)],
            ].map(([k,v]) => (
              <div key={k} className="cap-row">
                <span className="cap-key">{k}</span>
                <span className="cap-val mono">{v}</span>
              </div>
            ))}
          </div>
          <div className="cap-col">
            <div className="cap-col-title">장기 공정능력 <span className="badge badge--amber" style={{fontSize:'10px'}}>σ_overall</span></div>
            {[
              ['Pp',         cap.Pp.toFixed(4)],
              ['Ppk',        cap.Ppk.toFixed(4)],
              ['PPU',        cap.PPU.toFixed(4)],
              ['PPL',        cap.PPL.toFixed(4)],
              ['σ_overall',  cap.sigma_overall.toFixed(4)],
              ['Cp/Pp 비율', sigmaRatio.toFixed(3) + (sigmaRatio < 0.85 ? ' (군간변동 큼)' : ' (안정적)')],
            ].map(([k,v]) => (
              <div key={k} className="cap-row">
                <span className="cap-key">{k}</span>
                <span className="cap-val mono">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 정규성 검정 ── */}
      {normality && (
        <div className="card normality-card">
          <div className="card-title-row">
            <span className="section-heading"><span className="icon-badge">≈</span> 정규성 검정 (왜도 · 첨도 기반)</span>
            <span className={`badge badge--${normality.color}`}>{normality.label}</span>
          </div>
          <div className="normality-grid">
            <NormBox label="왜도 (Skewness)" val={normality.skew.toFixed(3)}
              sub={Math.abs(normality.skew)<0.5?'대칭 ✓':Math.abs(normality.skew)<1.0?'약간 편중 △':'강한 편중 ✗'}
              color={normality.skewOk?'green':normality.skewWarn?'amber':'red'} />
            <NormBox label="첨도 (Kurtosis)" val={normality.kurt.toFixed(3)}
              sub={Math.abs(normality.kurt)<1.0?'정규에 가까움 ✓':Math.abs(normality.kurt)<2.0?'약간 비정규 △':'비정규 ✗'}
              color={normality.kurtOk?'green':normality.kurtWarn?'amber':'red'} />
            <NormBox label="표본 수" val={normality.n}
              sub={normality.n >= 30 ? '충분한 표본' : '표본 수 부족'} color="cyan" />
            <NormBox label="정규성 점수" val={normality.totalScore}
              sub={normality.totalScore>=75?'양호':normality.totalScore>=50?'주의':'불량'}
              color={normality.color} />
          </div>
          <div className={`normality-result normality-result--${normality.color}`}>
            {normality.totalScore >= 75
              ? '✓ 정규성 만족 — 왜도·첨도가 정규분포 범위 내에 있습니다. Cp/Cpk 해석이 유효합니다.'
              : normality.totalScore >= 50
              ? '⚠ 정규성 주의 — 분포가 약간 비대칭입니다. 공정능력지수 해석 시 참고하세요.'
              : '✗ 정규성 불만족 — 비정규 분포가 의심됩니다. Cp/Cpk 신뢰도가 낮을 수 있습니다.'}
          </div>
          <p style={{fontSize:'11px', color:'var(--text-muted)', marginTop:'8px'}}>
            💡 판정 기준: 왜도 |S| &lt; 0.5 → 대칭, 첨도 |K-3| &lt; 1.0 → 정규에 가까움
          </p>
        </div>
      )}

      {/* ── 상세 통계량 ── */}
      <div className="card">
        <div className="card-title-row" style={{marginBottom:'16px'}}>
          <span className="section-heading"><span className="icon-badge">≡</span> 상세 통계량</span>
        </div>
        <div className="stats-detail-grid">
          <StatDetail label="전체 평균 (x̄)"  value={cap.xBar.toFixed(4)} />
          <StatDetail label="σ_within (단기)" value={cap.sigma_within.toFixed(4)} />
          <StatDetail label="σ_overall (장기)" value={cap.sigma_overall.toFixed(4)} />
          <StatDetail label="CPU"             value={cap.CPU.toFixed(4)} />
          <StatDetail label="CPL"             value={cap.CPL.toFixed(4)} />
          <StatDetail label="PPU"             value={cap.PPU.toFixed(4)} />
          <StatDetail label="PPL"             value={cap.PPL.toFixed(4)} />
          <StatDetail label="Cpm (Taguchi)"   value={cpm !== null ? cpm.toFixed(4) : '—'} />
          <StatDetail label="PPM (불량 추정)" value={cap.PPM.toLocaleString()}
            color={cap.PPM > 10000 ? 'red' : cap.PPM > 1000 ? 'amber' : 'green'} />
        </div>
      </div>

      {/* ── Grade Table ── */}
      <div className="card">
        <div className="card-title-row" style={{marginBottom:'16px'}}>
          <span className="section-heading"><span className="icon-badge">▣</span> 공정능력 판정기준 (강의록)</span>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>지표</th><th>계산값</th><th>구분</th><th>판정</th></tr>
            </thead>
            <tbody>
              {[
                { lbl:'Cp',  val:cap.Cp,  t:'단기' },
                { lbl:'Cpk', val:cap.Cpk, t:'단기' },
                { lbl:'Cpm', val:cpm,     t:'단기' },
                { lbl:'Pp',  val:cap.Pp,  t:'장기' },
                { lbl:'Ppk', val:cap.Ppk, t:'장기' },
              ].map(r => {
                if (r.val === null || r.val === undefined) return null
                const grade = capabilityGrade(r.val)
                return (
                  <tr key={r.lbl}>
                    <td className="mono">{r.lbl}</td>
                    <td className="mono">{r.val.toFixed(4)}</td>
                    <td><span className={`badge badge--${r.t==='단기' ? 'cyan' : 'amber'}`}>{r.t}</span></td>
                    <td><span className={`badge badge--${grade.color}`}>{grade.label} (등급 {grade.grade})</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function NormBox({ label, val, sub, color }) {
  return (
    <div className="norm-box">
      <p className="norm-box-label">{label}</p>
      <p className={`norm-box-value mono color-${color}`}>{val}</p>
      {sub && <p className="norm-box-sub">{sub}</p>}
    </div>
  )
}

function StatDetail({ label, value, color }) {
  return (
    <div className="stat-detail-item">
      <span className="stat-detail-label">{label}</span>
      <span className={`stat-detail-value mono ${color ? `color-${color}` : ''}`}>{value}</span>
    </div>
  )
}

function CapabilityKPI({ label, value, grade, sub, formula, highlight }) {
  return (
    <div className={`card kpi-card ${highlight ? 'card--cyan' : ''}`}>
      <div className="kpi-top">
        <span className="kpi-label mono">{label}</span>
        <span className={`badge badge--${grade.color}`}>등급 {grade.grade}</span>
      </div>
      <div className={`kpi-value mono color-${grade.color}`}>{value.toFixed(4)}</div>
      <div className="kpi-bar-wrap">
        <div className="kpi-bar-bg">
          <div className={`kpi-bar-fill kpi-bar-${grade.color}`} style={{width: `${Math.min(100, value / 2 * 100)}%`}} />
          <div className="kpi-bar-marker" style={{left:'50%'}} />
          <div className="kpi-bar-marker kpi-bar-marker--hi" style={{left:'66.5%'}} />
        </div>
      </div>
      <p className="kpi-sub">{sub}</p>
      <p className="kpi-formula mono">{formula}</p>
    </div>
  )
}

function HistogramChart({ data, spec, cap }) {
  const canvasRef = useRef()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data.length) return
    const dpr = window.devicePixelRatio || 1
    const dW = 520, dH = 280
    canvas.width = dW * dpr; canvas.height = dH * dpr
    canvas.style.width = dW + 'px'; canvas.style.height = dH + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    const W = dW, H = dH
    const PAD = { top:30, right:20, bottom:40, left:50 }
    const iW = W - PAD.left - PAD.right, iH = H - PAD.top - PAD.bottom

    ctx.clearRect(0,0,W,H)
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H)

    const mu = mean(data), s = std(data,1)
    const dMin = Math.min(...data, spec.LSL - s), dMax = Math.max(...data, spec.USL + s)
    const xRange = dMax - dMin
    const BINS = 20, binW = xRange / BINS
    const counts = Array(BINS).fill(0)
    data.forEach(v => { const b = Math.min(BINS-1, Math.floor((v-dMin)/binW)); if(b>=0) counts[b]++ })
    const maxCount = Math.max(...counts)

    const xC = x => PAD.left + ((x-dMin)/xRange)*iW
    const yC = y => PAD.top + iH - (y/maxCount)*iH

    counts.forEach((c,i) => {
      const x0 = xC(dMin + i*binW), x1 = xC(dMin + (i+1)*binW)
      const isOut = (dMin + i*binW < spec.LSL) || (dMin + (i+1)*binW > spec.USL)
      ctx.fillStyle = isOut ? 'rgba(220,38,38,0.4)' : 'rgba(79,70,229,0.25)'
      ctx.strokeStyle = isOut ? '#DC2626' : '#4F46E5'
      ctx.lineWidth = 1
      ctx.fillRect(x0+1, yC(c), x1-x0-2, iH-(yC(c)-PAD.top))
      ctx.strokeRect(x0+1, yC(c), x1-x0-2, iH-(yC(c)-PAD.top))
    })

    // Normal curve
    ctx.beginPath(); ctx.strokeStyle = '#059669'; ctx.lineWidth = 2
    for (let i=0; i<=200; i++) {
      const x = dMin + (i/200)*xRange
      const y = (Math.exp(-0.5*((x-mu)/s)**2)/(s*Math.sqrt(2*Math.PI))) * data.length * binW
      const cx = xC(x), cy = yC(y/maxCount*maxCount)
      i===0 ? ctx.moveTo(cx,cy) : ctx.lineTo(cx,cy)
    }
    ctx.stroke()

    // Vertical lines
    const vLines = [
      {x:spec.LSL, c:'#DC2626', dash:[6,3], lbl:'LSL'},
      {x:spec.USL, c:'#DC2626', dash:[6,3], lbl:'USL'},
      {x:spec.target, c:'rgba(245,158,11,0.8)', dash:[4,4], lbl:'T'},
      {x:cap.xBar, c:'#4F46E5', dash:[3,3], lbl:'x̄'},
    ]
    vLines.forEach(({x,c,dash,lbl}) => {
      const cx = xC(x)
      if (cx < PAD.left || cx > W-PAD.right) return
      ctx.strokeStyle=c; ctx.lineWidth=1.8; ctx.setLineDash(dash)
      ctx.beginPath(); ctx.moveTo(cx,PAD.top); ctx.lineTo(cx,PAD.top+iH); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle=c; ctx.font='bold 11px monospace'; ctx.textAlign='center'
      ctx.fillText(lbl, cx, PAD.top-5)
    })

    // Axes
    ctx.fillStyle = '#64748B'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
    for (let i=0; i<=5; i++) {
      const x = dMin + (i/5)*xRange
      ctx.fillText(x.toFixed(1), xC(x), PAD.top+iH+16)
    }
    ctx.save(); ctx.translate(14, PAD.top+iH/2); ctx.rotate(-Math.PI/2)
    ctx.fillText('빈도', 0, 0); ctx.restore()
  }, [data, spec, cap])

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} style={{width:'100%', height:'auto', borderRadius:'8px'}} />
      <div className="chart-legend">
        <span><span className="legend-dot" style={{background:'rgba(79,70,229,0.3)'}}/>규격 내</span>
        <span><span className="legend-dot" style={{background:'rgba(220,38,38,0.4)'}}/>규격 외</span>
        <span><span className="legend-dot" style={{background:'#059669'}}/>정규분포</span>
      </div>
    </div>
  )
}

function QQChart({ qqData }) {
  const canvasRef = useRef()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !qqData.length) return
    const dpr = window.devicePixelRatio || 1
    const dW = 360, dH = 280
    canvas.width = dW*dpr; canvas.height = dH*dpr
    canvas.style.width = dW+'px'; canvas.style.height = dH+'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    const W=dW, H=dH, PAD=40
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H)
    const xs=qqData.map(p=>p.x), ys=qqData.map(p=>p.y)
    const xMin=Math.min(...xs), xMax=Math.max(...xs)
    const yMin=Math.min(...ys), yMax=Math.max(...ys)
    const toX = v => PAD + ((v-xMin)/(xMax-xMin))*(W-PAD*2)
    const toY = v => H - PAD - ((v-yMin)/(yMax-yMin))*(H-PAD*2)
    // ref line
    ctx.strokeStyle='#EF4444'; ctx.lineWidth=1.5; ctx.setLineDash([5,4])
    ctx.beginPath(); ctx.moveTo(toX(xMin), toY(yMin)); ctx.lineTo(toX(xMax), toY(yMax)); ctx.stroke()
    ctx.setLineDash([])
    // points
    qqData.forEach(p => {
      ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), 3, 0, Math.PI*2)
      ctx.fillStyle='rgba(79,70,229,0.7)'; ctx.fill()
    })
    // axes
    ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(PAD,H-PAD); ctx.lineTo(W-PAD,H-PAD); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(PAD,PAD); ctx.lineTo(PAD,H-PAD); ctx.stroke()
    ctx.fillStyle='#64748B'; ctx.font='10px monospace'; ctx.textAlign='center'
    ctx.fillText('이론 분위수', W/2, H-8)
    ctx.save(); ctx.translate(12, H/2); ctx.rotate(-Math.PI/2); ctx.fillText('샘플 분위수', 0, 0); ctx.restore()
  }, [qqData])
  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} style={{width:'100%', height:'auto', borderRadius:'8px'}} />
      <p className="chart-sub">직선에 가까울수록 정규분포에 가까움</p>
    </div>
  )
}
