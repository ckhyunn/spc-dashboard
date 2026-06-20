import { useState, useMemo } from 'react'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import DataInput from './pages/DataInput'
import ProcessCapability from './pages/Capability'
import SpcCharts from './pages/SpcCharts'
import AttributeCharts from './pages/AttributeCharts'
import { calcXbarR, applyNelsonRules, calcCapability, getProcessStatus, getViolatedIndices } from './utils/spcCalc'

// ── 멀티 공정 기본 데이터 ──────────────────────────────────
const INIT_PROCESSES = [
  {
    id: 0, name: '웨이퍼 두께 (μm)',
    spec: { USL: 505, LSL: 495, target: 500 }, n: 5,
    subgroups: [
      [499.8,500.2,499.9,500.1,500.0],[500.1,499.7,500.3,499.8,500.1],
      [500.0,500.2,499.8,500.1,499.9],[499.9,500.0,500.2,499.7,500.2],
      [500.2,499.9,500.0,500.3,499.8],[499.7,500.1,500.0,499.9,500.3],
      [500.1,500.0,499.8,500.2,500.0],[499.9,500.1,500.2,499.8,500.0],
      [500.0,500.3,499.7,500.1,499.9],[500.2,499.8,500.1,500.0,499.9],
      [500.3,500.1,500.4,500.2,500.3],[500.5,500.3,500.4,500.6,500.2],
      [500.6,500.4,500.7,500.5,500.3],[500.8,500.6,500.5,500.7,500.9],
      [501.0,500.8,500.9,501.1,500.7],[501.2,501.0,501.3,501.1,500.9],
      [500.1,499.9,500.2,500.0,500.1],[500.0,500.2,499.8,500.1,500.0],
      [499.9,500.1,500.0,500.2,499.8],[500.1,500.0,499.9,500.2,500.1],
      [499.8,500.1,500.2,499.9,500.0],[500.2,500.0,499.9,500.1,500.3],
      [499.9,500.2,500.0,500.1,499.8],[500.1,499.9,500.3,500.0,500.2],
      [503.8,500.1,499.9,500.2,500.0],[499.9,500.1,500.0,500.2,499.8],
      [500.0,500.2,499.9,500.1,500.0],[499.8,500.0,500.2,500.1,499.9],
      [500.1,499.9,500.0,500.2,500.1],[500.0,500.1,499.9,500.2,500.0],
    ],
    attrData: Array.from({length:20},(_,i)=>({lot:i+1,sampleSize:300,defects:[5,7,4,6,8,5,9,6,4,7,21,6,5,8,4,7,5,6,8,5][i]})),
  },
  {
    id: 1, name: '피스톤 직경 (mm)',
    spec: { USL: 80.15, LSL: 79.85, target: 80.00 }, n: 4,
    subgroups: [
      [80.02,80.05,79.98,80.03],[80.04,80.01,80.06,80.02],
      [80.03,80.05,80.02,80.04],[80.05,80.02,80.04,80.06],
      [80.03,80.06,80.04,80.05],[80.04,80.02,80.05,80.03],
      [80.05,80.03,80.06,80.04],[80.06,80.04,80.05,80.07],
      [80.05,80.07,80.06,80.04],[80.06,80.05,80.07,80.06],
      [80.07,80.05,80.06,80.08],[80.06,80.07,80.05,80.06],
      [80.07,80.06,80.08,80.05],[80.05,80.07,80.06,80.05],
      [80.06,80.05,80.07,80.06],[80.07,80.06,80.05,80.07],
      [80.06,80.08,80.05,80.07],[80.01,79.99,80.02,80.00],
      [80.00,80.02,79.99,80.01],[79.99,80.01,80.00,80.02],
      [80.01,80.00,79.99,80.01],[79.99,80.02,80.01,80.00],
      [80.17,80.02,80.01,79.99],[80.01,79.99,80.00,80.02],
      [80.00,80.01,79.99,80.01],
    ],
    attrData: Array.from({length:20},(_,i)=>({lot:i+1,sampleSize:50,defects:[1,2,1,3,2,1,3,2,9,2,1,3,2,1,2,3,1,2,3,1][i]})),
  },
  {
    id: 2, name: '저항값 (Ω)',
    spec: { USL: 102, LSL: 98, target: 100 }, n: 5,
    subgroups: [
      [101.2,99.1,101.3,98.9,101.1],[98.8,100.9,98.7,101.0,98.9],
      [101.3,98.8,101.2,98.9,101.4],[98.7,101.1,98.8,100.9,98.6],
      [101.2,98.9,101.1,98.8,101.3],[98.9,101.0,98.7,101.2,98.8],
      [101.1,98.9,101.3,98.7,101.0],[98.8,101.1,98.9,100.8,98.7],
      [101.0,98.8,101.2,98.9,101.1],[98.9,100.8,98.7,101.1,98.8],
      [100.1,99.8,100.2,99.9,100.1],[99.9,100.1,99.8,100.2,100.0],
      [100.0,100.2,99.9,100.1,99.8],[100.1,99.9,100.0,100.2,99.9],
      [99.8,100.1,100.0,100.2,99.9],[100.0,99.9,100.1,100.0,100.2],
      [99.8,99.6,99.9,99.7,99.8],   [99.5,99.3,99.6,99.4,99.5],
      [99.2,99.0,99.3,99.1,99.2],   [98.9,98.7,99.0,98.8,98.9],
      [98.6,98.4,98.7,98.5,98.6],   [98.3,98.1,98.4,98.2,98.3],
      [97.5,98.2,98.0,97.8,98.1],   [100.0,99.9,100.1,99.8,100.0],
      [100.1,100.0,99.9,100.1,100.2],
    ],
    attrData: Array.from({length:20},(_,i)=>({lot:i+1,sampleSize:200,defects:[3,4,2,5,3,4,12,3,2,4,3,5,2,4,3,2,4,3,5,3][i]})),
  },
  {
    id: 3, name: '음료 충전량 (mL)',
    spec: { USL: 503, LSL: 497, target: 500 }, n: 5,
    subgroups: [
      [500.1,499.8,500.3,499.9,500.2],[499.7,500.2,500.0,500.3,499.8],
      [500.2,500.0,499.9,500.1,500.3],[499.9,500.1,500.2,499.8,500.0],
      [500.3,499.9,500.1,500.0,499.7],[500.0,500.2,499.8,500.1,500.3],
      [499.8,500.1,500.0,500.2,499.9],[500.2,499.7,500.1,500.3,500.0],
      [499.9,500.2,500.1,499.8,500.0],[500.1,500.0,499.9,500.2,500.1],
      [499.8,500.1,500.3,500.0,499.9],[500.0,499.9,500.2,500.1,499.8],
      [500.2,500.1,499.9,500.0,500.3],[499.9,500.0,500.1,499.8,500.2],
      [500.1,500.2,499.9,500.0,500.1],[499.8,500.1,500.0,500.3,499.9],
      [500.0,499.9,500.2,500.1,500.0],[500.1,500.3,499.8,500.0,500.2],
      [499.9,500.1,500.0,500.2,499.8],[500.2,500.0,499.9,500.1,500.3],
      [499.8,500.2,500.1,499.9,500.0],[500.1,499.9,500.0,500.2,500.1],
      [499.9,500.1,500.3,499.8,500.0],[500.0,500.2,499.9,500.1,499.8],
      [500.1,500.0,500.2,499.9,500.1],
    ],
    attrData: Array.from({length:20},(_,i)=>({lot:i+1,sampleSize:300,defects:[2,3,1,2,4,2,1,3,2,1,2,3,1,2,3,2,1,2,3,2][i]})),
  },
]

