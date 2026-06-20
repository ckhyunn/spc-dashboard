import { useState, useMemo, useRef, useEffect } from 'react'
import { mean } from '../utils/spcCalc'
import './AttributeCharts.css'

const CHART_TYPES = [
  { id:'P',  label:'P 관리도',  desc:'불량률 (부분군 크기 가변)',    badge:'badge--cyan'   },
  { id:'NP', label:'NP 관리도', desc:'불량 개수 (부분군 크기 일정)', badge:'badge--purple' },
  { id:'C',  label:'C 관리도',  desc:'결점수 (단위당 결점)',         badge:'badge--green'  },
  { id:'U',  label:'U 관리도',  desc:'단위당 결점수 (검사 단위 가변)', badge:'badge--amber' },
]

const DEFAULT_DATA = {
  P:  Array.from({length:20},(_,i)=>({n:300, d:[5,7,4,6,8,5,9,6,4,7,21,6,5,8,4,7,5,6,8,5][i]})),
  NP: Array.from({length:20},(_,i)=>({n:50,  d:[1,2,1,3,2,1,3,2,9,2,1,3,2,1,2,3,1,2,3,1][i]})),
  C:  Array.from({length:20},(_,i)=>({n:1,   d:[3,4,2,5,3,4,12,3,2,4,3,5,2,4,3,2,4,3,5,3][i]})),
  U:  Array.from({length:20},(_,i)=>({n:[5,5,4,6,5,4,6,5,4,6,5,4,5,6,5,4,6,5,4,5][i], d:[4,3,3,5,4,3,5,4,3,5,4,9,4,5,3,3,5,4,3,4][i]})),
}

function calcAttr(type, rows) {
  const totalN = rows.reduce((s,r)=>s+r.n, 0)
  const totalD = rows.reduce((s,r)=>s+r.d, 0)
  const results = []
  let cl, avgUCL, avgLCL

  if (type === 'P') {
    cl = totalD / totalN
    rows.forEach(r => {
      const p   = r.d / r.n
      const ucl = cl + 3 * Math.sqrt(cl*(1-cl)/r.n)
      const lcl = Math.max(0, cl - 3 * Math.sqrt(cl*(1-cl)/r.n))
      results.push({ val:p, ucl, lcl, viol: p>ucl||p<lcl })
    })
  } else if (type === 'NP') {
    const n0 = rows[0]?.n || 50
    cl = totalD / rows.length
    const pbar = cl / n0
    rows.forEach(r => {
      const np  = r.d
      const ucl = n0*pbar + 3*Math.sqrt(n0*pbar*(1-pbar))
      const lcl = Math.max(0, n0*pbar - 3*Math.sqrt(n0*pbar*(1-pbar)))
      results.push({ val:np, ucl, lcl, viol: np>ucl||np<lcl })
    })
  } else if (type === 'C') {
    cl = totalD / rows.reduce((s,r)=>s+r.n, 0)
    rows.forEach(r => {
      const c   = r.d / r.n
      const ucl = cl + 3*Math.sqrt(cl)
      const lcl = Math.max(0, cl - 3*Math.sqrt(cl))
      results.push({ val:c, ucl, lcl, viol: c>ucl||c<lcl })
    })
  } else { // U
    cl = totalD / rows.reduce((s,r)=>s+r.n, 0)
    rows.forEach(r => {
      const u   = r.d / r.n
      const ucl = cl + 3*Math.sqrt(cl/r.n)
      const lcl = Math.max(0, cl - 3*Math.sqrt(cl/r.n))
      results.push({ val:u, ucl, lcl, viol: u>ucl||u<lcl })
    })
  }

  avgUCL = mean(results.map(r=>r.ucl))
  avgLCL = mean(results.map(r=>r.lcl))
  return { results, cl, avgUCL, avgLCL, viols: results.filter(r=>r.viol).length }
}

