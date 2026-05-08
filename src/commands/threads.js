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

        // Navigate to Threads
        log('Navigating to https://www.threads.net ...');
        await page.goto('https://www.threads.net', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Clear existing cookies for Threads domains
        log('Clearing existing cookies for Threads domains...');
        var existingCookies = await page.cookies('https://www.threads.net', 'https://threads.net');
        if (existingCookies.length > 0) {
          await page.deleteCookie.apply(page, existingCookies);
          log('Cleared ' + existingCookies.length + ' existing cookie(s)');
        } else {
          log('No existing cookies to clear');
        }

        // Scope cookies to Threads domains and set them
        log('Setting ' + cookies.length + ' cookie(s)...');
        var preparedCookies = [];
        for (var i = 0; i < cookies.length; i++) {
          var c = cookies[i];
          if (!c.name || !c.value) {
            log('Skipping cookie at index ' + i + ' — missing name or value');
            continue;
          }
          var domain = c.domain || '.threads.net';
          // Ensure cookie is scoped to Threads
          if (domain.indexOf('threads.net') === -1) {
            log('Skipping cookie "' + c.name + '" — domain "' + domain + '" is not threads.net');
            continue;
          }
          preparedCookies.push({
            name: c.name,
            value: c.value,
            domain: domain,
            path: c.path || '/',
            httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
            secure: c.secure !== undefined ? c.secure : true,
            sameSite: c.sameSite || 'None',
          });
        }

        if (preparedCookies.length === 0) {
          log('No valid Threads cookies found after filtering');
          throw new Error('No valid cookies scoped to threads.net');
        }

        await page.setCookie.apply(page, preparedCookies);
        log('Set ' + preparedCookies.length + ' cookie(s) successfully');

        // Reload the page with cookies applied
        log('Reloading page with new cookies...');
        await page.goto('https://www.threads.net', { waitUntil: 'networkidle2', timeout: 30000 });

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
