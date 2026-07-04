import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        'rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-brand-500 text-white hover:bg-brand-600',
        variant === 'secondary' && 'bg-ink-100 text-ink-700 hover:bg-ink-100/70',
        variant === 'ghost' && 'text-ink-500 hover:bg-ink-50',
        className
      )}
      {...props}
    />
  );
}
