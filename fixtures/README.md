# Fixtures

Saved job board pages used by the unit tests (`tests/presets/*.test.ts`). Tests never access
live sites.

| File                               | Source                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| `indeed/homepage-feed.html`        | Real saved page: de.indeed.com home feed + opened job view |
| `indeed/search.synthetic.html`     | Hand-made: /jobs search page with pagination               |
| `linkedin/jobs-home.html`          | Real saved page: linkedin.com/jobs/ with job cards         |
| `linkedin/detail.synthetic.html`   | Hand-made: logged-in job view                              |
| `xing/jobseeker-criteria.html`     | Real saved page: job preferences (no job list)             |
| `xing/search.synthetic.html`       | Hand-made: job search results                              |
| `xing/detail.synthetic.html`       | Hand-made: job page with JSON-LD                           |
| `stepstone/*.synthetic.html`       | Hand-made: search results and job ad                       |
| `generic/*.synthetic.html`         | Hand-made: career page without preset, CAPTCHA page        |

To add a real page: open it in Chrome, press Ctrl+S, choose "Webpage, HTML only" (or "Complete"
and delete the `_files` folder), save it here and add a test. Saved pages can contain personal
data from your logged-in session (names, hashed account ids) – check before committing.
