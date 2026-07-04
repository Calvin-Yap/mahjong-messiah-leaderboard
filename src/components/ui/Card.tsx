import clsx from 'clsx';

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'rounded-card border border-ink-100 bg-white p-4 shadow-card',
        className
      )}
    >
      {children}
    </div>
  );
}
