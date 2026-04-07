import type { ReactNode } from 'react';

export default function AdminPageShell({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; }) {
  return (
    <div className="page adminPage compactAdminPage">
      <div className="pageHeader compactPageHeader">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="subtle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="toolbar adminPageActions compactToolbar">{actions}</div> : null}
      </div>
      <div className="adminContent">{children}</div>
    </div>
  );
}
