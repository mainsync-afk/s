/*!
 * store.js — собственный плагин-каталог для Lampa
 *
 * Показывает в Settings отдельный пункт «Каталог» и при открытии
 * предъявляет ровно два плагина без категорий:
 *   - Trakt   (https://mainsync-afk.github.io/lampa_trakt_v3/plugin/trakt_v3.js)
 *   - Kinopub (https://mainsync-afk.github.io/lampa_kinopub/kp.js)
 *
 * Версии подтягиваются из самих плагинов (regex по var VERSION / PLUGIN_VERSION),
 * собирается JSON в формате extensions.json, сериализуется в Blob URL и
 * передаётся в Lampa.Extensions.show — поэтому используется родной UI
 * установки/удаления.
 */
(function () {
    'use strict';

    Lampa.Lang.add({
        my_store_title: {
            ru: 'Плагины',
            en: 'Plugins',
            uk: 'Плагіни',
            be: 'Плагіны',
            zh: '插件',
            pt: 'Plugins',
            bg: 'Плъгини',
            he: 'תוספים'
        },
        my_store_loading: {
            ru: 'Загрузка каталога…',
            en: 'Loading catalog…',
            uk: 'Завантаження каталогу…'
        }
    });

    var DATA_COMPONENT = 'my_store';

    var PLUGINS = [
        {
            name: 'Trakt',
            author: '@mainsync',
            descr: 'Синхронизация с Trakt.tv',
            link: 'https://mainsync-afk.github.io/lampa_trakt_v3/plugin/trakt_v3.js',
            version_regex: /\bVERSION\s*=\s*['"]([^'"]+)['"]/
        },
        {
            name: 'Kinopub',
            author: '@mainsync',
            descr: 'Источник kino.pub',
            link: 'https://mainsync-afk.github.io/lampa_kinopub/kp.js',
            version_regex: /\bPLUGIN_VERSION\s*=\s*['"]([^'"]+)['"]/
        },
        {
            name: 'Filmix',
            author: '@filmix',
            descr: 'Фильмы и сериалы в онлайн',
            link: 'https://lampaplugins.github.io/store/fx.js',
            version_regex: /\bversion\s*:\s*['"]([^'"]+)['"]/
        }
    ];

    /* --------------------------------------------------------------- *
     *  Network                                                        *
     * --------------------------------------------------------------- */

    function fetchText(url) {
        return new Promise(function (resolve) {
            try {
                var xhr = new XMLHttpRequest();
                // cache-buster: версии могут меняться, не хотим залипать на CDN-кеше
                xhr.open('GET', url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(), true);
                xhr.timeout = 8000;
                xhr.onload = function () {
                    resolve(xhr.status >= 200 && xhr.status < 300 ? xhr.responseText : '');
                };
                xhr.onerror = function () { resolve(''); };
                xhr.ontimeout = function () { resolve(''); };
                xhr.send();
            } catch (_) { resolve(''); }
        });
    }

    function extractVersion(plugin) {
        return fetchText(plugin.link).then(function (text) {
            if (!text) return '';
            var m = text.match(plugin.version_regex);
            return m ? m[1] : '';
        });
    }

    /* --------------------------------------------------------------- *
     *  Build & open store                                             *
     * --------------------------------------------------------------- */

    function openStore() {
        try { Lampa.Noty.show(Lampa.Lang.translate('my_store_loading')); } catch (_) {}

        Promise.all(PLUGINS.map(extractVersion)).then(function (versions) {
            var items = PLUGINS.map(function (p, i) {
                var v = versions[i];
                return {
                    name:             v ? (p.name + ' v' + v) : p.name,
                    author:           p.author,
                    link:             p.link,
                    descr:            p.descr,
                    available_lampa:  1
                };
            });

            // Один-единственный безымянный раздел — категорий нет, заголовок пустой
            var payload = {
                secuses: true,
                results: [{ title: '', results: items }]
            };

            var url;
            try {
                var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                url = URL.createObjectURL(blob);
            } catch (_) {
                // fallback для совсем старых WebView без Blob/URL
                url = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload));
            }

            Lampa.Extensions.show({
                store: url,
                with_installed: true
            });

            // Освободим Blob URL чуть позже — Lampa успеет дочитать JSON
            if (url.indexOf('blob:') === 0) {
                setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} }, 30000);
            }
        });
    }

    /* --------------------------------------------------------------- *
     *  Settings entry                                                 *
     * --------------------------------------------------------------- */

    function addStoreItem() {
        if (!Lampa.Settings || !Lampa.Settings.main) return;
        var main = Lampa.Settings.main();
        if (!main) return;
        var $main = main.render();
        if ($main.find('[data-component="' + DATA_COMPONENT + '"]').length) return;

        var field =
            '<div class="settings-folder selector" data-component="' + DATA_COMPONENT + '" data-static="true">' +
                '<div class="settings-folder__icon">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">' +
                        '<path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="settings-folder__name">' + Lampa.Lang.translate('my_store_title') + '</div>' +
            '</div>';

        // Ставим рядом с пунктом «Ещё», как и оригинальный pirate-store
        var $more = $main.find('[data-component="more"]');
        if ($more.length) $more.after(field);
        else $main.append(field);

        main.update();
    }

    Lampa.Settings.listener.follow('open', function (e) {
        if (e.name === 'main') {
            e.body.find('[data-component="' + DATA_COMPONENT + '"]').on('hover:enter', openStore);
        }
    });

    if (window.appready) addStoreItem();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') addStoreItem();
        });
    }
})();
