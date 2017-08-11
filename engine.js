(function (DOM) {
    if (DOM.FLiPEngine) return;
    DOM.FLiPEngine = function (textContainer) {
        var self = this;

        /* configs */
        var tagsBlock = {
            "address": true,
            "area": true,
            "blockquote": true,
            "br": true,
            "center": true,
            "dir": true,
            "div": true,
            "dl": true,
            "fieldset": true,
            "form": true,
            "h1": true,
            "h2": true,
            "h3": true,
            "h4": true,
            "h5": true,
            "h6": true,
            "hr": true,
            "isindex": true,
            "menu": true,
            "noframes": true,
            "noscript": true,
            "ol": true,
            "p": true,
            "pre": true,
            "script": true,
            "td": true,
            "li": true,
            "layer": true,
            "article": true,
            "aside": true,
            "details": true,
            "figcaption": true,
            "figure": true,
            "footer": true,
            "header": true,
            "hgroup": true,
            "nav": true,
            "section": true,
            "summary": true
        };

        /* Options */

        this.defaultSettings = {
            NumMaxSugest: 4,
            ScaytEnable: true,
            AutoStart: true,
            Language: 'pt-pt', //'pt-br', 'es'
            Acordo: true,
            Webservice: '',
            GrammarSet: 'Common',
            CanAddWords: false,
            Key: '',
            MaxErrors: 200,
            IgnoreTags: "",
            /* Events */
            onRequest: null,
            onSuccess: null,
            onError: null,
            onTimeout: null
        };

        function extendOptions(d, n) {
            var r = {};
            Object.keys(d).forEach(function (f) {
                r[f] = n.hasOwnProperty(f) ? n[f] : d[f];
            });
            return r;
        }

        var _settings = extendOptions(this.defaultSettings, {});

        var scaytImediateSpellChars = ' .,;:!?\xA0',
            _flipRunning = false,
            _flipStarting = false,
            _pba_ort_error = 'pba_ort_error',
            _pba_gram_error = 'pba_gram_error',
            _pba_hide_error = 'pba_hide_error',
            _ignoredWords = [],
            _minVersion = "1.5.0",
            _wsVersion = "0.0.0",
            _versionValid = false,
            _hasInit = false,
            _ignoretags = {};

        function calcIgnoreTags() {
            _ignoretags = {};
            _settings.IgnoreTags && _settings.IgnoreTags.constructor === String && _settings.IgnoreTags.split(' ').forEach(function (f) {
                var split = f.split(/([\.@#][a-z:=\d]+)/gi).filter(function (i) { return i; });
                if (split.length === 0) return;
                var value = {};
                if (split.length > 1) {
                    var selector = split[1].substr(1);
                    switch (split[1][0]) {
                        case '.':
                            value.attr = 'class';
                            value.value = selector;
                            break;
                        case '#':
                            value.attr = 'id';
                            value.value = selector;
                            break;
                        default:
                            var sa = selector.split('=');
                            value.attr = sa[0];
                            value.value = sa[1];
                            break;
                    }
                }
                _ignoretags[split[0]] = value;
            });
        }

        calcIgnoreTags();

        function trim(str) {
            var trimRegex = /(?:^[\s]+)|(?:[\s]+$)/g;
            return str.replace(trimRegex, '');
        }

        var events = {};
        function doEvent(name, obj, args) {
            for (var i = 0; i < (events[name] && events[name].length || 0) ; i++) {
                events[name][i].apply(obj, args);
            }
        }


        /* métodos publicos */

        this.setTextContainer = function (tc) {
            textContainer = tc;
            spellcheckQueue = [];
        };

        this.on = function (event, callback) {
            if (event && typeof (event) === 'string' &&
                callback && typeof (callback) === 'function') {
                if (!events[event])
                    events[event] = [];
                var e = events[event];
                var idx = e.indexOf(callback);
                if (idx < 0)
                    e.push(callback);
            }
        };

        this.isError = function (element) {
            return isError(element) && element.className.indexOf(_pba_hide_error) < 0;
        };

        this.Settings = function (settings, value) {
            if (typeof (settings) === 'undefined')
                return _settings;
            else if (typeof (settings) === 'object') {
                Object.keys(settings).forEach(function (f) {
                    self.Settings(f, settings[f]);
                });
            }
            else if (typeof (settings) === 'string') {
                if (typeof (value) !== 'undefined') {
                    if (settings.substr(0, 2) === 'on')
                        this.on(settings.substr(2), value);
                    else
                        _settings[settings] = value;

                    if (settings === 'IgnoreTags')
                        calcIgnoreTags();
                }
                else 
                    return _settings[settings];
            }
        };

        this.isRunning = function () {
            return _flipRunning;
        };

        this.status = function () {
            if (_versionValid)
                return spellcheckQueue.length > 0 || waitingForResponseForBlock ? "checking" : "idle";
            else
                return "verErr";
        };

        this.hasErrors = function () {
            if (!(textContainer && textContainer.ownerDocument))
                return false;
            var e = textContainer.ownerDocument.getElementsByTagName('span');
            for (var i = 0; i < e.length; i++) {
                if (isError(e[i]))
                    return true;
            }
            return false;
        };

        this.textContainer = function (textcontainer) {
            if (typeof (textcontainer) === 'undefined')
                return textContainer;
            else
                textContainer = textcontainer;
        };

        this.startEngine = function (coldStart /* false */) {
            if (_flipRunning || _flipStarting) return;
            _flipStarting = true;
            textContainer.setAttribute("spellcheck", false);

            initEngine(function () {
                _flipRunning = true;
                _flipStarting = false;
                if (_versionValid) {
                    removeErrors(textContainer); // para ter a certeza que não fica nada sublinhado
                    doSpellCheck(coldStart);
                }
                else
                    console.log("FLiP Api version is " + _wsVersion + " must be atleast " + _minVersion);
            });
        };

        this.stopEngine = function () {
            if (!_flipRunning) return;
            stopSpellCheck();
            _flipRunning = false;
            _flipStarting = false;
        };

        this.restartEngine = function (coldStart /* true */) {
            this.stopEngine();
            this.startEngine(coldStart !== false);
        };

        this.shutdown = function() {
            this.stopEngine();
            _hasInit = false;
        };

        this.spellCheck = function () {
            if (_flipRunning && _versionValid)
                doSpellCheck();

        };

        this.removeMarkupFromHtml = function (html) {
            if (!(textContainer && textContainer.ownerDocument && html))
                return;
            var escaped = html.replace(/\&nbsp;/g, "___NBSP___");
            var div = textContainer.ownerDocument.createElement('div');
            div.innerHTML = escaped;
            removeErrors(div, true);

            return div.innerHTML.replace(/\&nbsp;/g, " ").replace(/___NBSP___/g, "&nbsp;");
        };

        this.replaceWord = function (node, word) {
            if (!(node && node.error)) return;

            node.textContent = word;
            addToQueue({ block: node.error.block });
            removeNode(node);
        };

        this.addWord = function (node) {
            if (!(node && node.error && trim(node.textContent).length > 0 && _settings.CanAddWords)) return;

            doJSONRequest({
                Url: geturl(),
                Action: ['userdict', _settings.Language, _settings.Acordo ? 'true' : 'false', encodeURIComponent(node.textContent || "")].join("/"),
                key:  _settings.Key,
                Method: "PUT"
            });

            this.ignoreAllWords(node);
        };

        this.ignoreWord = function (node) {
            if (!(node && node.error)) return;
            _ignoredWords.push(node.textContent);
            removeNode(node);
        };

        this.ignoreAllWords = function (node) {
            if (!(node && node.error)) return;
            var word = node.textContent;
            _ignoredWords.push(word);
            var p = [].concat.apply([], node.ownerDocument.getElementsByTagName('span'));
            for (var i = 0; i < p.length; i++) {
                var el = p[i];
                if (isError(el) && el.textContent === word)
                    removeNode(el);
            }
        };

        var onChangeTimer = 0;
        var lastElement = null; // usado para saber o elemento anterior a uma newline
        this.GetKeyEventHandler = function () {
            return function (evt) {
                var sel = getCaretPosition();
                if (_flipRunning && _versionValid && sel) {
                    var key = evt.which || evt.charCode || evt.keyCode || 0;
                    var element = null;
                    if (lastElement && (key === 13 || key === 8 || key === 46)) {
                        element = lastElement;
                    }
                    else {
                        var node = sel.node;
                        while (node && node.parentNode && node !== textContainer) {
                            if (isError(node))
                                removeNode(node);
                            if (!element && tagsBlock[node.nodeName.toLowerCase()])
                                element = node;
                            node = node.parentNode;
                        }
                        lastElement = element;
                    }

                    if (_settings.ScaytEnable) {
                        clearTimeout(onChangeTimer);

                        if (checkErrorCount() && scaytImediateSpellChars.indexOf(String.fromCharCode(key)) >= 0
                            || key === 13 || key === 8 || key === 46) {

                            if (ignoreTag(element))
                                return;
                            var blocks = markBlocks(element);
                            blocks.forEach(function (v) {
                                if (key === 13 || v.checked === 0) {
                                    addToQueue({ block: v, options: { newline: key === 13 } });
                                }
                            });
                        }
                    }
                }
            };
        };

        /* Selection METHODS */
        function hasSelection() {
            var sel = (textContainer.ownerDocument.getSelection ? textContainer.ownerDocument.getSelection() : textContainer.ownerDocument.selection) || null;
            return sel && !sel.isCollapsed;
        }

        function getCaretPosition() {
            var sel = (textContainer.ownerDocument.getSelection ? textContainer.ownerDocument.getSelection() : textContainer.ownerDocument.selection) || null;
            if (sel && sel.isCollapsed) {
                var range = sel && sel.type !== 'None' && sel.getRangeAt && sel.rangeCount ? sel.getRangeAt(0) : null;
                if (range) {
                    range.collapse(true);
                    return {
                        node: range.startContainer,
                        offset: range.startOffset
                    };
                }
            }
            return null;
        }

        function setCaretPosition(p) {
            var sel = (textContainer.ownerDocument.getSelection ? textContainer.ownerDocument.getSelection() : textContainer.ownerDocument.selection) || null;
            if (sel.isCollapsed) {
                var range = sel && sel.type !== 'None' && sel.getRangeAt && sel.rangeCount ? sel.getRangeAt(0) : textContainer.ownerDocument.createRange();
                if (range && sel && p && p.node && p.node.textContent && p.node.textContent.length >= p.offset) {
                    range.setStart(p.node, p.offset);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }

        /* Selection METHODS END */


        /* Funções internas */

        function initDone(callback) {
            return function (result) {
                _hasInit = true;
                if (result && !(result.ErrorCode || result.code)) {
                    _wsVersion = result.Application;
                    _versionValid = compareVersions(_wsVersion, _minVersion) >= 0;
                }
                callback();
            };
        }

        function initEngine(callback) {
            if (_hasInit)
                callback();
            else {
                var initdone = initDone(callback);
                doJSONRequest({
                    Url: geturl(),
                    Action: 'version',
                    Method: 'GET',
                    onRequest: function () { },
                    onSuccess: initdone,
                    onError: initdone,
                    onTimeout: initdone
                });
            }
        }

        function versionFromString(str) {
            var values = [];
            if (str) {
                var arr = null;
                var re = /([0-9]+)\.{0,1}/g;
                while ((arr = re.exec(str)) !== null)
                    values.push(+arr[1]);
            }
            return values;
        }

        function compareVersions(v1, v2) {
            var mv1 = versionFromString(v1);
            var mv2 = versionFromString(v2);
            var cmp = 0;
            for (var i = 0; i < Math.min(mv1.length, mv2.length) && cmp === 0; i++) {
                var r = mv1[i] - mv2[i];
                cmp = r !== 0 ? r / Math.abs(r) : 0;
            }

            return cmp;
        }

        function ignoreTag(element) {
            if (_settings.IgnoreTags && element && element.nodeName) {
                var itag = _ignoretags[element.nodeName.toLowerCase()];
                if (itag)
                {
                    if (itag.attr) {
                        var attrvalue = element.getAttribute(itag.attr);
                        return attrvalue ? attrvalue.indexOf(itag.value) >= 0 : false;
                    }
                    else
                        return true;
                }
            }
            return false;
        }

        function geturl() {
            var url = _settings.Webservice;
            if (url.length > 0 && url[url.length - 1] !== '/')
                url += '/';
            return url;
        }

        function isError(element) {
            return (element && element.className &&
                (element.className.indexOf(_pba_ort_error) >= 0 ||
                element.className.indexOf(_pba_gram_error) >= 0)) === true;
        }

        function stopSpellCheck() {
            removeErrors(textContainer);
        }

        var _doingCheck = false;
        function doSpellCheck(coldStart) {
            if (_doingCheck) return;
            _doingCheck = true;

            var p = [];
            if (_settings.IgnoreTags) {
                traverseDom(textContainer, function (node) {
                    if (node && node.nodeName) {
                        if (ignoreTag(node))
                            return false;
                        if (tagsBlock[node.nodeName.toLowerCase()])
                            p.push(node);
                        return true;
                    }
                    return false;
                });
            }
            else {
                Object.keys(tagsBlock).forEach(function (f) {
                    var elements = textContainer.getElementsByTagName(f);
                    if (elements.length)
                        p.push.apply(p, elements);
                });
            }

            p.forEach(function (n) {
                if (n.nodeType !== 1)
                    return;

                if (coldStart)
                    n.blocks = null;

                if (checkErrorCount()) {
                    var blocks = markBlocks(n);
                    blocks.forEach(function (v) {
                        if (v.checked === 1) {
                            if (!areErrorsMarked(v.erros))
                                markErrors(v, v.erros);
                        }
                        else if (v.checked === 0) {
                            addToQueue({ block: v });
                        }
                    });
                }
            });
            _doingCheck = false;
        }

        var spellcheckQueue = [];
        var waitingForResponseForBlock = null;
        var _processing = false;

        function addToQueue(b) {
            if (b && b.block) {
                if (spellcheckQueue.filter(function (f) { return f.block.hash === b.block.hash; }).length === 0) {
                    spellcheckQueue.push(b);
                }
            }
        }

        var _nextAutoCheck = 0;
        function processQueue() {
            if (_flipRunning && _versionValid && waitingForResponseForBlock === null) {
                var time = (new Date()).getTime();
                if (spellcheckQueue.length > 0) {
                    if (_processing)
                        return;
                    _processing = true;

                    var element = spellcheckQueue.shift();

                    if (!hasSelection() && checkErrorCount(true) && element && element.block && element.block.element && element.block.element.parentNode && element.block.element.offsetParent) {
                        var block = element.block;

                        var hash = getBlockHash(block);
                        if (hash !== block.hash) {
                            block.hash = null;
                            block.checked = 0;
                        }
                        else if (block.checked === 0) {
                            var texto = block.text;
                            if (trim(texto).length > 0) {
                                block.checked = 2; // a correr
                                block.request = {
                                    id: doJSONRequest({
                                        Url: geturl(),
                                        Action: ['check', _settings.Language, _settings.GrammarSet, _settings.Acordo ? 'true' : 'false'].join("/"),
                                        key: _settings.Key,
                                        onSuccess: responseReceived,
                                        onTimeout: responseTimeout,
                                        onError: responseError,
                                        Params: {
                                            nline: element.options && element.options.newline ? 'true' : 'false'
                                        },
                                        Data: texto
                                    }),
                                    hash: hash
                                };
                                waitingForResponseForBlock = block;
                            }
                            else
                                block.checked = 1;
                        }
                    }
                    else {
                        setTimeout(processQueue, 0);
                    }
                    _processing = false;
                    _nextAutoCheck = time + 15000;
                }
                else if (time > _nextAutoCheck) {
                    doSpellCheck(false);
                    _nextAutoCheck = time + 15000;
                }
            }
        }
        setInterval(processQueue, 100);

        function doJSONRequest(options) {
            var url = options.Url || null,
            action = options.Action || null,
            params = options.Params || null,
            data = options.Data || null,
            method = options.Method || "POST",
            contenttype = options.contentType || "text/plain",
            key = options.key || "",
            // Callbacks - por defeito chama os eventos associados
            on_r = options.onRequest || function (action, params, data) { doEvent("Request", this, [action, params, data]); },
            on_s = options.onSuccess || function (result) { doEvent("Success", this, [result]); },
            on_t = options.onTimeout || function () { doEvent("Timeout", this, null); },
            on_e = options.onError || function (response) { doEvent("Error", this, [response]); };

            var xmlhttprequest = new XMLHttpRequest();
            if (xmlhttprequest) {
                var sparams = (params && ("?" + serialize(params))) || "";
                xmlhttprequest.open(method, url + action + sparams, true);
                xmlhttprequest.setRequestHeader("Content-type", contenttype);
                xmlhttprequest.setRequestHeader("X-Priberam-auth-key", key)
                xmlhttprequest.responseType = "json";
                xmlhttprequest.async = true;
                xmlhttprequest.ontimeout = on_t;
                xmlhttprequest.onreadystatechange = function () {
                    if (xmlhttprequest.readyState === 4) {
                        var response;
                        try {
                            response = JSON.parse(xmlhttprequest.responseText);
                        }
                        catch (err) {
                            response = xmlhttprequest.response;
                        }

                        if (xmlhttprequest.status === 200) {
                            on_s(response);
                        }
                        else {
                            on_e({
                                status: xmlhttprequest.status,
                                reason: xmlhttprequest.statusText
                            });
                            spellcheckQueue = [];
                        }
                    }

                };
                xmlhttprequest.timeout = 10000;

                on_r(action, params, data);
                xmlhttprequest.send(data);

            }

        }

        function serialize(obj, prefix) {
            if (obj) {
                var pre = (prefix && encodeURIComponent(prefix)) || "";
                return Object.keys(obj).map(function (k) {
                    return pre + encodeURIComponent(k) + "=" + encodeURIComponent(obj[k] === undefined ? "" : obj[k].toString());
                }).join("&");
            }
            else
                return "";
        }

        function responseReceived(result) {
            if (!result || (result && (result.ErrorCode || result.code))) {
                doEvent("Error", this, [result]);
                spellcheckQueue = [];
            }
            else if (waitingForResponseForBlock && !hasSelection()) {
                doEvent("Success", this, [result]);

                var element = waitingForResponseForBlock;
                var newhash = getBlockHash(element);
                // Verifica se a texto não mudou entretanto
                if (newhash === element.request.hash) {
                    var offset = 0;
                    for (var j = 0; j < result.length; j++) {
                        var json = result[j];
                        if (json.errors && json.errors.length > 0) {
                            for (var i = 0; i < json.errors.length; i++) {
                                json.errors[i].spos += offset;
                                json.errors[i].block = element;
                                var e1 = json.errors[i].spos;
                                var e2 = e1 + json.errors[i].len;
                                // ignora erros sobrepostos
                                var a = element.erros.filter(function (f) {
                                    var f1 = f.spos;
                                    var f2 = f.spos + f.len;
                                    return f2 >= e1 && f1 <= e2;
                                });

                                if (a.length == 0)
                                    element.erros.push(json.errors[i]);
                            }
                        }
                        offset += json.len;
                        markErrors(element, element.erros);
                        element.checked = 1;

                    }
                }
            }
            waitingForResponseForBlock = null;
        }

        function responseTimeout() {
            doEvent("Timeout", this, null);
            spellcheckQueue = [];

            if (waitingForResponseForBlock)
                waitingForResponseForBlock.hash = null;
            waitingForResponseForBlock = null;
        }

        function responseError(err) {
            doEvent("Error", this, [err]);
            spellcheckQueue = [];

            if (waitingForResponseForBlock)
                waitingForResponseForBlock.hash = null;
            waitingForResponseForBlock = null;
        }

        function checkErrorCount(update) {
            var spans = [].concat.apply([], textContainer.ownerDocument.getElementsByClassName(_pba_gram_error));
            spans = [].concat.apply(spans, textContainer.ownerDocument.getElementsByClassName(_pba_ort_error));
            if (update) {
                spans.forEach(function (v) {
                    v.setAttribute("class", v.getAttribute("class").replace(_pba_hide_error, ""));
                });
                if (spans.length >= _settings.MaxErrors) {
                    spans.forEach(function (v) {
                        v.setAttribute("class", v.getAttribute("class").trim() + " " + _pba_hide_error);
                    });
                }
            }
            return spans.length < _settings.MaxErrors;
        }

        function getHash(text) {
            return murmurhash3_32_gc(text || '', 25);
        }

        function doRangeIntersect(r1, r2, touch) {
            if (!r1 || !r2)
                return false;
            touch = touch === false ? false : true;
            try {
                return r1.compareBoundaryPoints(Range.END_TO_START, r2) * r2.compareBoundaryPoints(Range.END_TO_START, r1) >= (touch ? 0 : 1);
            }
            catch (err) {
                return false;
            }
        }

        function traverseDom(node, callback) {
            if (callback(node)) {
                node = node.firstChild;
                while (node) {
                    traverseDom(node, callback);
                    node = node.nextSibling;
                }
            }
        }

        function getBlockTextNodes(block) {

            if (!block || !block.element) return [];

            var textNodes = getAllTextNodes(block.element);
            if (textNodes.length <= block.index)
                return [];
            return textNodes[block.index];
        }

        function getAllTextNodes(root) {

            var descendants = [];
            var current = [];
            traverseDom(root, function (node) {
                if (node && node.nodeName && tagsBlock[node.nodeName.toLowerCase()]) {
                    if (current.length > 0)
                        descendants.push(current);
                    current = [];
                    if (node !== root)
                        return false;
                }
                else if (node.nodeType === 3)
                    current.push(node);
                return true;
            });
            if (current.length > 0)
                descendants.push(current);
            return descendants;
        }

        function createTag(tipo) {

            var tag = textContainer.ownerDocument.createElement('span');
            tag.className = (tipo === 'spell' ? _pba_ort_error : _pba_gram_error);
            if (tipo === 1) {
                tag.onmouseover = function () {
                    //showToolTip(tag);
                };
                tag.onmouseout = function () {
                    //hideToolTip(tag);
                };
            }

            return tag;
        }

        function surroundNodeTextWithTag(block, offset, length, tag) {

            var textNodes = getBlockTextNodes(block);

            var startNode = null, endNode = null;
            var start = offset;
            var i = 0;
            for (; i < textNodes.length; i++) {
                if (textNodes[i].length > start) {
                    startNode = textNodes[i];
                    break;
                }
                start -= textNodes[i].length;
            }

            if (!startNode)
                return false;

            var end = length + start;
            for (; i < textNodes.length; i++) {
                if (textNodes[i].length >= end) {
                    endNode = textNodes[i];
                    break;
                }
                end -= textNodes[i].length;
            }
            if (!endNode)
                return false;

            try {
                var range = textContainer.ownerDocument.createRange();
                range.setStart(startNode, start);
                range.setEnd(endNode, end);

                var pos = getCaretPosition();
                if (pos && pos.node) {

                    var caretRange = textContainer.ownerDocument.createRange();
                    caretRange.setStart(pos.node, pos.offset);
                    caretRange.collapse(true);

                    if (range.compareBoundaryPoints(Range.START_TO_END, caretRange) < 0) {
                        if (range.startContainer === pos.node) {
                            tag.appendChild(range.extractContents());
                            range.insertNode(tag);
                            //setCaretPosition({
                            //    node: tag.nextSibling,
                            //    offset: pos.offset - range.startOffset - tag.textContent.length
                            //});
                        }
                        else {
                            tag.appendChild(range.extractContents());
                            range.insertNode(tag);
                        }
                    }
                    else if (range.compareBoundaryPoints(Range.START_TO_START, caretRange) > 0) {
                        tag.appendChild(range.extractContents());
                        range.insertNode(tag);
                    }
                    else if (range.commonAncestorContainer == caretRange.commonAncestorContainer) {
                        var dif = pos.offset - range.startOffset;
                        if (range.startContainer === pos.node)
                            dif = pos.offset - range.startOffset;
                        else {
                            for (i = textNodes.indexOf(range.startContainer) ; i < textNodes.length && textNodes[i] !== pos.node; i++) {
                                dif += textNodes[i].textContent.length;
                            }
                        }
                        tag.appendChild(range.extractContents());
                        range.insertNode(tag);
                        var textnode = null, lastnode = null;
                        traverseDom(tag, function (node) {
                            if (!textnode && node.nodeType === 3) {
                                if (node.textContent.length > dif)
                                    textnode = node;
                                else
                                    dif -= node.textContent.length;
                                lastnode = node;
                            }
                            return true;
                        });

                        setCaretPosition({
                            node: textnode ? textnode : lastnode,
                            offset: textnode ? dif : lastnode.length
                        });
                    }
                }
                else {

                    tag.appendChild(range.extractContents());
                    range.insertNode(tag);
                }
                //removeErrors(tag);


                return tag;
            }
            catch (err) {
                return null;
            }
        }

        function removeNode(node, ignorecursor) {
            if (!node || !node.parentNode)
                return;
            var pos = null;
            if (ignorecursor !== true)
                pos = getCaretPosition();
            while (node.firstChild) {
                node.parentNode.insertBefore(node.firstChild, node);
            }
            node.parentNode.removeChild(node);
            if (pos)
                setCaretPosition(pos);
        }

        function removeErrors(element, ignorecursor) {
            if (!element) return;

            var spans = [].concat.apply([], element.getElementsByTagName('span'));
            for (var i = 0; i < spans.length; i++) {
                if (isError(spans[i]))
                    removeNode(spans[i], ignorecursor);
            }
        }


        function getBlockErrors(block) {
            if (!block || !block.element)
                return;
            var erros = [];
            var r1 = textContainer.ownerDocument.createRange();
            var r2 = textContainer.ownerDocument.createRange();

            var tn = getBlockTextNodes(block);
            r1.setStartBefore(tn[0]);
            r1.setEndAfter(tn[tn.length - 1]);

            var spans = [].concat.apply([], block.element.getElementsByTagName('span'));
            for (var i = 0; i < spans.length; i++) {
                if (isError(spans[i])) {
                    r2.selectNode(spans[i]);
                    if (doRangeIntersect(r1, r2, false))
                        erros.push(spans[i]);
                }
            }
            return erros;
        }

        function removeBlockErrors(block) {
            if (!block || !block.element)
                return;
            var erros = getBlockErrors(block);
            for (var i = 0; i < erros.length; i++) {
                removeNode(erros[i]);
            }

        }

        function areErrorsMarked(errors) {
            for (var i = 0; i < (errors && errors.length || 0) ; i++) {
                if (!errors[i].tag || !errors[i].tag.parentNode)
                    return false;
            }
            return true;
        }

        function markErrors(block, erros) {
            if (!block || !block.element) return;

            removeBlockErrors(block);

            if (!erros || erros.length === 0) return;

            for (var i = 0; i < erros.length; i++) {
                var erro = erros[i];

                if (_ignoredWords.indexOf(block.text.substr(erro.spos, erro.len)) >= 0)
                    continue;

                var tag = createTag(erro.type);
                surroundNodeTextWithTag(block, erro.spos, erro.len, tag);
                tag.error = erro;
                erro.tag = tag;
            }
        }

        function getBlockHash(block) {
            if (!(block && block.element && block.element.parentNode))
                return '';

            var r = textContainer.ownerDocument.createRange();
            r.selectNode(block.element);
            return getHash(r.toString().substr(block.offset, block.size));
        }

        function markBlocks(element) {
            if (!element)
                return [];

            var tn = getAllTextNodes(element);
            if (tn.length === 0)
                return [];

            var range = textContainer.ownerDocument.createRange();
            if (!element.blocks)
                element.blocks = [];

            var blocks = [];
            var offset = 0;
            for (var i = 0; i < tn.length; i++) {
                var n = tn[i];
                range.setStartBefore(n[0]);
                range.setEndAfter(n[n.length - 1]);
                var str = range.toString();
                var hash = getHash(str);

                if (i < element.blocks.length && hash === element.blocks[i].hash) {
                    blocks.push(element.blocks[i]);
                }
                else {
                    var block = {
                        element: element,
                        index: i,
                        offset: offset,
                        size: str.length,
                        hash: hash,
                        text: str,
                        erros: [],
                        checked: 0
                    };
                    blocks.push(block);
                }
                offset += str.length;
            }

            element.blocks = blocks;
            return blocks;
        }
    };
})(window);