import { redirect } from 'next/navigation';
import AdminPageShell from '@/components/admin/admin-page-shell';
import { getCurrentUserRoles } from '@/lib/auth';
import { discoverApiGetDocs } from '@/lib/api-docs';

function renderTypeBadge(type: string) {
  return <span className="apiDocsTypeBadge">{type}</span>;
}

export default async function AdminApiDocsPage() {
  const roles = await getCurrentUserRoles();
  if (!roles.includes('sys_admin')) {
    redirect('/cpq-matrix');
  }

  const endpointDocs = await discoverApiGetDocs();
  const included = endpointDocs.filter((endpoint) => endpoint.includeInAdminDocs);
  const excluded = endpointDocs.filter((endpoint) => !endpoint.includeInAdminDocs);

  return (
    <AdminPageShell title="Admin - API Docs" subtitle="Internal documentation for active GET endpoints (sys_admin only).">
      <div className="note compactNote">
        Endpoints are rendered from a curated static registry in <code>lib/api-docs.ts</code>; no runtime filesystem/source scanning is used.
      </div>

      <div className="apiDocsSummary">
        <span><strong>{included.length}</strong> documented GET endpoints</span>
        <span><strong>{excluded.length}</strong> excluded endpoints</span>
      </div>

      <div className="apiDocsList">
        {included.map((endpoint) => (
          <section key={endpoint.path} className="apiDocsCard">
            <header className="apiDocsCardHeader">
              <span className="apiDocsMethod">GET</span>
              <code className="apiDocsPath">{endpoint.path}</code>
            </header>
            <p className="subtle">{endpoint.description}</p>

            <div className="apiDocsMetaRow"><strong>Auth:</strong> <span>{endpoint.auth}</span></div>
            <div className="apiDocsMetaRow"><strong>Source:</strong> <code>{endpoint.sourceFile}</code></div>

            <div className="apiDocsSection">
              <h4>Query parameters</h4>
              {!endpoint.queryParams.length ? (
                <div className="subtle">None</div>
              ) : (
                <table className="apiDocsTable">
                  <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
                  <tbody>
                    {endpoint.queryParams.map((param) => (
                      <tr key={`${endpoint.path}-${param.name}`}>
                        <td><code>{param.name}</code></td>
                        <td>{renderTypeBadge(param.type)}</td>
                        <td>{param.required ? 'Required' : 'Optional'}</td>
                        <td>{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="apiDocsSection">
              <h4>Response fields</h4>
              {!endpoint.responseFields.length ? (
                <div className="subtle">Structure inferred at route level; no explicit field map available.</div>
              ) : (
                <table className="apiDocsTable">
                  <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
                  <tbody>
                    {endpoint.responseFields.map((field) => (
                      <tr key={`${endpoint.path}-${field.name}`}>
                        <td><code>{field.name}</code></td>
                        <td>{renderTypeBadge(field.type)}</td>
                        <td>{field.description || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="apiDocsSection">
              <h4>Example response</h4>
              <pre className="apiDocsExample">{JSON.stringify(endpoint.exampleResponse, null, 2)}</pre>
            </div>
          </section>
        ))}
      </div>

      {excluded.length ? (
        <div className="apiDocsExcluded">
          <h3>Excluded endpoints</h3>
          <ul>
            {excluded.map((endpoint) => (
              <li key={`excluded-${endpoint.path}`}>
                <code>{endpoint.path}</code> — {endpoint.exclusionReason || 'Excluded from admin exposure.'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
