// ============================================================
//  SPC Calculation Utilities
//  Based on: 스마트제조_08_공정능력분석 + 스마트제조_09_통계적공정관리
// ============================================================

// ─── Unbiased constants table (c4, d2, d3, d4, A2, A3, B3, B4, D3, D4) ───
const UNBIASED = {
  // n: [c4,   d2,    d3,    d4,    A2,    A3,    B3,    B4,    D3,    D4]
  2:  [0.7979, 1.128, 0.853, 0.954, 1.880, 2.659, 0,     3.267, 0,     3.267],
  3:  [0.8862, 1.693, 0.888, 1.588, 1.023, 1.954, 0,     2.568, 0,     2.574],
  4:  [0.9213, 2.059, 0.880, 1.978, 0.729, 1.628, 0,     2.266, 0,     2.282],
  5:  [0.9400, 2.326, 0.864, 2.257, 0.577, 1.427, 0,     2.089, 0,     2.114],
  6:  [0.9515, 2.534, 0.848, 2.472, 0.483, 1.287, 0.030, 1.970, 0,     2.004],
  7:  [0.9594, 2.704, 0.833, 2.645, 0.419, 1.182, 0.118, 1.882, 0.076, 1.924],
  8:  [0.9650, 2.847, 0.820, 2.791, 0.373, 1.099, 0.185, 1.815, 0.136, 1.864],
  9:  [0.9693, 2.970, 0.808, 2.915, 0.337, 1.032, 0.239, 1.761, 0.184, 1.816],
  10: [0.9727, 3.078, 0.797, 3.024, 0.308, 0.975, 0.284, 1.716, 0.223, 1.777],
  15: [0.9823, 3.472, 0.756, 3.422, 0.223, 0.789, 0.347, 1.653, 0.347, 1.653],
  20: [0.9869, 3.735, 0.729, 3.686, 0.180, 0.680, 0.415, 1.585, 0.415, 1.585],
  25: [0.9896, 3.931, 0.708, 3.883, 0.153, 0.606, 0.459, 1.541, 0.459, 1.541],
}

function getUnbiasedConst(n, idx) {
  if (UNBIASED[n]) return UNBIASED[n][idx]
  // Linear interpolation for missing n
  const keys = Object.keys(UNBIASED).map(Number).sort((a, b) => a - b)
  const lo = keys.filter(k => k <= n).pop()
  const hi = keys.filter(k => k >= n)[0]
  if (!lo) return UNBIASED[keys[0]][idx]
  if (!hi) return UNBIASED[keys[keys.length - 1]][idx]
  if (lo === hi) return UNBIASED[lo][idx]
  const t = (n - lo) / (hi - lo)
  return UNBIASED[lo][idx] + t * (UNBIASED[hi][idx] - UNBIASED[lo][idx])
}

export const getC4 = (n) => getUnbiasedConst(n, 0)
export const getD2 = (n) => getUnbiasedConst(n, 1)
export const getD3 = (n) => getUnbiasedConst(n, 2)
export const getD4 = (n) => getUnbiasedConst(n, 3)
export const getA2 = (n) => getUnbiasedConst(n, 4)
export const getA3 = (n) => getUnbiasedConst(n, 5)
export const getB3 = (n) => getUnbiasedConst(n, 6)
export const getB4 = (n) => getUnbiasedConst(n, 7)
export const getD3v = (n) => getUnbiasedConst(n, 8)
export const getD4v = (n) => getUnbiasedConst(n, 9)

// ─── Basic statistics ───────────────────────────────────────
export function mean(arr) {
  if (!arr || arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

export function std(arr, ddof = 1) {
  if (!arr || arr.length <= 1) return 0
  const m = mean(arr)
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - ddof)
  return Math.sqrt(variance)
}

export function range(arr) {
  if (!arr || arr.length === 0) return 0
  return Math.max(...arr) - Math.min(...arr)
}

// ─── Normality test: Shapiro-Wilk approximation ─────────────
// Returns { stat, pValue, isNormal }
export function shapiroWilk(data) {
  const n = data.length
  if (n < 3) return { stat: 1, pValue: 1, isNormal: true }

  const sorted = [...data].sort((a, b) => a - b)
  const m = mean(sorted)

  // W statistic approximation
  let num = 0, den = 0
  const half = Math.floor(n / 2)

  // Simplified a-coefficients (approximation)
  for (let i = 0; i < half; i++) {
    const a_i = 0.5 / Math.sqrt(n) * (1 + (n - 2 * i - 1) / n)
    num += a_i * (sorted[n - 1 - i] - sorted[i])
  }
  for (let i = 0; i < n; i++) den += (sorted[i] - m) ** 2

  const W = den === 0 ? 1 : Math.min(1, (num * num) / den)

  // p-value approximation using normal distribution
  const mu = -1.2725 + 1.0521 * Math.log(n)
  const sigma = Math.max(0.1, 1.0308 - 0.26763 * Math.log(n))
  const z = (Math.log(1 - W) - mu) / sigma
  const pValue = 1 - normalCDF(z)

  return { stat: W, pValue: Math.max(0.001, Math.min(0.999, pValue)), isNormal: pValue >= 0.05 }
}

function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
  const cdf = 1 - phi * poly
  return z >= 0 ? cdf : 1 - cdf
}

