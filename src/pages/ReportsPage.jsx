import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import Sidebar from '../components/Sidebar'

/* ──────────────────────────── Chart Helpers ──────────────────────────── */

const CHART_COLORS = [
  '#2563eb', '#f59e0b', '#10b981', '#6366f1', '#f97316',
  '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6', '#ef4444',
]

function drawBarChart(canvas, labels, datasets, title) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  const w = rect.width
  const h = rect.height

  ctx.clearRect(0, 0, w, h)

  const padding = { top: 45, right: 20, bottom: 40, left: 50 }
  const chartW = w - padding.left - padding.right
  const chartH = h - padding.top - padding.bottom

  // Title
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 15px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, w / 2, 28)

  if (!labels.length) {
    ctx.fillStyle = '#64748b'
    ctx.font = '13px Inter, system-ui, sans-serif'
    ctx.fillText('No data available', w / 2, h / 2)
    return
  }

  const allValues = datasets.flatMap(d => d.data)
  const maxVal = Math.max(...allValues, 1)

  // Grid
  const gridCount = 4
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'
  ctx.lineWidth = 1
  ctx.fillStyle = '#64748b'
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textAlign = 'right'

  for (let i = 0; i <= gridCount; i++) {
    const y = padding.top + chartH - (i / gridCount) * chartH
    const val = (i / gridCount) * maxVal
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(w - padding.right, y)
    ctx.stroke()
    ctx.fillText(Math.round(val).toLocaleString(), padding.left - 10, y + 4)
  }

  // Bars
  const groupWidth = chartW / labels.length
  const barWidth = Math.min(groupWidth * 0.7 / datasets.length, 32)
  const totalBarsWidth = barWidth * datasets.length
  const groupOffset = (groupWidth - totalBarsWidth) / 2

  datasets.forEach((dataset, di) => {
    dataset.data.forEach((val, i) => {
      const barH = (val / maxVal) * chartH
      const x = padding.left + i * groupWidth + groupOffset + di * barWidth
      const y = padding.top + chartH - barH

      const gradient = ctx.createLinearGradient(x, y, x, y + barH)
      gradient.addColorStop(0, dataset.color || CHART_COLORS[di])
      gradient.addColorStop(1, (dataset.color || CHART_COLORS[di]) + '90')
      ctx.fillStyle = gradient

      const r = Math.min(6, barWidth / 2)
      ctx.beginPath()
      ctx.moveTo(x, y + barH)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.lineTo(x + barWidth - r, y)
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r)
      ctx.lineTo(x + barWidth, y + barH)
      ctx.closePath()
      ctx.fill()
    })
  })

  // Labels
  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  labels.forEach((label, i) => {
    const x = padding.left + i * groupWidth + groupWidth / 2
    ctx.fillText(label, x, h - 12)
  })
}

