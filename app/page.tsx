export default function HomePage() {
  return (
    <div className="page">
      <h2>Starter app is ready</h2>
      <div className="note">
        This project uses <strong>Next.js</strong> for the UI and API, and <strong>Neon Postgres</strong> for the database.
      </div>
      <p>Recommended order:</p>
      <ol>
        <li>Run <code>sql/schema.sql</code> in Neon</li>
        <li>Set <code>DATABASE_URL</code> in <code>.env.local</code></li>
        <li>Run <code>npm install</code> then <code>npm run dev</code></li>
        <li>Test Matrix first</li>
      </ol>
    </div>
  );
}
