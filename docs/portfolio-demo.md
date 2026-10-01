# Portfolio demo

The login page offers **Try as teacher** and **Try as student**. Both use a dedicated Auth.js provider, with no shared password to expose or copy.

After applying Prisma migrations, run [demo-neon-seed.sql](demo-neon-seed.sql) once in the Neon SQL Editor for the production database. It creates two fictional classrooms, six fictional students, and twenty closed attendance sessions. The script is safe to rerun and does not reset data or reuse personal accounts. Demo login only reads the preloaded account; it never creates records. Sample attendance is not a signed/device-verified proof.

Demo access is read-only. Visitors can explore analytics, rosters, classroom pages, filters, and theme settings. The server rejects demo API writes and realtime ticket requests, including passkey enrollment, attendance submission, classroom creation, and roster imports. Real students cannot join the demo classrooms. Demo email addresses use the reserved `demo.classpulse.invalid` domain and cannot register or log in through the ordinary password provider.

`DEMO_MODE=false` disables the buttons, demo authentication, and access through existing demo sessions. Omit it to enable the portfolio demo. Disabling the feature preserves its fictional data. Keep it disabled on deployments that should not offer a public preview.

The demo buttons require the SQL seed to have completed in the same Neon database used by the deployed Worker. If the seed is absent, demo login fails without writing anything.