const TYPE_META = {
  P:  { clLabel:'p̄',  yLabel:'불량률 (p)',       col1:'검사수(n)',   col2:'불량수(d)',  col3:'불량률(p)',   fmt: v=>(v*100).toFixed(3)+'%', guide:'P 관리도: 불량률(p)을 관리. 부분군 크기(n)가 달라도 사용 가능. 이항분포 기반.' },
  NP: { clLabel:'np̄', yLabel:'불량 개수 (np)',   col1:'검사수(n)',   col2:'불량수(d)',  col3:'불량수(np)',  fmt: v=>v.toFixed(1),           guide:'NP 관리도: 불량 개수(np)를 직접 관리. 부분군 크기(n)가 일정해야 함. 이항분포 기반.' },
  C:  { clLabel:'c̄',  yLabel:'결점수 (c)',       col1:'검사단위',    col2:'결점수(c)',  col3:'단위결점(c)', fmt: v=>v.toFixed(2),           guide:'C 관리도: 단위당 결점수(c)를 관리. 검사 단위 크기가 일정할 때 사용. 포아송분포 기반.' },
  U:  { clLabel:'ū',   yLabel:'단위당 결점수 (u)', col1:'검사면적',   col2:'결점수(c)', col3:'단위결점(u)', fmt: v=>v.toFixed(4),           guide:'U 관리도: 단위당 결점수(u)를 관리. 검사 단위 크기가 달라도 사용 가능. 포아송분포 기반.' },
}

