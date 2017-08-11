(function () {
    tinymce.PluginManager.add('flip', function (editor, url) {
        editor.settings.contextmenu = editor.settings.contextmenu || 'flip link image inserttable | cell row column deletetable';
        // Strings
        var default_strings = {
            "maissugestoes": "Mais sugestões",
            "flip_adiciona": "Adiciona palavra",
            "flip_ignora": "Ignora",
            "flip_ignora_todos": "Ignora todos",
            "err_timeout": "FLiP: A ligação ao servidor expirou."
        };

        var strings = {};

        function _s(id) {
            if (strings[id] !== undefined)
                return strings[id];
            else
                return default_strings[id];
        }

        // ContextMenu
        var contextMenuCommand = function (e) {
            var contextmenu = editor.settings.contextmenu;
            var node = e.toElement || e.target;

            var nodeCheck = node;
            while (nodeCheck.parentNode && nodeCheck !== editor.getBody()) {
                if (editor.flipinstance.isError(nodeCheck)) {
                    node = nodeCheck;
                    break;
                }
                nodeCheck = nodeCheck.parentNode;
            }

            // Block TinyMCE menu on ctrlKey
            if (!(editor.flipinstance && editor.flipinstance.isError(node) && node.error)
                || (e.ctrlKey && !editor.settings.contextmenu_never_use_native)) {
                return;
            }

            // Quando o flip está activo esconde o menu contexto sempre
            if (editor.flipinstance && editor.flipinstance.isRunning() && originalMenu)
                originalMenu.hideAll();

            if (e.preventDefault)
                e.preventDefault();

            /* Sugestoes */
            var contextSug = '', contextMessage = '', list;
            if (node.error && node.error.desc) {
                list = null;
                if (node.error.expl) {
                    list = [{
                        text: node.error.expl,
                        onPostRender: function () {
                            var menuEl = this.getEl();
                            tinymce.each(menuEl.getElementsByTagName('span'), function (el) {
                                if (el.className.indexOf('mce-text') < 0) return;
                                el.innerHTML = el.textContent;
                            });
                        }
                    }];
                }

                editor.addMenuItem('flip_mensagem', {
                    text: node.error.desc,
                    menu: list
                });
                contextMessage = ' | flip_mensagem';


            }

            if (node.error && node.error.list_sug && node.error.list_sug.length > 0) {
                var i, sugestao;
                for (i = 0; i < node.error.list_sug.length && i < editor.flipinstance.Settings().NumMaxSugest; i++) {
                    sugestao = node.error.list_sug[i];
                    var sugid = sugestao.replace(/[ ,]/g, '_');
                    editor.addMenuItem(sugid, {
                        text: sugestao,
                        onclick: (function (s, n) {
                            return function () {
                                editor.flipinstance.replaceWord(n, s);
                            };
                        })(sugestao, node)
                    });
                    contextSug += sugid + ' ';
                }

                contextSug += ' | ';

                if (node.error.list_sug.length > editor.flipinstance.Settings().NumMaxSugest) {
                    list = [];
                    for (i = editor.flipinstance.Settings().NumMaxSugest; i < node.error.list_sug.length; i++) {
                        sugestao = node.error.list_sug[i];
                        list.push({
                            text: sugestao,
                            onclick: (function (s, n) {
                                return function () {
                                    editor.flipinstance.replaceWord(n, s);
                                };
                            })(sugestao, node)
                        });
                    }

                    editor.addMenuItem('maissugestoes', {
                        text: _s('maissugestoes'),
                        menu: list
                    });

                    contextSug += ' maissugestoes | ';
                }
            }

            /* Controlos */
            if (node.error.type === 'spell') {
                editor.addMenuItem('flip_adiciona', {
                    text: _s('flip_adiciona'),
                    onclick: (function (n) {
                        return function () {
                            editor.flipinstance.addWord(n);
                        };
                    })(node)
                });
            }

            editor.addMenuItem('flip_ignora', {
                text: _s('flip_ignora'),
                onclick: (function (n) {
                    return function () {
                        editor.flipinstance.ignoreWord(n);
                    };
                })(node)
            });

            editor.addMenuItem('flip_ignora_todos', {
                text: _s('flip_ignora_todos'),
                onclick: (function (n) {
                    return function () {
                        editor.flipinstance.ignoreAllWords(n);
                    };
                })(node)
            });

            contextmenu = contextSug + (node.error.type === 'spell' && editor.flipinstance.Settings().CanAddWords ? 'flip_adiciona ' : '') + 'flip_ignora flip_ignora_todos' + contextMessage;

            var items = [];

            tinymce.each(contextmenu.split(/[ ,]/), function (name) {
                var item = editor.menuItems[name];
                if (name === '|') {
                    item = { text: name };
                }

                if (item) {
                    item.shortcut = ''; // Hide shortcuts
                    items.push(item);
                }
            });

            for (var i = 0; i < items.length; i++) {
                if (items[i].text === '|') {
                    if (i === 0 || i === items.length - 1) {
                        items.splice(i, 1);
                    }
                }
            }

            menu && menu.remove();
            menu = new tinymce.ui.Menu({
                items: items,
                context: 'flipcontext',
                onCancel: function () {
                    if (menu) {
                        menu.hide();
                        menu = null;
                    }
                }
            }).renderTo(document.body);

            editor.on('remove', function () {
                menu.remove();
                menu = null;
            });


            // Position menu
            var pos = { x: e.pageX, y: e.pageY };

            if (!editor.inline) {
                pos = tinymce.DOM.getPos(editor.getContentAreaContainer());
                pos.x += e.clientX;
                pos.y += e.clientY;
            }

            menu.moveTo(pos.x, pos.y);
            menu.show();

            var menuEl = menu.getEl();
            tinymce.each(menuEl.getElementsByTagName('span'), function (el) {
                if (el.className.indexOf('mce-text') < 0) return;
            });

            if (!tinymce.isIE) {
                menuEl.style.maxHeight = 'inherit';
                menuEl.style.position = 'absolute';
                menuEl.style.overflow = 'visible';
            } else {
                menuEl.style.height = 'auto';

                if (window.JSON) {
                    menuEl.style.maxHeight = 'inherit';
                    menuEl.style.overflow = 'inherit';
                }
            }

        };


        // Add a button that opens a window
        var button = null;
        editor.addButton('flip', {
            text: '',
            icon: 'flipicon',
            active: false,
            onpostrender: function () {
                button = this;
            },
            onclick: function () {
                this.active(!this.active());
                if (this.active()) {
                    editor.flipinstance.Settings(editor.flipoptions);
                    editor.flipinstance.startEngine();
                }
                else {
                    editor.flipinstance.stopEngine();
                }

                if (editor.flipinstance.Settings().ScaytEnable == false)
                    editor.getBody().setAttribute('contenteditable', !this.active());
            }
        });

        function showErrorMessage(message) {
            editor.windowManager.alert(message);
            editor.setProgressState(false);
        }

        var errorDotTimer = 0;
        function showErrorDot(timeout) {
            clearTimeout(errorDotTimer);
            if (!jQuery) return;
            var flipButton = jQuery(editor.getContainer()).find('i.mce-i-flipicon');
            var dot = flipButton.siblings('svg');
            if (dot.length === 0) {
                var svgNS = "http://www.w3.org/2000/svg";
                var svg = document.createElementNS(svgNS, "svg");
                var c = document.createElementNS(svgNS, "circle");
                c.setAttributeNS(null, "cx", 2);
                c.setAttributeNS(null, "cy", 2);
                c.setAttributeNS(null, "r", 2);
                c.setAttributeNS(null, "fill", "red");
                c.setAttributeNS(null, "stroke", "none");
                svg.appendChild(c);

                dot = jQuery(svg).appendTo(flipButton.parent()).css({
                    position: 'absolute',
                    right: '2px',
                    bottom: '2px',
                    width: '5px',
                    height: '5px'
                });
            }
            dot.show();
            errorDotTimer = setTimeout(function () { dot.fadeOut(500); }, timeout || 10000);
        }

        /* bit config 
        * 0 - Dot alert (1)/ modal alert (0)
        * 1 - Timeout
        * 2 - Error
        * Event config (on / off)
        * 3 - Set content
        * 4 - Get content
        * 5 - key press
        * 6 - key down
        * 7 - focus
        * 8 - click
        * 9 - undo
        */

        var internal_settings = 0xFFFF;

        var nextTimeoutMessage = 1000, showTimeout = true;
        function ontimeout() {
            if ((internal_settings >> 1) & 0x1) {
                if (internal_settings & 0x1) {
                    showErrorDot();
                }
                else {

                    if (showTimeout) {
                        showErrorMessage(_s('err_timeout'));
                        showTimeout = false;
                        setTimeout(function () { showTimeout = true; }, nextTimeoutMessage);
                        nextTimeoutMessage *= 1.5;
                    }
                }
            }
        }

        function onerror(error) {
            if ((internal_settings >> 2) & 0x1) {
                if (internal_settings & 0x1)
                    showErrorDot();
                else {
                    showErrorMessage(error.Message);
                    this.stopEngine();
                    button && button.active(false);
                }
            }
        }



        tinymce.DOM.loadCSS(url + '/flip.css'); // Carrega o css no dom do tinymce
        editor.on('PreInit', function () {
            var scriptLoader = new tinymce.dom.ScriptLoader();
            if (typeof (FLiPEngine) === 'undefined')
                scriptLoader.add(url + '/engine.js');
            if (typeof (murmurhash3_32_gc) === 'undefined')
                scriptLoader.add(url + '/murmurhash3_gc.js');
            scriptLoader.loadQueue(function () {
                editor.flipinstance = new FLiPEngine(editor.contentDocument.body);
                var opt = tinymce.flipoptions || window.flipoptions || {};
                strings = tinymce.flipstrings || window.flipstrings || {};
                editor.flipinstance.Settings(opt);
                internal_settings = opt.flip_internal_settings !== undefined ? opt.flip_internal_settings : internal_settings;
                // Só quando os scripts estiverem carregados é que passa ao trabalho
                if (editor.flipinstance.Settings().AutoStart) {
                    button && button.active(true);
                    editor.flipinstance.startEngine();
                }

                editor.flipinstance.on('Error', onerror);
                editor.flipinstance.on('Timeout', ontimeout);

            });

            editor.dom.loadCSS(url + '/flip.css'); // Carrega o css no dom do iframe
        });

        editor.on('Init', function () {
            var resizer = tinymce.dom.DomQuery(".mce-statusbar .mce-container-body")
            if (!resizer.length) return;
            var status = tinymce.dom.DomQuery("<div class='flipstatus tinymce'></div>");
            resizer.prepend(status);

            setInterval(function () {
                if (!editor.flipinstance) return;

                var classes = ['flipstatus', 'tinymce'];

                if (!editor.flipinstance.isRunning())
                    classes.push("stopped");

                if (editor.flipinstance.status() === "verErr")
                    classes.push("version_mismatch");
                else if (editor.flipinstance.status() === "idle")
                    classes.push(editor.flipinstance.hasErrors() ? "haserrors" : "noerrors");
                else
                    classes.push("checking");
                status.attr("class", classes.join(' '));

            }, 100);


        });

        editor.on('SetContent', function () {
            if ((internal_settings >> 3) & 0x1) {
                if (!(editor.flipinstance && editor.flipinstance.isRunning())) {
                    return;
                }
                editor.flipinstance.spellCheck();
            }
        });

        editor.on('GetContent', function (data) {
            if ((internal_settings >> 4) & 0x1) {
                data.preventDefault();
                if (editor.flipinstance && editor.flipinstance.isRunning() && data.content) {
                    var text = editor.flipinstance.removeMarkupFromHtml(data.content);
                    data.content = text;
                }
            }
        });

        editor.on('KeyPress', function (evt) {
            if ((internal_settings >> 5) & 0x1 && !evt.ctrlKey && !evt.altKey) {
                var key = evt.which || evt.charCode || 0;
                if (editor.flipinstance && key > 0) {
                    setTimeout(function () {
                        editor.flipinstance.GetKeyEventHandler()(evt);
                    }, 0);
                }
            }
        });

        editor.on('Keydown', function (evt) {
            if ((internal_settings >> 6) & 0x1 && !evt.ctrlKey && !evt.altKey) {
                var key = evt.which || evt.charCode || evt.keyCode || 0;
                if (editor.flipinstance &&
                    (key === 8 /* backspace */ ||
                     key === 46 /* Delete */ ||
                     key === 13 /* newline*/)) {
                    setTimeout(function () {
                        editor.flipinstance.GetKeyEventHandler()(evt);
                    }, 0);
                }
            }
        });

        editor.on('focus', function () {
            if ((internal_settings >> 7) & 0x1) {
                if (editor.flipinstance && editor.flipinstance.Settings().ScaytEnable) {
                    editor.flipinstance.spellCheck();
                }
            }
        });

        editor.on('blur', function () {
            if ((internal_settings >> 7) & 0x1) {
                if (editor.flipinstance && editor.flipinstance.Settings().ScaytEnable) {
                    editor.flipinstance.spellCheck();
                }
            }
        });

        editor.on('click', function () {
            if ((internal_settings >> 8) & 0x1) {
                if (editor.flipinstance && editor.flipinstance.Settings().ScaytEnable) {
                    editor.flipinstance.spellCheck();
                }
            }
        });

        editor.on('undo', function () {
            if ((internal_settings >> 9) & 0x1) {
                if (!(editor.flipinstance && editor.flipinstance.isRunning())) {
                    return;
                }
                editor.flipinstance.restartEngine();
            }
        });

        editor.on('pastepreprocess', function (data) {
            if (editor.flipinstance && data.content) {
                var str = editor.flipinstance.removeMarkupFromHtml(data.content);
                data.content = str;
            }
        });

        editor.on('BeforeExecCommand', function (e) {
            if (e.command === 'mceNewDocument' || e.command === 'RemoveFormat') {
                if (!(editor.flipinstance && editor.flipinstance.isRunning())) {
                    return;
                }
                editor.flipinstance.restartEngine();
            }
        });

        var originalMenu = null, menu = null;
        editor.on('contextmenu', contextMenuCommand);

        // Adds a menu item to the tools menu
        editor.addMenuItem('flip', {
            onPostRender: function () {
                this.visible(false);
                originalMenu = this._parent;
            }
        });
    });
})();