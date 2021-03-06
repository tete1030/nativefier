import path from 'path';
import _ from 'lodash';
import async from 'async';
import log from 'loglevel';
import sanitizeFilenameLib from 'sanitize-filename';

import inferIcon from './../infer/inferIcon';
import inferTitle from './../infer/inferTitle';
import inferOs from './../infer/inferOs';
import inferUserAgent from './../infer/inferUserAgent';
import normalizeUrl from './normalizeUrl';
import packageJson from './../../package.json';

const {inferPlatform, inferArch} = inferOs;

const PLACEHOLDER_APP_DIR = path.join(__dirname, '../../', 'app');
const ELECTRON_VERSION = '1.1.3';

const DEFAULT_APP_NAME = 'APP';

/**
 * @callback optionsCallback
 * @param error
 * @param options augmented options
 */

/**
 * Extracts only desired keys from inpOptions and augments it with defaults
 * @param inpOptions
 * @param {optionsCallback} callback
 */
function optionsFactory(inpOptions, callback) {

    const options = {
        dir: PLACEHOLDER_APP_DIR,
        name: inpOptions.name,
        targetUrl: normalizeUrl(inpOptions.targetUrl),
        platform: inpOptions.platform || inferPlatform(),
        arch: inpOptions.arch || inferArch(),
        version: inpOptions.electronVersion || ELECTRON_VERSION,
        nativefierVersion: packageJson.version,
        out: inpOptions.out || process.cwd(),
        overwrite: inpOptions.overwrite,
        asar: inpOptions.conceal || false,
        icon: inpOptions.icon,
        counter: inpOptions.counter || false,
        width: inpOptions.width || 1280,
        height: inpOptions.height || 800,
        minWidth: inpOptions.minWidth,
        minHeight: inpOptions.minHeight,
        maxWidth: inpOptions.maxWidth,
        maxHeight: inpOptions.maxHeight,
        showMenuBar: inpOptions.showMenuBar || false,
        fastQuit: inpOptions.fastQuit || false,
        userAgent: inpOptions.userAgent,
        ignoreCertificate: inpOptions.ignoreCertificate || false,
        insecure: inpOptions.insecure || false,
        flashPluginDir: inpOptions.flashPath || inpOptions.flash || null,
        inject: inpOptions.inject || null,
        ignore: 'src',
        fullScreen: inpOptions.fullScreen || false,
        maximize: inpOptions.maximize || false,
        hideWindowFrame: inpOptions.hideWindowFrame,
        hideTitleBar: inpOptions.hideTitleBar || false,
        verbose: inpOptions.verbose,
        disableContextMenu: inpOptions.disableContextMenu,
        disableDevTools: inpOptions.disableDevTools,
        crashReporter: inpOptions.crashReporter,
        // workaround for electron-packager#375
        tmpdir: false,
        zoom: inpOptions.zoom || 1.0,
        internalUrls: inpOptions.internalUrls || null
    };

    if (options.verbose) {
        log.setLevel('trace');
    } else {
        log.setLevel('error');
    }

    if (options.flashPluginDir) {
        options.insecure = true;
    }

    if (inpOptions.honest) {
        options.userAgent = null;
    }

    if (options.platform.toLowerCase() === 'windows') {
        options.platform = 'win32';
    }

    if (options.platform.toLowerCase() === 'osx' || options.platform.toLowerCase() === 'mac') {
        options.platform = 'darwin';
    }

    if (options.width > options.maxWidth) {
        options.width = options.maxWidth;
    }

    if (options.height > options.maxHeight) {
        options.height = options.maxHeight;
    }

    async.waterfall([
        callback => {
            if (options.userAgent) {
                callback();
                return;
            }
            inferUserAgent(options.version, options.platform)
                .then(userAgent => {
                    options.userAgent = userAgent;
                    callback();
                })
                .catch(callback);
        },
        callback => {
            if (options.icon) {
                callback();
                return;
            }
            inferIcon(options.targetUrl, options.platform)
                .then(pngPath => {
                    options.icon = pngPath;
                    callback();
                })
                .catch(error => {
                    log.warn('Cannot automatically retrieve the app icon:', error);
                    callback();
                });
        },
        callback => {
            // length also checks if its the commanderJS function or a string
            if (options.name && options.name.length > 0) {
                callback();
                return;
            }

            inferTitle(options.targetUrl, function(error, pageTitle) {
                if (error) {
                    log.warn(`Unable to automatically determine app name, falling back to '${DEFAULT_APP_NAME}'`);
                    options.name = DEFAULT_APP_NAME;
                } else {
                    options.name = pageTitle.trim();
                }
                if (options.platform === 'linux') {
                    // spaces will cause problems with Ubuntu when pinned to the dock
                    options.name = _.kebabCase(options.name);
                }
                callback();
            });
        }
    ], error => {
        callback(error, sanitizeOptions(options));
    });
}

function sanitizeFilename(str) {
    const cleaned = sanitizeFilenameLib(str);
    // remove all non ascii or use default app name
    return cleaned.replace(/[^\x00-\x7F]/g, '') || DEFAULT_APP_NAME;
}

function sanitizeOptions(options) {
    options.name = sanitizeFilename(options.name);
    return options;
}

export default optionsFactory;
