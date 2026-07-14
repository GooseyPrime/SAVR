export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-12 w-12 border-[3px]',
    lg: 'h-16 w-16 border-4',
  };

  return (
    <div className="flex justify-center items-center py-4" role="status" aria-label="Loading">
      <div
        className={`animate-spin rounded-full border-[var(--color-border-strong)] border-t-[var(--color-primary)] ${sizeClasses[size]}`}
      />
    </div>
  );
}