export default function App() {
  const [page, setPage]           = useState('dashboard')
  const [processes, setProcesses] = useState(INIT_PROCESSES)
  const [currentProcId, setCurrentProcId] = useState(0)

  const currentProc = processes.find(p => p.id === currentProcId) || processes[0]

  // appData shape compatible with all existing pages
  const appData = useMemo(() => ({
    subgroups: currentProc.subgroups,
    spec:      currentProc.spec,
    attrData:  currentProc.attrData,
    flatData:  currentProc.subgroups.flat(),
    n:         currentProc.n,
  }), [currentProc])

  // per-process status for sidebar dots
  const processStatuses = useMemo(() =>
    processes.map(p => {
      const flat = p.subgroups.flat()
      if (!flat.length) return 'unknown'
      const cap = calcCapability(flat, p.subgroups, p.spec.USL, p.spec.LSL)
      const xbarR = calcXbarR ? calcXbarR(p.subgroups) : null
      const v = xbarR ? applyNelsonRules(xbarR.xBar.points, xbarR.xBar.CL, xbarR.xBar.UCL, xbarR.xBar.LCL) : []
      return getProcessStatus(cap, v)
    })
  , [processes])

  const processStatus = processStatuses[currentProcId] || 'unknown'

  const onDataChange = (newAppData) => {
    setProcesses(prev => prev.map(p =>
      p.id === currentProcId
        ? { ...p, subgroups: newAppData.subgroups, spec: newAppData.spec, attrData: newAppData.attrData }
        : p
    ))
  }

  const onRenameProcess = (id, newName) => {
    setProcesses(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p))
  }

  const renderPage = () => {
    switch(page) {
      case 'dashboard':  return <Dashboard appData={appData} onNavigate={setPage} processes={processes} processStatuses={processStatuses} />
      case 'data':       return <DataInput onDataChange={onDataChange} currentData={appData} />
      case 'capability': return <ProcessCapability appData={appData} />
      case 'spc':        return <SpcCharts appData={appData} />
      case 'attribute':  return <AttributeCharts appData={appData} />
      default:           return <Dashboard appData={appData} onNavigate={setPage} processes={processes} processStatuses={processStatuses} />
    }
  }

  return (
    <Layout
      activePage={page}
      onNavigate={setPage}
      processStatus={processStatus}
      processes={processes}
      processStatuses={processStatuses}
      currentProcId={currentProcId}
      onSelectProcess={setCurrentProcId}
      onRenameProcess={onRenameProcess}
      currentSpec={currentProc.spec}
      onSpecChange={(newSpec) => {
        setProcesses(prev => prev.map(p =>
          p.id === currentProcId ? { ...p, spec: newSpec } : p
        ))
      }}
      appData={appData}
    >
      {renderPage()}
    </Layout>
  )
}
