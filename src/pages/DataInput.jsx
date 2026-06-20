import { useState, useRef, useCallback } from 'react'
import { parseSubgroupData, parsePasteData } from '../utils/spcCalc'
import './DataInput.css'

// Default sample data (semiconductor thin film deposition, 강의록 예제 기반)
const DEFAULT_SUBGROUPS = [
  [102.3, 98.7, 101.2, 99.8, 100.5],
  [99.1, 101.8, 100.3, 102.1, 98.9],
  [103.2, 99.5, 101.7, 100.8, 102.4],
  [98.4, 100.9, 102.6, 99.2, 101.3],
  [101.5, 103.1, 99.7, 100.4, 102.8],
  [100.2, 98.6, 101.9, 103.4, 99.3],
  [102.7, 100.1, 98.8, 101.6, 100.9],
  [99.6, 102.3, 100.7, 98.5, 101.4],
  [101.8, 99.9, 103.5, 100.6, 99.2],
  [100.3, 102.1, 98.7, 101.5, 103.2],
  [99.4, 101.7, 100.8, 102.5, 98.3],
  [103.0, 99.8, 101.3, 100.5, 102.9],
  [98.9, 101.2, 103.6, 99.5, 100.7],
  [102.4, 100.0, 98.6, 101.9, 99.8],
  [100.6, 103.3, 99.3, 102.0, 101.1],
  [99.7, 101.5, 100.4, 98.8, 102.6],
  [101.0, 99.2, 102.8, 100.3, 103.1],
  [102.5, 100.8, 99.6, 101.4, 98.7],
  [99.9, 103.2, 101.7, 100.2, 102.3],
  [101.3, 98.5, 100.9, 102.7, 99.4],
  [100.5, 102.0, 99.1, 101.8, 103.4],
  [103.3, 99.7, 101.6, 100.0, 98.9],
  [98.3, 101.4, 102.2, 99.6, 100.8],
  [102.6, 100.7, 98.4, 101.1, 103.0],
  [99.5, 101.9, 103.7, 100.4, 99.3],
]

const DEFAULT_SPEC = { USL: 120, LSL: 80, target: 100 }

const DEFAULT_ATTRIBUTE = Array.from({ length: 25 }, (_, i) => ({
  lot: i + 1, sampleSize: 200, defects: Math.floor(Math.random() * 8) + 1
}))

