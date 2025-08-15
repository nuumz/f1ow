import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js'
import { Chart } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface ExecutionData {
  date: string
  executions: number
  success: number
  failed: number
}

interface ModernExecutionChartProps {
  data: ExecutionData[]
  className?: string
}

export default function ModernExecutionChart({ data, className = '' }: ModernExecutionChartProps) {
  const [isLoading, setIsLoading] = useState(true)
  // view toggle reserved for future use

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  // Format data for Chart.js  
  const formatChartData = () => {
    const labels = data.map(d => {
      const date = new Date(d.date)
      const day = date.getDate()
      const month = date.toLocaleDateString('en-US', { month: 'short' })
      return `${day} ${month}`
    })
    
    return {
      labels,
      datasets: [
        // Failure rate line chart
        {
          type: 'line' as const,
          label: 'Failure rate',
          data: data.map(d => {
            const rate = (d.failed / d.executions) * 100
            return isNaN(rate) ? 0 : Number(rate.toFixed(1))
          }),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2.5,
          fill: false,
          tension: 0.3,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: 'rgba(255, 255, 255, 1)',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointHoverBorderColor: 'rgba(255, 255, 255, 1)',
          yAxisID: 'y1'
        },
        // Failed executions (base layer of stack - bottom)
        {
          type: 'bar' as const,
          label: 'Failed executions',
          data: data.map(d => d.failed),
          backgroundColor: 'rgba(220, 38, 38, 0.9)',
          borderColor: 'rgba(185, 28, 28, 1)',
          borderWidth: 0,
          borderRadius: 3,
          borderSkipped: false,
          stack: 'executions',
          barThickness: 'flex' as const,
          maxBarThickness: 40
        },
        // Success executions (stacked on top of Failed - top)
        {
          type: 'bar' as const,
          label: 'Success executions',
          data: data.map(d => d.success),
          backgroundColor: 'rgba(226, 232, 240, 0.7)',
          borderColor: 'rgba(203, 213, 225, 0.8)',
          borderWidth: 0,
          borderRadius: 3,
          borderSkipped: false,
          stack: 'executions',
          barThickness: 'flex' as const,
          maxBarThickness: 40
        }
      ]
    }
  }

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    indexAxis: 'x' as const,
    datasets: {
      bar: {
        categoryPercentage: 0.8,
        barPercentage: 0.9,
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: 'rgba(243, 244, 246, 1)',
        bodyColor: 'rgba(229, 231, 235, 1)',
        borderColor: 'rgba(75, 85, 99, 0.3)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        padding: 12,
        titleFont: {
          size: 13,
          weight: 600
        },
        bodyFont: {
          size: 12,
          weight: 400
        },
        callbacks: {
          title: function(tooltipItems) {
            const item = tooltipItems[0]
            if (item) {
              const dataIndex = item.dataIndex
              const dataPoint = data[dataIndex]
              const date = new Date(dataPoint.date)
              const today = new Date()
              const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
              
              if (daysDiff === 0) return 'Today'
              if (daysDiff === 1) return 'Yesterday'
              return `${daysDiff} days ago`
            }
            return ''
          },
          label: function(context) {
            // Only show individual values for bar charts, not summary
            if (context.dataset.type === 'line') {
              return `${context.dataset.label}: ${context.parsed.y}%`
            }
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`
          },
          afterBody: function(tooltipItems) {
            const item = tooltipItems[0]
            if (item) {
              const dataIndex = item.dataIndex
              const dataPoint = data[dataIndex]
              const totalExecutions = dataPoint.executions
              return [`Total executions: ${totalExecutions.toLocaleString()}`]
            }
            return []
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          color: 'rgba(226, 232, 240, 0.6)',
          display: true
        },
        ticks: {
          color: 'rgba(107, 114, 128, 0.8)',
          font: {
            size: 11,
            weight: 500
          }
        },
        border: {
          display: false
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        stacked: true,
        grid: {
          color: 'rgba(226, 232, 240, 0.6)',
          display: true
        },
        ticks: {
          color: 'rgba(107, 114, 128, 0.8)',
          font: {
            size: 11,
            weight: 500
          },
          callback: function(value) {
            return Number(value).toLocaleString()
          }
        },
        border: {
          display: false
        },
        title: {
          display: true,
          text: 'Executions',
          color: 'rgba(107, 114, 128, 0.8)',
          font: {
            size: 11,
            weight: 500
          }
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgba(59, 130, 246, 0.8)',
          font: {
            size: 11,
            weight: 500
          },
          callback: function(value) {
            return value + '%'
          }
        },
        border: {
          display: false
        },
        title: {
          display: true,
          text: 'Failure Rate (%)',
          color: 'rgba(59, 130, 246, 0.8)',
          font: {
            size: 11,
            weight: 500
          }
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 3
      }
    }
  }

  return (
    <div className={`chart-card modern-chart ${className}`}>
      <div className="chart-header">
        <h3>Execution Trends</h3>
      </div>

      {/* Chart Filters */}
      <div className="chart-filters">
        {/* Modern Chart Legend */}
        <div className="modern-chart-legend">
            <div className="legend-item">
            <div className="legend-indicator failed"></div>
            <span>Failed</span>
            </div>
            <div className="legend-item">
            <div className="legend-indicator success"></div>
            <span>Success</span>
            </div>
            <div className="legend-item">
            <div className="legend-indicator rate"></div>
            <span>Failure rate</span>
            </div>
        </div>
        <div className="time-range">Last 7 days</div>
      </div>

      {/* Chart Container */}
      <div className="modern-chart-container">
        <div className="chart-container">
          {isLoading && <div className="chart-performance-overlay loading"></div>}
          {/* @ts-ignore - Mixed chart type */}
          <Chart
            data={formatChartData()}
            options={chartOptions}
          />
        </div>
      </div>
    </div>
  )
}
