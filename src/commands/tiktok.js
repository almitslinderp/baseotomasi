module.exports = {
  name: 'TikTok',
  actions: [
    {
      id: 'tiktok-open-profile',
      label: 'Open Profile',
      params: [
        { name: 'username', label: 'Username', type: 'text', placeholder: 'e.g. @username', required: true },
      ],
      execute: async function (params, page, log) {
        var url = 'https://www.tiktok.com/@' + params.username.replace(/^@/, '');
        log('Navigating to ' + url);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        log('Profile page loaded for @' + params.username.replace(/^@/, ''));
      },
    },
    {
      id: 'tiktok-search',
      label: 'Search Keyword',
      params: [
        { name: 'keyword', label: 'Search Keyword', type: 'text', placeholder: 'e.g. funny cats', required: true },
        { name: 'scroll_count', label: 'Scroll Count', type: 'number', placeholder: '3', required: false },
      ],
      execute: async function (params, page, log) {
        var keyword = params.keyword;
        var scrollCount = parseInt(params.scroll_count) || 3;
        var url = 'https://www.tiktok.com/search?q=' + encodeURIComponent(keyword);
        log('Searching TikTok for: ' + keyword);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        log('Search results loaded');
        for (var i = 0; i < scrollCount; i++) {
          await page.evaluate(function () { window.scrollBy(0, window.innerHeight); });
          log('Scrolled ' + (i + 1) + '/' + scrollCount);
          await new Promise(function (r) { setTimeout(r, 1500); });
        }
        log('Search complete — scrolled ' + scrollCount + ' times');
      },
    },
  ],
};
