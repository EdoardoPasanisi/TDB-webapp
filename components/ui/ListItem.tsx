// FILE: components/ui/ListItem.tsx
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type ListItemProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  disabled = false,
  className,
}: ListItemProps) {
  const interactive = Boolean(onClick) && !disabled;

  const content = (
    <Card className={cx(interactive && 'ui-cardHover', className)}>
      <CardContent className="flex items-center gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}

        <div className="min-w-0 flex-1">
          <div className="ui-body font-[var(--font-weight-semibold)] truncate">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 ui-muted truncate">{subtitle}</div>
          ) : null}
        </div>

        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </CardContent>
    </Card>
  );

  if (!interactive) return content;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left disabled:opacity-60"
    >
      {content}
    </button>
  );
}
