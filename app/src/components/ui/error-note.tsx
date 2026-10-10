import { cn } from '../../lib/cn.js';

/** The server's reason, in Spanish (duplicate e-mail, broken timeline, …). */
export function ErrorNote({ message, className }: { message: string; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'rounded-2xl bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger',
        className,
      )}
    >
      {message}
    </p>
  );
}