function drawDoughnutChart(canvas, labels, data, colors, title) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  const w = rect.width
  const h = rect.height

  ctx.clearRect(0, 0, w, h)

  // Title
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 15px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, w / 2, 28)

  const total = data.reduce((s, v) => s + v, 0)
  if (!total) {
    ctx.fillStyle = '#64748b'
    ctx.font = '13px Inter, system-ui, sans-serif'
    ctx.fillText('No data available', w / 2, h / 2)
    return
  }

  const cx = w / 2
  const cy = (h / 2) - 10
  const outerR = Math.min(cx, cy) - 40
  const innerR = outerR * 0.65

  let startAngle = -Math.PI / 2
  data.forEach((val, i) => {
    const sliceAngle = (val / total) * Math.PI * 2
    
    // Slice path
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle)
    ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true)
    ctx.closePath()
    
    // Gradient fill
    const sliceMidAngle = startAngle + sliceAngle / 2
    const gradient = ctx.createLinearGradient(
      cx + Math.cos(startAngle) * innerR,
      cy + Math.sin(startAngle) * innerR,
      cx + Math.cos(startAngle + sliceAngle) * outerR,
      cy + Math.sin(startAngle + sliceAngle) * outerR
    )
    gradient.addColorStop(0, colors[i % colors.length])
    gradient.addColorStop(1, colors[i % colors.length] + 'dd')
    
    ctx.fillStyle = gradient
    ctx.fill()
    
    // Slice border (for separation)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2
    ctx.stroke()
    
    startAngle += sliceAngle
  })

  // Center visual
  // Outer circle for the hole
  ctx.beginPath()
  ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2)
  ctx.fillStyle = '#1e293b'
  ctx.fill()

  // Center text
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 24px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(total.toLocaleString(), cx, cy + 5)
  
  ctx.fillStyle = '#94a3b8'
  ctx.font = '600 10px Inter, system-ui, sans-serif'
  ctx.fillText('TASKS', cx, cy + 20)

  // Legend
  const legendY = h - 45
  const totalItems = Math.min(labels.length, 6)
  const itemsPerRow = 2
  const rowCount = Math.ceil(totalItems / itemsPerRow)
  const totalLegendH = rowCount * 22
  
  labels.forEach((label, i) => {
    if (i >= 6) return
    const row = Math.floor(i / itemsPerRow)
    const col = i % itemsPerRow
    
    // Calculate centering for the row
    const rowItemsCount = (row === rowCount - 1) ? (totalItems % itemsPerRow || itemsPerRow) : itemsPerRow
    const itemWidth = 130
    const rowW = rowItemsCount * itemWidth
    const startX = (w - rowW) / 2
    
    const lx = startX + col * itemWidth
    const ly = legendY + row * 22
    
    // Color dot
    ctx.beginPath()
    ctx.arc(lx + 6, ly - 4, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = colors[i % colors.length]
    ctx.fill()
    
    // Label
    const cleanLabel = label.replace(/([A-Z])/g, ' $1').trim()
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '600 11.5px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${cleanLabel} (${data[i]})`, lx + 18, ly)
  })
}

function drawLineChart(canvas, labels, data, color, title) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  const w = rect.width
  const h = rect.height

  ctx.clearRect(0, 0, w, h)

  const padding = { top: 45, right: 30, bottom: 40, left: 50 }
  const chartW = w - padding.left - padding.right
  const chartH = h - padding.top - padding.bottom

  // Title
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 15px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, w / 2, 28)

  if (!data.length) {
    ctx.fillStyle = '#64748b'
    ctx.font = '13px Inter, system-ui, sans-serif'
    ctx.fillText('No data available', w / 2, h / 2)
    return
  }

  const maxVal = Math.max(...data, 1)

  // Grid
  const gridCount = 4
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'
  ctx.lineWidth = 1
  ctx.fillStyle = '#64748b'
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textAlign = 'right'

  for (let i = 0; i <= gridCount; i++) {
    const y = padding.top + chartH - (i / gridCount) * chartH
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(w - padding.right, y)
    ctx.stroke()
    ctx.fillText(Math.round((i / gridCount) * maxVal).toLocaleString(), padding.left - 10, y + 4)
  }

  const points = data.map((val, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padding.top + chartH - (val / maxVal) * chartH,
  }))

  // Area
  const areaGradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
  areaGradient.addColorStop(0, color + '30')
  areaGradient.addColorStop(1, color + '00')
  
  ctx.beginPath()
  ctx.moveTo(points[0].x, padding.top + chartH)
  points.forEach((p, i) => {
    if (i === 0) ctx.lineTo(p.x, p.y)
    else {
      const prev = points[i - 1]
      const cp1x = prev.x + (p.x - prev.x) / 2
      ctx.bezierCurveTo(cp1x, prev.y, cp1x, p.y, p.x, p.y)
    }
  })
  ctx.lineTo(points[points.length - 1].x, padding.top + chartH)
  ctx.closePath()
  ctx.fillStyle = areaGradient
  ctx.fill()

  // Line
  ctx.beginPath()
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else {
      const prev = points[i - 1]
      const cp1x = prev.x + (p.x - prev.x) / 2
      ctx.bezierCurveTo(cp1x, prev.y, cp1x, p.y, p.x, p.y)
    }
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.stroke()

  // Points
  points.forEach(p => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
  })

  // Labels
  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  labels.forEach((label, i) => {
    const x = padding.left + (i / Math.max(labels.length - 1, 1)) * chartW
    ctx.fillText(label, x, h - 12)
  })
}

/* ──────────────────────────── CSV Export Helper ──────────────────────────── */

function downloadCSV(filename, headers, rows) {
  const escape = (val) => {
    const str = String(val ?? '')
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }

  const csv = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(','))
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/* ──────────────────────────── Activity Icons ──────────────────────────── */