export default function DataInput({ onDataChange, currentData }) {
  const [activeTab, setActiveTab] = useState('variable')
  const [inputMode, setInputMode] = useState('table') // 'table' | 'paste' | 'csv'
  const [spec, setSpec] = useState(currentData?.spec || DEFAULT_SPEC)
  const [subgroups, setSubgroups] = useState(currentData?.subgroups || DEFAULT_SUBGROUPS)
  const [sgCount, setSgCount] = useState(currentData?.subgroups?.length || 25)
  const [sgSize, setSgSize] = useState(currentData?.subgroups?.[0]?.length || 5)
  const [pasteText, setPasteText] = useState('')
  const [attrData, setAttrData] = useState(currentData?.attrData || DEFAULT_ATTRIBUTE)
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState('')
  const [saved, setSaved] = useState(false)
  const fileRef = useRef()

  // Resize table when sgCount or sgSize changes
  const handleGridChange = (newCount, newSize) => {
    setSgCount(newCount)
    setSgSize(newSize)
    setSubgroups(prev => {
      const next = []
      for (let i = 0; i < newCount; i++) {
        const row = []
        for (let j = 0; j < newSize; j++) {
          row.push(prev[i]?.[j] ?? parseFloat((99 + Math.random() * 2).toFixed(2)))
        }
        next.push(row)
      }
      return next
    })
  }

  const handleCellChange = (i, j, val) => {
    setSubgroups(prev => {
      const next = prev.map(r => [...r])
      next[i][j] = parseFloat(val) || 0
      return next
    })
  }

  const handleParsePaste = () => {
    try {
      const rows = parsePasteData(pasteText)
      if (rows.length === 0) { setParseError('데이터를 인식할 수 없어요.'); return }
      setSubgroups(rows)
      setSgCount(rows.length)
      setSgSize(rows[0].length)
      setParseError('')
      setInputMode('table')
    } catch {
      setParseError('파싱 오류 — 행마다 숫자를 공백/쉼표/탭으로 구분해주세요.')
    }
  }

  const handleCSV = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const rows = parseSubgroupData(e.target.result)
        if (rows.length === 0) { setParseError('CSV에서 데이터를 읽을 수 없어요.'); return }
        setSubgroups(rows)
        setSgCount(rows.length)
        setSgSize(rows[0].length)
        setParseError('')
        setInputMode('table')
      } catch { setParseError('CSV 파싱 실패') }
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleCSV(file)
  }, [handleCSV])

  const handleAttrCell = (i, field, val) => {
    setAttrData(prev => prev.map((row, idx) =>
      idx === i ? { ...row, [field]: parseFloat(val) || 0 } : row
    ))
  }

  const addAttrRow = () => setAttrData(prev => [...prev, { lot: prev.length + 1, sampleSize: 200, defects: 3 }])
  const removeAttrRow = (i) => setAttrData(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = () => {
    const flatData = subgroups.flat()
    onDataChange({ subgroups, spec, attrData, flatData })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLoadDefault = () => {
    setSubgroups(DEFAULT_SUBGROUPS)
    setSgCount(25); setSgSize(5)
    setSpec(DEFAULT_SPEC)
    setAttrData(DEFAULT_ATTRIBUTE)
  }

  const specComplete = spec.USL && spec.LSL && spec.USL > spec.LSL

  return (
    <div className="data-input-page animate-slide-up">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <p className="section-label">Step 01</p>
          <h2 className="page-title">데이터 입력</h2>
          <p className="page-desc">공정 데이터와 규격을 설정하면 모든 분석이 자동으로 업데이트됩니다.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={handleLoadDefault}>샘플 데이터</button>
          <button className={`btn ${saved ? 'btn-saved' : 'btn-primary'}`} onClick={handleSave}>
            {saved ? '✓ 저장 완료' : '⊕ 분석 실행'}
          </button>
        </div>
      </div>

      {/* ── Spec Settings ── */}
      <div className="card spec-card">
        <div className="spec-header">
          <span className="section-heading">
            <span className="icon-badge">◎</span> 규격 설정 (Specification)
          </span>
          {!specComplete && <span className="badge badge--amber">⚠ USL &gt; LSL 확인 필요</span>}
          {specComplete && <span className="badge badge--green">✓ 규격 설정 완료</span>}
        </div>
        <div className="spec-grid">
          <div className="form-group">
            <label className="label">LSL — 규격 하한</label>
            <input className="input input-mono" type="number"
              value={spec.LSL} onChange={e => setSpec(p => ({...p, LSL: parseFloat(e.target.value)}))} />
          </div>
          <div className="form-group">
            <label className="label">Target — 목표값</label>
            <input className="input input-mono" type="number"
              value={spec.target} onChange={e => setSpec(p => ({...p, target: parseFloat(e.target.value)}))} />
          </div>
          <div className="form-group">
            <label className="label">USL — 규격 상한</label>
            <input className="input input-mono" type="number"
              value={spec.USL} onChange={e => setSpec(p => ({...p, USL: parseFloat(e.target.value)}))} />
          </div>
          <div className="spec-tolerance">
            <p className="section-label">허용한계 (Tolerance)</p>
            <p className="mono" style={{fontSize:'1.4rem', color:'var(--cyan)', fontWeight:700}}>
              ± {((spec.USL - spec.LSL) / 2).toFixed(2)}
            </p>
            <p style={{fontSize:'11px', color:'var(--text-muted)'}}>
              중심 = {((spec.USL + spec.LSL) / 2).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Data Type Tabs ── */}
      <div className="data-tabs">
        <button className={`data-tab ${activeTab==='variable'?'active':''}`} onClick={() => setActiveTab('variable')}>
          <span>∿</span> 계량형 데이터 (Variable)
        </button>
        <button className={`data-tab ${activeTab==='attribute'?'active':''}`} onClick={() => setActiveTab('attribute')}>
          <span>⊡</span> 계수형 데이터 (Attribute)
        </button>
      </div>

      {/* ── Variable Data ── */}
      {activeTab === 'variable' && (
        <div className="card animate-slide-up">
          <div className="variable-header">
            <span className="section-heading"><span className="icon-badge">⊞</span> 계량형 측정 데이터</span>
            <div className="input-mode-tabs">
              {['table','paste','csv'].map(m => (
                <button key={m} className={`mode-tab ${inputMode===m?'active':''}`} onClick={() => setInputMode(m)}>
                  {m === 'table' ? '표 입력' : m === 'paste' ? '붙여넣기' : 'CSV 업로드'}
                </button>
              ))}
            </div>
          </div>

          {/* Grid controls */}
          <div className="grid-controls">
            <div className="form-group" style={{flexDirection:'row', alignItems:'center', gap:'8px'}}>
              <label className="label" style={{whiteSpace:'nowrap', marginBottom:0}}>부분군 수</label>
              <input className="input input-mono" type="number" min="5" max="50"
                style={{width:'80px'}} value={sgCount}
                onChange={e => handleGridChange(parseInt(e.target.value)||5, sgSize)} />
            </div>
            <div className="form-group" style={{flexDirection:'row', alignItems:'center', gap:'8px'}}>
              <label className="label" style={{whiteSpace:'nowrap', marginBottom:0}}>부분군 크기</label>
              <select className="input input-mono" style={{width:'90px'}} value={sgSize}
                onChange={e => handleGridChange(sgCount, parseInt(e.target.value))}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="data-summary-pills">
              <span className="badge badge--cyan">총 {sgCount * sgSize}개 관측치</span>
              <span className="badge badge--purple">{sgCount}개 부분군 × {sgSize}개</span>
            </div>
          </div>

          {/* Table input */}
          {inputMode === 'table' && (
            <div className="table-wrapper data-table-scroll">
              <table className="data-table input-table">
                <thead>
                  <tr>
                    <th>부분군</th>
                    {Array.from({length: sgSize}, (_, j) => (
                      <th key={j}>x<sub>{j+1}</sub></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subgroups.slice(0, sgCount).map((row, i) => (
                    <tr key={i}>
                      <td className="sg-label">SG {i+1}</td>
                      {Array.from({length: sgSize}, (_, j) => (
                        <td key={j}>
                          <input
                            className="cell-input"
                            type="number"
                            value={row[j] ?? ''}
                            onChange={e => handleCellChange(i, j, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paste input */}
          {inputMode === 'paste' && (
            <div className="paste-section">
              <p className="paste-hint">
                행마다 하나의 부분군 — 값은 공백, 쉼표, 탭으로 구분<br/>
                <span style={{color:'var(--text-muted)'}}>예: 101.2 99.8 100.5 102.1 98.7</span>
              </p>
              <textarea
                className="input paste-textarea"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="데이터를 여기에 붙여넣으세요..."
                rows={10}
              />
              {parseError && <p className="parse-error">{parseError}</p>}
              <button className="btn btn-primary" onClick={handleParsePaste}>데이터 적용</button>
            </div>
          )}

          {/* CSV upload */}
          {inputMode === 'csv' && (
            <div
              className={`csv-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".csv,.txt" hidden
                onChange={e => { if(e.target.files[0]) handleCSV(e.target.files[0]) }} />
              <span className="dropzone-icon">⊞</span>
              <p className="dropzone-title">CSV 파일을 드래그하거나 클릭해서 업로드</p>
              <p className="dropzone-sub">행 = 부분군, 열 = 관측치 (헤더 없음)</p>
              {parseError && <p className="parse-error">{parseError}</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Attribute Data ── */}
      {activeTab === 'attribute' && (
        <div className="card animate-slide-up">
          <div className="variable-header">
            <span className="section-heading"><span className="icon-badge">⊡</span> 계수형 결함 데이터</span>
            <button className="btn btn-secondary" onClick={addAttrRow}>+ 행 추가</button>
          </div>
          <div className="table-wrapper data-table-scroll">
            <table className="data-table input-table">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>표본 크기 (n)</th>
                  <th>불량/결함 수</th>
                  <th>불량률 (p)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {attrData.map((row, i) => (
                  <tr key={i}>
                    <td className="sg-label">{row.lot}</td>
                    <td>
                      <input className="cell-input" type="number"
                        value={row.sampleSize}
                        onChange={e => handleAttrCell(i, 'sampleSize', e.target.value)} />
                    </td>
                    <td>
                      <input className="cell-input" type="number"
                        value={row.defects}
                        onChange={e => handleAttrCell(i, 'defects', e.target.value)} />
                    </td>
                    <td className={row.defects/row.sampleSize > 0.05 ? 'bad' : 'good'}>
                      {(row.defects / row.sampleSize * 100).toFixed(3)}%
                    </td>
                    <td>
                      <button className="btn btn-ghost" style={{padding:'4px 8px', fontSize:'12px'}}
                        onClick={() => removeAttrRow(i)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="attr-summary">
            <span className="badge badge--cyan">총 {attrData.length}개 로트</span>
            <span className="badge badge--purple">
              평균 불량률: {(attrData.reduce((s,r)=>s+r.defects,0)/attrData.reduce((s,r)=>s+r.sampleSize,0)*100).toFixed(3)}%
            </span>
          </div>
        </div>
      )}

      {/* ── Save button (bottom) ── */}
      <div className="save-bar">
        <div className="save-bar-info">
          <span className="status-dot status-dot--cyan" />
          <span style={{fontSize:'13px', color:'var(--text-secondary)'}}>
            데이터를 저장하면 공정능력분석과 관리도가 자동으로 업데이트됩니다.
          </span>
        </div>
        <button className={`btn ${saved ? 'btn-saved' : 'btn-primary'}`} onClick={handleSave}>
          {saved ? '✓ 저장 완료' : '⊕ 분석 실행'}
        </button>
      </div>
    </div>
  )
}