// Normal PDF
export function normalPDF(x, mu, sigma) {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))
}

// ─── Process Capability ─────────────────────────────────────
// data: flat array, subgroups: array of arrays, USL/LSL/target: numbers
export function calcCapability(data, subgroups, USL, LSL) {
  if (!data || data.length === 0) return null

  const xBar = mean(data)
  const n = data.length
  const k = subgroups.length

  // sigma_overall: Pp/Ppk 용
  const s_hat = std(data, 1)
  const c4_n = getC4(n)
  const sigma_overall = s_hat / c4_n

  // sigma_within: Cp/Cpk 용 (합동표준편차 pooled std)
  const subgroupSizes = subgroups.map(sg => sg.length)
  const subgroupMeans = subgroups.map(sg => mean(sg))
  const subgroupStds  = subgroups.map(sg => std(sg, 1))

  // pooled standard deviation
  const sp_num = subgroups.reduce((sum, sg) => {
    const si = std(sg, 1)
    return sum + (sg.length - 1) * si * si
  }, 0)
  const sp_den = subgroups.reduce((sum, sg) => sum + (sg.length - 1), 0)
  const sp = Math.sqrt(sp_num / Math.max(sp_den, 1))

  const d_pooled = n - k + 1
  const c4_d = getC4(Math.max(2, d_pooled))
  const sigma_within = sp / c4_d

  // Cp, Cpk
  const Cp  = (USL - LSL) / (6 * sigma_within)
  const CPU = (USL - xBar) / (3 * sigma_within)
  const CPL = (xBar - LSL) / (3 * sigma_within)
  const Cpk = Math.min(CPU, CPL)

  // Pp, Ppk
  const Pp  = (USL - LSL) / (6 * sigma_overall)
  const PPU = (USL - xBar) / (3 * sigma_overall)
  const PPL = (xBar - LSL) / (3 * sigma_overall)
  const Ppk = Math.min(PPU, PPL)

  // PPM (defect estimate)
  const zUSL = (USL - xBar) / sigma_overall
  const zLSL = (xBar - LSL) / sigma_overall
  const pDefect = (1 - normalCDF(zUSL)) + normalCDF(-zLSL)
  const PPM = pDefect * 1_000_000

  return {
    xBar, sigma_within, sigma_overall, sp,
    Cp, Cpk, CPU, CPL,
    Pp, Ppk, PPU, PPL,
    PPM: Math.round(PPM),
    subgroupMeans, subgroupStds, subgroupSizes,
    n, k
  }
}

// Cp grade judgment (강의록 08 판정기준)
export function capabilityGrade(cp) {
  if (cp >= 1.67) return { grade: 0, label: '매우 충분', color: 'green',  desc: '공정능력은 매우 충분' }
  if (cp >= 1.33) return { grade: 1, label: '충분',     color: 'green',  desc: '공정능력은 충분' }
  if (cp >= 1.00) return { grade: 2, label: '보통',     color: 'amber',  desc: '공정능력이 충분하지 않지만 그 정도면 괜찮다' }
  if (cp >= 0.67) return { grade: 3, label: '모자람',   color: 'amber',  desc: '공정능력이 모자란다' }
  return             { grade: 4, label: '매우 부족', color: 'red',    desc: '공정능력이 매우 부족하다' }
}

// Q-Q plot data
export function qqPlotData(data) {
  const sorted = [...data].sort((a, b) => a - b)
  const n = sorted.length
  const m = mean(sorted)
  const s = std(sorted, 1)
  return sorted.map((val, i) => {
    const p = (i + 0.5) / n
    const theoretical = m + s * probit(p)
    return { x: theoretical, y: val }
  })
}

// Probit function (inverse normal CDF approximation)
function probit(p) {
  if (p <= 0) return -4; if (p >= 1) return 4
  const a = [2.515517, 0.802853, 0.010328]
  const b = [1.432788, 0.189269, 0.001308]
  const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p))
  const num = a[0] + a[1] * t + a[2] * t * t
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t
  const result = t - num / den
  return p < 0.5 ? -result : result
}

