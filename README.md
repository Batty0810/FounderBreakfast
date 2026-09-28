# Nymbis Cloud Founder Breakfast · Invite tracker

Track the customers invited to the Founder Breakfast on 22 October 2026 at the Island Club, Century City (9h30 – 12h00). The RSVP cut-off is 9 October 2026.

- **Dashboard**: the number of customers invited, plus Yes, Maybe, No and Awaiting counts, countdowns to the cut-off and the event, and a breakdown for each Account Manager.
- **Invites**: an editable list with Account Manager, customer, contact, telephone and response. Changes save automatically and appear live for everyone.
- Works on desktop and mobile.

The site is hosted free on **GitHub Pages**. Data is stored in **Supabase** (free tier), so the list is the same for everyone on any machine. Sign-in is by email link and restricted to `@nymbis.cloud` and `@voxtelecom.co.za` addresses.

## Setup (about 15 minutes, once)

### 1. Create the database
1. Sign up at [supabase.com](https://supabase.com) and create a new project (region: *Africa (Cape Town)* if available).
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql` and select **Run**.

### 2. Configure sign-in
1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to `https://batty0810.github.io/FounderBreakfast/`.
3. Add the same address under **Redirect URLs**.

### 3. Connect the app
1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key into `config.js`.

### 4. Publish on GitHub Pages
1. Upload all the files in this folder to the root of `github.com/Batty0810/FounderBreakfast` (keep the `fonts`, `assets` and `supabase` folders).
2. In the repository go to **Settings → Pages**, set **Source** to *Deploy from a branch*, select `main` and `/ (root)`, then **Save**.
3. After a minute the tracker is live at `https://batty0810.github.io/FounderBreakfast/`.

## Everyday use
- Sign in with your @nymbis.cloud or @voxtelecom.co.za email and open the link sent to you.
- **Invites → Add invite** creates a new row. Choose the Account Manager and fill in the customer details.
- Select **Yes**, **Maybe** or **No** to record a response. Select it again to clear it.
- Filter by Account Manager or by response, or search by name or number.

## Notes
- If `config.js` still holds the placeholder values, the app runs in **demo mode** and saves only to your own browser.
- To change the list of Account Managers, edit the `AMS` list at the top of `app.js`.
- The anon key is meant to be public. The row-level security rules in `schema.sql` make sure only signed-in @nymbis.cloud and @voxtelecom.co.za users can see or change data.
- Supabase pauses free projects after 7 days without activity. Open the dashboard to wake it if that happens.