export default function AttributeCharts({ appData }) {
  const { attrData = [] } = appData || {}
  const [chartType, setChartType] = useState('P')
  const [rows, setRows] = useState(() => JSON.parse(JSON.stringify(DEFAULT_DATA['P'])))

  const meta   = TYPE_META[chartType]
  const result = useMemo(() => rows.length >= 2 ? calcAttr(chartType, rows) : null, [chartType, rows])

  const switchType = (t) => {
    setChartType(t)
    setRows(JSON.parse(JSON.stringify(DEFAULT_DATA[t])))
  }

  const addRow = () => setRows(prev => {
    const last = prev[prev.length-1] || {n:100, d:0}
    return [...prev, {n:last.n, d:0}]
  })
  const removeRow = () => {
    if (rows.length <= 2) return
    setRows(prev => prev.slice(0,-1))
  }
  const resetData = () => setRows(JSON.parse(JSON.stringify(DEFAULT_DATA[chartType])))
  const updateRow = (i, key, val) => {
    setRows(prev => prev.map((r,idx) => idx===i ? {...r, [key]: parseFloat(val)||0} : r))
  }

  return (
    <div className="attr-page animate-slide-up">
      <div className="page-header">
        <div>
          <p className="section-label">Step 05</p>
          <h2 className="page-title">계수형 관리도</h2>
          <p className="page-desc">P · NP · C · U 관리도 — 3σ 관리한계</p>
        </div>
        {result && (
          <span className={`badge ${result.viols > 0 ? 'badge--red' : 'badge--green'}`}>
            {result.viols > 0 ? `이상 ${result.viols}건` : '관리상태'}
          </span>
        )}
      </div>

      {/* Chart type selector */}
      <div className="chart-type-selector">
        {CHART_TYPES.map(ct => (
          <button key={ct.id}
            className={`chart-type-btn ${chartType===ct.id ? 'active' : ''}`}
            onClick={() => switchType(ct.id)}>
            <div>
              <div className="chart-type-label">{ct.label}</div>
              <div className="chart-type-sub">{ct.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Guide */}
      <div style={{padding:'10px 14px', background:'var(--bg-elevated)', borderRadius:'8px', fontSize:'12px', color:'var(--text-secondary)'}}>
        💡 {meta.guide}
      </div>

      {/* Toolbar */}
      <div className="tbl-toolbar">
        <button className="btn btn-primary" onClick={addRow}>+ 행 추가</button>
        <button className="btn btn-ghost" onClick={removeRow}>− 마지막 행 삭제</button>
        <button className="btn btn-ghost" onClick={resetData}>기본 데이터로 초기화</button>
      </div>

      {/* Chart */}
      {result && (
        <div className="card chart-card-full">
          <div className="card-title-row">
            <span className="section-heading"><span className="icon-badge">∿</span> {CHART_TYPES.find(c=>c.id===chartType)?.label}</span>
            <div className="chart-stats-pills">
              <span className="badge badge--cyan">CL = {meta.fmt(result.cl)}</span>
              <span className="badge badge--red">평균 UCL = {meta.fmt(result.avgUCL)}</span>
              <span className="badge badge--red">평균 LCL = {meta.fmt(result.avgLCL)}</span>
            </div>
          </div>
          <AttrChart results={result.results} cl={result.cl} meta={meta} />
          <div style={{display:'flex', gap:'16px', marginTop:'10px', flexWrap:'wrap', fontSize:'11px', color:'var(--text-secondary)'}}>
            <span>● 정상</span><span style={{color:'#DC2626'}}>● 이탈</span>
            <span style={{borderTop:'2px dashed #DC2626', display:'inline-block', width:'14px', marginTop:'5px'}}></span><span>UCL/LCL</span>
            <span style={{borderTop:'2px dashed #059669', display:'inline-block', width:'14px', marginTop:'5px'}}></span><span>CL</span>
          </div>
        </div>
      )}

      {/* 통계량 */}
      {result && (
        <div className="card">
          <div className="card-title-row" style={{marginBottom:'16px'}}>
            <span className="section-heading"><span className="icon-badge">≡</span> 계수형 관리도 통계량</span>
          </div>
          <div className="stats-detail-grid">
            <StatD label="중심선 (CL)" value={meta.fmt(result.cl)} />
            <StatD label="평균 UCL"    value={meta.fmt(result.avgUCL)} />
            <StatD label="평균 LCL"    value={meta.fmt(result.avgLCL)} />
            <StatD label="이탈점 수"   value={`${result.viols}건`} color={result.viols>0?'red':'green'} />
          </div>
        </div>
      )}

      {/* Lot별 판정 */}
      {result && (
        <div className="card">
          <div className="card-title-row" style={{marginBottom:'16px'}}>
            <span className="section-heading"><span className="icon-badge">▣</span> Lot별 판정</span>
          </div>
          <div style={{overflowX:'auto', maxHeight:'320px', overflowY:'auto'}}>
            <table className="data-table" style={{fontSize:'12px'}}>
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>{meta.col1}</th>
                  <th>{meta.col2}</th>
                  <th>{meta.col3}</th>
                  <th>UCL</th><th>LCL</th><th>판정</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r,i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{i+1}</td>
                    <td className="mono">{rows[i]?.n}</td>
                    <td className="mono">{rows[i]?.d}</td>
                    <td className="mono">{meta.fmt(r.val)}</td>
                    <td className="mono">{meta.fmt(r.ucl)}</td>
                    <td className="mono">{meta.fmt(r.lcl)}</td>
                    <td><span className={`badge ${r.viol ? 'badge--red' : 'badge--green'}`}>{r.viol ? '이탈' : '관리'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 이론 표 */}
      <div className="card">
        <div className="card-title-row" style={{marginBottom:'16px'}}>
          <span className="section-heading"><span className="icon-badge">▣</span> 계수형 관리도 이론</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="data-table" style={{fontSize:'12px'}}>
            <thead><tr><th>유형</th><th>적용 데이터</th><th>중심선 (CL)</th><th>관리한계</th></tr></thead>
            <tbody>
              <tr><td><span className="badge badge--cyan">P</span></td><td>불량률 (가변 n)</td><td>p̄ = 총불량/총검사</td><td>p̄ ± 3√(p̄(1-p̄)/nᵢ)</td></tr>
              <tr><td><span className="badge badge--purple">NP</span></td><td>불량수 (고정 n)</td><td>n·p̄</td><td>n·p̄ ± 3√(n·p̄(1-p̄))</td></tr>
              <tr><td><span className="badge badge--green">C</span></td><td>결점수 (고정 단위)</td><td>c̄ = 총결점/총단위</td><td>c̄ ± 3√c̄</td></tr>
              <tr><td><span className="badge badge--amber">U</span></td><td>단위당 결점수</td><td>ū = 총결점/총면적</td><td>ū ± 3√(ū/mᵢ)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatD({ label, value, color }) {
  return (
    <div className="stat-detail-item">
      <span className="stat-detail-label">{label}</span>
      <span className={`stat-detail-value mono ${color ? `color-${color}` : ''}`}>{value}</span>
    </div>
  )
}

function AttrChart({ results, cl, meta }) {
  const canvasRef = useRef()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !results.length) return
    const dpr = window.devicePixelRatio || 1
    const dW = 700, dH = 240
    canvas.width = dW*dpr; canvas.height = dH*dpr
    canvas.style.width = dW+'px'; canvas.style.height = dH+'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    const W=dW, H=dH
    const PAD = {top:28, right:90, bottom:36, left:56}
    const iW = W-PAD.left-PAD.right, iH = H-PAD.top-PAD.bottom
    const n  = results.length

    ctx.clearRect(0,0,W,H); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H)

    const vals = results.map(r=>r.val)
    const allUCL = results.map(r=>r.ucl)
    const allLCL = results.map(r=>r.lcl)
    const yMin2 = Math.max(0, Math.min(...vals, ...allLCL) * 0.85)
    const yMax2 = Math.max(...vals, ...allUCL) * 1.1 || 1
    const yRange = yMax2 - yMin2 || 1

    const xC = i => PAD.left + (n<=1 ? iW/2 : (i/(n-1))*iW)
    const yC = v => PAD.top + iH - ((v-yMin2)/yRange)*iH

    // grid
    ctx.strokeStyle='rgba(0,0,0,0.06)'; ctx.lineWidth=1
    for (let i=0;i<=4;i++){
      const y=PAD.top+(i/4)*iH
      ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+iW,y); ctx.stroke()
    }

    // variable UCL/LCL lines
    ctx.strokeStyle='#DC2626'; ctx.lineWidth=1.5; ctx.setLineDash([5,3])
    ctx.beginPath()
    allUCL.forEach((v,i) => i===0 ? ctx.moveTo(xC(i),yC(v)) : ctx.lineTo(xC(i),yC(v)))
    ctx.stroke()
    ctx.beginPath()
    allLCL.forEach((v,i) => i===0 ? ctx.moveTo(xC(i),yC(v)) : ctx.lineTo(xC(i),yC(v)))
    ctx.stroke()

    // CL
    ctx.strokeStyle='#059669'; ctx.lineWidth=1.8; ctx.setLineDash([4,3])
    ctx.beginPath(); ctx.moveTo(PAD.left,yC(cl)); ctx.lineTo(PAD.left+iW,yC(cl)); ctx.stroke()
    ctx.setLineDash([])

    // labels
    const drawLbl = (y, c, lbl) => {
      const yy = yC(y)
      ctx.fillStyle=c; ctx.font='bold 11px monospace'; ctx.textAlign='left'
      ctx.fillText(`${lbl}=${meta.fmt(y)}`, PAD.left+iW+5, yy+4)
    }
    drawLbl(allUCL[n-1], '#DC2626', 'UCL')
    drawLbl(cl, '#059669', 'CL')
    drawLbl(allLCL[n-1], '#DC2626', 'LCL')

    // data line
    ctx.beginPath(); ctx.strokeStyle='#4F46E5'; ctx.lineWidth=2.2; ctx.setLineDash([])
    ctx.lineJoin='round'
    vals.forEach((v,i) => i===0 ? ctx.moveTo(xC(i),yC(v)) : ctx.lineTo(xC(i),yC(v)))
    ctx.stroke()

    // points
    vals.forEach((v,i) => {
      const viol = results[i].viol
      const x=xC(i), y=yC(v)
      if (viol) {
        ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2)
        ctx.fillStyle='rgba(220,38,38,0.15)'; ctx.fill()
      }
      ctx.beginPath(); ctx.arc(x,y, viol?7:5, 0, Math.PI*2)
      ctx.fillStyle = viol ? '#DC2626' : '#4F46E5'
      ctx.fill()
      ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke()
    })

    // X axis
    ctx.fillStyle='#64748B'; ctx.font='11px monospace'; ctx.textAlign='center'
    const step=Math.max(1,Math.floor(n/12))
    for (let i=0;i<n;i+=step) ctx.fillText(i+1, xC(i), PAD.top+iH+20)

    // Y axis
    ctx.save(); ctx.translate(16, PAD.top+iH/2); ctx.rotate(-Math.PI/2)
    ctx.fillStyle='#64748B'; ctx.font='bold 11px monospace'; ctx.textAlign='center'
    ctx.fillText(meta.clLabel, 0, 0); ctx.restore()

    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=1
    ctx.strokeRect(PAD.left, PAD.top, iW, iH)
  }, [results, cl, meta])

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} style={{width:'100%', height:'auto', borderRadius:'8px'}} />
    </div>
  )
}