// ─── Control Chart Calculations ─────────────────────────────

// Xbar-R chart
export function calcXbarR(subgroups) {
  const n = subgroups[0]?.length || 5
  const A2 = getA2(n), D3 = getD3v(n), D4 = getD4v(n)

  const xBars = subgroups.map(sg => mean(sg))
  const Rs    = subgroups.map(sg => range(sg))

  const xBarBar = mean(xBars)
  const Rbar    = mean(Rs)

  return {
    type: 'Xbar-R',
    xBar: { points: xBars, CL: xBarBar, UCL: xBarBar + A2 * Rbar, LCL: xBarBar - A2 * Rbar },
    R:    { points: Rs,    CL: Rbar,    UCL: D4 * Rbar,          LCL: Math.max(0, D3 * Rbar) },
    n, xBarBar, Rbar,
  }
}

// Xbar-S chart
export function calcXbarS(subgroups) {
  const n = subgroups[0]?.length || 5
  const A3 = getA3(n), B3 = getB3(n), B4 = getB4(n)

  const xBars = subgroups.map(sg => mean(sg))
  const ss    = subgroups.map(sg => std(sg, 1))

  const xBarBar = mean(xBars)
  const sBar    = mean(ss)

  return {
    type: 'Xbar-S',
    xBar: { points: xBars, CL: xBarBar, UCL: xBarBar + A3 * sBar, LCL: xBarBar - A3 * sBar },
    s:    { points: ss,    CL: sBar,    UCL: B4 * sBar,           LCL: Math.max(0, B3 * sBar) },
    n, xBarBar, sBar,
  }
}

// I-MR chart
export function calcIMR(data, w = 2) {
  const I = [...data]
  const n = I.length
  const d2 = getD2(w)
  const D3 = getD3(w), D4 = getD4(w)

  // Moving range
  const MRs = []
  for (let i = w - 1; i < n; i++) {
    const window = I.slice(i - w + 1, i + 1)
    MRs.push(range(window))
  }

  const xBar = mean(I)
  const MRbar = mean(MRs)

  const E2 = 3 / d2  // = 3/d2(w)

  return {
    type: 'I-MR',
    I:  { points: I,   CL: xBar,  UCL: xBar + E2 * MRbar,       LCL: xBar - E2 * MRbar },
    MR: { points: MRs, CL: MRbar, UCL: D4 * MRbar, LCL: Math.max(0, D3 * MRbar) },
    w, xBar, MRbar,
  }
}

