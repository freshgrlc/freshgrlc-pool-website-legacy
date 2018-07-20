/**
 * Browser-sync config file
 *
 * For up-to-date information about the options:
 *   https://browsersync.io/docs/options/
 */

const proxy = require('http-proxy-middleware');

module.exports = {
    serveStatic: ['.'],
    files: ['**/*.html', '**/*.css', '**/*.js'],
    middleware: [{
        route: '/api',
        handle: proxy({
            target: 'https://www.freshgarlicblocks.net/',
            changeOrigin: true,
        }),
    }]
};