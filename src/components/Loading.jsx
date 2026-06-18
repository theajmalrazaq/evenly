export default function LoadingPulseOverlay({ message = null }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-bg-app z-50 transition-colors duration-300">
      <div className="h-5 w-5 bg-accent/35 rounded-full animate-pulse flex justify-center items-center mb-4">
        <div className="h-3 w-3 rounded-full bg-accent"></div>
      </div>
      {message && (
        <p className="text-text-secondary text-sm text-center px-4 max-w-xs">
          {message}
        </p>
      )}
    </div>
  )
}
