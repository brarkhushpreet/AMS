# Portfolio demo

The login page offers **Try as teacher** and **Try as student**. Both use a dedicated Auth.js provider, with no shared password to expose or copy.

On the first demo login, an atomic transaction creates two fictional classrooms, six fictional students, and twenty closed attendance sessions. Subsequent logins reuse this small dataset. It does not run the existing seed script, reset data, or reuse personal accounts. No schema migration is needed. Sample attendance is not a signed/device-verified proof.

Demo access is read-only. Visitors can explore analytics, rosters, classroom pages, filters, and theme settings. The server rejects demo API writes and realtime ticket requests, including passkey enrollment, attendance submission, classroom creation, and roster imports. Real students cannot join the demo classrooms. Demo email addresses use the reserved `demo.classpulse.invalid` domain and cannot register or log in through the ordinary password provider.

`DEMO_MODE=false` disables the buttons, demo authentication, and access through existing demo sessions. Omit it to enable the portfolio demo. Disabling the feature preserves its fictional data. Keep it disabled on deployments that should not offer a public preview.

The first login needs the configured database and may take a little longer while sample data is created. No deployment or database provisioning command is run automatically by the coding task; initialization happens when a visitor chooses a demo role.
