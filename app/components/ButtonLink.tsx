import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";

interface Props {
  children: ReactNode;
  href: string;
  isExternal?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export function ButtonLink({
  children,
  href,
  isExternal = false,
  onClick,
}: Props) {
  const commonClasses =
    "flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-white text-center text-base font-medium text-black transition-colors hover:bg-gray-100 dark:border-white/[.145] dark:bg-black dark:text-white dark:hover:bg-gray-900";

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={commonClasses}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={commonClasses} onClick={onClick}>
      {children}
    </Link>
  );
}
