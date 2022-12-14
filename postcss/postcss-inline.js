const fs = require('node:fs/promises');
const mime = require('mime');
const { dirname, resolve } = require('node:path');

const INLINE_IMAGE_REGEX = /inline-image\(('|")?(.*?)\1\)/g;

const escapeSVG = (body) =>
    body.trim()
        .replace(/#/g, '%23')
        .replace(/'/g, '%27')
        .replace(/>\s+/g, '>')
        .replace(/\s+</g, '<')
        .replace(/</g, '%3C')
        .replace(/>/g, '%3E')
        .replace(/"/g, `'`);

module.exports = () => {
    const cache = new WeakMap();

    const readFile = (path) =>
    cache.has(path) ? cache.get(path) : fs.readFile(path);

    return {
        postcssPlugin: 'postcss-inline',
        async Declaration(decl) {
            const matches = [...decl.value.matchAll(INLINE_IMAGE_REGEX)];

            if (matches.length === 0) {
                return;
            }

            const baseDir = dirname(decl.source.input.from);

            const files = Object.fromEntries(
                await Promise.all(
                    matches.map(async ([,,url]) => [url, await readFile(resolve(baseDir, url))])
                )
            );

            decl.value = decl.value.replaceAll(
                INLINE_IMAGE_REGEX,
                (_match, _quot, url) => {
                    const mimeType = mime.getType(url);
                    return mimeType === 'image/svg+xml' ?
                        `url("data:${mimeType};utf8,${escapeSVG(files[url].toString('utf8'))}")` :
                        `url("data:${mimeType};base64,${files[url].toString('base64url')}")`;
                }
            );
        }
    };
};
