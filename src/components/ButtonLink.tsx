import Link from "next/link";
import type { MouseEventHandler } from "react";

type Props = {
  href: string;
  children: React.ReactNode;
  isExternal?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

const buttonClasses =
  "flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-white text-center text-base font-medium text-black transition-colors hover:bg-gray-100 dark:border-white/[.145] dark:bg-black dark:text-white dark:hover:bg-gray-900";

export function ButtonLink({
  href,
  children,
  isExternal = false,
  onClick,
}: Props) {
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={buttonClasses} onClick={onClick}>
      {children}
    </Link>
  );
}