const ACTIVITY_ICONS = {
  task_created: '📋',
  task_assigned: '🤝',
  review_submitted: '⭐',
  user_registered: '👤',
}

const ACTIVITY_LABELS = {
  task_created: 'Task Created',
  task_assigned: 'Task Assigned',
  review_submitted: 'Review',
  user_registered: 'User Joined',
}

/* ──────────────────────────── Component ──────────────────────────── */

function ReportsPage({hasUnreadNotifications = false}) {
  const { user, logout: onLogout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('summary')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [activities, setActivities] = useState([])

  const [txSearch, setTxSearch] = useState('')
  const [txFilter, setTxFilter] = useState('all')
  const [actFilter, setActFilter] = useState('all')

  // Check if user is admin
  useEffect(() => {
    const userVal = user?.IsAdmin ?? user?.isAdmin
    const isAdmin = Number(userVal) === 1 || userVal === true || String(userVal) === '1'
    if (!isAdmin) {
      navigate('/home')
      return
    }
  }, [user, navigate])

  // Chart refs
  const barChartRef = useRef(null)
  const doughnutChartRef = useRef(null)
  const lineChartRef = useRef(null)
  const categoryChartRef = useRef(null)

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [summaryData, txData, actData] = await Promise.all([
        api.getReportsSummary(),
        api.getTransactions(),
        api.getActivityLogs(),
      ])
      setSummary(summaryData)
      setTransactions(Array.isArray(txData) ? txData : [])
      setActivities(Array.isArray(actData) ? actData : [])
    } catch (err) {
      setError(err.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  // Draw charts when summary data is ready and tab is visible
  const drawCharts = useCallback(() => {
    if (!summary) return

    // Bar chart – Tasks per Month
    const monthLabels = (summary.tasksByMonth || []).map(m => {
      const [y, mo] = m.month.split('-')
      const d = new Date(Number(y), Number(mo) - 1)
      return d.toLocaleString('default', { month: 'short' })
    })
    const monthData = (summary.tasksByMonth || []).map(m => Number(m.count || m.Count || 0))
    const monthBudget = (summary.tasksByMonth || []).map(m => Number(m.totalBudget || m.TotalBudget || 0))

    drawBarChart(barChartRef.current, monthLabels, [
      { label: 'Tasks', data: monthData, color: '#10b981' },
    ], 'Tasks Created per Month')

    // Doughnut – Status Distribution
    const statusOrder = ['open', 'waiting', 'completed', 'assigned', 'cancelled']
    const rawStatusList = summary.tasksByStatus || []
    
    // Sort logic to ensure Completed is left, Open is right
    const sortedStatusList = [...rawStatusList].sort((a, b) => {
      const aS = String(a.status || a.Status || '').toLowerCase()
      const bS = String(b.status || b.Status || '').toLowerCase()
      const aIdx = statusOrder.findIndex(o => aS.includes(o))
      const bIdx = statusOrder.findIndex(o => bS.includes(o))
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
    })

    const statusLabels = sortedStatusList.map(s => s.status || s.Status || 'Unknown')
    const statusData = sortedStatusList.map(s => Number(s.count || s.Count || 0))
    const statusColors = statusLabels.map(s => {
      const lower = s.toLowerCase()
      if (lower.includes('completed') || lower.includes('done')) return '#f59e0b' // Completed (Yellow)
      if (lower.includes('assigned') || lower.includes('progress')) return '#3b82f6' // In Progress (Blue)
      if (lower.includes('open') || lower.includes('waiting')) return '#10b981' // Open (Green)
      if (lower.includes('cancelled')) return '#ef4444' // Cancelled (Red)
      return '#8b5cf6'
    })

    drawDoughnutChart(doughnutChartRef.current, statusLabels, statusData, statusColors, 'Task Status Distribution')

    // Line chart – User Growth
    const userLabels = (summary.usersByMonth || []).map(m => {
      const [y, mo] = (m.month || m.Month || '').split('-')
      if (!y || !mo) return 'Unknown'
      const d = new Date(Number(y), Number(mo) - 1)
      return d.toLocaleString('default', { month: 'short' })
    })
    const userData = (summary.usersByMonth || []).map(m => Number(m.count || m.Count || 0))
    drawLineChart(lineChartRef.current, userLabels, userData, '#3b82f6', 'User Registrations per Month')

    // Category bar chart
    const catLabels = (summary.tasksByCategory || []).map(c => c.category || c.Category || 'Unknown')
    const catData = (summary.tasksByCategory || []).map(c => Number(c.count || c.Count || 0))
    drawBarChart(categoryChartRef.current, catLabels, [
      { label: 'Tasks', data: catData, color: '#8b5cf6' },
    ], 'Tasks by Category')
  }, [summary])

  useEffect(() => {
    if (activeTab === 'summary' && summary) {
      // Small delay for DOM rendering
      requestAnimationFrame(() => drawCharts())
    }
  }, [activeTab, summary, drawCharts])

  // Resize handler
  useEffect(() => {
    function handleResize() {
      if (activeTab === 'summary' && summary) {
        drawCharts()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeTab, summary, drawCharts])

  // Filtered transactions
  const filteredTx = transactions.filter(tx => {
    const matchSearch = txSearch.trim() === '' ||
      (tx.TaskTitle || '').toLowerCase().includes(txSearch.toLowerCase()) ||
      (tx.PosterName || '').toLowerCase().includes(txSearch.toLowerCase()) ||
      (tx.HelperName || '').toLowerCase().includes(txSearch.toLowerCase())
    const matchFilter = txFilter === 'all' || tx.Status === txFilter
    return matchSearch && matchFilter
  })

  // Filtered activities
  const filteredAct = activities.filter(a => {
    return actFilter === 'all' || a.type === actFilter
  })

  // Export handlers
  function exportSummaryCSV() {
    if (!summary?.stats) return
    const s = summary.stats
    downloadCSV('gawahelper_summary_report.csv',
      ['Metric', 'Value'],
      [
        ['Total Users', s.totalUsers || s.TotalUsers || 0],
        ['Total Tasks', s.totalTasks || s.TotalTasks || 0],
        ['Open Tasks', s.openTasks || s.OpenTasks || 0],
        ['Assigned Tasks', s.assignedTasks || s.AssignedTasks || 0],
        ['Completed Tasks', s.completedTasks || s.CompletedTasks || 0],
        ['Cancelled Tasks', s.cancelledTasks || s.CancelledTasks || 0],
        ['Total Budget', `₱${Number(s.totalBudget || s.TotalBudget || 0).toLocaleString()}`],
        ['Completed Value', `₱${Number(s.completedValue || s.CompletedValue || 0).toLocaleString()}`],
        ['Average Budget', `₱${Number(s.avgBudget || s.AvgBudget || 0).toFixed(2)}`],
        ['Total Assignments', s.totalAssignments || s.TotalAssignments || 0],
        ['Total Messages', s.totalMessages || s.TotalMessages || 0],
        ['Total Reviews', s.totalReviews || s.TotalReviews || 0],
        ['Average Rating', Number(s.avgRating || s.AvgRating || 0).toFixed(1)],
        ['Total Payments', s.totalPayments || s.TotalPayments || 0],
        ['Completed Payments', `₱${Number(s.completedPayments || s.CompletedPayments || 0).toLocaleString()}`],
      ]
    )
  }

  function exportTransactionsCSV() {
    downloadCSV('gawahelper_transactions.csv',
      ['Payment ID', 'Task', 'Amount', 'Method', 'Status', 'Poster', 'Helper', 'Category', 'Date'],
      filteredTx.map(tx => [
        tx.PaymentID,
        tx.TaskTitle,
        tx.Amount,
        tx.PaymentMethod,
        tx.Status,
        tx.PosterName,
        tx.HelperName || '-',
        tx.category || '-',
        new Date(tx.CreatedAt).toLocaleDateString(),
      ])
    )
  }

  function exportActivityCSV() {
    downloadCSV('gawahelper_activity_log.csv',
      ['Type', 'User', 'Description', 'Ref ID', 'Timestamp'],
      filteredAct.map(a => [
        ACTIVITY_LABELS[a.type || a.Type] || a.type || a.Type,
        a.UserName,
        a.description || a.Description,
        a.referenceId || a.ReferenceId,
        new Date(a.timestamp || a.Timestamp).toLocaleString(),
      ])
    )
  }

  const stats = summary?.stats || {}
  const rTotal = Number(stats.TotalTasks || stats.totalTasks || 0)
  const rDone = Number(stats.CompletedTasks || stats.completedTasks || 0)
  const completionRate = rTotal > 0
    ? Math.round((rDone / rTotal) * 100)
    : 0

  if (loading) {
    return (
      <section className="page reports-page">
        <div className="reports-loading">
          <div className="spinner" />
          <p>Generating reports...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page reports-page">
      {/* Header */}
      <header className="reports-header">
        <div className="reports-header-content">
          <div className="reports-brand-block">
            <div className="reports-brand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 16l4-8 4 4 4-10" />
              </svg>
            </div>
            <div>
              <h1>Reports & Analytics</h1>
              <p>Data-driven insights from your platform</p>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="feedback error">{error}</div>}

      {/* Tab Navigation */}
      <nav className="reports-tabs">
        <button
          className={`reports-tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-10"/></svg>
          Summary Report
        </button>
        <button
          className={`reports-tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          Transaction History
        </button>
        <button
          className={`reports-tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
          Activity Log
        </button>
      </nav>

      {/* ─── Summary Report Tab ─── */}
      {activeTab === 'summary' && (
        <div className="reports-content">
          {/* KPI Cards */}
          <div className="reports-kpi-grid">
            <article className="kpi-card kpi-users">
              <div className="kpi-icon">👥</div>
              <div className="kpi-body">
                <span className="kpi-value">{Number(stats.TotalUsers || stats.totalUsers || 0).toLocaleString()}</span>
                <span className="kpi-label">Total Users</span>
              </div>
            </article>
            <article className="kpi-card kpi-tasks">
              <div className="kpi-icon">📋</div>
              <div className="kpi-body">
                <span className="kpi-value">{Number(stats.TotalTasks || stats.totalTasks || 0).toLocaleString()}</span>
                <span className="kpi-label">Total Tasks</span>
              </div>
            </article>
            <article className="kpi-card kpi-completed">
              <div className="kpi-icon">✅</div>
              <div className="kpi-body">
                <span className="kpi-value">{Number(stats.CompletedTasks || stats.completedTasks || 0).toLocaleString()}</span>
                <span className="kpi-label">Completed</span>
              </div>
            </article>
            <article className="kpi-card kpi-rate">
              <div className="kpi-icon">📊</div>
              <div className="kpi-body">
                <span className="kpi-value">{completionRate}%</span>
                <span className="kpi-label">Completion Rate</span>
              </div>
            </article>
            <article className="kpi-card kpi-value">
              <div className="kpi-icon">💰</div>
              <div className="kpi-body">
                <span className="kpi-value">₱{Number(stats.CompletedValue || stats.completedValue || 0).toLocaleString()}</span>
                <span className="kpi-label">Completed Value</span>
              </div>
            </article>
          </div>

          {/* Charts */}
          <div className="reports-charts-grid">
            <article className="chart-card">
              <canvas ref={barChartRef} className="chart-canvas" />
            </article>
            <article className="chart-card">
              <canvas ref={doughnutChartRef} className="chart-canvas" />
            </article>
            <article className="chart-card">
              <canvas ref={lineChartRef} className="chart-canvas" />
            </article>
            <article className="chart-card">
              <canvas ref={categoryChartRef} className="chart-canvas" />
            </article>
          </div>

          {/* Top Helpers */}
          {summary?.topHelpers?.length > 0 && (
            <article className="reports-section">
              <div className="reports-section-head">
                <h2>🏆 Top Helpers</h2>
              </div>
              <div className="reports-table-wrapper">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Helper</th>
                      <th>Rating</th>
                      <th>Completed Tasks</th>
                      <th>Total Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topHelpers.map((helper, i) => (
                      <tr key={`helper-${i}`}>
                        <td><span className="rank-badge">#{i + 1}</span></td>
                        <td><strong>{helper.name || helper.Name}</strong></td>
                        <td>★ {Number(helper.Rating || helper.rating || 0).toFixed(1)}</td>
                        <td>{helper.CompletedTasks || helper.completedTasks || 0}</td>
                        <td>₱{Number(helper.TotalEarnings || helper.totalEarnings || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {/* Revenue by Payment Method */}
          {summary?.revenueByMethod?.length > 0 && (
            <article className="reports-section">
              <div className="reports-section-head">
                <h2>💳 Revenue by Payment Method</h2>
              </div>
              <div className="reports-method-cards">
                {summary.revenueByMethod.map((item, i) => (
                  <div key={`method-${i}`} className="method-card">
                    <span className="method-icon">{item.method === 'GCash' ? '📱' : '💵'}</span>
                    <div className="method-body">
                      <strong>{item.method}</strong>
                      <span className="method-amount">₱{Number(item.total || 0).toLocaleString()}</span>
                      <span className="method-count">{item.count} transactions</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}

          <div className="reports-export-bar">
            <button type="button" className="reports-export-btn" onClick={exportSummaryCSV}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Summary as CSV
            </button>
          </div>
        </div>
      )}

      {/* ─── Transaction History Tab ─── */}
      {activeTab === 'transactions' && (
        <div className="reports-content">
          <div className="reports-controls">
            <input
              type="text"
              className="reports-search"
              placeholder="Search transactions..."
              value={txSearch}
              onChange={e => setTxSearch(e.target.value)}
            />
            <select
              className="reports-filter-select"
              value={txFilter}
              onChange={e => setTxFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
            <button type="button" className="reports-export-btn" onClick={exportTransactionsCSV}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          </div>

          <div className="reports-table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Task</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Poster</th>
                  <th>Helper</th>
                  <th>Category</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="reports-empty-cell">No transactions found</td>
                  </tr>
                ) : (
                  filteredTx.map(tx => (
                    <tr key={tx.PaymentID}>
                      <td><span className="tx-id">#{tx.PaymentID}</span></td>
                      <td><strong>{tx.TaskTitle}</strong></td>
                      <td className="tx-amount">₱{Number(tx.Amount || 0).toLocaleString()}</td>
                      <td>
                        <span className={`method-pill ${tx.PaymentMethod?.toLowerCase()}`}>
                          {tx.PaymentMethod}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${tx.Status?.toLowerCase()}`}>
                          {tx.Status}
                        </span>
                      </td>
                      <td>{tx.PosterName}</td>
                      <td>{tx.HelperName || '—'}</td>
                      <td>{tx.category || '—'}</td>
                      <td className="tx-date">{new Date(tx.CreatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="reports-summary-bar">
            <span>Showing {filteredTx.length} of {transactions.length} transactions</span>
            <span>Total: ₱{filteredTx.reduce((s, tx) => s + Number(tx.Amount || 0), 0).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* ─── Activity Log Tab ─── */}
      {activeTab === 'activity' && (
        <div className="reports-content">
          <div className="reports-controls">
            <select
              className="reports-filter-select"
              value={actFilter}
              onChange={e => setActFilter(e.target.value)}
            >
              <option value="all">All Activities</option>
              <option value="task_created">Task Created</option>
              <option value="task_assigned">Task Assigned</option>
              <option value="review_submitted">Reviews</option>
              <option value="user_registered">User Registered</option>
            </select>
            <button type="button" className="reports-export-btn" onClick={exportActivityCSV}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          </div>

          <div className="activity-timeline">
            {filteredAct.length === 0 ? (
              <div className="reports-empty">No activity logs found</div>
            ) : (
              filteredAct.map((act, i) => {
                const aType = act.type || act.Type;
                const aDesc = act.description || act.Description;
                const aTime = act.timestamp || act.Timestamp;
                
                return (
                  <article key={`act-${i}`} className="activity-item">
                    <div className="activity-dot-line">
                      <span className={`activity-dot ${aType}`} aria-hidden="true">
                        {ACTIVITY_ICONS[aType] || '●'}
                      </span>
                      {i < filteredAct.length - 1 && <span className="activity-line" />}
                    </div>
                    <div className="activity-body">
                      <div className="activity-head">
                        <span className={`activity-type-badge ${aType}`}>
                          {ACTIVITY_LABELS[aType] || aType}
                        </span>
                        <time className="activity-time">
                          {aTime ? new Date(aTime).toLocaleString() : 'No Date'}
                        </time>
                      </div>
                      <p className="activity-desc">{aDesc}</p>
                      <span className="activity-user">by {act.UserName}</span>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="reports-summary-bar">
            <span>Showing {filteredAct.length} of {activities.length} activities</span>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        hasUnreadNotifications={hasUnreadNotifications} 
        logoutRedirect="/admin-login"
      />
    </section>
  )
}

export default ReportsPage
