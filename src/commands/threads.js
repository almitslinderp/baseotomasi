module.exports = {
  name: 'Threads',
  actions: [
    {
      id: 'threads-login-cookies',
      label: 'Login via Cookies',
      params: [
        {
          name: 'cookies',
          label: 'Cookies (JSON array)',
          type: 'textarea',
          rows: 8,
          placeholder: '[{ "name": "sessionid", "value": "...", "domain": ".threads.net" }, ...]',
          required: true,
        },
      ],
      execute: async function (params, page, log) {
        var cookiesRaw = params.cookies;
        var cookies;

        // Parse cookies JSON
        log('Parsing cookies...');
        try {
          cookies = JSON.parse(cookiesRaw);
        } catch (e) {
          log('Failed to parse cookies JSON: ' + e.message);
          throw new Error('Invalid JSON format — paste a valid JSON array of cookies');
        }

        if (!Array.isArray(cookies) || cookies.length === 0) {
          log('Cookies must be a non-empty JSON array');
          throw new Error('Cookies must be a non-empty JSON array');
        }

        // Navigate to Threads (threads.com is the current canonical domain)
        log('Navigating to https://www.threads.com ...');
        await page.goto('https://www.threads.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Clear existing cookies for all Threads domains (.threads.com, .threads.net, www variants)
        log('Clearing existing cookies for Threads domains...');
        var existingCookies = await page.cookies(
          'https://www.threads.com',
          'https://threads.com',
          'https://www.threads.net',
          'https://threads.net'
        );
        if (existingCookies.length > 0) {
          await page.deleteCookie.apply(page, existingCookies);
          log('Cleared ' + existingCookies.length + ' existing cookie(s)');
        } else {
          log('No existing cookies to clear');
        }

        // Sanitize cookies: keep only fields Puppeteer's setCookie accepts and
        // normalize sameSite. Browser exports often include extras (storeId,
        // session, hostOnly, etc.) and non-string sameSite values (null/bool)
        // which Puppeteer rejects with "Failed to deserialize ... string value
        // expected".
        var ALLOWED_FIELDS = ['name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite'];
        var VALID_SAME_SITE = ['Strict', 'Lax', 'None'];

        log('Setting ' + cookies.length + ' cookie(s)...');
        var preparedCookies = [];
        for (var i = 0; i < cookies.length; i++) {
          var c = cookies[i];
          if (!c.name || !c.value) {
            log('Skipping cookie at index ' + i + ' — missing name or value');
            continue;
          }
          var sanitized = {};
          for (var f = 0; f < ALLOWED_FIELDS.length; f++) {
            var key = ALLOWED_FIELDS[f];
            if (c[key] !== undefined) sanitized[key] = c[key];
          }
          if (sanitized.sameSite !== undefined && VALID_SAME_SITE.indexOf(sanitized.sameSite) === -1) {
            delete sanitized.sameSite;
          }
          preparedCookies.push(sanitized);
        }

        if (preparedCookies.length === 0) {
          log('No valid cookies found (each cookie must have name and value)');
          throw new Error('No valid cookies provided');
        }

        await page.setCookie.apply(page, preparedCookies);
        log('Set ' + preparedCookies.length + ' cookie(s) successfully');

        // Reload the page with cookies applied
        log('Reloading page with new cookies...');
        await page.goto('https://www.threads.com', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for a selector that confirms login
        log('Checking login status...');
        var loggedIn = false;
        var selectors = [
          '[aria-label="Home"]',
          '[aria-label="Beranda"]',
          'img[data-testid="user-avatar"]',
          'a[href*="/profile"]',
          '[role="navigation"] a[href*="/@"]',
        ];

        for (var j = 0; j < selectors.length; j++) {
          try {
            await page.waitForSelector(selectors[j], { timeout: 5000 });
            loggedIn = true;
            log('Login confirmed — found element: ' + selectors[j]);
            break;
          } catch (e) {
            // Try next selector
          }
        }

        if (loggedIn) {
          log('Login successful — session is active on Threads');
          log('Session state saved in Chrome profile (persistent across restarts)');
        } else {
          log('Invalid or expired cookies — login elements not found');
          throw new Error('Invalid or expired cookies');
        }
      },
    },
  ],
};