// ─── Nelson Rules ────────────────────────────────────────────
// Returns array of { ruleNo, points: [indices], description }
export function applyNelsonRules(points, CL, UCL, LCL) {
  const n = points.length
  const sigma = (UCL - CL) / 3
  if (sigma <= 0) return []

  const violations = []

  // Helper: sigma zone
  const zone = (v) => {
    const d = (v - CL) / sigma
    if (d > 3 || d < -3) return null  // out of bounds
    if (d > 2)  return '+A'
    if (d > 1)  return '+B'
    if (d >= 0) return '+C'
    if (d < -2) return '-A'
    if (d < -1) return '-B'
    return '-C'
  }

  // Rule 1: 1 point beyond 3σ
  points.forEach((v, i) => {
    if (v > UCL || v < LCL) violations.push({ ruleNo: 1, points: [i], description: 'Rule 1: 관리한계 이탈 (±3σ)' })
  })

  // Rule 2: 9 consecutive same side
  for (let i = 8; i < n; i++) {
    const run = points.slice(i - 8, i + 1)
    if (run.every(v => v > CL) || run.every(v => v < CL))
      violations.push({ ruleNo: 2, points: Array.from({length:9}, (_,k) => i-8+k), description: 'Rule 2: 9점 연속 중심선 한쪽' })
  }

  // Rule 3: 6 consecutive monotone
  for (let i = 5; i < n; i++) {
    const run = points.slice(i - 5, i + 1)
    const asc  = run.every((v,j) => j === 0 || v > run[j-1])
    const desc = run.every((v,j) => j === 0 || v < run[j-1])
    if (asc || desc)
      violations.push({ ruleNo: 3, points: Array.from({length:6}, (_,k) => i-5+k), description: 'Rule 3: 6점 연속 증가/감소' })
  }

  // Rule 4: 14 alternating
  for (let i = 13; i < n; i++) {
    const run = points.slice(i - 13, i + 1)
    const alt = run.every((v,j) => j === 0 || (j%2===1 ? v > run[j-1] : v < run[j-1])) ||
                run.every((v,j) => j === 0 || (j%2===1 ? v < run[j-1] : v > run[j-1]))
    if (alt)
      violations.push({ ruleNo: 4, points: Array.from({length:14}, (_,k) => i-13+k), description: 'Rule 4: 14점 교대 증감' })
  }

  // Rule 5: 2 of 3 beyond 2σ same side
  for (let i = 2; i < n; i++) {
    const run = points.slice(i - 2, i + 1)
    const beyondPlus  = run.filter(v => v > CL + 2 * sigma).length
    const beyondMinus = run.filter(v => v < CL - 2 * sigma).length
    if (beyondPlus >= 2 || beyondMinus >= 2)
      violations.push({ ruleNo: 5, points: Array.from({length:3}, (_,k) => i-2+k), description: 'Rule 5: 3점 중 2점 ±2σ 초과 (같은 쪽)' })
  }

  // Rule 6: 4 of 5 beyond 1σ same side
  for (let i = 4; i < n; i++) {
    const run = points.slice(i - 4, i + 1)
    const beyondPlus  = run.filter(v => v > CL + sigma).length
    const beyondMinus = run.filter(v => v < CL - sigma).length
    if (beyondPlus >= 4 || beyondMinus >= 4)
      violations.push({ ruleNo: 6, points: Array.from({length:5}, (_,k) => i-4+k), description: 'Rule 6: 5점 중 4점 ±1σ 초과' })
  }

  // Rule 7: 15점 연속 ±1σ 내 — 구간 단위로만 탐지
  {
    let runStart = -1
    for (let i = 0; i < n; i++) {
      if (Math.abs(points[i] - CL) < sigma) {
        if (runStart === -1) runStart = i
        if (i - runStart + 1 >= 15) {
          const already = violations.some(v => v.ruleNo === 7 && v.points[0] === runStart)
          if (!already) violations.push({ ruleNo: 7, points: Array.from({length: i - runStart + 1}, (_,k) => runStart+k), description: 'Rule 7: 15점 연속 ±1σ 내' })
        }
      } else {
        runStart = -1
      }
    }
  }

  // Rule 8: 8점 연속 ±1σ 밖 — 구간 단위로만 탐지
  {
    let runStart = -1
    for (let i = 0; i < n; i++) {
      if (Math.abs(points[i] - CL) > sigma) {
        if (runStart === -1) runStart = i
        if (i - runStart + 1 >= 8) {
          const already = violations.some(v => v.ruleNo === 8 && v.points[0] === runStart)
          if (!already) violations.push({ ruleNo: 8, points: Array.from({length: i - runStart + 1}, (_,k) => runStart+k), description: 'Rule 8: 8점 연속 ±1σ 밖' })
        }
      } else {
        runStart = -1
      }
    }
  }

  // 최종 중복 제거
  const seen = new Set()
  return violations.filter(v => {
    const key = `${v.ruleNo}-${v.points[0]}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}

// Get all violated point indices
export function getViolatedIndices(violations) {
  const set = new Set()
  violations.forEach(v => v.points.forEach(i => set.add(i)))
  return set
}

// ─── Attribute Charts ────────────────────────────────────────

// P chart (불량률)
export function calcPChart(defects, sampleSizes) {
  const k = defects.length
  const pBar = defects.reduce((s,d) => s+d, 0) / sampleSizes.reduce((s,n) => s+n, 0)
  const points = defects.map((d, i) => d / sampleSizes[i])
  const UCL_arr = sampleSizes.map(n => pBar + 3 * Math.sqrt(pBar * (1 - pBar) / n))
  const LCL_arr = sampleSizes.map(n => Math.max(0, pBar - 3 * Math.sqrt(pBar * (1 - pBar) / n)))

  return {
    type: 'P',
    points,
    CL: pBar,
    UCL_arr, LCL_arr,
    UCL: pBar + 3 * Math.sqrt(pBar * (1 - pBar) / mean(sampleSizes)),
    LCL: Math.max(0, pBar - 3 * Math.sqrt(pBar * (1 - pBar) / mean(sampleSizes))),
    pBar,
  }
}

// NP chart (불량개수)
export function calcNPChart(defects, sampleSizes) {
  // Assumes constant sample size
  const n = mean(sampleSizes)
  const npBar = mean(defects)
  const pBar = npBar / n

  return {
    type: 'NP',
    points: defects,
    CL:  npBar,
    UCL: npBar + 3 * Math.sqrt(npBar * (1 - pBar)),
    LCL: Math.max(0, npBar - 3 * Math.sqrt(npBar * (1 - pBar))),
    npBar, pBar, n,
  }
}

// ─── Data parsing ────────────────────────────────────────────

// Parse wide-format CSV → subgroups array
// e.g. each row = one subgroup, columns = observations
export function parseSubgroupData(csvText) {
  const lines = csvText.trim().split('\n').filter(l => l.trim())
  const subgroups = []
  for (const line of lines) {
    const vals = line.split(/[,\t]/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    if (vals.length > 0) subgroups.push(vals)
  }
  return subgroups
}

// Parse paste data (space/tab/comma separated)
export function parsePasteData(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const data = []
  for (const line of lines) {
    const vals = line.split(/[\s,\t]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    if (vals.length > 0) data.push(vals)
  }
  return data
}

// ─── Summary for Dashboard ───────────────────────────────────
export function getProcessStatus(cap, violations) {
  if (!cap) return 'unknown'
  const minCap = Math.min(cap.Cp, cap.Cpk)
  const hasViolation = violations && violations.length > 0
  if (minCap < 1.0 || hasViolation) return 'bad'
  if (minCap < 1.33) return 'warning'
  return 'good'
}

// ─── Cpm (Taguchi capability index) ────────────────────────
export function calcCpm(data, USL, LSL, target) {
  if (!data || data.length === 0) return 0
  const xBar = mean(data)
  const n = data.length
  const sigma = std(data, 1)
  const sigmaCpm = Math.sqrt(sigma ** 2 + (xBar - target) ** 2)
  return (USL - LSL) / (6 * sigmaCpm)
}

// ─── Skewness & Kurtosis ────────────────────────────────────
export function calcSkewness(data) {
  const n = data.length
  if (n < 3) return 0
  const m = mean(data)
  const s = std(data, 1)
  if (s === 0) return 0
  const s3 = data.reduce((a, v) => a + ((v - m) / s) ** 3, 0)
  return (n / ((n - 1) * (n - 2))) * s3
}

export function calcKurtosis(data) {
  const n = data.length
  if (n < 4) return 0
  const m = mean(data)
  const s = std(data, 1)
  if (s === 0) return 0
  const s4 = data.reduce((a, v) => a + ((v - m) / s) ** 4, 0)
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * s4 - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
}

export function normalityTest(data) {
  const skew = calcSkewness(data)
  const kurt = calcKurtosis(data)
  const n = data.length
  const skewOk = Math.abs(skew) < 0.5
  const skewWarn = Math.abs(skew) < 1.0
  const kurtOk = Math.abs(kurt) < 1.0
  const kurtWarn = Math.abs(kurt) < 2.0
  const skewScore = Math.max(0, 100 - Math.abs(skew) * 60)
  const kurtScore = Math.max(0, 100 - Math.abs(kurt) * 30)
  const totalScore = Math.round((skewScore + kurtScore) / 2)
  return {
    skew, kurt, n,
    skewOk, skewWarn, kurtOk, kurtWarn,
    totalScore,
    isNormal: totalScore >= 75,
    label: totalScore >= 75 ? '정규성 만족' : totalScore >= 50 ? '정규성 주의' : '정규성 불만족',
    color: totalScore >= 75 ? 'green' : totalScore >= 50 ? 'amber' : 'red',
  }
}

// ─── Nelson violation detail (for lot table) ─────────────────
export const NELSON_RULE_DESC = {
  1: { short: '관리이탈',   full: '관리한계(±3σ) 이탈 — 이상원인에 의한 급격한 변동',      severity: 'high' },
  2: { short: '중심선편중', full: '연속 9점 중심선 한쪽 집중 — 공정 평균 이동 또는 편향',   severity: 'mid'  },
  3: { short: '단조추세',   full: '연속 6점 단조 증가 또는 감소 — 공정 평균 점진적 드리프트', severity: 'mid' },
  4: { short: '교대패턴',   full: '연속 14점 교대 증감 — 주기적 패턴(설비·재료 교대 등)',   severity: 'mid'  },
  5: { short: '±2σ이탈',   full: '3점 중 2점이 ±2σ 초과(같은 방향) — 공정 분산 급격 증가', severity: 'mid' },
  6: { short: '±1σ이탈',   full: '5점 중 4점이 ±1σ 초과(같은 방향) — 공정 평균 서서히 이동', severity: 'low' },
  7: { short: '과도안정',   full: '연속 15점 모두 ±1σ 이내 — 데이터 조작 의심 또는 측정 오류', severity: 'low' },
  8: { short: '±1σ외부',   full: '연속 8점 모두 ±1σ 바깥(양쪽) — 두 분포 혼재 또는 공정 분리', severity: 'low' },
}
