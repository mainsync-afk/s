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
            ru: 'Каталог',
            en: 'Catalog',
            uk: 'Каталог',
            be: 'Каталог',
            zh: '插件目录',
            pt: 'Catálogo',
            bg: 'Каталог',
            he: 'קטלוג'
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
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M3 7l1.4 12.2A2 2 0 0 0 6.4 21h11.2a2 2 0 0 0 2-1.8L21 7"/>' +
                        '<path d="M3 7l3-4h12l3 4"/>' +
                        '<path d="M8 11a4 4 0 0 0 8 0"/>' +
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
