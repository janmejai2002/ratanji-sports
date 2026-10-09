import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:\\Users\\Janmejai\\.gemini\\antigravity-cli\\brain\\a01e2244-29b3-4665-a9e2-d8d621871f2c';
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'screenshots');
const PUBLIC_DOCS_DIR = 'C:\\Users\\Janmejai\\adj\\ratanji_sports\\public\\docs';
const OUT_PUBLIC_HTML = path.join(PUBLIC_DOCS_DIR, 'sports-committee-guide.html');
const OUT_ARTIFACT_HTML = path.join(ARTIFACT_DIR, 'sports-committee-guide.html');

function getBase64Img(imgPath) {
  if (fs.existsSync(imgPath)) {
    const ext = path.extname(imgPath).replace('.', '') || 'png';
    const b64 = fs.readFileSync(imgPath).toString('base64');
    return `data:image/${ext};base64,${b64}`;
  }
  return '';
}

const logoBase64 = getBase64Img('C:\\Users\\Janmejai\\adj\\ratanji_sports\\public\\xlri-shield-square.png');
const mcImg = getBase64Img(path.join(SCREENSHOTS_DIR, 'xlri-light-mobile-matchcenter.png'));
const stImg = getBase64Img(path.join(SCREENSHOTS_DIR, 'xlri-light-mobile-standings.png'));
const ctImg = getBase64Img(path.join(SCREENSHOTS_DIR, 'xlri-light-mobile-contingents.png'));
const adImg = getBase64Img(path.join(SCREENSHOTS_DIR, 'xlri-light-mobile-admin-portal.png'));

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ratanjee 2026 • Sports Committee Operational Manual</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #013B83;
      --primary-dark: #00285a;
      --primary-light: #e8f0fe;
      --accent-gold: #D4AF37;
      --accent-green: #059669;
      --slate-50: #f8fafc;
      --slate-100: #f1f5f9;
      --slate-200: #e2e8f0;
      --slate-300: #cbd5e1;
      --slate-600: #475569;
      --slate-700: #334155;
      --slate-800: #1e293b;
      --slate-900: #0f172a;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--slate-50);
      color: var(--slate-900);
      line-height: 1.6;
      font-size: 15px;
      -webkit-font-smoothing: antialiased;
    }

    /* Top Sticky Header */
    header {
      background: #ffffff;
      border-bottom: 1px solid var(--slate-200);
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(8px);
    }

    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 14px;
      text-decoration: none;
      color: inherit;
    }

    .brand-logo {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      object-fit: cover;
      box-shadow: 0 2px 6px rgba(1, 59, 131, 0.2);
    }

    .brand-titles h1 {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: -0.3px;
      color: var(--primary);
      text-transform: uppercase;
      line-height: 1.2;
    }

    .brand-titles p {
      font-size: 11px;
      font-weight: 600;
      color: var(--slate-600);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: 1px solid transparent;
    }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
    }
    .btn-primary:hover {
      background: var(--primary-dark);
    }

    .btn-outline {
      background: #ffffff;
      border-color: var(--slate-300);
      color: var(--slate-700);
    }
    .btn-outline:hover {
      background: var(--slate-100);
      border-color: var(--slate-400);
    }

    /* Layout */
    .container {
      max-width: 1140px;
      margin: 36px auto;
      padding: 0 24px;
    }

    /* Hero Banner */
    .hero {
      background: linear-gradient(135deg, #013B83 0%, #00224d 100%);
      color: #ffffff;
      border-radius: 20px;
      padding: 36px 40px;
      margin-bottom: 36px;
      box-shadow: 0 10px 25px -5px rgba(1, 59, 131, 0.25);
      position: relative;
      overflow: hidden;
    }

    .hero-badge {
      display: inline-block;
      background: rgba(212, 175, 55, 0.2);
      border: 1px solid rgba(212, 175, 55, 0.4);
      color: #ffd875;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 12px;
    }

    .hero h2 {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.5px;
      margin-bottom: 10px;
    }

    .hero p {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.85);
      max-width: 680px;
      line-height: 1.6;
    }

    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }

    .hero-meta span strong {
      color: #ffd875;
    }

    /* Content Cards */
    .card {
      background: #ffffff;
      border: 1px solid var(--slate-200);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 28px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    }

    .card h3 {
      font-size: 20px;
      font-weight: 800;
      color: var(--primary);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .card h4 {
      font-size: 16px;
      font-weight: 700;
      color: var(--slate-800);
      margin: 22px 0 10px 0;
    }

    .card p {
      color: var(--slate-600);
      margin-bottom: 14px;
      font-size: 14px;
    }

    /* Callout */
    .callout {
      background: var(--primary-light);
      border-left: 4px solid var(--primary);
      border-radius: 8px;
      padding: 16px 20px;
      margin: 18px 0;
      font-size: 13.5px;
      color: #00306c;
    }

    .callout-warning {
      background: #fffbeb;
      border-left-color: #f59e0b;
      color: #92400e;
    }

    .callout strong {
      display: block;
      margin-bottom: 4px;
      font-weight: 700;
    }

    /* Tables */
    .table-responsive {
      overflow-x: auto;
      margin: 20px 0;
      border-radius: 12px;
      border: 1px solid var(--slate-200);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
      text-align: left;
    }

    th {
      background: var(--primary);
      color: #ffffff;
      font-weight: 700;
      padding: 12px 16px;
      text-transform: uppercase;
      font-size: 11.5px;
      letter-spacing: 0.5px;
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--slate-200);
      color: var(--slate-700);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) td {
      background: #fafbfc;
    }

    .badge-role {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
    }

    .badge-admin {
      background: rgba(1, 59, 131, 0.12);
      color: var(--primary);
    }

    .badge-ref {
      background: rgba(5, 150, 105, 0.12);
      color: var(--accent-green);
    }

    .badge-spec {
      background: rgba(100, 116, 139, 0.12);
      color: var(--slate-600);
    }

    /* Mockups Grid */
    .mockups-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 24px;
      margin: 28px 0;
    }

    .mockup-item {
      text-align: center;
      background: var(--slate-50);
      border: 1px solid var(--slate-200);
      border-radius: 16px;
      padding: 20px 16px;
    }

    .mockup-img {
      max-width: 220px;
      height: auto;
      border-radius: 14px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
      border: 3px solid #0f172a;
      margin: 0 auto 12px auto;
      display: block;
    }

    .mockup-caption {
      font-size: 12px;
      font-weight: 700;
      color: var(--slate-700);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Step Process */
    .steps {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 20px 0;
    }

    .step {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      background: var(--slate-50);
      border: 1px solid var(--slate-200);
      border-radius: 12px;
      padding: 16px 20px;
    }

    .step-num {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--primary);
      color: #ffffff;
      font-weight: 800;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .step-body h5 {
      font-size: 14.5px;
      font-weight: 700;
      color: var(--slate-800);
      margin-bottom: 4px;
    }

    .step-body p {
      font-size: 13px;
      color: var(--slate-600);
      margin: 0;
      line-height: 1.5;
    }

    /* Footer */
    footer {
      border-top: 1px solid var(--slate-200);
      background: #ffffff;
      padding: 32px 24px;
      text-align: center;
      font-size: 12.5px;
      color: var(--slate-600);
      margin-top: 60px;
    }

    @media print {
      header { position: static; }
      .btn { display: none; }
      .hero { box-shadow: none; }
    }
  </style>
</head>
<body>

  <!-- Sticky Header -->
  <header>
    <div class="header-inner">
      <a href="/" class="brand-group">
        ${logoBase64 ? `<img src="${logoBase64}" alt="XLRI Delhi Shield" class="brand-logo" />` : ''}
        <div class="brand-titles">
          <h1>XLRI Delhi &bull; Ratanjee 2026</h1>
          <p>Sports Committee Operational Manual</p>
        </div>
      </a>
      <div class="header-actions">
        <a href="/docs/sports-committee-guide.pdf" class="btn btn-outline" download>
          📄 Download PDF
        </a>
        <button class="btn btn-primary" onclick="window.print()">
          🖨️ Print Guide
        </button>
      </div>
    </div>
  </header>

  <div class="container">

    <!-- Hero Banner -->
    <div class="hero">
      <div class="hero-badge">Official Tournament Protocol</div>
      <h2>Sports Committee Central Operations Guide</h2>
      <p>
        The official operational playbook for scheduling fixtures, certifying field scorecards, managing 15-sport contingent rosters, and administering real-time championship standings between Seniors and Juniors for the Ratanjee 2026 Memorial Trophy.
      </p>
      <div class="hero-meta">
        <span><strong>Tournament:</strong> Ratanjee 2026</span>
        <span><strong>Institution:</strong> XLRI Delhi-NCR</span>
        <span><strong>Cohorts:</strong> Seniors vs. Juniors</span>
        <span><strong>Live Portal:</strong> <a href="https://ratanjee-sports.onrender.com" target="_blank" style="color:#ffffff;text-decoration:underline;">ratanjee-sports.onrender.com</a></span>
      </div>
    </div>

    <!-- Section 1: System Roles & Credentials -->
    <div class="card">
      <h3>1. Role-Based Access Control (RBAC) & Credential Policy</h3>
      <p>
        The platform enforces strict role isolation across three user tiers. Spectator sessions are strictly read-only, preventing any unauthorized changes to scores or rosters.
      </p>

      <div class="callout callout-warning">
        <strong>🔒 Security Notice Regarding Passwords</strong>
        Official Sports Committee administrative passwords are NOT published in public documentation. Administrative credentials are issued confidentially by the Sports Committee Convener via authorized internal communications.
      </div>

      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Access Point</th>
              <th>Authentication Method</th>
              <th>Permissions & Authority</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="badge-role badge-admin">Sports Committee</span></td>
              <td><code>Navbar &rarr; Committee</code> or <code>/admin</code></td>
              <td>Official Email ID + Confidential Committee Password</td>
              <td>Full executive authority: Schedule fixtures, assign referees, 1-click verify & publish scores, add/edit sports, manage athlete rosters.</td>
            </tr>
            <tr>
              <td><span class="badge-role badge-ref">Field Referee</span></td>
              <td><code>Navbar &rarr; Ref Access</code> or <code>/referee</code></td>
              <td>Official Referee ID Pass (e.g. <code>REF-023</code>, <code>REF-045</code>, <code>REF-012</code>)</td>
              <td>On-field scoring pad: Start/pause match clocks, whistle synthesizer, log goals/points/fouls, submit final scorecard.</td>
            </tr>
            <tr>
              <td><span class="badge-role badge-spec">Spectators</span></td>
              <td>Direct URL / Mobile Browser</td>
              <td>Zero login required (Automatic Spectator Session)</td>
              <td>Read-only live scores, match fixtures, championship standings, contingent directory, and WhatsApp card sharing.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Section 2: Core Screens -->
    <div class="card">
      <h3>2. Interface & Screen Directory</h3>
      <p>
        The platform features an executive, Fortune-500 design language styled around official XLRI Delhi navy blue (<code>#013B83</code>), emerald green (<code>#059669</code>), and clean slate surfaces.
      </p>

      <div class="mockups-grid">
        ${mcImg ? `
        <div class="mockup-item">
          <img src="${mcImg}" alt="Match Center" class="mockup-img" />
          <div class="mockup-caption">Match Center</div>
        </div>` : ''}

        ${stImg ? `
        <div class="mockup-item">
          <img src="${stImg}" alt="Standings" class="mockup-img" />
          <div class="mockup-caption">Standings Table</div>
        </div>` : ''}

        ${ctImg ? `
        <div class="mockup-item">
          <img src="${ctImg}" alt="Contingents" class="mockup-img" />
          <div class="mockup-caption">Contingents Roster</div>
        </div>` : ''}

        ${adImg ? `
        <div class="mockup-item">
          <img src="${adImg}" alt="Admin Portal" class="mockup-img" />
          <div class="mockup-caption">Committee Command</div>
        </div>` : ''}
      </div>
    </div>

    <!-- Section 3: Operating Workflows -->
    <div class="card">
      <h3>3. Step-by-Step Operating Procedures</h3>

      <h4>Workflow A: Scheduling a Fixture</h4>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-body">
            <h5>Open Admin Central Command</h5>
            <p>Log in with Committee credentials via the top navigation bar and scroll to <strong>Tournament Fixtures Schedule</strong>.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-body">
            <h5>Select "+ Schedule New Match"</h5>
            <p>Specify the sport discipline, select Seniors as Home and Juniors as Away, choose the court/ground venue, and set the scheduled time.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-body">
            <h5>Assign Field Referee</h5>
            <p>Select a certified referee from the directory (e.g. Rohan Verma, Priya Sharma). The match initializes in <code>Scheduled</code> status.</p>
          </div>
        </div>
      </div>

      <h4>Workflow B: Scorecard Verification Queue (The Golden Gate)</h4>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-body">
            <h5>Referee Submits Concluded Match</h5>
            <p>Upon final whistle, the referee enters closing notes and taps <em>Submit Scorecard</em>. Match status immediately transitions to <code>SUBMITTED</code>.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-body">
            <h5>Audit Scorecard in Admin Queue</h5>
            <p>Inspect the submitted score, timeline of scoring events (goals, points, fouls), and notes in the <strong>Pending Verification Queue</strong> card.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-body">
            <h5>1-Click Verify & Publish to Standings</h5>
            <p>Tap <strong>Verify Scorecard</strong>, followed by <strong>Publish Result</strong>. Standings update instantaneously via real-time SSE (&lt;250ms) across all spectator screens.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 4: Conflict Resolution -->
    <div class="card">
      <h3>4. Dispute Resolution & Incident Protocols</h3>
      
      <h4>Handling Disputed Scores / Official Protests</h4>
      <p>
        If a team captain lodges a formal protest regarding scoring, foul counts, or player eligibility, the Sports Committee holds ultimate certification authority:
      </p>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-body">
            <h5>Freeze the Scorecard</h5>
            <p>Do NOT publish the match while a dispute is under investigation.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-body">
            <h5>Reject to Draft with Rationale</h5>
            <p>Click <strong>Reject to Draft</strong> in the verification queue and enter required notes (e.g. <em>"Reviewing linesman video on 84th minute goal"</em>). This returns control to the referee pad.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-body">
            <h5>Committee Hearing & Certification</h5>
            <p>After reviewing logs with match officials, the referee re-submits the certified score, and the committee verifies and publishes.</p>
          </div>
        </div>
      </div>
    </div>

  </div>

  <footer>
    <p><strong>XLRI Delhi &bull; Ratanjee 2026 Sports Committee Operations Manual</strong></p>
    <p style="margin-top: 6px;">For official tournament committee use only &bull; Built with XLRI brand identity</p>
  </footer>

</body>
</html>
`;

fs.writeFileSync(OUT_PUBLIC_HTML, htmlContent, 'utf-8');
fs.writeFileSync(OUT_ARTIFACT_HTML, htmlContent, 'utf-8');

console.log('Generated public HTML:', OUT_PUBLIC_HTML);
console.log('Generated artifact HTML:', OUT_ARTIFACT_HTML);
