import Image from 'next/image';
import clsx from 'clsx';

export function PlayerAvatar({
  icon,
  name,
  size = 40,
}: {
  icon: string | null;
  name: string;
  size?: number;
}) {
  const isImageUrl = icon?.startsWith('http') || icon?.startsWith('/');

  return (
    <div
      className={clsx(
        'flex items-center justify-center overflow-hidden rounded-full bg-brand-50'
      )}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      title={name}
    >
      {isImageUrl ? (
        <Image src={icon!} alt={name} width={size} height={size} className="object-cover" />
      ) : (
        <span>{icon || '👤'}</span>
      )}
    </div>
  );
}
