import React from 'react'

// type: 'info' | 'success' | 'error' | 'warning'
const ICONS = {
  info: (
    <svg
      className="w-4 h-4"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 18 20"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15.147 15.085a7.159 7.159 0 0 1-6.189 3.307A6.713 6.713 0 0 1 3.1 15.444c-2.679-4.513.287-8.737.888-9.548A4.373 4.373 0 0 0 5 1.608c1.287.953 6.445 3.218 5.537 10.5 1.5-1.122 2.706-3.01 2.853-6.14 1.433 1.049 3.993 5.395 1.757 9.117Z"
      />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 8v4m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"
      />
    </svg>
  ),
}

const Toast = ({
  message = 'Set yourself free.',
  type = 'info',
  icon,
  onClose,
  show = false,
  className = '',
}) => {
  if (!show) return null

  // Accent color based on type
  const accent =
    {
      info: 'text-blue-400 bg-blue-500/20',
      success: 'text-green-400 bg-green-500/20',
      error: 'text-red-400 bg-red-500/20',
      warning: 'text-yellow-400 bg-yellow-500/20',
    }[type] || 'text-accent bg-accent/20'

  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-4 ${className}`}
      role="alert"
    >
      <div
        className={`flex items-center gap-3 p-4 rounded-3xl border border-border-primary shadow-lg backdrop-blur-md bg-bg-card/95 transition-all duration-300`}
      >
        <div
          className={`inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full ${accent}`}
        >
          {icon || ICONS[type]}
          <span className="sr-only">Toast icon</span>
        </div>
        <div className="flex-1 text-sm font-normal text-text-primary">{message}</div>
        <button
          type="button"
          className="ml-auto bg-transparent text-text-secondary hover:text-text-primary rounded-full focus:ring-2 focus:ring-accent/30 p-1.5 inline-flex items-center justify-center h-8 w-8 cursor-pointer"
          aria-label="Close"
          onClick={onClose}
        >
          <span className="sr-only">Close</span>
          <svg
            className="w-3 h-3"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 14 14"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default Toast
