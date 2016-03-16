"format global";
(function(global) {

  var defined = {};

  // indexOf polyfill for IE8
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var getOwnPropertyDescriptor = true;
  try {
    Object.getOwnPropertyDescriptor({ a: 0 }, 'a');
  }
  catch(e) {
    getOwnPropertyDescriptor = false;
  }

  var defineProperty;
  (function () {
    try {
      if (!!Object.defineProperty({}, 'a', {}))
        defineProperty = Object.defineProperty;
    }
    catch (e) {
      defineProperty = function(obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }
  })();

  function register(name, deps, declare) {
    if (arguments.length === 4)
      return registerDynamic.apply(this, arguments);
    doRegister(name, {
      declarative: true,
      deps: deps,
      declare: declare
    });
  }

  function registerDynamic(name, deps, executingRequire, execute) {
    doRegister(name, {
      declarative: false,
      deps: deps,
      executingRequire: executingRequire,
      execute: execute
    });
  }

  function doRegister(name, entry) {
    entry.name = name;

    // we never overwrite an existing define
    if (!(name in defined))
      defined[name] = entry;

    // we have to normalize dependencies
    // (assume dependencies are normalized for now)
    // entry.normalizedDeps = entry.deps.map(normalize);
    entry.normalizedDeps = entry.deps;
  }


  function buildGroups(entry, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];

      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;

      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {

        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, groups);
    }
  }

  function link(name) {
    var startEntry = defined[name];

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry);
        else
          linkDynamicModule(entry);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(global, function(name, value) {
      module.locked = true;

      if (typeof name == 'object') {
        for (var p in name)
          exports[p] = name[p];
      }
      else {
        exports[name] = value;
      }

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          for (var j = 0; j < importerModule.dependencies.length; ++j) {
            if (importerModule.dependencies[j] === module) {
              importerModule.setters[j](exports);
            }
          }
        }
      }

      module.locked = false;
      return value;
    });

    module.setters = declaration.setters;
    module.execute = declaration.execute;

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      else if (depEntry && !depEntry.declarative) {
        depExports = depEntry.esModule;
      }
      // in the module registry
      else if (!depEntry) {
        depExports = load(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else
        module.dependencies.push(null);

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name) {
    var exports;
    var entry = defined[name];

    if (!entry) {
      exports = load(name);
      if (!exports)
        throw new Error("Unable to load dependency " + name + ".");
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, []);

      else if (!entry.evaluated)
        linkDynamicModule(entry);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i]);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);

    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;
 
    if (exports && exports.__esModule) {
      entry.esModule = exports;
    }
    else {
      entry.esModule = {};
      
      // don't trigger getters/setters in environments that support them
      if (typeof exports == 'object' || typeof exports == 'function') {
        if (getOwnPropertyDescriptor) {
          var d;
          for (var p in exports)
            if (d = Object.getOwnPropertyDescriptor(exports, p))
              defineProperty(entry.esModule, p, d);
        }
        else {
          var hasOwnProperty = exports && exports.hasOwnProperty;
          for (var p in exports) {
            if (!hasOwnProperty || exports.hasOwnProperty(p))
              entry.esModule[p] = exports[p];
          }
         }
       }
      entry.esModule['default'] = exports;
      defineProperty(entry.esModule, '__useDefault', {
        value: true
      });
    }
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen) {
    var entry = defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!defined[depName])
          load(depName);
        else
          ensureEvaluated(depName, seen);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(global);
  }

  // magical execution function
  var modules = {};
  function load(name) {
    if (modules[name])
      return modules[name];

    // node core modules
    if (name.substr(0, 6) == '@node/')
      return require(name.substr(6));

    var entry = defined[name];

    // first we check if this module has already been defined in the registry
    if (!entry)
      throw "Module " + name + " not present.";

    // recursively ensure that the module and all its 
    // dependencies are linked (with dependency group handling)
    link(name);

    // now handle dependency execution in correct order
    ensureEvaluated(name, []);

    // remove from the registry
    defined[name] = undefined;

    // exported modules get __esModule defined for interop
    if (entry.declarative)
      defineProperty(entry.module.exports, '__esModule', { value: true });

    // return the defined module object
    return modules[name] = entry.declarative ? entry.module.exports : entry.esModule;
  };

  return function(mains, depNames, declare) {
    return function(formatDetect) {
      formatDetect(function(deps) {
        var System = {
          _nodeRequire: typeof require != 'undefined' && require.resolve && typeof process != 'undefined' && require,
          register: register,
          registerDynamic: registerDynamic,
          get: load, 
          set: function(name, module) {
            modules[name] = module; 
          },
          newModule: function(module) {
            return module;
          }
        };
        System.set('@empty', {});

        // register external dependencies
        for (var i = 0; i < depNames.length; i++) (function(depName, dep) {
          if (dep && dep.__esModule)
            System.register(depName, [], function(_export) {
              return {
                setters: [],
                execute: function() {
                  for (var p in dep)
                    if (p != '__esModule' && !(typeof p == 'object' && p + '' == 'Module'))
                      _export(p, dep[p]);
                }
              };
            });
          else
            System.registerDynamic(depName, [], false, function() {
              return dep;
            });
        })(depNames[i], arguments[i]);

        // register modules in this bundle
        declare(System);

        // load mains
        var firstLoad = load(mains[0]);
        if (mains.length > 1)
          for (var i = 1; i < mains.length; i++)
            load(mains[i]);

        if (firstLoad.__useDefault)
          return firstLoad['default'];
        else
          return firstLoad;
      });
    };
  };

})(typeof self != 'undefined' ? self : global)
/* (['mainModule'], ['external-dep'], function($__System) {
  System.register(...);
})
(function(factory) {
  if (typeof define && define.amd)
    define(['external-dep'], factory);
  // etc UMD / module pattern
})*/

(['1'], [], function($__System) {

$__System.registerDynamic("2", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function() {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(done, value) {
    return {
      value: value,
      done: !!done
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toString = {}.toString;
  module.exports = function(it) {
    return toString.call(it).slice(8, -1);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6", ["5"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = req('5');
  module.exports = 0 in Object('z') ? Object : function(it) {
    return cof(it) == 'String' ? it.split('') : Object(it);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    if (it == undefined)
      throw TypeError("Can't call method on  " + it);
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("8", ["6", "7"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var IObject = req('6'),
      defined = req('7');
  module.exports = function(it) {
    return IObject(defined(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("9", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = module.exports = typeof window != 'undefined' && window.Math == Math ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
  if (typeof __g == 'number')
    __g = global;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var core = module.exports = {version: '1.2.2'};
  if (typeof __e == 'number')
    __e = core;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c", ["a", "b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = req('a'),
      core = req('b'),
      PROTOTYPE = 'prototype';
  var ctx = function(fn, that) {
    return function() {
      return fn.apply(that, arguments);
    };
  };
  var $def = function(type, name, source) {
    var key,
        own,
        out,
        exp,
        isGlobal = type & $def.G,
        isProto = type & $def.P,
        target = isGlobal ? global : type & $def.S ? global[name] : (global[name] || {})[PROTOTYPE],
        exports = isGlobal ? core : core[name] || (core[name] = {});
    if (isGlobal)
      source = name;
    for (key in source) {
      own = !(type & $def.F) && target && key in target;
      if (own && key in exports)
        continue;
      out = own ? target[key] : source[key];
      if (isGlobal && typeof target[key] != 'function')
        exp = source[key];
      else if (type & $def.B && own)
        exp = ctx(out, global);
      else if (type & $def.W && target[key] == out)
        !function(C) {
          exp = function(param) {
            return this instanceof C ? new C(param) : C(param);
          };
          exp[PROTOTYPE] = C[PROTOTYPE];
        }(out);
      else
        exp = isProto && typeof out == 'function' ? ctx(Function.call, out) : out;
      exports[key] = exp;
      if (isProto)
        (exports[PROTOTYPE] || (exports[PROTOTYPE] = {}))[key] = out;
    }
  };
  $def.F = 1;
  $def.G = 2;
  $def.S = 4;
  $def.P = 8;
  $def.B = 16;
  $def.W = 32;
  module.exports = $def;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $Object = Object;
  module.exports = {
    create: $Object.create,
    getProto: $Object.getPrototypeOf,
    isEnum: {}.propertyIsEnumerable,
    getDesc: $Object.getOwnPropertyDescriptor,
    setDesc: $Object.defineProperty,
    setDescs: $Object.defineProperties,
    getKeys: $Object.keys,
    getNames: $Object.getOwnPropertyNames,
    getSymbols: $Object.getOwnPropertySymbols,
    each: [].forEach
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(bitmap, value) {
    return {
      enumerable: !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable: !(bitmap & 4),
      value: value
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(exec) {
    try {
      return !!exec();
    } catch (e) {
      return true;
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("10", ["f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = !req('f')(function() {
    return Object.defineProperty({}, 'a', {get: function() {
        return 7;
      }}).a != 7;
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("11", ["d", "e", "10"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('d'),
      createDesc = req('e');
  module.exports = req('10') ? function(object, key, value) {
    return $.setDesc(object, key, createDesc(1, value));
  } : function(object, key, value) {
    object[key] = value;
    return object;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12", ["11"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('11');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("13", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var hasOwnProperty = {}.hasOwnProperty;
  module.exports = function(it, key) {
    return hasOwnProperty.call(it, key);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14", ["a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = req('a'),
      SHARED = '__core-js_shared__',
      store = global[SHARED] || (global[SHARED] = {});
  module.exports = function(key) {
    return store[key] || (store[key] = {});
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("15", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var id = 0,
      px = Math.random();
  module.exports = function(key) {
    return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("16", ["14", "a", "15"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var store = req('14')('wks'),
      Symbol = req('a').Symbol;
  module.exports = function(name) {
    return store[name] || (store[name] = Symbol && Symbol[name] || (Symbol || req('15'))('Symbol.' + name));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("17", ["d", "13", "16"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var def = req('d').setDesc,
      has = req('13'),
      TAG = req('16')('toStringTag');
  module.exports = function(it, tag, stat) {
    if (it && !has(it = stat ? it : it.prototype, TAG))
      def(it, TAG, {
        configurable: true,
        value: tag
      });
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("18", ["d", "11", "16", "e", "17"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var $ = req('d'),
      IteratorPrototype = {};
  req('11')(IteratorPrototype, req('16')('iterator'), function() {
    return this;
  });
  module.exports = function(Constructor, NAME, next) {
    Constructor.prototype = $.create(IteratorPrototype, {next: req('e')(1, next)});
    req('17')(Constructor, NAME + ' Iterator');
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("19", ["9", "c", "12", "11", "13", "16", "4", "18", "d", "17"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var LIBRARY = req('9'),
      $def = req('c'),
      $redef = req('12'),
      hide = req('11'),
      has = req('13'),
      SYMBOL_ITERATOR = req('16')('iterator'),
      Iterators = req('4'),
      BUGGY = !([].keys && 'next' in [].keys()),
      FF_ITERATOR = '@@iterator',
      KEYS = 'keys',
      VALUES = 'values';
  var returnThis = function() {
    return this;
  };
  module.exports = function(Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCE) {
    req('18')(Constructor, NAME, next);
    var createMethod = function(kind) {
      switch (kind) {
        case KEYS:
          return function keys() {
            return new Constructor(this, kind);
          };
        case VALUES:
          return function values() {
            return new Constructor(this, kind);
          };
      }
      return function entries() {
        return new Constructor(this, kind);
      };
    };
    var TAG = NAME + ' Iterator',
        proto = Base.prototype,
        _native = proto[SYMBOL_ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT],
        _default = _native || createMethod(DEFAULT),
        methods,
        key;
    if (_native) {
      var IteratorPrototype = req('d').getProto(_default.call(new Base));
      req('17')(IteratorPrototype, TAG, true);
      if (!LIBRARY && has(proto, FF_ITERATOR))
        hide(IteratorPrototype, SYMBOL_ITERATOR, returnThis);
    }
    if (!LIBRARY || FORCE)
      hide(proto, SYMBOL_ITERATOR, _default);
    Iterators[NAME] = _default;
    Iterators[TAG] = returnThis;
    if (DEFAULT) {
      methods = {
        keys: IS_SET ? _default : createMethod(KEYS),
        values: DEFAULT == VALUES ? _default : createMethod(VALUES),
        entries: DEFAULT != VALUES ? _default : createMethod('entries')
      };
      if (FORCE)
        for (key in methods) {
          if (!(key in proto))
            $redef(proto, key, methods[key]);
        }
      else
        $def($def.P + $def.F * BUGGY, NAME, methods);
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1a", ["2", "3", "4", "8", "19"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var setUnscope = req('2'),
      step = req('3'),
      Iterators = req('4'),
      toIObject = req('8');
  req('19')(Array, 'Array', function(iterated, kind) {
    this._t = toIObject(iterated);
    this._i = 0;
    this._k = kind;
  }, function() {
    var O = this._t,
        kind = this._k,
        index = this._i++;
    if (!O || index >= O.length) {
      this._t = undefined;
      return step(1);
    }
    if (kind == 'keys')
      return step(0, index);
    if (kind == 'values')
      return step(0, O[index]);
    return step(0, [index, O[index]]);
  }, 'values');
  Iterators.Arguments = Iterators.Array;
  setUnscope('keys');
  setUnscope('values');
  setUnscope('entries');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1b", ["1a", "4"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('1a');
  var Iterators = req('4');
  Iterators.NodeList = Iterators.HTMLCollection = Iterators.Array;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1c", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ceil = Math.ceil,
      floor = Math.floor;
  module.exports = function(it) {
    return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1d", ["1c", "7"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toInteger = req('1c'),
      defined = req('7');
  module.exports = function(TO_STRING) {
    return function(that, pos) {
      var s = String(defined(that)),
          i = toInteger(pos),
          l = s.length,
          a,
          b;
      if (i < 0 || i >= l)
        return TO_STRING ? '' : undefined;
      a = s.charCodeAt(i);
      return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff ? TO_STRING ? s.charAt(i) : a : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1e", ["1d", "19"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var $at = req('1d')(true);
  req('19')(String, 'String', function(iterated) {
    this._t = String(iterated);
    this._i = 0;
  }, function() {
    var O = this._t,
        index = this._i,
        point;
    if (index >= O.length)
      return {
        value: undefined,
        done: true
      };
    point = $at(O, index);
    this._i += point.length;
    return {
      value: point,
      done: false
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1f", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    return typeof it === 'object' ? it !== null : typeof it === 'function';
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("20", ["1f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = req('1f');
  module.exports = function(it) {
    if (!isObject(it))
      throw TypeError(it + ' is not an object!');
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("21", ["5", "16"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = req('5'),
      TAG = req('16')('toStringTag'),
      ARG = cof(function() {
        return arguments;
      }()) == 'Arguments';
  module.exports = function(it) {
    var O,
        T,
        B;
    return it === undefined ? 'Undefined' : it === null ? 'Null' : typeof(T = (O = Object(it))[TAG]) == 'string' ? T : ARG ? cof(O) : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("22", ["21", "16", "4", "b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var classof = req('21'),
      ITERATOR = req('16')('iterator'),
      Iterators = req('4');
  module.exports = req('b').getIteratorMethod = function(it) {
    if (it != undefined)
      return it[ITERATOR] || it['@@iterator'] || Iterators[classof(it)];
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("23", ["20", "22", "b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = req('20'),
      get = req('22');
  module.exports = req('b').getIterator = function(it) {
    var iterFn = get(it);
    if (typeof iterFn != 'function')
      throw TypeError(it + ' is not iterable!');
    return anObject(iterFn.call(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("24", ["1b", "1e", "23"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('1b');
  req('1e');
  module.exports = req('23');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("25", ["24"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('24'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("26", ["21", "16", "4", "b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var classof = req('21'),
      ITERATOR = req('16')('iterator'),
      Iterators = req('4');
  module.exports = req('b').isIterable = function(it) {
    var O = Object(it);
    return ITERATOR in O || '@@iterator' in O || Iterators.hasOwnProperty(classof(O));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("27", ["1b", "1e", "26"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('1b');
  req('1e');
  module.exports = req('26');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("28", ["27"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('27'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("29", ["25", "28"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _getIterator = req('25')["default"];
  var _isIterable = req('28')["default"];
  exports["default"] = (function() {
    function sliceIterator(arr, i) {
      var _arr = [];
      var _n = true;
      var _d = false;
      var _e = undefined;
      try {
        for (var _i = _getIterator(arr),
            _s; !(_n = (_s = _i.next()).done); _n = true) {
          _arr.push(_s.value);
          if (i && _arr.length === i)
            break;
        }
      } catch (err) {
        _d = true;
        _e = err;
      } finally {
        try {
          if (!_n && _i["return"])
            _i["return"]();
        } finally {
          if (_d)
            throw _e;
        }
      }
      return _arr;
    }
    return function(arr, i) {
      if (Array.isArray(arr)) {
        return arr;
      } else if (_isIterable(Object(arr))) {
        return sliceIterator(arr, i);
      } else {
        throw new TypeError("Invalid attempt to destructure non-iterable instance");
      }
    };
  })();
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2a", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactCurrentOwner = {current: null};
  module.exports = ReactCurrentOwner;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
  var ExecutionEnvironment = {
    canUseDOM: canUseDOM,
    canUseWorkers: typeof Worker !== 'undefined',
    canUseEventListeners: canUseDOM && !!(window.addEventListener || window.attachEvent),
    canUseViewport: canUseDOM && !!window.screen,
    isInWorker: !canUseDOM
  };
  module.exports = ExecutionEnvironment;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2c", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var process = module.exports = {};
  var queue = [];
  var draining = false;
  var currentQueue;
  var queueIndex = -1;
  function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
      queue = currentQueue.concat(queue);
    } else {
      queueIndex = -1;
    }
    if (queue.length) {
      drainQueue();
    }
  }
  function drainQueue() {
    if (draining) {
      return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;
    var len = queue.length;
    while (len) {
      currentQueue = queue;
      queue = [];
      while (++queueIndex < len) {
        if (currentQueue) {
          currentQueue[queueIndex].run();
        }
      }
      queueIndex = -1;
      len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
  }
  process.nextTick = function(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
      setTimeout(drainQueue, 0);
    }
  };
  function Item(fun, array) {
    this.fun = fun;
    this.array = array;
  }
  Item.prototype.run = function() {
    this.fun.apply(null, this.array);
  };
  process.title = 'browser';
  process.browser = true;
  process.env = {};
  process.argv = [];
  process.version = '';
  process.versions = {};
  function noop() {}
  process.on = noop;
  process.addListener = noop;
  process.once = noop;
  process.off = noop;
  process.removeListener = noop;
  process.removeAllListeners = noop;
  process.emit = noop;
  process.binding = function(name) {
    throw new Error('process.binding is not supported');
  };
  process.cwd = function() {
    return '/';
  };
  process.chdir = function(dir) {
    throw new Error('process.chdir is not supported');
  };
  process.umask = function() {
    return 0;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2d", ["2c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('2c');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2e", ["2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = $__System._nodeRequire ? process : req('2d');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2f", ["2e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('2e');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("30", ["2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = function(condition, format, a, b, c, d, e, f) {
      if (process.env.NODE_ENV !== 'production') {
        if (format === undefined) {
          throw new Error('invariant requires an error message argument');
        }
      }
      if (!condition) {
        var error;
        if (format === undefined) {
          error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
        } else {
          var args = [a, b, c, d, e, f];
          var argIndex = 0;
          error = new Error('Invariant Violation: ' + format.replace(/%s/g, function() {
            return args[argIndex++];
          }));
        }
        error.framesToPop = 1;
        throw error;
      }
    };
    module.exports = invariant;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("31", ["30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = req('30');
    function toArray(obj) {
      var length = obj.length;
      !(!Array.isArray(obj) && (typeof obj === 'object' || typeof obj === 'function')) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'toArray: Array-like object expected') : invariant(false) : undefined;
      !(typeof length === 'number') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'toArray: Object needs a length property') : invariant(false) : undefined;
      !(length === 0 || length - 1 in obj) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'toArray: Object should have keys for indices') : invariant(false) : undefined;
      if (obj.hasOwnProperty) {
        try {
          return Array.prototype.slice.call(obj);
        } catch (e) {}
      }
      var ret = Array(length);
      for (var ii = 0; ii < length; ii++) {
        ret[ii] = obj[ii];
      }
      return ret;
    }
    module.exports = toArray;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("32", ["31"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var toArray = req('31');
  function hasArrayNature(obj) {
    return (!!obj && (typeof obj == 'object' || typeof obj == 'function') && 'length' in obj && !('setInterval' in obj) && typeof obj.nodeType != 'number' && (Array.isArray(obj) || 'callee' in obj || 'item' in obj));
  }
  function createArrayFromMixed(obj) {
    if (!hasArrayNature(obj)) {
      return [obj];
    } else if (Array.isArray(obj)) {
      return obj.slice();
    } else {
      return toArray(obj);
    }
  }
  module.exports = createArrayFromMixed;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("33", ["2b", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ExecutionEnvironment = req('2b');
    var invariant = req('30');
    var dummyNode = ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;
    var shouldWrap = {};
    var selectWrap = [1, '<select multiple="true">', '</select>'];
    var tableWrap = [1, '<table>', '</table>'];
    var trWrap = [3, '<table><tbody><tr>', '</tr></tbody></table>'];
    var svgWrap = [1, '<svg xmlns="http://www.w3.org/2000/svg">', '</svg>'];
    var markupWrap = {
      '*': [1, '?<div>', '</div>'],
      'area': [1, '<map>', '</map>'],
      'col': [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
      'legend': [1, '<fieldset>', '</fieldset>'],
      'param': [1, '<object>', '</object>'],
      'tr': [2, '<table><tbody>', '</tbody></table>'],
      'optgroup': selectWrap,
      'option': selectWrap,
      'caption': tableWrap,
      'colgroup': tableWrap,
      'tbody': tableWrap,
      'tfoot': tableWrap,
      'thead': tableWrap,
      'td': trWrap,
      'th': trWrap
    };
    var svgElements = ['circle', 'clipPath', 'defs', 'ellipse', 'g', 'image', 'line', 'linearGradient', 'mask', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect', 'stop', 'text', 'tspan'];
    svgElements.forEach(function(nodeName) {
      markupWrap[nodeName] = svgWrap;
      shouldWrap[nodeName] = true;
    });
    function getMarkupWrap(nodeName) {
      !!!dummyNode ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Markup wrapping node not initialized') : invariant(false) : undefined;
      if (!markupWrap.hasOwnProperty(nodeName)) {
        nodeName = '*';
      }
      if (!shouldWrap.hasOwnProperty(nodeName)) {
        if (nodeName === '*') {
          dummyNode.innerHTML = '<link />';
        } else {
          dummyNode.innerHTML = '<' + nodeName + '></' + nodeName + '>';
        }
        shouldWrap[nodeName] = !dummyNode.firstChild;
      }
      return shouldWrap[nodeName] ? markupWrap[nodeName] : null;
    }
    module.exports = getMarkupWrap;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("34", ["2b", "32", "33", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ExecutionEnvironment = req('2b');
    var createArrayFromMixed = req('32');
    var getMarkupWrap = req('33');
    var invariant = req('30');
    var dummyNode = ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;
    var nodeNamePattern = /^\s*<(\w+)/;
    function getNodeName(markup) {
      var nodeNameMatch = markup.match(nodeNamePattern);
      return nodeNameMatch && nodeNameMatch[1].toLowerCase();
    }
    function createNodesFromMarkup(markup, handleScript) {
      var node = dummyNode;
      !!!dummyNode ? process.env.NODE_ENV !== 'production' ? invariant(false, 'createNodesFromMarkup dummy not initialized') : invariant(false) : undefined;
      var nodeName = getNodeName(markup);
      var wrap = nodeName && getMarkupWrap(nodeName);
      if (wrap) {
        node.innerHTML = wrap[1] + markup + wrap[2];
        var wrapDepth = wrap[0];
        while (wrapDepth--) {
          node = node.lastChild;
        }
      } else {
        node.innerHTML = markup;
      }
      var scripts = node.getElementsByTagName('script');
      if (scripts.length) {
        !handleScript ? process.env.NODE_ENV !== 'production' ? invariant(false, 'createNodesFromMarkup(...): Unexpected <script> element rendered.') : invariant(false) : undefined;
        createArrayFromMixed(scripts).forEach(handleScript);
      }
      var nodes = createArrayFromMixed(node.childNodes);
      while (node.lastChild) {
        node.removeChild(node.lastChild);
      }
      return nodes;
    }
    module.exports = createNodesFromMarkup;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("35", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  function makeEmptyFunction(arg) {
    return function() {
      return arg;
    };
  }
  function emptyFunction() {}
  emptyFunction.thatReturns = makeEmptyFunction;
  emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
  emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
  emptyFunction.thatReturnsNull = makeEmptyFunction(null);
  emptyFunction.thatReturnsThis = function() {
    return this;
  };
  emptyFunction.thatReturnsArgument = function(arg) {
    return arg;
  };
  module.exports = emptyFunction;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("36", ["2b", "34", "35", "33", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ExecutionEnvironment = req('2b');
    var createNodesFromMarkup = req('34');
    var emptyFunction = req('35');
    var getMarkupWrap = req('33');
    var invariant = req('30');
    var OPEN_TAG_NAME_EXP = /^(<[^ \/>]+)/;
    var RESULT_INDEX_ATTR = 'data-danger-index';
    function getNodeName(markup) {
      return markup.substring(1, markup.indexOf(' '));
    }
    var Danger = {
      dangerouslyRenderMarkup: function(markupList) {
        !ExecutionEnvironment.canUseDOM ? process.env.NODE_ENV !== 'production' ? invariant(false, 'dangerouslyRenderMarkup(...): Cannot render markup in a worker ' + 'thread. Make sure `window` and `document` are available globally ' + 'before requiring React when unit testing or use ' + 'ReactDOMServer.renderToString for server rendering.') : invariant(false) : undefined;
        var nodeName;
        var markupByNodeName = {};
        for (var i = 0; i < markupList.length; i++) {
          !markupList[i] ? process.env.NODE_ENV !== 'production' ? invariant(false, 'dangerouslyRenderMarkup(...): Missing markup.') : invariant(false) : undefined;
          nodeName = getNodeName(markupList[i]);
          nodeName = getMarkupWrap(nodeName) ? nodeName : '*';
          markupByNodeName[nodeName] = markupByNodeName[nodeName] || [];
          markupByNodeName[nodeName][i] = markupList[i];
        }
        var resultList = [];
        var resultListAssignmentCount = 0;
        for (nodeName in markupByNodeName) {
          if (!markupByNodeName.hasOwnProperty(nodeName)) {
            continue;
          }
          var markupListByNodeName = markupByNodeName[nodeName];
          var resultIndex;
          for (resultIndex in markupListByNodeName) {
            if (markupListByNodeName.hasOwnProperty(resultIndex)) {
              var markup = markupListByNodeName[resultIndex];
              markupListByNodeName[resultIndex] = markup.replace(OPEN_TAG_NAME_EXP, '$1 ' + RESULT_INDEX_ATTR + '="' + resultIndex + '" ');
            }
          }
          var renderNodes = createNodesFromMarkup(markupListByNodeName.join(''), emptyFunction);
          for (var j = 0; j < renderNodes.length; ++j) {
            var renderNode = renderNodes[j];
            if (renderNode.hasAttribute && renderNode.hasAttribute(RESULT_INDEX_ATTR)) {
              resultIndex = +renderNode.getAttribute(RESULT_INDEX_ATTR);
              renderNode.removeAttribute(RESULT_INDEX_ATTR);
              !!resultList.hasOwnProperty(resultIndex) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Danger: Assigning to an already-occupied result index.') : invariant(false) : undefined;
              resultList[resultIndex] = renderNode;
              resultListAssignmentCount += 1;
            } else if (process.env.NODE_ENV !== 'production') {
              console.error('Danger: Discarding unexpected node:', renderNode);
            }
          }
        }
        !(resultListAssignmentCount === resultList.length) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Danger: Did not assign to every index of resultList.') : invariant(false) : undefined;
        !(resultList.length === markupList.length) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Danger: Expected markup to render %s nodes, but rendered %s.', markupList.length, resultList.length) : invariant(false) : undefined;
        return resultList;
      },
      dangerouslyReplaceNodeWithMarkup: function(oldChild, markup) {
        !ExecutionEnvironment.canUseDOM ? process.env.NODE_ENV !== 'production' ? invariant(false, 'dangerouslyReplaceNodeWithMarkup(...): Cannot render markup in a ' + 'worker thread. Make sure `window` and `document` are available ' + 'globally before requiring React when unit testing or use ' + 'ReactDOMServer.renderToString() for server rendering.') : invariant(false) : undefined;
        !markup ? process.env.NODE_ENV !== 'production' ? invariant(false, 'dangerouslyReplaceNodeWithMarkup(...): Missing markup.') : invariant(false) : undefined;
        !(oldChild.tagName.toLowerCase() !== 'html') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'dangerouslyReplaceNodeWithMarkup(...): Cannot replace markup of the ' + '<html> node. This is because browser quirks make this unreliable ' + 'and/or slow. If you want to render to the root you must use ' + 'server rendering. See ReactDOMServer.renderToString().') : invariant(false) : undefined;
        var newChild;
        if (typeof markup === 'string') {
          newChild = createNodesFromMarkup(markup, emptyFunction)[0];
        } else {
          newChild = markup;
        }
        oldChild.parentNode.replaceChild(newChild, oldChild);
      }
    };
    module.exports = Danger;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("37", ["30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = req('30');
    var keyMirror = function(obj) {
      var ret = {};
      var key;
      !(obj instanceof Object && !Array.isArray(obj)) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'keyMirror(...): Argument must be an object.') : invariant(false) : undefined;
      for (key in obj) {
        if (!obj.hasOwnProperty(key)) {
          continue;
        }
        ret[key] = key;
      }
      return ret;
    };
    module.exports = keyMirror;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("38", ["37"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var keyMirror = req('37');
  var ReactMultiChildUpdateTypes = keyMirror({
    INSERT_MARKUP: null,
    MOVE_EXISTING: null,
    REMOVE_NODE: null,
    SET_MARKUP: null,
    TEXT_CONTENT: null
  });
  module.exports = ReactMultiChildUpdateTypes;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("39", ["2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactPerf = {
      enableMeasure: false,
      storedMeasure: _noMeasure,
      measureMethods: function(object, objectName, methodNames) {
        if (process.env.NODE_ENV !== 'production') {
          for (var key in methodNames) {
            if (!methodNames.hasOwnProperty(key)) {
              continue;
            }
            object[key] = ReactPerf.measure(objectName, methodNames[key], object[key]);
          }
        }
      },
      measure: function(objName, fnName, func) {
        if (process.env.NODE_ENV !== 'production') {
          var measuredFunc = null;
          var wrapper = function() {
            if (ReactPerf.enableMeasure) {
              if (!measuredFunc) {
                measuredFunc = ReactPerf.storedMeasure(objName, fnName, func);
              }
              return measuredFunc.apply(this, arguments);
            }
            return func.apply(this, arguments);
          };
          wrapper.displayName = objName + '_' + fnName;
          return wrapper;
        }
        return func;
      },
      injection: {injectMeasure: function(measure) {
          ReactPerf.storedMeasure = measure;
        }}
    };
    function _noMeasure(objName, fnName, func) {
      return func;
    }
    module.exports = ReactPerf;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3a", ["2b", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ExecutionEnvironment = req('2b');
    var WHITESPACE_TEST = /^[ \r\n\t\f]/;
    var NONVISIBLE_TEST = /<(!--|link|noscript|meta|script|style)[ \r\n\t\f\/>]/;
    var setInnerHTML = function(node, html) {
      node.innerHTML = html;
    };
    if (typeof MSApp !== 'undefined' && MSApp.execUnsafeLocalFunction) {
      setInnerHTML = function(node, html) {
        MSApp.execUnsafeLocalFunction(function() {
          node.innerHTML = html;
        });
      };
    }
    if (ExecutionEnvironment.canUseDOM) {
      var testElement = document.createElement('div');
      testElement.innerHTML = ' ';
      if (testElement.innerHTML === '') {
        setInnerHTML = function(node, html) {
          if (node.parentNode) {
            node.parentNode.replaceChild(node, node);
          }
          if (WHITESPACE_TEST.test(html) || html[0] === '<' && NONVISIBLE_TEST.test(html)) {
            node.innerHTML = String.fromCharCode(0xFEFF) + html;
            var textNode = node.firstChild;
            if (textNode.data.length === 1) {
              node.removeChild(textNode);
            } else {
              textNode.deleteData(0, 1);
            }
          } else {
            node.innerHTML = html;
          }
        };
      }
    }
    module.exports = setInnerHTML;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ESCAPE_LOOKUP = {
    '&': '&amp;',
    '>': '&gt;',
    '<': '&lt;',
    '"': '&quot;',
    '\'': '&#x27;'
  };
  var ESCAPE_REGEX = /[&><"']/g;
  function escaper(match) {
    return ESCAPE_LOOKUP[match];
  }
  function escapeTextContentForBrowser(text) {
    return ('' + text).replace(ESCAPE_REGEX, escaper);
  }
  module.exports = escapeTextContentForBrowser;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3c", ["2b", "3b", "3a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ExecutionEnvironment = req('2b');
  var escapeTextContentForBrowser = req('3b');
  var setInnerHTML = req('3a');
  var setTextContent = function(node, text) {
    node.textContent = text;
  };
  if (ExecutionEnvironment.canUseDOM) {
    if (!('textContent' in document.documentElement)) {
      setTextContent = function(node, text) {
        setInnerHTML(node, escapeTextContentForBrowser(text));
      };
    }
  }
  module.exports = setTextContent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3d", ["36", "38", "39", "3a", "3c", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var Danger = req('36');
    var ReactMultiChildUpdateTypes = req('38');
    var ReactPerf = req('39');
    var setInnerHTML = req('3a');
    var setTextContent = req('3c');
    var invariant = req('30');
    function insertChildAt(parentNode, childNode, index) {
      var beforeChild = index >= parentNode.childNodes.length ? null : parentNode.childNodes.item(index);
      parentNode.insertBefore(childNode, beforeChild);
    }
    var DOMChildrenOperations = {
      dangerouslyReplaceNodeWithMarkup: Danger.dangerouslyReplaceNodeWithMarkup,
      updateTextContent: setTextContent,
      processUpdates: function(updates, markupList) {
        var update;
        var initialChildren = null;
        var updatedChildren = null;
        for (var i = 0; i < updates.length; i++) {
          update = updates[i];
          if (update.type === ReactMultiChildUpdateTypes.MOVE_EXISTING || update.type === ReactMultiChildUpdateTypes.REMOVE_NODE) {
            var updatedIndex = update.fromIndex;
            var updatedChild = update.parentNode.childNodes[updatedIndex];
            var parentID = update.parentID;
            !updatedChild ? process.env.NODE_ENV !== 'production' ? invariant(false, 'processUpdates(): Unable to find child %s of element. This ' + 'probably means the DOM was unexpectedly mutated (e.g., by the ' + 'browser), usually due to forgetting a <tbody> when using tables, ' + 'nesting tags like <form>, <p>, or <a>, or using non-SVG elements ' + 'in an <svg> parent. Try inspecting the child nodes of the element ' + 'with React ID `%s`.', updatedIndex, parentID) : invariant(false) : undefined;
            initialChildren = initialChildren || {};
            initialChildren[parentID] = initialChildren[parentID] || [];
            initialChildren[parentID][updatedIndex] = updatedChild;
            updatedChildren = updatedChildren || [];
            updatedChildren.push(updatedChild);
          }
        }
        var renderedMarkup;
        if (markupList.length && typeof markupList[0] === 'string') {
          renderedMarkup = Danger.dangerouslyRenderMarkup(markupList);
        } else {
          renderedMarkup = markupList;
        }
        if (updatedChildren) {
          for (var j = 0; j < updatedChildren.length; j++) {
            updatedChildren[j].parentNode.removeChild(updatedChildren[j]);
          }
        }
        for (var k = 0; k < updates.length; k++) {
          update = updates[k];
          switch (update.type) {
            case ReactMultiChildUpdateTypes.INSERT_MARKUP:
              insertChildAt(update.parentNode, renderedMarkup[update.markupIndex], update.toIndex);
              break;
            case ReactMultiChildUpdateTypes.MOVE_EXISTING:
              insertChildAt(update.parentNode, initialChildren[update.parentID][update.fromIndex], update.toIndex);
              break;
            case ReactMultiChildUpdateTypes.SET_MARKUP:
              setInnerHTML(update.parentNode, update.content);
              break;
            case ReactMultiChildUpdateTypes.TEXT_CONTENT:
              setTextContent(update.parentNode, update.content);
              break;
            case ReactMultiChildUpdateTypes.REMOVE_NODE:
              break;
          }
        }
      }
    };
    ReactPerf.measureMethods(DOMChildrenOperations, 'DOMChildrenOperations', {updateTextContent: 'updateTextContent'});
    module.exports = DOMChildrenOperations;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3e", ["30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = req('30');
    function checkMask(value, bitmask) {
      return (value & bitmask) === bitmask;
    }
    var DOMPropertyInjection = {
      MUST_USE_ATTRIBUTE: 0x1,
      MUST_USE_PROPERTY: 0x2,
      HAS_SIDE_EFFECTS: 0x4,
      HAS_BOOLEAN_VALUE: 0x8,
      HAS_NUMERIC_VALUE: 0x10,
      HAS_POSITIVE_NUMERIC_VALUE: 0x20 | 0x10,
      HAS_OVERLOADED_BOOLEAN_VALUE: 0x40,
      injectDOMPropertyConfig: function(domPropertyConfig) {
        var Injection = DOMPropertyInjection;
        var Properties = domPropertyConfig.Properties || {};
        var DOMAttributeNamespaces = domPropertyConfig.DOMAttributeNamespaces || {};
        var DOMAttributeNames = domPropertyConfig.DOMAttributeNames || {};
        var DOMPropertyNames = domPropertyConfig.DOMPropertyNames || {};
        var DOMMutationMethods = domPropertyConfig.DOMMutationMethods || {};
        if (domPropertyConfig.isCustomAttribute) {
          DOMProperty._isCustomAttributeFunctions.push(domPropertyConfig.isCustomAttribute);
        }
        for (var propName in Properties) {
          !!DOMProperty.properties.hasOwnProperty(propName) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'injectDOMPropertyConfig(...): You\'re trying to inject DOM property ' + '\'%s\' which has already been injected. You may be accidentally ' + 'injecting the same DOM property config twice, or you may be ' + 'injecting two configs that have conflicting property names.', propName) : invariant(false) : undefined;
          var lowerCased = propName.toLowerCase();
          var propConfig = Properties[propName];
          var propertyInfo = {
            attributeName: lowerCased,
            attributeNamespace: null,
            propertyName: propName,
            mutationMethod: null,
            mustUseAttribute: checkMask(propConfig, Injection.MUST_USE_ATTRIBUTE),
            mustUseProperty: checkMask(propConfig, Injection.MUST_USE_PROPERTY),
            hasSideEffects: checkMask(propConfig, Injection.HAS_SIDE_EFFECTS),
            hasBooleanValue: checkMask(propConfig, Injection.HAS_BOOLEAN_VALUE),
            hasNumericValue: checkMask(propConfig, Injection.HAS_NUMERIC_VALUE),
            hasPositiveNumericValue: checkMask(propConfig, Injection.HAS_POSITIVE_NUMERIC_VALUE),
            hasOverloadedBooleanValue: checkMask(propConfig, Injection.HAS_OVERLOADED_BOOLEAN_VALUE)
          };
          !(!propertyInfo.mustUseAttribute || !propertyInfo.mustUseProperty) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'DOMProperty: Cannot require using both attribute and property: %s', propName) : invariant(false) : undefined;
          !(propertyInfo.mustUseProperty || !propertyInfo.hasSideEffects) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'DOMProperty: Properties that have side effects must use property: %s', propName) : invariant(false) : undefined;
          !(propertyInfo.hasBooleanValue + propertyInfo.hasNumericValue + propertyInfo.hasOverloadedBooleanValue <= 1) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'DOMProperty: Value can be one of boolean, overloaded boolean, or ' + 'numeric value, but not a combination: %s', propName) : invariant(false) : undefined;
          if (process.env.NODE_ENV !== 'production') {
            DOMProperty.getPossibleStandardName[lowerCased] = propName;
          }
          if (DOMAttributeNames.hasOwnProperty(propName)) {
            var attributeName = DOMAttributeNames[propName];
            propertyInfo.attributeName = attributeName;
            if (process.env.NODE_ENV !== 'production') {
              DOMProperty.getPossibleStandardName[attributeName] = propName;
            }
          }
          if (DOMAttributeNamespaces.hasOwnProperty(propName)) {
            propertyInfo.attributeNamespace = DOMAttributeNamespaces[propName];
          }
          if (DOMPropertyNames.hasOwnProperty(propName)) {
            propertyInfo.propertyName = DOMPropertyNames[propName];
          }
          if (DOMMutationMethods.hasOwnProperty(propName)) {
            propertyInfo.mutationMethod = DOMMutationMethods[propName];
          }
          DOMProperty.properties[propName] = propertyInfo;
        }
      }
    };
    var defaultValueCache = {};
    var DOMProperty = {
      ID_ATTRIBUTE_NAME: 'data-reactid',
      properties: {},
      getPossibleStandardName: process.env.NODE_ENV !== 'production' ? {} : null,
      _isCustomAttributeFunctions: [],
      isCustomAttribute: function(attributeName) {
        for (var i = 0; i < DOMProperty._isCustomAttributeFunctions.length; i++) {
          var isCustomAttributeFn = DOMProperty._isCustomAttributeFunctions[i];
          if (isCustomAttributeFn(attributeName)) {
            return true;
          }
        }
        return false;
      },
      getDefaultValueForProperty: function(nodeName, prop) {
        var nodeDefaults = defaultValueCache[nodeName];
        var testElement;
        if (!nodeDefaults) {
          defaultValueCache[nodeName] = nodeDefaults = {};
        }
        if (!(prop in nodeDefaults)) {
          testElement = document.createElement(nodeName);
          nodeDefaults[prop] = testElement[prop];
        }
        return nodeDefaults[prop];
      },
      injection: DOMPropertyInjection
    };
    module.exports = DOMProperty;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3f", ["3b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var escapeTextContentForBrowser = req('3b');
  function quoteAttributeValueForBrowser(value) {
    return '"' + escapeTextContentForBrowser(value) + '"';
  }
  module.exports = quoteAttributeValueForBrowser;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("40", ["35", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var emptyFunction = req('35');
    var warning = emptyFunction;
    if (process.env.NODE_ENV !== 'production') {
      warning = function(condition, format) {
        for (var _len = arguments.length,
            args = Array(_len > 2 ? _len - 2 : 0),
            _key = 2; _key < _len; _key++) {
          args[_key - 2] = arguments[_key];
        }
        if (format === undefined) {
          throw new Error('`warning(condition, format, ...args)` requires a warning ' + 'message argument');
        }
        if (format.indexOf('Failed Composite propType: ') === 0) {
          return;
        }
        if (!condition) {
          var argIndex = 0;
          var message = 'Warning: ' + format.replace(/%s/g, function() {
            return args[argIndex++];
          });
          if (typeof console !== 'undefined') {
            console.error(message);
          }
          try {
            throw new Error(message);
          } catch (x) {}
        }
      };
    }
    module.exports = warning;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("41", ["3e", "39", "3f", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var DOMProperty = req('3e');
    var ReactPerf = req('39');
    var quoteAttributeValueForBrowser = req('3f');
    var warning = req('40');
    var VALID_ATTRIBUTE_NAME_REGEX = /^[a-zA-Z_][\w\.\-]*$/;
    var illegalAttributeNameCache = {};
    var validatedAttributeNameCache = {};
    function isAttributeNameSafe(attributeName) {
      if (validatedAttributeNameCache.hasOwnProperty(attributeName)) {
        return true;
      }
      if (illegalAttributeNameCache.hasOwnProperty(attributeName)) {
        return false;
      }
      if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName)) {
        validatedAttributeNameCache[attributeName] = true;
        return true;
      }
      illegalAttributeNameCache[attributeName] = true;
      process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid attribute name: `%s`', attributeName) : undefined;
      return false;
    }
    function shouldIgnoreValue(propertyInfo, value) {
      return value == null || propertyInfo.hasBooleanValue && !value || propertyInfo.hasNumericValue && isNaN(value) || propertyInfo.hasPositiveNumericValue && value < 1 || propertyInfo.hasOverloadedBooleanValue && value === false;
    }
    if (process.env.NODE_ENV !== 'production') {
      var reactProps = {
        children: true,
        dangerouslySetInnerHTML: true,
        key: true,
        ref: true
      };
      var warnedProperties = {};
      var warnUnknownProperty = function(name) {
        if (reactProps.hasOwnProperty(name) && reactProps[name] || warnedProperties.hasOwnProperty(name) && warnedProperties[name]) {
          return;
        }
        warnedProperties[name] = true;
        var lowerCasedName = name.toLowerCase();
        var standardName = DOMProperty.isCustomAttribute(lowerCasedName) ? lowerCasedName : DOMProperty.getPossibleStandardName.hasOwnProperty(lowerCasedName) ? DOMProperty.getPossibleStandardName[lowerCasedName] : null;
        process.env.NODE_ENV !== 'production' ? warning(standardName == null, 'Unknown DOM property %s. Did you mean %s?', name, standardName) : undefined;
      };
    }
    var DOMPropertyOperations = {
      createMarkupForID: function(id) {
        return DOMProperty.ID_ATTRIBUTE_NAME + '=' + quoteAttributeValueForBrowser(id);
      },
      setAttributeForID: function(node, id) {
        node.setAttribute(DOMProperty.ID_ATTRIBUTE_NAME, id);
      },
      createMarkupForProperty: function(name, value) {
        var propertyInfo = DOMProperty.properties.hasOwnProperty(name) ? DOMProperty.properties[name] : null;
        if (propertyInfo) {
          if (shouldIgnoreValue(propertyInfo, value)) {
            return '';
          }
          var attributeName = propertyInfo.attributeName;
          if (propertyInfo.hasBooleanValue || propertyInfo.hasOverloadedBooleanValue && value === true) {
            return attributeName + '=""';
          }
          return attributeName + '=' + quoteAttributeValueForBrowser(value);
        } else if (DOMProperty.isCustomAttribute(name)) {
          if (value == null) {
            return '';
          }
          return name + '=' + quoteAttributeValueForBrowser(value);
        } else if (process.env.NODE_ENV !== 'production') {
          warnUnknownProperty(name);
        }
        return null;
      },
      createMarkupForCustomAttribute: function(name, value) {
        if (!isAttributeNameSafe(name) || value == null) {
          return '';
        }
        return name + '=' + quoteAttributeValueForBrowser(value);
      },
      setValueForProperty: function(node, name, value) {
        var propertyInfo = DOMProperty.properties.hasOwnProperty(name) ? DOMProperty.properties[name] : null;
        if (propertyInfo) {
          var mutationMethod = propertyInfo.mutationMethod;
          if (mutationMethod) {
            mutationMethod(node, value);
          } else if (shouldIgnoreValue(propertyInfo, value)) {
            this.deleteValueForProperty(node, name);
          } else if (propertyInfo.mustUseAttribute) {
            var attributeName = propertyInfo.attributeName;
            var namespace = propertyInfo.attributeNamespace;
            if (namespace) {
              node.setAttributeNS(namespace, attributeName, '' + value);
            } else if (propertyInfo.hasBooleanValue || propertyInfo.hasOverloadedBooleanValue && value === true) {
              node.setAttribute(attributeName, '');
            } else {
              node.setAttribute(attributeName, '' + value);
            }
          } else {
            var propName = propertyInfo.propertyName;
            if (!propertyInfo.hasSideEffects || '' + node[propName] !== '' + value) {
              node[propName] = value;
            }
          }
        } else if (DOMProperty.isCustomAttribute(name)) {
          DOMPropertyOperations.setValueForAttribute(node, name, value);
        } else if (process.env.NODE_ENV !== 'production') {
          warnUnknownProperty(name);
        }
      },
      setValueForAttribute: function(node, name, value) {
        if (!isAttributeNameSafe(name)) {
          return;
        }
        if (value == null) {
          node.removeAttribute(name);
        } else {
          node.setAttribute(name, '' + value);
        }
      },
      deleteValueForProperty: function(node, name) {
        var propertyInfo = DOMProperty.properties.hasOwnProperty(name) ? DOMProperty.properties[name] : null;
        if (propertyInfo) {
          var mutationMethod = propertyInfo.mutationMethod;
          if (mutationMethod) {
            mutationMethod(node, undefined);
          } else if (propertyInfo.mustUseAttribute) {
            node.removeAttribute(propertyInfo.attributeName);
          } else {
            var propName = propertyInfo.propertyName;
            var defaultValue = DOMProperty.getDefaultValueForProperty(node.nodeName, propName);
            if (!propertyInfo.hasSideEffects || '' + node[propName] !== defaultValue) {
              node[propName] = defaultValue;
            }
          }
        } else if (DOMProperty.isCustomAttribute(name)) {
          node.removeAttribute(name);
        } else if (process.env.NODE_ENV !== 'production') {
          warnUnknownProperty(name);
        }
      }
    };
    ReactPerf.measureMethods(DOMPropertyOperations, 'DOMPropertyOperations', {
      setValueForProperty: 'setValueForProperty',
      setValueForAttribute: 'setValueForAttribute',
      deleteValueForProperty: 'deleteValueForProperty'
    });
    module.exports = DOMPropertyOperations;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("42", ["37"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var keyMirror = req('37');
  var PropagationPhases = keyMirror({
    bubbled: null,
    captured: null
  });
  var topLevelTypes = keyMirror({
    topAbort: null,
    topBlur: null,
    topCanPlay: null,
    topCanPlayThrough: null,
    topChange: null,
    topClick: null,
    topCompositionEnd: null,
    topCompositionStart: null,
    topCompositionUpdate: null,
    topContextMenu: null,
    topCopy: null,
    topCut: null,
    topDoubleClick: null,
    topDrag: null,
    topDragEnd: null,
    topDragEnter: null,
    topDragExit: null,
    topDragLeave: null,
    topDragOver: null,
    topDragStart: null,
    topDrop: null,
    topDurationChange: null,
    topEmptied: null,
    topEncrypted: null,
    topEnded: null,
    topError: null,
    topFocus: null,
    topInput: null,
    topKeyDown: null,
    topKeyPress: null,
    topKeyUp: null,
    topLoad: null,
    topLoadedData: null,
    topLoadedMetadata: null,
    topLoadStart: null,
    topMouseDown: null,
    topMouseMove: null,
    topMouseOut: null,
    topMouseOver: null,
    topMouseUp: null,
    topPaste: null,
    topPause: null,
    topPlay: null,
    topPlaying: null,
    topProgress: null,
    topRateChange: null,
    topReset: null,
    topScroll: null,
    topSeeked: null,
    topSeeking: null,
    topSelectionChange: null,
    topStalled: null,
    topSubmit: null,
    topSuspend: null,
    topTextInput: null,
    topTimeUpdate: null,
    topTouchCancel: null,
    topTouchEnd: null,
    topTouchMove: null,
    topTouchStart: null,
    topVolumeChange: null,
    topWaiting: null,
    topWheel: null
  });
  var EventConstants = {
    topLevelTypes: topLevelTypes,
    PropagationPhases: PropagationPhases
  };
  module.exports = EventConstants;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("43", ["30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = req('30');
    var EventPluginOrder = null;
    var namesToPlugins = {};
    function recomputePluginOrdering() {
      if (!EventPluginOrder) {
        return;
      }
      for (var pluginName in namesToPlugins) {
        var PluginModule = namesToPlugins[pluginName];
        var pluginIndex = EventPluginOrder.indexOf(pluginName);
        !(pluginIndex > -1) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'EventPluginRegistry: Cannot inject event plugins that do not exist in ' + 'the plugin ordering, `%s`.', pluginName) : invariant(false) : undefined;
        if (EventPluginRegistry.plugins[pluginIndex]) {
          continue;
        }
        !PluginModule.extractEvents ? process.env.NODE_ENV !== 'production' ? invariant(false, 'EventPluginRegistry: Event plugins must implement an `extractEvents` ' + 'method, but `%s` does not.', pluginName) : invariant(false) : undefined;
        EventPluginRegistry.plugins[pluginIndex] = PluginModule;
        var publishedEvents = PluginModule.eventTypes;
        for (var eventName in publishedEvents) {
          !publishEventForPlugin(publishedEvents[eventName], PluginModule, eventName) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'EventPluginRegistry: Failed to publish event `%s` for plugin `%s`.', eventName, pluginName) : invariant(false) : undefined;
        }
      }
    }
    function publishEventForPlugin(dispatchConfig, PluginModule, eventName) {
      !!EventPluginRegistry.eventNameDispatchConfigs.hasOwnProperty(eventName) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'EventPluginHub: More than one plugin attempted to publish the same ' + 'event name, `%s`.', eventName) : invariant(false) : undefined;
      EventPluginRegistry.eventNameDispatchConfigs[eventName] = dispatchConfig;
      var phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;
      if (phasedRegistrationNames) {
        for (var phaseName in phasedRegistrationNames) {
          if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
            var phasedRegistrationName = phasedRegistrationNames[phaseName];
            publishRegistrationName(phasedRegistrationName, PluginModule, eventName);
          }
        }
        return true;
      } else if (dispatchConfig.registrationName) {
        publishRegistrationName(dispatchConfig.registrationName, PluginModule, eventName);
        return true;
      }
      return false;
    }
    function publishRegistrationName(registrationName, PluginModule, eventName) {
      !!EventPluginRegistry.registrationNameModules[registrationName] ? process.env.NODE_ENV !== 'production' ? invariant(false, 'EventPluginHub: More than one plugin attempted to publish the same ' + 'registration name, `%s`.', registrationName) : invariant(false) : undefined;
      EventPluginRegistry.registrationNameModules[registrationName] = PluginModule;
      EventPluginRegistry.registrationNameDependencies[registrationName] = PluginModule.eventTypes[eventName].dependencies;
    }
    var EventPluginRegistry = {
      plugins: [],
      eventNameDispatchConfigs: {},
      registrationNameModules: {},
      registrationNameDependencies: {},
      injectEventPluginOrder: function(InjectedEventPluginOrder) {
        !!EventPluginOrder ? process.env.NODE_ENV !== 'production' ? invariant(false, 'EventPluginRegistry: Cannot inject event plugin ordering more than ' + 'once. You are likely trying to load more than one copy of React.') : invariant(false) : undefined;
        EventPluginOrder = Array.prototype.slice.call(InjectedEventPluginOrder);
        recomputePluginOrdering();
      },
      injectEventPluginsByName: function(injectedNamesToPlugins) {
        var isOrderingDirty = false;
        for (var pluginName in injectedNamesToPlugins) {
          if (!injectedNamesToPlugins.hasOwnProperty(pluginName)) {
            continue;
          }
          var PluginModule = injectedNamesToPlugins[pluginName];
          if (!namesToPlugins.hasOwnProperty(pluginName) || namesToPlugins[pluginName] !== PluginModule) {
            !!namesToPlugins[pluginName] ? process.env.NODE_ENV !== 'production' ? invariant(false, 'EventPluginRegistry: Cannot inject two different event plugins ' + 'using the same name, `%s`.', pluginName) : invariant(false) : undefined;
            namesToPlugins[pluginName] = PluginModule;
            isOrderingDirty = true;
          }
        }
        if (isOrderingDirty) {
          recomputePluginOrdering();
        }
      },
      getPluginModuleForEvent: function(event) {
        var dispatchConfig = event.dispatchConfig;
        if (dispatchConfig.registrationName) {
          return EventPluginRegistry.registrationNameModules[dispatchConfig.registrationName] || null;
        }
        for (var phase in dispatchConfig.phasedRegistrationNames) {
          if (!dispatchConfig.phasedRegistrationNames.hasOwnProperty(phase)) {
            continue;
          }
          var PluginModule = EventPluginRegistry.registrationNameModules[dispatchConfig.phasedRegistrationNames[phase]];
          if (PluginModule) {
            return PluginModule;
          }
        }
        return null;
      },
      _resetEventPlugins: function() {
        EventPluginOrder = null;
        for (var pluginName in namesToPlugins) {
          if (namesToPlugins.hasOwnProperty(pluginName)) {
            delete namesToPlugins[pluginName];
          }
        }
        EventPluginRegistry.plugins.length = 0;
        var eventNameDispatchConfigs = EventPluginRegistry.eventNameDispatchConfigs;
        for (var eventName in eventNameDispatchConfigs) {
          if (eventNameDispatchConfigs.hasOwnProperty(eventName)) {
            delete eventNameDispatchConfigs[eventName];
          }
        }
        var registrationNameModules = EventPluginRegistry.registrationNameModules;
        for (var registrationName in registrationNameModules) {
          if (registrationNameModules.hasOwnProperty(registrationName)) {
            delete registrationNameModules[registrationName];
          }
        }
      }
    };
    module.exports = EventPluginRegistry;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("44", ["2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var caughtError = null;
    function invokeGuardedCallback(name, func, a, b) {
      try {
        return func(a, b);
      } catch (x) {
        if (caughtError === null) {
          caughtError = x;
        }
        return undefined;
      }
    }
    var ReactErrorUtils = {
      invokeGuardedCallback: invokeGuardedCallback,
      invokeGuardedCallbackWithCatch: invokeGuardedCallback,
      rethrowCaughtError: function() {
        if (caughtError) {
          var error = caughtError;
          caughtError = null;
          throw error;
        }
      }
    };
    if (process.env.NODE_ENV !== 'production') {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event === 'function') {
        var fakeNode = document.createElement('react');
        ReactErrorUtils.invokeGuardedCallback = function(name, func, a, b) {
          var boundFunc = func.bind(null, a, b);
          fakeNode.addEventListener(name, boundFunc, false);
          fakeNode.dispatchEvent(new Event(name));
          fakeNode.removeEventListener(name, boundFunc, false);
        };
      }
    }
    module.exports = ReactErrorUtils;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("45", ["42", "44", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var EventConstants = req('42');
    var ReactErrorUtils = req('44');
    var invariant = req('30');
    var warning = req('40');
    var injection = {
      Mount: null,
      injectMount: function(InjectedMount) {
        injection.Mount = InjectedMount;
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(InjectedMount && InjectedMount.getNode && InjectedMount.getID, 'EventPluginUtils.injection.injectMount(...): Injected Mount ' + 'module is missing getNode or getID.') : undefined;
        }
      }
    };
    var topLevelTypes = EventConstants.topLevelTypes;
    function isEndish(topLevelType) {
      return topLevelType === topLevelTypes.topMouseUp || topLevelType === topLevelTypes.topTouchEnd || topLevelType === topLevelTypes.topTouchCancel;
    }
    function isMoveish(topLevelType) {
      return topLevelType === topLevelTypes.topMouseMove || topLevelType === topLevelTypes.topTouchMove;
    }
    function isStartish(topLevelType) {
      return topLevelType === topLevelTypes.topMouseDown || topLevelType === topLevelTypes.topTouchStart;
    }
    var validateEventDispatches;
    if (process.env.NODE_ENV !== 'production') {
      validateEventDispatches = function(event) {
        var dispatchListeners = event._dispatchListeners;
        var dispatchIDs = event._dispatchIDs;
        var listenersIsArr = Array.isArray(dispatchListeners);
        var idsIsArr = Array.isArray(dispatchIDs);
        var IDsLen = idsIsArr ? dispatchIDs.length : dispatchIDs ? 1 : 0;
        var listenersLen = listenersIsArr ? dispatchListeners.length : dispatchListeners ? 1 : 0;
        process.env.NODE_ENV !== 'production' ? warning(idsIsArr === listenersIsArr && IDsLen === listenersLen, 'EventPluginUtils: Invalid `event`.') : undefined;
      };
    }
    function executeDispatch(event, simulated, listener, domID) {
      var type = event.type || 'unknown-event';
      event.currentTarget = injection.Mount.getNode(domID);
      if (simulated) {
        ReactErrorUtils.invokeGuardedCallbackWithCatch(type, listener, event, domID);
      } else {
        ReactErrorUtils.invokeGuardedCallback(type, listener, event, domID);
      }
      event.currentTarget = null;
    }
    function executeDispatchesInOrder(event, simulated) {
      var dispatchListeners = event._dispatchListeners;
      var dispatchIDs = event._dispatchIDs;
      if (process.env.NODE_ENV !== 'production') {
        validateEventDispatches(event);
      }
      if (Array.isArray(dispatchListeners)) {
        for (var i = 0; i < dispatchListeners.length; i++) {
          if (event.isPropagationStopped()) {
            break;
          }
          executeDispatch(event, simulated, dispatchListeners[i], dispatchIDs[i]);
        }
      } else if (dispatchListeners) {
        executeDispatch(event, simulated, dispatchListeners, dispatchIDs);
      }
      event._dispatchListeners = null;
      event._dispatchIDs = null;
    }
    function executeDispatchesInOrderStopAtTrueImpl(event) {
      var dispatchListeners = event._dispatchListeners;
      var dispatchIDs = event._dispatchIDs;
      if (process.env.NODE_ENV !== 'production') {
        validateEventDispatches(event);
      }
      if (Array.isArray(dispatchListeners)) {
        for (var i = 0; i < dispatchListeners.length; i++) {
          if (event.isPropagationStopped()) {
            break;
          }
          if (dispatchListeners[i](event, dispatchIDs[i])) {
            return dispatchIDs[i];
          }
        }
      } else if (dispatchListeners) {
        if (dispatchListeners(event, dispatchIDs)) {
          return dispatchIDs;
        }
      }
      return null;
    }
    function executeDispatchesInOrderStopAtTrue(event) {
      var ret = executeDispatchesInOrderStopAtTrueImpl(event);
      event._dispatchIDs = null;
      event._dispatchListeners = null;
      return ret;
    }
    function executeDirectDispatch(event) {
      if (process.env.NODE_ENV !== 'production') {
        validateEventDispatches(event);
      }
      var dispatchListener = event._dispatchListeners;
      var dispatchID = event._dispatchIDs;
      !!Array.isArray(dispatchListener) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'executeDirectDispatch(...): Invalid `event`.') : invariant(false) : undefined;
      var res = dispatchListener ? dispatchListener(event, dispatchID) : null;
      event._dispatchListeners = null;
      event._dispatchIDs = null;
      return res;
    }
    function hasDispatches(event) {
      return !!event._dispatchListeners;
    }
    var EventPluginUtils = {
      isEndish: isEndish,
      isMoveish: isMoveish,
      isStartish: isStartish,
      executeDirectDispatch: executeDirectDispatch,
      executeDispatchesInOrder: executeDispatchesInOrder,
      executeDispatchesInOrderStopAtTrue: executeDispatchesInOrderStopAtTrue,
      hasDispatches: hasDispatches,
      getNode: function(id) {
        return injection.Mount.getNode(id);
      },
      getID: function(node) {
        return injection.Mount.getID(node);
      },
      injection: injection
    };
    module.exports = EventPluginUtils;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("46", ["30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = req('30');
    function accumulateInto(current, next) {
      !(next != null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'accumulateInto(...): Accumulated items must not be null or undefined.') : invariant(false) : undefined;
      if (current == null) {
        return next;
      }
      var currentIsArray = Array.isArray(current);
      var nextIsArray = Array.isArray(next);
      if (currentIsArray && nextIsArray) {
        current.push.apply(current, next);
        return current;
      }
      if (currentIsArray) {
        current.push(next);
        return current;
      }
      if (nextIsArray) {
        return [current].concat(next);
      }
      return [current, next];
    }
    module.exports = accumulateInto;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("47", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var forEachAccumulated = function(arr, cb, scope) {
    if (Array.isArray(arr)) {
      arr.forEach(cb, scope);
    } else if (arr) {
      cb.call(scope, arr);
    }
  };
  module.exports = forEachAccumulated;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("48", ["43", "45", "44", "46", "47", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var EventPluginRegistry = req('43');
    var EventPluginUtils = req('45');
    var ReactErrorUtils = req('44');
    var accumulateInto = req('46');
    var forEachAccumulated = req('47');
    var invariant = req('30');
    var warning = req('40');
    var listenerBank = {};
    var eventQueue = null;
    var executeDispatchesAndRelease = function(event, simulated) {
      if (event) {
        EventPluginUtils.executeDispatchesInOrder(event, simulated);
        if (!event.isPersistent()) {
          event.constructor.release(event);
        }
      }
    };
    var executeDispatchesAndReleaseSimulated = function(e) {
      return executeDispatchesAndRelease(e, true);
    };
    var executeDispatchesAndReleaseTopLevel = function(e) {
      return executeDispatchesAndRelease(e, false);
    };
    var InstanceHandle = null;
    function validateInstanceHandle() {
      var valid = InstanceHandle && InstanceHandle.traverseTwoPhase && InstanceHandle.traverseEnterLeave;
      process.env.NODE_ENV !== 'production' ? warning(valid, 'InstanceHandle not injected before use!') : undefined;
    }
    var EventPluginHub = {
      injection: {
        injectMount: EventPluginUtils.injection.injectMount,
        injectInstanceHandle: function(InjectedInstanceHandle) {
          InstanceHandle = InjectedInstanceHandle;
          if (process.env.NODE_ENV !== 'production') {
            validateInstanceHandle();
          }
        },
        getInstanceHandle: function() {
          if (process.env.NODE_ENV !== 'production') {
            validateInstanceHandle();
          }
          return InstanceHandle;
        },
        injectEventPluginOrder: EventPluginRegistry.injectEventPluginOrder,
        injectEventPluginsByName: EventPluginRegistry.injectEventPluginsByName
      },
      eventNameDispatchConfigs: EventPluginRegistry.eventNameDispatchConfigs,
      registrationNameModules: EventPluginRegistry.registrationNameModules,
      putListener: function(id, registrationName, listener) {
        !(typeof listener === 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected %s listener to be a function, instead got type %s', registrationName, typeof listener) : invariant(false) : undefined;
        var bankForRegistrationName = listenerBank[registrationName] || (listenerBank[registrationName] = {});
        bankForRegistrationName[id] = listener;
        var PluginModule = EventPluginRegistry.registrationNameModules[registrationName];
        if (PluginModule && PluginModule.didPutListener) {
          PluginModule.didPutListener(id, registrationName, listener);
        }
      },
      getListener: function(id, registrationName) {
        var bankForRegistrationName = listenerBank[registrationName];
        return bankForRegistrationName && bankForRegistrationName[id];
      },
      deleteListener: function(id, registrationName) {
        var PluginModule = EventPluginRegistry.registrationNameModules[registrationName];
        if (PluginModule && PluginModule.willDeleteListener) {
          PluginModule.willDeleteListener(id, registrationName);
        }
        var bankForRegistrationName = listenerBank[registrationName];
        if (bankForRegistrationName) {
          delete bankForRegistrationName[id];
        }
      },
      deleteAllListeners: function(id) {
        for (var registrationName in listenerBank) {
          if (!listenerBank[registrationName][id]) {
            continue;
          }
          var PluginModule = EventPluginRegistry.registrationNameModules[registrationName];
          if (PluginModule && PluginModule.willDeleteListener) {
            PluginModule.willDeleteListener(id, registrationName);
          }
          delete listenerBank[registrationName][id];
        }
      },
      extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
        var events;
        var plugins = EventPluginRegistry.plugins;
        for (var i = 0; i < plugins.length; i++) {
          var possiblePlugin = plugins[i];
          if (possiblePlugin) {
            var extractedEvents = possiblePlugin.extractEvents(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget);
            if (extractedEvents) {
              events = accumulateInto(events, extractedEvents);
            }
          }
        }
        return events;
      },
      enqueueEvents: function(events) {
        if (events) {
          eventQueue = accumulateInto(eventQueue, events);
        }
      },
      processEventQueue: function(simulated) {
        var processingEventQueue = eventQueue;
        eventQueue = null;
        if (simulated) {
          forEachAccumulated(processingEventQueue, executeDispatchesAndReleaseSimulated);
        } else {
          forEachAccumulated(processingEventQueue, executeDispatchesAndReleaseTopLevel);
        }
        !!eventQueue ? process.env.NODE_ENV !== 'production' ? invariant(false, 'processEventQueue(): Additional events were enqueued while processing ' + 'an event queue. Support for this has not yet been implemented.') : invariant(false) : undefined;
        ReactErrorUtils.rethrowCaughtError();
      },
      __purge: function() {
        listenerBank = {};
      },
      __getListenerBank: function() {
        return listenerBank;
      }
    };
    module.exports = EventPluginHub;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("49", ["48"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var EventPluginHub = req('48');
  function runEventQueueInBatch(events) {
    EventPluginHub.enqueueEvents(events);
    EventPluginHub.processEventQueue(false);
  }
  var ReactEventEmitterMixin = {handleTopLevel: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
      var events = EventPluginHub.extractEvents(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget);
      runEventQueueInBatch(events);
    }};
  module.exports = ReactEventEmitterMixin;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4a", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ViewportMetrics = {
    currentScrollLeft: 0,
    currentScrollTop: 0,
    refreshScrollValues: function(scrollPosition) {
      ViewportMetrics.currentScrollLeft = scrollPosition.x;
      ViewportMetrics.currentScrollTop = scrollPosition.y;
    }
  };
  module.exports = ViewportMetrics;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function assign(target, sources) {
    if (target == null) {
      throw new TypeError('Object.assign target cannot be null or undefined');
    }
    var to = Object(target);
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    for (var nextIndex = 1; nextIndex < arguments.length; nextIndex++) {
      var nextSource = arguments[nextIndex];
      if (nextSource == null) {
        continue;
      }
      var from = Object(nextSource);
      for (var key in from) {
        if (hasOwnProperty.call(from, key)) {
          to[key] = from[key];
        }
      }
    }
    return to;
  }
  module.exports = assign;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4c", ["2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ExecutionEnvironment = req('2b');
  var useHasFeature;
  if (ExecutionEnvironment.canUseDOM) {
    useHasFeature = document.implementation && document.implementation.hasFeature && document.implementation.hasFeature('', '') !== true;
  }
  function isEventSupported(eventNameSuffix, capture) {
    if (!ExecutionEnvironment.canUseDOM || capture && !('addEventListener' in document)) {
      return false;
    }
    var eventName = 'on' + eventNameSuffix;
    var isSupported = (eventName in document);
    if (!isSupported) {
      var element = document.createElement('div');
      element.setAttribute(eventName, 'return;');
      isSupported = typeof element[eventName] === 'function';
    }
    if (!isSupported && useHasFeature && eventNameSuffix === 'wheel') {
      isSupported = document.implementation.hasFeature('Events.wheel', '3.0');
    }
    return isSupported;
  }
  module.exports = isEventSupported;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4d", ["42", "48", "43", "49", "39", "4a", "4b", "4c", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var EventConstants = req('42');
    var EventPluginHub = req('48');
    var EventPluginRegistry = req('43');
    var ReactEventEmitterMixin = req('49');
    var ReactPerf = req('39');
    var ViewportMetrics = req('4a');
    var assign = req('4b');
    var isEventSupported = req('4c');
    var alreadyListeningTo = {};
    var isMonitoringScrollValue = false;
    var reactTopListenersCounter = 0;
    var topEventMapping = {
      topAbort: 'abort',
      topBlur: 'blur',
      topCanPlay: 'canplay',
      topCanPlayThrough: 'canplaythrough',
      topChange: 'change',
      topClick: 'click',
      topCompositionEnd: 'compositionend',
      topCompositionStart: 'compositionstart',
      topCompositionUpdate: 'compositionupdate',
      topContextMenu: 'contextmenu',
      topCopy: 'copy',
      topCut: 'cut',
      topDoubleClick: 'dblclick',
      topDrag: 'drag',
      topDragEnd: 'dragend',
      topDragEnter: 'dragenter',
      topDragExit: 'dragexit',
      topDragLeave: 'dragleave',
      topDragOver: 'dragover',
      topDragStart: 'dragstart',
      topDrop: 'drop',
      topDurationChange: 'durationchange',
      topEmptied: 'emptied',
      topEncrypted: 'encrypted',
      topEnded: 'ended',
      topError: 'error',
      topFocus: 'focus',
      topInput: 'input',
      topKeyDown: 'keydown',
      topKeyPress: 'keypress',
      topKeyUp: 'keyup',
      topLoadedData: 'loadeddata',
      topLoadedMetadata: 'loadedmetadata',
      topLoadStart: 'loadstart',
      topMouseDown: 'mousedown',
      topMouseMove: 'mousemove',
      topMouseOut: 'mouseout',
      topMouseOver: 'mouseover',
      topMouseUp: 'mouseup',
      topPaste: 'paste',
      topPause: 'pause',
      topPlay: 'play',
      topPlaying: 'playing',
      topProgress: 'progress',
      topRateChange: 'ratechange',
      topScroll: 'scroll',
      topSeeked: 'seeked',
      topSeeking: 'seeking',
      topSelectionChange: 'selectionchange',
      topStalled: 'stalled',
      topSuspend: 'suspend',
      topTextInput: 'textInput',
      topTimeUpdate: 'timeupdate',
      topTouchCancel: 'touchcancel',
      topTouchEnd: 'touchend',
      topTouchMove: 'touchmove',
      topTouchStart: 'touchstart',
      topVolumeChange: 'volumechange',
      topWaiting: 'waiting',
      topWheel: 'wheel'
    };
    var topListenersIDKey = '_reactListenersID' + String(Math.random()).slice(2);
    function getListeningForDocument(mountAt) {
      if (!Object.prototype.hasOwnProperty.call(mountAt, topListenersIDKey)) {
        mountAt[topListenersIDKey] = reactTopListenersCounter++;
        alreadyListeningTo[mountAt[topListenersIDKey]] = {};
      }
      return alreadyListeningTo[mountAt[topListenersIDKey]];
    }
    var ReactBrowserEventEmitter = assign({}, ReactEventEmitterMixin, {
      ReactEventListener: null,
      injection: {injectReactEventListener: function(ReactEventListener) {
          ReactEventListener.setHandleTopLevel(ReactBrowserEventEmitter.handleTopLevel);
          ReactBrowserEventEmitter.ReactEventListener = ReactEventListener;
        }},
      setEnabled: function(enabled) {
        if (ReactBrowserEventEmitter.ReactEventListener) {
          ReactBrowserEventEmitter.ReactEventListener.setEnabled(enabled);
        }
      },
      isEnabled: function() {
        return !!(ReactBrowserEventEmitter.ReactEventListener && ReactBrowserEventEmitter.ReactEventListener.isEnabled());
      },
      listenTo: function(registrationName, contentDocumentHandle) {
        var mountAt = contentDocumentHandle;
        var isListening = getListeningForDocument(mountAt);
        var dependencies = EventPluginRegistry.registrationNameDependencies[registrationName];
        var topLevelTypes = EventConstants.topLevelTypes;
        for (var i = 0; i < dependencies.length; i++) {
          var dependency = dependencies[i];
          if (!(isListening.hasOwnProperty(dependency) && isListening[dependency])) {
            if (dependency === topLevelTypes.topWheel) {
              if (isEventSupported('wheel')) {
                ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topWheel, 'wheel', mountAt);
              } else if (isEventSupported('mousewheel')) {
                ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topWheel, 'mousewheel', mountAt);
              } else {
                ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topWheel, 'DOMMouseScroll', mountAt);
              }
            } else if (dependency === topLevelTypes.topScroll) {
              if (isEventSupported('scroll', true)) {
                ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(topLevelTypes.topScroll, 'scroll', mountAt);
              } else {
                ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topScroll, 'scroll', ReactBrowserEventEmitter.ReactEventListener.WINDOW_HANDLE);
              }
            } else if (dependency === topLevelTypes.topFocus || dependency === topLevelTypes.topBlur) {
              if (isEventSupported('focus', true)) {
                ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(topLevelTypes.topFocus, 'focus', mountAt);
                ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(topLevelTypes.topBlur, 'blur', mountAt);
              } else if (isEventSupported('focusin')) {
                ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topFocus, 'focusin', mountAt);
                ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelTypes.topBlur, 'focusout', mountAt);
              }
              isListening[topLevelTypes.topBlur] = true;
              isListening[topLevelTypes.topFocus] = true;
            } else if (topEventMapping.hasOwnProperty(dependency)) {
              ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(dependency, topEventMapping[dependency], mountAt);
            }
            isListening[dependency] = true;
          }
        }
      },
      trapBubbledEvent: function(topLevelType, handlerBaseName, handle) {
        return ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(topLevelType, handlerBaseName, handle);
      },
      trapCapturedEvent: function(topLevelType, handlerBaseName, handle) {
        return ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(topLevelType, handlerBaseName, handle);
      },
      ensureScrollValueMonitoring: function() {
        if (!isMonitoringScrollValue) {
          var refresh = ViewportMetrics.refreshScrollValues;
          ReactBrowserEventEmitter.ReactEventListener.monitorScrollValue(refresh);
          isMonitoringScrollValue = true;
        }
      },
      eventNameDispatchConfigs: EventPluginHub.eventNameDispatchConfigs,
      registrationNameModules: EventPluginHub.registrationNameModules,
      putListener: EventPluginHub.putListener,
      getListener: EventPluginHub.getListener,
      deleteListener: EventPluginHub.deleteListener,
      deleteAllListeners: EventPluginHub.deleteAllListeners
    });
    ReactPerf.measureMethods(ReactBrowserEventEmitter, 'ReactBrowserEventEmitter', {
      putListener: 'putListener',
      deleteListener: 'deleteListener'
    });
    module.exports = ReactBrowserEventEmitter;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4e", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactDOMFeatureFlags = {useCreateElement: false};
  module.exports = ReactDOMFeatureFlags;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4f", ["2a", "4b", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactCurrentOwner = req('2a');
    var assign = req('4b');
    var REACT_ELEMENT_TYPE = typeof Symbol === 'function' && Symbol['for'] && Symbol['for']('react.element') || 0xeac7;
    var RESERVED_PROPS = {
      key: true,
      ref: true,
      __self: true,
      __source: true
    };
    var canDefineProperty = false;
    if (process.env.NODE_ENV !== 'production') {
      try {
        Object.defineProperty({}, 'x', {});
        canDefineProperty = true;
      } catch (x) {}
    }
    var ReactElement = function(type, key, ref, self, source, owner, props) {
      var element = {
        $$typeof: REACT_ELEMENT_TYPE,
        type: type,
        key: key,
        ref: ref,
        props: props,
        _owner: owner
      };
      if (process.env.NODE_ENV !== 'production') {
        element._store = {};
        if (canDefineProperty) {
          Object.defineProperty(element._store, 'validated', {
            configurable: false,
            enumerable: false,
            writable: true,
            value: false
          });
          Object.defineProperty(element, '_self', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: self
          });
          Object.defineProperty(element, '_source', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: source
          });
        } else {
          element._store.validated = false;
          element._self = self;
          element._source = source;
        }
        Object.freeze(element.props);
        Object.freeze(element);
      }
      return element;
    };
    ReactElement.createElement = function(type, config, children) {
      var propName;
      var props = {};
      var key = null;
      var ref = null;
      var self = null;
      var source = null;
      if (config != null) {
        ref = config.ref === undefined ? null : config.ref;
        key = config.key === undefined ? null : '' + config.key;
        self = config.__self === undefined ? null : config.__self;
        source = config.__source === undefined ? null : config.__source;
        for (propName in config) {
          if (config.hasOwnProperty(propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
            props[propName] = config[propName];
          }
        }
      }
      var childrenLength = arguments.length - 2;
      if (childrenLength === 1) {
        props.children = children;
      } else if (childrenLength > 1) {
        var childArray = Array(childrenLength);
        for (var i = 0; i < childrenLength; i++) {
          childArray[i] = arguments[i + 2];
        }
        props.children = childArray;
      }
      if (type && type.defaultProps) {
        var defaultProps = type.defaultProps;
        for (propName in defaultProps) {
          if (typeof props[propName] === 'undefined') {
            props[propName] = defaultProps[propName];
          }
        }
      }
      return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
    };
    ReactElement.createFactory = function(type) {
      var factory = ReactElement.createElement.bind(null, type);
      factory.type = type;
      return factory;
    };
    ReactElement.cloneAndReplaceKey = function(oldElement, newKey) {
      var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
      return newElement;
    };
    ReactElement.cloneAndReplaceProps = function(oldElement, newProps) {
      var newElement = ReactElement(oldElement.type, oldElement.key, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, newProps);
      if (process.env.NODE_ENV !== 'production') {
        newElement._store.validated = oldElement._store.validated;
      }
      return newElement;
    };
    ReactElement.cloneElement = function(element, config, children) {
      var propName;
      var props = assign({}, element.props);
      var key = element.key;
      var ref = element.ref;
      var self = element._self;
      var source = element._source;
      var owner = element._owner;
      if (config != null) {
        if (config.ref !== undefined) {
          ref = config.ref;
          owner = ReactCurrentOwner.current;
        }
        if (config.key !== undefined) {
          key = '' + config.key;
        }
        for (propName in config) {
          if (config.hasOwnProperty(propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
            props[propName] = config[propName];
          }
        }
      }
      var childrenLength = arguments.length - 2;
      if (childrenLength === 1) {
        props.children = children;
      } else if (childrenLength > 1) {
        var childArray = Array(childrenLength);
        for (var i = 0; i < childrenLength; i++) {
          childArray[i] = arguments[i + 2];
        }
        props.children = childArray;
      }
      return ReactElement(element.type, key, ref, self, source, owner, props);
    };
    ReactElement.isValidElement = function(object) {
      return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    };
    module.exports = ReactElement;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("50", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var nullComponentIDsRegistry = {};
  function isNullComponentID(id) {
    return !!nullComponentIDsRegistry[id];
  }
  function registerNullComponentID(id) {
    nullComponentIDsRegistry[id] = true;
  }
  function deregisterNullComponentID(id) {
    delete nullComponentIDsRegistry[id];
  }
  var ReactEmptyComponentRegistry = {
    isNullComponentID: isNullComponentID,
    registerNullComponentID: registerNullComponentID,
    deregisterNullComponentID: deregisterNullComponentID
  };
  module.exports = ReactEmptyComponentRegistry;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("51", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactRootIndexInjection = {injectCreateReactRootIndex: function(_createReactRootIndex) {
      ReactRootIndex.createReactRootIndex = _createReactRootIndex;
    }};
  var ReactRootIndex = {
    createReactRootIndex: null,
    injection: ReactRootIndexInjection
  };
  module.exports = ReactRootIndex;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("52", ["51", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactRootIndex = req('51');
    var invariant = req('30');
    var SEPARATOR = '.';
    var SEPARATOR_LENGTH = SEPARATOR.length;
    var MAX_TREE_DEPTH = 10000;
    function getReactRootIDString(index) {
      return SEPARATOR + index.toString(36);
    }
    function isBoundary(id, index) {
      return id.charAt(index) === SEPARATOR || index === id.length;
    }
    function isValidID(id) {
      return id === '' || id.charAt(0) === SEPARATOR && id.charAt(id.length - 1) !== SEPARATOR;
    }
    function isAncestorIDOf(ancestorID, descendantID) {
      return descendantID.indexOf(ancestorID) === 0 && isBoundary(descendantID, ancestorID.length);
    }
    function getParentID(id) {
      return id ? id.substr(0, id.lastIndexOf(SEPARATOR)) : '';
    }
    function getNextDescendantID(ancestorID, destinationID) {
      !(isValidID(ancestorID) && isValidID(destinationID)) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'getNextDescendantID(%s, %s): Received an invalid React DOM ID.', ancestorID, destinationID) : invariant(false) : undefined;
      !isAncestorIDOf(ancestorID, destinationID) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'getNextDescendantID(...): React has made an invalid assumption about ' + 'the DOM hierarchy. Expected `%s` to be an ancestor of `%s`.', ancestorID, destinationID) : invariant(false) : undefined;
      if (ancestorID === destinationID) {
        return ancestorID;
      }
      var start = ancestorID.length + SEPARATOR_LENGTH;
      var i;
      for (i = start; i < destinationID.length; i++) {
        if (isBoundary(destinationID, i)) {
          break;
        }
      }
      return destinationID.substr(0, i);
    }
    function getFirstCommonAncestorID(oneID, twoID) {
      var minLength = Math.min(oneID.length, twoID.length);
      if (minLength === 0) {
        return '';
      }
      var lastCommonMarkerIndex = 0;
      for (var i = 0; i <= minLength; i++) {
        if (isBoundary(oneID, i) && isBoundary(twoID, i)) {
          lastCommonMarkerIndex = i;
        } else if (oneID.charAt(i) !== twoID.charAt(i)) {
          break;
        }
      }
      var longestCommonID = oneID.substr(0, lastCommonMarkerIndex);
      !isValidID(longestCommonID) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'getFirstCommonAncestorID(%s, %s): Expected a valid React DOM ID: %s', oneID, twoID, longestCommonID) : invariant(false) : undefined;
      return longestCommonID;
    }
    function traverseParentPath(start, stop, cb, arg, skipFirst, skipLast) {
      start = start || '';
      stop = stop || '';
      !(start !== stop) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'traverseParentPath(...): Cannot traverse from and to the same ID, `%s`.', start) : invariant(false) : undefined;
      var traverseUp = isAncestorIDOf(stop, start);
      !(traverseUp || isAncestorIDOf(start, stop)) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'traverseParentPath(%s, %s, ...): Cannot traverse from two IDs that do ' + 'not have a parent path.', start, stop) : invariant(false) : undefined;
      var depth = 0;
      var traverse = traverseUp ? getParentID : getNextDescendantID;
      for (var id = start; ; id = traverse(id, stop)) {
        var ret;
        if ((!skipFirst || id !== start) && (!skipLast || id !== stop)) {
          ret = cb(id, traverseUp, arg);
        }
        if (ret === false || id === stop) {
          break;
        }
        !(depth++ < MAX_TREE_DEPTH) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'traverseParentPath(%s, %s, ...): Detected an infinite loop while ' + 'traversing the React DOM ID tree. This may be due to malformed IDs: %s', start, stop, id) : invariant(false) : undefined;
      }
    }
    var ReactInstanceHandles = {
      createReactRootID: function() {
        return getReactRootIDString(ReactRootIndex.createReactRootIndex());
      },
      createReactID: function(rootID, name) {
        return rootID + name;
      },
      getReactRootIDFromNodeID: function(id) {
        if (id && id.charAt(0) === SEPARATOR && id.length > 1) {
          var index = id.indexOf(SEPARATOR, 1);
          return index > -1 ? id.substr(0, index) : id;
        }
        return null;
      },
      traverseEnterLeave: function(leaveID, enterID, cb, upArg, downArg) {
        var ancestorID = getFirstCommonAncestorID(leaveID, enterID);
        if (ancestorID !== leaveID) {
          traverseParentPath(leaveID, ancestorID, cb, upArg, false, true);
        }
        if (ancestorID !== enterID) {
          traverseParentPath(ancestorID, enterID, cb, downArg, true, false);
        }
      },
      traverseTwoPhase: function(targetID, cb, arg) {
        if (targetID) {
          traverseParentPath('', targetID, cb, arg, true, false);
          traverseParentPath(targetID, '', cb, arg, false, true);
        }
      },
      traverseTwoPhaseSkipTarget: function(targetID, cb, arg) {
        if (targetID) {
          traverseParentPath('', targetID, cb, arg, true, true);
          traverseParentPath(targetID, '', cb, arg, true, true);
        }
      },
      traverseAncestors: function(targetID, cb, arg) {
        traverseParentPath('', targetID, cb, arg, true, false);
      },
      getFirstCommonAncestorID: getFirstCommonAncestorID,
      _getNextDescendantID: getNextDescendantID,
      isAncestorIDOf: isAncestorIDOf,
      SEPARATOR: SEPARATOR
    };
    module.exports = ReactInstanceHandles;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("53", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactInstanceMap = {
    remove: function(key) {
      key._reactInternalInstance = undefined;
    },
    get: function(key) {
      return key._reactInternalInstance;
    },
    has: function(key) {
      return key._reactInternalInstance !== undefined;
    },
    set: function(key, value) {
      key._reactInternalInstance = value;
    }
  };
  module.exports = ReactInstanceMap;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("54", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var MOD = 65521;
  function adler32(data) {
    var a = 1;
    var b = 0;
    var i = 0;
    var l = data.length;
    var m = l & ~0x3;
    while (i < m) {
      for (; i < Math.min(i + 4096, m); i += 4) {
        b += (a += data.charCodeAt(i)) + (a += data.charCodeAt(i + 1)) + (a += data.charCodeAt(i + 2)) + (a += data.charCodeAt(i + 3));
      }
      a %= MOD;
      b %= MOD;
    }
    for (; i < l; i++) {
      b += a += data.charCodeAt(i);
    }
    a %= MOD;
    b %= MOD;
    return a | b << 16;
  }
  module.exports = adler32;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("55", ["54"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var adler32 = req('54');
  var TAG_END = /\/?>/;
  var ReactMarkupChecksum = {
    CHECKSUM_ATTR_NAME: 'data-react-checksum',
    addChecksumToMarkup: function(markup) {
      var checksum = adler32(markup);
      return markup.replace(TAG_END, ' ' + ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="' + checksum + '"$&');
    },
    canReuseMarkup: function(markup, element) {
      var existingChecksum = element.getAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME);
      existingChecksum = existingChecksum && parseInt(existingChecksum, 10);
      var markupChecksum = adler32(markup);
      return markupChecksum === existingChecksum;
    }
  };
  module.exports = ReactMarkupChecksum;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("56", ["30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = req('30');
    var ReactOwner = {
      isValidOwner: function(object) {
        return !!(object && typeof object.attachRef === 'function' && typeof object.detachRef === 'function');
      },
      addComponentAsRefTo: function(component, ref, owner) {
        !ReactOwner.isValidOwner(owner) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'addComponentAsRefTo(...): Only a ReactOwner can have refs. You might ' + 'be adding a ref to a component that was not created inside a component\'s ' + '`render` method, or you have multiple copies of React loaded ' + '(details: https://fb.me/react-refs-must-have-owner).') : invariant(false) : undefined;
        owner.attachRef(ref, component);
      },
      removeComponentAsRefFrom: function(component, ref, owner) {
        !ReactOwner.isValidOwner(owner) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'removeComponentAsRefFrom(...): Only a ReactOwner can have refs. You might ' + 'be removing a ref to a component that was not created inside a component\'s ' + '`render` method, or you have multiple copies of React loaded ' + '(details: https://fb.me/react-refs-must-have-owner).') : invariant(false) : undefined;
        if (owner.getPublicInstance().refs[ref] === component.getPublicInstance()) {
          owner.detachRef(ref);
        }
      }
    };
    module.exports = ReactOwner;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("57", ["56", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactOwner = req('56');
    var ReactRef = {};
    function attachRef(ref, component, owner) {
      if (typeof ref === 'function') {
        ref(component.getPublicInstance());
      } else {
        ReactOwner.addComponentAsRefTo(component, ref, owner);
      }
    }
    function detachRef(ref, component, owner) {
      if (typeof ref === 'function') {
        ref(null);
      } else {
        ReactOwner.removeComponentAsRefFrom(component, ref, owner);
      }
    }
    ReactRef.attachRefs = function(instance, element) {
      if (element === null || element === false) {
        return;
      }
      var ref = element.ref;
      if (ref != null) {
        attachRef(ref, instance, element._owner);
      }
    };
    ReactRef.shouldUpdateRefs = function(prevElement, nextElement) {
      var prevEmpty = prevElement === null || prevElement === false;
      var nextEmpty = nextElement === null || nextElement === false;
      return (prevEmpty || nextEmpty || nextElement._owner !== prevElement._owner || nextElement.ref !== prevElement.ref);
    };
    ReactRef.detachRefs = function(instance, element) {
      if (element === null || element === false) {
        return;
      }
      var ref = element.ref;
      if (ref != null) {
        detachRef(ref, instance, element._owner);
      }
    };
    module.exports = ReactRef;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("58", ["57"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactRef = req('57');
  function attachRefs() {
    ReactRef.attachRefs(this, this._currentElement);
  }
  var ReactReconciler = {
    mountComponent: function(internalInstance, rootID, transaction, context) {
      var markup = internalInstance.mountComponent(rootID, transaction, context);
      if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {
        transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
      }
      return markup;
    },
    unmountComponent: function(internalInstance) {
      ReactRef.detachRefs(internalInstance, internalInstance._currentElement);
      internalInstance.unmountComponent();
    },
    receiveComponent: function(internalInstance, nextElement, transaction, context) {
      var prevElement = internalInstance._currentElement;
      if (nextElement === prevElement && context === internalInstance._context) {
        return;
      }
      var refsChanged = ReactRef.shouldUpdateRefs(prevElement, nextElement);
      if (refsChanged) {
        ReactRef.detachRefs(internalInstance, prevElement);
      }
      internalInstance.receiveComponent(nextElement, transaction, context);
      if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {
        transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
      }
    },
    performUpdateIfNecessary: function(internalInstance, transaction) {
      internalInstance.performUpdateIfNecessary(transaction);
    }
  };
  module.exports = ReactReconciler;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("59", ["30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = req('30');
    var oneArgumentPooler = function(copyFieldsFrom) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, copyFieldsFrom);
        return instance;
      } else {
        return new Klass(copyFieldsFrom);
      }
    };
    var twoArgumentPooler = function(a1, a2) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, a1, a2);
        return instance;
      } else {
        return new Klass(a1, a2);
      }
    };
    var threeArgumentPooler = function(a1, a2, a3) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, a1, a2, a3);
        return instance;
      } else {
        return new Klass(a1, a2, a3);
      }
    };
    var fourArgumentPooler = function(a1, a2, a3, a4) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, a1, a2, a3, a4);
        return instance;
      } else {
        return new Klass(a1, a2, a3, a4);
      }
    };
    var fiveArgumentPooler = function(a1, a2, a3, a4, a5) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, a1, a2, a3, a4, a5);
        return instance;
      } else {
        return new Klass(a1, a2, a3, a4, a5);
      }
    };
    var standardReleaser = function(instance) {
      var Klass = this;
      !(instance instanceof Klass) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Trying to release an instance into a pool of a different type.') : invariant(false) : undefined;
      instance.destructor();
      if (Klass.instancePool.length < Klass.poolSize) {
        Klass.instancePool.push(instance);
      }
    };
    var DEFAULT_POOL_SIZE = 10;
    var DEFAULT_POOLER = oneArgumentPooler;
    var addPoolingTo = function(CopyConstructor, pooler) {
      var NewKlass = CopyConstructor;
      NewKlass.instancePool = [];
      NewKlass.getPooled = pooler || DEFAULT_POOLER;
      if (!NewKlass.poolSize) {
        NewKlass.poolSize = DEFAULT_POOL_SIZE;
      }
      NewKlass.release = standardReleaser;
      return NewKlass;
    };
    var PooledClass = {
      addPoolingTo: addPoolingTo,
      oneArgumentPooler: oneArgumentPooler,
      twoArgumentPooler: twoArgumentPooler,
      threeArgumentPooler: threeArgumentPooler,
      fourArgumentPooler: fourArgumentPooler,
      fiveArgumentPooler: fiveArgumentPooler
    };
    module.exports = PooledClass;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5a", ["59", "4b", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var PooledClass = req('59');
    var assign = req('4b');
    var invariant = req('30');
    function CallbackQueue() {
      this._callbacks = null;
      this._contexts = null;
    }
    assign(CallbackQueue.prototype, {
      enqueue: function(callback, context) {
        this._callbacks = this._callbacks || [];
        this._contexts = this._contexts || [];
        this._callbacks.push(callback);
        this._contexts.push(context);
      },
      notifyAll: function() {
        var callbacks = this._callbacks;
        var contexts = this._contexts;
        if (callbacks) {
          !(callbacks.length === contexts.length) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Mismatched list of contexts in callback queue') : invariant(false) : undefined;
          this._callbacks = null;
          this._contexts = null;
          for (var i = 0; i < callbacks.length; i++) {
            callbacks[i].call(contexts[i]);
          }
          callbacks.length = 0;
          contexts.length = 0;
        }
      },
      reset: function() {
        this._callbacks = null;
        this._contexts = null;
      },
      destructor: function() {
        this.reset();
      }
    });
    PooledClass.addPoolingTo(CallbackQueue);
    module.exports = CallbackQueue;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5b", ["30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = req('30');
    var Mixin = {
      reinitializeTransaction: function() {
        this.transactionWrappers = this.getTransactionWrappers();
        if (this.wrapperInitData) {
          this.wrapperInitData.length = 0;
        } else {
          this.wrapperInitData = [];
        }
        this._isInTransaction = false;
      },
      _isInTransaction: false,
      getTransactionWrappers: null,
      isInTransaction: function() {
        return !!this._isInTransaction;
      },
      perform: function(method, scope, a, b, c, d, e, f) {
        !!this.isInTransaction() ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Transaction.perform(...): Cannot initialize a transaction when there ' + 'is already an outstanding transaction.') : invariant(false) : undefined;
        var errorThrown;
        var ret;
        try {
          this._isInTransaction = true;
          errorThrown = true;
          this.initializeAll(0);
          ret = method.call(scope, a, b, c, d, e, f);
          errorThrown = false;
        } finally {
          try {
            if (errorThrown) {
              try {
                this.closeAll(0);
              } catch (err) {}
            } else {
              this.closeAll(0);
            }
          } finally {
            this._isInTransaction = false;
          }
        }
        return ret;
      },
      initializeAll: function(startIndex) {
        var transactionWrappers = this.transactionWrappers;
        for (var i = startIndex; i < transactionWrappers.length; i++) {
          var wrapper = transactionWrappers[i];
          try {
            this.wrapperInitData[i] = Transaction.OBSERVED_ERROR;
            this.wrapperInitData[i] = wrapper.initialize ? wrapper.initialize.call(this) : null;
          } finally {
            if (this.wrapperInitData[i] === Transaction.OBSERVED_ERROR) {
              try {
                this.initializeAll(i + 1);
              } catch (err) {}
            }
          }
        }
      },
      closeAll: function(startIndex) {
        !this.isInTransaction() ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Transaction.closeAll(): Cannot close transaction when none are open.') : invariant(false) : undefined;
        var transactionWrappers = this.transactionWrappers;
        for (var i = startIndex; i < transactionWrappers.length; i++) {
          var wrapper = transactionWrappers[i];
          var initData = this.wrapperInitData[i];
          var errorThrown;
          try {
            errorThrown = true;
            if (initData !== Transaction.OBSERVED_ERROR && wrapper.close) {
              wrapper.close.call(this, initData);
            }
            errorThrown = false;
          } finally {
            if (errorThrown) {
              try {
                this.closeAll(i + 1);
              } catch (e) {}
            }
          }
        }
        this.wrapperInitData.length = 0;
      }
    };
    var Transaction = {
      Mixin: Mixin,
      OBSERVED_ERROR: {}
    };
    module.exports = Transaction;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5c", ["5a", "59", "39", "58", "5b", "4b", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var CallbackQueue = req('5a');
    var PooledClass = req('59');
    var ReactPerf = req('39');
    var ReactReconciler = req('58');
    var Transaction = req('5b');
    var assign = req('4b');
    var invariant = req('30');
    var dirtyComponents = [];
    var asapCallbackQueue = CallbackQueue.getPooled();
    var asapEnqueued = false;
    var batchingStrategy = null;
    function ensureInjected() {
      !(ReactUpdates.ReactReconcileTransaction && batchingStrategy) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactUpdates: must inject a reconcile transaction class and batching ' + 'strategy') : invariant(false) : undefined;
    }
    var NESTED_UPDATES = {
      initialize: function() {
        this.dirtyComponentsLength = dirtyComponents.length;
      },
      close: function() {
        if (this.dirtyComponentsLength !== dirtyComponents.length) {
          dirtyComponents.splice(0, this.dirtyComponentsLength);
          flushBatchedUpdates();
        } else {
          dirtyComponents.length = 0;
        }
      }
    };
    var UPDATE_QUEUEING = {
      initialize: function() {
        this.callbackQueue.reset();
      },
      close: function() {
        this.callbackQueue.notifyAll();
      }
    };
    var TRANSACTION_WRAPPERS = [NESTED_UPDATES, UPDATE_QUEUEING];
    function ReactUpdatesFlushTransaction() {
      this.reinitializeTransaction();
      this.dirtyComponentsLength = null;
      this.callbackQueue = CallbackQueue.getPooled();
      this.reconcileTransaction = ReactUpdates.ReactReconcileTransaction.getPooled(false);
    }
    assign(ReactUpdatesFlushTransaction.prototype, Transaction.Mixin, {
      getTransactionWrappers: function() {
        return TRANSACTION_WRAPPERS;
      },
      destructor: function() {
        this.dirtyComponentsLength = null;
        CallbackQueue.release(this.callbackQueue);
        this.callbackQueue = null;
        ReactUpdates.ReactReconcileTransaction.release(this.reconcileTransaction);
        this.reconcileTransaction = null;
      },
      perform: function(method, scope, a) {
        return Transaction.Mixin.perform.call(this, this.reconcileTransaction.perform, this.reconcileTransaction, method, scope, a);
      }
    });
    PooledClass.addPoolingTo(ReactUpdatesFlushTransaction);
    function batchedUpdates(callback, a, b, c, d, e) {
      ensureInjected();
      batchingStrategy.batchedUpdates(callback, a, b, c, d, e);
    }
    function mountOrderComparator(c1, c2) {
      return c1._mountOrder - c2._mountOrder;
    }
    function runBatchedUpdates(transaction) {
      var len = transaction.dirtyComponentsLength;
      !(len === dirtyComponents.length) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected flush transaction\'s stored dirty-components length (%s) to ' + 'match dirty-components array length (%s).', len, dirtyComponents.length) : invariant(false) : undefined;
      dirtyComponents.sort(mountOrderComparator);
      for (var i = 0; i < len; i++) {
        var component = dirtyComponents[i];
        var callbacks = component._pendingCallbacks;
        component._pendingCallbacks = null;
        ReactReconciler.performUpdateIfNecessary(component, transaction.reconcileTransaction);
        if (callbacks) {
          for (var j = 0; j < callbacks.length; j++) {
            transaction.callbackQueue.enqueue(callbacks[j], component.getPublicInstance());
          }
        }
      }
    }
    var flushBatchedUpdates = function() {
      while (dirtyComponents.length || asapEnqueued) {
        if (dirtyComponents.length) {
          var transaction = ReactUpdatesFlushTransaction.getPooled();
          transaction.perform(runBatchedUpdates, null, transaction);
          ReactUpdatesFlushTransaction.release(transaction);
        }
        if (asapEnqueued) {
          asapEnqueued = false;
          var queue = asapCallbackQueue;
          asapCallbackQueue = CallbackQueue.getPooled();
          queue.notifyAll();
          CallbackQueue.release(queue);
        }
      }
    };
    flushBatchedUpdates = ReactPerf.measure('ReactUpdates', 'flushBatchedUpdates', flushBatchedUpdates);
    function enqueueUpdate(component) {
      ensureInjected();
      if (!batchingStrategy.isBatchingUpdates) {
        batchingStrategy.batchedUpdates(enqueueUpdate, component);
        return;
      }
      dirtyComponents.push(component);
    }
    function asap(callback, context) {
      !batchingStrategy.isBatchingUpdates ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactUpdates.asap: Can\'t enqueue an asap callback in a context where' + 'updates are not being batched.') : invariant(false) : undefined;
      asapCallbackQueue.enqueue(callback, context);
      asapEnqueued = true;
    }
    var ReactUpdatesInjection = {
      injectReconcileTransaction: function(ReconcileTransaction) {
        !ReconcileTransaction ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactUpdates: must provide a reconcile transaction class') : invariant(false) : undefined;
        ReactUpdates.ReactReconcileTransaction = ReconcileTransaction;
      },
      injectBatchingStrategy: function(_batchingStrategy) {
        !_batchingStrategy ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactUpdates: must provide a batching strategy') : invariant(false) : undefined;
        !(typeof _batchingStrategy.batchedUpdates === 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactUpdates: must provide a batchedUpdates() function') : invariant(false) : undefined;
        !(typeof _batchingStrategy.isBatchingUpdates === 'boolean') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactUpdates: must provide an isBatchingUpdates boolean attribute') : invariant(false) : undefined;
        batchingStrategy = _batchingStrategy;
      }
    };
    var ReactUpdates = {
      ReactReconcileTransaction: null,
      batchedUpdates: batchedUpdates,
      enqueueUpdate: enqueueUpdate,
      flushBatchedUpdates: flushBatchedUpdates,
      injection: ReactUpdatesInjection,
      asap: asap
    };
    module.exports = ReactUpdates;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5d", ["2a", "4f", "53", "5c", "4b", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactCurrentOwner = req('2a');
    var ReactElement = req('4f');
    var ReactInstanceMap = req('53');
    var ReactUpdates = req('5c');
    var assign = req('4b');
    var invariant = req('30');
    var warning = req('40');
    function enqueueUpdate(internalInstance) {
      ReactUpdates.enqueueUpdate(internalInstance);
    }
    function getInternalInstanceReadyForUpdate(publicInstance, callerName) {
      var internalInstance = ReactInstanceMap.get(publicInstance);
      if (!internalInstance) {
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(!callerName, '%s(...): Can only update a mounted or mounting component. ' + 'This usually means you called %s() on an unmounted component. ' + 'This is a no-op. Please check the code for the %s component.', callerName, callerName, publicInstance.constructor.displayName) : undefined;
        }
        return null;
      }
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(ReactCurrentOwner.current == null, '%s(...): Cannot update during an existing state transition ' + '(such as within `render`). Render methods should be a pure function ' + 'of props and state.', callerName) : undefined;
      }
      return internalInstance;
    }
    var ReactUpdateQueue = {
      isMounted: function(publicInstance) {
        if (process.env.NODE_ENV !== 'production') {
          var owner = ReactCurrentOwner.current;
          if (owner !== null) {
            process.env.NODE_ENV !== 'production' ? warning(owner._warnedAboutRefsInRender, '%s is accessing isMounted inside its render() function. ' + 'render() should be a pure function of props and state. It should ' + 'never access something that requires stale data from the previous ' + 'render, such as refs. Move this logic to componentDidMount and ' + 'componentDidUpdate instead.', owner.getName() || 'A component') : undefined;
            owner._warnedAboutRefsInRender = true;
          }
        }
        var internalInstance = ReactInstanceMap.get(publicInstance);
        if (internalInstance) {
          return !!internalInstance._renderedComponent;
        } else {
          return false;
        }
      },
      enqueueCallback: function(publicInstance, callback) {
        !(typeof callback === 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'enqueueCallback(...): You called `setProps`, `replaceProps`, ' + '`setState`, `replaceState`, or `forceUpdate` with a callback that ' + 'isn\'t callable.') : invariant(false) : undefined;
        var internalInstance = getInternalInstanceReadyForUpdate(publicInstance);
        if (!internalInstance) {
          return null;
        }
        if (internalInstance._pendingCallbacks) {
          internalInstance._pendingCallbacks.push(callback);
        } else {
          internalInstance._pendingCallbacks = [callback];
        }
        enqueueUpdate(internalInstance);
      },
      enqueueCallbackInternal: function(internalInstance, callback) {
        !(typeof callback === 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'enqueueCallback(...): You called `setProps`, `replaceProps`, ' + '`setState`, `replaceState`, or `forceUpdate` with a callback that ' + 'isn\'t callable.') : invariant(false) : undefined;
        if (internalInstance._pendingCallbacks) {
          internalInstance._pendingCallbacks.push(callback);
        } else {
          internalInstance._pendingCallbacks = [callback];
        }
        enqueueUpdate(internalInstance);
      },
      enqueueForceUpdate: function(publicInstance) {
        var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'forceUpdate');
        if (!internalInstance) {
          return;
        }
        internalInstance._pendingForceUpdate = true;
        enqueueUpdate(internalInstance);
      },
      enqueueReplaceState: function(publicInstance, completeState) {
        var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'replaceState');
        if (!internalInstance) {
          return;
        }
        internalInstance._pendingStateQueue = [completeState];
        internalInstance._pendingReplaceState = true;
        enqueueUpdate(internalInstance);
      },
      enqueueSetState: function(publicInstance, partialState) {
        var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'setState');
        if (!internalInstance) {
          return;
        }
        var queue = internalInstance._pendingStateQueue || (internalInstance._pendingStateQueue = []);
        queue.push(partialState);
        enqueueUpdate(internalInstance);
      },
      enqueueSetProps: function(publicInstance, partialProps) {
        var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'setProps');
        if (!internalInstance) {
          return;
        }
        ReactUpdateQueue.enqueueSetPropsInternal(internalInstance, partialProps);
      },
      enqueueSetPropsInternal: function(internalInstance, partialProps) {
        var topLevelWrapper = internalInstance._topLevelWrapper;
        !topLevelWrapper ? process.env.NODE_ENV !== 'production' ? invariant(false, 'setProps(...): You called `setProps` on a ' + 'component with a parent. This is an anti-pattern since props will ' + 'get reactively updated when rendered. Instead, change the owner\'s ' + '`render` method to pass the correct value as props to the component ' + 'where it is created.') : invariant(false) : undefined;
        var wrapElement = topLevelWrapper._pendingElement || topLevelWrapper._currentElement;
        var element = wrapElement.props;
        var props = assign({}, element.props, partialProps);
        topLevelWrapper._pendingElement = ReactElement.cloneAndReplaceProps(wrapElement, ReactElement.cloneAndReplaceProps(element, props));
        enqueueUpdate(topLevelWrapper);
      },
      enqueueReplaceProps: function(publicInstance, props) {
        var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'replaceProps');
        if (!internalInstance) {
          return;
        }
        ReactUpdateQueue.enqueueReplacePropsInternal(internalInstance, props);
      },
      enqueueReplacePropsInternal: function(internalInstance, props) {
        var topLevelWrapper = internalInstance._topLevelWrapper;
        !topLevelWrapper ? process.env.NODE_ENV !== 'production' ? invariant(false, 'replaceProps(...): You called `replaceProps` on a ' + 'component with a parent. This is an anti-pattern since props will ' + 'get reactively updated when rendered. Instead, change the owner\'s ' + '`render` method to pass the correct value as props to the component ' + 'where it is created.') : invariant(false) : undefined;
        var wrapElement = topLevelWrapper._pendingElement || topLevelWrapper._currentElement;
        var element = wrapElement.props;
        topLevelWrapper._pendingElement = ReactElement.cloneAndReplaceProps(wrapElement, ReactElement.cloneAndReplaceProps(element, props));
        enqueueUpdate(topLevelWrapper);
      },
      enqueueElementInternal: function(internalInstance, newElement) {
        internalInstance._pendingElement = newElement;
        enqueueUpdate(internalInstance);
      }
    };
    module.exports = ReactUpdateQueue;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5e", ["2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var emptyObject = {};
    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(emptyObject);
    }
    module.exports = emptyObject;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5f", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function isNode(object) {
    return !!(object && (typeof Node === 'function' ? object instanceof Node : typeof object === 'object' && typeof object.nodeType === 'number' && typeof object.nodeName === 'string'));
  }
  module.exports = isNode;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("60", ["5f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var isNode = req('5f');
  function isTextNode(object) {
    return isNode(object) && object.nodeType == 3;
  }
  module.exports = isTextNode;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("61", ["60"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var isTextNode = req('60');
  function containsNode(_x, _x2) {
    var _again = true;
    _function: while (_again) {
      var outerNode = _x,
          innerNode = _x2;
      _again = false;
      if (!outerNode || !innerNode) {
        return false;
      } else if (outerNode === innerNode) {
        return true;
      } else if (isTextNode(outerNode)) {
        return false;
      } else if (isTextNode(innerNode)) {
        _x = outerNode;
        _x2 = innerNode.parentNode;
        _again = true;
        continue _function;
      } else if (outerNode.contains) {
        return outerNode.contains(innerNode);
      } else if (outerNode.compareDocumentPosition) {
        return !!(outerNode.compareDocumentPosition(innerNode) & 16);
      } else {
        return false;
      }
    }
  }
  module.exports = containsNode;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("62", ["30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var invariant = req('30');
    var injected = false;
    var ReactComponentEnvironment = {
      unmountIDFromEnvironment: null,
      replaceNodeWithMarkupByID: null,
      processChildrenUpdates: null,
      injection: {injectEnvironment: function(environment) {
          !!injected ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactCompositeComponent: injectEnvironment() can only be called once.') : invariant(false) : undefined;
          ReactComponentEnvironment.unmountIDFromEnvironment = environment.unmountIDFromEnvironment;
          ReactComponentEnvironment.replaceNodeWithMarkupByID = environment.replaceNodeWithMarkupByID;
          ReactComponentEnvironment.processChildrenUpdates = environment.processChildrenUpdates;
          injected = true;
        }}
    };
    module.exports = ReactComponentEnvironment;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("63", ["37"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var keyMirror = req('37');
  var ReactPropTypeLocations = keyMirror({
    prop: null,
    context: null,
    childContext: null
  });
  module.exports = ReactPropTypeLocations;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("64", ["2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactPropTypeLocationNames = {};
    if (process.env.NODE_ENV !== 'production') {
      ReactPropTypeLocationNames = {
        prop: 'prop',
        context: 'context',
        childContext: 'child context'
      };
    }
    module.exports = ReactPropTypeLocationNames;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("65", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function shouldUpdateReactComponent(prevElement, nextElement) {
    var prevEmpty = prevElement === null || prevElement === false;
    var nextEmpty = nextElement === null || nextElement === false;
    if (prevEmpty || nextEmpty) {
      return prevEmpty === nextEmpty;
    }
    var prevType = typeof prevElement;
    var nextType = typeof nextElement;
    if (prevType === 'string' || prevType === 'number') {
      return nextType === 'string' || nextType === 'number';
    } else {
      return nextType === 'object' && prevElement.type === nextElement.type && prevElement.key === nextElement.key;
    }
    return false;
  }
  module.exports = shouldUpdateReactComponent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("66", ["62", "2a", "4f", "53", "39", "63", "64", "58", "5d", "4b", "5e", "30", "65", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactComponentEnvironment = req('62');
    var ReactCurrentOwner = req('2a');
    var ReactElement = req('4f');
    var ReactInstanceMap = req('53');
    var ReactPerf = req('39');
    var ReactPropTypeLocations = req('63');
    var ReactPropTypeLocationNames = req('64');
    var ReactReconciler = req('58');
    var ReactUpdateQueue = req('5d');
    var assign = req('4b');
    var emptyObject = req('5e');
    var invariant = req('30');
    var shouldUpdateReactComponent = req('65');
    var warning = req('40');
    function getDeclarationErrorAddendum(component) {
      var owner = component._currentElement._owner || null;
      if (owner) {
        var name = owner.getName();
        if (name) {
          return ' Check the render method of `' + name + '`.';
        }
      }
      return '';
    }
    function StatelessComponent(Component) {}
    StatelessComponent.prototype.render = function() {
      var Component = ReactInstanceMap.get(this)._currentElement.type;
      return Component(this.props, this.context, this.updater);
    };
    var nextMountID = 1;
    var ReactCompositeComponentMixin = {
      construct: function(element) {
        this._currentElement = element;
        this._rootNodeID = null;
        this._instance = null;
        this._pendingElement = null;
        this._pendingStateQueue = null;
        this._pendingReplaceState = false;
        this._pendingForceUpdate = false;
        this._renderedComponent = null;
        this._context = null;
        this._mountOrder = 0;
        this._topLevelWrapper = null;
        this._pendingCallbacks = null;
      },
      mountComponent: function(rootID, transaction, context) {
        this._context = context;
        this._mountOrder = nextMountID++;
        this._rootNodeID = rootID;
        var publicProps = this._processProps(this._currentElement.props);
        var publicContext = this._processContext(context);
        var Component = this._currentElement.type;
        var inst;
        var renderedElement;
        var canInstantiate = ('prototype' in Component);
        if (canInstantiate) {
          if (process.env.NODE_ENV !== 'production') {
            ReactCurrentOwner.current = this;
            try {
              inst = new Component(publicProps, publicContext, ReactUpdateQueue);
            } finally {
              ReactCurrentOwner.current = null;
            }
          } else {
            inst = new Component(publicProps, publicContext, ReactUpdateQueue);
          }
        }
        if (!canInstantiate || inst === null || inst === false || ReactElement.isValidElement(inst)) {
          renderedElement = inst;
          inst = new StatelessComponent(Component);
        }
        if (process.env.NODE_ENV !== 'production') {
          if (inst.render == null) {
            process.env.NODE_ENV !== 'production' ? warning(false, '%s(...): No `render` method found on the returned component ' + 'instance: you may have forgotten to define `render`, returned ' + 'null/false from a stateless component, or tried to render an ' + 'element whose type is a function that isn\'t a React component.', Component.displayName || Component.name || 'Component') : undefined;
          } else {
            process.env.NODE_ENV !== 'production' ? warning(Component.prototype && Component.prototype.isReactComponent || !canInstantiate || !(inst instanceof Component), '%s(...): React component classes must extend React.Component.', Component.displayName || Component.name || 'Component') : undefined;
          }
        }
        inst.props = publicProps;
        inst.context = publicContext;
        inst.refs = emptyObject;
        inst.updater = ReactUpdateQueue;
        this._instance = inst;
        ReactInstanceMap.set(inst, this);
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(!inst.getInitialState || inst.getInitialState.isReactClassApproved, 'getInitialState was defined on %s, a plain JavaScript class. ' + 'This is only supported for classes created using React.createClass. ' + 'Did you mean to define a state property instead?', this.getName() || 'a component') : undefined;
          process.env.NODE_ENV !== 'production' ? warning(!inst.getDefaultProps || inst.getDefaultProps.isReactClassApproved, 'getDefaultProps was defined on %s, a plain JavaScript class. ' + 'This is only supported for classes created using React.createClass. ' + 'Use a static property to define defaultProps instead.', this.getName() || 'a component') : undefined;
          process.env.NODE_ENV !== 'production' ? warning(!inst.propTypes, 'propTypes was defined as an instance property on %s. Use a static ' + 'property to define propTypes instead.', this.getName() || 'a component') : undefined;
          process.env.NODE_ENV !== 'production' ? warning(!inst.contextTypes, 'contextTypes was defined as an instance property on %s. Use a ' + 'static property to define contextTypes instead.', this.getName() || 'a component') : undefined;
          process.env.NODE_ENV !== 'production' ? warning(typeof inst.componentShouldUpdate !== 'function', '%s has a method called ' + 'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' + 'The name is phrased as a question because the function is ' + 'expected to return a value.', this.getName() || 'A component') : undefined;
          process.env.NODE_ENV !== 'production' ? warning(typeof inst.componentDidUnmount !== 'function', '%s has a method called ' + 'componentDidUnmount(). But there is no such lifecycle method. ' + 'Did you mean componentWillUnmount()?', this.getName() || 'A component') : undefined;
          process.env.NODE_ENV !== 'production' ? warning(typeof inst.componentWillRecieveProps !== 'function', '%s has a method called ' + 'componentWillRecieveProps(). Did you mean componentWillReceiveProps()?', this.getName() || 'A component') : undefined;
        }
        var initialState = inst.state;
        if (initialState === undefined) {
          inst.state = initialState = null;
        }
        !(typeof initialState === 'object' && !Array.isArray(initialState)) ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.state: must be set to an object or null', this.getName() || 'ReactCompositeComponent') : invariant(false) : undefined;
        this._pendingStateQueue = null;
        this._pendingReplaceState = false;
        this._pendingForceUpdate = false;
        if (inst.componentWillMount) {
          inst.componentWillMount();
          if (this._pendingStateQueue) {
            inst.state = this._processPendingState(inst.props, inst.context);
          }
        }
        if (renderedElement === undefined) {
          renderedElement = this._renderValidatedComponent();
        }
        this._renderedComponent = this._instantiateReactComponent(renderedElement);
        var markup = ReactReconciler.mountComponent(this._renderedComponent, rootID, transaction, this._processChildContext(context));
        if (inst.componentDidMount) {
          transaction.getReactMountReady().enqueue(inst.componentDidMount, inst);
        }
        return markup;
      },
      unmountComponent: function() {
        var inst = this._instance;
        if (inst.componentWillUnmount) {
          inst.componentWillUnmount();
        }
        ReactReconciler.unmountComponent(this._renderedComponent);
        this._renderedComponent = null;
        this._instance = null;
        this._pendingStateQueue = null;
        this._pendingReplaceState = false;
        this._pendingForceUpdate = false;
        this._pendingCallbacks = null;
        this._pendingElement = null;
        this._context = null;
        this._rootNodeID = null;
        this._topLevelWrapper = null;
        ReactInstanceMap.remove(inst);
      },
      _maskContext: function(context) {
        var maskedContext = null;
        var Component = this._currentElement.type;
        var contextTypes = Component.contextTypes;
        if (!contextTypes) {
          return emptyObject;
        }
        maskedContext = {};
        for (var contextName in contextTypes) {
          maskedContext[contextName] = context[contextName];
        }
        return maskedContext;
      },
      _processContext: function(context) {
        var maskedContext = this._maskContext(context);
        if (process.env.NODE_ENV !== 'production') {
          var Component = this._currentElement.type;
          if (Component.contextTypes) {
            this._checkPropTypes(Component.contextTypes, maskedContext, ReactPropTypeLocations.context);
          }
        }
        return maskedContext;
      },
      _processChildContext: function(currentContext) {
        var Component = this._currentElement.type;
        var inst = this._instance;
        var childContext = inst.getChildContext && inst.getChildContext();
        if (childContext) {
          !(typeof Component.childContextTypes === 'object') ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.getChildContext(): childContextTypes must be defined in order to ' + 'use getChildContext().', this.getName() || 'ReactCompositeComponent') : invariant(false) : undefined;
          if (process.env.NODE_ENV !== 'production') {
            this._checkPropTypes(Component.childContextTypes, childContext, ReactPropTypeLocations.childContext);
          }
          for (var name in childContext) {
            !(name in Component.childContextTypes) ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.getChildContext(): key "%s" is not defined in childContextTypes.', this.getName() || 'ReactCompositeComponent', name) : invariant(false) : undefined;
          }
          return assign({}, currentContext, childContext);
        }
        return currentContext;
      },
      _processProps: function(newProps) {
        if (process.env.NODE_ENV !== 'production') {
          var Component = this._currentElement.type;
          if (Component.propTypes) {
            this._checkPropTypes(Component.propTypes, newProps, ReactPropTypeLocations.prop);
          }
        }
        return newProps;
      },
      _checkPropTypes: function(propTypes, props, location) {
        var componentName = this.getName();
        for (var propName in propTypes) {
          if (propTypes.hasOwnProperty(propName)) {
            var error;
            try {
              !(typeof propTypes[propName] === 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s: %s type `%s` is invalid; it must be a function, usually ' + 'from React.PropTypes.', componentName || 'React class', ReactPropTypeLocationNames[location], propName) : invariant(false) : undefined;
              error = propTypes[propName](props, propName, componentName, location);
            } catch (ex) {
              error = ex;
            }
            if (error instanceof Error) {
              var addendum = getDeclarationErrorAddendum(this);
              if (location === ReactPropTypeLocations.prop) {
                process.env.NODE_ENV !== 'production' ? warning(false, 'Failed Composite propType: %s%s', error.message, addendum) : undefined;
              } else {
                process.env.NODE_ENV !== 'production' ? warning(false, 'Failed Context Types: %s%s', error.message, addendum) : undefined;
              }
            }
          }
        }
      },
      receiveComponent: function(nextElement, transaction, nextContext) {
        var prevElement = this._currentElement;
        var prevContext = this._context;
        this._pendingElement = null;
        this.updateComponent(transaction, prevElement, nextElement, prevContext, nextContext);
      },
      performUpdateIfNecessary: function(transaction) {
        if (this._pendingElement != null) {
          ReactReconciler.receiveComponent(this, this._pendingElement || this._currentElement, transaction, this._context);
        }
        if (this._pendingStateQueue !== null || this._pendingForceUpdate) {
          this.updateComponent(transaction, this._currentElement, this._currentElement, this._context, this._context);
        }
      },
      updateComponent: function(transaction, prevParentElement, nextParentElement, prevUnmaskedContext, nextUnmaskedContext) {
        var inst = this._instance;
        var nextContext = this._context === nextUnmaskedContext ? inst.context : this._processContext(nextUnmaskedContext);
        var nextProps;
        if (prevParentElement === nextParentElement) {
          nextProps = nextParentElement.props;
        } else {
          nextProps = this._processProps(nextParentElement.props);
          if (inst.componentWillReceiveProps) {
            inst.componentWillReceiveProps(nextProps, nextContext);
          }
        }
        var nextState = this._processPendingState(nextProps, nextContext);
        var shouldUpdate = this._pendingForceUpdate || !inst.shouldComponentUpdate || inst.shouldComponentUpdate(nextProps, nextState, nextContext);
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(typeof shouldUpdate !== 'undefined', '%s.shouldComponentUpdate(): Returned undefined instead of a ' + 'boolean value. Make sure to return true or false.', this.getName() || 'ReactCompositeComponent') : undefined;
        }
        if (shouldUpdate) {
          this._pendingForceUpdate = false;
          this._performComponentUpdate(nextParentElement, nextProps, nextState, nextContext, transaction, nextUnmaskedContext);
        } else {
          this._currentElement = nextParentElement;
          this._context = nextUnmaskedContext;
          inst.props = nextProps;
          inst.state = nextState;
          inst.context = nextContext;
        }
      },
      _processPendingState: function(props, context) {
        var inst = this._instance;
        var queue = this._pendingStateQueue;
        var replace = this._pendingReplaceState;
        this._pendingReplaceState = false;
        this._pendingStateQueue = null;
        if (!queue) {
          return inst.state;
        }
        if (replace && queue.length === 1) {
          return queue[0];
        }
        var nextState = assign({}, replace ? queue[0] : inst.state);
        for (var i = replace ? 1 : 0; i < queue.length; i++) {
          var partial = queue[i];
          assign(nextState, typeof partial === 'function' ? partial.call(inst, nextState, props, context) : partial);
        }
        return nextState;
      },
      _performComponentUpdate: function(nextElement, nextProps, nextState, nextContext, transaction, unmaskedContext) {
        var inst = this._instance;
        var hasComponentDidUpdate = Boolean(inst.componentDidUpdate);
        var prevProps;
        var prevState;
        var prevContext;
        if (hasComponentDidUpdate) {
          prevProps = inst.props;
          prevState = inst.state;
          prevContext = inst.context;
        }
        if (inst.componentWillUpdate) {
          inst.componentWillUpdate(nextProps, nextState, nextContext);
        }
        this._currentElement = nextElement;
        this._context = unmaskedContext;
        inst.props = nextProps;
        inst.state = nextState;
        inst.context = nextContext;
        this._updateRenderedComponent(transaction, unmaskedContext);
        if (hasComponentDidUpdate) {
          transaction.getReactMountReady().enqueue(inst.componentDidUpdate.bind(inst, prevProps, prevState, prevContext), inst);
        }
      },
      _updateRenderedComponent: function(transaction, context) {
        var prevComponentInstance = this._renderedComponent;
        var prevRenderedElement = prevComponentInstance._currentElement;
        var nextRenderedElement = this._renderValidatedComponent();
        if (shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {
          ReactReconciler.receiveComponent(prevComponentInstance, nextRenderedElement, transaction, this._processChildContext(context));
        } else {
          var thisID = this._rootNodeID;
          var prevComponentID = prevComponentInstance._rootNodeID;
          ReactReconciler.unmountComponent(prevComponentInstance);
          this._renderedComponent = this._instantiateReactComponent(nextRenderedElement);
          var nextMarkup = ReactReconciler.mountComponent(this._renderedComponent, thisID, transaction, this._processChildContext(context));
          this._replaceNodeWithMarkupByID(prevComponentID, nextMarkup);
        }
      },
      _replaceNodeWithMarkupByID: function(prevComponentID, nextMarkup) {
        ReactComponentEnvironment.replaceNodeWithMarkupByID(prevComponentID, nextMarkup);
      },
      _renderValidatedComponentWithoutOwnerOrContext: function() {
        var inst = this._instance;
        var renderedComponent = inst.render();
        if (process.env.NODE_ENV !== 'production') {
          if (typeof renderedComponent === 'undefined' && inst.render._isMockFunction) {
            renderedComponent = null;
          }
        }
        return renderedComponent;
      },
      _renderValidatedComponent: function() {
        var renderedComponent;
        ReactCurrentOwner.current = this;
        try {
          renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();
        } finally {
          ReactCurrentOwner.current = null;
        }
        !(renderedComponent === null || renderedComponent === false || ReactElement.isValidElement(renderedComponent)) ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.render(): A valid ReactComponent must be returned. You may have ' + 'returned undefined, an array or some other invalid object.', this.getName() || 'ReactCompositeComponent') : invariant(false) : undefined;
        return renderedComponent;
      },
      attachRef: function(ref, component) {
        var inst = this.getPublicInstance();
        !(inst != null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Stateless function components cannot have refs.') : invariant(false) : undefined;
        var publicComponentInstance = component.getPublicInstance();
        if (process.env.NODE_ENV !== 'production') {
          var componentName = component && component.getName ? component.getName() : 'a component';
          process.env.NODE_ENV !== 'production' ? warning(publicComponentInstance != null, 'Stateless function components cannot be given refs ' + '(See ref "%s" in %s created by %s). ' + 'Attempts to access this ref will fail.', ref, componentName, this.getName()) : undefined;
        }
        var refs = inst.refs === emptyObject ? inst.refs = {} : inst.refs;
        refs[ref] = publicComponentInstance;
      },
      detachRef: function(ref) {
        var refs = this.getPublicInstance().refs;
        delete refs[ref];
      },
      getName: function() {
        var type = this._currentElement.type;
        var constructor = this._instance && this._instance.constructor;
        return type.displayName || constructor && constructor.displayName || type.name || constructor && constructor.name || null;
      },
      getPublicInstance: function() {
        var inst = this._instance;
        if (inst instanceof StatelessComponent) {
          return null;
        }
        return inst;
      },
      _instantiateReactComponent: null
    };
    ReactPerf.measureMethods(ReactCompositeComponentMixin, 'ReactCompositeComponent', {
      mountComponent: 'mountComponent',
      updateComponent: 'updateComponent',
      _renderValidatedComponent: '_renderValidatedComponent'
    });
    var ReactCompositeComponent = {Mixin: ReactCompositeComponentMixin};
    module.exports = ReactCompositeComponent;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("67", ["4f", "50", "58", "4b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactElement = req('4f');
  var ReactEmptyComponentRegistry = req('50');
  var ReactReconciler = req('58');
  var assign = req('4b');
  var placeholderElement;
  var ReactEmptyComponentInjection = {injectEmptyComponent: function(component) {
      placeholderElement = ReactElement.createElement(component);
    }};
  var ReactEmptyComponent = function(instantiate) {
    this._currentElement = null;
    this._rootNodeID = null;
    this._renderedComponent = instantiate(placeholderElement);
  };
  assign(ReactEmptyComponent.prototype, {
    construct: function(element) {},
    mountComponent: function(rootID, transaction, context) {
      ReactEmptyComponentRegistry.registerNullComponentID(rootID);
      this._rootNodeID = rootID;
      return ReactReconciler.mountComponent(this._renderedComponent, rootID, transaction, context);
    },
    receiveComponent: function() {},
    unmountComponent: function(rootID, transaction, context) {
      ReactReconciler.unmountComponent(this._renderedComponent);
      ReactEmptyComponentRegistry.deregisterNullComponentID(this._rootNodeID);
      this._rootNodeID = null;
      this._renderedComponent = null;
    }
  });
  ReactEmptyComponent.injection = ReactEmptyComponentInjection;
  module.exports = ReactEmptyComponent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("68", ["4b", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var assign = req('4b');
    var invariant = req('30');
    var autoGenerateWrapperClass = null;
    var genericComponentClass = null;
    var tagToComponentClass = {};
    var textComponentClass = null;
    var ReactNativeComponentInjection = {
      injectGenericComponentClass: function(componentClass) {
        genericComponentClass = componentClass;
      },
      injectTextComponentClass: function(componentClass) {
        textComponentClass = componentClass;
      },
      injectComponentClasses: function(componentClasses) {
        assign(tagToComponentClass, componentClasses);
      }
    };
    function getComponentClassForElement(element) {
      if (typeof element.type === 'function') {
        return element.type;
      }
      var tag = element.type;
      var componentClass = tagToComponentClass[tag];
      if (componentClass == null) {
        tagToComponentClass[tag] = componentClass = autoGenerateWrapperClass(tag);
      }
      return componentClass;
    }
    function createInternalComponent(element) {
      !genericComponentClass ? process.env.NODE_ENV !== 'production' ? invariant(false, 'There is no registered component for the tag %s', element.type) : invariant(false) : undefined;
      return new genericComponentClass(element.type, element.props);
    }
    function createInstanceForText(text) {
      return new textComponentClass(text);
    }
    function isTextComponent(component) {
      return component instanceof textComponentClass;
    }
    var ReactNativeComponent = {
      getComponentClassForElement: getComponentClassForElement,
      createInternalComponent: createInternalComponent,
      createInstanceForText: createInstanceForText,
      isTextComponent: isTextComponent,
      injection: ReactNativeComponentInjection
    };
    module.exports = ReactNativeComponent;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("69", ["66", "67", "68", "4b", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactCompositeComponent = req('66');
    var ReactEmptyComponent = req('67');
    var ReactNativeComponent = req('68');
    var assign = req('4b');
    var invariant = req('30');
    var warning = req('40');
    var ReactCompositeComponentWrapper = function() {};
    assign(ReactCompositeComponentWrapper.prototype, ReactCompositeComponent.Mixin, {_instantiateReactComponent: instantiateReactComponent});
    function getDeclarationErrorAddendum(owner) {
      if (owner) {
        var name = owner.getName();
        if (name) {
          return ' Check the render method of `' + name + '`.';
        }
      }
      return '';
    }
    function isInternalComponentType(type) {
      return typeof type === 'function' && typeof type.prototype !== 'undefined' && typeof type.prototype.mountComponent === 'function' && typeof type.prototype.receiveComponent === 'function';
    }
    function instantiateReactComponent(node) {
      var instance;
      if (node === null || node === false) {
        instance = new ReactEmptyComponent(instantiateReactComponent);
      } else if (typeof node === 'object') {
        var element = node;
        !(element && (typeof element.type === 'function' || typeof element.type === 'string')) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Element type is invalid: expected a string (for built-in components) ' + 'or a class/function (for composite components) but got: %s.%s', element.type == null ? element.type : typeof element.type, getDeclarationErrorAddendum(element._owner)) : invariant(false) : undefined;
        if (typeof element.type === 'string') {
          instance = ReactNativeComponent.createInternalComponent(element);
        } else if (isInternalComponentType(element.type)) {
          instance = new element.type(element);
        } else {
          instance = new ReactCompositeComponentWrapper();
        }
      } else if (typeof node === 'string' || typeof node === 'number') {
        instance = ReactNativeComponent.createInstanceForText(node);
      } else {
        !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Encountered invalid React node of type %s', typeof node) : invariant(false) : undefined;
      }
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(typeof instance.construct === 'function' && typeof instance.mountComponent === 'function' && typeof instance.receiveComponent === 'function' && typeof instance.unmountComponent === 'function', 'Only React Components can be mounted.') : undefined;
      }
      instance.construct(node);
      instance._mountIndex = 0;
      instance._mountImage = null;
      if (process.env.NODE_ENV !== 'production') {
        instance._isOwnerNecessary = false;
        instance._warnedAboutRefsInRender = false;
      }
      if (process.env.NODE_ENV !== 'production') {
        if (Object.preventExtensions) {
          Object.preventExtensions(instance);
        }
      }
      return instance;
    }
    module.exports = instantiateReactComponent;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6a", ["4b", "35", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var assign = req('4b');
    var emptyFunction = req('35');
    var warning = req('40');
    var validateDOMNesting = emptyFunction;
    if (process.env.NODE_ENV !== 'production') {
      var specialTags = ['address', 'applet', 'area', 'article', 'aside', 'base', 'basefont', 'bgsound', 'blockquote', 'body', 'br', 'button', 'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dir', 'div', 'dl', 'dt', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'iframe', 'img', 'input', 'isindex', 'li', 'link', 'listing', 'main', 'marquee', 'menu', 'menuitem', 'meta', 'nav', 'noembed', 'noframes', 'noscript', 'object', 'ol', 'p', 'param', 'plaintext', 'pre', 'script', 'section', 'select', 'source', 'style', 'summary', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul', 'wbr', 'xmp'];
      var inScopeTags = ['applet', 'caption', 'html', 'table', 'td', 'th', 'marquee', 'object', 'template', 'foreignObject', 'desc', 'title'];
      var buttonScopeTags = inScopeTags.concat(['button']);
      var impliedEndTags = ['dd', 'dt', 'li', 'option', 'optgroup', 'p', 'rp', 'rt'];
      var emptyAncestorInfo = {
        parentTag: null,
        formTag: null,
        aTagInScope: null,
        buttonTagInScope: null,
        nobrTagInScope: null,
        pTagInButtonScope: null,
        listItemTagAutoclosing: null,
        dlItemTagAutoclosing: null
      };
      var updatedAncestorInfo = function(oldInfo, tag, instance) {
        var ancestorInfo = assign({}, oldInfo || emptyAncestorInfo);
        var info = {
          tag: tag,
          instance: instance
        };
        if (inScopeTags.indexOf(tag) !== -1) {
          ancestorInfo.aTagInScope = null;
          ancestorInfo.buttonTagInScope = null;
          ancestorInfo.nobrTagInScope = null;
        }
        if (buttonScopeTags.indexOf(tag) !== -1) {
          ancestorInfo.pTagInButtonScope = null;
        }
        if (specialTags.indexOf(tag) !== -1 && tag !== 'address' && tag !== 'div' && tag !== 'p') {
          ancestorInfo.listItemTagAutoclosing = null;
          ancestorInfo.dlItemTagAutoclosing = null;
        }
        ancestorInfo.parentTag = info;
        if (tag === 'form') {
          ancestorInfo.formTag = info;
        }
        if (tag === 'a') {
          ancestorInfo.aTagInScope = info;
        }
        if (tag === 'button') {
          ancestorInfo.buttonTagInScope = info;
        }
        if (tag === 'nobr') {
          ancestorInfo.nobrTagInScope = info;
        }
        if (tag === 'p') {
          ancestorInfo.pTagInButtonScope = info;
        }
        if (tag === 'li') {
          ancestorInfo.listItemTagAutoclosing = info;
        }
        if (tag === 'dd' || tag === 'dt') {
          ancestorInfo.dlItemTagAutoclosing = info;
        }
        return ancestorInfo;
      };
      var isTagValidWithParent = function(tag, parentTag) {
        switch (parentTag) {
          case 'select':
            return tag === 'option' || tag === 'optgroup' || tag === '#text';
          case 'optgroup':
            return tag === 'option' || tag === '#text';
          case 'option':
            return tag === '#text';
          case 'tr':
            return tag === 'th' || tag === 'td' || tag === 'style' || tag === 'script' || tag === 'template';
          case 'tbody':
          case 'thead':
          case 'tfoot':
            return tag === 'tr' || tag === 'style' || tag === 'script' || tag === 'template';
          case 'colgroup':
            return tag === 'col' || tag === 'template';
          case 'table':
            return tag === 'caption' || tag === 'colgroup' || tag === 'tbody' || tag === 'tfoot' || tag === 'thead' || tag === 'style' || tag === 'script' || tag === 'template';
          case 'head':
            return tag === 'base' || tag === 'basefont' || tag === 'bgsound' || tag === 'link' || tag === 'meta' || tag === 'title' || tag === 'noscript' || tag === 'noframes' || tag === 'style' || tag === 'script' || tag === 'template';
          case 'html':
            return tag === 'head' || tag === 'body';
        }
        switch (tag) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            return parentTag !== 'h1' && parentTag !== 'h2' && parentTag !== 'h3' && parentTag !== 'h4' && parentTag !== 'h5' && parentTag !== 'h6';
          case 'rp':
          case 'rt':
            return impliedEndTags.indexOf(parentTag) === -1;
          case 'caption':
          case 'col':
          case 'colgroup':
          case 'frame':
          case 'head':
          case 'tbody':
          case 'td':
          case 'tfoot':
          case 'th':
          case 'thead':
          case 'tr':
            return parentTag == null;
        }
        return true;
      };
      var findInvalidAncestorForTag = function(tag, ancestorInfo) {
        switch (tag) {
          case 'address':
          case 'article':
          case 'aside':
          case 'blockquote':
          case 'center':
          case 'details':
          case 'dialog':
          case 'dir':
          case 'div':
          case 'dl':
          case 'fieldset':
          case 'figcaption':
          case 'figure':
          case 'footer':
          case 'header':
          case 'hgroup':
          case 'main':
          case 'menu':
          case 'nav':
          case 'ol':
          case 'p':
          case 'section':
          case 'summary':
          case 'ul':
          case 'pre':
          case 'listing':
          case 'table':
          case 'hr':
          case 'xmp':
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            return ancestorInfo.pTagInButtonScope;
          case 'form':
            return ancestorInfo.formTag || ancestorInfo.pTagInButtonScope;
          case 'li':
            return ancestorInfo.listItemTagAutoclosing;
          case 'dd':
          case 'dt':
            return ancestorInfo.dlItemTagAutoclosing;
          case 'button':
            return ancestorInfo.buttonTagInScope;
          case 'a':
            return ancestorInfo.aTagInScope;
          case 'nobr':
            return ancestorInfo.nobrTagInScope;
        }
        return null;
      };
      var findOwnerStack = function(instance) {
        if (!instance) {
          return [];
        }
        var stack = [];
        do {
          stack.push(instance);
        } while (instance = instance._currentElement._owner);
        stack.reverse();
        return stack;
      };
      var didWarn = {};
      validateDOMNesting = function(childTag, childInstance, ancestorInfo) {
        ancestorInfo = ancestorInfo || emptyAncestorInfo;
        var parentInfo = ancestorInfo.parentTag;
        var parentTag = parentInfo && parentInfo.tag;
        var invalidParent = isTagValidWithParent(childTag, parentTag) ? null : parentInfo;
        var invalidAncestor = invalidParent ? null : findInvalidAncestorForTag(childTag, ancestorInfo);
        var problematic = invalidParent || invalidAncestor;
        if (problematic) {
          var ancestorTag = problematic.tag;
          var ancestorInstance = problematic.instance;
          var childOwner = childInstance && childInstance._currentElement._owner;
          var ancestorOwner = ancestorInstance && ancestorInstance._currentElement._owner;
          var childOwners = findOwnerStack(childOwner);
          var ancestorOwners = findOwnerStack(ancestorOwner);
          var minStackLen = Math.min(childOwners.length, ancestorOwners.length);
          var i;
          var deepestCommon = -1;
          for (i = 0; i < minStackLen; i++) {
            if (childOwners[i] === ancestorOwners[i]) {
              deepestCommon = i;
            } else {
              break;
            }
          }
          var UNKNOWN = '(unknown)';
          var childOwnerNames = childOwners.slice(deepestCommon + 1).map(function(inst) {
            return inst.getName() || UNKNOWN;
          });
          var ancestorOwnerNames = ancestorOwners.slice(deepestCommon + 1).map(function(inst) {
            return inst.getName() || UNKNOWN;
          });
          var ownerInfo = [].concat(deepestCommon !== -1 ? childOwners[deepestCommon].getName() || UNKNOWN : [], ancestorOwnerNames, ancestorTag, invalidAncestor ? ['...'] : [], childOwnerNames, childTag).join(' > ');
          var warnKey = !!invalidParent + '|' + childTag + '|' + ancestorTag + '|' + ownerInfo;
          if (didWarn[warnKey]) {
            return;
          }
          didWarn[warnKey] = true;
          if (invalidParent) {
            var info = '';
            if (ancestorTag === 'table' && childTag === 'tr') {
              info += ' Add a <tbody> to your code to match the DOM tree generated by ' + 'the browser.';
            }
            process.env.NODE_ENV !== 'production' ? warning(false, 'validateDOMNesting(...): <%s> cannot appear as a child of <%s>. ' + 'See %s.%s', childTag, ancestorTag, ownerInfo, info) : undefined;
          } else {
            process.env.NODE_ENV !== 'production' ? warning(false, 'validateDOMNesting(...): <%s> cannot appear as a descendant of ' + '<%s>. See %s.', childTag, ancestorTag, ownerInfo) : undefined;
          }
        }
      };
      validateDOMNesting.ancestorInfoContextKey = '__validateDOMNesting_ancestorInfo$' + Math.random().toString(36).slice(2);
      validateDOMNesting.updatedAncestorInfo = updatedAncestorInfo;
      validateDOMNesting.isTagValidInContext = function(tag, ancestorInfo) {
        ancestorInfo = ancestorInfo || emptyAncestorInfo;
        var parentInfo = ancestorInfo.parentTag;
        var parentTag = parentInfo && parentInfo.tag;
        return isTagValidWithParent(tag, parentTag) && !findInvalidAncestorForTag(tag, ancestorInfo);
      };
    }
    module.exports = validateDOMNesting;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6b", ["3e", "4d", "2a", "4e", "4f", "50", "52", "53", "55", "39", "58", "5d", "5c", "4b", "5e", "61", "69", "30", "3a", "65", "6a", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var DOMProperty = req('3e');
    var ReactBrowserEventEmitter = req('4d');
    var ReactCurrentOwner = req('2a');
    var ReactDOMFeatureFlags = req('4e');
    var ReactElement = req('4f');
    var ReactEmptyComponentRegistry = req('50');
    var ReactInstanceHandles = req('52');
    var ReactInstanceMap = req('53');
    var ReactMarkupChecksum = req('55');
    var ReactPerf = req('39');
    var ReactReconciler = req('58');
    var ReactUpdateQueue = req('5d');
    var ReactUpdates = req('5c');
    var assign = req('4b');
    var emptyObject = req('5e');
    var containsNode = req('61');
    var instantiateReactComponent = req('69');
    var invariant = req('30');
    var setInnerHTML = req('3a');
    var shouldUpdateReactComponent = req('65');
    var validateDOMNesting = req('6a');
    var warning = req('40');
    var ATTR_NAME = DOMProperty.ID_ATTRIBUTE_NAME;
    var nodeCache = {};
    var ELEMENT_NODE_TYPE = 1;
    var DOC_NODE_TYPE = 9;
    var DOCUMENT_FRAGMENT_NODE_TYPE = 11;
    var ownerDocumentContextKey = '__ReactMount_ownerDocument$' + Math.random().toString(36).slice(2);
    var instancesByReactRootID = {};
    var containersByReactRootID = {};
    if (process.env.NODE_ENV !== 'production') {
      var rootElementsByReactRootID = {};
    }
    var findComponentRootReusableArray = [];
    function firstDifferenceIndex(string1, string2) {
      var minLen = Math.min(string1.length, string2.length);
      for (var i = 0; i < minLen; i++) {
        if (string1.charAt(i) !== string2.charAt(i)) {
          return i;
        }
      }
      return string1.length === string2.length ? -1 : minLen;
    }
    function getReactRootElementInContainer(container) {
      if (!container) {
        return null;
      }
      if (container.nodeType === DOC_NODE_TYPE) {
        return container.documentElement;
      } else {
        return container.firstChild;
      }
    }
    function getReactRootID(container) {
      var rootElement = getReactRootElementInContainer(container);
      return rootElement && ReactMount.getID(rootElement);
    }
    function getID(node) {
      var id = internalGetID(node);
      if (id) {
        if (nodeCache.hasOwnProperty(id)) {
          var cached = nodeCache[id];
          if (cached !== node) {
            !!isValid(cached, id) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactMount: Two valid but unequal nodes with the same `%s`: %s', ATTR_NAME, id) : invariant(false) : undefined;
            nodeCache[id] = node;
          }
        } else {
          nodeCache[id] = node;
        }
      }
      return id;
    }
    function internalGetID(node) {
      return node && node.getAttribute && node.getAttribute(ATTR_NAME) || '';
    }
    function setID(node, id) {
      var oldID = internalGetID(node);
      if (oldID !== id) {
        delete nodeCache[oldID];
      }
      node.setAttribute(ATTR_NAME, id);
      nodeCache[id] = node;
    }
    function getNode(id) {
      if (!nodeCache.hasOwnProperty(id) || !isValid(nodeCache[id], id)) {
        nodeCache[id] = ReactMount.findReactNodeByID(id);
      }
      return nodeCache[id];
    }
    function getNodeFromInstance(instance) {
      var id = ReactInstanceMap.get(instance)._rootNodeID;
      if (ReactEmptyComponentRegistry.isNullComponentID(id)) {
        return null;
      }
      if (!nodeCache.hasOwnProperty(id) || !isValid(nodeCache[id], id)) {
        nodeCache[id] = ReactMount.findReactNodeByID(id);
      }
      return nodeCache[id];
    }
    function isValid(node, id) {
      if (node) {
        !(internalGetID(node) === id) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactMount: Unexpected modification of `%s`', ATTR_NAME) : invariant(false) : undefined;
        var container = ReactMount.findReactContainerForID(id);
        if (container && containsNode(container, node)) {
          return true;
        }
      }
      return false;
    }
    function purgeID(id) {
      delete nodeCache[id];
    }
    var deepestNodeSoFar = null;
    function findDeepestCachedAncestorImpl(ancestorID) {
      var ancestor = nodeCache[ancestorID];
      if (ancestor && isValid(ancestor, ancestorID)) {
        deepestNodeSoFar = ancestor;
      } else {
        return false;
      }
    }
    function findDeepestCachedAncestor(targetID) {
      deepestNodeSoFar = null;
      ReactInstanceHandles.traverseAncestors(targetID, findDeepestCachedAncestorImpl);
      var foundNode = deepestNodeSoFar;
      deepestNodeSoFar = null;
      return foundNode;
    }
    function mountComponentIntoNode(componentInstance, rootID, container, transaction, shouldReuseMarkup, context) {
      if (ReactDOMFeatureFlags.useCreateElement) {
        context = assign({}, context);
        if (container.nodeType === DOC_NODE_TYPE) {
          context[ownerDocumentContextKey] = container;
        } else {
          context[ownerDocumentContextKey] = container.ownerDocument;
        }
      }
      if (process.env.NODE_ENV !== 'production') {
        if (context === emptyObject) {
          context = {};
        }
        var tag = container.nodeName.toLowerCase();
        context[validateDOMNesting.ancestorInfoContextKey] = validateDOMNesting.updatedAncestorInfo(null, tag, null);
      }
      var markup = ReactReconciler.mountComponent(componentInstance, rootID, transaction, context);
      componentInstance._renderedComponent._topLevelWrapper = componentInstance;
      ReactMount._mountImageIntoNode(markup, container, shouldReuseMarkup, transaction);
    }
    function batchedMountComponentIntoNode(componentInstance, rootID, container, shouldReuseMarkup, context) {
      var transaction = ReactUpdates.ReactReconcileTransaction.getPooled(shouldReuseMarkup);
      transaction.perform(mountComponentIntoNode, null, componentInstance, rootID, container, transaction, shouldReuseMarkup, context);
      ReactUpdates.ReactReconcileTransaction.release(transaction);
    }
    function unmountComponentFromNode(instance, container) {
      ReactReconciler.unmountComponent(instance);
      if (container.nodeType === DOC_NODE_TYPE) {
        container = container.documentElement;
      }
      while (container.lastChild) {
        container.removeChild(container.lastChild);
      }
    }
    function hasNonRootReactChild(node) {
      var reactRootID = getReactRootID(node);
      return reactRootID ? reactRootID !== ReactInstanceHandles.getReactRootIDFromNodeID(reactRootID) : false;
    }
    function findFirstReactDOMImpl(node) {
      for (; node && node.parentNode !== node; node = node.parentNode) {
        if (node.nodeType !== 1) {
          continue;
        }
        var nodeID = internalGetID(node);
        if (!nodeID) {
          continue;
        }
        var reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(nodeID);
        var current = node;
        var lastID;
        do {
          lastID = internalGetID(current);
          current = current.parentNode;
          if (current == null) {
            return null;
          }
        } while (lastID !== reactRootID);
        if (current === containersByReactRootID[reactRootID]) {
          return node;
        }
      }
      return null;
    }
    var TopLevelWrapper = function() {};
    TopLevelWrapper.prototype.isReactComponent = {};
    if (process.env.NODE_ENV !== 'production') {
      TopLevelWrapper.displayName = 'TopLevelWrapper';
    }
    TopLevelWrapper.prototype.render = function() {
      return this.props;
    };
    var ReactMount = {
      TopLevelWrapper: TopLevelWrapper,
      _instancesByReactRootID: instancesByReactRootID,
      scrollMonitor: function(container, renderCallback) {
        renderCallback();
      },
      _updateRootComponent: function(prevComponent, nextElement, container, callback) {
        ReactMount.scrollMonitor(container, function() {
          ReactUpdateQueue.enqueueElementInternal(prevComponent, nextElement);
          if (callback) {
            ReactUpdateQueue.enqueueCallbackInternal(prevComponent, callback);
          }
        });
        if (process.env.NODE_ENV !== 'production') {
          rootElementsByReactRootID[getReactRootID(container)] = getReactRootElementInContainer(container);
        }
        return prevComponent;
      },
      _registerComponent: function(nextComponent, container) {
        !(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE || container.nodeType === DOCUMENT_FRAGMENT_NODE_TYPE)) ? process.env.NODE_ENV !== 'production' ? invariant(false, '_registerComponent(...): Target container is not a DOM element.') : invariant(false) : undefined;
        ReactBrowserEventEmitter.ensureScrollValueMonitoring();
        var reactRootID = ReactMount.registerContainer(container);
        instancesByReactRootID[reactRootID] = nextComponent;
        return reactRootID;
      },
      _renderNewRootComponent: function(nextElement, container, shouldReuseMarkup, context) {
        process.env.NODE_ENV !== 'production' ? warning(ReactCurrentOwner.current == null, '_renderNewRootComponent(): Render methods should be a pure function ' + 'of props and state; triggering nested component updates from ' + 'render is not allowed. If necessary, trigger nested updates in ' + 'componentDidUpdate. Check the render method of %s.', ReactCurrentOwner.current && ReactCurrentOwner.current.getName() || 'ReactCompositeComponent') : undefined;
        var componentInstance = instantiateReactComponent(nextElement, null);
        var reactRootID = ReactMount._registerComponent(componentInstance, container);
        ReactUpdates.batchedUpdates(batchedMountComponentIntoNode, componentInstance, reactRootID, container, shouldReuseMarkup, context);
        if (process.env.NODE_ENV !== 'production') {
          rootElementsByReactRootID[reactRootID] = getReactRootElementInContainer(container);
        }
        return componentInstance;
      },
      renderSubtreeIntoContainer: function(parentComponent, nextElement, container, callback) {
        !(parentComponent != null && parentComponent._reactInternalInstance != null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'parentComponent must be a valid React Component') : invariant(false) : undefined;
        return ReactMount._renderSubtreeIntoContainer(parentComponent, nextElement, container, callback);
      },
      _renderSubtreeIntoContainer: function(parentComponent, nextElement, container, callback) {
        !ReactElement.isValidElement(nextElement) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactDOM.render(): Invalid component element.%s', typeof nextElement === 'string' ? ' Instead of passing an element string, make sure to instantiate ' + 'it by passing it to React.createElement.' : typeof nextElement === 'function' ? ' Instead of passing a component class, make sure to instantiate ' + 'it by passing it to React.createElement.' : nextElement != null && nextElement.props !== undefined ? ' This may be caused by unintentionally loading two independent ' + 'copies of React.' : '') : invariant(false) : undefined;
        process.env.NODE_ENV !== 'production' ? warning(!container || !container.tagName || container.tagName.toUpperCase() !== 'BODY', 'render(): Rendering components directly into document.body is ' + 'discouraged, since its children are often manipulated by third-party ' + 'scripts and browser extensions. This may lead to subtle ' + 'reconciliation issues. Try rendering into a container element created ' + 'for your app.') : undefined;
        var nextWrappedElement = new ReactElement(TopLevelWrapper, null, null, null, null, null, nextElement);
        var prevComponent = instancesByReactRootID[getReactRootID(container)];
        if (prevComponent) {
          var prevWrappedElement = prevComponent._currentElement;
          var prevElement = prevWrappedElement.props;
          if (shouldUpdateReactComponent(prevElement, nextElement)) {
            return ReactMount._updateRootComponent(prevComponent, nextWrappedElement, container, callback)._renderedComponent.getPublicInstance();
          } else {
            ReactMount.unmountComponentAtNode(container);
          }
        }
        var reactRootElement = getReactRootElementInContainer(container);
        var containerHasReactMarkup = reactRootElement && !!internalGetID(reactRootElement);
        var containerHasNonRootReactChild = hasNonRootReactChild(container);
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(!containerHasNonRootReactChild, 'render(...): Replacing React-rendered children with a new root ' + 'component. If you intended to update the children of this node, ' + 'you should instead have the existing children update their state ' + 'and render the new components instead of calling ReactDOM.render.') : undefined;
          if (!containerHasReactMarkup || reactRootElement.nextSibling) {
            var rootElementSibling = reactRootElement;
            while (rootElementSibling) {
              if (internalGetID(rootElementSibling)) {
                process.env.NODE_ENV !== 'production' ? warning(false, 'render(): Target node has markup rendered by React, but there ' + 'are unrelated nodes as well. This is most commonly caused by ' + 'white-space inserted around server-rendered markup.') : undefined;
                break;
              }
              rootElementSibling = rootElementSibling.nextSibling;
            }
          }
        }
        var shouldReuseMarkup = containerHasReactMarkup && !prevComponent && !containerHasNonRootReactChild;
        var component = ReactMount._renderNewRootComponent(nextWrappedElement, container, shouldReuseMarkup, parentComponent != null ? parentComponent._reactInternalInstance._processChildContext(parentComponent._reactInternalInstance._context) : emptyObject)._renderedComponent.getPublicInstance();
        if (callback) {
          callback.call(component);
        }
        return component;
      },
      render: function(nextElement, container, callback) {
        return ReactMount._renderSubtreeIntoContainer(null, nextElement, container, callback);
      },
      registerContainer: function(container) {
        var reactRootID = getReactRootID(container);
        if (reactRootID) {
          reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(reactRootID);
        }
        if (!reactRootID) {
          reactRootID = ReactInstanceHandles.createReactRootID();
        }
        containersByReactRootID[reactRootID] = container;
        return reactRootID;
      },
      unmountComponentAtNode: function(container) {
        process.env.NODE_ENV !== 'production' ? warning(ReactCurrentOwner.current == null, 'unmountComponentAtNode(): Render methods should be a pure function ' + 'of props and state; triggering nested component updates from render ' + 'is not allowed. If necessary, trigger nested updates in ' + 'componentDidUpdate. Check the render method of %s.', ReactCurrentOwner.current && ReactCurrentOwner.current.getName() || 'ReactCompositeComponent') : undefined;
        !(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE || container.nodeType === DOCUMENT_FRAGMENT_NODE_TYPE)) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'unmountComponentAtNode(...): Target container is not a DOM element.') : invariant(false) : undefined;
        var reactRootID = getReactRootID(container);
        var component = instancesByReactRootID[reactRootID];
        if (!component) {
          var containerHasNonRootReactChild = hasNonRootReactChild(container);
          var containerID = internalGetID(container);
          var isContainerReactRoot = containerID && containerID === ReactInstanceHandles.getReactRootIDFromNodeID(containerID);
          if (process.env.NODE_ENV !== 'production') {
            process.env.NODE_ENV !== 'production' ? warning(!containerHasNonRootReactChild, 'unmountComponentAtNode(): The node you\'re attempting to unmount ' + 'was rendered by React and is not a top-level container. %s', isContainerReactRoot ? 'You may have accidentally passed in a React root node instead ' + 'of its container.' : 'Instead, have the parent component update its state and ' + 'rerender in order to remove this component.') : undefined;
          }
          return false;
        }
        ReactUpdates.batchedUpdates(unmountComponentFromNode, component, container);
        delete instancesByReactRootID[reactRootID];
        delete containersByReactRootID[reactRootID];
        if (process.env.NODE_ENV !== 'production') {
          delete rootElementsByReactRootID[reactRootID];
        }
        return true;
      },
      findReactContainerForID: function(id) {
        var reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(id);
        var container = containersByReactRootID[reactRootID];
        if (process.env.NODE_ENV !== 'production') {
          var rootElement = rootElementsByReactRootID[reactRootID];
          if (rootElement && rootElement.parentNode !== container) {
            process.env.NODE_ENV !== 'production' ? warning(internalGetID(rootElement) === reactRootID, 'ReactMount: Root element ID differed from reactRootID.') : undefined;
            var containerChild = container.firstChild;
            if (containerChild && reactRootID === internalGetID(containerChild)) {
              rootElementsByReactRootID[reactRootID] = containerChild;
            } else {
              process.env.NODE_ENV !== 'production' ? warning(false, 'ReactMount: Root element has been removed from its original ' + 'container. New container: %s', rootElement.parentNode) : undefined;
            }
          }
        }
        return container;
      },
      findReactNodeByID: function(id) {
        var reactRoot = ReactMount.findReactContainerForID(id);
        return ReactMount.findComponentRoot(reactRoot, id);
      },
      getFirstReactDOM: function(node) {
        return findFirstReactDOMImpl(node);
      },
      findComponentRoot: function(ancestorNode, targetID) {
        var firstChildren = findComponentRootReusableArray;
        var childIndex = 0;
        var deepestAncestor = findDeepestCachedAncestor(targetID) || ancestorNode;
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(deepestAncestor != null, 'React can\'t find the root component node for data-reactid value ' + '`%s`. If you\'re seeing this message, it probably means that ' + 'you\'ve loaded two copies of React on the page. At this time, only ' + 'a single copy of React can be loaded at a time.', targetID) : undefined;
        }
        firstChildren[0] = deepestAncestor.firstChild;
        firstChildren.length = 1;
        while (childIndex < firstChildren.length) {
          var child = firstChildren[childIndex++];
          var targetChild;
          while (child) {
            var childID = ReactMount.getID(child);
            if (childID) {
              if (targetID === childID) {
                targetChild = child;
              } else if (ReactInstanceHandles.isAncestorIDOf(childID, targetID)) {
                firstChildren.length = childIndex = 0;
                firstChildren.push(child.firstChild);
              }
            } else {
              firstChildren.push(child.firstChild);
            }
            child = child.nextSibling;
          }
          if (targetChild) {
            firstChildren.length = 0;
            return targetChild;
          }
        }
        firstChildren.length = 0;
        !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'findComponentRoot(..., %s): Unable to find element. This probably ' + 'means the DOM was unexpectedly mutated (e.g., by the browser), ' + 'usually due to forgetting a <tbody> when using tables, nesting tags ' + 'like <form>, <p>, or <a>, or using non-SVG elements in an <svg> ' + 'parent. ' + 'Try inspecting the child nodes of the element with React ID `%s`.', targetID, ReactMount.getID(ancestorNode)) : invariant(false) : undefined;
      },
      _mountImageIntoNode: function(markup, container, shouldReuseMarkup, transaction) {
        !(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE || container.nodeType === DOCUMENT_FRAGMENT_NODE_TYPE)) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'mountComponentIntoNode(...): Target container is not valid.') : invariant(false) : undefined;
        if (shouldReuseMarkup) {
          var rootElement = getReactRootElementInContainer(container);
          if (ReactMarkupChecksum.canReuseMarkup(markup, rootElement)) {
            return;
          } else {
            var checksum = rootElement.getAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME);
            rootElement.removeAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME);
            var rootMarkup = rootElement.outerHTML;
            rootElement.setAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME, checksum);
            var normalizedMarkup = markup;
            if (process.env.NODE_ENV !== 'production') {
              var normalizer;
              if (container.nodeType === ELEMENT_NODE_TYPE) {
                normalizer = document.createElement('div');
                normalizer.innerHTML = markup;
                normalizedMarkup = normalizer.innerHTML;
              } else {
                normalizer = document.createElement('iframe');
                document.body.appendChild(normalizer);
                normalizer.contentDocument.write(markup);
                normalizedMarkup = normalizer.contentDocument.documentElement.outerHTML;
                document.body.removeChild(normalizer);
              }
            }
            var diffIndex = firstDifferenceIndex(normalizedMarkup, rootMarkup);
            var difference = ' (client) ' + normalizedMarkup.substring(diffIndex - 20, diffIndex + 20) + '\n (server) ' + rootMarkup.substring(diffIndex - 20, diffIndex + 20);
            !(container.nodeType !== DOC_NODE_TYPE) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'You\'re trying to render a component to the document using ' + 'server rendering but the checksum was invalid. This usually ' + 'means you rendered a different component type or props on ' + 'the client from the one on the server, or your render() ' + 'methods are impure. React cannot handle this case due to ' + 'cross-browser quirks by rendering at the document root. You ' + 'should look for environment dependent code in your components ' + 'and ensure the props are the same client and server side:\n%s', difference) : invariant(false) : undefined;
            if (process.env.NODE_ENV !== 'production') {
              process.env.NODE_ENV !== 'production' ? warning(false, 'React attempted to reuse markup in a container but the ' + 'checksum was invalid. This generally means that you are ' + 'using server rendering and the markup generated on the ' + 'server was not what the client was expecting. React injected ' + 'new markup to compensate which works but you have lost many ' + 'of the benefits of server rendering. Instead, figure out ' + 'why the markup being generated is different on the client ' + 'or server:\n%s', difference) : undefined;
            }
          }
        }
        !(container.nodeType !== DOC_NODE_TYPE) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'You\'re trying to render a component to the document but ' + 'you didn\'t use server rendering. We can\'t do this ' + 'without using server rendering due to cross-browser quirks. ' + 'See ReactDOMServer.renderToString() for server rendering.') : invariant(false) : undefined;
        if (transaction.useCreateElement) {
          while (container.lastChild) {
            container.removeChild(container.lastChild);
          }
          container.appendChild(markup);
        } else {
          setInnerHTML(container, markup);
        }
      },
      ownerDocumentContextKey: ownerDocumentContextKey,
      getReactRootID: getReactRootID,
      getID: getID,
      setID: setID,
      getNode: getNode,
      getNodeFromInstance: getNodeFromInstance,
      isValid: isValid,
      purgeID: purgeID
    };
    ReactPerf.measureMethods(ReactMount, 'ReactMount', {
      _renderNewRootComponent: '_renderNewRootComponent',
      _mountImageIntoNode: '_mountImageIntoNode'
    });
    module.exports = ReactMount;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6c", ["3d", "41", "6b", "39", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var DOMChildrenOperations = req('3d');
    var DOMPropertyOperations = req('41');
    var ReactMount = req('6b');
    var ReactPerf = req('39');
    var invariant = req('30');
    var INVALID_PROPERTY_ERRORS = {
      dangerouslySetInnerHTML: '`dangerouslySetInnerHTML` must be set using `updateInnerHTMLByID()`.',
      style: '`style` must be set using `updateStylesByID()`.'
    };
    var ReactDOMIDOperations = {
      updatePropertyByID: function(id, name, value) {
        var node = ReactMount.getNode(id);
        !!INVALID_PROPERTY_ERRORS.hasOwnProperty(name) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'updatePropertyByID(...): %s', INVALID_PROPERTY_ERRORS[name]) : invariant(false) : undefined;
        if (value != null) {
          DOMPropertyOperations.setValueForProperty(node, name, value);
        } else {
          DOMPropertyOperations.deleteValueForProperty(node, name);
        }
      },
      dangerouslyReplaceNodeWithMarkupByID: function(id, markup) {
        var node = ReactMount.getNode(id);
        DOMChildrenOperations.dangerouslyReplaceNodeWithMarkup(node, markup);
      },
      dangerouslyProcessChildrenUpdates: function(updates, markup) {
        for (var i = 0; i < updates.length; i++) {
          updates[i].parentNode = ReactMount.getNode(updates[i].parentID);
        }
        DOMChildrenOperations.processUpdates(updates, markup);
      }
    };
    ReactPerf.measureMethods(ReactDOMIDOperations, 'ReactDOMIDOperations', {
      dangerouslyReplaceNodeWithMarkupByID: 'dangerouslyReplaceNodeWithMarkupByID',
      dangerouslyProcessChildrenUpdates: 'dangerouslyProcessChildrenUpdates'
    });
    module.exports = ReactDOMIDOperations;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6d", ["6c", "6b", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactDOMIDOperations = req('6c');
    var ReactMount = req('6b');
    var ReactComponentBrowserEnvironment = {
      processChildrenUpdates: ReactDOMIDOperations.dangerouslyProcessChildrenUpdates,
      replaceNodeWithMarkupByID: ReactDOMIDOperations.dangerouslyReplaceNodeWithMarkupByID,
      unmountIDFromEnvironment: function(rootNodeID) {
        ReactMount.purgeID(rootNodeID);
      }
    };
    module.exports = ReactComponentBrowserEnvironment;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6e", ["3d", "41", "6d", "6b", "4b", "3b", "3c", "6a", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var DOMChildrenOperations = req('3d');
    var DOMPropertyOperations = req('41');
    var ReactComponentBrowserEnvironment = req('6d');
    var ReactMount = req('6b');
    var assign = req('4b');
    var escapeTextContentForBrowser = req('3b');
    var setTextContent = req('3c');
    var validateDOMNesting = req('6a');
    var ReactDOMTextComponent = function(props) {};
    assign(ReactDOMTextComponent.prototype, {
      construct: function(text) {
        this._currentElement = text;
        this._stringText = '' + text;
        this._rootNodeID = null;
        this._mountIndex = 0;
      },
      mountComponent: function(rootID, transaction, context) {
        if (process.env.NODE_ENV !== 'production') {
          if (context[validateDOMNesting.ancestorInfoContextKey]) {
            validateDOMNesting('span', null, context[validateDOMNesting.ancestorInfoContextKey]);
          }
        }
        this._rootNodeID = rootID;
        if (transaction.useCreateElement) {
          var ownerDocument = context[ReactMount.ownerDocumentContextKey];
          var el = ownerDocument.createElement('span');
          DOMPropertyOperations.setAttributeForID(el, rootID);
          ReactMount.getID(el);
          setTextContent(el, this._stringText);
          return el;
        } else {
          var escapedText = escapeTextContentForBrowser(this._stringText);
          if (transaction.renderToStaticMarkup) {
            return escapedText;
          }
          return '<span ' + DOMPropertyOperations.createMarkupForID(rootID) + '>' + escapedText + '</span>';
        }
      },
      receiveComponent: function(nextText, transaction) {
        if (nextText !== this._currentElement) {
          this._currentElement = nextText;
          var nextStringText = '' + nextText;
          if (nextStringText !== this._stringText) {
            this._stringText = nextStringText;
            var node = ReactMount.getNode(this._rootNodeID);
            DOMChildrenOperations.updateTextContent(node, nextStringText);
          }
        }
      },
      unmountComponent: function() {
        ReactComponentBrowserEnvironment.unmountIDFromEnvironment(this._rootNodeID);
      }
    });
    module.exports = ReactDOMTextComponent;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6f", ["42", "48", "40", "46", "47", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var EventConstants = req('42');
    var EventPluginHub = req('48');
    var warning = req('40');
    var accumulateInto = req('46');
    var forEachAccumulated = req('47');
    var PropagationPhases = EventConstants.PropagationPhases;
    var getListener = EventPluginHub.getListener;
    function listenerAtPhase(id, event, propagationPhase) {
      var registrationName = event.dispatchConfig.phasedRegistrationNames[propagationPhase];
      return getListener(id, registrationName);
    }
    function accumulateDirectionalDispatches(domID, upwards, event) {
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(domID, 'Dispatching id must not be null') : undefined;
      }
      var phase = upwards ? PropagationPhases.bubbled : PropagationPhases.captured;
      var listener = listenerAtPhase(domID, event, phase);
      if (listener) {
        event._dispatchListeners = accumulateInto(event._dispatchListeners, listener);
        event._dispatchIDs = accumulateInto(event._dispatchIDs, domID);
      }
    }
    function accumulateTwoPhaseDispatchesSingle(event) {
      if (event && event.dispatchConfig.phasedRegistrationNames) {
        EventPluginHub.injection.getInstanceHandle().traverseTwoPhase(event.dispatchMarker, accumulateDirectionalDispatches, event);
      }
    }
    function accumulateTwoPhaseDispatchesSingleSkipTarget(event) {
      if (event && event.dispatchConfig.phasedRegistrationNames) {
        EventPluginHub.injection.getInstanceHandle().traverseTwoPhaseSkipTarget(event.dispatchMarker, accumulateDirectionalDispatches, event);
      }
    }
    function accumulateDispatches(id, ignoredDirection, event) {
      if (event && event.dispatchConfig.registrationName) {
        var registrationName = event.dispatchConfig.registrationName;
        var listener = getListener(id, registrationName);
        if (listener) {
          event._dispatchListeners = accumulateInto(event._dispatchListeners, listener);
          event._dispatchIDs = accumulateInto(event._dispatchIDs, id);
        }
      }
    }
    function accumulateDirectDispatchesSingle(event) {
      if (event && event.dispatchConfig.registrationName) {
        accumulateDispatches(event.dispatchMarker, null, event);
      }
    }
    function accumulateTwoPhaseDispatches(events) {
      forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle);
    }
    function accumulateTwoPhaseDispatchesSkipTarget(events) {
      forEachAccumulated(events, accumulateTwoPhaseDispatchesSingleSkipTarget);
    }
    function accumulateEnterLeaveDispatches(leave, enter, fromID, toID) {
      EventPluginHub.injection.getInstanceHandle().traverseEnterLeave(fromID, toID, accumulateDispatches, leave, enter);
    }
    function accumulateDirectDispatches(events) {
      forEachAccumulated(events, accumulateDirectDispatchesSingle);
    }
    var EventPropagators = {
      accumulateTwoPhaseDispatches: accumulateTwoPhaseDispatches,
      accumulateTwoPhaseDispatchesSkipTarget: accumulateTwoPhaseDispatchesSkipTarget,
      accumulateDirectDispatches: accumulateDirectDispatches,
      accumulateEnterLeaveDispatches: accumulateEnterLeaveDispatches
    };
    module.exports = EventPropagators;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("70", ["2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ExecutionEnvironment = req('2b');
  var contentKey = null;
  function getTextContentAccessor() {
    if (!contentKey && ExecutionEnvironment.canUseDOM) {
      contentKey = 'textContent' in document.documentElement ? 'textContent' : 'innerText';
    }
    return contentKey;
  }
  module.exports = getTextContentAccessor;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("71", ["59", "4b", "70"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var PooledClass = req('59');
  var assign = req('4b');
  var getTextContentAccessor = req('70');
  function FallbackCompositionState(root) {
    this._root = root;
    this._startText = this.getText();
    this._fallbackText = null;
  }
  assign(FallbackCompositionState.prototype, {
    destructor: function() {
      this._root = null;
      this._startText = null;
      this._fallbackText = null;
    },
    getText: function() {
      if ('value' in this._root) {
        return this._root.value;
      }
      return this._root[getTextContentAccessor()];
    },
    getData: function() {
      if (this._fallbackText) {
        return this._fallbackText;
      }
      var start;
      var startValue = this._startText;
      var startLength = startValue.length;
      var end;
      var endValue = this.getText();
      var endLength = endValue.length;
      for (start = 0; start < startLength; start++) {
        if (startValue[start] !== endValue[start]) {
          break;
        }
      }
      var minEnd = startLength - start;
      for (end = 1; end <= minEnd; end++) {
        if (startValue[startLength - end] !== endValue[endLength - end]) {
          break;
        }
      }
      var sliceTail = end > 1 ? 1 - end : undefined;
      this._fallbackText = endValue.slice(start, sliceTail);
      return this._fallbackText;
    }
  });
  PooledClass.addPoolingTo(FallbackCompositionState);
  module.exports = FallbackCompositionState;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("72", ["59", "4b", "35", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var PooledClass = req('59');
    var assign = req('4b');
    var emptyFunction = req('35');
    var warning = req('40');
    var EventInterface = {
      type: null,
      currentTarget: emptyFunction.thatReturnsNull,
      eventPhase: null,
      bubbles: null,
      cancelable: null,
      timeStamp: function(event) {
        return event.timeStamp || Date.now();
      },
      defaultPrevented: null,
      isTrusted: null
    };
    function SyntheticEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
      this.dispatchConfig = dispatchConfig;
      this.dispatchMarker = dispatchMarker;
      this.nativeEvent = nativeEvent;
      this.target = nativeEventTarget;
      this.currentTarget = nativeEventTarget;
      var Interface = this.constructor.Interface;
      for (var propName in Interface) {
        if (!Interface.hasOwnProperty(propName)) {
          continue;
        }
        var normalize = Interface[propName];
        if (normalize) {
          this[propName] = normalize(nativeEvent);
        } else {
          this[propName] = nativeEvent[propName];
        }
      }
      var defaultPrevented = nativeEvent.defaultPrevented != null ? nativeEvent.defaultPrevented : nativeEvent.returnValue === false;
      if (defaultPrevented) {
        this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
      } else {
        this.isDefaultPrevented = emptyFunction.thatReturnsFalse;
      }
      this.isPropagationStopped = emptyFunction.thatReturnsFalse;
    }
    assign(SyntheticEvent.prototype, {
      preventDefault: function() {
        this.defaultPrevented = true;
        var event = this.nativeEvent;
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(event, 'This synthetic event is reused for performance reasons. If you\'re ' + 'seeing this, you\'re calling `preventDefault` on a ' + 'released/nullified synthetic event. This is a no-op. See ' + 'https://fb.me/react-event-pooling for more information.') : undefined;
        }
        if (!event) {
          return;
        }
        if (event.preventDefault) {
          event.preventDefault();
        } else {
          event.returnValue = false;
        }
        this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
      },
      stopPropagation: function() {
        var event = this.nativeEvent;
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(event, 'This synthetic event is reused for performance reasons. If you\'re ' + 'seeing this, you\'re calling `stopPropagation` on a ' + 'released/nullified synthetic event. This is a no-op. See ' + 'https://fb.me/react-event-pooling for more information.') : undefined;
        }
        if (!event) {
          return;
        }
        if (event.stopPropagation) {
          event.stopPropagation();
        } else {
          event.cancelBubble = true;
        }
        this.isPropagationStopped = emptyFunction.thatReturnsTrue;
      },
      persist: function() {
        this.isPersistent = emptyFunction.thatReturnsTrue;
      },
      isPersistent: emptyFunction.thatReturnsFalse,
      destructor: function() {
        var Interface = this.constructor.Interface;
        for (var propName in Interface) {
          this[propName] = null;
        }
        this.dispatchConfig = null;
        this.dispatchMarker = null;
        this.nativeEvent = null;
      }
    });
    SyntheticEvent.Interface = EventInterface;
    SyntheticEvent.augmentClass = function(Class, Interface) {
      var Super = this;
      var prototype = Object.create(Super.prototype);
      assign(prototype, Class.prototype);
      Class.prototype = prototype;
      Class.prototype.constructor = Class;
      Class.Interface = assign({}, Super.Interface, Interface);
      Class.augmentClass = Super.augmentClass;
      PooledClass.addPoolingTo(Class, PooledClass.fourArgumentPooler);
    };
    PooledClass.addPoolingTo(SyntheticEvent, PooledClass.fourArgumentPooler);
    module.exports = SyntheticEvent;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("73", ["72"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticEvent = req('72');
  var CompositionEventInterface = {data: null};
  function SyntheticCompositionEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticEvent.augmentClass(SyntheticCompositionEvent, CompositionEventInterface);
  module.exports = SyntheticCompositionEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("74", ["72"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticEvent = req('72');
  var InputEventInterface = {data: null};
  function SyntheticInputEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticEvent.augmentClass(SyntheticInputEvent, InputEventInterface);
  module.exports = SyntheticInputEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("75", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var keyOf = function(oneKeyObj) {
    var key;
    for (key in oneKeyObj) {
      if (!oneKeyObj.hasOwnProperty(key)) {
        continue;
      }
      return key;
    }
    return null;
  };
  module.exports = keyOf;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("76", ["42", "6f", "2b", "71", "73", "74", "75"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var EventConstants = req('42');
  var EventPropagators = req('6f');
  var ExecutionEnvironment = req('2b');
  var FallbackCompositionState = req('71');
  var SyntheticCompositionEvent = req('73');
  var SyntheticInputEvent = req('74');
  var keyOf = req('75');
  var END_KEYCODES = [9, 13, 27, 32];
  var START_KEYCODE = 229;
  var canUseCompositionEvent = ExecutionEnvironment.canUseDOM && 'CompositionEvent' in window;
  var documentMode = null;
  if (ExecutionEnvironment.canUseDOM && 'documentMode' in document) {
    documentMode = document.documentMode;
  }
  var canUseTextInputEvent = ExecutionEnvironment.canUseDOM && 'TextEvent' in window && !documentMode && !isPresto();
  var useFallbackCompositionData = ExecutionEnvironment.canUseDOM && (!canUseCompositionEvent || documentMode && documentMode > 8 && documentMode <= 11);
  function isPresto() {
    var opera = window.opera;
    return typeof opera === 'object' && typeof opera.version === 'function' && parseInt(opera.version(), 10) <= 12;
  }
  var SPACEBAR_CODE = 32;
  var SPACEBAR_CHAR = String.fromCharCode(SPACEBAR_CODE);
  var topLevelTypes = EventConstants.topLevelTypes;
  var eventTypes = {
    beforeInput: {
      phasedRegistrationNames: {
        bubbled: keyOf({onBeforeInput: null}),
        captured: keyOf({onBeforeInputCapture: null})
      },
      dependencies: [topLevelTypes.topCompositionEnd, topLevelTypes.topKeyPress, topLevelTypes.topTextInput, topLevelTypes.topPaste]
    },
    compositionEnd: {
      phasedRegistrationNames: {
        bubbled: keyOf({onCompositionEnd: null}),
        captured: keyOf({onCompositionEndCapture: null})
      },
      dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionEnd, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]
    },
    compositionStart: {
      phasedRegistrationNames: {
        bubbled: keyOf({onCompositionStart: null}),
        captured: keyOf({onCompositionStartCapture: null})
      },
      dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionStart, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]
    },
    compositionUpdate: {
      phasedRegistrationNames: {
        bubbled: keyOf({onCompositionUpdate: null}),
        captured: keyOf({onCompositionUpdateCapture: null})
      },
      dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionUpdate, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]
    }
  };
  var hasSpaceKeypress = false;
  function isKeypressCommand(nativeEvent) {
    return (nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) && !(nativeEvent.ctrlKey && nativeEvent.altKey);
  }
  function getCompositionEventType(topLevelType) {
    switch (topLevelType) {
      case topLevelTypes.topCompositionStart:
        return eventTypes.compositionStart;
      case topLevelTypes.topCompositionEnd:
        return eventTypes.compositionEnd;
      case topLevelTypes.topCompositionUpdate:
        return eventTypes.compositionUpdate;
    }
  }
  function isFallbackCompositionStart(topLevelType, nativeEvent) {
    return topLevelType === topLevelTypes.topKeyDown && nativeEvent.keyCode === START_KEYCODE;
  }
  function isFallbackCompositionEnd(topLevelType, nativeEvent) {
    switch (topLevelType) {
      case topLevelTypes.topKeyUp:
        return END_KEYCODES.indexOf(nativeEvent.keyCode) !== -1;
      case topLevelTypes.topKeyDown:
        return nativeEvent.keyCode !== START_KEYCODE;
      case topLevelTypes.topKeyPress:
      case topLevelTypes.topMouseDown:
      case topLevelTypes.topBlur:
        return true;
      default:
        return false;
    }
  }
  function getDataFromCustomEvent(nativeEvent) {
    var detail = nativeEvent.detail;
    if (typeof detail === 'object' && 'data' in detail) {
      return detail.data;
    }
    return null;
  }
  var currentComposition = null;
  function extractCompositionEvent(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
    var eventType;
    var fallbackData;
    if (canUseCompositionEvent) {
      eventType = getCompositionEventType(topLevelType);
    } else if (!currentComposition) {
      if (isFallbackCompositionStart(topLevelType, nativeEvent)) {
        eventType = eventTypes.compositionStart;
      }
    } else if (isFallbackCompositionEnd(topLevelType, nativeEvent)) {
      eventType = eventTypes.compositionEnd;
    }
    if (!eventType) {
      return null;
    }
    if (useFallbackCompositionData) {
      if (!currentComposition && eventType === eventTypes.compositionStart) {
        currentComposition = FallbackCompositionState.getPooled(topLevelTarget);
      } else if (eventType === eventTypes.compositionEnd) {
        if (currentComposition) {
          fallbackData = currentComposition.getData();
        }
      }
    }
    var event = SyntheticCompositionEvent.getPooled(eventType, topLevelTargetID, nativeEvent, nativeEventTarget);
    if (fallbackData) {
      event.data = fallbackData;
    } else {
      var customData = getDataFromCustomEvent(nativeEvent);
      if (customData !== null) {
        event.data = customData;
      }
    }
    EventPropagators.accumulateTwoPhaseDispatches(event);
    return event;
  }
  function getNativeBeforeInputChars(topLevelType, nativeEvent) {
    switch (topLevelType) {
      case topLevelTypes.topCompositionEnd:
        return getDataFromCustomEvent(nativeEvent);
      case topLevelTypes.topKeyPress:
        var which = nativeEvent.which;
        if (which !== SPACEBAR_CODE) {
          return null;
        }
        hasSpaceKeypress = true;
        return SPACEBAR_CHAR;
      case topLevelTypes.topTextInput:
        var chars = nativeEvent.data;
        if (chars === SPACEBAR_CHAR && hasSpaceKeypress) {
          return null;
        }
        return chars;
      default:
        return null;
    }
  }
  function getFallbackBeforeInputChars(topLevelType, nativeEvent) {
    if (currentComposition) {
      if (topLevelType === topLevelTypes.topCompositionEnd || isFallbackCompositionEnd(topLevelType, nativeEvent)) {
        var chars = currentComposition.getData();
        FallbackCompositionState.release(currentComposition);
        currentComposition = null;
        return chars;
      }
      return null;
    }
    switch (topLevelType) {
      case topLevelTypes.topPaste:
        return null;
      case topLevelTypes.topKeyPress:
        if (nativeEvent.which && !isKeypressCommand(nativeEvent)) {
          return String.fromCharCode(nativeEvent.which);
        }
        return null;
      case topLevelTypes.topCompositionEnd:
        return useFallbackCompositionData ? null : nativeEvent.data;
      default:
        return null;
    }
  }
  function extractBeforeInputEvent(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
    var chars;
    if (canUseTextInputEvent) {
      chars = getNativeBeforeInputChars(topLevelType, nativeEvent);
    } else {
      chars = getFallbackBeforeInputChars(topLevelType, nativeEvent);
    }
    if (!chars) {
      return null;
    }
    var event = SyntheticInputEvent.getPooled(eventTypes.beforeInput, topLevelTargetID, nativeEvent, nativeEventTarget);
    event.data = chars;
    EventPropagators.accumulateTwoPhaseDispatches(event);
    return event;
  }
  var BeforeInputEventPlugin = {
    eventTypes: eventTypes,
    extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
      return [extractCompositionEvent(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget), extractBeforeInputEvent(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget)];
    }
  };
  module.exports = BeforeInputEventPlugin;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("77", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function getEventTarget(nativeEvent) {
    var target = nativeEvent.target || nativeEvent.srcElement || window;
    return target.nodeType === 3 ? target.parentNode : target;
  }
  module.exports = getEventTarget;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("78", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var supportedInputTypes = {
    'color': true,
    'date': true,
    'datetime': true,
    'datetime-local': true,
    'email': true,
    'month': true,
    'number': true,
    'password': true,
    'range': true,
    'search': true,
    'tel': true,
    'text': true,
    'time': true,
    'url': true,
    'week': true
  };
  function isTextInputElement(elem) {
    var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
    return nodeName && (nodeName === 'input' && supportedInputTypes[elem.type] || nodeName === 'textarea');
  }
  module.exports = isTextInputElement;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("79", ["42", "48", "6f", "2b", "5c", "72", "77", "4c", "78", "75", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var EventConstants = req('42');
    var EventPluginHub = req('48');
    var EventPropagators = req('6f');
    var ExecutionEnvironment = req('2b');
    var ReactUpdates = req('5c');
    var SyntheticEvent = req('72');
    var getEventTarget = req('77');
    var isEventSupported = req('4c');
    var isTextInputElement = req('78');
    var keyOf = req('75');
    var topLevelTypes = EventConstants.topLevelTypes;
    var eventTypes = {change: {
        phasedRegistrationNames: {
          bubbled: keyOf({onChange: null}),
          captured: keyOf({onChangeCapture: null})
        },
        dependencies: [topLevelTypes.topBlur, topLevelTypes.topChange, topLevelTypes.topClick, topLevelTypes.topFocus, topLevelTypes.topInput, topLevelTypes.topKeyDown, topLevelTypes.topKeyUp, topLevelTypes.topSelectionChange]
      }};
    var activeElement = null;
    var activeElementID = null;
    var activeElementValue = null;
    var activeElementValueProp = null;
    function shouldUseChangeEvent(elem) {
      var nodeName = elem.nodeName && elem.nodeName.toLowerCase();
      return nodeName === 'select' || nodeName === 'input' && elem.type === 'file';
    }
    var doesChangeEventBubble = false;
    if (ExecutionEnvironment.canUseDOM) {
      doesChangeEventBubble = isEventSupported('change') && (!('documentMode' in document) || document.documentMode > 8);
    }
    function manualDispatchChangeEvent(nativeEvent) {
      var event = SyntheticEvent.getPooled(eventTypes.change, activeElementID, nativeEvent, getEventTarget(nativeEvent));
      EventPropagators.accumulateTwoPhaseDispatches(event);
      ReactUpdates.batchedUpdates(runEventInBatch, event);
    }
    function runEventInBatch(event) {
      EventPluginHub.enqueueEvents(event);
      EventPluginHub.processEventQueue(false);
    }
    function startWatchingForChangeEventIE8(target, targetID) {
      activeElement = target;
      activeElementID = targetID;
      activeElement.attachEvent('onchange', manualDispatchChangeEvent);
    }
    function stopWatchingForChangeEventIE8() {
      if (!activeElement) {
        return;
      }
      activeElement.detachEvent('onchange', manualDispatchChangeEvent);
      activeElement = null;
      activeElementID = null;
    }
    function getTargetIDForChangeEvent(topLevelType, topLevelTarget, topLevelTargetID) {
      if (topLevelType === topLevelTypes.topChange) {
        return topLevelTargetID;
      }
    }
    function handleEventsForChangeEventIE8(topLevelType, topLevelTarget, topLevelTargetID) {
      if (topLevelType === topLevelTypes.topFocus) {
        stopWatchingForChangeEventIE8();
        startWatchingForChangeEventIE8(topLevelTarget, topLevelTargetID);
      } else if (topLevelType === topLevelTypes.topBlur) {
        stopWatchingForChangeEventIE8();
      }
    }
    var isInputEventSupported = false;
    if (ExecutionEnvironment.canUseDOM) {
      isInputEventSupported = isEventSupported('input') && (!('documentMode' in document) || document.documentMode > 9);
    }
    var newValueProp = {
      get: function() {
        return activeElementValueProp.get.call(this);
      },
      set: function(val) {
        activeElementValue = '' + val;
        activeElementValueProp.set.call(this, val);
      }
    };
    function startWatchingForValueChange(target, targetID) {
      activeElement = target;
      activeElementID = targetID;
      activeElementValue = target.value;
      activeElementValueProp = Object.getOwnPropertyDescriptor(target.constructor.prototype, 'value');
      Object.defineProperty(activeElement, 'value', newValueProp);
      activeElement.attachEvent('onpropertychange', handlePropertyChange);
    }
    function stopWatchingForValueChange() {
      if (!activeElement) {
        return;
      }
      delete activeElement.value;
      activeElement.detachEvent('onpropertychange', handlePropertyChange);
      activeElement = null;
      activeElementID = null;
      activeElementValue = null;
      activeElementValueProp = null;
    }
    function handlePropertyChange(nativeEvent) {
      if (nativeEvent.propertyName !== 'value') {
        return;
      }
      var value = nativeEvent.srcElement.value;
      if (value === activeElementValue) {
        return;
      }
      activeElementValue = value;
      manualDispatchChangeEvent(nativeEvent);
    }
    function getTargetIDForInputEvent(topLevelType, topLevelTarget, topLevelTargetID) {
      if (topLevelType === topLevelTypes.topInput) {
        return topLevelTargetID;
      }
    }
    function handleEventsForInputEventIE(topLevelType, topLevelTarget, topLevelTargetID) {
      if (topLevelType === topLevelTypes.topFocus) {
        stopWatchingForValueChange();
        startWatchingForValueChange(topLevelTarget, topLevelTargetID);
      } else if (topLevelType === topLevelTypes.topBlur) {
        stopWatchingForValueChange();
      }
    }
    function getTargetIDForInputEventIE(topLevelType, topLevelTarget, topLevelTargetID) {
      if (topLevelType === topLevelTypes.topSelectionChange || topLevelType === topLevelTypes.topKeyUp || topLevelType === topLevelTypes.topKeyDown) {
        if (activeElement && activeElement.value !== activeElementValue) {
          activeElementValue = activeElement.value;
          return activeElementID;
        }
      }
    }
    function shouldUseClickEvent(elem) {
      return elem.nodeName && elem.nodeName.toLowerCase() === 'input' && (elem.type === 'checkbox' || elem.type === 'radio');
    }
    function getTargetIDForClickEvent(topLevelType, topLevelTarget, topLevelTargetID) {
      if (topLevelType === topLevelTypes.topClick) {
        return topLevelTargetID;
      }
    }
    var ChangeEventPlugin = {
      eventTypes: eventTypes,
      extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
        var getTargetIDFunc,
            handleEventFunc;
        if (shouldUseChangeEvent(topLevelTarget)) {
          if (doesChangeEventBubble) {
            getTargetIDFunc = getTargetIDForChangeEvent;
          } else {
            handleEventFunc = handleEventsForChangeEventIE8;
          }
        } else if (isTextInputElement(topLevelTarget)) {
          if (isInputEventSupported) {
            getTargetIDFunc = getTargetIDForInputEvent;
          } else {
            getTargetIDFunc = getTargetIDForInputEventIE;
            handleEventFunc = handleEventsForInputEventIE;
          }
        } else if (shouldUseClickEvent(topLevelTarget)) {
          getTargetIDFunc = getTargetIDForClickEvent;
        }
        if (getTargetIDFunc) {
          var targetID = getTargetIDFunc(topLevelType, topLevelTarget, topLevelTargetID);
          if (targetID) {
            var event = SyntheticEvent.getPooled(eventTypes.change, targetID, nativeEvent, nativeEventTarget);
            event.type = 'change';
            EventPropagators.accumulateTwoPhaseDispatches(event);
            return event;
          }
        }
        if (handleEventFunc) {
          handleEventFunc(topLevelType, topLevelTarget, topLevelTargetID);
        }
      }
    };
    module.exports = ChangeEventPlugin;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7a", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var nextReactRootIndex = 0;
  var ClientReactRootIndex = {createReactRootIndex: function() {
      return nextReactRootIndex++;
    }};
  module.exports = ClientReactRootIndex;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7b", ["75"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var keyOf = req('75');
  var DefaultEventPluginOrder = [keyOf({ResponderEventPlugin: null}), keyOf({SimpleEventPlugin: null}), keyOf({TapEventPlugin: null}), keyOf({EnterLeaveEventPlugin: null}), keyOf({ChangeEventPlugin: null}), keyOf({SelectEventPlugin: null}), keyOf({BeforeInputEventPlugin: null})];
  module.exports = DefaultEventPluginOrder;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7c", ["72", "77"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticEvent = req('72');
  var getEventTarget = req('77');
  var UIEventInterface = {
    view: function(event) {
      if (event.view) {
        return event.view;
      }
      var target = getEventTarget(event);
      if (target != null && target.window === target) {
        return target;
      }
      var doc = target.ownerDocument;
      if (doc) {
        return doc.defaultView || doc.parentWindow;
      } else {
        return window;
      }
    },
    detail: function(event) {
      return event.detail || 0;
    }
  };
  function SyntheticUIEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticEvent.augmentClass(SyntheticUIEvent, UIEventInterface);
  module.exports = SyntheticUIEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7d", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var modifierKeyToProp = {
    'Alt': 'altKey',
    'Control': 'ctrlKey',
    'Meta': 'metaKey',
    'Shift': 'shiftKey'
  };
  function modifierStateGetter(keyArg) {
    var syntheticEvent = this;
    var nativeEvent = syntheticEvent.nativeEvent;
    if (nativeEvent.getModifierState) {
      return nativeEvent.getModifierState(keyArg);
    }
    var keyProp = modifierKeyToProp[keyArg];
    return keyProp ? !!nativeEvent[keyProp] : false;
  }
  function getEventModifierState(nativeEvent) {
    return modifierStateGetter;
  }
  module.exports = getEventModifierState;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7e", ["7c", "4a", "7d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticUIEvent = req('7c');
  var ViewportMetrics = req('4a');
  var getEventModifierState = req('7d');
  var MouseEventInterface = {
    screenX: null,
    screenY: null,
    clientX: null,
    clientY: null,
    ctrlKey: null,
    shiftKey: null,
    altKey: null,
    metaKey: null,
    getModifierState: getEventModifierState,
    button: function(event) {
      var button = event.button;
      if ('which' in event) {
        return button;
      }
      return button === 2 ? 2 : button === 4 ? 1 : 0;
    },
    buttons: null,
    relatedTarget: function(event) {
      return event.relatedTarget || (event.fromElement === event.srcElement ? event.toElement : event.fromElement);
    },
    pageX: function(event) {
      return 'pageX' in event ? event.pageX : event.clientX + ViewportMetrics.currentScrollLeft;
    },
    pageY: function(event) {
      return 'pageY' in event ? event.pageY : event.clientY + ViewportMetrics.currentScrollTop;
    }
  };
  function SyntheticMouseEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticUIEvent.augmentClass(SyntheticMouseEvent, MouseEventInterface);
  module.exports = SyntheticMouseEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7f", ["42", "6f", "7e", "6b", "75"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var EventConstants = req('42');
  var EventPropagators = req('6f');
  var SyntheticMouseEvent = req('7e');
  var ReactMount = req('6b');
  var keyOf = req('75');
  var topLevelTypes = EventConstants.topLevelTypes;
  var getFirstReactDOM = ReactMount.getFirstReactDOM;
  var eventTypes = {
    mouseEnter: {
      registrationName: keyOf({onMouseEnter: null}),
      dependencies: [topLevelTypes.topMouseOut, topLevelTypes.topMouseOver]
    },
    mouseLeave: {
      registrationName: keyOf({onMouseLeave: null}),
      dependencies: [topLevelTypes.topMouseOut, topLevelTypes.topMouseOver]
    }
  };
  var extractedEvents = [null, null];
  var EnterLeaveEventPlugin = {
    eventTypes: eventTypes,
    extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
      if (topLevelType === topLevelTypes.topMouseOver && (nativeEvent.relatedTarget || nativeEvent.fromElement)) {
        return null;
      }
      if (topLevelType !== topLevelTypes.topMouseOut && topLevelType !== topLevelTypes.topMouseOver) {
        return null;
      }
      var win;
      if (topLevelTarget.window === topLevelTarget) {
        win = topLevelTarget;
      } else {
        var doc = topLevelTarget.ownerDocument;
        if (doc) {
          win = doc.defaultView || doc.parentWindow;
        } else {
          win = window;
        }
      }
      var from;
      var to;
      var fromID = '';
      var toID = '';
      if (topLevelType === topLevelTypes.topMouseOut) {
        from = topLevelTarget;
        fromID = topLevelTargetID;
        to = getFirstReactDOM(nativeEvent.relatedTarget || nativeEvent.toElement);
        if (to) {
          toID = ReactMount.getID(to);
        } else {
          to = win;
        }
        to = to || win;
      } else {
        from = win;
        to = topLevelTarget;
        toID = topLevelTargetID;
      }
      if (from === to) {
        return null;
      }
      var leave = SyntheticMouseEvent.getPooled(eventTypes.mouseLeave, fromID, nativeEvent, nativeEventTarget);
      leave.type = 'mouseleave';
      leave.target = from;
      leave.relatedTarget = to;
      var enter = SyntheticMouseEvent.getPooled(eventTypes.mouseEnter, toID, nativeEvent, nativeEventTarget);
      enter.type = 'mouseenter';
      enter.target = to;
      enter.relatedTarget = from;
      EventPropagators.accumulateEnterLeaveDispatches(leave, enter, fromID, toID);
      extractedEvents[0] = leave;
      extractedEvents[1] = enter;
      return extractedEvents;
    }
  };
  module.exports = EnterLeaveEventPlugin;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("80", ["3e", "2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var DOMProperty = req('3e');
  var ExecutionEnvironment = req('2b');
  var MUST_USE_ATTRIBUTE = DOMProperty.injection.MUST_USE_ATTRIBUTE;
  var MUST_USE_PROPERTY = DOMProperty.injection.MUST_USE_PROPERTY;
  var HAS_BOOLEAN_VALUE = DOMProperty.injection.HAS_BOOLEAN_VALUE;
  var HAS_SIDE_EFFECTS = DOMProperty.injection.HAS_SIDE_EFFECTS;
  var HAS_NUMERIC_VALUE = DOMProperty.injection.HAS_NUMERIC_VALUE;
  var HAS_POSITIVE_NUMERIC_VALUE = DOMProperty.injection.HAS_POSITIVE_NUMERIC_VALUE;
  var HAS_OVERLOADED_BOOLEAN_VALUE = DOMProperty.injection.HAS_OVERLOADED_BOOLEAN_VALUE;
  var hasSVG;
  if (ExecutionEnvironment.canUseDOM) {
    var implementation = document.implementation;
    hasSVG = implementation && implementation.hasFeature && implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1');
  }
  var HTMLDOMPropertyConfig = {
    isCustomAttribute: RegExp.prototype.test.bind(/^(data|aria)-[a-z_][a-z\d_.\-]*$/),
    Properties: {
      accept: null,
      acceptCharset: null,
      accessKey: null,
      action: null,
      allowFullScreen: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
      allowTransparency: MUST_USE_ATTRIBUTE,
      alt: null,
      async: HAS_BOOLEAN_VALUE,
      autoComplete: null,
      autoPlay: HAS_BOOLEAN_VALUE,
      capture: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
      cellPadding: null,
      cellSpacing: null,
      charSet: MUST_USE_ATTRIBUTE,
      challenge: MUST_USE_ATTRIBUTE,
      checked: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
      classID: MUST_USE_ATTRIBUTE,
      className: hasSVG ? MUST_USE_ATTRIBUTE : MUST_USE_PROPERTY,
      cols: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
      colSpan: null,
      content: null,
      contentEditable: null,
      contextMenu: MUST_USE_ATTRIBUTE,
      controls: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
      coords: null,
      crossOrigin: null,
      data: null,
      dateTime: MUST_USE_ATTRIBUTE,
      defer: HAS_BOOLEAN_VALUE,
      dir: null,
      disabled: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
      download: HAS_OVERLOADED_BOOLEAN_VALUE,
      draggable: null,
      encType: null,
      form: MUST_USE_ATTRIBUTE,
      formAction: MUST_USE_ATTRIBUTE,
      formEncType: MUST_USE_ATTRIBUTE,
      formMethod: MUST_USE_ATTRIBUTE,
      formNoValidate: HAS_BOOLEAN_VALUE,
      formTarget: MUST_USE_ATTRIBUTE,
      frameBorder: MUST_USE_ATTRIBUTE,
      headers: null,
      height: MUST_USE_ATTRIBUTE,
      hidden: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
      high: null,
      href: null,
      hrefLang: null,
      htmlFor: null,
      httpEquiv: null,
      icon: null,
      id: MUST_USE_PROPERTY,
      inputMode: MUST_USE_ATTRIBUTE,
      is: MUST_USE_ATTRIBUTE,
      keyParams: MUST_USE_ATTRIBUTE,
      keyType: MUST_USE_ATTRIBUTE,
      label: null,
      lang: null,
      list: MUST_USE_ATTRIBUTE,
      loop: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
      low: null,
      manifest: MUST_USE_ATTRIBUTE,
      marginHeight: null,
      marginWidth: null,
      max: null,
      maxLength: MUST_USE_ATTRIBUTE,
      media: MUST_USE_ATTRIBUTE,
      mediaGroup: null,
      method: null,
      min: null,
      minLength: MUST_USE_ATTRIBUTE,
      multiple: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
      muted: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
      name: null,
      noValidate: HAS_BOOLEAN_VALUE,
      open: HAS_BOOLEAN_VALUE,
      optimum: null,
      pattern: null,
      placeholder: null,
      poster: null,
      preload: null,
      radioGroup: null,
      readOnly: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
      rel: null,
      required: HAS_BOOLEAN_VALUE,
      role: MUST_USE_ATTRIBUTE,
      rows: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
      rowSpan: null,
      sandbox: null,
      scope: null,
      scoped: HAS_BOOLEAN_VALUE,
      scrolling: null,
      seamless: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
      selected: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
      shape: null,
      size: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
      sizes: MUST_USE_ATTRIBUTE,
      span: HAS_POSITIVE_NUMERIC_VALUE,
      spellCheck: null,
      src: null,
      srcDoc: MUST_USE_PROPERTY,
      srcSet: MUST_USE_ATTRIBUTE,
      start: HAS_NUMERIC_VALUE,
      step: null,
      style: null,
      summary: null,
      tabIndex: null,
      target: null,
      title: null,
      type: null,
      useMap: null,
      value: MUST_USE_PROPERTY | HAS_SIDE_EFFECTS,
      width: MUST_USE_ATTRIBUTE,
      wmode: MUST_USE_ATTRIBUTE,
      wrap: null,
      about: MUST_USE_ATTRIBUTE,
      datatype: MUST_USE_ATTRIBUTE,
      inlist: MUST_USE_ATTRIBUTE,
      prefix: MUST_USE_ATTRIBUTE,
      property: MUST_USE_ATTRIBUTE,
      resource: MUST_USE_ATTRIBUTE,
      'typeof': MUST_USE_ATTRIBUTE,
      vocab: MUST_USE_ATTRIBUTE,
      autoCapitalize: null,
      autoCorrect: null,
      autoSave: null,
      itemProp: MUST_USE_ATTRIBUTE,
      itemScope: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
      itemType: MUST_USE_ATTRIBUTE,
      itemID: MUST_USE_ATTRIBUTE,
      itemRef: MUST_USE_ATTRIBUTE,
      results: null,
      security: MUST_USE_ATTRIBUTE,
      unselectable: MUST_USE_ATTRIBUTE
    },
    DOMAttributeNames: {
      acceptCharset: 'accept-charset',
      className: 'class',
      htmlFor: 'for',
      httpEquiv: 'http-equiv'
    },
    DOMPropertyNames: {
      autoCapitalize: 'autocapitalize',
      autoComplete: 'autocomplete',
      autoCorrect: 'autocorrect',
      autoFocus: 'autofocus',
      autoPlay: 'autoplay',
      autoSave: 'autosave',
      encType: 'encoding',
      hrefLang: 'hreflang',
      radioGroup: 'radiogroup',
      spellCheck: 'spellcheck',
      srcDoc: 'srcdoc',
      srcSet: 'srcset'
    }
  };
  module.exports = HTMLDOMPropertyConfig;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("81", ["2a", "53", "6b", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactCurrentOwner = req('2a');
    var ReactInstanceMap = req('53');
    var ReactMount = req('6b');
    var invariant = req('30');
    var warning = req('40');
    function findDOMNode(componentOrElement) {
      if (process.env.NODE_ENV !== 'production') {
        var owner = ReactCurrentOwner.current;
        if (owner !== null) {
          process.env.NODE_ENV !== 'production' ? warning(owner._warnedAboutRefsInRender, '%s is accessing getDOMNode or findDOMNode inside its render(). ' + 'render() should be a pure function of props and state. It should ' + 'never access something that requires stale data from the previous ' + 'render, such as refs. Move this logic to componentDidMount and ' + 'componentDidUpdate instead.', owner.getName() || 'A component') : undefined;
          owner._warnedAboutRefsInRender = true;
        }
      }
      if (componentOrElement == null) {
        return null;
      }
      if (componentOrElement.nodeType === 1) {
        return componentOrElement;
      }
      if (ReactInstanceMap.has(componentOrElement)) {
        return ReactMount.getNodeFromInstance(componentOrElement);
      }
      !(componentOrElement.render == null || typeof componentOrElement.render !== 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'findDOMNode was called on an unmounted component.') : invariant(false) : undefined;
      !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Element appears to be neither ReactComponent nor DOMNode (keys: %s)', Object.keys(componentOrElement)) : invariant(false) : undefined;
    }
    module.exports = findDOMNode;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("82", ["53", "81", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactInstanceMap = req('53');
    var findDOMNode = req('81');
    var warning = req('40');
    var didWarnKey = '_getDOMNodeDidWarn';
    var ReactBrowserComponentMixin = {getDOMNode: function() {
        process.env.NODE_ENV !== 'production' ? warning(this.constructor[didWarnKey], '%s.getDOMNode(...) is deprecated. Please use ' + 'ReactDOM.findDOMNode(instance) instead.', ReactInstanceMap.get(this).getName() || this.tagName || 'Unknown') : undefined;
        this.constructor[didWarnKey] = true;
        return findDOMNode(this);
      }};
    module.exports = ReactBrowserComponentMixin;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("83", ["5c", "5b", "4b", "35"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactUpdates = req('5c');
  var Transaction = req('5b');
  var assign = req('4b');
  var emptyFunction = req('35');
  var RESET_BATCHED_UPDATES = {
    initialize: emptyFunction,
    close: function() {
      ReactDefaultBatchingStrategy.isBatchingUpdates = false;
    }
  };
  var FLUSH_BATCHED_UPDATES = {
    initialize: emptyFunction,
    close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)
  };
  var TRANSACTION_WRAPPERS = [FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES];
  function ReactDefaultBatchingStrategyTransaction() {
    this.reinitializeTransaction();
  }
  assign(ReactDefaultBatchingStrategyTransaction.prototype, Transaction.Mixin, {getTransactionWrappers: function() {
      return TRANSACTION_WRAPPERS;
    }});
  var transaction = new ReactDefaultBatchingStrategyTransaction();
  var ReactDefaultBatchingStrategy = {
    isBatchingUpdates: false,
    batchedUpdates: function(callback, a, b, c, d, e) {
      var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;
      ReactDefaultBatchingStrategy.isBatchingUpdates = true;
      if (alreadyBatchingUpdates) {
        callback(a, b, c, d, e);
      } else {
        transaction.perform(callback, null, a, b, c, d, e);
      }
    }
  };
  module.exports = ReactDefaultBatchingStrategy;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("84", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function focusNode(node) {
    try {
      node.focus();
    } catch (e) {}
  }
  module.exports = focusNode;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("85", ["6b", "81", "84"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactMount = req('6b');
  var findDOMNode = req('81');
  var focusNode = req('84');
  var Mixin = {componentDidMount: function() {
      if (this.props.autoFocus) {
        focusNode(findDOMNode(this));
      }
    }};
  var AutoFocusUtils = {
    Mixin: Mixin,
    focusDOMComponent: function() {
      focusNode(ReactMount.getNode(this._rootNodeID));
    }
  };
  module.exports = AutoFocusUtils;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("86", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var isUnitlessNumber = {
    animationIterationCount: true,
    boxFlex: true,
    boxFlexGroup: true,
    boxOrdinalGroup: true,
    columnCount: true,
    flex: true,
    flexGrow: true,
    flexPositive: true,
    flexShrink: true,
    flexNegative: true,
    flexOrder: true,
    fontWeight: true,
    lineClamp: true,
    lineHeight: true,
    opacity: true,
    order: true,
    orphans: true,
    tabSize: true,
    widows: true,
    zIndex: true,
    zoom: true,
    fillOpacity: true,
    stopOpacity: true,
    strokeDashoffset: true,
    strokeOpacity: true,
    strokeWidth: true
  };
  function prefixKey(prefix, key) {
    return prefix + key.charAt(0).toUpperCase() + key.substring(1);
  }
  var prefixes = ['Webkit', 'ms', 'Moz', 'O'];
  Object.keys(isUnitlessNumber).forEach(function(prop) {
    prefixes.forEach(function(prefix) {
      isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
    });
  });
  var shorthandPropertyExpansions = {
    background: {
      backgroundAttachment: true,
      backgroundColor: true,
      backgroundImage: true,
      backgroundPositionX: true,
      backgroundPositionY: true,
      backgroundRepeat: true
    },
    backgroundPosition: {
      backgroundPositionX: true,
      backgroundPositionY: true
    },
    border: {
      borderWidth: true,
      borderStyle: true,
      borderColor: true
    },
    borderBottom: {
      borderBottomWidth: true,
      borderBottomStyle: true,
      borderBottomColor: true
    },
    borderLeft: {
      borderLeftWidth: true,
      borderLeftStyle: true,
      borderLeftColor: true
    },
    borderRight: {
      borderRightWidth: true,
      borderRightStyle: true,
      borderRightColor: true
    },
    borderTop: {
      borderTopWidth: true,
      borderTopStyle: true,
      borderTopColor: true
    },
    font: {
      fontStyle: true,
      fontVariant: true,
      fontWeight: true,
      fontSize: true,
      lineHeight: true,
      fontFamily: true
    },
    outline: {
      outlineWidth: true,
      outlineStyle: true,
      outlineColor: true
    }
  };
  var CSSProperty = {
    isUnitlessNumber: isUnitlessNumber,
    shorthandPropertyExpansions: shorthandPropertyExpansions
  };
  module.exports = CSSProperty;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("87", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _hyphenPattern = /-(.)/g;
  function camelize(string) {
    return string.replace(_hyphenPattern, function(_, character) {
      return character.toUpperCase();
    });
  }
  module.exports = camelize;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("88", ["87"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var camelize = req('87');
  var msPattern = /^-ms-/;
  function camelizeStyleName(string) {
    return camelize(string.replace(msPattern, 'ms-'));
  }
  module.exports = camelizeStyleName;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("89", ["86"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var CSSProperty = req('86');
  var isUnitlessNumber = CSSProperty.isUnitlessNumber;
  function dangerousStyleValue(name, value) {
    var isEmpty = value == null || typeof value === 'boolean' || value === '';
    if (isEmpty) {
      return '';
    }
    var isNonNumeric = isNaN(value);
    if (isNonNumeric || value === 0 || isUnitlessNumber.hasOwnProperty(name) && isUnitlessNumber[name]) {
      return '' + value;
    }
    if (typeof value === 'string') {
      value = value.trim();
    }
    return value + 'px';
  }
  module.exports = dangerousStyleValue;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("8a", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var _uppercasePattern = /([A-Z])/g;
  function hyphenate(string) {
    return string.replace(_uppercasePattern, '-$1').toLowerCase();
  }
  module.exports = hyphenate;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("8b", ["8a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var hyphenate = req('8a');
  var msPattern = /^ms-/;
  function hyphenateStyleName(string) {
    return hyphenate(string).replace(msPattern, '-ms-');
  }
  module.exports = hyphenateStyleName;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("8c", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function memoizeStringOnly(callback) {
    var cache = {};
    return function(string) {
      if (!cache.hasOwnProperty(string)) {
        cache[string] = callback.call(this, string);
      }
      return cache[string];
    };
  }
  module.exports = memoizeStringOnly;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("8d", ["86", "2b", "39", "88", "89", "8b", "8c", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var CSSProperty = req('86');
    var ExecutionEnvironment = req('2b');
    var ReactPerf = req('39');
    var camelizeStyleName = req('88');
    var dangerousStyleValue = req('89');
    var hyphenateStyleName = req('8b');
    var memoizeStringOnly = req('8c');
    var warning = req('40');
    var processStyleName = memoizeStringOnly(function(styleName) {
      return hyphenateStyleName(styleName);
    });
    var hasShorthandPropertyBug = false;
    var styleFloatAccessor = 'cssFloat';
    if (ExecutionEnvironment.canUseDOM) {
      var tempStyle = document.createElement('div').style;
      try {
        tempStyle.font = '';
      } catch (e) {
        hasShorthandPropertyBug = true;
      }
      if (document.documentElement.style.cssFloat === undefined) {
        styleFloatAccessor = 'styleFloat';
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      var badVendoredStyleNamePattern = /^(?:webkit|moz|o)[A-Z]/;
      var badStyleValueWithSemicolonPattern = /;\s*$/;
      var warnedStyleNames = {};
      var warnedStyleValues = {};
      var warnHyphenatedStyleName = function(name) {
        if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
          return;
        }
        warnedStyleNames[name] = true;
        process.env.NODE_ENV !== 'production' ? warning(false, 'Unsupported style property %s. Did you mean %s?', name, camelizeStyleName(name)) : undefined;
      };
      var warnBadVendoredStyleName = function(name) {
        if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
          return;
        }
        warnedStyleNames[name] = true;
        process.env.NODE_ENV !== 'production' ? warning(false, 'Unsupported vendor-prefixed style property %s. Did you mean %s?', name, name.charAt(0).toUpperCase() + name.slice(1)) : undefined;
      };
      var warnStyleValueWithSemicolon = function(name, value) {
        if (warnedStyleValues.hasOwnProperty(value) && warnedStyleValues[value]) {
          return;
        }
        warnedStyleValues[value] = true;
        process.env.NODE_ENV !== 'production' ? warning(false, 'Style property values shouldn\'t contain a semicolon. ' + 'Try "%s: %s" instead.', name, value.replace(badStyleValueWithSemicolonPattern, '')) : undefined;
      };
      var warnValidStyle = function(name, value) {
        if (name.indexOf('-') > -1) {
          warnHyphenatedStyleName(name);
        } else if (badVendoredStyleNamePattern.test(name)) {
          warnBadVendoredStyleName(name);
        } else if (badStyleValueWithSemicolonPattern.test(value)) {
          warnStyleValueWithSemicolon(name, value);
        }
      };
    }
    var CSSPropertyOperations = {
      createMarkupForStyles: function(styles) {
        var serialized = '';
        for (var styleName in styles) {
          if (!styles.hasOwnProperty(styleName)) {
            continue;
          }
          var styleValue = styles[styleName];
          if (process.env.NODE_ENV !== 'production') {
            warnValidStyle(styleName, styleValue);
          }
          if (styleValue != null) {
            serialized += processStyleName(styleName) + ':';
            serialized += dangerousStyleValue(styleName, styleValue) + ';';
          }
        }
        return serialized || null;
      },
      setValueForStyles: function(node, styles) {
        var style = node.style;
        for (var styleName in styles) {
          if (!styles.hasOwnProperty(styleName)) {
            continue;
          }
          if (process.env.NODE_ENV !== 'production') {
            warnValidStyle(styleName, styles[styleName]);
          }
          var styleValue = dangerousStyleValue(styleName, styles[styleName]);
          if (styleName === 'float') {
            styleName = styleFloatAccessor;
          }
          if (styleValue) {
            style[styleName] = styleValue;
          } else {
            var expansion = hasShorthandPropertyBug && CSSProperty.shorthandPropertyExpansions[styleName];
            if (expansion) {
              for (var individualStyleName in expansion) {
                style[individualStyleName] = '';
              }
            } else {
              style[styleName] = '';
            }
          }
        }
      }
    };
    ReactPerf.measureMethods(CSSPropertyOperations, 'CSSPropertyOperations', {setValueForStyles: 'setValueForStyles'});
    module.exports = CSSPropertyOperations;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("8e", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var mouseListenerNames = {
    onClick: true,
    onDoubleClick: true,
    onMouseDown: true,
    onMouseMove: true,
    onMouseUp: true,
    onClickCapture: true,
    onDoubleClickCapture: true,
    onMouseDownCapture: true,
    onMouseMoveCapture: true,
    onMouseUpCapture: true
  };
  var ReactDOMButton = {getNativeProps: function(inst, props, context) {
      if (!props.disabled) {
        return props;
      }
      var nativeProps = {};
      for (var key in props) {
        if (props.hasOwnProperty(key) && !mouseListenerNames[key]) {
          nativeProps[key] = props[key];
        }
      }
      return nativeProps;
    }};
  module.exports = ReactDOMButton;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("8f", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
  var FAUX_ITERATOR_SYMBOL = '@@iterator';
  function getIteratorFn(maybeIterable) {
    var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
    if (typeof iteratorFn === 'function') {
      return iteratorFn;
    }
  }
  module.exports = getIteratorFn;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("90", ["4f", "64", "35", "8f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactElement = req('4f');
  var ReactPropTypeLocationNames = req('64');
  var emptyFunction = req('35');
  var getIteratorFn = req('8f');
  var ANONYMOUS = '<<anonymous>>';
  var ReactPropTypes = {
    array: createPrimitiveTypeChecker('array'),
    bool: createPrimitiveTypeChecker('boolean'),
    func: createPrimitiveTypeChecker('function'),
    number: createPrimitiveTypeChecker('number'),
    object: createPrimitiveTypeChecker('object'),
    string: createPrimitiveTypeChecker('string'),
    any: createAnyTypeChecker(),
    arrayOf: createArrayOfTypeChecker,
    element: createElementTypeChecker(),
    instanceOf: createInstanceTypeChecker,
    node: createNodeChecker(),
    objectOf: createObjectOfTypeChecker,
    oneOf: createEnumTypeChecker,
    oneOfType: createUnionTypeChecker,
    shape: createShapeTypeChecker
  };
  function createChainableTypeChecker(validate) {
    function checkType(isRequired, props, propName, componentName, location, propFullName) {
      componentName = componentName || ANONYMOUS;
      propFullName = propFullName || propName;
      if (props[propName] == null) {
        var locationName = ReactPropTypeLocationNames[location];
        if (isRequired) {
          return new Error('Required ' + locationName + ' `' + propFullName + '` was not specified in ' + ('`' + componentName + '`.'));
        }
        return null;
      } else {
        return validate(props, propName, componentName, location, propFullName);
      }
    }
    var chainedCheckType = checkType.bind(null, false);
    chainedCheckType.isRequired = checkType.bind(null, true);
    return chainedCheckType;
  }
  function createPrimitiveTypeChecker(expectedType) {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== expectedType) {
        var locationName = ReactPropTypeLocationNames[location];
        var preciseType = getPreciseType(propValue);
        return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }
  function createAnyTypeChecker() {
    return createChainableTypeChecker(emptyFunction.thatReturns(null));
  }
  function createArrayOfTypeChecker(typeChecker) {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      if (!Array.isArray(propValue)) {
        var locationName = ReactPropTypeLocationNames[location];
        var propType = getPropType(propValue);
        return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
      }
      for (var i = 0; i < propValue.length; i++) {
        var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']');
        if (error instanceof Error) {
          return error;
        }
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }
  function createElementTypeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      if (!ReactElement.isValidElement(props[propName])) {
        var locationName = ReactPropTypeLocationNames[location];
        return new Error('Invalid ' + locationName + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a single ReactElement.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }
  function createInstanceTypeChecker(expectedClass) {
    function validate(props, propName, componentName, location, propFullName) {
      if (!(props[propName] instanceof expectedClass)) {
        var locationName = ReactPropTypeLocationNames[location];
        var expectedClassName = expectedClass.name || ANONYMOUS;
        var actualClassName = getClassName(props[propName]);
        return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }
  function createEnumTypeChecker(expectedValues) {
    if (!Array.isArray(expectedValues)) {
      return createChainableTypeChecker(function() {
        return new Error('Invalid argument supplied to oneOf, expected an instance of array.');
      });
    }
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      for (var i = 0; i < expectedValues.length; i++) {
        if (propValue === expectedValues[i]) {
          return null;
        }
      }
      var locationName = ReactPropTypeLocationNames[location];
      var valuesString = JSON.stringify(expectedValues);
      return new Error('Invalid ' + locationName + ' `' + propFullName + '` of value `' + propValue + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
    }
    return createChainableTypeChecker(validate);
  }
  function createObjectOfTypeChecker(typeChecker) {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== 'object') {
        var locationName = ReactPropTypeLocationNames[location];
        return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
      }
      for (var key in propValue) {
        if (propValue.hasOwnProperty(key)) {
          var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key);
          if (error instanceof Error) {
            return error;
          }
        }
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }
  function createUnionTypeChecker(arrayOfTypeCheckers) {
    if (!Array.isArray(arrayOfTypeCheckers)) {
      return createChainableTypeChecker(function() {
        return new Error('Invalid argument supplied to oneOfType, expected an instance of array.');
      });
    }
    function validate(props, propName, componentName, location, propFullName) {
      for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
        var checker = arrayOfTypeCheckers[i];
        if (checker(props, propName, componentName, location, propFullName) == null) {
          return null;
        }
      }
      var locationName = ReactPropTypeLocationNames[location];
      return new Error('Invalid ' + locationName + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
    }
    return createChainableTypeChecker(validate);
  }
  function createNodeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      if (!isNode(props[propName])) {
        var locationName = ReactPropTypeLocationNames[location];
        return new Error('Invalid ' + locationName + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }
  function createShapeTypeChecker(shapeTypes) {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== 'object') {
        var locationName = ReactPropTypeLocationNames[location];
        return new Error('Invalid ' + locationName + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
      }
      for (var key in shapeTypes) {
        var checker = shapeTypes[key];
        if (!checker) {
          continue;
        }
        var error = checker(propValue, key, componentName, location, propFullName + '.' + key);
        if (error) {
          return error;
        }
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }
  function isNode(propValue) {
    switch (typeof propValue) {
      case 'number':
      case 'string':
      case 'undefined':
        return true;
      case 'boolean':
        return !propValue;
      case 'object':
        if (Array.isArray(propValue)) {
          return propValue.every(isNode);
        }
        if (propValue === null || ReactElement.isValidElement(propValue)) {
          return true;
        }
        var iteratorFn = getIteratorFn(propValue);
        if (iteratorFn) {
          var iterator = iteratorFn.call(propValue);
          var step;
          if (iteratorFn !== propValue.entries) {
            while (!(step = iterator.next()).done) {
              if (!isNode(step.value)) {
                return false;
              }
            }
          } else {
            while (!(step = iterator.next()).done) {
              var entry = step.value;
              if (entry) {
                if (!isNode(entry[1])) {
                  return false;
                }
              }
            }
          }
        } else {
          return false;
        }
        return true;
      default:
        return false;
    }
  }
  function getPropType(propValue) {
    var propType = typeof propValue;
    if (Array.isArray(propValue)) {
      return 'array';
    }
    if (propValue instanceof RegExp) {
      return 'object';
    }
    return propType;
  }
  function getPreciseType(propValue) {
    var propType = getPropType(propValue);
    if (propType === 'object') {
      if (propValue instanceof Date) {
        return 'date';
      } else if (propValue instanceof RegExp) {
        return 'regexp';
      }
    }
    return propType;
  }
  function getClassName(propValue) {
    if (!propValue.constructor || !propValue.constructor.name) {
      return '<<anonymous>>';
    }
    return propValue.constructor.name;
  }
  module.exports = ReactPropTypes;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("91", ["90", "63", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactPropTypes = req('90');
    var ReactPropTypeLocations = req('63');
    var invariant = req('30');
    var warning = req('40');
    var hasReadOnlyValue = {
      'button': true,
      'checkbox': true,
      'image': true,
      'hidden': true,
      'radio': true,
      'reset': true,
      'submit': true
    };
    function _assertSingleLink(inputProps) {
      !(inputProps.checkedLink == null || inputProps.valueLink == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Cannot provide a checkedLink and a valueLink. If you want to use ' + 'checkedLink, you probably don\'t want to use valueLink and vice versa.') : invariant(false) : undefined;
    }
    function _assertValueLink(inputProps) {
      _assertSingleLink(inputProps);
      !(inputProps.value == null && inputProps.onChange == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Cannot provide a valueLink and a value or onChange event. If you want ' + 'to use value or onChange, you probably don\'t want to use valueLink.') : invariant(false) : undefined;
    }
    function _assertCheckedLink(inputProps) {
      _assertSingleLink(inputProps);
      !(inputProps.checked == null && inputProps.onChange == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Cannot provide a checkedLink and a checked property or onChange event. ' + 'If you want to use checked or onChange, you probably don\'t want to ' + 'use checkedLink') : invariant(false) : undefined;
    }
    var propTypes = {
      value: function(props, propName, componentName) {
        if (!props[propName] || hasReadOnlyValue[props.type] || props.onChange || props.readOnly || props.disabled) {
          return null;
        }
        return new Error('You provided a `value` prop to a form field without an ' + '`onChange` handler. This will render a read-only field. If ' + 'the field should be mutable use `defaultValue`. Otherwise, ' + 'set either `onChange` or `readOnly`.');
      },
      checked: function(props, propName, componentName) {
        if (!props[propName] || props.onChange || props.readOnly || props.disabled) {
          return null;
        }
        return new Error('You provided a `checked` prop to a form field without an ' + '`onChange` handler. This will render a read-only field. If ' + 'the field should be mutable use `defaultChecked`. Otherwise, ' + 'set either `onChange` or `readOnly`.');
      },
      onChange: ReactPropTypes.func
    };
    var loggedTypeFailures = {};
    function getDeclarationErrorAddendum(owner) {
      if (owner) {
        var name = owner.getName();
        if (name) {
          return ' Check the render method of `' + name + '`.';
        }
      }
      return '';
    }
    var LinkedValueUtils = {
      checkPropTypes: function(tagName, props, owner) {
        for (var propName in propTypes) {
          if (propTypes.hasOwnProperty(propName)) {
            var error = propTypes[propName](props, propName, tagName, ReactPropTypeLocations.prop);
          }
          if (error instanceof Error && !(error.message in loggedTypeFailures)) {
            loggedTypeFailures[error.message] = true;
            var addendum = getDeclarationErrorAddendum(owner);
            process.env.NODE_ENV !== 'production' ? warning(false, 'Failed form propType: %s%s', error.message, addendum) : undefined;
          }
        }
      },
      getValue: function(inputProps) {
        if (inputProps.valueLink) {
          _assertValueLink(inputProps);
          return inputProps.valueLink.value;
        }
        return inputProps.value;
      },
      getChecked: function(inputProps) {
        if (inputProps.checkedLink) {
          _assertCheckedLink(inputProps);
          return inputProps.checkedLink.value;
        }
        return inputProps.checked;
      },
      executeOnChange: function(inputProps, event) {
        if (inputProps.valueLink) {
          _assertValueLink(inputProps);
          return inputProps.valueLink.requestChange(event.target.value);
        } else if (inputProps.checkedLink) {
          _assertCheckedLink(inputProps);
          return inputProps.checkedLink.requestChange(event.target.checked);
        } else if (inputProps.onChange) {
          return inputProps.onChange.call(undefined, event);
        }
      }
    };
    module.exports = LinkedValueUtils;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("92", ["6c", "91", "6b", "5c", "4b", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactDOMIDOperations = req('6c');
    var LinkedValueUtils = req('91');
    var ReactMount = req('6b');
    var ReactUpdates = req('5c');
    var assign = req('4b');
    var invariant = req('30');
    var instancesByReactID = {};
    function forceUpdateIfMounted() {
      if (this._rootNodeID) {
        ReactDOMInput.updateWrapper(this);
      }
    }
    var ReactDOMInput = {
      getNativeProps: function(inst, props, context) {
        var value = LinkedValueUtils.getValue(props);
        var checked = LinkedValueUtils.getChecked(props);
        var nativeProps = assign({}, props, {
          defaultChecked: undefined,
          defaultValue: undefined,
          value: value != null ? value : inst._wrapperState.initialValue,
          checked: checked != null ? checked : inst._wrapperState.initialChecked,
          onChange: inst._wrapperState.onChange
        });
        return nativeProps;
      },
      mountWrapper: function(inst, props) {
        if (process.env.NODE_ENV !== 'production') {
          LinkedValueUtils.checkPropTypes('input', props, inst._currentElement._owner);
        }
        var defaultValue = props.defaultValue;
        inst._wrapperState = {
          initialChecked: props.defaultChecked || false,
          initialValue: defaultValue != null ? defaultValue : null,
          onChange: _handleChange.bind(inst)
        };
      },
      mountReadyWrapper: function(inst) {
        instancesByReactID[inst._rootNodeID] = inst;
      },
      unmountWrapper: function(inst) {
        delete instancesByReactID[inst._rootNodeID];
      },
      updateWrapper: function(inst) {
        var props = inst._currentElement.props;
        var checked = props.checked;
        if (checked != null) {
          ReactDOMIDOperations.updatePropertyByID(inst._rootNodeID, 'checked', checked || false);
        }
        var value = LinkedValueUtils.getValue(props);
        if (value != null) {
          ReactDOMIDOperations.updatePropertyByID(inst._rootNodeID, 'value', '' + value);
        }
      }
    };
    function _handleChange(event) {
      var props = this._currentElement.props;
      var returnValue = LinkedValueUtils.executeOnChange(props, event);
      ReactUpdates.asap(forceUpdateIfMounted, this);
      var name = props.name;
      if (props.type === 'radio' && name != null) {
        var rootNode = ReactMount.getNode(this._rootNodeID);
        var queryRoot = rootNode;
        while (queryRoot.parentNode) {
          queryRoot = queryRoot.parentNode;
        }
        var group = queryRoot.querySelectorAll('input[name=' + JSON.stringify('' + name) + '][type="radio"]');
        for (var i = 0; i < group.length; i++) {
          var otherNode = group[i];
          if (otherNode === rootNode || otherNode.form !== rootNode.form) {
            continue;
          }
          var otherID = ReactMount.getID(otherNode);
          !otherID ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactDOMInput: Mixing React and non-React radio inputs with the ' + 'same `name` is not supported.') : invariant(false) : undefined;
          var otherInstance = instancesByReactID[otherID];
          !otherInstance ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactDOMInput: Unknown radio button ID %s.', otherID) : invariant(false) : undefined;
          ReactUpdates.asap(forceUpdateIfMounted, otherInstance);
        }
      }
      return returnValue;
    }
    module.exports = ReactDOMInput;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("93", ["2a", "4f", "52", "8f", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactCurrentOwner = req('2a');
    var ReactElement = req('4f');
    var ReactInstanceHandles = req('52');
    var getIteratorFn = req('8f');
    var invariant = req('30');
    var warning = req('40');
    var SEPARATOR = ReactInstanceHandles.SEPARATOR;
    var SUBSEPARATOR = ':';
    var userProvidedKeyEscaperLookup = {
      '=': '=0',
      '.': '=1',
      ':': '=2'
    };
    var userProvidedKeyEscapeRegex = /[=.:]/g;
    var didWarnAboutMaps = false;
    function userProvidedKeyEscaper(match) {
      return userProvidedKeyEscaperLookup[match];
    }
    function getComponentKey(component, index) {
      if (component && component.key != null) {
        return wrapUserProvidedKey(component.key);
      }
      return index.toString(36);
    }
    function escapeUserProvidedKey(text) {
      return ('' + text).replace(userProvidedKeyEscapeRegex, userProvidedKeyEscaper);
    }
    function wrapUserProvidedKey(key) {
      return '$' + escapeUserProvidedKey(key);
    }
    function traverseAllChildrenImpl(children, nameSoFar, callback, traverseContext) {
      var type = typeof children;
      if (type === 'undefined' || type === 'boolean') {
        children = null;
      }
      if (children === null || type === 'string' || type === 'number' || ReactElement.isValidElement(children)) {
        callback(traverseContext, children, nameSoFar === '' ? SEPARATOR + getComponentKey(children, 0) : nameSoFar);
        return 1;
      }
      var child;
      var nextName;
      var subtreeCount = 0;
      var nextNamePrefix = nameSoFar === '' ? SEPARATOR : nameSoFar + SUBSEPARATOR;
      if (Array.isArray(children)) {
        for (var i = 0; i < children.length; i++) {
          child = children[i];
          nextName = nextNamePrefix + getComponentKey(child, i);
          subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
        }
      } else {
        var iteratorFn = getIteratorFn(children);
        if (iteratorFn) {
          var iterator = iteratorFn.call(children);
          var step;
          if (iteratorFn !== children.entries) {
            var ii = 0;
            while (!(step = iterator.next()).done) {
              child = step.value;
              nextName = nextNamePrefix + getComponentKey(child, ii++);
              subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
            }
          } else {
            if (process.env.NODE_ENV !== 'production') {
              process.env.NODE_ENV !== 'production' ? warning(didWarnAboutMaps, 'Using Maps as children is not yet fully supported. It is an ' + 'experimental feature that might be removed. Convert it to a ' + 'sequence / iterable of keyed ReactElements instead.') : undefined;
              didWarnAboutMaps = true;
            }
            while (!(step = iterator.next()).done) {
              var entry = step.value;
              if (entry) {
                child = entry[1];
                nextName = nextNamePrefix + wrapUserProvidedKey(entry[0]) + SUBSEPARATOR + getComponentKey(child, 0);
                subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
              }
            }
          }
        } else if (type === 'object') {
          var addendum = '';
          if (process.env.NODE_ENV !== 'production') {
            addendum = ' If you meant to render a collection of children, use an array ' + 'instead or wrap the object using createFragment(object) from the ' + 'React add-ons.';
            if (children._isReactElement) {
              addendum = ' It looks like you\'re using an element created by a different ' + 'version of React. Make sure to use only one copy of React.';
            }
            if (ReactCurrentOwner.current) {
              var name = ReactCurrentOwner.current.getName();
              if (name) {
                addendum += ' Check the render method of `' + name + '`.';
              }
            }
          }
          var childrenString = String(children);
          !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Objects are not valid as a React child (found: %s).%s', childrenString === '[object Object]' ? 'object with keys {' + Object.keys(children).join(', ') + '}' : childrenString, addendum) : invariant(false) : undefined;
        }
      }
      return subtreeCount;
    }
    function traverseAllChildren(children, callback, traverseContext) {
      if (children == null) {
        return 0;
      }
      return traverseAllChildrenImpl(children, '', callback, traverseContext);
    }
    module.exports = traverseAllChildren;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("94", ["59", "4f", "35", "93"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var PooledClass = req('59');
  var ReactElement = req('4f');
  var emptyFunction = req('35');
  var traverseAllChildren = req('93');
  var twoArgumentPooler = PooledClass.twoArgumentPooler;
  var fourArgumentPooler = PooledClass.fourArgumentPooler;
  var userProvidedKeyEscapeRegex = /\/(?!\/)/g;
  function escapeUserProvidedKey(text) {
    return ('' + text).replace(userProvidedKeyEscapeRegex, '//');
  }
  function ForEachBookKeeping(forEachFunction, forEachContext) {
    this.func = forEachFunction;
    this.context = forEachContext;
    this.count = 0;
  }
  ForEachBookKeeping.prototype.destructor = function() {
    this.func = null;
    this.context = null;
    this.count = 0;
  };
  PooledClass.addPoolingTo(ForEachBookKeeping, twoArgumentPooler);
  function forEachSingleChild(bookKeeping, child, name) {
    var func = bookKeeping.func;
    var context = bookKeeping.context;
    func.call(context, child, bookKeeping.count++);
  }
  function forEachChildren(children, forEachFunc, forEachContext) {
    if (children == null) {
      return children;
    }
    var traverseContext = ForEachBookKeeping.getPooled(forEachFunc, forEachContext);
    traverseAllChildren(children, forEachSingleChild, traverseContext);
    ForEachBookKeeping.release(traverseContext);
  }
  function MapBookKeeping(mapResult, keyPrefix, mapFunction, mapContext) {
    this.result = mapResult;
    this.keyPrefix = keyPrefix;
    this.func = mapFunction;
    this.context = mapContext;
    this.count = 0;
  }
  MapBookKeeping.prototype.destructor = function() {
    this.result = null;
    this.keyPrefix = null;
    this.func = null;
    this.context = null;
    this.count = 0;
  };
  PooledClass.addPoolingTo(MapBookKeeping, fourArgumentPooler);
  function mapSingleChildIntoContext(bookKeeping, child, childKey) {
    var result = bookKeeping.result;
    var keyPrefix = bookKeeping.keyPrefix;
    var func = bookKeeping.func;
    var context = bookKeeping.context;
    var mappedChild = func.call(context, child, bookKeeping.count++);
    if (Array.isArray(mappedChild)) {
      mapIntoWithKeyPrefixInternal(mappedChild, result, childKey, emptyFunction.thatReturnsArgument);
    } else if (mappedChild != null) {
      if (ReactElement.isValidElement(mappedChild)) {
        mappedChild = ReactElement.cloneAndReplaceKey(mappedChild, keyPrefix + (mappedChild !== child ? escapeUserProvidedKey(mappedChild.key || '') + '/' : '') + childKey);
      }
      result.push(mappedChild);
    }
  }
  function mapIntoWithKeyPrefixInternal(children, array, prefix, func, context) {
    var escapedPrefix = '';
    if (prefix != null) {
      escapedPrefix = escapeUserProvidedKey(prefix) + '/';
    }
    var traverseContext = MapBookKeeping.getPooled(array, escapedPrefix, func, context);
    traverseAllChildren(children, mapSingleChildIntoContext, traverseContext);
    MapBookKeeping.release(traverseContext);
  }
  function mapChildren(children, func, context) {
    if (children == null) {
      return children;
    }
    var result = [];
    mapIntoWithKeyPrefixInternal(children, result, null, func, context);
    return result;
  }
  function forEachSingleChildDummy(traverseContext, child, name) {
    return null;
  }
  function countChildren(children, context) {
    return traverseAllChildren(children, forEachSingleChildDummy, null);
  }
  function toArray(children) {
    var result = [];
    mapIntoWithKeyPrefixInternal(children, result, null, emptyFunction.thatReturnsArgument);
    return result;
  }
  var ReactChildren = {
    forEach: forEachChildren,
    map: mapChildren,
    mapIntoWithKeyPrefixInternal: mapIntoWithKeyPrefixInternal,
    count: countChildren,
    toArray: toArray
  };
  module.exports = ReactChildren;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("95", ["91", "6b", "5c", "4b", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var LinkedValueUtils = req('91');
    var ReactMount = req('6b');
    var ReactUpdates = req('5c');
    var assign = req('4b');
    var warning = req('40');
    var valueContextKey = '__ReactDOMSelect_value$' + Math.random().toString(36).slice(2);
    function updateOptionsIfPendingUpdateAndMounted() {
      if (this._rootNodeID && this._wrapperState.pendingUpdate) {
        this._wrapperState.pendingUpdate = false;
        var props = this._currentElement.props;
        var value = LinkedValueUtils.getValue(props);
        if (value != null) {
          updateOptions(this, props, value);
        }
      }
    }
    function getDeclarationErrorAddendum(owner) {
      if (owner) {
        var name = owner.getName();
        if (name) {
          return ' Check the render method of `' + name + '`.';
        }
      }
      return '';
    }
    var valuePropNames = ['value', 'defaultValue'];
    function checkSelectPropTypes(inst, props) {
      var owner = inst._currentElement._owner;
      LinkedValueUtils.checkPropTypes('select', props, owner);
      for (var i = 0; i < valuePropNames.length; i++) {
        var propName = valuePropNames[i];
        if (props[propName] == null) {
          continue;
        }
        if (props.multiple) {
          process.env.NODE_ENV !== 'production' ? warning(Array.isArray(props[propName]), 'The `%s` prop supplied to <select> must be an array if ' + '`multiple` is true.%s', propName, getDeclarationErrorAddendum(owner)) : undefined;
        } else {
          process.env.NODE_ENV !== 'production' ? warning(!Array.isArray(props[propName]), 'The `%s` prop supplied to <select> must be a scalar ' + 'value if `multiple` is false.%s', propName, getDeclarationErrorAddendum(owner)) : undefined;
        }
      }
    }
    function updateOptions(inst, multiple, propValue) {
      var selectedValue,
          i;
      var options = ReactMount.getNode(inst._rootNodeID).options;
      if (multiple) {
        selectedValue = {};
        for (i = 0; i < propValue.length; i++) {
          selectedValue['' + propValue[i]] = true;
        }
        for (i = 0; i < options.length; i++) {
          var selected = selectedValue.hasOwnProperty(options[i].value);
          if (options[i].selected !== selected) {
            options[i].selected = selected;
          }
        }
      } else {
        selectedValue = '' + propValue;
        for (i = 0; i < options.length; i++) {
          if (options[i].value === selectedValue) {
            options[i].selected = true;
            return;
          }
        }
        if (options.length) {
          options[0].selected = true;
        }
      }
    }
    var ReactDOMSelect = {
      valueContextKey: valueContextKey,
      getNativeProps: function(inst, props, context) {
        return assign({}, props, {
          onChange: inst._wrapperState.onChange,
          value: undefined
        });
      },
      mountWrapper: function(inst, props) {
        if (process.env.NODE_ENV !== 'production') {
          checkSelectPropTypes(inst, props);
        }
        var value = LinkedValueUtils.getValue(props);
        inst._wrapperState = {
          pendingUpdate: false,
          initialValue: value != null ? value : props.defaultValue,
          onChange: _handleChange.bind(inst),
          wasMultiple: Boolean(props.multiple)
        };
      },
      processChildContext: function(inst, props, context) {
        var childContext = assign({}, context);
        childContext[valueContextKey] = inst._wrapperState.initialValue;
        return childContext;
      },
      postUpdateWrapper: function(inst) {
        var props = inst._currentElement.props;
        inst._wrapperState.initialValue = undefined;
        var wasMultiple = inst._wrapperState.wasMultiple;
        inst._wrapperState.wasMultiple = Boolean(props.multiple);
        var value = LinkedValueUtils.getValue(props);
        if (value != null) {
          inst._wrapperState.pendingUpdate = false;
          updateOptions(inst, Boolean(props.multiple), value);
        } else if (wasMultiple !== Boolean(props.multiple)) {
          if (props.defaultValue != null) {
            updateOptions(inst, Boolean(props.multiple), props.defaultValue);
          } else {
            updateOptions(inst, Boolean(props.multiple), props.multiple ? [] : '');
          }
        }
      }
    };
    function _handleChange(event) {
      var props = this._currentElement.props;
      var returnValue = LinkedValueUtils.executeOnChange(props, event);
      this._wrapperState.pendingUpdate = true;
      ReactUpdates.asap(updateOptionsIfPendingUpdateAndMounted, this);
      return returnValue;
    }
    module.exports = ReactDOMSelect;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("96", ["94", "95", "4b", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactChildren = req('94');
    var ReactDOMSelect = req('95');
    var assign = req('4b');
    var warning = req('40');
    var valueContextKey = ReactDOMSelect.valueContextKey;
    var ReactDOMOption = {
      mountWrapper: function(inst, props, context) {
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(props.selected == null, 'Use the `defaultValue` or `value` props on <select> instead of ' + 'setting `selected` on <option>.') : undefined;
        }
        var selectValue = context[valueContextKey];
        var selected = null;
        if (selectValue != null) {
          selected = false;
          if (Array.isArray(selectValue)) {
            for (var i = 0; i < selectValue.length; i++) {
              if ('' + selectValue[i] === '' + props.value) {
                selected = true;
                break;
              }
            }
          } else {
            selected = '' + selectValue === '' + props.value;
          }
        }
        inst._wrapperState = {selected: selected};
      },
      getNativeProps: function(inst, props, context) {
        var nativeProps = assign({
          selected: undefined,
          children: undefined
        }, props);
        if (inst._wrapperState.selected != null) {
          nativeProps.selected = inst._wrapperState.selected;
        }
        var content = '';
        ReactChildren.forEach(props.children, function(child) {
          if (child == null) {
            return;
          }
          if (typeof child === 'string' || typeof child === 'number') {
            content += child;
          } else {
            process.env.NODE_ENV !== 'production' ? warning(false, 'Only strings and numbers are supported as <option> children.') : undefined;
          }
        });
        nativeProps.children = content;
        return nativeProps;
      }
    };
    module.exports = ReactDOMOption;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("97", ["91", "6c", "5c", "4b", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var LinkedValueUtils = req('91');
    var ReactDOMIDOperations = req('6c');
    var ReactUpdates = req('5c');
    var assign = req('4b');
    var invariant = req('30');
    var warning = req('40');
    function forceUpdateIfMounted() {
      if (this._rootNodeID) {
        ReactDOMTextarea.updateWrapper(this);
      }
    }
    var ReactDOMTextarea = {
      getNativeProps: function(inst, props, context) {
        !(props.dangerouslySetInnerHTML == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, '`dangerouslySetInnerHTML` does not make sense on <textarea>.') : invariant(false) : undefined;
        var nativeProps = assign({}, props, {
          defaultValue: undefined,
          value: undefined,
          children: inst._wrapperState.initialValue,
          onChange: inst._wrapperState.onChange
        });
        return nativeProps;
      },
      mountWrapper: function(inst, props) {
        if (process.env.NODE_ENV !== 'production') {
          LinkedValueUtils.checkPropTypes('textarea', props, inst._currentElement._owner);
        }
        var defaultValue = props.defaultValue;
        var children = props.children;
        if (children != null) {
          if (process.env.NODE_ENV !== 'production') {
            process.env.NODE_ENV !== 'production' ? warning(false, 'Use the `defaultValue` or `value` props instead of setting ' + 'children on <textarea>.') : undefined;
          }
          !(defaultValue == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'If you supply `defaultValue` on a <textarea>, do not pass children.') : invariant(false) : undefined;
          if (Array.isArray(children)) {
            !(children.length <= 1) ? process.env.NODE_ENV !== 'production' ? invariant(false, '<textarea> can only have at most one child.') : invariant(false) : undefined;
            children = children[0];
          }
          defaultValue = '' + children;
        }
        if (defaultValue == null) {
          defaultValue = '';
        }
        var value = LinkedValueUtils.getValue(props);
        inst._wrapperState = {
          initialValue: '' + (value != null ? value : defaultValue),
          onChange: _handleChange.bind(inst)
        };
      },
      updateWrapper: function(inst) {
        var props = inst._currentElement.props;
        var value = LinkedValueUtils.getValue(props);
        if (value != null) {
          ReactDOMIDOperations.updatePropertyByID(inst._rootNodeID, 'value', '' + value);
        }
      }
    };
    function _handleChange(event) {
      var props = this._currentElement.props;
      var returnValue = LinkedValueUtils.executeOnChange(props, event);
      ReactUpdates.asap(forceUpdateIfMounted, this);
      return returnValue;
    }
    module.exports = ReactDOMTextarea;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("98", ["58", "69", "65", "93", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactReconciler = req('58');
    var instantiateReactComponent = req('69');
    var shouldUpdateReactComponent = req('65');
    var traverseAllChildren = req('93');
    var warning = req('40');
    function instantiateChild(childInstances, child, name) {
      var keyUnique = childInstances[name] === undefined;
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(keyUnique, 'flattenChildren(...): Encountered two children with the same key, ' + '`%s`. Child keys must be unique; when two children share a key, only ' + 'the first child will be used.', name) : undefined;
      }
      if (child != null && keyUnique) {
        childInstances[name] = instantiateReactComponent(child, null);
      }
    }
    var ReactChildReconciler = {
      instantiateChildren: function(nestedChildNodes, transaction, context) {
        if (nestedChildNodes == null) {
          return null;
        }
        var childInstances = {};
        traverseAllChildren(nestedChildNodes, instantiateChild, childInstances);
        return childInstances;
      },
      updateChildren: function(prevChildren, nextChildren, transaction, context) {
        if (!nextChildren && !prevChildren) {
          return null;
        }
        var name;
        for (name in nextChildren) {
          if (!nextChildren.hasOwnProperty(name)) {
            continue;
          }
          var prevChild = prevChildren && prevChildren[name];
          var prevElement = prevChild && prevChild._currentElement;
          var nextElement = nextChildren[name];
          if (prevChild != null && shouldUpdateReactComponent(prevElement, nextElement)) {
            ReactReconciler.receiveComponent(prevChild, nextElement, transaction, context);
            nextChildren[name] = prevChild;
          } else {
            if (prevChild) {
              ReactReconciler.unmountComponent(prevChild, name);
            }
            var nextChildInstance = instantiateReactComponent(nextElement, null);
            nextChildren[name] = nextChildInstance;
          }
        }
        for (name in prevChildren) {
          if (prevChildren.hasOwnProperty(name) && !(nextChildren && nextChildren.hasOwnProperty(name))) {
            ReactReconciler.unmountComponent(prevChildren[name]);
          }
        }
        return nextChildren;
      },
      unmountChildren: function(renderedChildren) {
        for (var name in renderedChildren) {
          if (renderedChildren.hasOwnProperty(name)) {
            var renderedChild = renderedChildren[name];
            ReactReconciler.unmountComponent(renderedChild);
          }
        }
      }
    };
    module.exports = ReactChildReconciler;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("99", ["93", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var traverseAllChildren = req('93');
    var warning = req('40');
    function flattenSingleChildIntoContext(traverseContext, child, name) {
      var result = traverseContext;
      var keyUnique = result[name] === undefined;
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(keyUnique, 'flattenChildren(...): Encountered two children with the same key, ' + '`%s`. Child keys must be unique; when two children share a key, only ' + 'the first child will be used.', name) : undefined;
      }
      if (keyUnique && child != null) {
        result[name] = child;
      }
    }
    function flattenChildren(children) {
      if (children == null) {
        return children;
      }
      var result = {};
      traverseAllChildren(children, flattenSingleChildIntoContext, result);
      return result;
    }
    module.exports = flattenChildren;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("9a", ["62", "38", "2a", "58", "98", "99", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactComponentEnvironment = req('62');
    var ReactMultiChildUpdateTypes = req('38');
    var ReactCurrentOwner = req('2a');
    var ReactReconciler = req('58');
    var ReactChildReconciler = req('98');
    var flattenChildren = req('99');
    var updateDepth = 0;
    var updateQueue = [];
    var markupQueue = [];
    function enqueueInsertMarkup(parentID, markup, toIndex) {
      updateQueue.push({
        parentID: parentID,
        parentNode: null,
        type: ReactMultiChildUpdateTypes.INSERT_MARKUP,
        markupIndex: markupQueue.push(markup) - 1,
        content: null,
        fromIndex: null,
        toIndex: toIndex
      });
    }
    function enqueueMove(parentID, fromIndex, toIndex) {
      updateQueue.push({
        parentID: parentID,
        parentNode: null,
        type: ReactMultiChildUpdateTypes.MOVE_EXISTING,
        markupIndex: null,
        content: null,
        fromIndex: fromIndex,
        toIndex: toIndex
      });
    }
    function enqueueRemove(parentID, fromIndex) {
      updateQueue.push({
        parentID: parentID,
        parentNode: null,
        type: ReactMultiChildUpdateTypes.REMOVE_NODE,
        markupIndex: null,
        content: null,
        fromIndex: fromIndex,
        toIndex: null
      });
    }
    function enqueueSetMarkup(parentID, markup) {
      updateQueue.push({
        parentID: parentID,
        parentNode: null,
        type: ReactMultiChildUpdateTypes.SET_MARKUP,
        markupIndex: null,
        content: markup,
        fromIndex: null,
        toIndex: null
      });
    }
    function enqueueTextContent(parentID, textContent) {
      updateQueue.push({
        parentID: parentID,
        parentNode: null,
        type: ReactMultiChildUpdateTypes.TEXT_CONTENT,
        markupIndex: null,
        content: textContent,
        fromIndex: null,
        toIndex: null
      });
    }
    function processQueue() {
      if (updateQueue.length) {
        ReactComponentEnvironment.processChildrenUpdates(updateQueue, markupQueue);
        clearQueue();
      }
    }
    function clearQueue() {
      updateQueue.length = 0;
      markupQueue.length = 0;
    }
    var ReactMultiChild = {Mixin: {
        _reconcilerInstantiateChildren: function(nestedChildren, transaction, context) {
          if (process.env.NODE_ENV !== 'production') {
            if (this._currentElement) {
              try {
                ReactCurrentOwner.current = this._currentElement._owner;
                return ReactChildReconciler.instantiateChildren(nestedChildren, transaction, context);
              } finally {
                ReactCurrentOwner.current = null;
              }
            }
          }
          return ReactChildReconciler.instantiateChildren(nestedChildren, transaction, context);
        },
        _reconcilerUpdateChildren: function(prevChildren, nextNestedChildrenElements, transaction, context) {
          var nextChildren;
          if (process.env.NODE_ENV !== 'production') {
            if (this._currentElement) {
              try {
                ReactCurrentOwner.current = this._currentElement._owner;
                nextChildren = flattenChildren(nextNestedChildrenElements);
              } finally {
                ReactCurrentOwner.current = null;
              }
              return ReactChildReconciler.updateChildren(prevChildren, nextChildren, transaction, context);
            }
          }
          nextChildren = flattenChildren(nextNestedChildrenElements);
          return ReactChildReconciler.updateChildren(prevChildren, nextChildren, transaction, context);
        },
        mountChildren: function(nestedChildren, transaction, context) {
          var children = this._reconcilerInstantiateChildren(nestedChildren, transaction, context);
          this._renderedChildren = children;
          var mountImages = [];
          var index = 0;
          for (var name in children) {
            if (children.hasOwnProperty(name)) {
              var child = children[name];
              var rootID = this._rootNodeID + name;
              var mountImage = ReactReconciler.mountComponent(child, rootID, transaction, context);
              child._mountIndex = index++;
              mountImages.push(mountImage);
            }
          }
          return mountImages;
        },
        updateTextContent: function(nextContent) {
          updateDepth++;
          var errorThrown = true;
          try {
            var prevChildren = this._renderedChildren;
            ReactChildReconciler.unmountChildren(prevChildren);
            for (var name in prevChildren) {
              if (prevChildren.hasOwnProperty(name)) {
                this._unmountChild(prevChildren[name]);
              }
            }
            this.setTextContent(nextContent);
            errorThrown = false;
          } finally {
            updateDepth--;
            if (!updateDepth) {
              if (errorThrown) {
                clearQueue();
              } else {
                processQueue();
              }
            }
          }
        },
        updateMarkup: function(nextMarkup) {
          updateDepth++;
          var errorThrown = true;
          try {
            var prevChildren = this._renderedChildren;
            ReactChildReconciler.unmountChildren(prevChildren);
            for (var name in prevChildren) {
              if (prevChildren.hasOwnProperty(name)) {
                this._unmountChildByName(prevChildren[name], name);
              }
            }
            this.setMarkup(nextMarkup);
            errorThrown = false;
          } finally {
            updateDepth--;
            if (!updateDepth) {
              if (errorThrown) {
                clearQueue();
              } else {
                processQueue();
              }
            }
          }
        },
        updateChildren: function(nextNestedChildrenElements, transaction, context) {
          updateDepth++;
          var errorThrown = true;
          try {
            this._updateChildren(nextNestedChildrenElements, transaction, context);
            errorThrown = false;
          } finally {
            updateDepth--;
            if (!updateDepth) {
              if (errorThrown) {
                clearQueue();
              } else {
                processQueue();
              }
            }
          }
        },
        _updateChildren: function(nextNestedChildrenElements, transaction, context) {
          var prevChildren = this._renderedChildren;
          var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, transaction, context);
          this._renderedChildren = nextChildren;
          if (!nextChildren && !prevChildren) {
            return;
          }
          var name;
          var lastIndex = 0;
          var nextIndex = 0;
          for (name in nextChildren) {
            if (!nextChildren.hasOwnProperty(name)) {
              continue;
            }
            var prevChild = prevChildren && prevChildren[name];
            var nextChild = nextChildren[name];
            if (prevChild === nextChild) {
              this.moveChild(prevChild, nextIndex, lastIndex);
              lastIndex = Math.max(prevChild._mountIndex, lastIndex);
              prevChild._mountIndex = nextIndex;
            } else {
              if (prevChild) {
                lastIndex = Math.max(prevChild._mountIndex, lastIndex);
                this._unmountChild(prevChild);
              }
              this._mountChildByNameAtIndex(nextChild, name, nextIndex, transaction, context);
            }
            nextIndex++;
          }
          for (name in prevChildren) {
            if (prevChildren.hasOwnProperty(name) && !(nextChildren && nextChildren.hasOwnProperty(name))) {
              this._unmountChild(prevChildren[name]);
            }
          }
        },
        unmountChildren: function() {
          var renderedChildren = this._renderedChildren;
          ReactChildReconciler.unmountChildren(renderedChildren);
          this._renderedChildren = null;
        },
        moveChild: function(child, toIndex, lastIndex) {
          if (child._mountIndex < lastIndex) {
            enqueueMove(this._rootNodeID, child._mountIndex, toIndex);
          }
        },
        createChild: function(child, mountImage) {
          enqueueInsertMarkup(this._rootNodeID, mountImage, child._mountIndex);
        },
        removeChild: function(child) {
          enqueueRemove(this._rootNodeID, child._mountIndex);
        },
        setTextContent: function(textContent) {
          enqueueTextContent(this._rootNodeID, textContent);
        },
        setMarkup: function(markup) {
          enqueueSetMarkup(this._rootNodeID, markup);
        },
        _mountChildByNameAtIndex: function(child, name, index, transaction, context) {
          var rootID = this._rootNodeID + name;
          var mountImage = ReactReconciler.mountComponent(child, rootID, transaction, context);
          child._mountIndex = index;
          this.createChild(child, mountImage);
        },
        _unmountChild: function(child) {
          this.removeChild(child);
          child._mountIndex = null;
        }
      }};
    module.exports = ReactMultiChild;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("9b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  function shallowEqual(objA, objB) {
    if (objA === objB) {
      return true;
    }
    if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
      return false;
    }
    var keysA = Object.keys(objA);
    var keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) {
      return false;
    }
    var bHasOwnProperty = hasOwnProperty.bind(objB);
    for (var i = 0; i < keysA.length; i++) {
      if (!bHasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
        return false;
      }
    }
    return true;
  }
  module.exports = shallowEqual;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("9c", ["85", "8d", "3e", "41", "42", "4d", "6d", "8e", "92", "96", "95", "97", "6b", "9a", "39", "5d", "4b", "3b", "30", "4c", "75", "3a", "3c", "9b", "6a", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var AutoFocusUtils = req('85');
    var CSSPropertyOperations = req('8d');
    var DOMProperty = req('3e');
    var DOMPropertyOperations = req('41');
    var EventConstants = req('42');
    var ReactBrowserEventEmitter = req('4d');
    var ReactComponentBrowserEnvironment = req('6d');
    var ReactDOMButton = req('8e');
    var ReactDOMInput = req('92');
    var ReactDOMOption = req('96');
    var ReactDOMSelect = req('95');
    var ReactDOMTextarea = req('97');
    var ReactMount = req('6b');
    var ReactMultiChild = req('9a');
    var ReactPerf = req('39');
    var ReactUpdateQueue = req('5d');
    var assign = req('4b');
    var escapeTextContentForBrowser = req('3b');
    var invariant = req('30');
    var isEventSupported = req('4c');
    var keyOf = req('75');
    var setInnerHTML = req('3a');
    var setTextContent = req('3c');
    var shallowEqual = req('9b');
    var validateDOMNesting = req('6a');
    var warning = req('40');
    var deleteListener = ReactBrowserEventEmitter.deleteListener;
    var listenTo = ReactBrowserEventEmitter.listenTo;
    var registrationNameModules = ReactBrowserEventEmitter.registrationNameModules;
    var CONTENT_TYPES = {
      'string': true,
      'number': true
    };
    var STYLE = keyOf({style: null});
    var ELEMENT_NODE_TYPE = 1;
    var canDefineProperty = false;
    try {
      Object.defineProperty({}, 'test', {get: function() {}});
      canDefineProperty = true;
    } catch (e) {}
    function getDeclarationErrorAddendum(internalInstance) {
      if (internalInstance) {
        var owner = internalInstance._currentElement._owner || null;
        if (owner) {
          var name = owner.getName();
          if (name) {
            return ' This DOM node was rendered by `' + name + '`.';
          }
        }
      }
      return '';
    }
    var legacyPropsDescriptor;
    if (process.env.NODE_ENV !== 'production') {
      legacyPropsDescriptor = {props: {
          enumerable: false,
          get: function() {
            var component = this._reactInternalComponent;
            process.env.NODE_ENV !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .props of a DOM node; instead, ' + 'recreate the props as `render` did originally or read the DOM ' + 'properties/attributes directly from this node (e.g., ' + 'this.refs.box.className).%s', getDeclarationErrorAddendum(component)) : undefined;
            return component._currentElement.props;
          }
        }};
    }
    function legacyGetDOMNode() {
      if (process.env.NODE_ENV !== 'production') {
        var component = this._reactInternalComponent;
        process.env.NODE_ENV !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .getDOMNode() of a DOM node; ' + 'instead, use the node directly.%s', getDeclarationErrorAddendum(component)) : undefined;
      }
      return this;
    }
    function legacyIsMounted() {
      var component = this._reactInternalComponent;
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .isMounted() of a DOM node.%s', getDeclarationErrorAddendum(component)) : undefined;
      }
      return !!component;
    }
    function legacySetStateEtc() {
      if (process.env.NODE_ENV !== 'production') {
        var component = this._reactInternalComponent;
        process.env.NODE_ENV !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .setState(), .replaceState(), or ' + '.forceUpdate() of a DOM node. This is a no-op.%s', getDeclarationErrorAddendum(component)) : undefined;
      }
    }
    function legacySetProps(partialProps, callback) {
      var component = this._reactInternalComponent;
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .setProps() of a DOM node. ' + 'Instead, call ReactDOM.render again at the top level.%s', getDeclarationErrorAddendum(component)) : undefined;
      }
      if (!component) {
        return;
      }
      ReactUpdateQueue.enqueueSetPropsInternal(component, partialProps);
      if (callback) {
        ReactUpdateQueue.enqueueCallbackInternal(component, callback);
      }
    }
    function legacyReplaceProps(partialProps, callback) {
      var component = this._reactInternalComponent;
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(false, 'ReactDOMComponent: Do not access .replaceProps() of a DOM node. ' + 'Instead, call ReactDOM.render again at the top level.%s', getDeclarationErrorAddendum(component)) : undefined;
      }
      if (!component) {
        return;
      }
      ReactUpdateQueue.enqueueReplacePropsInternal(component, partialProps);
      if (callback) {
        ReactUpdateQueue.enqueueCallbackInternal(component, callback);
      }
    }
    function friendlyStringify(obj) {
      if (typeof obj === 'object') {
        if (Array.isArray(obj)) {
          return '[' + obj.map(friendlyStringify).join(', ') + ']';
        } else {
          var pairs = [];
          for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              var keyEscaped = /^[a-z$_][\w$_]*$/i.test(key) ? key : JSON.stringify(key);
              pairs.push(keyEscaped + ': ' + friendlyStringify(obj[key]));
            }
          }
          return '{' + pairs.join(', ') + '}';
        }
      } else if (typeof obj === 'string') {
        return JSON.stringify(obj);
      } else if (typeof obj === 'function') {
        return '[function object]';
      }
      return String(obj);
    }
    var styleMutationWarning = {};
    function checkAndWarnForMutatedStyle(style1, style2, component) {
      if (style1 == null || style2 == null) {
        return;
      }
      if (shallowEqual(style1, style2)) {
        return;
      }
      var componentName = component._tag;
      var owner = component._currentElement._owner;
      var ownerName;
      if (owner) {
        ownerName = owner.getName();
      }
      var hash = ownerName + '|' + componentName;
      if (styleMutationWarning.hasOwnProperty(hash)) {
        return;
      }
      styleMutationWarning[hash] = true;
      process.env.NODE_ENV !== 'production' ? warning(false, '`%s` was passed a style object that has previously been mutated. ' + 'Mutating `style` is deprecated. Consider cloning it beforehand. Check ' + 'the `render` %s. Previous style: %s. Mutated style: %s.', componentName, owner ? 'of `' + ownerName + '`' : 'using <' + componentName + '>', friendlyStringify(style1), friendlyStringify(style2)) : undefined;
    }
    function assertValidProps(component, props) {
      if (!props) {
        return;
      }
      if (process.env.NODE_ENV !== 'production') {
        if (voidElementTags[component._tag]) {
          process.env.NODE_ENV !== 'production' ? warning(props.children == null && props.dangerouslySetInnerHTML == null, '%s is a void element tag and must not have `children` or ' + 'use `props.dangerouslySetInnerHTML`.%s', component._tag, component._currentElement._owner ? ' Check the render method of ' + component._currentElement._owner.getName() + '.' : '') : undefined;
        }
      }
      if (props.dangerouslySetInnerHTML != null) {
        !(props.children == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Can only set one of `children` or `props.dangerouslySetInnerHTML`.') : invariant(false) : undefined;
        !(typeof props.dangerouslySetInnerHTML === 'object' && '__html' in props.dangerouslySetInnerHTML) ? process.env.NODE_ENV !== 'production' ? invariant(false, '`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. ' + 'Please visit https://fb.me/react-invariant-dangerously-set-inner-html ' + 'for more information.') : invariant(false) : undefined;
      }
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(props.innerHTML == null, 'Directly setting property `innerHTML` is not permitted. ' + 'For more information, lookup documentation on `dangerouslySetInnerHTML`.') : undefined;
        process.env.NODE_ENV !== 'production' ? warning(!props.contentEditable || props.children == null, 'A component is `contentEditable` and contains `children` managed by ' + 'React. It is now your responsibility to guarantee that none of ' + 'those nodes are unexpectedly modified or duplicated. This is ' + 'probably not intentional.') : undefined;
      }
      !(props.style == null || typeof props.style === 'object') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'The `style` prop expects a mapping from style properties to values, ' + 'not a string. For example, style={{marginRight: spacing + \'em\'}} when ' + 'using JSX.%s', getDeclarationErrorAddendum(component)) : invariant(false) : undefined;
    }
    function enqueuePutListener(id, registrationName, listener, transaction) {
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(registrationName !== 'onScroll' || isEventSupported('scroll', true), 'This browser doesn\'t support the `onScroll` event') : undefined;
      }
      var container = ReactMount.findReactContainerForID(id);
      if (container) {
        var doc = container.nodeType === ELEMENT_NODE_TYPE ? container.ownerDocument : container;
        listenTo(registrationName, doc);
      }
      transaction.getReactMountReady().enqueue(putListener, {
        id: id,
        registrationName: registrationName,
        listener: listener
      });
    }
    function putListener() {
      var listenerToPut = this;
      ReactBrowserEventEmitter.putListener(listenerToPut.id, listenerToPut.registrationName, listenerToPut.listener);
    }
    var mediaEvents = {
      topAbort: 'abort',
      topCanPlay: 'canplay',
      topCanPlayThrough: 'canplaythrough',
      topDurationChange: 'durationchange',
      topEmptied: 'emptied',
      topEncrypted: 'encrypted',
      topEnded: 'ended',
      topError: 'error',
      topLoadedData: 'loadeddata',
      topLoadedMetadata: 'loadedmetadata',
      topLoadStart: 'loadstart',
      topPause: 'pause',
      topPlay: 'play',
      topPlaying: 'playing',
      topProgress: 'progress',
      topRateChange: 'ratechange',
      topSeeked: 'seeked',
      topSeeking: 'seeking',
      topStalled: 'stalled',
      topSuspend: 'suspend',
      topTimeUpdate: 'timeupdate',
      topVolumeChange: 'volumechange',
      topWaiting: 'waiting'
    };
    function trapBubbledEventsLocal() {
      var inst = this;
      !inst._rootNodeID ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Must be mounted to trap events') : invariant(false) : undefined;
      var node = ReactMount.getNode(inst._rootNodeID);
      !node ? process.env.NODE_ENV !== 'production' ? invariant(false, 'trapBubbledEvent(...): Requires node to be rendered.') : invariant(false) : undefined;
      switch (inst._tag) {
        case 'iframe':
          inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topLoad, 'load', node)];
          break;
        case 'video':
        case 'audio':
          inst._wrapperState.listeners = [];
          for (var event in mediaEvents) {
            if (mediaEvents.hasOwnProperty(event)) {
              inst._wrapperState.listeners.push(ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes[event], mediaEvents[event], node));
            }
          }
          break;
        case 'img':
          inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topError, 'error', node), ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topLoad, 'load', node)];
          break;
        case 'form':
          inst._wrapperState.listeners = [ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topReset, 'reset', node), ReactBrowserEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topSubmit, 'submit', node)];
          break;
      }
    }
    function mountReadyInputWrapper() {
      ReactDOMInput.mountReadyWrapper(this);
    }
    function postUpdateSelectWrapper() {
      ReactDOMSelect.postUpdateWrapper(this);
    }
    var omittedCloseTags = {
      'area': true,
      'base': true,
      'br': true,
      'col': true,
      'embed': true,
      'hr': true,
      'img': true,
      'input': true,
      'keygen': true,
      'link': true,
      'meta': true,
      'param': true,
      'source': true,
      'track': true,
      'wbr': true
    };
    var newlineEatingTags = {
      'listing': true,
      'pre': true,
      'textarea': true
    };
    var voidElementTags = assign({'menuitem': true}, omittedCloseTags);
    var VALID_TAG_REGEX = /^[a-zA-Z][a-zA-Z:_\.\-\d]*$/;
    var validatedTagCache = {};
    var hasOwnProperty = ({}).hasOwnProperty;
    function validateDangerousTag(tag) {
      if (!hasOwnProperty.call(validatedTagCache, tag)) {
        !VALID_TAG_REGEX.test(tag) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Invalid tag: %s', tag) : invariant(false) : undefined;
        validatedTagCache[tag] = true;
      }
    }
    function processChildContextDev(context, inst) {
      context = assign({}, context);
      var info = context[validateDOMNesting.ancestorInfoContextKey];
      context[validateDOMNesting.ancestorInfoContextKey] = validateDOMNesting.updatedAncestorInfo(info, inst._tag, inst);
      return context;
    }
    function isCustomComponent(tagName, props) {
      return tagName.indexOf('-') >= 0 || props.is != null;
    }
    function ReactDOMComponent(tag) {
      validateDangerousTag(tag);
      this._tag = tag.toLowerCase();
      this._renderedChildren = null;
      this._previousStyle = null;
      this._previousStyleCopy = null;
      this._rootNodeID = null;
      this._wrapperState = null;
      this._topLevelWrapper = null;
      this._nodeWithLegacyProperties = null;
      if (process.env.NODE_ENV !== 'production') {
        this._unprocessedContextDev = null;
        this._processedContextDev = null;
      }
    }
    ReactDOMComponent.displayName = 'ReactDOMComponent';
    ReactDOMComponent.Mixin = {
      construct: function(element) {
        this._currentElement = element;
      },
      mountComponent: function(rootID, transaction, context) {
        this._rootNodeID = rootID;
        var props = this._currentElement.props;
        switch (this._tag) {
          case 'iframe':
          case 'img':
          case 'form':
          case 'video':
          case 'audio':
            this._wrapperState = {listeners: null};
            transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
            break;
          case 'button':
            props = ReactDOMButton.getNativeProps(this, props, context);
            break;
          case 'input':
            ReactDOMInput.mountWrapper(this, props, context);
            props = ReactDOMInput.getNativeProps(this, props, context);
            break;
          case 'option':
            ReactDOMOption.mountWrapper(this, props, context);
            props = ReactDOMOption.getNativeProps(this, props, context);
            break;
          case 'select':
            ReactDOMSelect.mountWrapper(this, props, context);
            props = ReactDOMSelect.getNativeProps(this, props, context);
            context = ReactDOMSelect.processChildContext(this, props, context);
            break;
          case 'textarea':
            ReactDOMTextarea.mountWrapper(this, props, context);
            props = ReactDOMTextarea.getNativeProps(this, props, context);
            break;
        }
        assertValidProps(this, props);
        if (process.env.NODE_ENV !== 'production') {
          if (context[validateDOMNesting.ancestorInfoContextKey]) {
            validateDOMNesting(this._tag, this, context[validateDOMNesting.ancestorInfoContextKey]);
          }
        }
        if (process.env.NODE_ENV !== 'production') {
          this._unprocessedContextDev = context;
          this._processedContextDev = processChildContextDev(context, this);
          context = this._processedContextDev;
        }
        var mountImage;
        if (transaction.useCreateElement) {
          var ownerDocument = context[ReactMount.ownerDocumentContextKey];
          var el = ownerDocument.createElement(this._currentElement.type);
          DOMPropertyOperations.setAttributeForID(el, this._rootNodeID);
          ReactMount.getID(el);
          this._updateDOMProperties({}, props, transaction, el);
          this._createInitialChildren(transaction, props, context, el);
          mountImage = el;
        } else {
          var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);
          var tagContent = this._createContentMarkup(transaction, props, context);
          if (!tagContent && omittedCloseTags[this._tag]) {
            mountImage = tagOpen + '/>';
          } else {
            mountImage = tagOpen + '>' + tagContent + '</' + this._currentElement.type + '>';
          }
        }
        switch (this._tag) {
          case 'input':
            transaction.getReactMountReady().enqueue(mountReadyInputWrapper, this);
          case 'button':
          case 'select':
          case 'textarea':
            if (props.autoFocus) {
              transaction.getReactMountReady().enqueue(AutoFocusUtils.focusDOMComponent, this);
            }
            break;
        }
        return mountImage;
      },
      _createOpenTagMarkupAndPutListeners: function(transaction, props) {
        var ret = '<' + this._currentElement.type;
        for (var propKey in props) {
          if (!props.hasOwnProperty(propKey)) {
            continue;
          }
          var propValue = props[propKey];
          if (propValue == null) {
            continue;
          }
          if (registrationNameModules.hasOwnProperty(propKey)) {
            if (propValue) {
              enqueuePutListener(this._rootNodeID, propKey, propValue, transaction);
            }
          } else {
            if (propKey === STYLE) {
              if (propValue) {
                if (process.env.NODE_ENV !== 'production') {
                  this._previousStyle = propValue;
                }
                propValue = this._previousStyleCopy = assign({}, props.style);
              }
              propValue = CSSPropertyOperations.createMarkupForStyles(propValue);
            }
            var markup = null;
            if (this._tag != null && isCustomComponent(this._tag, props)) {
              markup = DOMPropertyOperations.createMarkupForCustomAttribute(propKey, propValue);
            } else {
              markup = DOMPropertyOperations.createMarkupForProperty(propKey, propValue);
            }
            if (markup) {
              ret += ' ' + markup;
            }
          }
        }
        if (transaction.renderToStaticMarkup) {
          return ret;
        }
        var markupForID = DOMPropertyOperations.createMarkupForID(this._rootNodeID);
        return ret + ' ' + markupForID;
      },
      _createContentMarkup: function(transaction, props, context) {
        var ret = '';
        var innerHTML = props.dangerouslySetInnerHTML;
        if (innerHTML != null) {
          if (innerHTML.__html != null) {
            ret = innerHTML.__html;
          }
        } else {
          var contentToUse = CONTENT_TYPES[typeof props.children] ? props.children : null;
          var childrenToUse = contentToUse != null ? null : props.children;
          if (contentToUse != null) {
            ret = escapeTextContentForBrowser(contentToUse);
          } else if (childrenToUse != null) {
            var mountImages = this.mountChildren(childrenToUse, transaction, context);
            ret = mountImages.join('');
          }
        }
        if (newlineEatingTags[this._tag] && ret.charAt(0) === '\n') {
          return '\n' + ret;
        } else {
          return ret;
        }
      },
      _createInitialChildren: function(transaction, props, context, el) {
        var innerHTML = props.dangerouslySetInnerHTML;
        if (innerHTML != null) {
          if (innerHTML.__html != null) {
            setInnerHTML(el, innerHTML.__html);
          }
        } else {
          var contentToUse = CONTENT_TYPES[typeof props.children] ? props.children : null;
          var childrenToUse = contentToUse != null ? null : props.children;
          if (contentToUse != null) {
            setTextContent(el, contentToUse);
          } else if (childrenToUse != null) {
            var mountImages = this.mountChildren(childrenToUse, transaction, context);
            for (var i = 0; i < mountImages.length; i++) {
              el.appendChild(mountImages[i]);
            }
          }
        }
      },
      receiveComponent: function(nextElement, transaction, context) {
        var prevElement = this._currentElement;
        this._currentElement = nextElement;
        this.updateComponent(transaction, prevElement, nextElement, context);
      },
      updateComponent: function(transaction, prevElement, nextElement, context) {
        var lastProps = prevElement.props;
        var nextProps = this._currentElement.props;
        switch (this._tag) {
          case 'button':
            lastProps = ReactDOMButton.getNativeProps(this, lastProps);
            nextProps = ReactDOMButton.getNativeProps(this, nextProps);
            break;
          case 'input':
            ReactDOMInput.updateWrapper(this);
            lastProps = ReactDOMInput.getNativeProps(this, lastProps);
            nextProps = ReactDOMInput.getNativeProps(this, nextProps);
            break;
          case 'option':
            lastProps = ReactDOMOption.getNativeProps(this, lastProps);
            nextProps = ReactDOMOption.getNativeProps(this, nextProps);
            break;
          case 'select':
            lastProps = ReactDOMSelect.getNativeProps(this, lastProps);
            nextProps = ReactDOMSelect.getNativeProps(this, nextProps);
            break;
          case 'textarea':
            ReactDOMTextarea.updateWrapper(this);
            lastProps = ReactDOMTextarea.getNativeProps(this, lastProps);
            nextProps = ReactDOMTextarea.getNativeProps(this, nextProps);
            break;
        }
        if (process.env.NODE_ENV !== 'production') {
          if (this._unprocessedContextDev !== context) {
            this._unprocessedContextDev = context;
            this._processedContextDev = processChildContextDev(context, this);
          }
          context = this._processedContextDev;
        }
        assertValidProps(this, nextProps);
        this._updateDOMProperties(lastProps, nextProps, transaction, null);
        this._updateDOMChildren(lastProps, nextProps, transaction, context);
        if (!canDefineProperty && this._nodeWithLegacyProperties) {
          this._nodeWithLegacyProperties.props = nextProps;
        }
        if (this._tag === 'select') {
          transaction.getReactMountReady().enqueue(postUpdateSelectWrapper, this);
        }
      },
      _updateDOMProperties: function(lastProps, nextProps, transaction, node) {
        var propKey;
        var styleName;
        var styleUpdates;
        for (propKey in lastProps) {
          if (nextProps.hasOwnProperty(propKey) || !lastProps.hasOwnProperty(propKey)) {
            continue;
          }
          if (propKey === STYLE) {
            var lastStyle = this._previousStyleCopy;
            for (styleName in lastStyle) {
              if (lastStyle.hasOwnProperty(styleName)) {
                styleUpdates = styleUpdates || {};
                styleUpdates[styleName] = '';
              }
            }
            this._previousStyleCopy = null;
          } else if (registrationNameModules.hasOwnProperty(propKey)) {
            if (lastProps[propKey]) {
              deleteListener(this._rootNodeID, propKey);
            }
          } else if (DOMProperty.properties[propKey] || DOMProperty.isCustomAttribute(propKey)) {
            if (!node) {
              node = ReactMount.getNode(this._rootNodeID);
            }
            DOMPropertyOperations.deleteValueForProperty(node, propKey);
          }
        }
        for (propKey in nextProps) {
          var nextProp = nextProps[propKey];
          var lastProp = propKey === STYLE ? this._previousStyleCopy : lastProps[propKey];
          if (!nextProps.hasOwnProperty(propKey) || nextProp === lastProp) {
            continue;
          }
          if (propKey === STYLE) {
            if (nextProp) {
              if (process.env.NODE_ENV !== 'production') {
                checkAndWarnForMutatedStyle(this._previousStyleCopy, this._previousStyle, this);
                this._previousStyle = nextProp;
              }
              nextProp = this._previousStyleCopy = assign({}, nextProp);
            } else {
              this._previousStyleCopy = null;
            }
            if (lastProp) {
              for (styleName in lastProp) {
                if (lastProp.hasOwnProperty(styleName) && (!nextProp || !nextProp.hasOwnProperty(styleName))) {
                  styleUpdates = styleUpdates || {};
                  styleUpdates[styleName] = '';
                }
              }
              for (styleName in nextProp) {
                if (nextProp.hasOwnProperty(styleName) && lastProp[styleName] !== nextProp[styleName]) {
                  styleUpdates = styleUpdates || {};
                  styleUpdates[styleName] = nextProp[styleName];
                }
              }
            } else {
              styleUpdates = nextProp;
            }
          } else if (registrationNameModules.hasOwnProperty(propKey)) {
            if (nextProp) {
              enqueuePutListener(this._rootNodeID, propKey, nextProp, transaction);
            } else if (lastProp) {
              deleteListener(this._rootNodeID, propKey);
            }
          } else if (isCustomComponent(this._tag, nextProps)) {
            if (!node) {
              node = ReactMount.getNode(this._rootNodeID);
            }
            DOMPropertyOperations.setValueForAttribute(node, propKey, nextProp);
          } else if (DOMProperty.properties[propKey] || DOMProperty.isCustomAttribute(propKey)) {
            if (!node) {
              node = ReactMount.getNode(this._rootNodeID);
            }
            if (nextProp != null) {
              DOMPropertyOperations.setValueForProperty(node, propKey, nextProp);
            } else {
              DOMPropertyOperations.deleteValueForProperty(node, propKey);
            }
          }
        }
        if (styleUpdates) {
          if (!node) {
            node = ReactMount.getNode(this._rootNodeID);
          }
          CSSPropertyOperations.setValueForStyles(node, styleUpdates);
        }
      },
      _updateDOMChildren: function(lastProps, nextProps, transaction, context) {
        var lastContent = CONTENT_TYPES[typeof lastProps.children] ? lastProps.children : null;
        var nextContent = CONTENT_TYPES[typeof nextProps.children] ? nextProps.children : null;
        var lastHtml = lastProps.dangerouslySetInnerHTML && lastProps.dangerouslySetInnerHTML.__html;
        var nextHtml = nextProps.dangerouslySetInnerHTML && nextProps.dangerouslySetInnerHTML.__html;
        var lastChildren = lastContent != null ? null : lastProps.children;
        var nextChildren = nextContent != null ? null : nextProps.children;
        var lastHasContentOrHtml = lastContent != null || lastHtml != null;
        var nextHasContentOrHtml = nextContent != null || nextHtml != null;
        if (lastChildren != null && nextChildren == null) {
          this.updateChildren(null, transaction, context);
        } else if (lastHasContentOrHtml && !nextHasContentOrHtml) {
          this.updateTextContent('');
        }
        if (nextContent != null) {
          if (lastContent !== nextContent) {
            this.updateTextContent('' + nextContent);
          }
        } else if (nextHtml != null) {
          if (lastHtml !== nextHtml) {
            this.updateMarkup('' + nextHtml);
          }
        } else if (nextChildren != null) {
          this.updateChildren(nextChildren, transaction, context);
        }
      },
      unmountComponent: function() {
        switch (this._tag) {
          case 'iframe':
          case 'img':
          case 'form':
          case 'video':
          case 'audio':
            var listeners = this._wrapperState.listeners;
            if (listeners) {
              for (var i = 0; i < listeners.length; i++) {
                listeners[i].remove();
              }
            }
            break;
          case 'input':
            ReactDOMInput.unmountWrapper(this);
            break;
          case 'html':
          case 'head':
          case 'body':
            !false ? process.env.NODE_ENV !== 'production' ? invariant(false, '<%s> tried to unmount. Because of cross-browser quirks it is ' + 'impossible to unmount some top-level components (eg <html>, ' + '<head>, and <body>) reliably and efficiently. To fix this, have a ' + 'single top-level component that never unmounts render these ' + 'elements.', this._tag) : invariant(false) : undefined;
            break;
        }
        this.unmountChildren();
        ReactBrowserEventEmitter.deleteAllListeners(this._rootNodeID);
        ReactComponentBrowserEnvironment.unmountIDFromEnvironment(this._rootNodeID);
        this._rootNodeID = null;
        this._wrapperState = null;
        if (this._nodeWithLegacyProperties) {
          var node = this._nodeWithLegacyProperties;
          node._reactInternalComponent = null;
          this._nodeWithLegacyProperties = null;
        }
      },
      getPublicInstance: function() {
        if (!this._nodeWithLegacyProperties) {
          var node = ReactMount.getNode(this._rootNodeID);
          node._reactInternalComponent = this;
          node.getDOMNode = legacyGetDOMNode;
          node.isMounted = legacyIsMounted;
          node.setState = legacySetStateEtc;
          node.replaceState = legacySetStateEtc;
          node.forceUpdate = legacySetStateEtc;
          node.setProps = legacySetProps;
          node.replaceProps = legacyReplaceProps;
          if (process.env.NODE_ENV !== 'production') {
            if (canDefineProperty) {
              Object.defineProperties(node, legacyPropsDescriptor);
            } else {
              node.props = this._currentElement.props;
            }
          } else {
            node.props = this._currentElement.props;
          }
          this._nodeWithLegacyProperties = node;
        }
        return this._nodeWithLegacyProperties;
      }
    };
    ReactPerf.measureMethods(ReactDOMComponent, 'ReactDOMComponent', {
      mountComponent: 'mountComponent',
      updateComponent: 'updateComponent'
    });
    assign(ReactDOMComponent.prototype, ReactDOMComponent.Mixin, ReactMultiChild.Mixin);
    module.exports = ReactDOMComponent;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("9d", ["35", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var emptyFunction = req('35');
    var EventListener = {
      listen: function(target, eventType, callback) {
        if (target.addEventListener) {
          target.addEventListener(eventType, callback, false);
          return {remove: function() {
              target.removeEventListener(eventType, callback, false);
            }};
        } else if (target.attachEvent) {
          target.attachEvent('on' + eventType, callback);
          return {remove: function() {
              target.detachEvent('on' + eventType, callback);
            }};
        }
      },
      capture: function(target, eventType, callback) {
        if (target.addEventListener) {
          target.addEventListener(eventType, callback, true);
          return {remove: function() {
              target.removeEventListener(eventType, callback, true);
            }};
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Attempted to listen to events during the capture phase on a ' + 'browser that does not support the capture phase. Your application ' + 'will not receive some events.');
          }
          return {remove: emptyFunction};
        }
      },
      registerDefault: function() {}
    };
    module.exports = EventListener;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("9e", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function getUnboundedScrollPosition(scrollable) {
    if (scrollable === window) {
      return {
        x: window.pageXOffset || document.documentElement.scrollLeft,
        y: window.pageYOffset || document.documentElement.scrollTop
      };
    }
    return {
      x: scrollable.scrollLeft,
      y: scrollable.scrollTop
    };
  }
  module.exports = getUnboundedScrollPosition;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("9f", ["9d", "2b", "59", "52", "6b", "5c", "4b", "77", "9e", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var EventListener = req('9d');
    var ExecutionEnvironment = req('2b');
    var PooledClass = req('59');
    var ReactInstanceHandles = req('52');
    var ReactMount = req('6b');
    var ReactUpdates = req('5c');
    var assign = req('4b');
    var getEventTarget = req('77');
    var getUnboundedScrollPosition = req('9e');
    var DOCUMENT_FRAGMENT_NODE_TYPE = 11;
    function findParent(node) {
      var nodeID = ReactMount.getID(node);
      var rootID = ReactInstanceHandles.getReactRootIDFromNodeID(nodeID);
      var container = ReactMount.findReactContainerForID(rootID);
      var parent = ReactMount.getFirstReactDOM(container);
      return parent;
    }
    function TopLevelCallbackBookKeeping(topLevelType, nativeEvent) {
      this.topLevelType = topLevelType;
      this.nativeEvent = nativeEvent;
      this.ancestors = [];
    }
    assign(TopLevelCallbackBookKeeping.prototype, {destructor: function() {
        this.topLevelType = null;
        this.nativeEvent = null;
        this.ancestors.length = 0;
      }});
    PooledClass.addPoolingTo(TopLevelCallbackBookKeeping, PooledClass.twoArgumentPooler);
    function handleTopLevelImpl(bookKeeping) {
      void handleTopLevelWithPath;
      handleTopLevelWithoutPath(bookKeeping);
    }
    function handleTopLevelWithoutPath(bookKeeping) {
      var topLevelTarget = ReactMount.getFirstReactDOM(getEventTarget(bookKeeping.nativeEvent)) || window;
      var ancestor = topLevelTarget;
      while (ancestor) {
        bookKeeping.ancestors.push(ancestor);
        ancestor = findParent(ancestor);
      }
      for (var i = 0; i < bookKeeping.ancestors.length; i++) {
        topLevelTarget = bookKeeping.ancestors[i];
        var topLevelTargetID = ReactMount.getID(topLevelTarget) || '';
        ReactEventListener._handleTopLevel(bookKeeping.topLevelType, topLevelTarget, topLevelTargetID, bookKeeping.nativeEvent, getEventTarget(bookKeeping.nativeEvent));
      }
    }
    function handleTopLevelWithPath(bookKeeping) {
      var path = bookKeeping.nativeEvent.path;
      var currentNativeTarget = path[0];
      var eventsFired = 0;
      for (var i = 0; i < path.length; i++) {
        var currentPathElement = path[i];
        if (currentPathElement.nodeType === DOCUMENT_FRAGMENT_NODE_TYPE) {
          currentNativeTarget = path[i + 1];
        }
        var reactParent = ReactMount.getFirstReactDOM(currentPathElement);
        if (reactParent === currentPathElement) {
          var currentPathElementID = ReactMount.getID(currentPathElement);
          var newRootID = ReactInstanceHandles.getReactRootIDFromNodeID(currentPathElementID);
          bookKeeping.ancestors.push(currentPathElement);
          var topLevelTargetID = ReactMount.getID(currentPathElement) || '';
          eventsFired++;
          ReactEventListener._handleTopLevel(bookKeeping.topLevelType, currentPathElement, topLevelTargetID, bookKeeping.nativeEvent, currentNativeTarget);
          while (currentPathElementID !== newRootID) {
            i++;
            currentPathElement = path[i];
            currentPathElementID = ReactMount.getID(currentPathElement);
          }
        }
      }
      if (eventsFired === 0) {
        ReactEventListener._handleTopLevel(bookKeeping.topLevelType, window, '', bookKeeping.nativeEvent, getEventTarget(bookKeeping.nativeEvent));
      }
    }
    function scrollValueMonitor(cb) {
      var scrollPosition = getUnboundedScrollPosition(window);
      cb(scrollPosition);
    }
    var ReactEventListener = {
      _enabled: true,
      _handleTopLevel: null,
      WINDOW_HANDLE: ExecutionEnvironment.canUseDOM ? window : null,
      setHandleTopLevel: function(handleTopLevel) {
        ReactEventListener._handleTopLevel = handleTopLevel;
      },
      setEnabled: function(enabled) {
        ReactEventListener._enabled = !!enabled;
      },
      isEnabled: function() {
        return ReactEventListener._enabled;
      },
      trapBubbledEvent: function(topLevelType, handlerBaseName, handle) {
        var element = handle;
        if (!element) {
          return null;
        }
        return EventListener.listen(element, handlerBaseName, ReactEventListener.dispatchEvent.bind(null, topLevelType));
      },
      trapCapturedEvent: function(topLevelType, handlerBaseName, handle) {
        var element = handle;
        if (!element) {
          return null;
        }
        return EventListener.capture(element, handlerBaseName, ReactEventListener.dispatchEvent.bind(null, topLevelType));
      },
      monitorScrollValue: function(refresh) {
        var callback = scrollValueMonitor.bind(null, refresh);
        EventListener.listen(window, 'scroll', callback);
      },
      dispatchEvent: function(topLevelType, nativeEvent) {
        if (!ReactEventListener._enabled) {
          return;
        }
        var bookKeeping = TopLevelCallbackBookKeeping.getPooled(topLevelType, nativeEvent);
        try {
          ReactUpdates.batchedUpdates(handleTopLevelImpl, bookKeeping);
        } finally {
          TopLevelCallbackBookKeeping.release(bookKeeping);
        }
      }
    };
    module.exports = ReactEventListener;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a0", ["40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var warning = req('40');
    function warnTDZ(publicInstance, callerName) {
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(false, '%s(...): Can only update a mounted or mounting component. ' + 'This usually means you called %s() on an unmounted component. ' + 'This is a no-op. Please check the code for the %s component.', callerName, callerName, publicInstance.constructor && publicInstance.constructor.displayName || '') : undefined;
      }
    }
    var ReactNoopUpdateQueue = {
      isMounted: function(publicInstance) {
        return false;
      },
      enqueueCallback: function(publicInstance, callback) {},
      enqueueForceUpdate: function(publicInstance) {
        warnTDZ(publicInstance, 'forceUpdate');
      },
      enqueueReplaceState: function(publicInstance, completeState) {
        warnTDZ(publicInstance, 'replaceState');
      },
      enqueueSetState: function(publicInstance, partialState) {
        warnTDZ(publicInstance, 'setState');
      },
      enqueueSetProps: function(publicInstance, partialProps) {
        warnTDZ(publicInstance, 'setProps');
      },
      enqueueReplaceProps: function(publicInstance, props) {
        warnTDZ(publicInstance, 'replaceProps');
      }
    };
    module.exports = ReactNoopUpdateQueue;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a1", ["a0", "5e", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactNoopUpdateQueue = req('a0');
    var emptyObject = req('5e');
    var invariant = req('30');
    var warning = req('40');
    function ReactComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    ReactComponent.prototype.isReactComponent = {};
    ReactComponent.prototype.setState = function(partialState, callback) {
      !(typeof partialState === 'object' || typeof partialState === 'function' || partialState == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'setState(...): takes an object of state variables to update or a ' + 'function which returns an object of state variables.') : invariant(false) : undefined;
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_ENV !== 'production' ? warning(partialState != null, 'setState(...): You passed an undefined or null state object; ' + 'instead, use forceUpdate().') : undefined;
      }
      this.updater.enqueueSetState(this, partialState);
      if (callback) {
        this.updater.enqueueCallback(this, callback);
      }
    };
    ReactComponent.prototype.forceUpdate = function(callback) {
      this.updater.enqueueForceUpdate(this);
      if (callback) {
        this.updater.enqueueCallback(this, callback);
      }
    };
    if (process.env.NODE_ENV !== 'production') {
      var deprecatedAPIs = {
        getDOMNode: ['getDOMNode', 'Use ReactDOM.findDOMNode(component) instead.'],
        isMounted: ['isMounted', 'Instead, make sure to clean up subscriptions and pending requests in ' + 'componentWillUnmount to prevent memory leaks.'],
        replaceProps: ['replaceProps', 'Instead, call render again at the top level.'],
        replaceState: ['replaceState', 'Refactor your code to use setState instead (see ' + 'https://github.com/facebook/react/issues/3236).'],
        setProps: ['setProps', 'Instead, call render again at the top level.']
      };
      var defineDeprecationWarning = function(methodName, info) {
        try {
          Object.defineProperty(ReactComponent.prototype, methodName, {get: function() {
              process.env.NODE_ENV !== 'production' ? warning(false, '%s(...) is deprecated in plain JavaScript React classes. %s', info[0], info[1]) : undefined;
              return undefined;
            }});
        } catch (x) {}
      };
      for (var fnName in deprecatedAPIs) {
        if (deprecatedAPIs.hasOwnProperty(fnName)) {
          defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
        }
      }
    }
    module.exports = ReactComponent;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a2", ["a1", "4f", "63", "64", "a0", "4b", "5e", "30", "37", "75", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactComponent = req('a1');
    var ReactElement = req('4f');
    var ReactPropTypeLocations = req('63');
    var ReactPropTypeLocationNames = req('64');
    var ReactNoopUpdateQueue = req('a0');
    var assign = req('4b');
    var emptyObject = req('5e');
    var invariant = req('30');
    var keyMirror = req('37');
    var keyOf = req('75');
    var warning = req('40');
    var MIXINS_KEY = keyOf({mixins: null});
    var SpecPolicy = keyMirror({
      DEFINE_ONCE: null,
      DEFINE_MANY: null,
      OVERRIDE_BASE: null,
      DEFINE_MANY_MERGED: null
    });
    var injectedMixins = [];
    var warnedSetProps = false;
    function warnSetProps() {
      if (!warnedSetProps) {
        warnedSetProps = true;
        process.env.NODE_ENV !== 'production' ? warning(false, 'setProps(...) and replaceProps(...) are deprecated. ' + 'Instead, call render again at the top level.') : undefined;
      }
    }
    var ReactClassInterface = {
      mixins: SpecPolicy.DEFINE_MANY,
      statics: SpecPolicy.DEFINE_MANY,
      propTypes: SpecPolicy.DEFINE_MANY,
      contextTypes: SpecPolicy.DEFINE_MANY,
      childContextTypes: SpecPolicy.DEFINE_MANY,
      getDefaultProps: SpecPolicy.DEFINE_MANY_MERGED,
      getInitialState: SpecPolicy.DEFINE_MANY_MERGED,
      getChildContext: SpecPolicy.DEFINE_MANY_MERGED,
      render: SpecPolicy.DEFINE_ONCE,
      componentWillMount: SpecPolicy.DEFINE_MANY,
      componentDidMount: SpecPolicy.DEFINE_MANY,
      componentWillReceiveProps: SpecPolicy.DEFINE_MANY,
      shouldComponentUpdate: SpecPolicy.DEFINE_ONCE,
      componentWillUpdate: SpecPolicy.DEFINE_MANY,
      componentDidUpdate: SpecPolicy.DEFINE_MANY,
      componentWillUnmount: SpecPolicy.DEFINE_MANY,
      updateComponent: SpecPolicy.OVERRIDE_BASE
    };
    var RESERVED_SPEC_KEYS = {
      displayName: function(Constructor, displayName) {
        Constructor.displayName = displayName;
      },
      mixins: function(Constructor, mixins) {
        if (mixins) {
          for (var i = 0; i < mixins.length; i++) {
            mixSpecIntoComponent(Constructor, mixins[i]);
          }
        }
      },
      childContextTypes: function(Constructor, childContextTypes) {
        if (process.env.NODE_ENV !== 'production') {
          validateTypeDef(Constructor, childContextTypes, ReactPropTypeLocations.childContext);
        }
        Constructor.childContextTypes = assign({}, Constructor.childContextTypes, childContextTypes);
      },
      contextTypes: function(Constructor, contextTypes) {
        if (process.env.NODE_ENV !== 'production') {
          validateTypeDef(Constructor, contextTypes, ReactPropTypeLocations.context);
        }
        Constructor.contextTypes = assign({}, Constructor.contextTypes, contextTypes);
      },
      getDefaultProps: function(Constructor, getDefaultProps) {
        if (Constructor.getDefaultProps) {
          Constructor.getDefaultProps = createMergedResultFunction(Constructor.getDefaultProps, getDefaultProps);
        } else {
          Constructor.getDefaultProps = getDefaultProps;
        }
      },
      propTypes: function(Constructor, propTypes) {
        if (process.env.NODE_ENV !== 'production') {
          validateTypeDef(Constructor, propTypes, ReactPropTypeLocations.prop);
        }
        Constructor.propTypes = assign({}, Constructor.propTypes, propTypes);
      },
      statics: function(Constructor, statics) {
        mixStaticSpecIntoComponent(Constructor, statics);
      },
      autobind: function() {}
    };
    function validateTypeDef(Constructor, typeDef, location) {
      for (var propName in typeDef) {
        if (typeDef.hasOwnProperty(propName)) {
          process.env.NODE_ENV !== 'production' ? warning(typeof typeDef[propName] === 'function', '%s: %s type `%s` is invalid; it must be a function, usually from ' + 'React.PropTypes.', Constructor.displayName || 'ReactClass', ReactPropTypeLocationNames[location], propName) : undefined;
        }
      }
    }
    function validateMethodOverride(proto, name) {
      var specPolicy = ReactClassInterface.hasOwnProperty(name) ? ReactClassInterface[name] : null;
      if (ReactClassMixin.hasOwnProperty(name)) {
        !(specPolicy === SpecPolicy.OVERRIDE_BASE) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClassInterface: You are attempting to override ' + '`%s` from your class specification. Ensure that your method names ' + 'do not overlap with React methods.', name) : invariant(false) : undefined;
      }
      if (proto.hasOwnProperty(name)) {
        !(specPolicy === SpecPolicy.DEFINE_MANY || specPolicy === SpecPolicy.DEFINE_MANY_MERGED) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClassInterface: You are attempting to define ' + '`%s` on your component more than once. This conflict may be due ' + 'to a mixin.', name) : invariant(false) : undefined;
      }
    }
    function mixSpecIntoComponent(Constructor, spec) {
      if (!spec) {
        return;
      }
      !(typeof spec !== 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: You\'re attempting to ' + 'use a component class as a mixin. Instead, just use a regular object.') : invariant(false) : undefined;
      !!ReactElement.isValidElement(spec) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: You\'re attempting to ' + 'use a component as a mixin. Instead, just use a regular object.') : invariant(false) : undefined;
      var proto = Constructor.prototype;
      if (spec.hasOwnProperty(MIXINS_KEY)) {
        RESERVED_SPEC_KEYS.mixins(Constructor, spec.mixins);
      }
      for (var name in spec) {
        if (!spec.hasOwnProperty(name)) {
          continue;
        }
        if (name === MIXINS_KEY) {
          continue;
        }
        var property = spec[name];
        validateMethodOverride(proto, name);
        if (RESERVED_SPEC_KEYS.hasOwnProperty(name)) {
          RESERVED_SPEC_KEYS[name](Constructor, property);
        } else {
          var isReactClassMethod = ReactClassInterface.hasOwnProperty(name);
          var isAlreadyDefined = proto.hasOwnProperty(name);
          var isFunction = typeof property === 'function';
          var shouldAutoBind = isFunction && !isReactClassMethod && !isAlreadyDefined && spec.autobind !== false;
          if (shouldAutoBind) {
            if (!proto.__reactAutoBindMap) {
              proto.__reactAutoBindMap = {};
            }
            proto.__reactAutoBindMap[name] = property;
            proto[name] = property;
          } else {
            if (isAlreadyDefined) {
              var specPolicy = ReactClassInterface[name];
              !(isReactClassMethod && (specPolicy === SpecPolicy.DEFINE_MANY_MERGED || specPolicy === SpecPolicy.DEFINE_MANY)) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: Unexpected spec policy %s for key %s ' + 'when mixing in component specs.', specPolicy, name) : invariant(false) : undefined;
              if (specPolicy === SpecPolicy.DEFINE_MANY_MERGED) {
                proto[name] = createMergedResultFunction(proto[name], property);
              } else if (specPolicy === SpecPolicy.DEFINE_MANY) {
                proto[name] = createChainedFunction(proto[name], property);
              }
            } else {
              proto[name] = property;
              if (process.env.NODE_ENV !== 'production') {
                if (typeof property === 'function' && spec.displayName) {
                  proto[name].displayName = spec.displayName + '_' + name;
                }
              }
            }
          }
        }
      }
    }
    function mixStaticSpecIntoComponent(Constructor, statics) {
      if (!statics) {
        return;
      }
      for (var name in statics) {
        var property = statics[name];
        if (!statics.hasOwnProperty(name)) {
          continue;
        }
        var isReserved = (name in RESERVED_SPEC_KEYS);
        !!isReserved ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: You are attempting to define a reserved ' + 'property, `%s`, that shouldn\'t be on the "statics" key. Define it ' + 'as an instance property instead; it will still be accessible on the ' + 'constructor.', name) : invariant(false) : undefined;
        var isInherited = (name in Constructor);
        !!isInherited ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: You are attempting to define ' + '`%s` on your component more than once. This conflict may be ' + 'due to a mixin.', name) : invariant(false) : undefined;
        Constructor[name] = property;
      }
    }
    function mergeIntoWithNoDuplicateKeys(one, two) {
      !(one && two && typeof one === 'object' && typeof two === 'object') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'mergeIntoWithNoDuplicateKeys(): Cannot merge non-objects.') : invariant(false) : undefined;
      for (var key in two) {
        if (two.hasOwnProperty(key)) {
          !(one[key] === undefined) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'mergeIntoWithNoDuplicateKeys(): ' + 'Tried to merge two objects with the same key: `%s`. This conflict ' + 'may be due to a mixin; in particular, this may be caused by two ' + 'getInitialState() or getDefaultProps() methods returning objects ' + 'with clashing keys.', key) : invariant(false) : undefined;
          one[key] = two[key];
        }
      }
      return one;
    }
    function createMergedResultFunction(one, two) {
      return function mergedResult() {
        var a = one.apply(this, arguments);
        var b = two.apply(this, arguments);
        if (a == null) {
          return b;
        } else if (b == null) {
          return a;
        }
        var c = {};
        mergeIntoWithNoDuplicateKeys(c, a);
        mergeIntoWithNoDuplicateKeys(c, b);
        return c;
      };
    }
    function createChainedFunction(one, two) {
      return function chainedFunction() {
        one.apply(this, arguments);
        two.apply(this, arguments);
      };
    }
    function bindAutoBindMethod(component, method) {
      var boundMethod = method.bind(component);
      if (process.env.NODE_ENV !== 'production') {
        boundMethod.__reactBoundContext = component;
        boundMethod.__reactBoundMethod = method;
        boundMethod.__reactBoundArguments = null;
        var componentName = component.constructor.displayName;
        var _bind = boundMethod.bind;
        boundMethod.bind = function(newThis) {
          for (var _len = arguments.length,
              args = Array(_len > 1 ? _len - 1 : 0),
              _key = 1; _key < _len; _key++) {
            args[_key - 1] = arguments[_key];
          }
          if (newThis !== component && newThis !== null) {
            process.env.NODE_ENV !== 'production' ? warning(false, 'bind(): React component methods may only be bound to the ' + 'component instance. See %s', componentName) : undefined;
          } else if (!args.length) {
            process.env.NODE_ENV !== 'production' ? warning(false, 'bind(): You are binding a component method to the component. ' + 'React does this for you automatically in a high-performance ' + 'way, so you can safely remove this call. See %s', componentName) : undefined;
            return boundMethod;
          }
          var reboundMethod = _bind.apply(boundMethod, arguments);
          reboundMethod.__reactBoundContext = component;
          reboundMethod.__reactBoundMethod = method;
          reboundMethod.__reactBoundArguments = args;
          return reboundMethod;
        };
      }
      return boundMethod;
    }
    function bindAutoBindMethods(component) {
      for (var autoBindKey in component.__reactAutoBindMap) {
        if (component.__reactAutoBindMap.hasOwnProperty(autoBindKey)) {
          var method = component.__reactAutoBindMap[autoBindKey];
          component[autoBindKey] = bindAutoBindMethod(component, method);
        }
      }
    }
    var ReactClassMixin = {
      replaceState: function(newState, callback) {
        this.updater.enqueueReplaceState(this, newState);
        if (callback) {
          this.updater.enqueueCallback(this, callback);
        }
      },
      isMounted: function() {
        return this.updater.isMounted(this);
      },
      setProps: function(partialProps, callback) {
        if (process.env.NODE_ENV !== 'production') {
          warnSetProps();
        }
        this.updater.enqueueSetProps(this, partialProps);
        if (callback) {
          this.updater.enqueueCallback(this, callback);
        }
      },
      replaceProps: function(newProps, callback) {
        if (process.env.NODE_ENV !== 'production') {
          warnSetProps();
        }
        this.updater.enqueueReplaceProps(this, newProps);
        if (callback) {
          this.updater.enqueueCallback(this, callback);
        }
      }
    };
    var ReactClassComponent = function() {};
    assign(ReactClassComponent.prototype, ReactComponent.prototype, ReactClassMixin);
    var ReactClass = {
      createClass: function(spec) {
        var Constructor = function(props, context, updater) {
          if (process.env.NODE_ENV !== 'production') {
            process.env.NODE_ENV !== 'production' ? warning(this instanceof Constructor, 'Something is calling a React component directly. Use a factory or ' + 'JSX instead. See: https://fb.me/react-legacyfactory') : undefined;
          }
          if (this.__reactAutoBindMap) {
            bindAutoBindMethods(this);
          }
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
          this.state = null;
          var initialState = this.getInitialState ? this.getInitialState() : null;
          if (process.env.NODE_ENV !== 'production') {
            if (typeof initialState === 'undefined' && this.getInitialState._isMockFunction) {
              initialState = null;
            }
          }
          !(typeof initialState === 'object' && !Array.isArray(initialState)) ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.getInitialState(): must return an object or null', Constructor.displayName || 'ReactCompositeComponent') : invariant(false) : undefined;
          this.state = initialState;
        };
        Constructor.prototype = new ReactClassComponent();
        Constructor.prototype.constructor = Constructor;
        injectedMixins.forEach(mixSpecIntoComponent.bind(null, Constructor));
        mixSpecIntoComponent(Constructor, spec);
        if (Constructor.getDefaultProps) {
          Constructor.defaultProps = Constructor.getDefaultProps();
        }
        if (process.env.NODE_ENV !== 'production') {
          if (Constructor.getDefaultProps) {
            Constructor.getDefaultProps.isReactClassApproved = {};
          }
          if (Constructor.prototype.getInitialState) {
            Constructor.prototype.getInitialState.isReactClassApproved = {};
          }
        }
        !Constructor.prototype.render ? process.env.NODE_ENV !== 'production' ? invariant(false, 'createClass(...): Class specification must implement a `render` method.') : invariant(false) : undefined;
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(!Constructor.prototype.componentShouldUpdate, '%s has a method called ' + 'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' + 'The name is phrased as a question because the function is ' + 'expected to return a value.', spec.displayName || 'A component') : undefined;
          process.env.NODE_ENV !== 'production' ? warning(!Constructor.prototype.componentWillRecieveProps, '%s has a method called ' + 'componentWillRecieveProps(). Did you mean componentWillReceiveProps()?', spec.displayName || 'A component') : undefined;
        }
        for (var methodName in ReactClassInterface) {
          if (!Constructor.prototype[methodName]) {
            Constructor.prototype[methodName] = null;
          }
        }
        return Constructor;
      },
      injection: {injectMixin: function(mixin) {
          injectedMixins.push(mixin);
        }}
    };
    module.exports = ReactClass;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a3", ["3e", "48", "62", "a2", "67", "4d", "68", "39", "51", "5c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var DOMProperty = req('3e');
  var EventPluginHub = req('48');
  var ReactComponentEnvironment = req('62');
  var ReactClass = req('a2');
  var ReactEmptyComponent = req('67');
  var ReactBrowserEventEmitter = req('4d');
  var ReactNativeComponent = req('68');
  var ReactPerf = req('39');
  var ReactRootIndex = req('51');
  var ReactUpdates = req('5c');
  var ReactInjection = {
    Component: ReactComponentEnvironment.injection,
    Class: ReactClass.injection,
    DOMProperty: DOMProperty.injection,
    EmptyComponent: ReactEmptyComponent.injection,
    EventPluginHub: EventPluginHub.injection,
    EventEmitter: ReactBrowserEventEmitter.injection,
    NativeComponent: ReactNativeComponent.injection,
    Perf: ReactPerf.injection,
    RootIndex: ReactRootIndex.injection,
    Updates: ReactUpdates.injection
  };
  module.exports = ReactInjection;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a4", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function getLeafNode(node) {
    while (node && node.firstChild) {
      node = node.firstChild;
    }
    return node;
  }
  function getSiblingNode(node) {
    while (node) {
      if (node.nextSibling) {
        return node.nextSibling;
      }
      node = node.parentNode;
    }
  }
  function getNodeForCharacterOffset(root, offset) {
    var node = getLeafNode(root);
    var nodeStart = 0;
    var nodeEnd = 0;
    while (node) {
      if (node.nodeType === 3) {
        nodeEnd = nodeStart + node.textContent.length;
        if (nodeStart <= offset && nodeEnd >= offset) {
          return {
            node: node,
            offset: offset - nodeStart
          };
        }
        nodeStart = nodeEnd;
      }
      node = getLeafNode(getSiblingNode(node));
    }
  }
  module.exports = getNodeForCharacterOffset;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a5", ["2b", "a4", "70"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ExecutionEnvironment = req('2b');
  var getNodeForCharacterOffset = req('a4');
  var getTextContentAccessor = req('70');
  function isCollapsed(anchorNode, anchorOffset, focusNode, focusOffset) {
    return anchorNode === focusNode && anchorOffset === focusOffset;
  }
  function getIEOffsets(node) {
    var selection = document.selection;
    var selectedRange = selection.createRange();
    var selectedLength = selectedRange.text.length;
    var fromStart = selectedRange.duplicate();
    fromStart.moveToElementText(node);
    fromStart.setEndPoint('EndToStart', selectedRange);
    var startOffset = fromStart.text.length;
    var endOffset = startOffset + selectedLength;
    return {
      start: startOffset,
      end: endOffset
    };
  }
  function getModernOffsets(node) {
    var selection = window.getSelection && window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }
    var anchorNode = selection.anchorNode;
    var anchorOffset = selection.anchorOffset;
    var focusNode = selection.focusNode;
    var focusOffset = selection.focusOffset;
    var currentRange = selection.getRangeAt(0);
    try {
      currentRange.startContainer.nodeType;
      currentRange.endContainer.nodeType;
    } catch (e) {
      return null;
    }
    var isSelectionCollapsed = isCollapsed(selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset);
    var rangeLength = isSelectionCollapsed ? 0 : currentRange.toString().length;
    var tempRange = currentRange.cloneRange();
    tempRange.selectNodeContents(node);
    tempRange.setEnd(currentRange.startContainer, currentRange.startOffset);
    var isTempRangeCollapsed = isCollapsed(tempRange.startContainer, tempRange.startOffset, tempRange.endContainer, tempRange.endOffset);
    var start = isTempRangeCollapsed ? 0 : tempRange.toString().length;
    var end = start + rangeLength;
    var detectionRange = document.createRange();
    detectionRange.setStart(anchorNode, anchorOffset);
    detectionRange.setEnd(focusNode, focusOffset);
    var isBackward = detectionRange.collapsed;
    return {
      start: isBackward ? end : start,
      end: isBackward ? start : end
    };
  }
  function setIEOffsets(node, offsets) {
    var range = document.selection.createRange().duplicate();
    var start,
        end;
    if (typeof offsets.end === 'undefined') {
      start = offsets.start;
      end = start;
    } else if (offsets.start > offsets.end) {
      start = offsets.end;
      end = offsets.start;
    } else {
      start = offsets.start;
      end = offsets.end;
    }
    range.moveToElementText(node);
    range.moveStart('character', start);
    range.setEndPoint('EndToStart', range);
    range.moveEnd('character', end - start);
    range.select();
  }
  function setModernOffsets(node, offsets) {
    if (!window.getSelection) {
      return;
    }
    var selection = window.getSelection();
    var length = node[getTextContentAccessor()].length;
    var start = Math.min(offsets.start, length);
    var end = typeof offsets.end === 'undefined' ? start : Math.min(offsets.end, length);
    if (!selection.extend && start > end) {
      var temp = end;
      end = start;
      start = temp;
    }
    var startMarker = getNodeForCharacterOffset(node, start);
    var endMarker = getNodeForCharacterOffset(node, end);
    if (startMarker && endMarker) {
      var range = document.createRange();
      range.setStart(startMarker.node, startMarker.offset);
      selection.removeAllRanges();
      if (start > end) {
        selection.addRange(range);
        selection.extend(endMarker.node, endMarker.offset);
      } else {
        range.setEnd(endMarker.node, endMarker.offset);
        selection.addRange(range);
      }
    }
  }
  var useIEOffsets = ExecutionEnvironment.canUseDOM && 'selection' in document && !('getSelection' in window);
  var ReactDOMSelection = {
    getOffsets: useIEOffsets ? getIEOffsets : getModernOffsets,
    setOffsets: useIEOffsets ? setIEOffsets : setModernOffsets
  };
  module.exports = ReactDOMSelection;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a6", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function getActiveElement() {
    if (typeof document === 'undefined') {
      return null;
    }
    try {
      return document.activeElement || document.body;
    } catch (e) {
      return document.body;
    }
  }
  module.exports = getActiveElement;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a7", ["a5", "61", "84", "a6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactDOMSelection = req('a5');
  var containsNode = req('61');
  var focusNode = req('84');
  var getActiveElement = req('a6');
  function isInDocument(node) {
    return containsNode(document.documentElement, node);
  }
  var ReactInputSelection = {
    hasSelectionCapabilities: function(elem) {
      var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
      return nodeName && (nodeName === 'input' && elem.type === 'text' || nodeName === 'textarea' || elem.contentEditable === 'true');
    },
    getSelectionInformation: function() {
      var focusedElem = getActiveElement();
      return {
        focusedElem: focusedElem,
        selectionRange: ReactInputSelection.hasSelectionCapabilities(focusedElem) ? ReactInputSelection.getSelection(focusedElem) : null
      };
    },
    restoreSelection: function(priorSelectionInformation) {
      var curFocusedElem = getActiveElement();
      var priorFocusedElem = priorSelectionInformation.focusedElem;
      var priorSelectionRange = priorSelectionInformation.selectionRange;
      if (curFocusedElem !== priorFocusedElem && isInDocument(priorFocusedElem)) {
        if (ReactInputSelection.hasSelectionCapabilities(priorFocusedElem)) {
          ReactInputSelection.setSelection(priorFocusedElem, priorSelectionRange);
        }
        focusNode(priorFocusedElem);
      }
    },
    getSelection: function(input) {
      var selection;
      if ('selectionStart' in input) {
        selection = {
          start: input.selectionStart,
          end: input.selectionEnd
        };
      } else if (document.selection && (input.nodeName && input.nodeName.toLowerCase() === 'input')) {
        var range = document.selection.createRange();
        if (range.parentElement() === input) {
          selection = {
            start: -range.moveStart('character', -input.value.length),
            end: -range.moveEnd('character', -input.value.length)
          };
        }
      } else {
        selection = ReactDOMSelection.getOffsets(input);
      }
      return selection || {
        start: 0,
        end: 0
      };
    },
    setSelection: function(input, offsets) {
      var start = offsets.start;
      var end = offsets.end;
      if (typeof end === 'undefined') {
        end = start;
      }
      if ('selectionStart' in input) {
        input.selectionStart = start;
        input.selectionEnd = Math.min(end, input.value.length);
      } else if (document.selection && (input.nodeName && input.nodeName.toLowerCase() === 'input')) {
        var range = input.createTextRange();
        range.collapse(true);
        range.moveStart('character', start);
        range.moveEnd('character', end - start);
        range.select();
      } else {
        ReactDOMSelection.setOffsets(input, offsets);
      }
    }
  };
  module.exports = ReactInputSelection;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a8", ["5a", "59", "4d", "4e", "a7", "5b", "4b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var CallbackQueue = req('5a');
  var PooledClass = req('59');
  var ReactBrowserEventEmitter = req('4d');
  var ReactDOMFeatureFlags = req('4e');
  var ReactInputSelection = req('a7');
  var Transaction = req('5b');
  var assign = req('4b');
  var SELECTION_RESTORATION = {
    initialize: ReactInputSelection.getSelectionInformation,
    close: ReactInputSelection.restoreSelection
  };
  var EVENT_SUPPRESSION = {
    initialize: function() {
      var currentlyEnabled = ReactBrowserEventEmitter.isEnabled();
      ReactBrowserEventEmitter.setEnabled(false);
      return currentlyEnabled;
    },
    close: function(previouslyEnabled) {
      ReactBrowserEventEmitter.setEnabled(previouslyEnabled);
    }
  };
  var ON_DOM_READY_QUEUEING = {
    initialize: function() {
      this.reactMountReady.reset();
    },
    close: function() {
      this.reactMountReady.notifyAll();
    }
  };
  var TRANSACTION_WRAPPERS = [SELECTION_RESTORATION, EVENT_SUPPRESSION, ON_DOM_READY_QUEUEING];
  function ReactReconcileTransaction(forceHTML) {
    this.reinitializeTransaction();
    this.renderToStaticMarkup = false;
    this.reactMountReady = CallbackQueue.getPooled(null);
    this.useCreateElement = !forceHTML && ReactDOMFeatureFlags.useCreateElement;
  }
  var Mixin = {
    getTransactionWrappers: function() {
      return TRANSACTION_WRAPPERS;
    },
    getReactMountReady: function() {
      return this.reactMountReady;
    },
    destructor: function() {
      CallbackQueue.release(this.reactMountReady);
      this.reactMountReady = null;
    }
  };
  assign(ReactReconcileTransaction.prototype, Transaction.Mixin, Mixin);
  PooledClass.addPoolingTo(ReactReconcileTransaction);
  module.exports = ReactReconcileTransaction;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a9", ["42", "6f", "2b", "a7", "72", "a6", "78", "75", "9b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var EventConstants = req('42');
  var EventPropagators = req('6f');
  var ExecutionEnvironment = req('2b');
  var ReactInputSelection = req('a7');
  var SyntheticEvent = req('72');
  var getActiveElement = req('a6');
  var isTextInputElement = req('78');
  var keyOf = req('75');
  var shallowEqual = req('9b');
  var topLevelTypes = EventConstants.topLevelTypes;
  var skipSelectionChangeEvent = ExecutionEnvironment.canUseDOM && 'documentMode' in document && document.documentMode <= 11;
  var eventTypes = {select: {
      phasedRegistrationNames: {
        bubbled: keyOf({onSelect: null}),
        captured: keyOf({onSelectCapture: null})
      },
      dependencies: [topLevelTypes.topBlur, topLevelTypes.topContextMenu, topLevelTypes.topFocus, topLevelTypes.topKeyDown, topLevelTypes.topMouseDown, topLevelTypes.topMouseUp, topLevelTypes.topSelectionChange]
    }};
  var activeElement = null;
  var activeElementID = null;
  var lastSelection = null;
  var mouseDown = false;
  var hasListener = false;
  var ON_SELECT_KEY = keyOf({onSelect: null});
  function getSelection(node) {
    if ('selectionStart' in node && ReactInputSelection.hasSelectionCapabilities(node)) {
      return {
        start: node.selectionStart,
        end: node.selectionEnd
      };
    } else if (window.getSelection) {
      var selection = window.getSelection();
      return {
        anchorNode: selection.anchorNode,
        anchorOffset: selection.anchorOffset,
        focusNode: selection.focusNode,
        focusOffset: selection.focusOffset
      };
    } else if (document.selection) {
      var range = document.selection.createRange();
      return {
        parentElement: range.parentElement(),
        text: range.text,
        top: range.boundingTop,
        left: range.boundingLeft
      };
    }
  }
  function constructSelectEvent(nativeEvent, nativeEventTarget) {
    if (mouseDown || activeElement == null || activeElement !== getActiveElement()) {
      return null;
    }
    var currentSelection = getSelection(activeElement);
    if (!lastSelection || !shallowEqual(lastSelection, currentSelection)) {
      lastSelection = currentSelection;
      var syntheticEvent = SyntheticEvent.getPooled(eventTypes.select, activeElementID, nativeEvent, nativeEventTarget);
      syntheticEvent.type = 'select';
      syntheticEvent.target = activeElement;
      EventPropagators.accumulateTwoPhaseDispatches(syntheticEvent);
      return syntheticEvent;
    }
    return null;
  }
  var SelectEventPlugin = {
    eventTypes: eventTypes,
    extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
      if (!hasListener) {
        return null;
      }
      switch (topLevelType) {
        case topLevelTypes.topFocus:
          if (isTextInputElement(topLevelTarget) || topLevelTarget.contentEditable === 'true') {
            activeElement = topLevelTarget;
            activeElementID = topLevelTargetID;
            lastSelection = null;
          }
          break;
        case topLevelTypes.topBlur:
          activeElement = null;
          activeElementID = null;
          lastSelection = null;
          break;
        case topLevelTypes.topMouseDown:
          mouseDown = true;
          break;
        case topLevelTypes.topContextMenu:
        case topLevelTypes.topMouseUp:
          mouseDown = false;
          return constructSelectEvent(nativeEvent, nativeEventTarget);
        case topLevelTypes.topSelectionChange:
          if (skipSelectionChangeEvent) {
            break;
          }
        case topLevelTypes.topKeyDown:
        case topLevelTypes.topKeyUp:
          return constructSelectEvent(nativeEvent, nativeEventTarget);
      }
      return null;
    },
    didPutListener: function(id, registrationName, listener) {
      if (registrationName === ON_SELECT_KEY) {
        hasListener = true;
      }
    }
  };
  module.exports = SelectEventPlugin;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("aa", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var GLOBAL_MOUNT_POINT_MAX = Math.pow(2, 53);
  var ServerReactRootIndex = {createReactRootIndex: function() {
      return Math.ceil(Math.random() * GLOBAL_MOUNT_POINT_MAX);
    }};
  module.exports = ServerReactRootIndex;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ab", ["72"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticEvent = req('72');
  var ClipboardEventInterface = {clipboardData: function(event) {
      return 'clipboardData' in event ? event.clipboardData : window.clipboardData;
    }};
  function SyntheticClipboardEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticEvent.augmentClass(SyntheticClipboardEvent, ClipboardEventInterface);
  module.exports = SyntheticClipboardEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ac", ["7c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticUIEvent = req('7c');
  var FocusEventInterface = {relatedTarget: null};
  function SyntheticFocusEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticUIEvent.augmentClass(SyntheticFocusEvent, FocusEventInterface);
  module.exports = SyntheticFocusEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ad", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function getEventCharCode(nativeEvent) {
    var charCode;
    var keyCode = nativeEvent.keyCode;
    if ('charCode' in nativeEvent) {
      charCode = nativeEvent.charCode;
      if (charCode === 0 && keyCode === 13) {
        charCode = 13;
      }
    } else {
      charCode = keyCode;
    }
    if (charCode >= 32 || charCode === 13) {
      return charCode;
    }
    return 0;
  }
  module.exports = getEventCharCode;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ae", ["ad"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var getEventCharCode = req('ad');
  var normalizeKey = {
    'Esc': 'Escape',
    'Spacebar': ' ',
    'Left': 'ArrowLeft',
    'Up': 'ArrowUp',
    'Right': 'ArrowRight',
    'Down': 'ArrowDown',
    'Del': 'Delete',
    'Win': 'OS',
    'Menu': 'ContextMenu',
    'Apps': 'ContextMenu',
    'Scroll': 'ScrollLock',
    'MozPrintableKey': 'Unidentified'
  };
  var translateToKey = {
    8: 'Backspace',
    9: 'Tab',
    12: 'Clear',
    13: 'Enter',
    16: 'Shift',
    17: 'Control',
    18: 'Alt',
    19: 'Pause',
    20: 'CapsLock',
    27: 'Escape',
    32: ' ',
    33: 'PageUp',
    34: 'PageDown',
    35: 'End',
    36: 'Home',
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown',
    45: 'Insert',
    46: 'Delete',
    112: 'F1',
    113: 'F2',
    114: 'F3',
    115: 'F4',
    116: 'F5',
    117: 'F6',
    118: 'F7',
    119: 'F8',
    120: 'F9',
    121: 'F10',
    122: 'F11',
    123: 'F12',
    144: 'NumLock',
    145: 'ScrollLock',
    224: 'Meta'
  };
  function getEventKey(nativeEvent) {
    if (nativeEvent.key) {
      var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
      if (key !== 'Unidentified') {
        return key;
      }
    }
    if (nativeEvent.type === 'keypress') {
      var charCode = getEventCharCode(nativeEvent);
      return charCode === 13 ? 'Enter' : String.fromCharCode(charCode);
    }
    if (nativeEvent.type === 'keydown' || nativeEvent.type === 'keyup') {
      return translateToKey[nativeEvent.keyCode] || 'Unidentified';
    }
    return '';
  }
  module.exports = getEventKey;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("af", ["7c", "ad", "ae", "7d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticUIEvent = req('7c');
  var getEventCharCode = req('ad');
  var getEventKey = req('ae');
  var getEventModifierState = req('7d');
  var KeyboardEventInterface = {
    key: getEventKey,
    location: null,
    ctrlKey: null,
    shiftKey: null,
    altKey: null,
    metaKey: null,
    repeat: null,
    locale: null,
    getModifierState: getEventModifierState,
    charCode: function(event) {
      if (event.type === 'keypress') {
        return getEventCharCode(event);
      }
      return 0;
    },
    keyCode: function(event) {
      if (event.type === 'keydown' || event.type === 'keyup') {
        return event.keyCode;
      }
      return 0;
    },
    which: function(event) {
      if (event.type === 'keypress') {
        return getEventCharCode(event);
      }
      if (event.type === 'keydown' || event.type === 'keyup') {
        return event.keyCode;
      }
      return 0;
    }
  };
  function SyntheticKeyboardEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticUIEvent.augmentClass(SyntheticKeyboardEvent, KeyboardEventInterface);
  module.exports = SyntheticKeyboardEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b0", ["7e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticMouseEvent = req('7e');
  var DragEventInterface = {dataTransfer: null};
  function SyntheticDragEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticMouseEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticMouseEvent.augmentClass(SyntheticDragEvent, DragEventInterface);
  module.exports = SyntheticDragEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b1", ["7c", "7d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticUIEvent = req('7c');
  var getEventModifierState = req('7d');
  var TouchEventInterface = {
    touches: null,
    targetTouches: null,
    changedTouches: null,
    altKey: null,
    metaKey: null,
    ctrlKey: null,
    shiftKey: null,
    getModifierState: getEventModifierState
  };
  function SyntheticTouchEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticUIEvent.augmentClass(SyntheticTouchEvent, TouchEventInterface);
  module.exports = SyntheticTouchEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b2", ["7e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var SyntheticMouseEvent = req('7e');
  var WheelEventInterface = {
    deltaX: function(event) {
      return 'deltaX' in event ? event.deltaX : 'wheelDeltaX' in event ? -event.wheelDeltaX : 0;
    },
    deltaY: function(event) {
      return 'deltaY' in event ? event.deltaY : 'wheelDeltaY' in event ? -event.wheelDeltaY : 'wheelDelta' in event ? -event.wheelDelta : 0;
    },
    deltaZ: null,
    deltaMode: null
  };
  function SyntheticWheelEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    SyntheticMouseEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
  }
  SyntheticMouseEvent.augmentClass(SyntheticWheelEvent, WheelEventInterface);
  module.exports = SyntheticWheelEvent;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b3", ["42", "9d", "6f", "6b", "ab", "72", "ac", "af", "7e", "b0", "b1", "7c", "b2", "35", "ad", "30", "75", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var EventConstants = req('42');
    var EventListener = req('9d');
    var EventPropagators = req('6f');
    var ReactMount = req('6b');
    var SyntheticClipboardEvent = req('ab');
    var SyntheticEvent = req('72');
    var SyntheticFocusEvent = req('ac');
    var SyntheticKeyboardEvent = req('af');
    var SyntheticMouseEvent = req('7e');
    var SyntheticDragEvent = req('b0');
    var SyntheticTouchEvent = req('b1');
    var SyntheticUIEvent = req('7c');
    var SyntheticWheelEvent = req('b2');
    var emptyFunction = req('35');
    var getEventCharCode = req('ad');
    var invariant = req('30');
    var keyOf = req('75');
    var topLevelTypes = EventConstants.topLevelTypes;
    var eventTypes = {
      abort: {phasedRegistrationNames: {
          bubbled: keyOf({onAbort: true}),
          captured: keyOf({onAbortCapture: true})
        }},
      blur: {phasedRegistrationNames: {
          bubbled: keyOf({onBlur: true}),
          captured: keyOf({onBlurCapture: true})
        }},
      canPlay: {phasedRegistrationNames: {
          bubbled: keyOf({onCanPlay: true}),
          captured: keyOf({onCanPlayCapture: true})
        }},
      canPlayThrough: {phasedRegistrationNames: {
          bubbled: keyOf({onCanPlayThrough: true}),
          captured: keyOf({onCanPlayThroughCapture: true})
        }},
      click: {phasedRegistrationNames: {
          bubbled: keyOf({onClick: true}),
          captured: keyOf({onClickCapture: true})
        }},
      contextMenu: {phasedRegistrationNames: {
          bubbled: keyOf({onContextMenu: true}),
          captured: keyOf({onContextMenuCapture: true})
        }},
      copy: {phasedRegistrationNames: {
          bubbled: keyOf({onCopy: true}),
          captured: keyOf({onCopyCapture: true})
        }},
      cut: {phasedRegistrationNames: {
          bubbled: keyOf({onCut: true}),
          captured: keyOf({onCutCapture: true})
        }},
      doubleClick: {phasedRegistrationNames: {
          bubbled: keyOf({onDoubleClick: true}),
          captured: keyOf({onDoubleClickCapture: true})
        }},
      drag: {phasedRegistrationNames: {
          bubbled: keyOf({onDrag: true}),
          captured: keyOf({onDragCapture: true})
        }},
      dragEnd: {phasedRegistrationNames: {
          bubbled: keyOf({onDragEnd: true}),
          captured: keyOf({onDragEndCapture: true})
        }},
      dragEnter: {phasedRegistrationNames: {
          bubbled: keyOf({onDragEnter: true}),
          captured: keyOf({onDragEnterCapture: true})
        }},
      dragExit: {phasedRegistrationNames: {
          bubbled: keyOf({onDragExit: true}),
          captured: keyOf({onDragExitCapture: true})
        }},
      dragLeave: {phasedRegistrationNames: {
          bubbled: keyOf({onDragLeave: true}),
          captured: keyOf({onDragLeaveCapture: true})
        }},
      dragOver: {phasedRegistrationNames: {
          bubbled: keyOf({onDragOver: true}),
          captured: keyOf({onDragOverCapture: true})
        }},
      dragStart: {phasedRegistrationNames: {
          bubbled: keyOf({onDragStart: true}),
          captured: keyOf({onDragStartCapture: true})
        }},
      drop: {phasedRegistrationNames: {
          bubbled: keyOf({onDrop: true}),
          captured: keyOf({onDropCapture: true})
        }},
      durationChange: {phasedRegistrationNames: {
          bubbled: keyOf({onDurationChange: true}),
          captured: keyOf({onDurationChangeCapture: true})
        }},
      emptied: {phasedRegistrationNames: {
          bubbled: keyOf({onEmptied: true}),
          captured: keyOf({onEmptiedCapture: true})
        }},
      encrypted: {phasedRegistrationNames: {
          bubbled: keyOf({onEncrypted: true}),
          captured: keyOf({onEncryptedCapture: true})
        }},
      ended: {phasedRegistrationNames: {
          bubbled: keyOf({onEnded: true}),
          captured: keyOf({onEndedCapture: true})
        }},
      error: {phasedRegistrationNames: {
          bubbled: keyOf({onError: true}),
          captured: keyOf({onErrorCapture: true})
        }},
      focus: {phasedRegistrationNames: {
          bubbled: keyOf({onFocus: true}),
          captured: keyOf({onFocusCapture: true})
        }},
      input: {phasedRegistrationNames: {
          bubbled: keyOf({onInput: true}),
          captured: keyOf({onInputCapture: true})
        }},
      keyDown: {phasedRegistrationNames: {
          bubbled: keyOf({onKeyDown: true}),
          captured: keyOf({onKeyDownCapture: true})
        }},
      keyPress: {phasedRegistrationNames: {
          bubbled: keyOf({onKeyPress: true}),
          captured: keyOf({onKeyPressCapture: true})
        }},
      keyUp: {phasedRegistrationNames: {
          bubbled: keyOf({onKeyUp: true}),
          captured: keyOf({onKeyUpCapture: true})
        }},
      load: {phasedRegistrationNames: {
          bubbled: keyOf({onLoad: true}),
          captured: keyOf({onLoadCapture: true})
        }},
      loadedData: {phasedRegistrationNames: {
          bubbled: keyOf({onLoadedData: true}),
          captured: keyOf({onLoadedDataCapture: true})
        }},
      loadedMetadata: {phasedRegistrationNames: {
          bubbled: keyOf({onLoadedMetadata: true}),
          captured: keyOf({onLoadedMetadataCapture: true})
        }},
      loadStart: {phasedRegistrationNames: {
          bubbled: keyOf({onLoadStart: true}),
          captured: keyOf({onLoadStartCapture: true})
        }},
      mouseDown: {phasedRegistrationNames: {
          bubbled: keyOf({onMouseDown: true}),
          captured: keyOf({onMouseDownCapture: true})
        }},
      mouseMove: {phasedRegistrationNames: {
          bubbled: keyOf({onMouseMove: true}),
          captured: keyOf({onMouseMoveCapture: true})
        }},
      mouseOut: {phasedRegistrationNames: {
          bubbled: keyOf({onMouseOut: true}),
          captured: keyOf({onMouseOutCapture: true})
        }},
      mouseOver: {phasedRegistrationNames: {
          bubbled: keyOf({onMouseOver: true}),
          captured: keyOf({onMouseOverCapture: true})
        }},
      mouseUp: {phasedRegistrationNames: {
          bubbled: keyOf({onMouseUp: true}),
          captured: keyOf({onMouseUpCapture: true})
        }},
      paste: {phasedRegistrationNames: {
          bubbled: keyOf({onPaste: true}),
          captured: keyOf({onPasteCapture: true})
        }},
      pause: {phasedRegistrationNames: {
          bubbled: keyOf({onPause: true}),
          captured: keyOf({onPauseCapture: true})
        }},
      play: {phasedRegistrationNames: {
          bubbled: keyOf({onPlay: true}),
          captured: keyOf({onPlayCapture: true})
        }},
      playing: {phasedRegistrationNames: {
          bubbled: keyOf({onPlaying: true}),
          captured: keyOf({onPlayingCapture: true})
        }},
      progress: {phasedRegistrationNames: {
          bubbled: keyOf({onProgress: true}),
          captured: keyOf({onProgressCapture: true})
        }},
      rateChange: {phasedRegistrationNames: {
          bubbled: keyOf({onRateChange: true}),
          captured: keyOf({onRateChangeCapture: true})
        }},
      reset: {phasedRegistrationNames: {
          bubbled: keyOf({onReset: true}),
          captured: keyOf({onResetCapture: true})
        }},
      scroll: {phasedRegistrationNames: {
          bubbled: keyOf({onScroll: true}),
          captured: keyOf({onScrollCapture: true})
        }},
      seeked: {phasedRegistrationNames: {
          bubbled: keyOf({onSeeked: true}),
          captured: keyOf({onSeekedCapture: true})
        }},
      seeking: {phasedRegistrationNames: {
          bubbled: keyOf({onSeeking: true}),
          captured: keyOf({onSeekingCapture: true})
        }},
      stalled: {phasedRegistrationNames: {
          bubbled: keyOf({onStalled: true}),
          captured: keyOf({onStalledCapture: true})
        }},
      submit: {phasedRegistrationNames: {
          bubbled: keyOf({onSubmit: true}),
          captured: keyOf({onSubmitCapture: true})
        }},
      suspend: {phasedRegistrationNames: {
          bubbled: keyOf({onSuspend: true}),
          captured: keyOf({onSuspendCapture: true})
        }},
      timeUpdate: {phasedRegistrationNames: {
          bubbled: keyOf({onTimeUpdate: true}),
          captured: keyOf({onTimeUpdateCapture: true})
        }},
      touchCancel: {phasedRegistrationNames: {
          bubbled: keyOf({onTouchCancel: true}),
          captured: keyOf({onTouchCancelCapture: true})
        }},
      touchEnd: {phasedRegistrationNames: {
          bubbled: keyOf({onTouchEnd: true}),
          captured: keyOf({onTouchEndCapture: true})
        }},
      touchMove: {phasedRegistrationNames: {
          bubbled: keyOf({onTouchMove: true}),
          captured: keyOf({onTouchMoveCapture: true})
        }},
      touchStart: {phasedRegistrationNames: {
          bubbled: keyOf({onTouchStart: true}),
          captured: keyOf({onTouchStartCapture: true})
        }},
      volumeChange: {phasedRegistrationNames: {
          bubbled: keyOf({onVolumeChange: true}),
          captured: keyOf({onVolumeChangeCapture: true})
        }},
      waiting: {phasedRegistrationNames: {
          bubbled: keyOf({onWaiting: true}),
          captured: keyOf({onWaitingCapture: true})
        }},
      wheel: {phasedRegistrationNames: {
          bubbled: keyOf({onWheel: true}),
          captured: keyOf({onWheelCapture: true})
        }}
    };
    var topLevelEventsToDispatchConfig = {
      topAbort: eventTypes.abort,
      topBlur: eventTypes.blur,
      topCanPlay: eventTypes.canPlay,
      topCanPlayThrough: eventTypes.canPlayThrough,
      topClick: eventTypes.click,
      topContextMenu: eventTypes.contextMenu,
      topCopy: eventTypes.copy,
      topCut: eventTypes.cut,
      topDoubleClick: eventTypes.doubleClick,
      topDrag: eventTypes.drag,
      topDragEnd: eventTypes.dragEnd,
      topDragEnter: eventTypes.dragEnter,
      topDragExit: eventTypes.dragExit,
      topDragLeave: eventTypes.dragLeave,
      topDragOver: eventTypes.dragOver,
      topDragStart: eventTypes.dragStart,
      topDrop: eventTypes.drop,
      topDurationChange: eventTypes.durationChange,
      topEmptied: eventTypes.emptied,
      topEncrypted: eventTypes.encrypted,
      topEnded: eventTypes.ended,
      topError: eventTypes.error,
      topFocus: eventTypes.focus,
      topInput: eventTypes.input,
      topKeyDown: eventTypes.keyDown,
      topKeyPress: eventTypes.keyPress,
      topKeyUp: eventTypes.keyUp,
      topLoad: eventTypes.load,
      topLoadedData: eventTypes.loadedData,
      topLoadedMetadata: eventTypes.loadedMetadata,
      topLoadStart: eventTypes.loadStart,
      topMouseDown: eventTypes.mouseDown,
      topMouseMove: eventTypes.mouseMove,
      topMouseOut: eventTypes.mouseOut,
      topMouseOver: eventTypes.mouseOver,
      topMouseUp: eventTypes.mouseUp,
      topPaste: eventTypes.paste,
      topPause: eventTypes.pause,
      topPlay: eventTypes.play,
      topPlaying: eventTypes.playing,
      topProgress: eventTypes.progress,
      topRateChange: eventTypes.rateChange,
      topReset: eventTypes.reset,
      topScroll: eventTypes.scroll,
      topSeeked: eventTypes.seeked,
      topSeeking: eventTypes.seeking,
      topStalled: eventTypes.stalled,
      topSubmit: eventTypes.submit,
      topSuspend: eventTypes.suspend,
      topTimeUpdate: eventTypes.timeUpdate,
      topTouchCancel: eventTypes.touchCancel,
      topTouchEnd: eventTypes.touchEnd,
      topTouchMove: eventTypes.touchMove,
      topTouchStart: eventTypes.touchStart,
      topVolumeChange: eventTypes.volumeChange,
      topWaiting: eventTypes.waiting,
      topWheel: eventTypes.wheel
    };
    for (var type in topLevelEventsToDispatchConfig) {
      topLevelEventsToDispatchConfig[type].dependencies = [type];
    }
    var ON_CLICK_KEY = keyOf({onClick: null});
    var onClickListeners = {};
    var SimpleEventPlugin = {
      eventTypes: eventTypes,
      extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent, nativeEventTarget) {
        var dispatchConfig = topLevelEventsToDispatchConfig[topLevelType];
        if (!dispatchConfig) {
          return null;
        }
        var EventConstructor;
        switch (topLevelType) {
          case topLevelTypes.topAbort:
          case topLevelTypes.topCanPlay:
          case topLevelTypes.topCanPlayThrough:
          case topLevelTypes.topDurationChange:
          case topLevelTypes.topEmptied:
          case topLevelTypes.topEncrypted:
          case topLevelTypes.topEnded:
          case topLevelTypes.topError:
          case topLevelTypes.topInput:
          case topLevelTypes.topLoad:
          case topLevelTypes.topLoadedData:
          case topLevelTypes.topLoadedMetadata:
          case topLevelTypes.topLoadStart:
          case topLevelTypes.topPause:
          case topLevelTypes.topPlay:
          case topLevelTypes.topPlaying:
          case topLevelTypes.topProgress:
          case topLevelTypes.topRateChange:
          case topLevelTypes.topReset:
          case topLevelTypes.topSeeked:
          case topLevelTypes.topSeeking:
          case topLevelTypes.topStalled:
          case topLevelTypes.topSubmit:
          case topLevelTypes.topSuspend:
          case topLevelTypes.topTimeUpdate:
          case topLevelTypes.topVolumeChange:
          case topLevelTypes.topWaiting:
            EventConstructor = SyntheticEvent;
            break;
          case topLevelTypes.topKeyPress:
            if (getEventCharCode(nativeEvent) === 0) {
              return null;
            }
          case topLevelTypes.topKeyDown:
          case topLevelTypes.topKeyUp:
            EventConstructor = SyntheticKeyboardEvent;
            break;
          case topLevelTypes.topBlur:
          case topLevelTypes.topFocus:
            EventConstructor = SyntheticFocusEvent;
            break;
          case topLevelTypes.topClick:
            if (nativeEvent.button === 2) {
              return null;
            }
          case topLevelTypes.topContextMenu:
          case topLevelTypes.topDoubleClick:
          case topLevelTypes.topMouseDown:
          case topLevelTypes.topMouseMove:
          case topLevelTypes.topMouseOut:
          case topLevelTypes.topMouseOver:
          case topLevelTypes.topMouseUp:
            EventConstructor = SyntheticMouseEvent;
            break;
          case topLevelTypes.topDrag:
          case topLevelTypes.topDragEnd:
          case topLevelTypes.topDragEnter:
          case topLevelTypes.topDragExit:
          case topLevelTypes.topDragLeave:
          case topLevelTypes.topDragOver:
          case topLevelTypes.topDragStart:
          case topLevelTypes.topDrop:
            EventConstructor = SyntheticDragEvent;
            break;
          case topLevelTypes.topTouchCancel:
          case topLevelTypes.topTouchEnd:
          case topLevelTypes.topTouchMove:
          case topLevelTypes.topTouchStart:
            EventConstructor = SyntheticTouchEvent;
            break;
          case topLevelTypes.topScroll:
            EventConstructor = SyntheticUIEvent;
            break;
          case topLevelTypes.topWheel:
            EventConstructor = SyntheticWheelEvent;
            break;
          case topLevelTypes.topCopy:
          case topLevelTypes.topCut:
          case topLevelTypes.topPaste:
            EventConstructor = SyntheticClipboardEvent;
            break;
        }
        !EventConstructor ? process.env.NODE_ENV !== 'production' ? invariant(false, 'SimpleEventPlugin: Unhandled event type, `%s`.', topLevelType) : invariant(false) : undefined;
        var event = EventConstructor.getPooled(dispatchConfig, topLevelTargetID, nativeEvent, nativeEventTarget);
        EventPropagators.accumulateTwoPhaseDispatches(event);
        return event;
      },
      didPutListener: function(id, registrationName, listener) {
        if (registrationName === ON_CLICK_KEY) {
          var node = ReactMount.getNode(id);
          if (!onClickListeners[id]) {
            onClickListeners[id] = EventListener.listen(node, 'click', emptyFunction);
          }
        }
      },
      willDeleteListener: function(id, registrationName) {
        if (registrationName === ON_CLICK_KEY) {
          onClickListeners[id].remove();
          delete onClickListeners[id];
        }
      }
    };
    module.exports = SimpleEventPlugin;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b4", ["3e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var DOMProperty = req('3e');
  var MUST_USE_ATTRIBUTE = DOMProperty.injection.MUST_USE_ATTRIBUTE;
  var NS = {
    xlink: 'http://www.w3.org/1999/xlink',
    xml: 'http://www.w3.org/XML/1998/namespace'
  };
  var SVGDOMPropertyConfig = {
    Properties: {
      clipPath: MUST_USE_ATTRIBUTE,
      cx: MUST_USE_ATTRIBUTE,
      cy: MUST_USE_ATTRIBUTE,
      d: MUST_USE_ATTRIBUTE,
      dx: MUST_USE_ATTRIBUTE,
      dy: MUST_USE_ATTRIBUTE,
      fill: MUST_USE_ATTRIBUTE,
      fillOpacity: MUST_USE_ATTRIBUTE,
      fontFamily: MUST_USE_ATTRIBUTE,
      fontSize: MUST_USE_ATTRIBUTE,
      fx: MUST_USE_ATTRIBUTE,
      fy: MUST_USE_ATTRIBUTE,
      gradientTransform: MUST_USE_ATTRIBUTE,
      gradientUnits: MUST_USE_ATTRIBUTE,
      markerEnd: MUST_USE_ATTRIBUTE,
      markerMid: MUST_USE_ATTRIBUTE,
      markerStart: MUST_USE_ATTRIBUTE,
      offset: MUST_USE_ATTRIBUTE,
      opacity: MUST_USE_ATTRIBUTE,
      patternContentUnits: MUST_USE_ATTRIBUTE,
      patternUnits: MUST_USE_ATTRIBUTE,
      points: MUST_USE_ATTRIBUTE,
      preserveAspectRatio: MUST_USE_ATTRIBUTE,
      r: MUST_USE_ATTRIBUTE,
      rx: MUST_USE_ATTRIBUTE,
      ry: MUST_USE_ATTRIBUTE,
      spreadMethod: MUST_USE_ATTRIBUTE,
      stopColor: MUST_USE_ATTRIBUTE,
      stopOpacity: MUST_USE_ATTRIBUTE,
      stroke: MUST_USE_ATTRIBUTE,
      strokeDasharray: MUST_USE_ATTRIBUTE,
      strokeLinecap: MUST_USE_ATTRIBUTE,
      strokeOpacity: MUST_USE_ATTRIBUTE,
      strokeWidth: MUST_USE_ATTRIBUTE,
      textAnchor: MUST_USE_ATTRIBUTE,
      transform: MUST_USE_ATTRIBUTE,
      version: MUST_USE_ATTRIBUTE,
      viewBox: MUST_USE_ATTRIBUTE,
      x1: MUST_USE_ATTRIBUTE,
      x2: MUST_USE_ATTRIBUTE,
      x: MUST_USE_ATTRIBUTE,
      xlinkActuate: MUST_USE_ATTRIBUTE,
      xlinkArcrole: MUST_USE_ATTRIBUTE,
      xlinkHref: MUST_USE_ATTRIBUTE,
      xlinkRole: MUST_USE_ATTRIBUTE,
      xlinkShow: MUST_USE_ATTRIBUTE,
      xlinkTitle: MUST_USE_ATTRIBUTE,
      xlinkType: MUST_USE_ATTRIBUTE,
      xmlBase: MUST_USE_ATTRIBUTE,
      xmlLang: MUST_USE_ATTRIBUTE,
      xmlSpace: MUST_USE_ATTRIBUTE,
      y1: MUST_USE_ATTRIBUTE,
      y2: MUST_USE_ATTRIBUTE,
      y: MUST_USE_ATTRIBUTE
    },
    DOMAttributeNamespaces: {
      xlinkActuate: NS.xlink,
      xlinkArcrole: NS.xlink,
      xlinkHref: NS.xlink,
      xlinkRole: NS.xlink,
      xlinkShow: NS.xlink,
      xlinkTitle: NS.xlink,
      xlinkType: NS.xlink,
      xmlBase: NS.xml,
      xmlLang: NS.xml,
      xmlSpace: NS.xml
    },
    DOMAttributeNames: {
      clipPath: 'clip-path',
      fillOpacity: 'fill-opacity',
      fontFamily: 'font-family',
      fontSize: 'font-size',
      gradientTransform: 'gradientTransform',
      gradientUnits: 'gradientUnits',
      markerEnd: 'marker-end',
      markerMid: 'marker-mid',
      markerStart: 'marker-start',
      patternContentUnits: 'patternContentUnits',
      patternUnits: 'patternUnits',
      preserveAspectRatio: 'preserveAspectRatio',
      spreadMethod: 'spreadMethod',
      stopColor: 'stop-color',
      stopOpacity: 'stop-opacity',
      strokeDasharray: 'stroke-dasharray',
      strokeLinecap: 'stroke-linecap',
      strokeOpacity: 'stroke-opacity',
      strokeWidth: 'stroke-width',
      textAnchor: 'text-anchor',
      viewBox: 'viewBox',
      xlinkActuate: 'xlink:actuate',
      xlinkArcrole: 'xlink:arcrole',
      xlinkHref: 'xlink:href',
      xlinkRole: 'xlink:role',
      xlinkShow: 'xlink:show',
      xlinkTitle: 'xlink:title',
      xlinkType: 'xlink:type',
      xmlBase: 'xml:base',
      xmlLang: 'xml:lang',
      xmlSpace: 'xml:space'
    }
  };
  module.exports = SVGDOMPropertyConfig;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b5", ["4b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var assign = req('4b');
  var DONT_CARE_THRESHOLD = 1.2;
  var DOM_OPERATION_TYPES = {
    '_mountImageIntoNode': 'set innerHTML',
    INSERT_MARKUP: 'set innerHTML',
    MOVE_EXISTING: 'move',
    REMOVE_NODE: 'remove',
    SET_MARKUP: 'set innerHTML',
    TEXT_CONTENT: 'set textContent',
    'setValueForProperty': 'update attribute',
    'setValueForAttribute': 'update attribute',
    'deleteValueForProperty': 'remove attribute',
    'dangerouslyReplaceNodeWithMarkupByID': 'replace'
  };
  function getTotalTime(measurements) {
    var totalTime = 0;
    for (var i = 0; i < measurements.length; i++) {
      var measurement = measurements[i];
      totalTime += measurement.totalTime;
    }
    return totalTime;
  }
  function getDOMSummary(measurements) {
    var items = [];
    measurements.forEach(function(measurement) {
      Object.keys(measurement.writes).forEach(function(id) {
        measurement.writes[id].forEach(function(write) {
          items.push({
            id: id,
            type: DOM_OPERATION_TYPES[write.type] || write.type,
            args: write.args
          });
        });
      });
    });
    return items;
  }
  function getExclusiveSummary(measurements) {
    var candidates = {};
    var displayName;
    for (var i = 0; i < measurements.length; i++) {
      var measurement = measurements[i];
      var allIDs = assign({}, measurement.exclusive, measurement.inclusive);
      for (var id in allIDs) {
        displayName = measurement.displayNames[id].current;
        candidates[displayName] = candidates[displayName] || {
          componentName: displayName,
          inclusive: 0,
          exclusive: 0,
          render: 0,
          count: 0
        };
        if (measurement.render[id]) {
          candidates[displayName].render += measurement.render[id];
        }
        if (measurement.exclusive[id]) {
          candidates[displayName].exclusive += measurement.exclusive[id];
        }
        if (measurement.inclusive[id]) {
          candidates[displayName].inclusive += measurement.inclusive[id];
        }
        if (measurement.counts[id]) {
          candidates[displayName].count += measurement.counts[id];
        }
      }
    }
    var arr = [];
    for (displayName in candidates) {
      if (candidates[displayName].exclusive >= DONT_CARE_THRESHOLD) {
        arr.push(candidates[displayName]);
      }
    }
    arr.sort(function(a, b) {
      return b.exclusive - a.exclusive;
    });
    return arr;
  }
  function getInclusiveSummary(measurements, onlyClean) {
    var candidates = {};
    var inclusiveKey;
    for (var i = 0; i < measurements.length; i++) {
      var measurement = measurements[i];
      var allIDs = assign({}, measurement.exclusive, measurement.inclusive);
      var cleanComponents;
      if (onlyClean) {
        cleanComponents = getUnchangedComponents(measurement);
      }
      for (var id in allIDs) {
        if (onlyClean && !cleanComponents[id]) {
          continue;
        }
        var displayName = measurement.displayNames[id];
        inclusiveKey = displayName.owner + ' > ' + displayName.current;
        candidates[inclusiveKey] = candidates[inclusiveKey] || {
          componentName: inclusiveKey,
          time: 0,
          count: 0
        };
        if (measurement.inclusive[id]) {
          candidates[inclusiveKey].time += measurement.inclusive[id];
        }
        if (measurement.counts[id]) {
          candidates[inclusiveKey].count += measurement.counts[id];
        }
      }
    }
    var arr = [];
    for (inclusiveKey in candidates) {
      if (candidates[inclusiveKey].time >= DONT_CARE_THRESHOLD) {
        arr.push(candidates[inclusiveKey]);
      }
    }
    arr.sort(function(a, b) {
      return b.time - a.time;
    });
    return arr;
  }
  function getUnchangedComponents(measurement) {
    var cleanComponents = {};
    var dirtyLeafIDs = Object.keys(measurement.writes);
    var allIDs = assign({}, measurement.exclusive, measurement.inclusive);
    for (var id in allIDs) {
      var isDirty = false;
      for (var i = 0; i < dirtyLeafIDs.length; i++) {
        if (dirtyLeafIDs[i].indexOf(id) === 0) {
          isDirty = true;
          break;
        }
      }
      if (measurement.created[id]) {
        isDirty = true;
      }
      if (!isDirty && measurement.counts[id] > 0) {
        cleanComponents[id] = true;
      }
    }
    return cleanComponents;
  }
  var ReactDefaultPerfAnalysis = {
    getExclusiveSummary: getExclusiveSummary,
    getInclusiveSummary: getInclusiveSummary,
    getDOMSummary: getDOMSummary,
    getTotalTime: getTotalTime
  };
  module.exports = ReactDefaultPerfAnalysis;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b6", ["2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ExecutionEnvironment = req('2b');
  var performance;
  if (ExecutionEnvironment.canUseDOM) {
    performance = window.performance || window.msPerformance || window.webkitPerformance;
  }
  module.exports = performance || {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b7", ["b6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var performance = req('b6');
  var curPerformance = performance;
  if (!curPerformance || !curPerformance.now) {
    curPerformance = Date;
  }
  var performanceNow = curPerformance.now.bind(curPerformance);
  module.exports = performanceNow;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b8", ["3e", "b5", "6b", "39", "b7"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var DOMProperty = req('3e');
  var ReactDefaultPerfAnalysis = req('b5');
  var ReactMount = req('6b');
  var ReactPerf = req('39');
  var performanceNow = req('b7');
  function roundFloat(val) {
    return Math.floor(val * 100) / 100;
  }
  function addValue(obj, key, val) {
    obj[key] = (obj[key] || 0) + val;
  }
  var ReactDefaultPerf = {
    _allMeasurements: [],
    _mountStack: [0],
    _injected: false,
    start: function() {
      if (!ReactDefaultPerf._injected) {
        ReactPerf.injection.injectMeasure(ReactDefaultPerf.measure);
      }
      ReactDefaultPerf._allMeasurements.length = 0;
      ReactPerf.enableMeasure = true;
    },
    stop: function() {
      ReactPerf.enableMeasure = false;
    },
    getLastMeasurements: function() {
      return ReactDefaultPerf._allMeasurements;
    },
    printExclusive: function(measurements) {
      measurements = measurements || ReactDefaultPerf._allMeasurements;
      var summary = ReactDefaultPerfAnalysis.getExclusiveSummary(measurements);
      console.table(summary.map(function(item) {
        return {
          'Component class name': item.componentName,
          'Total inclusive time (ms)': roundFloat(item.inclusive),
          'Exclusive mount time (ms)': roundFloat(item.exclusive),
          'Exclusive render time (ms)': roundFloat(item.render),
          'Mount time per instance (ms)': roundFloat(item.exclusive / item.count),
          'Render time per instance (ms)': roundFloat(item.render / item.count),
          'Instances': item.count
        };
      }));
    },
    printInclusive: function(measurements) {
      measurements = measurements || ReactDefaultPerf._allMeasurements;
      var summary = ReactDefaultPerfAnalysis.getInclusiveSummary(measurements);
      console.table(summary.map(function(item) {
        return {
          'Owner > component': item.componentName,
          'Inclusive time (ms)': roundFloat(item.time),
          'Instances': item.count
        };
      }));
      console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
    },
    getMeasurementsSummaryMap: function(measurements) {
      var summary = ReactDefaultPerfAnalysis.getInclusiveSummary(measurements, true);
      return summary.map(function(item) {
        return {
          'Owner > component': item.componentName,
          'Wasted time (ms)': item.time,
          'Instances': item.count
        };
      });
    },
    printWasted: function(measurements) {
      measurements = measurements || ReactDefaultPerf._allMeasurements;
      console.table(ReactDefaultPerf.getMeasurementsSummaryMap(measurements));
      console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
    },
    printDOM: function(measurements) {
      measurements = measurements || ReactDefaultPerf._allMeasurements;
      var summary = ReactDefaultPerfAnalysis.getDOMSummary(measurements);
      console.table(summary.map(function(item) {
        var result = {};
        result[DOMProperty.ID_ATTRIBUTE_NAME] = item.id;
        result.type = item.type;
        result.args = JSON.stringify(item.args);
        return result;
      }));
      console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
    },
    _recordWrite: function(id, fnName, totalTime, args) {
      var writes = ReactDefaultPerf._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1].writes;
      writes[id] = writes[id] || [];
      writes[id].push({
        type: fnName,
        time: totalTime,
        args: args
      });
    },
    measure: function(moduleName, fnName, func) {
      return function() {
        for (var _len = arguments.length,
            args = Array(_len),
            _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        var totalTime;
        var rv;
        var start;
        if (fnName === '_renderNewRootComponent' || fnName === 'flushBatchedUpdates') {
          ReactDefaultPerf._allMeasurements.push({
            exclusive: {},
            inclusive: {},
            render: {},
            counts: {},
            writes: {},
            displayNames: {},
            totalTime: 0,
            created: {}
          });
          start = performanceNow();
          rv = func.apply(this, args);
          ReactDefaultPerf._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1].totalTime = performanceNow() - start;
          return rv;
        } else if (fnName === '_mountImageIntoNode' || moduleName === 'ReactBrowserEventEmitter' || moduleName === 'ReactDOMIDOperations' || moduleName === 'CSSPropertyOperations' || moduleName === 'DOMChildrenOperations' || moduleName === 'DOMPropertyOperations') {
          start = performanceNow();
          rv = func.apply(this, args);
          totalTime = performanceNow() - start;
          if (fnName === '_mountImageIntoNode') {
            var mountID = ReactMount.getID(args[1]);
            ReactDefaultPerf._recordWrite(mountID, fnName, totalTime, args[0]);
          } else if (fnName === 'dangerouslyProcessChildrenUpdates') {
            args[0].forEach(function(update) {
              var writeArgs = {};
              if (update.fromIndex !== null) {
                writeArgs.fromIndex = update.fromIndex;
              }
              if (update.toIndex !== null) {
                writeArgs.toIndex = update.toIndex;
              }
              if (update.textContent !== null) {
                writeArgs.textContent = update.textContent;
              }
              if (update.markupIndex !== null) {
                writeArgs.markup = args[1][update.markupIndex];
              }
              ReactDefaultPerf._recordWrite(update.parentID, update.type, totalTime, writeArgs);
            });
          } else {
            var id = args[0];
            if (typeof id === 'object') {
              id = ReactMount.getID(args[0]);
            }
            ReactDefaultPerf._recordWrite(id, fnName, totalTime, Array.prototype.slice.call(args, 1));
          }
          return rv;
        } else if (moduleName === 'ReactCompositeComponent' && (fnName === 'mountComponent' || fnName === 'updateComponent' || fnName === '_renderValidatedComponent')) {
          if (this._currentElement.type === ReactMount.TopLevelWrapper) {
            return func.apply(this, args);
          }
          var rootNodeID = fnName === 'mountComponent' ? args[0] : this._rootNodeID;
          var isRender = fnName === '_renderValidatedComponent';
          var isMount = fnName === 'mountComponent';
          var mountStack = ReactDefaultPerf._mountStack;
          var entry = ReactDefaultPerf._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1];
          if (isRender) {
            addValue(entry.counts, rootNodeID, 1);
          } else if (isMount) {
            entry.created[rootNodeID] = true;
            mountStack.push(0);
          }
          start = performanceNow();
          rv = func.apply(this, args);
          totalTime = performanceNow() - start;
          if (isRender) {
            addValue(entry.render, rootNodeID, totalTime);
          } else if (isMount) {
            var subMountTime = mountStack.pop();
            mountStack[mountStack.length - 1] += totalTime;
            addValue(entry.exclusive, rootNodeID, totalTime - subMountTime);
            addValue(entry.inclusive, rootNodeID, totalTime);
          } else {
            addValue(entry.inclusive, rootNodeID, totalTime);
          }
          entry.displayNames[rootNodeID] = {
            current: this.getName(),
            owner: this._currentElement._owner ? this._currentElement._owner.getName() : '<root>'
          };
          return rv;
        } else {
          return func.apply(this, args);
        }
      };
    }
  };
  module.exports = ReactDefaultPerf;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b9", ["76", "79", "7a", "7b", "7f", "2b", "80", "82", "6d", "83", "9c", "6e", "9f", "a3", "52", "6b", "a8", "a9", "aa", "b3", "b4", "b8", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var BeforeInputEventPlugin = req('76');
    var ChangeEventPlugin = req('79');
    var ClientReactRootIndex = req('7a');
    var DefaultEventPluginOrder = req('7b');
    var EnterLeaveEventPlugin = req('7f');
    var ExecutionEnvironment = req('2b');
    var HTMLDOMPropertyConfig = req('80');
    var ReactBrowserComponentMixin = req('82');
    var ReactComponentBrowserEnvironment = req('6d');
    var ReactDefaultBatchingStrategy = req('83');
    var ReactDOMComponent = req('9c');
    var ReactDOMTextComponent = req('6e');
    var ReactEventListener = req('9f');
    var ReactInjection = req('a3');
    var ReactInstanceHandles = req('52');
    var ReactMount = req('6b');
    var ReactReconcileTransaction = req('a8');
    var SelectEventPlugin = req('a9');
    var ServerReactRootIndex = req('aa');
    var SimpleEventPlugin = req('b3');
    var SVGDOMPropertyConfig = req('b4');
    var alreadyInjected = false;
    function inject() {
      if (alreadyInjected) {
        return;
      }
      alreadyInjected = true;
      ReactInjection.EventEmitter.injectReactEventListener(ReactEventListener);
      ReactInjection.EventPluginHub.injectEventPluginOrder(DefaultEventPluginOrder);
      ReactInjection.EventPluginHub.injectInstanceHandle(ReactInstanceHandles);
      ReactInjection.EventPluginHub.injectMount(ReactMount);
      ReactInjection.EventPluginHub.injectEventPluginsByName({
        SimpleEventPlugin: SimpleEventPlugin,
        EnterLeaveEventPlugin: EnterLeaveEventPlugin,
        ChangeEventPlugin: ChangeEventPlugin,
        SelectEventPlugin: SelectEventPlugin,
        BeforeInputEventPlugin: BeforeInputEventPlugin
      });
      ReactInjection.NativeComponent.injectGenericComponentClass(ReactDOMComponent);
      ReactInjection.NativeComponent.injectTextComponentClass(ReactDOMTextComponent);
      ReactInjection.Class.injectMixin(ReactBrowserComponentMixin);
      ReactInjection.DOMProperty.injectDOMPropertyConfig(HTMLDOMPropertyConfig);
      ReactInjection.DOMProperty.injectDOMPropertyConfig(SVGDOMPropertyConfig);
      ReactInjection.EmptyComponent.injectEmptyComponent('noscript');
      ReactInjection.Updates.injectReconcileTransaction(ReactReconcileTransaction);
      ReactInjection.Updates.injectBatchingStrategy(ReactDefaultBatchingStrategy);
      ReactInjection.RootIndex.injectCreateReactRootIndex(ExecutionEnvironment.canUseDOM ? ClientReactRootIndex.createReactRootIndex : ServerReactRootIndex.createReactRootIndex);
      ReactInjection.Component.injectEnvironment(ReactComponentBrowserEnvironment);
      if (process.env.NODE_ENV !== 'production') {
        var url = ExecutionEnvironment.canUseDOM && window.location.href || '';
        if (/[?&]react_perf\b/.test(url)) {
          var ReactDefaultPerf = req('b8');
          ReactDefaultPerf.start();
        }
      }
    }
    module.exports = {inject: inject};
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ba", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = '0.14.0';
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("bb", ["6b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactMount = req('6b');
  module.exports = ReactMount.renderSubtreeIntoContainer;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("bc", ["2a", "6e", "b9", "52", "6b", "39", "58", "5c", "ba", "81", "bb", "40", "2b", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactCurrentOwner = req('2a');
    var ReactDOMTextComponent = req('6e');
    var ReactDefaultInjection = req('b9');
    var ReactInstanceHandles = req('52');
    var ReactMount = req('6b');
    var ReactPerf = req('39');
    var ReactReconciler = req('58');
    var ReactUpdates = req('5c');
    var ReactVersion = req('ba');
    var findDOMNode = req('81');
    var renderSubtreeIntoContainer = req('bb');
    var warning = req('40');
    ReactDefaultInjection.inject();
    var render = ReactPerf.measure('React', 'render', ReactMount.render);
    var React = {
      findDOMNode: findDOMNode,
      render: render,
      unmountComponentAtNode: ReactMount.unmountComponentAtNode,
      version: ReactVersion,
      unstable_batchedUpdates: ReactUpdates.batchedUpdates,
      unstable_renderSubtreeIntoContainer: renderSubtreeIntoContainer
    };
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.inject === 'function') {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.inject({
        CurrentOwner: ReactCurrentOwner,
        InstanceHandles: ReactInstanceHandles,
        Mount: ReactMount,
        Reconciler: ReactReconciler,
        TextComponent: ReactDOMTextComponent
      });
    }
    if (process.env.NODE_ENV !== 'production') {
      var ExecutionEnvironment = req('2b');
      if (ExecutionEnvironment.canUseDOM && window.top === window.self) {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
          if (navigator.userAgent.indexOf('Chrome') > -1 && navigator.userAgent.indexOf('Edge') === -1 || navigator.userAgent.indexOf('Firefox') > -1) {
            console.debug('Download the React DevTools for a better development experience: ' + 'https://fb.me/react-devtools');
          }
        }
        var ieCompatibilityMode = document.documentMode && document.documentMode < 8;
        process.env.NODE_ENV !== 'production' ? warning(!ieCompatibilityMode, 'Internet Explorer is running in compatibility mode; please add the ' + 'following tag to your HTML to prevent this from happening: ' + '<meta http-equiv="X-UA-Compatible" content="IE=edge" />') : undefined;
        var expectedFeatures = [Array.isArray, Array.prototype.every, Array.prototype.forEach, Array.prototype.indexOf, Array.prototype.map, Date.now, Function.prototype.bind, Object.keys, String.prototype.split, String.prototype.trim, Object.create, Object.freeze];
        for (var i = 0; i < expectedFeatures.length; i++) {
          if (!expectedFeatures[i]) {
            console.error('One or more ES5 shim/shams expected by React are not available: ' + 'https://fb.me/react-warning-polyfills');
            break;
          }
        }
      }
    }
    module.exports = React;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("bd", ["bc"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = req('bc');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("be", ["bd"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('bd');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("bf", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactServerBatchingStrategy = {
    isBatchingUpdates: false,
    batchedUpdates: function(callback) {}
  };
  module.exports = ReactServerBatchingStrategy;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c0", ["59", "5a", "5b", "4b", "35"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var PooledClass = req('59');
  var CallbackQueue = req('5a');
  var Transaction = req('5b');
  var assign = req('4b');
  var emptyFunction = req('35');
  var ON_DOM_READY_QUEUEING = {
    initialize: function() {
      this.reactMountReady.reset();
    },
    close: emptyFunction
  };
  var TRANSACTION_WRAPPERS = [ON_DOM_READY_QUEUEING];
  function ReactServerRenderingTransaction(renderToStaticMarkup) {
    this.reinitializeTransaction();
    this.renderToStaticMarkup = renderToStaticMarkup;
    this.reactMountReady = CallbackQueue.getPooled(null);
    this.useCreateElement = false;
  }
  var Mixin = {
    getTransactionWrappers: function() {
      return TRANSACTION_WRAPPERS;
    },
    getReactMountReady: function() {
      return this.reactMountReady;
    },
    destructor: function() {
      CallbackQueue.release(this.reactMountReady);
      this.reactMountReady = null;
    }
  };
  assign(ReactServerRenderingTransaction.prototype, Transaction.Mixin, Mixin);
  PooledClass.addPoolingTo(ReactServerRenderingTransaction);
  module.exports = ReactServerRenderingTransaction;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c1", ["83", "4f", "52", "55", "bf", "c0", "5c", "5e", "69", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactDefaultBatchingStrategy = req('83');
    var ReactElement = req('4f');
    var ReactInstanceHandles = req('52');
    var ReactMarkupChecksum = req('55');
    var ReactServerBatchingStrategy = req('bf');
    var ReactServerRenderingTransaction = req('c0');
    var ReactUpdates = req('5c');
    var emptyObject = req('5e');
    var instantiateReactComponent = req('69');
    var invariant = req('30');
    function renderToString(element) {
      !ReactElement.isValidElement(element) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'renderToString(): You must pass a valid ReactElement.') : invariant(false) : undefined;
      var transaction;
      try {
        ReactUpdates.injection.injectBatchingStrategy(ReactServerBatchingStrategy);
        var id = ReactInstanceHandles.createReactRootID();
        transaction = ReactServerRenderingTransaction.getPooled(false);
        return transaction.perform(function() {
          var componentInstance = instantiateReactComponent(element, null);
          var markup = componentInstance.mountComponent(id, transaction, emptyObject);
          return ReactMarkupChecksum.addChecksumToMarkup(markup);
        }, null);
      } finally {
        ReactServerRenderingTransaction.release(transaction);
        ReactUpdates.injection.injectBatchingStrategy(ReactDefaultBatchingStrategy);
      }
    }
    function renderToStaticMarkup(element) {
      !ReactElement.isValidElement(element) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'renderToStaticMarkup(): You must pass a valid ReactElement.') : invariant(false) : undefined;
      var transaction;
      try {
        ReactUpdates.injection.injectBatchingStrategy(ReactServerBatchingStrategy);
        var id = ReactInstanceHandles.createReactRootID();
        transaction = ReactServerRenderingTransaction.getPooled(true);
        return transaction.perform(function() {
          var componentInstance = instantiateReactComponent(element, null);
          return componentInstance.mountComponent(id, transaction, emptyObject);
        }, null);
      } finally {
        ReactServerRenderingTransaction.release(transaction);
        ReactUpdates.injection.injectBatchingStrategy(ReactDefaultBatchingStrategy);
      }
    }
    module.exports = {
      renderToString: renderToString,
      renderToStaticMarkup: renderToStaticMarkup
    };
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c2", ["b9", "c1", "ba"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactDefaultInjection = req('b9');
  var ReactServerRendering = req('c1');
  var ReactVersion = req('ba');
  ReactDefaultInjection.inject();
  var ReactDOMServer = {
    renderToString: ReactServerRendering.renderToString,
    renderToStaticMarkup: ReactServerRendering.renderToStaticMarkup,
    version: ReactVersion
  };
  module.exports = ReactDOMServer;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c3", ["4f", "63", "64", "2a", "8f", "30", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactElement = req('4f');
    var ReactPropTypeLocations = req('63');
    var ReactPropTypeLocationNames = req('64');
    var ReactCurrentOwner = req('2a');
    var getIteratorFn = req('8f');
    var invariant = req('30');
    var warning = req('40');
    function getDeclarationErrorAddendum() {
      if (ReactCurrentOwner.current) {
        var name = ReactCurrentOwner.current.getName();
        if (name) {
          return ' Check the render method of `' + name + '`.';
        }
      }
      return '';
    }
    var ownerHasKeyUseWarning = {};
    var loggedTypeFailures = {};
    function validateExplicitKey(element, parentType) {
      if (!element._store || element._store.validated || element.key != null) {
        return;
      }
      element._store.validated = true;
      var addenda = getAddendaForKeyUse('uniqueKey', element, parentType);
      if (addenda === null) {
        return;
      }
      process.env.NODE_ENV !== 'production' ? warning(false, 'Each child in an array or iterator should have a unique "key" prop.' + '%s%s%s', addenda.parentOrOwner || '', addenda.childOwner || '', addenda.url || '') : undefined;
    }
    function getAddendaForKeyUse(messageType, element, parentType) {
      var addendum = getDeclarationErrorAddendum();
      if (!addendum) {
        var parentName = typeof parentType === 'string' ? parentType : parentType.displayName || parentType.name;
        if (parentName) {
          addendum = ' Check the top-level render call using <' + parentName + '>.';
        }
      }
      var memoizer = ownerHasKeyUseWarning[messageType] || (ownerHasKeyUseWarning[messageType] = {});
      if (memoizer[addendum]) {
        return null;
      }
      memoizer[addendum] = true;
      var addenda = {
        parentOrOwner: addendum,
        url: ' See https://fb.me/react-warning-keys for more information.',
        childOwner: null
      };
      if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
        addenda.childOwner = ' It was passed a child from ' + element._owner.getName() + '.';
      }
      return addenda;
    }
    function validateChildKeys(node, parentType) {
      if (typeof node !== 'object') {
        return;
      }
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) {
          var child = node[i];
          if (ReactElement.isValidElement(child)) {
            validateExplicitKey(child, parentType);
          }
        }
      } else if (ReactElement.isValidElement(node)) {
        if (node._store) {
          node._store.validated = true;
        }
      } else if (node) {
        var iteratorFn = getIteratorFn(node);
        if (iteratorFn) {
          if (iteratorFn !== node.entries) {
            var iterator = iteratorFn.call(node);
            var step;
            while (!(step = iterator.next()).done) {
              if (ReactElement.isValidElement(step.value)) {
                validateExplicitKey(step.value, parentType);
              }
            }
          }
        }
      }
    }
    function checkPropTypes(componentName, propTypes, props, location) {
      for (var propName in propTypes) {
        if (propTypes.hasOwnProperty(propName)) {
          var error;
          try {
            !(typeof propTypes[propName] === 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s: %s type `%s` is invalid; it must be a function, usually from ' + 'React.PropTypes.', componentName || 'React class', ReactPropTypeLocationNames[location], propName) : invariant(false) : undefined;
            error = propTypes[propName](props, propName, componentName, location);
          } catch (ex) {
            error = ex;
          }
          process.env.NODE_ENV !== 'production' ? warning(!error || error instanceof Error, '%s: type specification of %s `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', ReactPropTypeLocationNames[location], propName, typeof error) : undefined;
          if (error instanceof Error && !(error.message in loggedTypeFailures)) {
            loggedTypeFailures[error.message] = true;
            var addendum = getDeclarationErrorAddendum();
            process.env.NODE_ENV !== 'production' ? warning(false, 'Failed propType: %s%s', error.message, addendum) : undefined;
          }
        }
      }
    }
    function validatePropTypes(element) {
      var componentClass = element.type;
      if (typeof componentClass !== 'function') {
        return;
      }
      var name = componentClass.displayName || componentClass.name;
      if (componentClass.propTypes) {
        checkPropTypes(name, componentClass.propTypes, element.props, ReactPropTypeLocations.prop);
      }
      if (typeof componentClass.getDefaultProps === 'function') {
        process.env.NODE_ENV !== 'production' ? warning(componentClass.getDefaultProps.isReactClassApproved, 'getDefaultProps is only used on classic React.createClass ' + 'definitions. Use a static property named `defaultProps` instead.') : undefined;
      }
    }
    var ReactElementValidator = {
      createElement: function(type, props, children) {
        var validType = typeof type === 'string' || typeof type === 'function';
        process.env.NODE_ENV !== 'production' ? warning(validType, 'React.createElement: type should not be null, undefined, boolean, or ' + 'number. It should be a string (for DOM elements) or a ReactClass ' + '(for composite components).%s', getDeclarationErrorAddendum()) : undefined;
        var element = ReactElement.createElement.apply(this, arguments);
        if (element == null) {
          return element;
        }
        if (validType) {
          for (var i = 2; i < arguments.length; i++) {
            validateChildKeys(arguments[i], type);
          }
        }
        validatePropTypes(element);
        return element;
      },
      createFactory: function(type) {
        var validatedFactory = ReactElementValidator.createElement.bind(null, type);
        validatedFactory.type = type;
        if (process.env.NODE_ENV !== 'production') {
          try {
            Object.defineProperty(validatedFactory, 'type', {
              enumerable: false,
              get: function() {
                process.env.NODE_ENV !== 'production' ? warning(false, 'Factory.type is deprecated. Access the class directly ' + 'before passing it to createFactory.') : undefined;
                Object.defineProperty(this, 'type', {value: type});
                return type;
              }
            });
          } catch (x) {}
        }
        return validatedFactory;
      },
      cloneElement: function(element, props, children) {
        var newElement = ReactElement.cloneElement.apply(this, arguments);
        for (var i = 2; i < arguments.length; i++) {
          validateChildKeys(arguments[i], newElement.type);
        }
        validatePropTypes(newElement);
        return newElement;
      }
    };
    module.exports = ReactElementValidator;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c4", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  function mapObject(object, callback, context) {
    if (!object) {
      return null;
    }
    var result = {};
    for (var name in object) {
      if (hasOwnProperty.call(object, name)) {
        result[name] = callback.call(context, object[name], name, object);
      }
    }
    return result;
  }
  module.exports = mapObject;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c5", ["4f", "c3", "c4", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactElement = req('4f');
    var ReactElementValidator = req('c3');
    var mapObject = req('c4');
    function createDOMFactory(tag) {
      if (process.env.NODE_ENV !== 'production') {
        return ReactElementValidator.createFactory(tag);
      }
      return ReactElement.createFactory(tag);
    }
    var ReactDOMFactories = mapObject({
      a: 'a',
      abbr: 'abbr',
      address: 'address',
      area: 'area',
      article: 'article',
      aside: 'aside',
      audio: 'audio',
      b: 'b',
      base: 'base',
      bdi: 'bdi',
      bdo: 'bdo',
      big: 'big',
      blockquote: 'blockquote',
      body: 'body',
      br: 'br',
      button: 'button',
      canvas: 'canvas',
      caption: 'caption',
      cite: 'cite',
      code: 'code',
      col: 'col',
      colgroup: 'colgroup',
      data: 'data',
      datalist: 'datalist',
      dd: 'dd',
      del: 'del',
      details: 'details',
      dfn: 'dfn',
      dialog: 'dialog',
      div: 'div',
      dl: 'dl',
      dt: 'dt',
      em: 'em',
      embed: 'embed',
      fieldset: 'fieldset',
      figcaption: 'figcaption',
      figure: 'figure',
      footer: 'footer',
      form: 'form',
      h1: 'h1',
      h2: 'h2',
      h3: 'h3',
      h4: 'h4',
      h5: 'h5',
      h6: 'h6',
      head: 'head',
      header: 'header',
      hgroup: 'hgroup',
      hr: 'hr',
      html: 'html',
      i: 'i',
      iframe: 'iframe',
      img: 'img',
      input: 'input',
      ins: 'ins',
      kbd: 'kbd',
      keygen: 'keygen',
      label: 'label',
      legend: 'legend',
      li: 'li',
      link: 'link',
      main: 'main',
      map: 'map',
      mark: 'mark',
      menu: 'menu',
      menuitem: 'menuitem',
      meta: 'meta',
      meter: 'meter',
      nav: 'nav',
      noscript: 'noscript',
      object: 'object',
      ol: 'ol',
      optgroup: 'optgroup',
      option: 'option',
      output: 'output',
      p: 'p',
      param: 'param',
      picture: 'picture',
      pre: 'pre',
      progress: 'progress',
      q: 'q',
      rp: 'rp',
      rt: 'rt',
      ruby: 'ruby',
      s: 's',
      samp: 'samp',
      script: 'script',
      section: 'section',
      select: 'select',
      small: 'small',
      source: 'source',
      span: 'span',
      strong: 'strong',
      style: 'style',
      sub: 'sub',
      summary: 'summary',
      sup: 'sup',
      table: 'table',
      tbody: 'tbody',
      td: 'td',
      textarea: 'textarea',
      tfoot: 'tfoot',
      th: 'th',
      thead: 'thead',
      time: 'time',
      title: 'title',
      tr: 'tr',
      track: 'track',
      u: 'u',
      ul: 'ul',
      'var': 'var',
      video: 'video',
      wbr: 'wbr',
      circle: 'circle',
      clipPath: 'clipPath',
      defs: 'defs',
      ellipse: 'ellipse',
      g: 'g',
      image: 'image',
      line: 'line',
      linearGradient: 'linearGradient',
      mask: 'mask',
      path: 'path',
      pattern: 'pattern',
      polygon: 'polygon',
      polyline: 'polyline',
      radialGradient: 'radialGradient',
      rect: 'rect',
      stop: 'stop',
      svg: 'svg',
      text: 'text',
      tspan: 'tspan'
    }, createDOMFactory);
    module.exports = ReactDOMFactories;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c6", ["4f", "30", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactElement = req('4f');
    var invariant = req('30');
    function onlyChild(children) {
      !ReactElement.isValidElement(children) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'onlyChild must be passed a children with exactly one child.') : invariant(false) : undefined;
      return children;
    }
    module.exports = onlyChild;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c7", ["94", "a1", "a2", "c5", "4f", "c3", "90", "ba", "4b", "c6", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ReactChildren = req('94');
    var ReactComponent = req('a1');
    var ReactClass = req('a2');
    var ReactDOMFactories = req('c5');
    var ReactElement = req('4f');
    var ReactElementValidator = req('c3');
    var ReactPropTypes = req('90');
    var ReactVersion = req('ba');
    var assign = req('4b');
    var onlyChild = req('c6');
    var createElement = ReactElement.createElement;
    var createFactory = ReactElement.createFactory;
    var cloneElement = ReactElement.cloneElement;
    if (process.env.NODE_ENV !== 'production') {
      createElement = ReactElementValidator.createElement;
      createFactory = ReactElementValidator.createFactory;
      cloneElement = ReactElementValidator.cloneElement;
    }
    var React = {
      Children: {
        map: ReactChildren.map,
        forEach: ReactChildren.forEach,
        count: ReactChildren.count,
        toArray: ReactChildren.toArray,
        only: onlyChild
      },
      Component: ReactComponent,
      createElement: createElement,
      cloneElement: cloneElement,
      isValidElement: ReactElement.isValidElement,
      PropTypes: ReactPropTypes,
      createClass: ReactClass.createClass,
      createFactory: createFactory,
      createMixin: function(mixin) {
        return mixin;
      },
      DOM: ReactDOMFactories,
      version: ReactVersion,
      __spread: assign
    };
    module.exports = React;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c8", ["4b", "40", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var assign = req('4b');
    var warning = req('40');
    function deprecated(fnName, newModule, newPackage, ctx, fn) {
      var warned = false;
      if (process.env.NODE_ENV !== 'production') {
        var newFn = function() {
          process.env.NODE_ENV !== 'production' ? warning(warned, 'React.%s is deprecated. Please use %s.%s from require' + '(\'%s\') ' + 'instead.', fnName, newModule, fnName, newPackage) : undefined;
          warned = true;
          return fn.apply(ctx, arguments);
        };
        return assign(newFn, fn);
      }
      return fn;
    }
    module.exports = deprecated;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c9", ["bc", "c2", "c7", "4b", "c8"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ReactDOM = req('bc');
  var ReactDOMServer = req('c2');
  var ReactIsomorphic = req('c7');
  var assign = req('4b');
  var deprecated = req('c8');
  var React = {};
  assign(React, ReactIsomorphic);
  assign(React, {
    findDOMNode: deprecated('findDOMNode', 'ReactDOM', 'react-dom', ReactDOM, ReactDOM.findDOMNode),
    render: deprecated('render', 'ReactDOM', 'react-dom', ReactDOM, ReactDOM.render),
    unmountComponentAtNode: deprecated('unmountComponentAtNode', 'ReactDOM', 'react-dom', ReactDOM, ReactDOM.unmountComponentAtNode),
    renderToString: deprecated('renderToString', 'ReactDOMServer', 'react-dom/server', ReactDOMServer, ReactDOMServer.renderToString),
    renderToStaticMarkup: deprecated('renderToStaticMarkup', 'ReactDOMServer', 'react-dom/server', ReactDOMServer, ReactDOMServer.renderToStaticMarkup)
  });
  React.__SECRET_DOM_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactDOM;
  module.exports = React;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ca", ["c9"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = req('c9');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("cb", ["ca"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('ca');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("cc", ["d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('d');
  module.exports = function defineProperty(it, key, desc) {
    return $.setDesc(it, key, desc);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("cd", ["cc"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('cc'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ce", ["cd"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _Object$defineProperty = req('cd')["default"];
  exports["default"] = (function() {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor)
          descriptor.writable = true;
        _Object$defineProperty(target, descriptor.key, descriptor);
      }
    }
    return function(Constructor, protoProps, staticProps) {
      if (protoProps)
        defineProperties(Constructor.prototype, protoProps);
      if (staticProps)
        defineProperties(Constructor, staticProps);
      return Constructor;
    };
  })();
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("cf", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  exports["default"] = function(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d0", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d1", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    if (typeof it != 'function')
      throw TypeError(it + ' is not a function!');
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d2", ["d1"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var aFunction = req('d1');
  module.exports = function(fn, that, length) {
    aFunction(fn);
    if (that === undefined)
      return fn;
    switch (length) {
      case 1:
        return function(a) {
          return fn.call(that, a);
        };
      case 2:
        return function(a, b) {
          return fn.call(that, a, b);
        };
      case 3:
        return function(a, b, c) {
          return fn.call(that, a, b, c);
        };
    }
    return function() {
      return fn.apply(that, arguments);
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d3", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it, Constructor, name) {
    if (!(it instanceof Constructor))
      throw TypeError(name + ": use the 'new' operator!");
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d4", ["20"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = req('20');
  module.exports = function(iterator, fn, value, entries) {
    try {
      return entries ? fn(anObject(value)[0], value[1]) : fn(value);
    } catch (e) {
      var ret = iterator['return'];
      if (ret !== undefined)
        anObject(ret.call(iterator));
      throw e;
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d5", ["4", "16"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var Iterators = req('4'),
      ITERATOR = req('16')('iterator');
  module.exports = function(it) {
    return (Iterators.Array || Array.prototype[ITERATOR]) === it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d6", ["1c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toInteger = req('1c'),
      min = Math.min;
  module.exports = function(it) {
    return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d7", ["d2", "d4", "d5", "20", "d6", "22"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ctx = req('d2'),
      call = req('d4'),
      isArrayIter = req('d5'),
      anObject = req('20'),
      toLength = req('d6'),
      getIterFn = req('22');
  module.exports = function(iterable, entries, fn, that) {
    var iterFn = getIterFn(iterable),
        f = ctx(fn, that, entries ? 2 : 1),
        index = 0,
        length,
        step,
        iterator;
    if (typeof iterFn != 'function')
      throw TypeError(iterable + ' is not iterable!');
    if (isArrayIter(iterFn))
      for (length = toLength(iterable.length); length > index; index++) {
        entries ? f(anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
      }
    else
      for (iterator = iterFn.call(iterable); !(step = iterator.next()).done; ) {
        call(iterator, f, step.value, entries);
      }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d8", ["d", "1f", "20", "d2"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var getDesc = req('d').getDesc,
      isObject = req('1f'),
      anObject = req('20');
  var check = function(O, proto) {
    anObject(O);
    if (!isObject(proto) && proto !== null)
      throw TypeError(proto + ": can't set as prototype!");
  };
  module.exports = {
    set: Object.setPrototypeOf || ('__proto__' in {} ? function(test, buggy, set) {
      try {
        set = req('d2')(Function.call, getDesc(Object.prototype, '__proto__').set, 2);
        set(test, []);
        buggy = !(test instanceof Array);
      } catch (e) {
        buggy = true;
      }
      return function setPrototypeOf(O, proto) {
        check(O, proto);
        if (buggy)
          O.__proto__ = proto;
        else
          set(O, proto);
        return O;
      };
    }({}, false) : undefined),
    check: check
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d9", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = Object.is || function is(x, y) {
    return x === y ? x !== 0 || 1 / x === 1 / y : x != x && y != y;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("da", ["d", "16", "10"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var $ = req('d'),
      SPECIES = req('16')('species');
  module.exports = function(C) {
    if (req('10') && !(SPECIES in C))
      $.setDesc(C, SPECIES, {
        configurable: true,
        get: function() {
          return this;
        }
      });
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("db", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(fn, args, that) {
    var un = that === undefined;
    switch (args.length) {
      case 0:
        return un ? fn() : fn.call(that);
      case 1:
        return un ? fn(args[0]) : fn.call(that, args[0]);
      case 2:
        return un ? fn(args[0], args[1]) : fn.call(that, args[0], args[1]);
      case 3:
        return un ? fn(args[0], args[1], args[2]) : fn.call(that, args[0], args[1], args[2]);
      case 4:
        return un ? fn(args[0], args[1], args[2], args[3]) : fn.call(that, args[0], args[1], args[2], args[3]);
    }
    return fn.apply(that, args);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("dc", ["a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('a').document && document.documentElement;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("dd", ["1f", "a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = req('1f'),
      document = req('a').document,
      is = isObject(document) && isObject(document.createElement);
  module.exports = function(it) {
    return is ? document.createElement(it) : {};
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("de", ["d2", "db", "dc", "dd", "a", "5", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ctx = req('d2'),
        invoke = req('db'),
        html = req('dc'),
        cel = req('dd'),
        global = req('a'),
        process = global.process,
        setTask = global.setImmediate,
        clearTask = global.clearImmediate,
        MessageChannel = global.MessageChannel,
        counter = 0,
        queue = {},
        ONREADYSTATECHANGE = 'onreadystatechange',
        defer,
        channel,
        port;
    var run = function() {
      var id = +this;
      if (queue.hasOwnProperty(id)) {
        var fn = queue[id];
        delete queue[id];
        fn();
      }
    };
    var listner = function(event) {
      run.call(event.data);
    };
    if (!setTask || !clearTask) {
      setTask = function setImmediate(fn) {
        var args = [],
            i = 1;
        while (arguments.length > i)
          args.push(arguments[i++]);
        queue[++counter] = function() {
          invoke(typeof fn == 'function' ? fn : Function(fn), args);
        };
        defer(counter);
        return counter;
      };
      clearTask = function clearImmediate(id) {
        delete queue[id];
      };
      if (req('5')(process) == 'process') {
        defer = function(id) {
          process.nextTick(ctx(run, id, 1));
        };
      } else if (MessageChannel) {
        channel = new MessageChannel;
        port = channel.port2;
        channel.port1.onmessage = listner;
        defer = ctx(port.postMessage, port, 1);
      } else if (global.addEventListener && typeof postMessage == 'function' && !global.importScripts) {
        defer = function(id) {
          global.postMessage(id + '', '*');
        };
        global.addEventListener('message', listner, false);
      } else if (ONREADYSTATECHANGE in cel('script')) {
        defer = function(id) {
          html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function() {
            html.removeChild(this);
            run.call(id);
          };
        };
      } else {
        defer = function(id) {
          setTimeout(ctx(run, id, 1), 0);
        };
      }
    }
    module.exports = {
      set: setTask,
      clear: clearTask
    };
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("df", ["a", "de", "5", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    var global = req('a'),
        macrotask = req('de').set,
        Observer = global.MutationObserver || global.WebKitMutationObserver,
        process = global.process,
        isNode = req('5')(process) == 'process',
        head,
        last,
        notify;
    var flush = function() {
      var parent,
          domain;
      if (isNode && (parent = process.domain)) {
        process.domain = null;
        parent.exit();
      }
      while (head) {
        domain = head.domain;
        if (domain)
          domain.enter();
        head.fn.call();
        if (domain)
          domain.exit();
        head = head.next;
      }
      last = undefined;
      if (parent)
        parent.enter();
    };
    if (isNode) {
      notify = function() {
        process.nextTick(flush);
      };
    } else if (Observer) {
      var toggle = 1,
          node = document.createTextNode('');
      new Observer(flush).observe(node, {characterData: true});
      notify = function() {
        node.data = toggle = -toggle;
      };
    } else {
      notify = function() {
        macrotask.call(global, flush);
      };
    }
    module.exports = function asap(fn) {
      var task = {
        fn: fn,
        next: undefined,
        domain: isNode && process.domain
      };
      if (last)
        last.next = task;
      if (!head) {
        head = task;
        notify();
      }
      last = task;
    };
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e0", ["12"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $redef = req('12');
  module.exports = function(target, src) {
    for (var key in src)
      $redef(target, key, src[key]);
    return target;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e1", ["16"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var SYMBOL_ITERATOR = req('16')('iterator'),
      SAFE_CLOSING = false;
  try {
    var riter = [7][SYMBOL_ITERATOR]();
    riter['return'] = function() {
      SAFE_CLOSING = true;
    };
    Array.from(riter, function() {
      throw 2;
    });
  } catch (e) {}
  module.exports = function(exec, skipClosing) {
    if (!skipClosing && !SAFE_CLOSING)
      return false;
    var safe = false;
    try {
      var arr = [7],
          iter = arr[SYMBOL_ITERATOR]();
      iter.next = function() {
        safe = true;
      };
      arr[SYMBOL_ITERATOR] = function() {
        return iter;
      };
      exec(arr);
    } catch (e) {}
    return safe;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e2", ["d", "9", "a", "d2", "21", "c", "1f", "20", "d1", "d3", "d7", "d8", "d9", "da", "16", "15", "df", "10", "e0", "17", "b", "e1", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var $ = req('d'),
        LIBRARY = req('9'),
        global = req('a'),
        ctx = req('d2'),
        classof = req('21'),
        $def = req('c'),
        isObject = req('1f'),
        anObject = req('20'),
        aFunction = req('d1'),
        strictNew = req('d3'),
        forOf = req('d7'),
        setProto = req('d8').set,
        same = req('d9'),
        species = req('da'),
        SPECIES = req('16')('species'),
        RECORD = req('15')('record'),
        asap = req('df'),
        PROMISE = 'Promise',
        process = global.process,
        isNode = classof(process) == 'process',
        P = global[PROMISE],
        Wrapper;
    var testResolve = function(sub) {
      var test = new P(function() {});
      if (sub)
        test.constructor = Object;
      return P.resolve(test) === test;
    };
    var useNative = function() {
      var works = false;
      function P2(x) {
        var self = new P(x);
        setProto(self, P2.prototype);
        return self;
      }
      try {
        works = P && P.resolve && testResolve();
        setProto(P2, P);
        P2.prototype = $.create(P.prototype, {constructor: {value: P2}});
        if (!(P2.resolve(5).then(function() {}) instanceof P2)) {
          works = false;
        }
        if (works && req('10')) {
          var thenableThenGotten = false;
          P.resolve($.setDesc({}, 'then', {get: function() {
              thenableThenGotten = true;
            }}));
          works = thenableThenGotten;
        }
      } catch (e) {
        works = false;
      }
      return works;
    }();
    var isPromise = function(it) {
      return isObject(it) && (useNative ? classof(it) == 'Promise' : RECORD in it);
    };
    var sameConstructor = function(a, b) {
      if (LIBRARY && a === P && b === Wrapper)
        return true;
      return same(a, b);
    };
    var getConstructor = function(C) {
      var S = anObject(C)[SPECIES];
      return S != undefined ? S : C;
    };
    var isThenable = function(it) {
      var then;
      return isObject(it) && typeof(then = it.then) == 'function' ? then : false;
    };
    var notify = function(record, isReject) {
      if (record.n)
        return;
      record.n = true;
      var chain = record.c;
      asap(function() {
        var value = record.v,
            ok = record.s == 1,
            i = 0;
        var run = function(react) {
          var cb = ok ? react.ok : react.fail,
              ret,
              then;
          try {
            if (cb) {
              if (!ok)
                record.h = true;
              ret = cb === true ? value : cb(value);
              if (ret === react.P) {
                react.rej(TypeError('Promise-chain cycle'));
              } else if (then = isThenable(ret)) {
                then.call(ret, react.res, react.rej);
              } else
                react.res(ret);
            } else
              react.rej(value);
          } catch (err) {
            react.rej(err);
          }
        };
        while (chain.length > i)
          run(chain[i++]);
        chain.length = 0;
        record.n = false;
        if (isReject)
          setTimeout(function() {
            var promise = record.p,
                handler,
                console;
            if (isUnhandled(promise)) {
              if (isNode) {
                process.emit('unhandledRejection', value, promise);
              } else if (handler = global.onunhandledrejection) {
                handler({
                  promise: promise,
                  reason: value
                });
              } else if ((console = global.console) && console.error) {
                console.error('Unhandled promise rejection', value);
              }
            }
            record.a = undefined;
          }, 1);
      });
    };
    var isUnhandled = function(promise) {
      var record = promise[RECORD],
          chain = record.a || record.c,
          i = 0,
          react;
      if (record.h)
        return false;
      while (chain.length > i) {
        react = chain[i++];
        if (react.fail || !isUnhandled(react.P))
          return false;
      }
      return true;
    };
    var $reject = function(value) {
      var record = this;
      if (record.d)
        return;
      record.d = true;
      record = record.r || record;
      record.v = value;
      record.s = 2;
      record.a = record.c.slice();
      notify(record, true);
    };
    var $resolve = function(value) {
      var record = this,
          then;
      if (record.d)
        return;
      record.d = true;
      record = record.r || record;
      try {
        if (then = isThenable(value)) {
          asap(function() {
            var wrapper = {
              r: record,
              d: false
            };
            try {
              then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
            } catch (e) {
              $reject.call(wrapper, e);
            }
          });
        } else {
          record.v = value;
          record.s = 1;
          notify(record, false);
        }
      } catch (e) {
        $reject.call({
          r: record,
          d: false
        }, e);
      }
    };
    if (!useNative) {
      P = function Promise(executor) {
        aFunction(executor);
        var record = {
          p: strictNew(this, P, PROMISE),
          c: [],
          a: undefined,
          s: 0,
          d: false,
          v: undefined,
          h: false,
          n: false
        };
        this[RECORD] = record;
        try {
          executor(ctx($resolve, record, 1), ctx($reject, record, 1));
        } catch (err) {
          $reject.call(record, err);
        }
      };
      req('e0')(P.prototype, {
        then: function then(onFulfilled, onRejected) {
          var S = anObject(anObject(this).constructor)[SPECIES];
          var react = {
            ok: typeof onFulfilled == 'function' ? onFulfilled : true,
            fail: typeof onRejected == 'function' ? onRejected : false
          };
          var promise = react.P = new (S != undefined ? S : P)(function(res, rej) {
            react.res = res;
            react.rej = rej;
          });
          aFunction(react.res);
          aFunction(react.rej);
          var record = this[RECORD];
          record.c.push(react);
          if (record.a)
            record.a.push(react);
          if (record.s)
            notify(record, false);
          return promise;
        },
        'catch': function(onRejected) {
          return this.then(undefined, onRejected);
        }
      });
    }
    $def($def.G + $def.W + $def.F * !useNative, {Promise: P});
    req('17')(P, PROMISE);
    species(P);
    species(Wrapper = req('b')[PROMISE]);
    $def($def.S + $def.F * !useNative, PROMISE, {reject: function reject(r) {
        return new this(function(res, rej) {
          rej(r);
        });
      }});
    $def($def.S + $def.F * (!useNative || testResolve(true)), PROMISE, {resolve: function resolve(x) {
        return isPromise(x) && sameConstructor(x.constructor, this) ? x : new this(function(res) {
          res(x);
        });
      }});
    $def($def.S + $def.F * !(useNative && req('e1')(function(iter) {
      P.all(iter)['catch'](function() {});
    })), PROMISE, {
      all: function all(iterable) {
        var C = getConstructor(this),
            values = [];
        return new C(function(res, rej) {
          forOf(iterable, false, values.push, values);
          var remaining = values.length,
              results = Array(remaining);
          if (remaining)
            $.each.call(values, function(promise, index) {
              C.resolve(promise).then(function(value) {
                results[index] = value;
                --remaining || res(results);
              }, rej);
            });
          else
            res(results);
        });
      },
      race: function race(iterable) {
        var C = getConstructor(this);
        return new C(function(res, rej) {
          forOf(iterable, false, function(promise) {
            C.resolve(promise).then(res, rej);
          });
        });
      }
    });
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e3", ["d0", "1e", "1b", "e2", "b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('d0');
  req('1e');
  req('1b');
  req('e2');
  module.exports = req('b').Promise;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e4", ["e3"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('e3'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e5", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var y = d * 365.25;
  module.exports = function(val, options) {
    options = options || {};
    if ('string' == typeof val)
      return parse(val);
    return options.long ? long(val) : short(val);
  };
  function parse(str) {
    str = '' + str;
    if (str.length > 10000)
      return;
    var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
    if (!match)
      return;
    var n = parseFloat(match[1]);
    var type = (match[2] || 'ms').toLowerCase();
    switch (type) {
      case 'years':
      case 'year':
      case 'yrs':
      case 'yr':
      case 'y':
        return n * y;
      case 'days':
      case 'day':
      case 'd':
        return n * d;
      case 'hours':
      case 'hour':
      case 'hrs':
      case 'hr':
      case 'h':
        return n * h;
      case 'minutes':
      case 'minute':
      case 'mins':
      case 'min':
      case 'm':
        return n * m;
      case 'seconds':
      case 'second':
      case 'secs':
      case 'sec':
      case 's':
        return n * s;
      case 'milliseconds':
      case 'millisecond':
      case 'msecs':
      case 'msec':
      case 'ms':
        return n;
    }
  }
  function short(ms) {
    if (ms >= d)
      return Math.round(ms / d) + 'd';
    if (ms >= h)
      return Math.round(ms / h) + 'h';
    if (ms >= m)
      return Math.round(ms / m) + 'm';
    if (ms >= s)
      return Math.round(ms / s) + 's';
    return ms + 'ms';
  }
  function long(ms) {
    return plural(ms, d, 'day') || plural(ms, h, 'hour') || plural(ms, m, 'minute') || plural(ms, s, 'second') || ms + ' ms';
  }
  function plural(ms, n, name) {
    if (ms < n)
      return;
    if (ms < n * 1.5)
      return Math.floor(ms / n) + ' ' + name;
    return Math.ceil(ms / n) + ' ' + name + 's';
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e6", ["e5"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('e5');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e7", ["e6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  exports = module.exports = debug;
  exports.coerce = coerce;
  exports.disable = disable;
  exports.enable = enable;
  exports.enabled = enabled;
  exports.humanize = req('e6');
  exports.names = [];
  exports.skips = [];
  exports.formatters = {};
  var prevColor = 0;
  var prevTime;
  function selectColor() {
    return exports.colors[prevColor++ % exports.colors.length];
  }
  function debug(namespace) {
    function disabled() {}
    disabled.enabled = false;
    function enabled() {
      var self = enabled;
      var curr = +new Date();
      var ms = curr - (prevTime || curr);
      self.diff = ms;
      self.prev = prevTime;
      self.curr = curr;
      prevTime = curr;
      if (null == self.useColors)
        self.useColors = exports.useColors();
      if (null == self.color && self.useColors)
        self.color = selectColor();
      var args = Array.prototype.slice.call(arguments);
      args[0] = exports.coerce(args[0]);
      if ('string' !== typeof args[0]) {
        args = ['%o'].concat(args);
      }
      var index = 0;
      args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
        if (match === '%%')
          return match;
        index++;
        var formatter = exports.formatters[format];
        if ('function' === typeof formatter) {
          var val = args[index];
          match = formatter.call(self, val);
          args.splice(index, 1);
          index--;
        }
        return match;
      });
      if ('function' === typeof exports.formatArgs) {
        args = exports.formatArgs.apply(self, args);
      }
      var logFn = enabled.log || exports.log || console.log.bind(console);
      logFn.apply(self, args);
    }
    enabled.enabled = true;
    var fn = exports.enabled(namespace) ? enabled : disabled;
    fn.namespace = namespace;
    return fn;
  }
  function enable(namespaces) {
    exports.save(namespaces);
    var split = (namespaces || '').split(/[\s,]+/);
    var len = split.length;
    for (var i = 0; i < len; i++) {
      if (!split[i])
        continue;
      namespaces = split[i].replace(/\*/g, '.*?');
      if (namespaces[0] === '-') {
        exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
      } else {
        exports.names.push(new RegExp('^' + namespaces + '$'));
      }
    }
  }
  function disable() {
    exports.enable('');
  }
  function enabled(name) {
    var i,
        len;
    for (i = 0, len = exports.skips.length; i < len; i++) {
      if (exports.skips[i].test(name)) {
        return false;
      }
    }
    for (i = 0, len = exports.names.length; i < len; i++) {
      if (exports.names[i].test(name)) {
        return true;
      }
    }
    return false;
  }
  function coerce(val) {
    if (val instanceof Error)
      return val.stack || val.message;
    return val;
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e8", ["e7"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  exports = module.exports = req('e7');
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = 'undefined' != typeof chrome && 'undefined' != typeof chrome.storage ? chrome.storage.local : localstorage();
  exports.colors = ['lightseagreen', 'forestgreen', 'goldenrod', 'dodgerblue', 'darkorchid', 'crimson'];
  function useColors() {
    return ('WebkitAppearance' in document.documentElement.style) || (window.console && (console.firebug || (console.exception && console.table))) || (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
  }
  exports.formatters.j = function(v) {
    return JSON.stringify(v);
  };
  function formatArgs() {
    var args = arguments;
    var useColors = this.useColors;
    args[0] = (useColors ? '%c' : '') + this.namespace + (useColors ? ' %c' : ' ') + args[0] + (useColors ? '%c ' : ' ') + '+' + exports.humanize(this.diff);
    if (!useColors)
      return args;
    var c = 'color: ' + this.color;
    args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));
    var index = 0;
    var lastC = 0;
    args[0].replace(/%[a-z%]/g, function(match) {
      if ('%%' === match)
        return;
      index++;
      if ('%c' === match) {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
    return args;
  }
  function log() {
    return 'object' === typeof console && console.log && Function.prototype.apply.call(console.log, console, arguments);
  }
  function save(namespaces) {
    try {
      if (null == namespaces) {
        exports.storage.removeItem('debug');
      } else {
        exports.storage.debug = namespaces;
      }
    } catch (e) {}
  }
  function load() {
    var r;
    try {
      r = exports.storage.debug;
    } catch (e) {}
    return r;
  }
  exports.enable(load());
  function localstorage() {
    try {
      return window.localStorage;
    } catch (e) {}
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e9", ["e8"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('e8');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ea", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function traverseRevTree(revs, callback) {
    var toVisit = revs.slice();
    var node;
    while ((node = toVisit.pop())) {
      var pos = node.pos;
      var tree = node.ids;
      var branches = tree[2];
      var newCtx = callback(branches.length === 0, pos, tree[0], node.ctx, tree[1]);
      for (var i = 0,
          len = branches.length; i < len; i++) {
        toVisit.push({
          pos: pos + 1,
          ids: branches[i],
          ctx: newCtx
        });
      }
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("eb", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  function createBlob(parts, properties) {
    parts = parts || [];
    properties = properties || {};
    try {
      return new Blob(parts, properties);
    } catch (e) {
      if (e.name !== "TypeError") {
        throw e;
      }
      var Builder = typeof BlobBuilder !== 'undefined' ? BlobBuilder : typeof MSBlobBuilder !== 'undefined' ? MSBlobBuilder : typeof MozBlobBuilder !== 'undefined' ? MozBlobBuilder : WebKitBlobBuilder;
      var builder = new Builder();
      for (var i = 0; i < parts.length; i += 1) {
        builder.append(parts[i]);
      }
      return builder.getBlob(properties.type);
    }
  }
  module.exports = createBlob;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ec", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function(blob, callback) {
    if (typeof FileReader === 'undefined') {
      return callback(new FileReaderSync().readAsArrayBuffer(blob));
    }
    var reader = new FileReader();
    reader.onloadend = function(e) {
      var result = e.target.result || new ArrayBuffer(0);
      callback(result);
    };
    reader.readAsArrayBuffer(blob);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ed", ["eb", "ee", "ec"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var createBlob = req('eb');
  var utils = req('ee');
  var readAsArrayBuffer = req('ec');
  function wrappedFetch() {
    var wrappedPromise = {};
    var promise = new utils.Promise(function(resolve, reject) {
      wrappedPromise.resolve = resolve;
      wrappedPromise.reject = reject;
    });
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    wrappedPromise.promise = promise;
    utils.Promise.resolve().then(function() {
      return fetch.apply(null, args);
    }).then(function(response) {
      wrappedPromise.resolve(response);
    }).catch(function(error) {
      wrappedPromise.reject(error);
    });
    return wrappedPromise;
  }
  function fetchRequest(options, callback) {
    var wrappedPromise,
        timer,
        response;
    var headers = new Headers();
    var fetchOptions = {
      method: options.method,
      credentials: 'include',
      headers: headers
    };
    if (options.json) {
      headers.set('Accept', 'application/json');
      headers.set('Content-Type', options.headers['Content-Type'] || 'application/json');
    }
    if (options.body && (options.body instanceof Blob)) {
      readAsArrayBuffer(options.body, function(arrayBuffer) {
        fetchOptions.body = arrayBuffer;
      });
    } else if (options.body && options.processData && typeof options.body !== 'string') {
      fetchOptions.body = JSON.stringify(options.body);
    } else if ('body' in options) {
      fetchOptions.body = options.body;
    } else {
      fetchOptions.body = null;
    }
    Object.keys(options.headers).forEach(function(key) {
      if (options.headers.hasOwnProperty(key)) {
        headers.set(key, options.headers[key]);
      }
    });
    wrappedPromise = wrappedFetch(options.url, fetchOptions);
    if (options.timeout > 0) {
      timer = setTimeout(function() {
        wrappedPromise.reject(new Error('Load timeout for resource: ' + options.url));
      }, options.timeout);
    }
    wrappedPromise.promise.then(function(fetchResponse) {
      response = {statusCode: fetchResponse.status};
      if (options.timeout > 0) {
        clearTimeout(timer);
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return options.binary ? fetchResponse.blob() : fetchResponse.text();
      }
      return fetchResponse.json();
    }).then(function(result) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        callback(null, response, result);
      } else {
        callback(result, response);
      }
    }).catch(function(error) {
      callback(error, response);
    });
    return {abort: wrappedPromise.reject};
  }
  function xhRequest(options, callback) {
    var xhr,
        timer,
        hasUpload;
    var abortReq = function() {
      xhr.abort();
    };
    if (options.xhr) {
      xhr = new options.xhr();
    } else {
      xhr = new XMLHttpRequest();
    }
    xhr.open(options.method, options.url);
    xhr.withCredentials = true;
    if (options.method === 'GET') {
      delete options.headers['Content-Type'];
    } else if (options.json) {
      options.headers.Accept = 'application/json';
      options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
      if (options.body && options.processData && typeof options.body !== "string") {
        options.body = JSON.stringify(options.body);
      }
    }
    if (options.binary) {
      xhr.responseType = 'arraybuffer';
    }
    if (!('body' in options)) {
      options.body = null;
    }
    for (var key in options.headers) {
      if (options.headers.hasOwnProperty(key)) {
        xhr.setRequestHeader(key, options.headers[key]);
      }
    }
    if (options.timeout > 0) {
      timer = setTimeout(abortReq, options.timeout);
      xhr.onprogress = function() {
        clearTimeout(timer);
        timer = setTimeout(abortReq, options.timeout);
      };
      if (typeof hasUpload === 'undefined') {
        hasUpload = Object.keys(xhr).indexOf('upload') !== -1 && typeof xhr.upload !== 'undefined';
      }
      if (hasUpload) {
        xhr.upload.onprogress = xhr.onprogress;
      }
    }
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) {
        return;
      }
      var response = {statusCode: xhr.status};
      if (xhr.status >= 200 && xhr.status < 300) {
        var data;
        if (options.binary) {
          data = createBlob([xhr.response || ''], {type: xhr.getResponseHeader('Content-Type')});
        } else {
          data = xhr.responseText;
        }
        callback(null, response, data);
      } else {
        var err = {};
        try {
          err = JSON.parse(xhr.response);
        } catch (e) {}
        callback(err, response);
      }
    };
    if (options.body && (options.body instanceof Blob)) {
      readAsArrayBuffer(options.body, function(arrayBuffer) {
        xhr.send(arrayBuffer);
      });
    } else {
      xhr.send(options.body);
    }
    return {abort: abortReq};
  }
  function testXhr() {
    try {
      new XMLHttpRequest();
      return true;
    } catch (err) {
      return false;
    }
  }
  var hasXhr = testXhr();
  module.exports = function(options, callback) {
    if (hasXhr || options.xhr) {
      return xhRequest(options, callback);
    } else {
      return fetchRequest(options, callback);
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ef", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  if (typeof Object.create === 'function') {
    module.exports = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }});
    };
  } else {
    module.exports = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function() {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    };
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f0", ["ef"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('ef');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f1", ["f0"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var inherits = req('f0');
  inherits(PouchError, Error);
  function PouchError(opts) {
    Error.call(this, opts.reason);
    this.status = opts.status;
    this.name = opts.error;
    this.message = opts.reason;
    this.error = true;
  }
  PouchError.prototype.toString = function() {
    return JSON.stringify({
      status: this.status,
      name: this.name,
      message: this.message,
      reason: this.reason
    });
  };
  exports.UNAUTHORIZED = new PouchError({
    status: 401,
    error: 'unauthorized',
    reason: "Name or password is incorrect."
  });
  exports.MISSING_BULK_DOCS = new PouchError({
    status: 400,
    error: 'bad_request',
    reason: "Missing JSON list of 'docs'"
  });
  exports.MISSING_DOC = new PouchError({
    status: 404,
    error: 'not_found',
    reason: 'missing'
  });
  exports.REV_CONFLICT = new PouchError({
    status: 409,
    error: 'conflict',
    reason: 'Document update conflict'
  });
  exports.INVALID_ID = new PouchError({
    status: 400,
    error: 'invalid_id',
    reason: '_id field must contain a string'
  });
  exports.MISSING_ID = new PouchError({
    status: 412,
    error: 'missing_id',
    reason: '_id is required for puts'
  });
  exports.RESERVED_ID = new PouchError({
    status: 400,
    error: 'bad_request',
    reason: 'Only reserved document ids may start with underscore.'
  });
  exports.NOT_OPEN = new PouchError({
    status: 412,
    error: 'precondition_failed',
    reason: 'Database not open'
  });
  exports.UNKNOWN_ERROR = new PouchError({
    status: 500,
    error: 'unknown_error',
    reason: 'Database encountered an unknown error'
  });
  exports.BAD_ARG = new PouchError({
    status: 500,
    error: 'badarg',
    reason: 'Some query argument is invalid'
  });
  exports.INVALID_REQUEST = new PouchError({
    status: 400,
    error: 'invalid_request',
    reason: 'Request was invalid'
  });
  exports.QUERY_PARSE_ERROR = new PouchError({
    status: 400,
    error: 'query_parse_error',
    reason: 'Some query parameter is invalid'
  });
  exports.DOC_VALIDATION = new PouchError({
    status: 500,
    error: 'doc_validation',
    reason: 'Bad special document member'
  });
  exports.BAD_REQUEST = new PouchError({
    status: 400,
    error: 'bad_request',
    reason: 'Something wrong with the request'
  });
  exports.NOT_AN_OBJECT = new PouchError({
    status: 400,
    error: 'bad_request',
    reason: 'Document must be a JSON object'
  });
  exports.DB_MISSING = new PouchError({
    status: 404,
    error: 'not_found',
    reason: 'Database not found'
  });
  exports.IDB_ERROR = new PouchError({
    status: 500,
    error: 'indexed_db_went_bad',
    reason: 'unknown'
  });
  exports.WSQ_ERROR = new PouchError({
    status: 500,
    error: 'web_sql_went_bad',
    reason: 'unknown'
  });
  exports.LDB_ERROR = new PouchError({
    status: 500,
    error: 'levelDB_went_went_bad',
    reason: 'unknown'
  });
  exports.FORBIDDEN = new PouchError({
    status: 403,
    error: 'forbidden',
    reason: 'Forbidden by design doc validate_doc_update function'
  });
  exports.INVALID_REV = new PouchError({
    status: 400,
    error: 'bad_request',
    reason: 'Invalid rev format'
  });
  exports.FILE_EXISTS = new PouchError({
    status: 412,
    error: 'file_exists',
    reason: 'The database could not be created, the file already exists.'
  });
  exports.MISSING_STUB = new PouchError({
    status: 412,
    error: 'missing_stub'
  });
  exports.error = function(error, reason, name) {
    function CustomPouchError(reason) {
      for (var p in error) {
        if (typeof error[p] !== 'function') {
          this[p] = error[p];
        }
      }
      if (name !== undefined) {
        this.name = name;
      }
      if (reason !== undefined) {
        this.reason = reason;
      }
    }
    CustomPouchError.prototype = PouchError.prototype;
    return new CustomPouchError(reason);
  };
  exports.getErrorTypeByProp = function(prop, value, reason) {
    var errors = exports;
    var keys = Object.keys(errors).filter(function(key) {
      var error = errors[key];
      return typeof error !== 'function' && error[prop] === value;
    });
    var key = reason && keys.filter(function(key) {
      var error = errors[key];
      return error.message === reason;
    })[0] || keys[0];
    return (key) ? errors[key] : null;
  };
  exports.generateErrorFromResponse = function(res) {
    var error,
        errName,
        errType,
        errMsg,
        errReason;
    var errors = exports;
    errName = (res.error === true && typeof res.name === 'string') ? res.name : res.error;
    errReason = res.reason;
    errType = errors.getErrorTypeByProp('name', errName, errReason);
    if (res.missing || errReason === 'missing' || errReason === 'deleted' || errName === 'not_found') {
      errType = errors.MISSING_DOC;
    } else if (errName === 'doc_validation') {
      errType = errors.DOC_VALIDATION;
      errMsg = errReason;
    } else if (errName === 'bad_request' && errType.message !== errReason) {
      errType = errors.BAD_REQUEST;
    }
    if (!errType) {
      errType = errors.getErrorTypeByProp('status', res.status, errReason) || errors.UNKNOWN_ERROR;
    }
    error = errors.error(errType, errReason, errName);
    if (errMsg) {
      error.message = errMsg;
    }
    if (res.id) {
      error.id = res.id;
    }
    if (res.status) {
      error.status = res.status;
    }
    if (res.missing) {
      error.missing = res.missing;
    }
    return error;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f2", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function() {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f3", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function defaultBody() {
    return '';
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f4", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function() {
    if ('console' in global && 'warn' in console) {
      console.warn('PouchDB: the remote database may not have CORS enabled.' + 'If not please enable CORS: ' + 'http://pouchdb.com/errors.html#no_access_control_allow_origin_header');
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f5", ["ed", "f1", "ee", "f2", "f3", "f4", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    "use strict";
    var request = req('ed');
    var errors = req('f1');
    var utils = req('ee');
    var applyTypeToBuffer = req('f2');
    var defaultBody = req('f3');
    var explainCors = req('f4');
    function ajax(options, callback) {
      options = utils.clone(options);
      var defaultOptions = {
        method: "GET",
        headers: {},
        json: true,
        processData: true,
        timeout: 10000,
        cache: false
      };
      options = utils.extend(defaultOptions, options);
      function onSuccess(obj, resp, cb) {
        if (!options.binary && !options.json && options.processData && typeof obj !== 'string') {
          obj = JSON.stringify(obj);
        } else if (!options.binary && options.json && typeof obj === 'string') {
          try {
            obj = JSON.parse(obj);
          } catch (e) {
            return cb(e);
          }
        }
        if (Array.isArray(obj)) {
          obj = obj.map(function(v) {
            if (v.error || v.missing) {
              return errors.generateErrorFromResponse(v);
            } else {
              return v;
            }
          });
        }
        if (options.binary) {
          applyTypeToBuffer(obj, resp);
        }
        cb(null, obj, resp);
      }
      function onError(err, cb) {
        var errParsed,
            errObj;
        if (err.code && err.status) {
          var err2 = new Error(err.message || err.code);
          err2.status = err.status;
          return cb(err2);
        }
        try {
          errParsed = JSON.parse(err.responseText);
          errObj = errors.generateErrorFromResponse(errParsed);
        } catch (e) {
          errObj = errors.generateErrorFromResponse(err);
        }
        cb(errObj);
      }
      if (options.json) {
        if (!options.binary) {
          options.headers.Accept = 'application/json';
        }
        options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
      }
      if (options.binary) {
        options.encoding = null;
        options.json = false;
      }
      if (!options.processData) {
        options.json = false;
      }
      return request(options, function(err, response, body) {
        if (err) {
          if (response) {
            var origin = (typeof document !== 'undefined') && document.location.origin;
            var isCrossOrigin = origin && options.url.indexOf(origin) === 0;
            if (isCrossOrigin && response.statusCode === 0) {
              explainCors();
            }
            err.status = response.statusCode;
          } else {
            err.status = 400;
          }
          return onError(err, callback);
        }
        var error;
        var content_type = response.headers && response.headers['content-type'];
        var data = body || defaultBody();
        if (!options.binary && (options.json || !options.processData) && typeof data !== 'object' && (/json/.test(content_type) || (/^[\s]*\{/.test(data) && /\}[\s]*$/.test(data)))) {
          try {
            data = JSON.parse(data.toString());
          } catch (e) {}
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          onSuccess(data, response, callback);
        } else {
          error = errors.generateErrorFromResponse(data);
          error.status = response.statusCode;
          callback(error);
        }
      });
    }
    module.exports = ajax;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f6", ["f5"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var ajax = req('f5');
  module.exports = function(opts, callback) {
    if ((opts.method === 'POST' || opts.method === 'GET') && !opts.cache) {
      var hasArgs = opts.url.indexOf('?') !== -1;
      opts.url += (hasArgs ? '&' : '?') + '_nonce=' + Date.now();
    }
    return ajax(opts, callback);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f7", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var chars = ('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz').split('');
  function getValue(radix) {
    return 0 | Math.random() * radix;
  }
  function uuid(len, radix) {
    radix = radix || chars.length;
    var out = '';
    var i = -1;
    if (len) {
      while (++i < len) {
        out += chars[getValue(radix)];
      }
      return out;
    }
    while (++i < 36) {
      switch (i) {
        case 8:
        case 13:
        case 18:
        case 23:
          out += '-';
          break;
        case 19:
          out += chars[(getValue(16) & 0x3) | 0x8];
          break;
        default:
          out += chars[getValue(16)];
      }
    }
    return out;
  }
  module.exports = uuid;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f8", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = argsArray;
  function argsArray(fun) {
    return function() {
      var len = arguments.length;
      if (len) {
        var args = [];
        var i = -1;
        while (++i < len) {
          args[i] = arguments[i];
        }
        return fun.call(this, args);
      } else {
        return fun.call(this, []);
      }
    };
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f9", ["f8"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('f8');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("fa", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  exports.Map = LazyMap;
  exports.Set = LazySet;
  function LazyMap() {
    this.store = {};
  }
  LazyMap.prototype.mangle = function(key) {
    if (typeof key !== "string") {
      throw new TypeError("key must be a string but Got " + key);
    }
    return '$' + key;
  };
  LazyMap.prototype.unmangle = function(key) {
    return key.substring(1);
  };
  LazyMap.prototype.get = function(key) {
    var mangled = this.mangle(key);
    if (mangled in this.store) {
      return this.store[mangled];
    }
    return void 0;
  };
  LazyMap.prototype.set = function(key, value) {
    var mangled = this.mangle(key);
    this.store[mangled] = value;
    return true;
  };
  LazyMap.prototype.has = function(key) {
    var mangled = this.mangle(key);
    return mangled in this.store;
  };
  LazyMap.prototype.delete = function(key) {
    var mangled = this.mangle(key);
    if (mangled in this.store) {
      delete this.store[mangled];
      return true;
    }
    return false;
  };
  LazyMap.prototype.forEach = function(cb) {
    var keys = Object.keys(this.store);
    for (var i = 0,
        len = keys.length; i < len; i++) {
      var key = keys[i];
      var value = this.store[key];
      key = this.unmangle(key);
      cb(value, key);
    }
  };
  function LazySet(array) {
    this.store = new LazyMap();
    if (array && Array.isArray(array)) {
      for (var i = 0,
          len = array.length; i < len; i++) {
        this.add(array[i]);
      }
    }
  }
  LazySet.prototype.add = function(key) {
    return this.store.set(key, true);
  };
  LazySet.prototype.has = function(key) {
    return this.store.has(key);
  };
  LazySet.prototype.delete = function(key) {
    return this.store.delete(key);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("fb", ["fa"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('fa');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("fc", ["f1", "f7"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var errors = req('f1');
  var uuid = req('f7');
  function toObject(array) {
    return array.reduce(function(obj, item) {
      obj[item] = true;
      return obj;
    }, {});
  }
  var reservedWords = toObject(['_id', '_rev', '_attachments', '_deleted', '_revisions', '_revs_info', '_conflicts', '_deleted_conflicts', '_local_seq', '_rev_tree', '_replication_id', '_replication_state', '_replication_state_time', '_replication_state_reason', '_replication_stats', '_removed']);
  var dataWords = toObject(['_attachments', '_replication_id', '_replication_state', '_replication_state_time', '_replication_state_reason', '_replication_stats']);
  exports.invalidIdError = function(id) {
    var err;
    if (!id) {
      err = errors.error(errors.MISSING_ID);
    } else if (typeof id !== 'string') {
      err = errors.error(errors.INVALID_ID);
    } else if (/^_/.test(id) && !(/^_(design|local)/).test(id)) {
      err = errors.error(errors.RESERVED_ID);
    }
    if (err) {
      throw err;
    }
  };
  function parseRevisionInfo(rev) {
    if (!/^\d+\-./.test(rev)) {
      return errors.error(errors.INVALID_REV);
    }
    var idx = rev.indexOf('-');
    var left = rev.substring(0, idx);
    var right = rev.substring(idx + 1);
    return {
      prefix: parseInt(left, 10),
      id: right
    };
  }
  function makeRevTreeFromRevisions(revisions, opts) {
    var pos = revisions.start - revisions.ids.length + 1;
    var revisionIds = revisions.ids;
    var ids = [revisionIds[0], opts, []];
    for (var i = 1,
        len = revisionIds.length; i < len; i++) {
      ids = [revisionIds[i], {status: 'missing'}, [ids]];
    }
    return [{
      pos: pos,
      ids: ids
    }];
  }
  exports.parseDoc = function(doc, newEdits) {
    var nRevNum;
    var newRevId;
    var revInfo;
    var opts = {status: 'available'};
    if (doc._deleted) {
      opts.deleted = true;
    }
    if (newEdits) {
      if (!doc._id) {
        doc._id = uuid();
      }
      newRevId = uuid(32, 16).toLowerCase();
      if (doc._rev) {
        revInfo = parseRevisionInfo(doc._rev);
        if (revInfo.error) {
          return revInfo;
        }
        doc._rev_tree = [{
          pos: revInfo.prefix,
          ids: [revInfo.id, {status: 'missing'}, [[newRevId, opts, []]]]
        }];
        nRevNum = revInfo.prefix + 1;
      } else {
        doc._rev_tree = [{
          pos: 1,
          ids: [newRevId, opts, []]
        }];
        nRevNum = 1;
      }
    } else {
      if (doc._revisions) {
        doc._rev_tree = makeRevTreeFromRevisions(doc._revisions, opts);
        nRevNum = doc._revisions.start;
        newRevId = doc._revisions.ids[0];
      }
      if (!doc._rev_tree) {
        revInfo = parseRevisionInfo(doc._rev);
        if (revInfo.error) {
          return revInfo;
        }
        nRevNum = revInfo.prefix;
        newRevId = revInfo.id;
        doc._rev_tree = [{
          pos: nRevNum,
          ids: [newRevId, opts, []]
        }];
      }
    }
    exports.invalidIdError(doc._id);
    doc._rev = nRevNum + '-' + newRevId;
    var result = {
      metadata: {},
      data: {}
    };
    for (var key in doc) {
      if (Object.prototype.hasOwnProperty.call(doc, key)) {
        var specialKey = key[0] === '_';
        if (specialKey && !reservedWords[key]) {
          var error = errors.error(errors.DOC_VALIDATION, key);
          error.message = errors.DOC_VALIDATION.message + ': ' + key;
          throw error;
        } else if (specialKey && !dataWords[key]) {
          result.metadata[key.slice(1)] = doc[key];
        } else {
          result.data[key] = doc[key];
        }
      }
    }
    return result;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("fd", ["2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var Mutation = global.MutationObserver || global.WebKitMutationObserver;
    var scheduleDrain;
    if (process.browser) {
      if (Mutation) {
        var called = 0;
        var observer = new Mutation(nextTick);
        var element = global.document.createTextNode('');
        observer.observe(element, {characterData: true});
        scheduleDrain = function() {
          element.data = (called = ++called % 2);
        };
      } else if (!global.setImmediate && typeof global.MessageChannel !== 'undefined') {
        var channel = new global.MessageChannel();
        channel.port1.onmessage = nextTick;
        scheduleDrain = function() {
          channel.port2.postMessage(0);
        };
      } else if ('document' in global && 'onreadystatechange' in global.document.createElement('script')) {
        scheduleDrain = function() {
          var scriptEl = global.document.createElement('script');
          scriptEl.onreadystatechange = function() {
            nextTick();
            scriptEl.onreadystatechange = null;
            scriptEl.parentNode.removeChild(scriptEl);
            scriptEl = null;
          };
          global.document.documentElement.appendChild(scriptEl);
        };
      } else {
        scheduleDrain = function() {
          setTimeout(nextTick, 0);
        };
      }
    } else {
      scheduleDrain = function() {
        process.nextTick(nextTick);
      };
    }
    var draining;
    var queue = [];
    function nextTick() {
      draining = true;
      var i,
          oldQueue;
      var len = queue.length;
      while (len) {
        oldQueue = queue;
        queue = [];
        i = -1;
        while (++i < len) {
          oldQueue[i]();
        }
        len = queue.length;
      }
      draining = false;
    }
    module.exports = immediate;
    function immediate(task) {
      if (queue.push(task) === 1 && !draining) {
        scheduleDrain();
      }
    }
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("fe", ["fd"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('fd');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ff", ["fe", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var immediate = req('fe');
    function INTERNAL() {}
    var handlers = {};
    var REJECTED = ['REJECTED'];
    var FULFILLED = ['FULFILLED'];
    var PENDING = ['PENDING'];
    var UNHANDLED;
    if (!process.browser) {
      UNHANDLED = ['UNHANDLED'];
    }
    module.exports = exports = Promise;
    function Promise(resolver) {
      if (typeof resolver !== 'function') {
        throw new TypeError('resolver must be a function');
      }
      this.state = PENDING;
      this.queue = [];
      this.outcome = void 0;
      if (!process.browser) {
        this.handled = UNHANDLED;
      }
      if (resolver !== INTERNAL) {
        safelyResolveThenable(this, resolver);
      }
    }
    Promise.prototype.catch = function(onRejected) {
      return this.then(null, onRejected);
    };
    Promise.prototype.then = function(onFulfilled, onRejected) {
      if (typeof onFulfilled !== 'function' && this.state === FULFILLED || typeof onRejected !== 'function' && this.state === REJECTED) {
        return this;
      }
      var promise = new this.constructor(INTERNAL);
      if (!process.browser) {
        if (typeof onRejected === 'function' && this.handled === UNHANDLED) {
          this.handled = null;
        }
      }
      if (this.state !== PENDING) {
        var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
        unwrap(promise, resolver, this.outcome);
      } else {
        this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
      }
      return promise;
    };
    function QueueItem(promise, onFulfilled, onRejected) {
      this.promise = promise;
      if (typeof onFulfilled === 'function') {
        this.onFulfilled = onFulfilled;
        this.callFulfilled = this.otherCallFulfilled;
      }
      if (typeof onRejected === 'function') {
        this.onRejected = onRejected;
        this.callRejected = this.otherCallRejected;
      }
    }
    QueueItem.prototype.callFulfilled = function(value) {
      handlers.resolve(this.promise, value);
    };
    QueueItem.prototype.otherCallFulfilled = function(value) {
      unwrap(this.promise, this.onFulfilled, value);
    };
    QueueItem.prototype.callRejected = function(value) {
      handlers.reject(this.promise, value);
    };
    QueueItem.prototype.otherCallRejected = function(value) {
      unwrap(this.promise, this.onRejected, value);
    };
    function unwrap(promise, func, value) {
      immediate(function() {
        var returnValue;
        try {
          returnValue = func(value);
        } catch (e) {
          return handlers.reject(promise, e);
        }
        if (returnValue === promise) {
          handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
        } else {
          handlers.resolve(promise, returnValue);
        }
      });
    }
    handlers.resolve = function(self, value) {
      var result = tryCatch(getThen, value);
      if (result.status === 'error') {
        return handlers.reject(self, result.value);
      }
      var thenable = result.value;
      if (thenable) {
        safelyResolveThenable(self, thenable);
      } else {
        self.state = FULFILLED;
        self.outcome = value;
        var i = -1;
        var len = self.queue.length;
        while (++i < len) {
          self.queue[i].callFulfilled(value);
        }
      }
      return self;
    };
    handlers.reject = function(self, error) {
      self.state = REJECTED;
      self.outcome = error;
      if (!process.browser) {
        if (self.handled === UNHANDLED) {
          req('fe')(function() {
            if (self.handled === UNHANDLED) {
              process.emit('unhandledRejection', error, self);
            }
          });
        }
      }
      var i = -1;
      var len = self.queue.length;
      while (++i < len) {
        self.queue[i].callRejected(error);
      }
      return self;
    };
    function getThen(obj) {
      var then = obj && obj.then;
      if (obj && typeof obj === 'object' && typeof then === 'function') {
        return function appyThen() {
          then.apply(obj, arguments);
        };
      }
    }
    function safelyResolveThenable(self, thenable) {
      var called = false;
      function onError(value) {
        if (called) {
          return;
        }
        called = true;
        handlers.reject(self, value);
      }
      function onSuccess(value) {
        if (called) {
          return;
        }
        called = true;
        handlers.resolve(self, value);
      }
      function tryToUnwrap() {
        thenable(onSuccess, onError);
      }
      var result = tryCatch(tryToUnwrap);
      if (result.status === 'error') {
        onError(result.value);
      }
    }
    function tryCatch(func, value) {
      var out = {};
      try {
        out.value = func(value);
        out.status = 'success';
      } catch (e) {
        out.status = 'error';
        out.value = e;
      }
      return out;
    }
    exports.resolve = resolve;
    function resolve(value) {
      if (value instanceof this) {
        return value;
      }
      return handlers.resolve(new this(INTERNAL), value);
    }
    exports.reject = reject;
    function reject(reason) {
      var promise = new this(INTERNAL);
      return handlers.reject(promise, reason);
    }
    exports.all = all;
    function all(iterable) {
      var self = this;
      if (Object.prototype.toString.call(iterable) !== '[object Array]') {
        return this.reject(new TypeError('must be an array'));
      }
      var len = iterable.length;
      var called = false;
      if (!len) {
        return this.resolve([]);
      }
      var values = new Array(len);
      var resolved = 0;
      var i = -1;
      var promise = new this(INTERNAL);
      while (++i < len) {
        allResolver(iterable[i], i);
      }
      return promise;
      function allResolver(value, i) {
        self.resolve(value).then(resolveFromAll, function(error) {
          if (!called) {
            called = true;
            handlers.reject(promise, error);
          }
        });
        function resolveFromAll(outValue) {
          values[i] = outValue;
          if (++resolved === len && !called) {
            called = true;
            handlers.resolve(promise, values);
          }
        }
      }
    }
    exports.race = race;
    function race(iterable) {
      var self = this;
      if (Object.prototype.toString.call(iterable) !== '[object Array]') {
        return this.reject(new TypeError('must be an array'));
      }
      var len = iterable.length;
      var called = false;
      if (!len) {
        return this.resolve([]);
      }
      var i = -1;
      var promise = new this(INTERNAL);
      while (++i < len) {
        resolver(iterable[i]);
      }
      return promise;
      function resolver(value) {
        self.resolve(value).then(function(response) {
          if (!called) {
            called = true;
            handlers.resolve(promise, response);
          }
        }, function(error) {
          if (!called) {
            called = true;
            handlers.reject(promise, error);
          }
        });
      }
    }
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("100", ["ff"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('ff');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("101", ["100"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = typeof Promise === 'function' ? Promise : req('100');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("102", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("103", ["102"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var buffer = req('102');
  if (typeof atob === 'function') {
    exports.atob = function(str) {
      return atob(str);
    };
  } else {
    exports.atob = function(str) {
      var base64 = new buffer(str, 'base64');
      if (base64.toString('base64') !== str) {
        throw ("Cannot base64 encode full string");
      }
      return base64.toString('binary');
    };
  }
  if (typeof btoa === 'function') {
    exports.btoa = function(str) {
      return btoa(str);
    };
  } else {
    exports.btoa = function(str) {
      return new buffer(str, 'binary').toString('base64');
    };
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("104", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function(bin) {
    var length = bin.length;
    var buf = new ArrayBuffer(length);
    var arr = new Uint8Array(buf);
    for (var i = 0; i < length; i++) {
      arr[i] = bin.charCodeAt(i);
    }
    return buf;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("105", ["eb", "104"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var createBlob = req('eb');
  var binaryStringToArrayBuffer = req('104');
  module.exports = function(binString, type) {
    return createBlob([binaryStringToArrayBuffer(binString)], {type: type});
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("106", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function isBinaryObject(object) {
    return object instanceof ArrayBuffer || (typeof Blob !== 'undefined' && object instanceof Blob);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("107", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function cloneArrayBuffer(buff) {
    if (typeof buff.slice === 'function') {
      return buff.slice(0);
    }
    var target = new ArrayBuffer(buff.byteLength);
    var targetArray = new Uint8Array(target);
    var sourceArray = new Uint8Array(buff);
    targetArray.set(sourceArray);
    return target;
  }
  module.exports = function cloneBinaryObject(object) {
    if (object instanceof ArrayBuffer) {
      return cloneArrayBuffer(object);
    }
    var size = object.size;
    var type = object.type;
    if (typeof object.slice === 'function') {
      return object.slice(0, size, type);
    }
    return object.webkitSlice(0, size, type);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("108", ["106", "107"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var isBinaryObject = req('106');
  var cloneBinaryObject = req('107');
  module.exports = function clone(object) {
    var newObject;
    var i;
    var len;
    if (!object || typeof object !== 'object') {
      return object;
    }
    if (Array.isArray(object)) {
      newObject = [];
      for (i = 0, len = object.length; i < len; i++) {
        newObject[i] = clone(object[i]);
      }
      return newObject;
    }
    if (object instanceof Date) {
      return object.toISOString();
    }
    if (isBinaryObject(object)) {
      return cloneBinaryObject(object);
    }
    newObject = {};
    for (i in object) {
      if (Object.prototype.hasOwnProperty.call(object, i)) {
        var value = clone(object[i]);
        if (typeof value !== 'undefined') {
          newObject[i] = value;
        }
      }
    }
    return newObject;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("109", ["108"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var clone = req('108');
  function extendInner(obj, otherObj) {
    for (var key in otherObj) {
      if (otherObj.hasOwnProperty(key)) {
        var value = clone(otherObj[key]);
        if (typeof value !== 'undefined') {
          obj[key] = value;
        }
      }
    }
  }
  module.exports = function extend(obj, obj2, obj3) {
    extendInner(obj, obj2);
    if (obj3) {
      extendInner(obj, obj3);
    }
    return obj;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("10a", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function pick(obj, arr) {
    var res = {};
    for (var i = 0,
        len = arr.length; i < len; i++) {
      var prop = arr[i];
      if (prop in obj) {
        res[prop] = obj[prop];
      }
    }
    return res;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("10b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  function EventEmitter() {
    this._events = this._events || {};
    this._maxListeners = this._maxListeners || undefined;
  }
  module.exports = EventEmitter;
  EventEmitter.EventEmitter = EventEmitter;
  EventEmitter.prototype._events = undefined;
  EventEmitter.prototype._maxListeners = undefined;
  EventEmitter.defaultMaxListeners = 10;
  EventEmitter.prototype.setMaxListeners = function(n) {
    if (!isNumber(n) || n < 0 || isNaN(n))
      throw TypeError('n must be a positive number');
    this._maxListeners = n;
    return this;
  };
  EventEmitter.prototype.emit = function(type) {
    var er,
        handler,
        len,
        args,
        i,
        listeners;
    if (!this._events)
      this._events = {};
    if (type === 'error') {
      if (!this._events.error || (isObject(this._events.error) && !this._events.error.length)) {
        er = arguments[1];
        if (er instanceof Error) {
          throw er;
        }
        throw TypeError('Uncaught, unspecified "error" event.');
      }
    }
    handler = this._events[type];
    if (isUndefined(handler))
      return false;
    if (isFunction(handler)) {
      switch (arguments.length) {
        case 1:
          handler.call(this);
          break;
        case 2:
          handler.call(this, arguments[1]);
          break;
        case 3:
          handler.call(this, arguments[1], arguments[2]);
          break;
        default:
          len = arguments.length;
          args = new Array(len - 1);
          for (i = 1; i < len; i++)
            args[i - 1] = arguments[i];
          handler.apply(this, args);
      }
    } else if (isObject(handler)) {
      len = arguments.length;
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      listeners = handler.slice();
      len = listeners.length;
      for (i = 0; i < len; i++)
        listeners[i].apply(this, args);
    }
    return true;
  };
  EventEmitter.prototype.addListener = function(type, listener) {
    var m;
    if (!isFunction(listener))
      throw TypeError('listener must be a function');
    if (!this._events)
      this._events = {};
    if (this._events.newListener)
      this.emit('newListener', type, isFunction(listener.listener) ? listener.listener : listener);
    if (!this._events[type])
      this._events[type] = listener;
    else if (isObject(this._events[type]))
      this._events[type].push(listener);
    else
      this._events[type] = [this._events[type], listener];
    if (isObject(this._events[type]) && !this._events[type].warned) {
      var m;
      if (!isUndefined(this._maxListeners)) {
        m = this._maxListeners;
      } else {
        m = EventEmitter.defaultMaxListeners;
      }
      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' + 'leak detected. %d listeners added. ' + 'Use emitter.setMaxListeners() to increase limit.', this._events[type].length);
        if (typeof console.trace === 'function') {
          console.trace();
        }
      }
    }
    return this;
  };
  EventEmitter.prototype.on = EventEmitter.prototype.addListener;
  EventEmitter.prototype.once = function(type, listener) {
    if (!isFunction(listener))
      throw TypeError('listener must be a function');
    var fired = false;
    function g() {
      this.removeListener(type, g);
      if (!fired) {
        fired = true;
        listener.apply(this, arguments);
      }
    }
    g.listener = listener;
    this.on(type, g);
    return this;
  };
  EventEmitter.prototype.removeListener = function(type, listener) {
    var list,
        position,
        length,
        i;
    if (!isFunction(listener))
      throw TypeError('listener must be a function');
    if (!this._events || !this._events[type])
      return this;
    list = this._events[type];
    length = list.length;
    position = -1;
    if (list === listener || (isFunction(list.listener) && list.listener === listener)) {
      delete this._events[type];
      if (this._events.removeListener)
        this.emit('removeListener', type, listener);
    } else if (isObject(list)) {
      for (i = length; i-- > 0; ) {
        if (list[i] === listener || (list[i].listener && list[i].listener === listener)) {
          position = i;
          break;
        }
      }
      if (position < 0)
        return this;
      if (list.length === 1) {
        list.length = 0;
        delete this._events[type];
      } else {
        list.splice(position, 1);
      }
      if (this._events.removeListener)
        this.emit('removeListener', type, listener);
    }
    return this;
  };
  EventEmitter.prototype.removeAllListeners = function(type) {
    var key,
        listeners;
    if (!this._events)
      return this;
    if (!this._events.removeListener) {
      if (arguments.length === 0)
        this._events = {};
      else if (this._events[type])
        delete this._events[type];
      return this;
    }
    if (arguments.length === 0) {
      for (key in this._events) {
        if (key === 'removeListener')
          continue;
        this.removeAllListeners(key);
      }
      this.removeAllListeners('removeListener');
      this._events = {};
      return this;
    }
    listeners = this._events[type];
    if (isFunction(listeners)) {
      this.removeListener(type, listeners);
    } else {
      while (listeners.length)
        this.removeListener(type, listeners[listeners.length - 1]);
    }
    delete this._events[type];
    return this;
  };
  EventEmitter.prototype.listeners = function(type) {
    var ret;
    if (!this._events || !this._events[type])
      ret = [];
    else if (isFunction(this._events[type]))
      ret = [this._events[type]];
    else
      ret = this._events[type].slice();
    return ret;
  };
  EventEmitter.listenerCount = function(emitter, type) {
    var ret;
    if (!emitter._events || !emitter._events[type])
      ret = 0;
    else if (isFunction(emitter._events[type]))
      ret = 1;
    else
      ret = emitter._events[type].length;
    return ret;
  };
  function isFunction(arg) {
    return typeof arg === 'function';
  }
  function isNumber(arg) {
    return typeof arg === 'number';
  }
  function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
  }
  function isUndefined(arg) {
    return arg === void 0;
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("10c", ["10b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('10b');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("10d", ["10c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = $__System._nodeRequire ? $__System._nodeRequire('events') : req('10c');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("10e", ["10d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('10d');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("10f", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function isChromeApp() {
    return (typeof chrome !== "undefined" && typeof chrome.storage !== "undefined" && typeof chrome.storage.local !== "undefined");
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("110", ["10f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var isChromeApp = req('10f');
  var hasLocal;
  if (isChromeApp()) {
    hasLocal = false;
  } else {
    try {
      localStorage.setItem('_pouch_check_localstorage', 1);
      hasLocal = !!localStorage.getItem('_pouch_check_localstorage');
    } catch (e) {
      hasLocal = false;
    }
  }
  module.exports = function hasLocalStorage() {
    return hasLocal;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("111", ["10e", "f0", "10f", "110", "10a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var EventEmitter = req('10e').EventEmitter;
  var inherits = req('f0');
  var isChromeApp = req('10f');
  var hasLocalStorage = req('110');
  var pick = req('10a');
  inherits(Changes, EventEmitter);
  function attachBrowserEvents(self) {
    if (isChromeApp()) {
      chrome.storage.onChanged.addListener(function(e) {
        if (e.db_name != null) {
          self.emit(e.dbName.newValue);
        }
      });
    } else if (hasLocalStorage()) {
      if (typeof addEventListener !== 'undefined') {
        addEventListener("storage", function(e) {
          self.emit(e.key);
        });
      } else {
        window.attachEvent("storage", function(e) {
          self.emit(e.key);
        });
      }
    }
  }
  function Changes() {
    EventEmitter.call(this);
    this._listeners = {};
    attachBrowserEvents(this);
  }
  Changes.prototype.addListener = function(dbName, id, db, opts) {
    if (this._listeners[id]) {
      return;
    }
    var self = this;
    var inprogress = false;
    function eventFunction() {
      if (!self._listeners[id]) {
        return;
      }
      if (inprogress) {
        inprogress = 'waiting';
        return;
      }
      inprogress = true;
      var changesOpts = pick(opts, ['style', 'include_docs', 'attachments', 'conflicts', 'filter', 'doc_ids', 'view', 'since', 'query_params', 'binary']);
      db.changes(changesOpts).on('change', function(c) {
        if (c.seq > opts.since && !opts.cancelled) {
          opts.since = c.seq;
          opts.onChange(c);
        }
      }).on('complete', function() {
        if (inprogress === 'waiting') {
          setTimeout(function() {
            eventFunction();
          }, 0);
        }
        inprogress = false;
      }).on('error', function() {
        inprogress = false;
      });
    }
    this._listeners[id] = eventFunction;
    this.on(dbName, eventFunction);
  };
  Changes.prototype.removeListener = function(dbName, id) {
    if (!(id in this._listeners)) {
      return;
    }
    EventEmitter.prototype.removeListener.call(this, dbName, this._listeners[id]);
  };
  Changes.prototype.notifyLocalWindows = function(dbName) {
    if (isChromeApp()) {
      chrome.storage.local.set({dbName: dbName});
    } else if (hasLocalStorage()) {
      localStorage[dbName] = (localStorage[dbName] === "a") ? "b" : "a";
    }
  };
  Changes.prototype.notify = function(dbName) {
    this.emit(dbName);
    this.notifyLocalWindows(dbName);
  };
  module.exports = Changes;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("112", ["f9"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var getArguments = req('f9');
  function once(fun) {
    var called = false;
    return getArguments(function(args) {
      if (called) {
        throw new Error('once called more than once');
      } else {
        called = true;
        fun.apply(this, args);
      }
    });
  }
  module.exports = once;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("113", ["101", "f9", "108", "112", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var Promise = req('101');
    var getArguments = req('f9');
    var clone = req('108');
    var once = req('112');
    function toPromise(func) {
      return getArguments(function(args) {
        args = clone(args);
        var self = this;
        var tempCB = (typeof args[args.length - 1] === 'function') ? args.pop() : false;
        var usedCB;
        if (tempCB) {
          usedCB = function(err, resp) {
            process.nextTick(function() {
              tempCB(err, resp);
            });
          };
        }
        var promise = new Promise(function(fulfill, reject) {
          var resp;
          try {
            var callback = once(function(err, mesg) {
              if (err) {
                reject(err);
              } else {
                fulfill(mesg);
              }
            });
            args.push(callback);
            resp = func.apply(self, args);
            if (resp && typeof resp.then === 'function') {
              fulfill(resp);
            }
          } catch (e) {
            reject(e);
          }
        });
        if (usedCB) {
          promise.then(function(result) {
            usedCB(null, result);
          }, usedCB);
        }
        return promise;
      });
    }
    module.exports = toPromise;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("114", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function explain404(str) {
    if ('console' in global && 'info' in console) {
      console.info('The above 404 is totally normal. ' + str);
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("115", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var keys = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"];
  var qName = "queryKey";
  var qParser = /(?:^|&)([^&=]*)=?([^&]*)/g;
  var parser = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
  function parseUri(str) {
    var m = parser.exec(str);
    var uri = {};
    var i = 14;
    while (i--) {
      var key = keys[i];
      var value = m[i] || "";
      var encoded = ['user', 'password'].indexOf(key) !== -1;
      uri[key] = encoded ? decodeURIComponent(value) : value;
    }
    uri[qName] = {};
    uri[keys[12]].replace(qParser, function($0, $1, $2) {
      if ($1) {
        uri[qName][$1] = $2;
      }
    });
    return uri;
  }
  module.exports = parseUri;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("116", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  exports.stringify = function stringify(input) {
    var queue = [];
    queue.push({obj: input});
    var res = '';
    var next,
        obj,
        prefix,
        val,
        i,
        arrayPrefix,
        keys,
        k,
        key,
        value,
        objPrefix;
    while ((next = queue.pop())) {
      obj = next.obj;
      prefix = next.prefix || '';
      val = next.val || '';
      res += prefix;
      if (val) {
        res += val;
      } else if (typeof obj !== 'object') {
        res += typeof obj === 'undefined' ? null : JSON.stringify(obj);
      } else if (obj === null) {
        res += 'null';
      } else if (Array.isArray(obj)) {
        queue.push({val: ']'});
        for (i = obj.length - 1; i >= 0; i--) {
          arrayPrefix = i === 0 ? '' : ',';
          queue.push({
            obj: obj[i],
            prefix: arrayPrefix
          });
        }
        queue.push({val: '['});
      } else {
        keys = [];
        for (k in obj) {
          if (obj.hasOwnProperty(k)) {
            keys.push(k);
          }
        }
        queue.push({val: '}'});
        for (i = keys.length - 1; i >= 0; i--) {
          key = keys[i];
          value = obj[key];
          objPrefix = (i > 0 ? ',' : '');
          objPrefix += JSON.stringify(key) + ':';
          queue.push({
            obj: value,
            prefix: objPrefix
          });
        }
        queue.push({val: '{'});
      }
    }
    return res;
  };
  function pop(obj, stack, metaStack) {
    var lastMetaElement = metaStack[metaStack.length - 1];
    if (obj === lastMetaElement.element) {
      metaStack.pop();
      lastMetaElement = metaStack[metaStack.length - 1];
    }
    var element = lastMetaElement.element;
    var lastElementIndex = lastMetaElement.index;
    if (Array.isArray(element)) {
      element.push(obj);
    } else if (lastElementIndex === stack.length - 2) {
      var key = stack.pop();
      element[key] = obj;
    } else {
      stack.push(obj);
    }
  }
  exports.parse = function(str) {
    var stack = [];
    var metaStack = [];
    var i = 0;
    var collationIndex,
        parsedNum,
        numChar;
    var parsedString,
        lastCh,
        numConsecutiveSlashes,
        ch;
    var arrayElement,
        objElement;
    while (true) {
      collationIndex = str[i++];
      if (collationIndex === '}' || collationIndex === ']' || typeof collationIndex === 'undefined') {
        if (stack.length === 1) {
          return stack.pop();
        } else {
          pop(stack.pop(), stack, metaStack);
          continue;
        }
      }
      switch (collationIndex) {
        case ' ':
        case '\t':
        case '\n':
        case ':':
        case ',':
          break;
        case 'n':
          i += 3;
          pop(null, stack, metaStack);
          break;
        case 't':
          i += 3;
          pop(true, stack, metaStack);
          break;
        case 'f':
          i += 4;
          pop(false, stack, metaStack);
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
        case '-':
          parsedNum = '';
          i--;
          while (true) {
            numChar = str[i++];
            if (/[\d\.\-e\+]/.test(numChar)) {
              parsedNum += numChar;
            } else {
              i--;
              break;
            }
          }
          pop(parseFloat(parsedNum), stack, metaStack);
          break;
        case '"':
          parsedString = '';
          lastCh = void 0;
          numConsecutiveSlashes = 0;
          while (true) {
            ch = str[i++];
            if (ch !== '"' || (lastCh === '\\' && numConsecutiveSlashes % 2 === 1)) {
              parsedString += ch;
              lastCh = ch;
              if (lastCh === '\\') {
                numConsecutiveSlashes++;
              } else {
                numConsecutiveSlashes = 0;
              }
            } else {
              break;
            }
          }
          pop(JSON.parse('"' + parsedString + '"'), stack, metaStack);
          break;
        case '[':
          arrayElement = {
            element: [],
            index: stack.length
          };
          stack.push(arrayElement.element);
          metaStack.push(arrayElement);
          break;
        case '{':
          objElement = {
            element: {},
            index: stack.length
          };
          stack.push(objElement.element);
          metaStack.push(objElement);
          break;
        default:
          throw new Error('unexpectedly reached end of input: ' + collationIndex);
      }
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("117", ["116"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('116');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("ee", ["ea", "f6", "f7", "f9", "fb", "fc", "101", "103", "f1", "105", "108", "109", "10a", "f0", "111", "112", "113", "e9", "114", "115", "117"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var traverseRevTree = req('ea');
  exports.ajax = req('f6');
  exports.uuid = req('f7');
  exports.getArguments = req('f9');
  var collections = req('fb');
  exports.Map = collections.Map;
  exports.Set = collections.Set;
  var parseDoc = req('fc');
  var Promise = req('101');
  exports.Promise = Promise;
  var base64 = req('103');
  var errors = req('f1');
  exports.atob = base64.atob;
  exports.btoa = base64.btoa;
  var binStringToBlobOrBuffer = req('105');
  exports.binaryStringToBlobOrBuffer = binStringToBlobOrBuffer;
  exports.clone = req('108');
  exports.extend = req('109');
  exports.pick = req('10a');
  exports.inherits = req('f0');
  function tryFilter(filter, doc, req) {
    try {
      return !filter(doc, req);
    } catch (err) {
      var msg = 'Filter function threw: ' + err.toString();
      return errors.error(errors.BAD_REQUEST, msg);
    }
  }
  exports.filterChange = function filterChange(opts) {
    var req = {};
    var hasFilter = opts.filter && typeof opts.filter === 'function';
    req.query = opts.query_params;
    return function filter(change) {
      if (!change.doc) {
        change.doc = {};
      }
      var filterReturn = hasFilter && tryFilter(opts.filter, change.doc, req);
      if (typeof filterReturn === 'object') {
        return filterReturn;
      }
      if (filterReturn) {
        return false;
      }
      if (!opts.include_docs) {
        delete change.doc;
      } else if (!opts.attachments) {
        for (var att in change.doc._attachments) {
          if (change.doc._attachments.hasOwnProperty(att)) {
            change.doc._attachments[att].stub = true;
          }
        }
      }
      return true;
    };
  };
  exports.parseDoc = parseDoc.parseDoc;
  exports.invalidIdError = parseDoc.invalidIdError;
  exports.isCordova = function() {
    return (typeof cordova !== "undefined" || typeof PhoneGap !== "undefined" || typeof phonegap !== "undefined");
  };
  exports.Changes = req('111');
  exports.once = req('112');
  exports.toPromise = req('113');
  exports.adapterFun = function(name, callback) {
    var log = req('e9')('pouchdb:api');
    function logApiCall(self, name, args) {
      if (log.enabled) {
        var logArgs = [self._db_name, name];
        for (var i = 0; i < args.length - 1; i++) {
          logArgs.push(args[i]);
        }
        log.apply(null, logArgs);
        var origCallback = args[args.length - 1];
        args[args.length - 1] = function(err, res) {
          var responseArgs = [self._db_name, name];
          responseArgs = responseArgs.concat(err ? ['error', err] : ['success', res]);
          log.apply(null, responseArgs);
          origCallback(err, res);
        };
      }
    }
    return exports.toPromise(exports.getArguments(function(args) {
      if (this._closed) {
        return Promise.reject(new Error('database is closed'));
      }
      var self = this;
      logApiCall(self, name, args);
      if (!this.taskqueue.isReady) {
        return new Promise(function(fulfill, reject) {
          self.taskqueue.addTask(function(failed) {
            if (failed) {
              reject(failed);
            } else {
              fulfill(self[name].apply(self, args));
            }
          });
        });
      }
      return callback.apply(this, args);
    }));
  };
  exports.explain404 = req('114');
  exports.parseUri = req('115');
  exports.compare = function(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
  };
  exports.compactTree = function compactTree(metadata) {
    var revs = [];
    traverseRevTree(metadata.rev_tree, function(isLeaf, pos, revHash, ctx, opts) {
      if (opts.status === 'available' && !isLeaf) {
        revs.push(pos + '-' + revHash);
        opts.status = 'missing';
      }
    });
    return revs;
  };
  var vuvuzela = req('117');
  exports.safeJsonParse = function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return vuvuzela.parse(str);
    }
  };
  exports.safeJsonStringify = function safeJsonStringify(json) {
    try {
      return JSON.stringify(json);
    } catch (e) {
      return vuvuzela.stringify(json);
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("118", ["101"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var Promise = req('101');
  var upsert = module.exports = function upsert(db, docId, diffFun) {
    return new Promise(function(fulfill, reject) {
      if (typeof docId !== 'string') {
        return reject(new Error('doc id is required'));
      }
      db.get(docId, function(err, doc) {
        if (err) {
          if (err.status !== 404) {
            return reject(err);
          }
          doc = {};
        }
        var docRev = doc._rev;
        var newDoc = diffFun(doc);
        if (!newDoc) {
          return fulfill({
            updated: false,
            rev: docRev
          });
        }
        newDoc._id = docId;
        newDoc._rev = docRev;
        fulfill(tryAndPut(db, newDoc, diffFun));
      });
    });
  };
  function tryAndPut(db, doc, diffFun) {
    return db.put(doc).then(function(res) {
      return {
        updated: true,
        rev: res.rev
      };
    }, function(err) {
      if (err.status !== 409) {
        throw err;
      }
      return upsert(db, doc._id, diffFun);
    });
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("119", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function winningRev(metadata) {
    var winningId;
    var winningPos;
    var winningDeleted;
    var toVisit = metadata.rev_tree.slice();
    var node;
    while ((node = toVisit.pop())) {
      var tree = node.ids;
      var branches = tree[2];
      var pos = node.pos;
      if (branches.length) {
        for (var i = 0,
            len = branches.length; i < len; i++) {
          toVisit.push({
            pos: pos + 1,
            ids: branches[i]
          });
        }
        continue;
      }
      var deleted = !!tree[1].deleted;
      var id = tree[0];
      if (!winningId || (winningDeleted !== deleted ? winningDeleted : winningPos !== pos ? winningPos < pos : winningId < id)) {
        winningId = id;
        winningPos = pos;
        winningDeleted = deleted;
      }
    }
    return winningPos + '-' + winningId;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("11a", ["119"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var winningRev = req('119');
  function getTrees(node) {
    return node.ids;
  }
  function isDeleted(metadata, rev) {
    if (!rev) {
      rev = winningRev(metadata);
    }
    var id = rev.substring(rev.indexOf('-') + 1);
    var toVisit = metadata.rev_tree.map(getTrees);
    var tree;
    while ((tree = toVisit.pop())) {
      if (tree[0] === id) {
        return !!tree[1].deleted;
      }
      toVisit = toVisit.concat(tree[2]);
    }
  }
  module.exports = isDeleted;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("11b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = evalFilter;
  function evalFilter(input) {
    return eval(['(function () { return ', input, ' })()'].join(''));
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("11c", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = evalView;
  function evalView(input) {
    return eval(['(function () {', '  return function (doc) {', '    var emitted = false;', '    var emit = function (a, b) {', '      emitted = true;', '    };', '    var view = ' + input + ';', '    view(doc);', '    if (emitted) {', '      return true;', '    }', '  }', '})()'].join('\n'));
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("11d", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function parseDesignDocFunctionName(s) {
    if (!s) {
      return null;
    }
    var parts = s.split('/');
    if (parts.length === 2) {
      return parts;
    }
    if (parts.length === 1) {
      return [s, s];
    }
    return null;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("11e", ["11d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var parseDdocFunctionName = req('11d');
  module.exports = function normalizeDesignDocFunctionName(s) {
    var normalized = parseDdocFunctionName(s);
    return normalized ? normalized.join('/') : null;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("11f", ["ea"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var traverseRevTree = req('ea');
  function sortByPos(a, b) {
    return a.pos - b.pos;
  }
  module.exports = function collectLeaves(revs) {
    var leaves = [];
    traverseRevTree(revs, function(isLeaf, pos, id, acc, opts) {
      if (isLeaf) {
        leaves.push({
          rev: pos + "-" + id,
          pos: pos,
          opts: opts
        });
      }
    });
    leaves.sort(sortByPos).reverse();
    for (var i = 0,
        len = leaves.length; i < len; i++) {
      delete leaves[i].pos;
    }
    return leaves;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("120", ["119", "11f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var winningRev = req('119');
  var collectLeaves = req('11f');
  module.exports = function collectConflicts(metadata) {
    var win = winningRev(metadata);
    var leaves = collectLeaves(metadata.rev_tree);
    var conflicts = [];
    for (var i = 0,
        len = leaves.length; i < len; i++) {
      var leaf = leaves[i];
      if (leaf.rev !== win && !leaf.opts.deleted) {
        conflicts.push(leaf.rev);
      }
    }
    return conflicts;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("121", ["ee", "11a", "f1", "10e", "11b", "11c", "11d", "11e", "11f", "120", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var utils = req('ee');
    var isDeleted = req('11a');
    var errors = req('f1');
    var EE = req('10e').EventEmitter;
    var evalFilter = req('11b');
    var evalView = req('11c');
    var parseDdocFunctionName = req('11d');
    var normalizeDdocFunctionName = req('11e');
    var collectLeaves = req('11f');
    var collectConflicts = req('120');
    module.exports = Changes;
    utils.inherits(Changes, EE);
    function Changes(db, opts, callback) {
      EE.call(this);
      var self = this;
      this.db = db;
      opts = opts ? utils.clone(opts) : {};
      var complete = opts.complete = utils.once(function(err, resp) {
        if (err) {
          self.emit('error', err);
        } else {
          self.emit('complete', resp);
        }
        self.removeAllListeners();
        db.removeListener('destroyed', onDestroy);
      });
      if (callback) {
        self.on('complete', function(resp) {
          callback(null, resp);
        });
        self.on('error', function(err) {
          callback(err);
        });
      }
      function onDestroy() {
        self.cancel();
      }
      db.once('destroyed', onDestroy);
      opts.onChange = function(change) {
        if (opts.isCancelled) {
          return;
        }
        self.emit('change', change);
        if (self.startSeq && self.startSeq <= change.seq) {
          self.startSeq = false;
        }
      };
      var promise = new utils.Promise(function(fulfill, reject) {
        opts.complete = function(err, res) {
          if (err) {
            reject(err);
          } else {
            fulfill(res);
          }
        };
      });
      self.once('cancel', function() {
        db.removeListener('destroyed', onDestroy);
        opts.complete(null, {status: 'cancelled'});
      });
      this.then = promise.then.bind(promise);
      this['catch'] = promise['catch'].bind(promise);
      this.then(function(result) {
        complete(null, result);
      }, complete);
      if (!db.taskqueue.isReady) {
        db.taskqueue.addTask(function() {
          if (self.isCancelled) {
            self.emit('cancel');
          } else {
            self.doChanges(opts);
          }
        });
      } else {
        self.doChanges(opts);
      }
    }
    Changes.prototype.cancel = function() {
      this.isCancelled = true;
      if (this.db.taskqueue.isReady) {
        this.emit('cancel');
      }
    };
    function processChange(doc, metadata, opts) {
      var changeList = [{rev: doc._rev}];
      if (opts.style === 'all_docs') {
        changeList = collectLeaves(metadata.rev_tree).map(function(x) {
          return {rev: x.rev};
        });
      }
      var change = {
        id: metadata.id,
        changes: changeList,
        doc: doc
      };
      if (isDeleted(metadata, doc._rev)) {
        change.deleted = true;
      }
      if (opts.conflicts) {
        change.doc._conflicts = collectConflicts(metadata);
        if (!change.doc._conflicts.length) {
          delete change.doc._conflicts;
        }
      }
      return change;
    }
    Changes.prototype.doChanges = function(opts) {
      var self = this;
      var callback = opts.complete;
      opts = utils.clone(opts);
      if ('live' in opts && !('continuous' in opts)) {
        opts.continuous = opts.live;
      }
      opts.processChange = processChange;
      if (opts.since === 'latest') {
        opts.since = 'now';
      }
      if (!opts.since) {
        opts.since = 0;
      }
      if (opts.since === 'now') {
        this.db.info().then(function(info) {
          if (self.isCancelled) {
            callback(null, {status: 'cancelled'});
            return;
          }
          opts.since = info.update_seq;
          self.doChanges(opts);
        }, callback);
        return;
      }
      if (opts.continuous && opts.since !== 'now') {
        this.db.info().then(function(info) {
          self.startSeq = info.update_seq;
        }, function(err) {
          if (err.id === 'idbNull') {
            return;
          }
          throw err;
        });
      }
      if (opts.filter && typeof opts.filter === 'string') {
        if (opts.filter === '_view') {
          opts.view = normalizeDdocFunctionName(opts.view);
        } else {
          opts.filter = normalizeDdocFunctionName(opts.filter);
        }
        if (this.db.type() !== 'http' && !opts.doc_ids) {
          return this.filterChanges(opts);
        }
      }
      if (!('descending' in opts)) {
        opts.descending = false;
      }
      opts.limit = opts.limit === 0 ? 1 : opts.limit;
      opts.complete = callback;
      var newPromise = this.db._changes(opts);
      if (newPromise && typeof newPromise.cancel === 'function') {
        var cancel = self.cancel;
        self.cancel = utils.getArguments(function(args) {
          newPromise.cancel();
          cancel.apply(this, args);
        });
      }
    };
    Changes.prototype.filterChanges = function(opts) {
      var self = this;
      var callback = opts.complete;
      if (opts.filter === '_view') {
        if (!opts.view || typeof opts.view !== 'string') {
          var err = errors.error(errors.BAD_REQUEST, '`view` filter parameter not found or invalid.');
          return callback(err);
        }
        var viewName = parseDdocFunctionName(opts.view);
        this.db.get('_design/' + viewName[0], function(err, ddoc) {
          if (self.isCancelled) {
            return callback(null, {status: 'cancelled'});
          }
          if (err) {
            return callback(errors.generateErrorFromResponse(err));
          }
          var mapFun = ddoc && ddoc.views && ddoc.views[viewName[1]] && ddoc.views[viewName[1]].map;
          if (!mapFun) {
            return callback(errors.error(errors.MISSING_DOC, (ddoc.views ? 'missing json key: ' + viewName[1] : 'missing json key: views')));
          }
          opts.filter = evalView(mapFun);
          self.doChanges(opts);
        });
      } else {
        var filterName = parseDdocFunctionName(opts.filter);
        if (!filterName) {
          return callback(errors.error(errors.BAD_REQUEST, '`filter` filter parameter invalid.'));
        }
        this.db.get('_design/' + filterName[0], function(err, ddoc) {
          if (self.isCancelled) {
            return callback(null, {status: 'cancelled'});
          }
          if (err) {
            return callback(errors.generateErrorFromResponse(err));
          }
          var filterFun = ddoc && ddoc.filters && ddoc.filters[filterName[1]];
          if (!filterFun) {
            return callback(errors.error(errors.MISSING_DOC, ((ddoc && ddoc.filters) ? 'missing json key: ' + filterName[1] : 'missing json key: filters')));
          }
          opts.filter = evalFilter(filterFun);
          self.doChanges(opts);
        });
      }
    };
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("122", ["10a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var pick = req('10a');
  function bulkGet(db, opts, callback) {
    var requests = Array.isArray(opts) ? opts : opts.docs;
    if (!requests.length) {
      return callback(null, {results: []});
    }
    var requestsById = {};
    requests.forEach(function(request) {
      if (request.id in requestsById) {
        requestsById[request.id].push(request);
      } else {
        requestsById[request.id] = [request];
      }
    });
    var numDocs = Object.keys(requestsById).length;
    var numDone = 0;
    var perDocResults = new Array(numDocs);
    function collapseResults() {
      var results = [];
      perDocResults.forEach(function(res) {
        res.docs.forEach(function(info) {
          results.push({
            id: res.id,
            docs: [info]
          });
        });
      });
      callback(null, {results: results});
    }
    function checkDone() {
      if (++numDone === numDocs) {
        collapseResults();
      }
    }
    function gotResult(i, id, docs) {
      perDocResults[i] = {
        id: id,
        docs: docs
      };
      checkDone();
    }
    Object.keys(requestsById).forEach(function(docId, i) {
      var docRequests = requestsById[docId];
      var docOpts = pick(docRequests[0], ['atts_since', 'attachments']);
      docOpts.open_revs = docRequests.map(function(request) {
        return request.rev;
      });
      ['revs', 'attachments', 'binary'].forEach(function(param) {
        if (param in opts) {
          docOpts[param] = opts[param];
        }
      });
      db.get(docId, docOpts, function(err, res) {
        gotResult(i, docId, err ? [{error: err}] : res);
      });
    });
  }
  module.exports = bulkGet;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("123", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function isLocalId(id) {
    return (/^_local/).test(id);
  }
  module.exports = isLocalId;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("124", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function rootToLeaf(revs) {
    var paths = [];
    var toVisit = revs.slice();
    var node;
    while ((node = toVisit.pop())) {
      var pos = node.pos;
      var tree = node.ids;
      var id = tree[0];
      var opts = tree[1];
      var branches = tree[2];
      var isLeaf = branches.length === 0;
      var history = node.history ? node.history.slice() : [];
      history.push({
        id: id,
        opts: opts
      });
      if (isLeaf) {
        paths.push({
          pos: (pos + 1 - history.length),
          ids: history
        });
      }
      for (var i = 0,
          len = branches.length; i < len; i++) {
        toVisit.push({
          pos: pos + 1,
          ids: branches[i],
          history: history
        });
      }
    }
    return paths.reverse();
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("125", ["ee", "f1", "10e", "118", "121", "122", "11a", "123", "ea", "11f", "124", "120", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    "use strict";
    var utils = req('ee');
    var errors = req('f1');
    var EventEmitter = req('10e').EventEmitter;
    var upsert = req('118');
    var Changes = req('121');
    var bulkGetShim = req('122');
    var Promise = utils.Promise;
    var isDeleted = req('11a');
    var isLocalId = req('123');
    var traverseRevTree = req('ea');
    var collectLeaves = req('11f');
    var rootToLeaf = req('124');
    var collectConflicts = req('120');
    function arrayFirst(arr, callback) {
      for (var i = 0; i < arr.length; i++) {
        if (callback(arr[i], i) === true) {
          return arr[i];
        }
      }
      return false;
    }
    function yankError(callback) {
      return function(err, results) {
        if (err || (results[0] && results[0].error)) {
          callback(err || results[0]);
        } else {
          callback(null, results.length ? results[0] : results);
        }
      };
    }
    function cleanDocs(docs) {
      for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        if (doc._deleted) {
          delete doc._attachments;
        } else if (doc._attachments) {
          var atts = Object.keys(doc._attachments);
          for (var j = 0; j < atts.length; j++) {
            var att = atts[j];
            doc._attachments[att] = utils.pick(doc._attachments[att], ['data', 'digest', 'content_type', 'length', 'revpos', 'stub']);
          }
        }
      }
    }
    function compareByIdThenRev(a, b) {
      var idCompare = utils.compare(a._id, b._id);
      if (idCompare !== 0) {
        return idCompare;
      }
      var aStart = a._revisions ? a._revisions.start : 0;
      var bStart = b._revisions ? b._revisions.start : 0;
      return utils.compare(aStart, bStart);
    }
    function computeHeight(revs) {
      var height = {};
      var edges = [];
      traverseRevTree(revs, function(isLeaf, pos, id, prnt) {
        var rev = pos + "-" + id;
        if (isLeaf) {
          height[rev] = 0;
        }
        if (prnt !== undefined) {
          edges.push({
            from: prnt,
            to: rev
          });
        }
        return rev;
      });
      edges.reverse();
      edges.forEach(function(edge) {
        if (height[edge.from] === undefined) {
          height[edge.from] = 1 + height[edge.to];
        } else {
          height[edge.from] = Math.min(height[edge.from], 1 + height[edge.to]);
        }
      });
      return height;
    }
    function allDocsKeysQuery(api, opts, callback) {
      var keys = ('limit' in opts) ? opts.keys.slice(opts.skip, opts.limit + opts.skip) : (opts.skip > 0) ? opts.keys.slice(opts.skip) : opts.keys;
      if (opts.descending) {
        keys.reverse();
      }
      if (!keys.length) {
        return api._allDocs({limit: 0}, callback);
      }
      var finalResults = {offset: opts.skip};
      return Promise.all(keys.map(function(key) {
        var subOpts = utils.extend({
          key: key,
          deleted: 'ok'
        }, opts);
        ['limit', 'skip', 'keys'].forEach(function(optKey) {
          delete subOpts[optKey];
        });
        return new Promise(function(resolve, reject) {
          api._allDocs(subOpts, function(err, res) {
            if (err) {
              return reject(err);
            }
            finalResults.total_rows = res.total_rows;
            resolve(res.rows[0] || {
              key: key,
              error: 'not_found'
            });
          });
        });
      })).then(function(results) {
        finalResults.rows = results;
        return finalResults;
      });
    }
    function doNextCompaction(self) {
      var task = self._compactionQueue[0];
      var opts = task.opts;
      var callback = task.callback;
      self.get('_local/compaction').catch(function() {
        return false;
      }).then(function(doc) {
        if (doc && doc.last_seq) {
          opts.last_seq = doc.last_seq;
        }
        self._compact(opts, function(err, res) {
          if (err) {
            callback(err);
          } else {
            callback(null, res);
          }
          process.nextTick(function() {
            self._compactionQueue.shift();
            if (self._compactionQueue.length) {
              doNextCompaction(self);
            }
          });
        });
      });
    }
    function attachmentNameError(name) {
      if (name.charAt(0) === '_') {
        return name + 'is not a valid attachment name, attachment ' + 'names cannot start with \'_\'';
      }
      return false;
    }
    utils.inherits(AbstractPouchDB, EventEmitter);
    module.exports = AbstractPouchDB;
    function AbstractPouchDB() {
      EventEmitter.call(this);
    }
    AbstractPouchDB.prototype.post = utils.adapterFun('post', function(doc, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      if (typeof doc !== 'object' || Array.isArray(doc)) {
        return callback(errors.error(errors.NOT_AN_OBJECT));
      }
      this.bulkDocs({docs: [doc]}, opts, yankError(callback));
    });
    AbstractPouchDB.prototype.put = utils.adapterFun('put', utils.getArguments(function(args) {
      var temp,
          temptype,
          opts,
          callback;
      var doc = args.shift();
      var id = '_id' in doc;
      if (typeof doc !== 'object' || Array.isArray(doc)) {
        callback = args.pop();
        return callback(errors.error(errors.NOT_AN_OBJECT));
      }
      while (true) {
        temp = args.shift();
        temptype = typeof temp;
        if (temptype === "string" && !id) {
          doc._id = temp;
          id = true;
        } else if (temptype === "string" && id && !('_rev' in doc)) {
          doc._rev = temp;
        } else if (temptype === "object") {
          opts = temp;
        } else if (temptype === "function") {
          callback = temp;
        }
        if (!args.length) {
          break;
        }
      }
      opts = opts || {};
      var error = utils.invalidIdError(doc._id);
      if (error) {
        return callback(error);
      }
      if (isLocalId(doc._id) && typeof this._putLocal === 'function') {
        if (doc._deleted) {
          return this._removeLocal(doc, callback);
        } else {
          return this._putLocal(doc, callback);
        }
      }
      this.bulkDocs({docs: [doc]}, opts, yankError(callback));
    }));
    AbstractPouchDB.prototype.putAttachment = utils.adapterFun('putAttachment', function(docId, attachmentId, rev, blob, type, callback) {
      var api = this;
      if (typeof type === 'function') {
        callback = type;
        type = blob;
        blob = rev;
        rev = null;
      }
      if (typeof type === 'undefined') {
        type = blob;
        blob = rev;
        rev = null;
      }
      function createAttachment(doc) {
        doc._attachments = doc._attachments || {};
        doc._attachments[attachmentId] = {
          content_type: type,
          data: blob
        };
        return api.put(doc);
      }
      return api.get(docId).then(function(doc) {
        if (doc._rev !== rev) {
          throw errors.error(errors.REV_CONFLICT);
        }
        return createAttachment(doc);
      }, function(err) {
        if (err.reason === errors.MISSING_DOC.message) {
          return createAttachment({_id: docId});
        } else {
          throw err;
        }
      });
    });
    AbstractPouchDB.prototype.removeAttachment = utils.adapterFun('removeAttachment', function(docId, attachmentId, rev, callback) {
      var self = this;
      self.get(docId, function(err, obj) {
        if (err) {
          callback(err);
          return;
        }
        if (obj._rev !== rev) {
          callback(errors.error(errors.REV_CONFLICT));
          return;
        }
        if (!obj._attachments) {
          return callback();
        }
        delete obj._attachments[attachmentId];
        if (Object.keys(obj._attachments).length === 0) {
          delete obj._attachments;
        }
        self.put(obj, callback);
      });
    });
    AbstractPouchDB.prototype.remove = utils.adapterFun('remove', function(docOrId, optsOrRev, opts, callback) {
      var doc;
      if (typeof optsOrRev === 'string') {
        doc = {
          _id: docOrId,
          _rev: optsOrRev
        };
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
      } else {
        doc = docOrId;
        if (typeof optsOrRev === 'function') {
          callback = optsOrRev;
          opts = {};
        } else {
          callback = opts;
          opts = optsOrRev;
        }
      }
      opts = opts || {};
      opts.was_delete = true;
      var newDoc = {
        _id: doc._id,
        _rev: (doc._rev || opts.rev)
      };
      newDoc._deleted = true;
      if (isLocalId(newDoc._id) && typeof this._removeLocal === 'function') {
        return this._removeLocal(doc, callback);
      }
      this.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
    });
    AbstractPouchDB.prototype.revsDiff = utils.adapterFun('revsDiff', function(req, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      var ids = Object.keys(req);
      if (!ids.length) {
        return callback(null, {});
      }
      var count = 0;
      var missing = new utils.Map();
      function addToMissing(id, revId) {
        if (!missing.has(id)) {
          missing.set(id, {missing: []});
        }
        missing.get(id).missing.push(revId);
      }
      function processDoc(id, rev_tree) {
        var missingForId = req[id].slice(0);
        traverseRevTree(rev_tree, function(isLeaf, pos, revHash, ctx, opts) {
          var rev = pos + '-' + revHash;
          var idx = missingForId.indexOf(rev);
          if (idx === -1) {
            return;
          }
          missingForId.splice(idx, 1);
          if (opts.status !== 'available') {
            addToMissing(id, rev);
          }
        });
        missingForId.forEach(function(rev) {
          addToMissing(id, rev);
        });
      }
      ids.map(function(id) {
        this._getRevisionTree(id, function(err, rev_tree) {
          if (err && err.status === 404 && err.message === 'missing') {
            missing.set(id, {missing: req[id]});
          } else if (err) {
            return callback(err);
          } else {
            processDoc(id, rev_tree);
          }
          if (++count === ids.length) {
            var missingObj = {};
            missing.forEach(function(value, key) {
              missingObj[key] = value;
            });
            return callback(null, missingObj);
          }
        });
      }, this);
    });
    AbstractPouchDB.prototype.bulkGet = utils.adapterFun('bulkGet', function(opts, callback) {
      bulkGetShim(this, opts, callback);
    });
    AbstractPouchDB.prototype.compactDocument = utils.adapterFun('compactDocument', function(docId, maxHeight, callback) {
      var self = this;
      this._getRevisionTree(docId, function(err, revTree) {
        if (err) {
          return callback(err);
        }
        var height = computeHeight(revTree);
        var candidates = [];
        var revs = [];
        Object.keys(height).forEach(function(rev) {
          if (height[rev] > maxHeight) {
            candidates.push(rev);
          }
        });
        traverseRevTree(revTree, function(isLeaf, pos, revHash, ctx, opts) {
          var rev = pos + '-' + revHash;
          if (opts.status === 'available' && candidates.indexOf(rev) !== -1) {
            revs.push(rev);
          }
        });
        self._doCompaction(docId, revs, callback);
      });
    });
    AbstractPouchDB.prototype.compact = utils.adapterFun('compact', function(opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      var self = this;
      opts = opts || {};
      self._compactionQueue = self._compactionQueue || [];
      self._compactionQueue.push({
        opts: opts,
        callback: callback
      });
      if (self._compactionQueue.length === 1) {
        doNextCompaction(self);
      }
    });
    AbstractPouchDB.prototype._compact = function(opts, callback) {
      var self = this;
      var changesOpts = {
        returnDocs: false,
        last_seq: opts.last_seq || 0
      };
      var promises = [];
      function onChange(row) {
        promises.push(self.compactDocument(row.id, 0));
      }
      function onComplete(resp) {
        var lastSeq = resp.last_seq;
        Promise.all(promises).then(function() {
          return upsert(self, '_local/compaction', function deltaFunc(doc) {
            if (!doc.last_seq || doc.last_seq < lastSeq) {
              doc.last_seq = lastSeq;
              return doc;
            }
            return false;
          });
        }).then(function() {
          callback(null, {ok: true});
        }).catch(callback);
      }
      self.changes(changesOpts).on('change', onChange).on('complete', onComplete).on('error', callback);
    };
    AbstractPouchDB.prototype.get = utils.adapterFun('get', function(id, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      if (typeof id !== 'string') {
        return callback(errors.error(errors.INVALID_ID));
      }
      if (isLocalId(id) && typeof this._getLocal === 'function') {
        return this._getLocal(id, callback);
      }
      var leaves = [],
          self = this;
      function finishOpenRevs() {
        var result = [];
        var count = leaves.length;
        if (!count) {
          return callback(null, result);
        }
        leaves.forEach(function(leaf) {
          self.get(id, {
            rev: leaf,
            revs: opts.revs,
            attachments: opts.attachments
          }, function(err, doc) {
            if (!err) {
              result.push({ok: doc});
            } else {
              result.push({missing: leaf});
            }
            count--;
            if (!count) {
              callback(null, result);
            }
          });
        });
      }
      if (opts.open_revs) {
        if (opts.open_revs === "all") {
          this._getRevisionTree(id, function(err, rev_tree) {
            if (err) {
              return callback(err);
            }
            leaves = collectLeaves(rev_tree).map(function(leaf) {
              return leaf.rev;
            });
            finishOpenRevs();
          });
        } else {
          if (Array.isArray(opts.open_revs)) {
            leaves = opts.open_revs;
            for (var i = 0; i < leaves.length; i++) {
              var l = leaves[i];
              if (!(typeof(l) === "string" && /^\d+-/.test(l))) {
                return callback(errors.error(errors.INVALID_REV));
              }
            }
            finishOpenRevs();
          } else {
            return callback(errors.error(errors.UNKNOWN_ERROR, 'function_clause'));
          }
        }
        return;
      }
      return this._get(id, opts, function(err, result) {
        if (err) {
          return callback(err);
        }
        var doc = result.doc;
        var metadata = result.metadata;
        var ctx = result.ctx;
        if (opts.conflicts) {
          var conflicts = collectConflicts(metadata);
          if (conflicts.length) {
            doc._conflicts = conflicts;
          }
        }
        if (isDeleted(metadata, doc._rev)) {
          doc._deleted = true;
        }
        if (opts.revs || opts.revs_info) {
          var paths = rootToLeaf(metadata.rev_tree);
          var path = arrayFirst(paths, function(arr) {
            return arr.ids.map(function(x) {
              return x.id;
            }).indexOf(doc._rev.split('-')[1]) !== -1;
          });
          var indexOfRev = path.ids.map(function(x) {
            return x.id;
          }).indexOf(doc._rev.split('-')[1]) + 1;
          var howMany = path.ids.length - indexOfRev;
          path.ids.splice(indexOfRev, howMany);
          path.ids.reverse();
          if (opts.revs) {
            doc._revisions = {
              start: (path.pos + path.ids.length) - 1,
              ids: path.ids.map(function(rev) {
                return rev.id;
              })
            };
          }
          if (opts.revs_info) {
            var pos = path.pos + path.ids.length;
            doc._revs_info = path.ids.map(function(rev) {
              pos--;
              return {
                rev: pos + '-' + rev.id,
                status: rev.opts.status
              };
            });
          }
        }
        if (opts.attachments && doc._attachments) {
          var attachments = doc._attachments;
          var count = Object.keys(attachments).length;
          if (count === 0) {
            return callback(null, doc);
          }
          Object.keys(attachments).forEach(function(key) {
            this._getAttachment(attachments[key], {
              binary: opts.binary,
              ctx: ctx
            }, function(err, data) {
              var att = doc._attachments[key];
              att.data = data;
              delete att.stub;
              delete att.length;
              if (!--count) {
                callback(null, doc);
              }
            });
          }, self);
        } else {
          if (doc._attachments) {
            for (var key in doc._attachments) {
              if (doc._attachments.hasOwnProperty(key)) {
                doc._attachments[key].stub = true;
              }
            }
          }
          callback(null, doc);
        }
      });
    });
    AbstractPouchDB.prototype.getAttachment = utils.adapterFun('getAttachment', function(docId, attachmentId, opts, callback) {
      var self = this;
      if (opts instanceof Function) {
        callback = opts;
        opts = {};
      }
      this._get(docId, opts, function(err, res) {
        if (err) {
          return callback(err);
        }
        if (res.doc._attachments && res.doc._attachments[attachmentId]) {
          opts.ctx = res.ctx;
          opts.binary = true;
          self._getAttachment(res.doc._attachments[attachmentId], opts, callback);
        } else {
          return callback(errors.error(errors.MISSING_DOC));
        }
      });
    });
    AbstractPouchDB.prototype.allDocs = utils.adapterFun('allDocs', function(opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      opts.skip = typeof opts.skip !== 'undefined' ? opts.skip : 0;
      if (opts.start_key) {
        opts.startkey = opts.start_key;
      }
      if (opts.end_key) {
        opts.endkey = opts.end_key;
      }
      if ('keys' in opts) {
        if (!Array.isArray(opts.keys)) {
          return callback(new TypeError('options.keys must be an array'));
        }
        var incompatibleOpt = ['startkey', 'endkey', 'key'].filter(function(incompatibleOpt) {
          return incompatibleOpt in opts;
        })[0];
        if (incompatibleOpt) {
          callback(errors.error(errors.QUERY_PARSE_ERROR, 'Query parameter `' + incompatibleOpt + '` is not compatible with multi-get'));
          return;
        }
        if (this.type() !== 'http') {
          return allDocsKeysQuery(this, opts, callback);
        }
      }
      return this._allDocs(opts, callback);
    });
    AbstractPouchDB.prototype.changes = function(opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      return new Changes(this, opts, callback);
    };
    AbstractPouchDB.prototype.close = utils.adapterFun('close', function(callback) {
      this._closed = true;
      return this._close(callback);
    });
    AbstractPouchDB.prototype.info = utils.adapterFun('info', function(callback) {
      var self = this;
      this._info(function(err, info) {
        if (err) {
          return callback(err);
        }
        info.db_name = info.db_name || self._db_name;
        info.auto_compaction = !!(self.auto_compaction && self.type() !== 'http');
        info.adapter = self.type();
        callback(null, info);
      });
    });
    AbstractPouchDB.prototype.id = utils.adapterFun('id', function(callback) {
      return this._id(callback);
    });
    AbstractPouchDB.prototype.type = function() {
      return (typeof this._type === 'function') ? this._type() : this.adapter;
    };
    AbstractPouchDB.prototype.bulkDocs = utils.adapterFun('bulkDocs', function(req, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      opts = opts || {};
      if (Array.isArray(req)) {
        req = {docs: req};
      }
      if (!req || !req.docs || !Array.isArray(req.docs)) {
        return callback(errors.error(errors.MISSING_BULK_DOCS));
      }
      for (var i = 0; i < req.docs.length; ++i) {
        if (typeof req.docs[i] !== 'object' || Array.isArray(req.docs[i])) {
          return callback(errors.error(errors.NOT_AN_OBJECT));
        }
      }
      var attachmentError;
      req.docs.forEach(function(doc) {
        if (doc._attachments) {
          Object.keys(doc._attachments).forEach(function(name) {
            attachmentError = attachmentError || attachmentNameError(name);
          });
        }
      });
      if (attachmentError) {
        return callback(errors.error(errors.BAD_REQUEST, attachmentError));
      }
      if (!('new_edits' in opts)) {
        if ('new_edits' in req) {
          opts.new_edits = req.new_edits;
        } else {
          opts.new_edits = true;
        }
      }
      if (!opts.new_edits && this.type() !== 'http') {
        req.docs.sort(compareByIdThenRev);
      }
      cleanDocs(req.docs);
      return this._bulkDocs(req, opts, function(err, res) {
        if (err) {
          return callback(err);
        }
        if (!opts.new_edits) {
          res = res.filter(function(x) {
            return x.error;
          });
        }
        callback(null, res);
      });
    });
    AbstractPouchDB.prototype.registerDependentDatabase = utils.adapterFun('registerDependentDatabase', function(dependentDb, callback) {
      var depDB = new this.constructor(dependentDb, this.__opts);
      function diffFun(doc) {
        doc.dependentDbs = doc.dependentDbs || {};
        if (doc.dependentDbs[dependentDb]) {
          return false;
        }
        doc.dependentDbs[dependentDb] = true;
        return doc;
      }
      upsert(this, '_local/_pouch_dependentDbs', diffFun).then(function() {
        callback(null, {db: depDB});
      }).catch(callback);
    });
    AbstractPouchDB.prototype.destroy = utils.adapterFun('destroy', function(opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      var self = this;
      var usePrefix = 'use_prefix' in self ? self.use_prefix : true;
      function destroyDb() {
        self._destroy(opts, function(err, resp) {
          if (err) {
            return callback(err);
          }
          self.emit('destroyed');
          callback(null, resp || {'ok': true});
        });
      }
      if (self.type() === 'http') {
        return destroyDb();
      }
      self.get('_local/_pouch_dependentDbs', function(err, localDoc) {
        if (err) {
          if (err.status !== 404) {
            return callback(err);
          } else {
            return destroyDb();
          }
        }
        var dependentDbs = localDoc.dependentDbs;
        var PouchDB = self.constructor;
        var deletedMap = Object.keys(dependentDbs).map(function(name) {
          var trueName = usePrefix ? name.replace(new RegExp('^' + PouchDB.prefix), '') : name;
          return new PouchDB(trueName, self.__opts).destroy();
        });
        Promise.all(deletedMap).then(destroyDb, function(error) {
          callback(error);
        });
      });
    });
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("126", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = TaskQueue;
  function TaskQueue() {
    this.isReady = false;
    this.failed = false;
    this.queue = [];
  }
  TaskQueue.prototype.execute = function() {
    var fun;
    if (this.failed) {
      while ((fun = this.queue.shift())) {
        fun(this.failed);
      }
    } else {
      while ((fun = this.queue.shift())) {
        fun();
      }
    }
  };
  TaskQueue.prototype.fail = function(err) {
    this.failed = err;
    this.execute();
  };
  TaskQueue.prototype.ready = function(db) {
    this.isReady = true;
    this.db = db;
    this.execute();
  };
  TaskQueue.prototype.addTask = function(fun) {
    this.queue.push(fun);
    if (this.failed) {
      this.execute();
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("127", ["e9", "125", "ee", "126"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var debug = req('e9');
  var Adapter = req('125');
  var utils = req('ee');
  var TaskQueue = req('126');
  var Promise = utils.Promise;
  function defaultCallback(err) {
    if (err && global.debug) {
      console.error(err);
    }
  }
  function prepareForDestruction(self, opts) {
    var name = opts.originalName;
    var ctor = self.constructor;
    var destructionListeners = ctor._destructionListeners;
    function onDestroyed() {
      ctor.emit('destroyed', name);
      ctor.emit(name, 'destroyed');
    }
    function onConstructorDestroyed() {
      self.removeListener('destroyed', onDestroyed);
      self.emit('destroyed', self);
    }
    self.once('destroyed', onDestroyed);
    if (!destructionListeners.has(name)) {
      destructionListeners.set(name, []);
    }
    destructionListeners.get(name).push(onConstructorDestroyed);
  }
  utils.inherits(PouchDB, Adapter);
  function PouchDB(name, opts, callback) {
    if (!(this instanceof PouchDB)) {
      return new PouchDB(name, opts, callback);
    }
    var self = this;
    if (typeof opts === 'function' || typeof opts === 'undefined') {
      callback = opts;
      opts = {};
    }
    if (name && typeof name === 'object') {
      opts = name;
      name = undefined;
    }
    if (typeof callback === 'undefined') {
      callback = defaultCallback;
    }
    name = name || opts.name;
    opts = utils.clone(opts);
    delete opts.name;
    this.__opts = opts;
    var oldCB = callback;
    self.auto_compaction = opts.auto_compaction;
    self.prefix = PouchDB.prefix;
    Adapter.call(self);
    self.taskqueue = new TaskQueue();
    var promise = new Promise(function(fulfill, reject) {
      callback = function(err, resp) {
        if (err) {
          return reject(err);
        }
        delete resp.then;
        fulfill(resp);
      };
      opts = utils.clone(opts);
      var originalName = opts.name || name;
      var backend,
          error;
      (function() {
        try {
          if (typeof originalName !== 'string') {
            error = new Error('Missing/invalid DB name');
            error.code = 400;
            throw error;
          }
          backend = PouchDB.parseAdapter(originalName, opts);
          opts.originalName = originalName;
          opts.name = backend.name;
          if (opts.prefix && backend.adapter !== 'http' && backend.adapter !== 'https') {
            opts.name = opts.prefix + opts.name;
          }
          opts.adapter = opts.adapter || backend.adapter;
          self._adapter = opts.adapter;
          debug('pouchdb:adapter')('Picked adapter: ' + opts.adapter);
          self._db_name = originalName;
          if (!PouchDB.adapters[opts.adapter]) {
            error = new Error('Adapter is missing');
            error.code = 404;
            throw error;
          }
          if (!PouchDB.adapters[opts.adapter].valid()) {
            error = new Error('Invalid Adapter');
            error.code = 404;
            throw error;
          }
        } catch (err) {
          self.taskqueue.fail(err);
        }
      }());
      if (error) {
        return reject(error);
      }
      self.adapter = opts.adapter;
      self.replicate = {};
      self.replicate.from = function(url, opts, callback) {
        return self.constructor.replicate(url, self, opts, callback);
      };
      self.replicate.to = function(url, opts, callback) {
        return self.constructor.replicate(self, url, opts, callback);
      };
      self.sync = function(dbName, opts, callback) {
        return self.constructor.sync(self, dbName, opts, callback);
      };
      self.replicate.sync = self.sync;
      PouchDB.adapters[opts.adapter].call(self, opts, function(err) {
        if (err) {
          self.taskqueue.fail(err);
          callback(err);
          return;
        }
        prepareForDestruction(self, opts);
        self.emit('created', self);
        PouchDB.emit('created', opts.originalName);
        self.taskqueue.ready(self);
        callback(null, self);
      });
      if (utils.isCordova()) {
        cordova.fireWindowEvent(opts.name + "_pouch", {});
      }
    });
    promise.then(function(resp) {
      oldCB(null, resp);
    }, oldCB);
    self.then = promise.then.bind(promise);
    self.catch = promise.catch.bind(promise);
  }
  PouchDB.debug = debug;
  module.exports = PouchDB;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("128", ["127", "ee", "10e", "110"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var PouchDB = req('127');
  var utils = req('ee');
  var EE = req('10e').EventEmitter;
  var hasLocalStorage = req('110');
  PouchDB.adapters = {};
  PouchDB.preferredAdapters = [];
  PouchDB.prefix = '_pouch_';
  var eventEmitter = new EE();
  function setUpEventEmitter(Pouch) {
    Object.keys(EE.prototype).forEach(function(key) {
      if (typeof EE.prototype[key] === 'function') {
        Pouch[key] = eventEmitter[key].bind(eventEmitter);
      }
    });
    var destructionListeners = Pouch._destructionListeners = new utils.Map();
    Pouch.on('destroyed', function onConstructorDestroyed(name) {
      if (!destructionListeners.has(name)) {
        return;
      }
      destructionListeners.get(name).forEach(function(callback) {
        callback();
      });
      destructionListeners.delete(name);
    });
  }
  setUpEventEmitter(PouchDB);
  PouchDB.parseAdapter = function(name, opts) {
    var match = name.match(/([a-z\-]*):\/\/(.*)/);
    var adapter,
        adapterName;
    if (match) {
      name = /http(s?)/.test(match[1]) ? match[1] + '://' + match[2] : match[2];
      adapter = match[1];
      if (!PouchDB.adapters[adapter].valid()) {
        throw 'Invalid adapter';
      }
      return {
        name: name,
        adapter: match[1]
      };
    }
    var skipIdb = 'idb' in PouchDB.adapters && 'websql' in PouchDB.adapters && hasLocalStorage() && localStorage['_pouch__websqldb_' + PouchDB.prefix + name];
    if (opts.adapter) {
      adapterName = opts.adapter;
    } else if (typeof opts !== 'undefined' && opts.db) {
      adapterName = 'leveldb';
    } else {
      for (var i = 0; i < PouchDB.preferredAdapters.length; ++i) {
        adapterName = PouchDB.preferredAdapters[i];
        if (adapterName in PouchDB.adapters) {
          if (skipIdb && adapterName === 'idb') {
            console.log('PouchDB is downgrading "' + name + '" to WebSQL to' + ' avoid data loss, because it was already opened with WebSQL.');
            continue;
          }
          break;
        }
      }
    }
    adapter = PouchDB.adapters[adapterName];
    var usePrefix = (adapter && 'use_prefix' in adapter) ? adapter.use_prefix : true;
    return {
      name: usePrefix ? (PouchDB.prefix + name) : name,
      adapter: adapterName
    };
  };
  PouchDB.adapter = function(id, obj, addToPreferredAdapters) {
    if (obj.valid()) {
      PouchDB.adapters[id] = obj;
      if (addToPreferredAdapters) {
        PouchDB.preferredAdapters.push(id);
      }
    }
  };
  PouchDB.plugin = function(obj) {
    Object.keys(obj).forEach(function(id) {
      PouchDB.prototype[id] = obj[id];
    });
    return PouchDB;
  };
  PouchDB.defaults = function(defaultOpts) {
    function PouchAlt(name, opts, callback) {
      if (!(this instanceof PouchAlt)) {
        return new PouchAlt(name, opts, callback);
      }
      if (typeof opts === 'function' || typeof opts === 'undefined') {
        callback = opts;
        opts = {};
      }
      if (name && typeof name === 'object') {
        opts = name;
        name = undefined;
      }
      opts = utils.extend({}, defaultOpts, opts);
      PouchDB.call(this, name, opts, callback);
    }
    utils.inherits(PouchAlt, PouchDB);
    setUpEventEmitter(PouchAlt);
    PouchAlt.preferredAdapters = PouchDB.preferredAdapters.slice();
    Object.keys(PouchDB).forEach(function(key) {
      if (!(key in PouchAlt)) {
        PouchAlt[key] = PouchDB[key];
      }
    });
    return PouchAlt;
  };
  module.exports = PouchDB;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("129", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function pad(str, padWith, upToLength) {
    var padding = '';
    var targetLength = upToLength - str.length;
    while (padding.length < targetLength) {
      padding += padWith;
    }
    return padding;
  }
  exports.padLeft = function(str, padWith, upToLength) {
    var padding = pad(str, padWith, upToLength);
    return padding + str;
  };
  exports.padRight = function(str, padWith, upToLength) {
    var padding = pad(str, padWith, upToLength);
    return str + padding;
  };
  exports.stringLexCompare = function(a, b) {
    var aLen = a.length;
    var bLen = b.length;
    var i;
    for (i = 0; i < aLen; i++) {
      if (i === bLen) {
        return 1;
      }
      var aChar = a.charAt(i);
      var bChar = b.charAt(i);
      if (aChar !== bChar) {
        return aChar < bChar ? -1 : 1;
      }
    }
    if (aLen < bLen) {
      return -1;
    }
    return 0;
  };
  exports.intToDecimalForm = function(int) {
    var isNeg = int < 0;
    var result = '';
    do {
      var remainder = isNeg ? -Math.ceil(int % 10) : Math.floor(int % 10);
      result = remainder + result;
      int = isNeg ? Math.ceil(int / 10) : Math.floor(int / 10);
    } while (int);
    if (isNeg && result !== '0') {
      result = '-' + result;
    }
    return result;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12a", ["129"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var MIN_MAGNITUDE = -324;
  var MAGNITUDE_DIGITS = 3;
  var SEP = '';
  var utils = req('129');
  exports.collate = function(a, b) {
    if (a === b) {
      return 0;
    }
    a = exports.normalizeKey(a);
    b = exports.normalizeKey(b);
    var ai = collationIndex(a);
    var bi = collationIndex(b);
    if ((ai - bi) !== 0) {
      return ai - bi;
    }
    if (a === null) {
      return 0;
    }
    switch (typeof a) {
      case 'number':
        return a - b;
      case 'boolean':
        return a === b ? 0 : (a < b ? -1 : 1);
      case 'string':
        return stringCollate(a, b);
    }
    return Array.isArray(a) ? arrayCollate(a, b) : objectCollate(a, b);
  };
  exports.normalizeKey = function(key) {
    switch (typeof key) {
      case 'undefined':
        return null;
      case 'number':
        if (key === Infinity || key === -Infinity || isNaN(key)) {
          return null;
        }
        return key;
      case 'object':
        var origKey = key;
        if (Array.isArray(key)) {
          var len = key.length;
          key = new Array(len);
          for (var i = 0; i < len; i++) {
            key[i] = exports.normalizeKey(origKey[i]);
          }
        } else if (key instanceof Date) {
          return key.toJSON();
        } else if (key !== null) {
          key = {};
          for (var k in origKey) {
            if (origKey.hasOwnProperty(k)) {
              var val = origKey[k];
              if (typeof val !== 'undefined') {
                key[k] = exports.normalizeKey(val);
              }
            }
          }
        }
    }
    return key;
  };
  function indexify(key) {
    if (key !== null) {
      switch (typeof key) {
        case 'boolean':
          return key ? 1 : 0;
        case 'number':
          return numToIndexableString(key);
        case 'string':
          return key.replace(/\u0002/g, '\u0002\u0002').replace(/\u0001/g, '\u0001\u0002').replace(/\u0000/g, '\u0001\u0001');
        case 'object':
          var isArray = Array.isArray(key);
          var arr = isArray ? key : Object.keys(key);
          var i = -1;
          var len = arr.length;
          var result = '';
          if (isArray) {
            while (++i < len) {
              result += exports.toIndexableString(arr[i]);
            }
          } else {
            while (++i < len) {
              var objKey = arr[i];
              result += exports.toIndexableString(objKey) + exports.toIndexableString(key[objKey]);
            }
          }
          return result;
      }
    }
    return '';
  }
  exports.toIndexableString = function(key) {
    var zero = '\u0000';
    key = exports.normalizeKey(key);
    return collationIndex(key) + SEP + indexify(key) + zero;
  };
  function parseNumber(str, i) {
    var originalIdx = i;
    var num;
    var zero = str[i] === '1';
    if (zero) {
      num = 0;
      i++;
    } else {
      var neg = str[i] === '0';
      i++;
      var numAsString = '';
      var magAsString = str.substring(i, i + MAGNITUDE_DIGITS);
      var magnitude = parseInt(magAsString, 10) + MIN_MAGNITUDE;
      if (neg) {
        magnitude = -magnitude;
      }
      i += MAGNITUDE_DIGITS;
      while (true) {
        var ch = str[i];
        if (ch === '\u0000') {
          break;
        } else {
          numAsString += ch;
        }
        i++;
      }
      numAsString = numAsString.split('.');
      if (numAsString.length === 1) {
        num = parseInt(numAsString, 10);
      } else {
        num = parseFloat(numAsString[0] + '.' + numAsString[1]);
      }
      if (neg) {
        num = num - 10;
      }
      if (magnitude !== 0) {
        num = parseFloat(num + 'e' + magnitude);
      }
    }
    return {
      num: num,
      length: i - originalIdx
    };
  }
  function pop(stack, metaStack) {
    var obj = stack.pop();
    if (metaStack.length) {
      var lastMetaElement = metaStack[metaStack.length - 1];
      if (obj === lastMetaElement.element) {
        metaStack.pop();
        lastMetaElement = metaStack[metaStack.length - 1];
      }
      var element = lastMetaElement.element;
      var lastElementIndex = lastMetaElement.index;
      if (Array.isArray(element)) {
        element.push(obj);
      } else if (lastElementIndex === stack.length - 2) {
        var key = stack.pop();
        element[key] = obj;
      } else {
        stack.push(obj);
      }
    }
  }
  exports.parseIndexableString = function(str) {
    var stack = [];
    var metaStack = [];
    var i = 0;
    while (true) {
      var collationIndex = str[i++];
      if (collationIndex === '\u0000') {
        if (stack.length === 1) {
          return stack.pop();
        } else {
          pop(stack, metaStack);
          continue;
        }
      }
      switch (collationIndex) {
        case '1':
          stack.push(null);
          break;
        case '2':
          stack.push(str[i] === '1');
          i++;
          break;
        case '3':
          var parsedNum = parseNumber(str, i);
          stack.push(parsedNum.num);
          i += parsedNum.length;
          break;
        case '4':
          var parsedStr = '';
          while (true) {
            var ch = str[i];
            if (ch === '\u0000') {
              break;
            }
            parsedStr += ch;
            i++;
          }
          parsedStr = parsedStr.replace(/\u0001\u0001/g, '\u0000').replace(/\u0001\u0002/g, '\u0001').replace(/\u0002\u0002/g, '\u0002');
          stack.push(parsedStr);
          break;
        case '5':
          var arrayElement = {
            element: [],
            index: stack.length
          };
          stack.push(arrayElement.element);
          metaStack.push(arrayElement);
          break;
        case '6':
          var objElement = {
            element: {},
            index: stack.length
          };
          stack.push(objElement.element);
          metaStack.push(objElement);
          break;
        default:
          throw new Error('bad collationIndex or unexpectedly reached end of input: ' + collationIndex);
      }
    }
  };
  function arrayCollate(a, b) {
    var len = Math.min(a.length, b.length);
    for (var i = 0; i < len; i++) {
      var sort = exports.collate(a[i], b[i]);
      if (sort !== 0) {
        return sort;
      }
    }
    return (a.length === b.length) ? 0 : (a.length > b.length) ? 1 : -1;
  }
  function stringCollate(a, b) {
    return (a === b) ? 0 : ((a > b) ? 1 : -1);
  }
  function objectCollate(a, b) {
    var ak = Object.keys(a),
        bk = Object.keys(b);
    var len = Math.min(ak.length, bk.length);
    for (var i = 0; i < len; i++) {
      var sort = exports.collate(ak[i], bk[i]);
      if (sort !== 0) {
        return sort;
      }
      sort = exports.collate(a[ak[i]], b[bk[i]]);
      if (sort !== 0) {
        return sort;
      }
    }
    return (ak.length === bk.length) ? 0 : (ak.length > bk.length) ? 1 : -1;
  }
  function collationIndex(x) {
    var id = ['boolean', 'number', 'string', 'object'];
    var idx = id.indexOf(typeof x);
    if (~idx) {
      if (x === null) {
        return 1;
      }
      if (Array.isArray(x)) {
        return 5;
      }
      return idx < 3 ? (idx + 2) : (idx + 3);
    }
    if (Array.isArray(x)) {
      return 5;
    }
  }
  function numToIndexableString(num) {
    if (num === 0) {
      return '1';
    }
    var expFormat = num.toExponential().split(/e\+?/);
    var magnitude = parseInt(expFormat[1], 10);
    var neg = num < 0;
    var result = neg ? '0' : '2';
    var magForComparison = ((neg ? -magnitude : magnitude) - MIN_MAGNITUDE);
    var magString = utils.padLeft((magForComparison).toString(), '0', MAGNITUDE_DIGITS);
    result += SEP + magString;
    var factor = Math.abs(parseFloat(expFormat[0]));
    if (neg) {
      factor = 10 - factor;
    }
    var factorStr = factor.toFixed(20);
    factorStr = factorStr.replace(/\.?0+$/, '');
    result += SEP + factorStr;
    return result;
  }
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12b", ["12a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('12a');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12c", ["101", "114", "12b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var Promise = req('101');
  var explain404 = req('114');
  var pouchCollate = req('12b');
  var collate = pouchCollate.collate;
  var CHECKPOINT_VERSION = 1;
  var REPLICATOR = "pouchdb";
  var CHECKPOINT_HISTORY_SIZE = 5;
  var LOWEST_SEQ = 0;
  function updateCheckpoint(db, id, checkpoint, session, returnValue) {
    return db.get(id).catch(function(err) {
      if (err.status === 404) {
        if (db.type() === 'http') {
          explain404('PouchDB is just checking if a remote checkpoint exists.');
        }
        return {
          session_id: session,
          _id: id,
          history: [],
          replicator: REPLICATOR,
          version: CHECKPOINT_VERSION
        };
      }
      throw err;
    }).then(function(doc) {
      if (returnValue.cancelled) {
        return;
      }
      doc.history = (doc.history || []).filter(function(item) {
        return item.session_id !== session;
      });
      doc.history.unshift({
        last_seq: checkpoint,
        session_id: session
      });
      doc.history = doc.history.slice(0, CHECKPOINT_HISTORY_SIZE);
      doc.version = CHECKPOINT_VERSION;
      doc.replicator = REPLICATOR;
      doc.session_id = session;
      doc.last_seq = checkpoint;
      return db.put(doc).catch(function(err) {
        if (err.status === 409) {
          return updateCheckpoint(db, id, checkpoint, session, returnValue);
        }
        throw err;
      });
    });
  }
  function Checkpointer(src, target, id, returnValue) {
    this.src = src;
    this.target = target;
    this.id = id;
    this.returnValue = returnValue;
  }
  Checkpointer.prototype.writeCheckpoint = function(checkpoint, session) {
    var self = this;
    return this.updateTarget(checkpoint, session).then(function() {
      return self.updateSource(checkpoint, session);
    });
  };
  Checkpointer.prototype.updateTarget = function(checkpoint, session) {
    return updateCheckpoint(this.target, this.id, checkpoint, session, this.returnValue);
  };
  Checkpointer.prototype.updateSource = function(checkpoint, session) {
    var self = this;
    if (this.readOnlySource) {
      return Promise.resolve(true);
    }
    return updateCheckpoint(this.src, this.id, checkpoint, session, this.returnValue).catch(function(err) {
      var isForbidden = typeof err.status === 'number' && Math.floor(err.status / 100) === 4;
      if (isForbidden) {
        self.readOnlySource = true;
        return true;
      }
      throw err;
    });
  };
  var comparisons = {
    "undefined": function(targetDoc, sourceDoc) {
      if (collate(targetDoc.last_seq, sourceDoc.last_seq) === 0) {
        return sourceDoc.last_seq;
      }
      return 0;
    },
    "1": function(targetDoc, sourceDoc) {
      return compareReplicationLogs(sourceDoc, targetDoc).last_seq;
    }
  };
  Checkpointer.prototype.getCheckpoint = function() {
    var self = this;
    return self.target.get(self.id).then(function(targetDoc) {
      return self.src.get(self.id).then(function(sourceDoc) {
        if (targetDoc.version !== sourceDoc.version) {
          return LOWEST_SEQ;
        }
        var version;
        if (targetDoc.version) {
          version = targetDoc.version.toString();
        } else {
          version = "undefined";
        }
        if (version in comparisons) {
          return comparisons[version](targetDoc, sourceDoc);
        }
        return LOWEST_SEQ;
      }, function(err) {
        if (err.status === 404 && targetDoc.last_seq) {
          return self.src.put({
            _id: self.id,
            last_seq: LOWEST_SEQ
          }).then(function() {
            return LOWEST_SEQ;
          }, function(err) {
            if (err.status === 401) {
              self.readOnlySource = true;
              return targetDoc.last_seq;
            }
            return LOWEST_SEQ;
          });
        }
        throw err;
      });
    }).catch(function(err) {
      if (err.status !== 404) {
        throw err;
      }
      return LOWEST_SEQ;
    });
  };
  function compareReplicationLogs(srcDoc, tgtDoc) {
    if (srcDoc.session_id === tgtDoc.session_id) {
      return {
        last_seq: srcDoc.last_seq,
        history: srcDoc.history || []
      };
    }
    var sourceHistory = srcDoc.history || [];
    var targetHistory = tgtDoc.history || [];
    return compareReplicationHistory(sourceHistory, targetHistory);
  }
  function compareReplicationHistory(sourceHistory, targetHistory) {
    var S = sourceHistory[0];
    var sourceRest = sourceHistory.slice(1);
    var T = targetHistory[0];
    var targetRest = targetHistory.slice(1);
    if (!S || targetHistory.length === 0) {
      return {
        last_seq: LOWEST_SEQ,
        history: []
      };
    }
    var sourceId = S.session_id;
    if (hasSessionId(sourceId, targetHistory)) {
      return {
        last_seq: S.last_seq,
        history: sourceHistory
      };
    }
    var targetId = T.session_id;
    if (hasSessionId(targetId, sourceRest)) {
      return {
        last_seq: T.last_seq,
        history: targetRest
      };
    }
    return compareReplicationHistory(sourceRest, targetRest);
  }
  function hasSessionId(sessionId, history) {
    var props = history[0];
    var rest = history.slice(1);
    if (!sessionId || history.length === 0) {
      return false;
    }
    if (sessionId === props.session_id) {
      return true;
    }
    return hasSessionId(sessionId, rest);
  }
  module.exports = Checkpointer;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12d", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var STARTING_BACK_OFF = 0;
  function randomNumber(min, max) {
    min = parseInt(min, 10);
    max = parseInt(max, 10);
    if (min !== min) {
      min = 0;
    }
    if (max !== max || max <= min) {
      max = (min || 1) << 1;
    } else {
      max = max + 1;
    }
    var ratio = Math.random();
    var range = max - min;
    return ~~(range * ratio + min);
  }
  function defaultBackOff(min) {
    var max = 0;
    if (!min) {
      max = 2000;
    }
    return randomNumber(min, max);
  }
  function backOff(opts, returnValue, error, callback) {
    if (opts.retry === false) {
      returnValue.emit('error', error);
      returnValue.removeAllListeners();
      return;
    }
    if (typeof opts.back_off_function !== 'function') {
      opts.back_off_function = defaultBackOff;
    }
    returnValue.emit('requestError', error);
    if (returnValue.state === 'active' || returnValue.state === 'pending') {
      returnValue.emit('paused', error);
      returnValue.state = 'stopped';
      returnValue.once('active', function() {
        opts.current_back_off = STARTING_BACK_OFF;
      });
    }
    opts.current_back_off = opts.current_back_off || STARTING_BACK_OFF;
    opts.current_back_off = opts.back_off_function(opts.current_back_off);
    setTimeout(callback, opts.current_back_off);
  }
  module.exports = backOff;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12e", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  (function(factory) {
    if (typeof exports === 'object') {
      module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
      define(factory);
    } else {
      var glob;
      try {
        glob = window;
      } catch (e) {
        glob = self;
      }
      glob.SparkMD5 = factory();
    }
  }(function(undefined) {
    'use strict';
    var add32 = function(a, b) {
      return (a + b) & 0xFFFFFFFF;
    },
        cmn = function(q, a, b, x, s, t) {
          a = add32(add32(a, q), add32(x, t));
          return add32((a << s) | (a >>> (32 - s)), b);
        },
        ff = function(a, b, c, d, x, s, t) {
          return cmn((b & c) | ((~b) & d), a, b, x, s, t);
        },
        gg = function(a, b, c, d, x, s, t) {
          return cmn((b & d) | (c & (~d)), a, b, x, s, t);
        },
        hh = function(a, b, c, d, x, s, t) {
          return cmn(b ^ c ^ d, a, b, x, s, t);
        },
        ii = function(a, b, c, d, x, s, t) {
          return cmn(c ^ (b | (~d)), a, b, x, s, t);
        },
        md5cycle = function(x, k) {
          var a = x[0],
              b = x[1],
              c = x[2],
              d = x[3];
          a = ff(a, b, c, d, k[0], 7, -680876936);
          d = ff(d, a, b, c, k[1], 12, -389564586);
          c = ff(c, d, a, b, k[2], 17, 606105819);
          b = ff(b, c, d, a, k[3], 22, -1044525330);
          a = ff(a, b, c, d, k[4], 7, -176418897);
          d = ff(d, a, b, c, k[5], 12, 1200080426);
          c = ff(c, d, a, b, k[6], 17, -1473231341);
          b = ff(b, c, d, a, k[7], 22, -45705983);
          a = ff(a, b, c, d, k[8], 7, 1770035416);
          d = ff(d, a, b, c, k[9], 12, -1958414417);
          c = ff(c, d, a, b, k[10], 17, -42063);
          b = ff(b, c, d, a, k[11], 22, -1990404162);
          a = ff(a, b, c, d, k[12], 7, 1804603682);
          d = ff(d, a, b, c, k[13], 12, -40341101);
          c = ff(c, d, a, b, k[14], 17, -1502002290);
          b = ff(b, c, d, a, k[15], 22, 1236535329);
          a = gg(a, b, c, d, k[1], 5, -165796510);
          d = gg(d, a, b, c, k[6], 9, -1069501632);
          c = gg(c, d, a, b, k[11], 14, 643717713);
          b = gg(b, c, d, a, k[0], 20, -373897302);
          a = gg(a, b, c, d, k[5], 5, -701558691);
          d = gg(d, a, b, c, k[10], 9, 38016083);
          c = gg(c, d, a, b, k[15], 14, -660478335);
          b = gg(b, c, d, a, k[4], 20, -405537848);
          a = gg(a, b, c, d, k[9], 5, 568446438);
          d = gg(d, a, b, c, k[14], 9, -1019803690);
          c = gg(c, d, a, b, k[3], 14, -187363961);
          b = gg(b, c, d, a, k[8], 20, 1163531501);
          a = gg(a, b, c, d, k[13], 5, -1444681467);
          d = gg(d, a, b, c, k[2], 9, -51403784);
          c = gg(c, d, a, b, k[7], 14, 1735328473);
          b = gg(b, c, d, a, k[12], 20, -1926607734);
          a = hh(a, b, c, d, k[5], 4, -378558);
          d = hh(d, a, b, c, k[8], 11, -2022574463);
          c = hh(c, d, a, b, k[11], 16, 1839030562);
          b = hh(b, c, d, a, k[14], 23, -35309556);
          a = hh(a, b, c, d, k[1], 4, -1530992060);
          d = hh(d, a, b, c, k[4], 11, 1272893353);
          c = hh(c, d, a, b, k[7], 16, -155497632);
          b = hh(b, c, d, a, k[10], 23, -1094730640);
          a = hh(a, b, c, d, k[13], 4, 681279174);
          d = hh(d, a, b, c, k[0], 11, -358537222);
          c = hh(c, d, a, b, k[3], 16, -722521979);
          b = hh(b, c, d, a, k[6], 23, 76029189);
          a = hh(a, b, c, d, k[9], 4, -640364487);
          d = hh(d, a, b, c, k[12], 11, -421815835);
          c = hh(c, d, a, b, k[15], 16, 530742520);
          b = hh(b, c, d, a, k[2], 23, -995338651);
          a = ii(a, b, c, d, k[0], 6, -198630844);
          d = ii(d, a, b, c, k[7], 10, 1126891415);
          c = ii(c, d, a, b, k[14], 15, -1416354905);
          b = ii(b, c, d, a, k[5], 21, -57434055);
          a = ii(a, b, c, d, k[12], 6, 1700485571);
          d = ii(d, a, b, c, k[3], 10, -1894986606);
          c = ii(c, d, a, b, k[10], 15, -1051523);
          b = ii(b, c, d, a, k[1], 21, -2054922799);
          a = ii(a, b, c, d, k[8], 6, 1873313359);
          d = ii(d, a, b, c, k[15], 10, -30611744);
          c = ii(c, d, a, b, k[6], 15, -1560198380);
          b = ii(b, c, d, a, k[13], 21, 1309151649);
          a = ii(a, b, c, d, k[4], 6, -145523070);
          d = ii(d, a, b, c, k[11], 10, -1120210379);
          c = ii(c, d, a, b, k[2], 15, 718787259);
          b = ii(b, c, d, a, k[9], 21, -343485551);
          x[0] = add32(a, x[0]);
          x[1] = add32(b, x[1]);
          x[2] = add32(c, x[2]);
          x[3] = add32(d, x[3]);
        },
        md5blk = function(s) {
          var md5blks = [],
              i;
          for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
          }
          return md5blks;
        },
        md5blk_array = function(a) {
          var md5blks = [],
              i;
          for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = a[i] + (a[i + 1] << 8) + (a[i + 2] << 16) + (a[i + 3] << 24);
          }
          return md5blks;
        },
        md51 = function(s) {
          var n = s.length,
              state = [1732584193, -271733879, -1732584194, 271733878],
              i,
              length,
              tail,
              tmp,
              lo,
              hi;
          for (i = 64; i <= n; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
          }
          s = s.substring(i - 64);
          length = s.length;
          tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
          }
          tail[i >> 2] |= 0x80 << ((i % 4) << 3);
          if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i += 1) {
              tail[i] = 0;
            }
          }
          tmp = n * 8;
          tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
          lo = parseInt(tmp[2], 16);
          hi = parseInt(tmp[1], 16) || 0;
          tail[14] = lo;
          tail[15] = hi;
          md5cycle(state, tail);
          return state;
        },
        md51_array = function(a) {
          var n = a.length,
              state = [1732584193, -271733879, -1732584194, 271733878],
              i,
              length,
              tail,
              tmp,
              lo,
              hi;
          for (i = 64; i <= n; i += 64) {
            md5cycle(state, md5blk_array(a.subarray(i - 64, i)));
          }
          a = (i - 64) < n ? a.subarray(i - 64) : new Uint8Array(0);
          length = a.length;
          tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= a[i] << ((i % 4) << 3);
          }
          tail[i >> 2] |= 0x80 << ((i % 4) << 3);
          if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i += 1) {
              tail[i] = 0;
            }
          }
          tmp = n * 8;
          tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
          lo = parseInt(tmp[2], 16);
          hi = parseInt(tmp[1], 16) || 0;
          tail[14] = lo;
          tail[15] = hi;
          md5cycle(state, tail);
          return state;
        },
        hex_chr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'],
        rhex = function(n) {
          var s = '',
              j;
          for (j = 0; j < 4; j += 1) {
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
          }
          return s;
        },
        hex = function(x) {
          var i;
          for (i = 0; i < x.length; i += 1) {
            x[i] = rhex(x[i]);
          }
          return x.join('');
        },
        md5 = function(s) {
          return hex(md51(s));
        },
        SparkMD5 = function() {
          this.reset();
        };
    if (md5('hello') !== '5d41402abc4b2a76b9719d911017c592') {
      add32 = function(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF),
            msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
      };
    }
    SparkMD5.prototype.append = function(str) {
      if (/[\u0080-\uFFFF]/.test(str)) {
        str = unescape(encodeURIComponent(str));
      }
      this.appendBinary(str);
      return this;
    };
    SparkMD5.prototype.appendBinary = function(contents) {
      this._buff += contents;
      this._length += contents.length;
      var length = this._buff.length,
          i;
      for (i = 64; i <= length; i += 64) {
        md5cycle(this._state, md5blk(this._buff.substring(i - 64, i)));
      }
      this._buff = this._buff.substr(i - 64);
      return this;
    };
    SparkMD5.prototype.end = function(raw) {
      var buff = this._buff,
          length = buff.length,
          i,
          tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          ret;
      for (i = 0; i < length; i += 1) {
        tail[i >> 2] |= buff.charCodeAt(i) << ((i % 4) << 3);
      }
      this._finish(tail, length);
      ret = !!raw ? this._state : hex(this._state);
      this.reset();
      return ret;
    };
    SparkMD5.prototype._finish = function(tail, length) {
      var i = length,
          tmp,
          lo,
          hi;
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) {
        md5cycle(this._state, tail);
        for (i = 0; i < 16; i += 1) {
          tail[i] = 0;
        }
      }
      tmp = this._length * 8;
      tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
      lo = parseInt(tmp[2], 16);
      hi = parseInt(tmp[1], 16) || 0;
      tail[14] = lo;
      tail[15] = hi;
      md5cycle(this._state, tail);
    };
    SparkMD5.prototype.reset = function() {
      this._buff = "";
      this._length = 0;
      this._state = [1732584193, -271733879, -1732584194, 271733878];
      return this;
    };
    SparkMD5.prototype.destroy = function() {
      delete this._state;
      delete this._buff;
      delete this._length;
    };
    SparkMD5.hash = function(str, raw) {
      if (/[\u0080-\uFFFF]/.test(str)) {
        str = unescape(encodeURIComponent(str));
      }
      var hash = md51(str);
      return !!raw ? hash : hex(hash);
    };
    SparkMD5.hashBinary = function(content, raw) {
      var hash = md51(content);
      return !!raw ? hash : hex(hash);
    };
    SparkMD5.ArrayBuffer = function() {
      this.reset();
    };
    SparkMD5.ArrayBuffer.prototype.append = function(arr) {
      var buff = this._concatArrayBuffer(this._buff, arr),
          length = buff.length,
          i;
      this._length += arr.byteLength;
      for (i = 64; i <= length; i += 64) {
        md5cycle(this._state, md5blk_array(buff.subarray(i - 64, i)));
      }
      this._buff = (i - 64) < length ? buff.subarray(i - 64) : new Uint8Array(0);
      return this;
    };
    SparkMD5.ArrayBuffer.prototype.end = function(raw) {
      var buff = this._buff,
          length = buff.length,
          tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          i,
          ret;
      for (i = 0; i < length; i += 1) {
        tail[i >> 2] |= buff[i] << ((i % 4) << 3);
      }
      this._finish(tail, length);
      ret = !!raw ? this._state : hex(this._state);
      this.reset();
      return ret;
    };
    SparkMD5.ArrayBuffer.prototype._finish = SparkMD5.prototype._finish;
    SparkMD5.ArrayBuffer.prototype.reset = function() {
      this._buff = new Uint8Array(0);
      this._length = 0;
      this._state = [1732584193, -271733879, -1732584194, 271733878];
      return this;
    };
    SparkMD5.ArrayBuffer.prototype.destroy = SparkMD5.prototype.destroy;
    SparkMD5.ArrayBuffer.prototype._concatArrayBuffer = function(first, second) {
      var firstLength = first.length,
          result = new Uint8Array(firstLength + second.byteLength);
      result.set(first);
      result.set(new Uint8Array(second), firstLength);
      return result;
    };
    SparkMD5.ArrayBuffer.hash = function(arr, raw) {
      var hash = md51_array(new Uint8Array(arr));
      return !!raw ? hash : hex(hash);
    };
    return SparkMD5;
  }));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12f", ["12e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('12e');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("130", ["113", "103", "12f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var toPromise = req('113');
  var base64 = req('103');
  var Md5 = req('12f');
  var setImmediateShim = global.setImmediate || global.setTimeout;
  var MD5_CHUNK_SIZE = 32768;
  function intToString(int) {
    return String.fromCharCode(int & 0xff) + String.fromCharCode((int >>> 8) & 0xff) + String.fromCharCode((int >>> 16) & 0xff) + String.fromCharCode((int >>> 24) & 0xff);
  }
  function rawToBase64(raw) {
    var res = '';
    for (var i = 0,
        len = raw.length; i < len; i++) {
      res += intToString(raw[i]);
    }
    return base64.btoa(res);
  }
  function appendBuffer(buffer, data, start, end) {
    if (start > 0 || end < data.byteLength) {
      data = new Uint8Array(data, start, Math.min(end, data.byteLength) - start);
    }
    buffer.append(data);
  }
  function appendString(buffer, data, start, end) {
    if (start > 0 || end < data.length) {
      data = data.substring(start, end);
    }
    buffer.appendBinary(data);
  }
  module.exports = toPromise(function(data, callback) {
    var inputIsString = typeof data === 'string';
    var len = inputIsString ? data.length : data.byteLength;
    var chunkSize = Math.min(MD5_CHUNK_SIZE, len);
    var chunks = Math.ceil(len / chunkSize);
    var currentChunk = 0;
    var buffer = inputIsString ? new Md5() : new Md5.ArrayBuffer();
    var append = inputIsString ? appendString : appendBuffer;
    function loadNextChunk() {
      var start = currentChunk * chunkSize;
      var end = start + chunkSize;
      currentChunk++;
      if (currentChunk < chunks) {
        append(buffer, data, start, end);
        setImmediateShim(loadNextChunk);
      } else {
        append(buffer, data, start, end);
        var raw = buffer.end(true);
        var base64 = rawToBase64(raw);
        callback(null, base64);
        buffer.destroy();
      }
    }
    loadNextChunk();
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("131", ["101", "130", "12b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var Promise = req('101');
  var md5 = req('130');
  var collate = req('12b').collate;
  function sortObjectPropertiesByKey(queryParams) {
    return Object.keys(queryParams).sort(collate).reduce(function(result, key) {
      result[key] = queryParams[key];
      return result;
    }, {});
  }
  function generateReplicationId(src, target, opts) {
    var docIds = opts.doc_ids ? opts.doc_ids.sort(collate) : '';
    var filterFun = opts.filter ? opts.filter.toString() : '';
    var queryParams = '';
    var filterViewName = '';
    if (opts.filter && opts.query_params) {
      queryParams = JSON.stringify(sortObjectPropertiesByKey(opts.query_params));
    }
    if (opts.filter && opts.filter === '_view') {
      filterViewName = opts.view.toString();
    }
    return Promise.all([src.id(), target.id()]).then(function(res) {
      var queryData = res[0] + res[1] + filterFun + filterViewName + queryParams + docIds;
      return md5(queryData);
    }).then(function(md5sum) {
      md5sum = md5sum.replace(/\//g, '.').replace(/\+/g, '_');
      return '_local/' + md5sum;
    });
  }
  module.exports = generateReplicationId;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("132", ["ee"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var utils = req('ee');
  var clone = utils.clone;
  var Promise = utils.Promise;
  function isGenOne(rev) {
    return /^1-/.test(rev);
  }
  function createBulkGetOpts(diffs) {
    var requests = [];
    Object.keys(diffs).forEach(function(id) {
      var missingRevs = diffs[id].missing;
      missingRevs.forEach(function(missingRev) {
        requests.push({
          id: id,
          rev: missingRev
        });
      });
    });
    return {
      docs: requests,
      revs: true,
      attachments: true,
      binary: true
    };
  }
  function getDocs(src, diffs, state) {
    diffs = clone(diffs);
    var resultDocs = [];
    function getAllDocs() {
      var bulkGetOpts = createBulkGetOpts(diffs);
      return src.bulkGet(bulkGetOpts).then(function(bulkGetResponse) {
        if (state.cancelled) {
          throw new Error('cancelled');
        }
        bulkGetResponse.results.forEach(function(bulkGetInfo) {
          bulkGetInfo.docs.forEach(function(doc) {
            if (doc.ok) {
              resultDocs.push(doc.ok);
            }
          });
        });
      });
    }
    function hasAttachments(doc) {
      return doc._attachments && Object.keys(doc._attachments).length > 0;
    }
    function fetchRevisionOneDocs(ids) {
      return src.allDocs({
        keys: ids,
        include_docs: true
      }).then(function(res) {
        if (state.cancelled) {
          throw new Error('cancelled');
        }
        res.rows.forEach(function(row) {
          if (row.deleted || !row.doc || !isGenOne(row.value.rev) || hasAttachments(row.doc)) {
            return;
          }
          resultDocs.push(row.doc);
          delete diffs[row.id];
        });
      });
    }
    function getRevisionOneDocs() {
      var ids = Object.keys(diffs).filter(function(id) {
        var missing = diffs[id].missing;
        return missing.length === 1 && isGenOne(missing[0]);
      });
      if (ids.length > 0) {
        return fetchRevisionOneDocs(ids);
      }
    }
    function returnDocs() {
      return resultDocs;
    }
    return Promise.resolve().then(getRevisionOneDocs).then(getAllDocs).then(returnDocs);
  }
  module.exports = getDocs;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("133", ["ee", "12c", "12d", "131", "132", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var utils = req('ee');
    var Checkpointer = req('12c');
    var backOff = req('12d');
    var generateReplicationId = req('131');
    var getDocs = req('132');
    function replicate(src, target, opts, returnValue, result) {
      var batches = [];
      var currentBatch;
      var pendingBatch = {
        seq: 0,
        changes: [],
        docs: []
      };
      var writingCheckpoint = false;
      var changesCompleted = false;
      var replicationCompleted = false;
      var last_seq = 0;
      var continuous = opts.continuous || opts.live || false;
      var batch_size = opts.batch_size || 100;
      var batches_limit = opts.batches_limit || 10;
      var changesPending = false;
      var doc_ids = opts.doc_ids;
      var repId;
      var checkpointer;
      var allErrors = [];
      var changedDocs = [];
      var session = utils.uuid();
      result = result || {
        ok: true,
        start_time: new Date(),
        docs_read: 0,
        docs_written: 0,
        doc_write_failures: 0,
        errors: []
      };
      var changesOpts = {};
      returnValue.ready(src, target);
      function initCheckpointer() {
        if (checkpointer) {
          return utils.Promise.resolve();
        }
        return generateReplicationId(src, target, opts).then(function(res) {
          repId = res;
          checkpointer = new Checkpointer(src, target, repId, returnValue);
        });
      }
      function writeDocs() {
        if (currentBatch.docs.length === 0) {
          return;
        }
        var docs = currentBatch.docs;
        return target.bulkDocs({
          docs: docs,
          new_edits: false
        }).then(function(res) {
          if (returnValue.cancelled) {
            completeReplication();
            throw new Error('cancelled');
          }
          var errors = [];
          var errorsById = {};
          res.forEach(function(res) {
            if (res.error) {
              result.doc_write_failures++;
              errors.push(res);
              errorsById[res.id] = res;
            }
          });
          allErrors = allErrors.concat(errors);
          result.docs_written += currentBatch.docs.length - errors.length;
          var non403s = errors.filter(function(error) {
            return error.name !== 'unauthorized' && error.name !== 'forbidden';
          });
          changedDocs = [];
          docs.forEach(function(doc) {
            var error = errorsById[doc._id];
            if (error) {
              returnValue.emit('denied', utils.clone(error));
            } else {
              changedDocs.push(doc);
            }
          });
          if (non403s.length > 0) {
            var error = new Error('bulkDocs error');
            error.other_errors = errors;
            abortReplication('target.bulkDocs failed to write docs', error);
            throw new Error('bulkWrite partial failure');
          }
        }, function(err) {
          result.doc_write_failures += docs.length;
          throw err;
        });
      }
      function finishBatch() {
        result.last_seq = last_seq = currentBatch.seq;
        var outResult = utils.clone(result);
        if (changedDocs.length) {
          outResult.docs = changedDocs;
          returnValue.emit('change', outResult);
        }
        writingCheckpoint = true;
        return checkpointer.writeCheckpoint(currentBatch.seq, session).then(function() {
          writingCheckpoint = false;
          if (returnValue.cancelled) {
            completeReplication();
            throw new Error('cancelled');
          }
          currentBatch = undefined;
          getChanges();
        }).catch(function(err) {
          writingCheckpoint = false;
          abortReplication('writeCheckpoint completed with error', err);
          throw err;
        });
      }
      function getDiffs() {
        var diff = {};
        currentBatch.changes.forEach(function(change) {
          if (change.id === "_user/") {
            return;
          }
          diff[change.id] = change.changes.map(function(x) {
            return x.rev;
          });
        });
        return target.revsDiff(diff).then(function(diffs) {
          if (returnValue.cancelled) {
            completeReplication();
            throw new Error('cancelled');
          }
          currentBatch.diffs = diffs;
        });
      }
      function getBatchDocs() {
        return getDocs(src, currentBatch.diffs, returnValue).then(function(docs) {
          docs.forEach(function(doc) {
            delete currentBatch.diffs[doc._id];
            result.docs_read++;
            currentBatch.docs.push(doc);
          });
        });
      }
      function startNextBatch() {
        if (returnValue.cancelled || currentBatch) {
          return;
        }
        if (batches.length === 0) {
          processPendingBatch(true);
          return;
        }
        currentBatch = batches.shift();
        getDiffs().then(getBatchDocs).then(writeDocs).then(finishBatch).then(startNextBatch).catch(function(err) {
          abortReplication('batch processing terminated with error', err);
        });
      }
      function processPendingBatch(immediate) {
        if (pendingBatch.changes.length === 0) {
          if (batches.length === 0 && !currentBatch) {
            if ((continuous && changesOpts.live) || changesCompleted) {
              returnValue.state = 'pending';
              returnValue.emit('paused');
            }
            if (changesCompleted) {
              completeReplication();
            }
          }
          return;
        }
        if (immediate || changesCompleted || pendingBatch.changes.length >= batch_size) {
          batches.push(pendingBatch);
          pendingBatch = {
            seq: 0,
            changes: [],
            docs: []
          };
          if (returnValue.state === 'pending' || returnValue.state === 'stopped') {
            returnValue.state = 'active';
            returnValue.emit('active');
          }
          startNextBatch();
        }
      }
      function abortReplication(reason, err) {
        if (replicationCompleted) {
          return;
        }
        if (!err.message) {
          err.message = reason;
        }
        result.ok = false;
        result.status = 'aborting';
        result.errors.push(err);
        allErrors = allErrors.concat(err);
        batches = [];
        pendingBatch = {
          seq: 0,
          changes: [],
          docs: []
        };
        completeReplication();
      }
      function completeReplication() {
        if (replicationCompleted) {
          return;
        }
        if (returnValue.cancelled) {
          result.status = 'cancelled';
          if (writingCheckpoint) {
            return;
          }
        }
        result.status = result.status || 'complete';
        result.end_time = new Date();
        result.last_seq = last_seq;
        replicationCompleted = true;
        var non403s = allErrors.filter(function(error) {
          return error.name !== 'unauthorized' && error.name !== 'forbidden';
        });
        if (non403s.length > 0) {
          var error = allErrors.pop();
          if (allErrors.length > 0) {
            error.other_errors = allErrors;
          }
          error.result = result;
          backOff(opts, returnValue, error, function() {
            replicate(src, target, opts, returnValue);
          });
        } else {
          result.errors = allErrors;
          returnValue.emit('complete', result);
          returnValue.removeAllListeners();
        }
      }
      function onChange(change) {
        if (returnValue.cancelled) {
          return completeReplication();
        }
        var filter = utils.filterChange(opts)(change);
        if (!filter) {
          return;
        }
        pendingBatch.seq = change.seq;
        pendingBatch.changes.push(change);
        processPendingBatch(batches.length === 0);
      }
      function onChangesComplete(changes) {
        changesPending = false;
        if (returnValue.cancelled) {
          return completeReplication();
        }
        if (changes.results.length > 0) {
          changesOpts.since = changes.last_seq;
          getChanges();
        } else {
          if (continuous) {
            changesOpts.live = true;
            getChanges();
          } else {
            changesCompleted = true;
          }
        }
        processPendingBatch(true);
      }
      function onChangesError(err) {
        changesPending = false;
        if (returnValue.cancelled) {
          return completeReplication();
        }
        abortReplication('changes rejected', err);
      }
      function getChanges() {
        if (!(!changesPending && !changesCompleted && batches.length < batches_limit)) {
          return;
        }
        changesPending = true;
        function abortChanges() {
          changes.cancel();
        }
        function removeListener() {
          returnValue.removeListener('cancel', abortChanges);
        }
        if (returnValue._changes) {
          returnValue.removeListener('cancel', returnValue._abortChanges);
          returnValue._changes.cancel();
        }
        returnValue.once('cancel', abortChanges);
        var changes = src.changes(changesOpts).on('change', onChange);
        changes.then(removeListener, removeListener);
        changes.then(onChangesComplete).catch(onChangesError);
        if (opts.retry) {
          returnValue._changes = changes;
          returnValue._abortChanges = abortChanges;
        }
      }
      function startChanges() {
        initCheckpointer().then(function() {
          if (returnValue.cancelled) {
            completeReplication();
            return;
          }
          return checkpointer.getCheckpoint().then(function(checkpoint) {
            last_seq = checkpoint;
            changesOpts = {
              since: last_seq,
              limit: batch_size,
              batch_size: batch_size,
              style: 'all_docs',
              doc_ids: doc_ids,
              returnDocs: true
            };
            if (opts.filter) {
              if (typeof opts.filter !== 'string') {
                changesOpts.include_docs = true;
              } else {
                changesOpts.filter = opts.filter;
              }
            }
            if (opts.heartbeat) {
              changesOpts.heartbeat = opts.heartbeat;
            }
            if (opts.query_params) {
              changesOpts.query_params = opts.query_params;
            }
            if (opts.view) {
              changesOpts.view = opts.view;
            }
            getChanges();
          });
        }).catch(function(err) {
          abortReplication('getCheckpoint rejected with ', err);
        });
      }
      if (returnValue.cancelled) {
        completeReplication();
        return;
      }
      if (!returnValue._addedListeners) {
        returnValue.once('cancel', completeReplication);
        if (typeof opts.complete === 'function') {
          returnValue.once('error', opts.complete);
          returnValue.once('complete', function(result) {
            opts.complete(null, result);
          });
        }
        returnValue._addedListeners = true;
      }
      if (typeof opts.since === 'undefined') {
        startChanges();
      } else {
        initCheckpointer().then(function() {
          writingCheckpoint = true;
          return checkpointer.writeCheckpoint(opts.since, session);
        }).then(function() {
          writingCheckpoint = false;
          if (returnValue.cancelled) {
            completeReplication();
            return;
          }
          last_seq = opts.since;
          startChanges();
        }).catch(function(err) {
          writingCheckpoint = false;
          abortReplication('writeCheckpoint completed with error', err);
          throw err;
        });
      }
    }
    module.exports = replicate;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("134", ["ee", "10e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var utils = req('ee');
  var EE = req('10e').EventEmitter;
  var Promise = utils.Promise;
  utils.inherits(Replication, EE);
  function Replication() {
    EE.call(this);
    this.cancelled = false;
    this.state = 'pending';
    var self = this;
    var promise = new Promise(function(fulfill, reject) {
      self.once('complete', fulfill);
      self.once('error', reject);
    });
    self.then = function(resolve, reject) {
      return promise.then(resolve, reject);
    };
    self.catch = function(reject) {
      return promise.catch(reject);
    };
    self.catch(function() {});
  }
  Replication.prototype.cancel = function() {
    this.cancelled = true;
    this.state = 'cancelled';
    this.emit('cancel');
  };
  Replication.prototype.ready = function(src, target) {
    var self = this;
    if (self._readyCalled) {
      return;
    }
    self._readyCalled = true;
    function onDestroy() {
      self.cancel();
    }
    src.once('destroyed', onDestroy);
    target.once('destroyed', onDestroy);
    function cleanup() {
      src.removeListener('destroyed', onDestroy);
      target.removeListener('destroyed', onDestroy);
    }
    self.once('complete', cleanup);
  };
  module.exports = Replication;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("135", ["ee", "133", "134", "f1"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var utils = req('ee');
  var replicate = req('133');
  var Replication = req('134');
  var errors = req('f1');
  function toPouch(db, opts) {
    var PouchConstructor = opts.PouchConstructor;
    if (typeof db === 'string') {
      return new PouchConstructor(db, opts);
    } else {
      return db;
    }
  }
  function replicateWrapper(src, target, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (typeof opts === 'undefined') {
      opts = {};
    }
    if (opts.doc_ids && !Array.isArray(opts.doc_ids)) {
      throw errors.error(errors.BAD_REQUEST, "`doc_ids` filter parameter is not a list.");
    }
    opts.complete = callback;
    opts = utils.clone(opts);
    opts.continuous = opts.continuous || opts.live;
    opts.retry = ('retry' in opts) ? opts.retry : false;
    opts.PouchConstructor = opts.PouchConstructor || this;
    var replicateRet = new Replication(opts);
    var srcPouch = toPouch(src, opts);
    var targetPouch = toPouch(target, opts);
    replicate(srcPouch, targetPouch, opts, replicateRet);
    return replicateRet;
  }
  module.exports = {
    replicate: replicateWrapper,
    toPouch: toPouch
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("136", ["ee", "135", "10e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var utils = req('ee');
  var replication = req('135');
  var replicate = replication.replicate;
  var EE = req('10e').EventEmitter;
  utils.inherits(Sync, EE);
  module.exports = sync;
  function sync(src, target, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (typeof opts === 'undefined') {
      opts = {};
    }
    opts = utils.clone(opts);
    opts.PouchConstructor = opts.PouchConstructor || this;
    src = replication.toPouch(src, opts);
    target = replication.toPouch(target, opts);
    return new Sync(src, target, opts, callback);
  }
  function Sync(src, target, opts, callback) {
    var self = this;
    this.canceled = false;
    var optsPush = opts.push ? utils.extend({}, opts, opts.push) : opts;
    var optsPull = opts.pull ? utils.extend({}, opts, opts.pull) : opts;
    this.push = replicate(src, target, optsPush);
    this.pull = replicate(target, src, optsPull);
    this.pushPaused = true;
    this.pullPaused = true;
    function pullChange(change) {
      self.emit('change', {
        direction: 'pull',
        change: change
      });
    }
    function pushChange(change) {
      self.emit('change', {
        direction: 'push',
        change: change
      });
    }
    function pushDenied(doc) {
      self.emit('denied', {
        direction: 'push',
        doc: doc
      });
    }
    function pullDenied(doc) {
      self.emit('denied', {
        direction: 'pull',
        doc: doc
      });
    }
    function pushPaused() {
      self.pushPaused = true;
      if (self.pullPaused) {
        self.emit('paused');
      }
    }
    function pullPaused() {
      self.pullPaused = true;
      if (self.pushPaused) {
        self.emit('paused');
      }
    }
    function pushActive() {
      self.pushPaused = false;
      if (self.pullPaused) {
        self.emit('active', {direction: 'push'});
      }
    }
    function pullActive() {
      self.pullPaused = false;
      if (self.pushPaused) {
        self.emit('active', {direction: 'pull'});
      }
    }
    var removed = {};
    function removeAll(type) {
      return function(event, func) {
        var isChange = event === 'change' && (func === pullChange || func === pushChange);
        var isDenied = event === 'denied' && (func === pullDenied || func === pushDenied);
        var isPaused = event === 'paused' && (func === pullPaused || func === pushPaused);
        var isActive = event === 'active' && (func === pullActive || func === pushActive);
        if (isChange || isDenied || isPaused || isActive) {
          if (!(event in removed)) {
            removed[event] = {};
          }
          removed[event][type] = true;
          if (Object.keys(removed[event]).length === 2) {
            self.removeAllListeners(event);
          }
        }
      };
    }
    if (opts.live) {
      this.push.on('complete', self.pull.cancel.bind(self.pull));
      this.pull.on('complete', self.push.cancel.bind(self.push));
    }
    this.on('newListener', function(event) {
      if (event === 'change') {
        self.pull.on('change', pullChange);
        self.push.on('change', pushChange);
      } else if (event === 'denied') {
        self.pull.on('denied', pullDenied);
        self.push.on('denied', pushDenied);
      } else if (event === 'active') {
        self.pull.on('active', pullActive);
        self.push.on('active', pushActive);
      } else if (event === 'paused') {
        self.pull.on('paused', pullPaused);
        self.push.on('paused', pushPaused);
      }
    });
    this.on('removeListener', function(event) {
      if (event === 'change') {
        self.pull.removeListener('change', pullChange);
        self.push.removeListener('change', pushChange);
      } else if (event === 'denied') {
        self.pull.removeListener('denied', pullDenied);
        self.push.removeListener('denied', pushDenied);
      } else if (event === 'active') {
        self.pull.removeListener('active', pullActive);
        self.push.removeListener('active', pushActive);
      } else if (event === 'paused') {
        self.pull.removeListener('paused', pullPaused);
        self.push.removeListener('paused', pushPaused);
      }
    });
    this.pull.on('removeListener', removeAll('pull'));
    this.push.on('removeListener', removeAll('push'));
    var promise = utils.Promise.all([this.push, this.pull]).then(function(resp) {
      var out = {
        push: resp[0],
        pull: resp[1]
      };
      self.emit('complete', out);
      if (callback) {
        callback(null, out);
      }
      self.removeAllListeners();
      return out;
    }, function(err) {
      self.cancel();
      if (callback) {
        callback(err);
      } else {
        self.emit('error', err);
      }
      self.removeAllListeners();
      if (callback) {
        throw err;
      }
    });
    this.then = function(success, err) {
      return promise.then(success, err);
    };
    this.catch = function(err) {
      return promise.catch(err);
    };
  }
  Sync.prototype.cancel = function() {
    if (!this.canceled) {
      this.canceled = true;
      this.push.cancel();
      this.pull.cancel();
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("137", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = "5.0.0";
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("138", ["103", "105"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var atob = req('103').atob;
  var binaryStringToBlobOrBuffer = req('105');
  module.exports = function(b64, type) {
    return binaryStringToBlobOrBuffer(atob(b64), type);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("139", ["eb"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var createBlob = req('eb');
  module.exports = function createBlobOrBufferFromParts(parts, type) {
    return createBlob(parts, {type: type});
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("13a", ["104"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var binaryStringToArrayBuffer = req('104');
  module.exports = function createMultipartPart(data) {
    return binaryStringToArrayBuffer(data);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("13b", ["103", "f7", "ee", "139", "13a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var base64 = req('103');
  var atob = base64.atob;
  var uuid = req('f7');
  var utils = req('ee');
  var clone = utils.clone;
  var createBlufferFromParts = req('139');
  var createMultipartPart = req('13a');
  function createMultipart(doc) {
    doc = clone(doc);
    var boundary = uuid();
    var nonStubAttachments = {};
    Object.keys(doc._attachments).forEach(function(filename) {
      var att = doc._attachments[filename];
      if (att.stub) {
        return;
      }
      var binData = atob(att.data);
      nonStubAttachments[filename] = {
        type: att.content_type,
        data: binData
      };
      att.length = binData.length;
      att.follows = true;
      delete att.digest;
      delete att.data;
    });
    var preamble = '--' + boundary + '\r\nContent-Type: application/json\r\n\r\n';
    var parts = [preamble, JSON.stringify(doc)];
    Object.keys(nonStubAttachments).forEach(function(filename) {
      var att = nonStubAttachments[filename];
      var preamble = '\r\n--' + boundary + '\r\nContent-Disposition: attachment; filename=' + JSON.stringify(filename) + '\r\nContent-Type: ' + att.type + '\r\nContent-Length: ' + att.data.length + '\r\n\r\n';
      parts.push(preamble);
      parts.push(createMultipartPart(att.data));
    });
    parts.push('\r\n--' + boundary + '--');
    var type = 'multipart/related; boundary=' + boundary;
    var body = createBlufferFromParts(parts, type);
    return {
      headers: {'Content-Type': type},
      body: body
    };
  }
  module.exports = createMultipart;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("13c", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var length = bytes.byteLength;
    for (var i = 0; i < length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return binary;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("13d", ["13c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var arrayBufferToBinaryString = req('13c');
  module.exports = function(blob, callback) {
    if (typeof FileReader === 'undefined') {
      return callback(arrayBufferToBinaryString(new FileReaderSync().readAsArrayBuffer(blob)));
    }
    var reader = new FileReader();
    var hasBinaryString = typeof reader.readAsBinaryString === 'function';
    reader.onloadend = function(e) {
      var result = e.target.result || '';
      if (hasBinaryString) {
        return callback(result);
      }
      callback(arrayBufferToBinaryString(result));
    };
    if (hasBinaryString) {
      reader.readAsBinaryString(blob);
    } else {
      reader.readAsArrayBuffer(blob);
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("13e", ["101", "13d", "103"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var Promise = req('101');
  var readAsBinaryString = req('13d');
  var btoa = req('103').btoa;
  module.exports = function blobToBase64(blobOrBuffer) {
    return new Promise(function(resolve) {
      readAsBinaryString(blobOrBuffer, function(bin) {
        resolve(btoa(bin));
      });
    });
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("13f", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function flatten(arrays) {
    var res = [];
    arrays.forEach(function(array) {
      if (Array.isArray(array)) {
        res = res.concat(array);
      } else {
        res.push(array);
      }
    });
    return res;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("140", ["105", "138", "ee", "103", "f1", "e9", "13b", "13e", "fc", "122", "13f", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    "use strict";
    var CHANGES_BATCH_SIZE = 25;
    var MAX_SIMULTANEOUS_REVS = 50;
    var supportsBulkGetMap = {};
    var MAX_URL_LENGTH = 1800;
    var binStringToBluffer = req('105');
    var b64StringToBluffer = req('138');
    var utils = req('ee');
    var Promise = utils.Promise;
    var clone = utils.clone;
    var base64 = req('103');
    var btoa = base64.btoa;
    var atob = base64.atob;
    var errors = req('f1');
    var log = req('e9')('pouchdb:http');
    var createMultipart = req('13b');
    var blufferToBase64 = req('13e');
    var parseDoc = req('fc');
    var bulkGetShim = req('122');
    var flatten = req('13f');
    function readAttachmentsAsBlobOrBuffer(row) {
      var atts = row.doc && row.doc._attachments;
      if (!atts) {
        return;
      }
      Object.keys(atts).forEach(function(filename) {
        var att = atts[filename];
        att.data = b64StringToBluffer(att.data, att.content_type);
      });
    }
    function encodeDocId(id) {
      if (/^_design/.test(id)) {
        return '_design/' + encodeURIComponent(id.slice(8));
      }
      if (/^_local/.test(id)) {
        return '_local/' + encodeURIComponent(id.slice(7));
      }
      return encodeURIComponent(id);
    }
    function preprocessAttachments(doc) {
      if (!doc._attachments || !Object.keys(doc._attachments)) {
        return Promise.resolve();
      }
      return Promise.all(Object.keys(doc._attachments).map(function(key) {
        var attachment = doc._attachments[key];
        if (attachment.data && typeof attachment.data !== 'string') {
          return blufferToBase64(attachment.data).then(function(b64) {
            attachment.data = b64;
          });
        }
      }));
    }
    function getHost(name) {
      var uri = utils.parseUri(name);
      if (uri.user || uri.password) {
        uri.auth = {
          username: uri.user,
          password: uri.password
        };
      }
      var parts = uri.path.replace(/(^\/|\/$)/g, '').split('/');
      uri.db = parts.pop();
      uri.path = parts.join('/');
      return uri;
    }
    function genDBUrl(opts, path) {
      return genUrl(opts, opts.db + '/' + path);
    }
    function genUrl(opts, path) {
      var pathDel = !opts.path ? '' : '/';
      return opts.protocol + '://' + opts.host + ':' + opts.port + '/' + opts.path + pathDel + path;
    }
    function HttpPouch(opts, callback) {
      var api = this;
      var getHostFun = getHost;
      if (opts.getHost) {
        getHostFun = opts.getHost;
      }
      var host = getHostFun(opts.name, opts);
      var dbUrl = genDBUrl(host, '');
      opts = clone(opts);
      var ajaxOpts = opts.ajax || {};
      api.getUrl = function() {
        return dbUrl;
      };
      api.getHeaders = function() {
        return ajaxOpts.headers || {};
      };
      if (opts.auth || host.auth) {
        var nAuth = opts.auth || host.auth;
        var token = btoa(nAuth.username + ':' + nAuth.password);
        ajaxOpts.headers = ajaxOpts.headers || {};
        ajaxOpts.headers.Authorization = 'Basic ' + token;
      }
      function ajax(userOpts, options, callback) {
        var reqAjax = userOpts.ajax || {};
        var reqOpts = utils.extend(clone(ajaxOpts), reqAjax, options);
        log(reqOpts.method + ' ' + reqOpts.url);
        return utils.ajax(reqOpts, callback);
      }
      function ajaxPromise(userOpts, opts) {
        return new Promise(function(resolve, reject) {
          ajax(userOpts, opts, function(err, res) {
            if (err) {
              return reject(err);
            }
            resolve(res);
          });
        });
      }
      function adapterFun(name, fun) {
        return utils.adapterFun(name, utils.getArguments(function(args) {
          setup().then(function(res) {
            return fun.apply(this, args);
          }).catch(function(e) {
            var callback = args.pop();
            callback(e);
          });
        }));
      }
      var setupPromise;
      function setup() {
        if (opts.skipSetup || opts.skip_setup) {
          return Promise.resolve();
        }
        if (setupPromise) {
          return setupPromise;
        }
        var checkExists = {
          method: 'GET',
          url: dbUrl
        };
        var create = {
          method: 'PUT',
          url: dbUrl
        };
        setupPromise = ajaxPromise({}, checkExists).catch(function(err) {
          if (err && err.status && err.status === 404) {
            utils.explain404('PouchDB is just detecting if the remote exists.');
            return ajaxPromise({}, create);
          } else {
            return Promise.reject(err);
          }
        }).catch(function(err) {
          if (err && err.status && err.status === 401) {
            return ajaxPromise({}, checkExists);
          }
          if (err && err.status && err.status === 412) {
            return true;
          }
          return Promise.reject(err);
        });
        setupPromise.catch(function() {
          setupPromise = null;
        });
        return setupPromise;
      }
      setTimeout(function() {
        callback(null, api);
      });
      api.type = function() {
        return 'http';
      };
      api.id = adapterFun('id', function(callback) {
        ajax({}, {
          method: 'GET',
          url: genUrl(host, '')
        }, function(err, result) {
          var uuid = (result && result.uuid) ? (result.uuid + host.db) : genDBUrl(host, '');
          callback(null, uuid);
        });
      });
      api.request = adapterFun('request', function(options, callback) {
        options.url = genDBUrl(host, options.url);
        ajax({}, options, callback);
      });
      api.compact = adapterFun('compact', function(opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        opts = clone(opts);
        ajax(opts, {
          url: genDBUrl(host, '_compact'),
          method: 'POST'
        }, function() {
          function ping() {
            api.info(function(err, res) {
              if (!res.compact_running) {
                callback(null, {ok: true});
              } else {
                setTimeout(ping, opts.interval || 200);
              }
            });
          }
          ping();
        });
      });
      api.bulkGet = utils.adapterFun('bulkGet', function(opts, callback) {
        var self = this;
        function doBulkGet(cb) {
          var params = [];
          if (opts.revs) {
            params.push('revs=true');
          }
          if (opts.attachments) {
            params.push('attachments=true');
          }
          params = params.join('&');
          if (params !== '') {
            params = '?' + params;
          }
          ajax({}, {
            headers: host.headers,
            url: genDBUrl(host, '_bulk_get' + params),
            method: 'POST',
            body: {docs: opts.docs}
          }, cb);
        }
        function doBulkGetShim() {
          if (!opts.docs.length) {
            return callback(null, {results: []});
          }
          var batchSize = MAX_SIMULTANEOUS_REVS;
          var numBatches = Math.ceil(opts.docs.length / batchSize);
          var numDone = 0;
          var results = new Array(numBatches);
          function onResult(batchNum) {
            return function(err, res) {
              results[batchNum] = res.results;
              if (++numDone === numBatches) {
                callback(null, {results: flatten(results)});
              }
            };
          }
          for (var i = 0; i < numBatches; i++) {
            var subOpts = utils.pick(opts, ['revs', 'attachments']);
            subOpts.docs = opts.docs.slice(i * batchSize, Math.min(opts.docs.length, (i + 1) * batchSize));
            bulkGetShim(self, subOpts, onResult(i));
          }
        }
        var dbUrl = genUrl(host, '');
        var supportsBulkGet = supportsBulkGetMap[dbUrl];
        if (typeof supportsBulkGet !== 'boolean') {
          doBulkGet(function(err, res) {
            if (err) {
              if (Math.floor(err.status / 100) === 4) {
                supportsBulkGetMap[dbUrl] = false;
                doBulkGetShim();
              } else {
                callback(err);
              }
            } else {
              supportsBulkGetMap[dbUrl] = true;
              callback(null, res);
            }
          });
        } else if (supportsBulkGet) {
          doBulkGet(callback);
        } else {
          doBulkGetShim();
        }
      });
      api._info = function(callback) {
        setup().then(function() {
          ajax({}, {
            method: 'GET',
            url: genDBUrl(host, '')
          }, function(err, res) {
            if (err) {
              return callback(err);
            }
            res.host = genDBUrl(host, '');
            callback(null, res);
          });
        }).catch(callback);
      };
      api.get = adapterFun('get', function(id, opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        opts = clone(opts);
        var params = [];
        if (opts.revs) {
          params.push('revs=true');
        }
        if (opts.revs_info) {
          params.push('revs_info=true');
        }
        if (opts.open_revs) {
          if (opts.open_revs !== "all") {
            opts.open_revs = JSON.stringify(opts.open_revs);
          }
          params.push('open_revs=' + opts.open_revs);
        }
        if (opts.rev) {
          params.push('rev=' + opts.rev);
        }
        if (opts.conflicts) {
          params.push('conflicts=' + opts.conflicts);
        }
        params = params.join('&');
        params = params === '' ? '' : '?' + params;
        id = encodeDocId(id);
        var options = {
          method: 'GET',
          url: genDBUrl(host, id + params)
        };
        function fetchAttachments(doc) {
          var atts = doc._attachments;
          var filenames = atts && Object.keys(atts);
          if (!atts || !filenames.length) {
            return;
          }
          return Promise.all(filenames.map(function(filename) {
            var att = atts[filename];
            var path = encodeDocId(doc._id) + '/' + encodeAttachmentId(filename) + '?rev=' + doc._rev;
            return ajaxPromise(opts, {
              method: 'GET',
              url: genDBUrl(host, path),
              binary: true
            }).then(function(blob) {
              if (opts.binary) {
                return blob;
              }
              return blufferToBase64(blob);
            }).then(function(data) {
              delete att.stub;
              delete att.length;
              att.data = data;
            });
          }));
        }
        function fetchAllAttachments(docOrDocs) {
          if (Array.isArray(docOrDocs)) {
            return Promise.all(docOrDocs.map(function(doc) {
              if (doc.ok) {
                return fetchAttachments(doc.ok);
              }
            }));
          }
          return fetchAttachments(docOrDocs);
        }
        ajaxPromise(opts, options).then(function(res) {
          return Promise.resolve().then(function() {
            if (opts.attachments) {
              return fetchAllAttachments(res);
            }
          }).then(function() {
            callback(null, res);
          });
        }).catch(callback);
      });
      api.remove = adapterFun('remove', function(docOrId, optsOrRev, opts, callback) {
        var doc;
        if (typeof optsOrRev === 'string') {
          doc = {
            _id: docOrId,
            _rev: optsOrRev
          };
          if (typeof opts === 'function') {
            callback = opts;
            opts = {};
          }
        } else {
          doc = docOrId;
          if (typeof optsOrRev === 'function') {
            callback = optsOrRev;
            opts = {};
          } else {
            callback = opts;
            opts = optsOrRev;
          }
        }
        var rev = (doc._rev || opts.rev);
        ajax(opts, {
          method: 'DELETE',
          url: genDBUrl(host, encodeDocId(doc._id)) + '?rev=' + rev
        }, callback);
      });
      function encodeAttachmentId(attachmentId) {
        return attachmentId.split("/").map(encodeURIComponent).join("/");
      }
      api.getAttachment = adapterFun('getAttachment', function(docId, attachmentId, opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        var params = opts.rev ? ('?rev=' + opts.rev) : '';
        var url = genDBUrl(host, encodeDocId(docId)) + '/' + encodeAttachmentId(attachmentId) + params;
        ajax(opts, {
          method: 'GET',
          url: url,
          binary: true
        }, callback);
      });
      api.removeAttachment = adapterFun('removeAttachment', function(docId, attachmentId, rev, callback) {
        var url = genDBUrl(host, encodeDocId(docId) + '/' + encodeAttachmentId(attachmentId)) + '?rev=' + rev;
        ajax({}, {
          method: 'DELETE',
          url: url
        }, callback);
      });
      api.putAttachment = adapterFun('putAttachment', function(docId, attachmentId, rev, blob, type, callback) {
        if (typeof type === 'function') {
          callback = type;
          type = blob;
          blob = rev;
          rev = null;
        }
        var id = encodeDocId(docId) + '/' + encodeAttachmentId(attachmentId);
        var url = genDBUrl(host, id);
        if (rev) {
          url += '?rev=' + rev;
        }
        if (typeof blob === 'string') {
          var binary;
          try {
            binary = atob(blob);
          } catch (err) {
            return callback(errors.error(errors.BAD_ARG, 'Attachments need to be base64 encoded'));
          }
          blob = binary ? binStringToBluffer(binary, type) : '';
        }
        var opts = {
          headers: {'Content-Type': type},
          method: 'PUT',
          url: url,
          processData: false,
          body: blob,
          timeout: ajaxOpts.timeout || 60000
        };
        ajax({}, opts, callback);
      });
      api.put = adapterFun('put', utils.getArguments(function(args) {
        var temp,
            temptype,
            opts;
        var doc = args.shift();
        var callback = args.pop();
        if (typeof doc !== 'object' || Array.isArray(doc)) {
          return callback(errors.error(errors.NOT_AN_OBJECT));
        }
        var id = '_id' in doc;
        doc = clone(doc);
        preprocessAttachments(doc).then(function() {
          while (true) {
            temp = args.shift();
            temptype = typeof temp;
            if (temptype === "string" && !id) {
              doc._id = temp;
              id = true;
            } else if (temptype === "string" && id && !('_rev' in doc)) {
              doc._rev = temp;
            } else if (temptype === "object") {
              opts = clone(temp);
            }
            if (!args.length) {
              break;
            }
          }
          opts = opts || {};
          parseDoc.invalidIdError(doc._id);
          var params = [];
          if (opts && typeof opts.new_edits !== 'undefined') {
            params.push('new_edits=' + opts.new_edits);
          }
          params = params.join('&');
          if (params !== '') {
            params = '?' + params;
          }
          var ajaxOpts = {
            method: 'PUT',
            url: genDBUrl(host, encodeDocId(doc._id)) + params,
            body: doc
          };
          return Promise.resolve().then(function() {
            var hasNonStubAttachments = doc._attachments && Object.keys(doc._attachments).filter(function(att) {
              return !doc._attachments[att].stub;
            }).length;
            if (hasNonStubAttachments) {
              var multipart = createMultipart(doc);
              ajaxOpts.body = multipart.body;
              ajaxOpts.processData = false;
              ajaxOpts.headers = multipart.headers;
            }
          }).catch(function() {
            throw new Error('Did you forget to base64-encode an attachment?');
          }).then(function() {
            return ajaxPromise(opts, ajaxOpts);
          }).then(function(res) {
            res.ok = true;
            callback(null, res);
          });
        }).catch(callback);
      }));
      api.post = adapterFun('post', function(doc, opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        opts = clone(opts);
        if (typeof doc !== 'object') {
          return callback(errors.error(errors.NOT_AN_OBJECT));
        }
        if (!("_id" in doc)) {
          doc._id = utils.uuid();
        }
        api.put(doc, opts, function(err, res) {
          if (err) {
            return callback(err);
          }
          res.ok = true;
          callback(null, res);
        });
      });
      api._bulkDocs = function(req, opts, callback) {
        req.new_edits = opts.new_edits;
        setup().then(function() {
          return Promise.all(req.docs.map(preprocessAttachments));
        }).then(function() {
          ajax(opts, {
            method: 'POST',
            url: genDBUrl(host, '_bulk_docs'),
            body: req
          }, function(err, results) {
            if (err) {
              return callback(err);
            }
            results.forEach(function(result) {
              result.ok = true;
            });
            callback(null, results);
          });
        }).catch(callback);
      };
      api.allDocs = adapterFun('allDocs', function(opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        opts = clone(opts);
        var params = [];
        var body;
        var method = 'GET';
        if (opts.conflicts) {
          params.push('conflicts=true');
        }
        if (opts.descending) {
          params.push('descending=true');
        }
        if (opts.include_docs) {
          params.push('include_docs=true');
        }
        if (opts.attachments) {
          params.push('attachments=true');
        }
        if (opts.key) {
          params.push('key=' + encodeURIComponent(JSON.stringify(opts.key)));
        }
        if (opts.start_key) {
          opts.startkey = opts.start_key;
        }
        if (opts.startkey) {
          params.push('startkey=' + encodeURIComponent(JSON.stringify(opts.startkey)));
        }
        if (opts.end_key) {
          opts.endkey = opts.end_key;
        }
        if (opts.endkey) {
          params.push('endkey=' + encodeURIComponent(JSON.stringify(opts.endkey)));
        }
        if (typeof opts.inclusive_end !== 'undefined') {
          params.push('inclusive_end=' + !!opts.inclusive_end);
        }
        if (typeof opts.limit !== 'undefined') {
          params.push('limit=' + opts.limit);
        }
        if (typeof opts.skip !== 'undefined') {
          params.push('skip=' + opts.skip);
        }
        params = params.join('&');
        if (params !== '') {
          params = '?' + params;
        }
        if (typeof opts.keys !== 'undefined') {
          var keysAsString = 'keys=' + encodeURIComponent(JSON.stringify(opts.keys));
          if (keysAsString.length + params.length + 1 <= MAX_URL_LENGTH) {
            params += (params.indexOf('?') !== -1 ? '&' : '?') + keysAsString;
          } else {
            method = 'POST';
            body = {keys: opts.keys};
          }
        }
        ajaxPromise(opts, {
          method: method,
          url: genDBUrl(host, '_all_docs' + params),
          body: body
        }).then(function(res) {
          if (opts.include_docs && opts.attachments && opts.binary) {
            res.rows.forEach(readAttachmentsAsBlobOrBuffer);
          }
          callback(null, res);
        }).catch(callback);
      });
      api._changes = function(opts) {
        var batchSize = 'batch_size' in opts ? opts.batch_size : CHANGES_BATCH_SIZE;
        opts = clone(opts);
        opts.timeout = opts.timeout || ajaxOpts.timeout || 30 * 1000;
        var params = {timeout: opts.timeout - (5 * 1000)};
        var limit = (typeof opts.limit !== 'undefined') ? opts.limit : false;
        var returnDocs;
        if ('returnDocs' in opts) {
          returnDocs = opts.returnDocs;
        } else {
          returnDocs = true;
        }
        var leftToFetch = limit;
        if (opts.style) {
          params.style = opts.style;
        }
        if (opts.include_docs || opts.filter && typeof opts.filter === 'function') {
          params.include_docs = true;
        }
        if (opts.attachments) {
          params.attachments = true;
        }
        if (opts.continuous) {
          params.feed = 'longpoll';
        }
        if (opts.conflicts) {
          params.conflicts = true;
        }
        if (opts.descending) {
          params.descending = true;
        }
        params.heartbeat = opts.heartbeat || 10000;
        if (opts.filter && typeof opts.filter === 'string') {
          params.filter = opts.filter;
          if (opts.filter === '_view' && opts.view && typeof opts.view === 'string') {
            params.view = opts.view;
          }
        }
        if (opts.query_params && typeof opts.query_params === 'object') {
          for (var param_name in opts.query_params) {
            if (opts.query_params.hasOwnProperty(param_name)) {
              params[param_name] = opts.query_params[param_name];
            }
          }
        }
        var method = 'GET';
        var body;
        if (opts.doc_ids) {
          params.filter = '_doc_ids';
          var docIdsJson = JSON.stringify(opts.doc_ids);
          if (docIdsJson.length < MAX_URL_LENGTH) {
            params.doc_ids = docIdsJson;
          } else {
            method = 'POST';
            body = {doc_ids: opts.doc_ids};
          }
        }
        var xhr;
        var lastFetchedSeq;
        var fetch = function(since, callback) {
          if (opts.aborted) {
            return;
          }
          params.since = since;
          if (typeof params.since === "object") {
            params.since = JSON.stringify(params.since);
          }
          if (opts.descending) {
            if (limit) {
              params.limit = leftToFetch;
            }
          } else {
            params.limit = (!limit || leftToFetch > batchSize) ? batchSize : leftToFetch;
          }
          var paramStr = '?' + Object.keys(params).map(function(k) {
            return k + '=' + encodeURIComponent(params[k]);
          }).join('&');
          var xhrOpts = {
            method: method,
            url: genDBUrl(host, '_changes' + paramStr),
            timeout: opts.timeout,
            body: body
          };
          lastFetchedSeq = since;
          if (opts.aborted) {
            return;
          }
          setup().then(function() {
            xhr = ajax(opts, xhrOpts, callback);
          }).catch(callback);
        };
        var fetchTimeout = 10;
        var fetchRetryCount = 0;
        var results = {results: []};
        var fetched = function(err, res) {
          if (opts.aborted) {
            return;
          }
          var raw_results_length = 0;
          if (res && res.results) {
            raw_results_length = res.results.length;
            results.last_seq = res.last_seq;
            var req = {};
            req.query = opts.query_params;
            res.results = res.results.filter(function(c) {
              leftToFetch--;
              var ret = utils.filterChange(opts)(c);
              if (ret) {
                if (opts.include_docs && opts.attachments && opts.binary) {
                  readAttachmentsAsBlobOrBuffer(c);
                }
                if (returnDocs) {
                  results.results.push(c);
                }
                opts.onChange(c);
              }
              return ret;
            });
          } else if (err) {
            opts.aborted = true;
            opts.complete(err);
            return;
          }
          if (res && res.last_seq) {
            lastFetchedSeq = res.last_seq;
          }
          var finished = (limit && leftToFetch <= 0) || (res && raw_results_length < batchSize) || (opts.descending);
          if ((opts.continuous && !(limit && leftToFetch <= 0)) || !finished) {
            if (err) {
              fetchRetryCount += 1;
            } else {
              fetchRetryCount = 0;
            }
            var timeoutMultiplier = 1 << fetchRetryCount;
            var retryWait = fetchTimeout * timeoutMultiplier;
            var maximumWait = opts.maximumWait || 30000;
            if (retryWait > maximumWait) {
              opts.complete(err || errors.error(errors.UNKNOWN_ERROR));
              return;
            }
            setTimeout(function() {
              fetch(lastFetchedSeq, fetched);
            }, retryWait);
          } else {
            opts.complete(null, results);
          }
        };
        fetch(opts.since || 0, fetched);
        return {cancel: function() {
            opts.aborted = true;
            if (xhr) {
              xhr.abort();
            }
          }};
      };
      api.revsDiff = adapterFun('revsDiff', function(req, opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        ajax(opts, {
          method: 'POST',
          url: genDBUrl(host, '_revs_diff'),
          body: req
        }, callback);
      });
      api._close = function(callback) {
        callback();
      };
      api._destroy = function(options, callback) {
        setup().then(function() {
          ajax(options, {
            url: genDBUrl(host, ''),
            method: 'DELETE'
          }, function(err, resp) {
            if (err) {
              api.emit('error', err);
              return callback(err);
            }
            api.emit('destroyed');
            api.constructor.emit('destroyed', opts.name);
            callback(null, resp);
          });
        }).catch(callback);
      };
    }
    HttpPouch.valid = function() {
      return true;
    };
    module.exports = HttpPouch;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("141", ["101"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var Promise = req('101');
  function TaskQueue() {
    this.promise = new Promise(function(fulfill) {
      fulfill();
    });
  }
  TaskQueue.prototype.add = function(promiseFactory) {
    this.promise = this.promise.catch(function() {}).then(function() {
      return promiseFactory();
    });
    return this.promise;
  };
  TaskQueue.prototype.finish = function() {
    return this.promise;
  };
  module.exports = TaskQueue;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("142", ["12f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var Md5 = req('12f');
  module.exports = function(string) {
    return Md5.hash(string);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("143", ["118", "101", "142"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var upsert = req('118');
  var Promise = req('101');
  var md5 = req('142');
  module.exports = function(opts) {
    var sourceDB = opts.db;
    var viewName = opts.viewName;
    var mapFun = opts.map;
    var reduceFun = opts.reduce;
    var temporary = opts.temporary;
    var viewSignature = mapFun.toString() + (reduceFun && reduceFun.toString()) + 'undefined';
    if (!temporary && sourceDB._cachedViews) {
      var cachedView = sourceDB._cachedViews[viewSignature];
      if (cachedView) {
        return Promise.resolve(cachedView);
      }
    }
    return sourceDB.info().then(function(info) {
      var depDbName = info.db_name + '-mrview-' + (temporary ? 'temp' : md5(viewSignature));
      function diffFunction(doc) {
        doc.views = doc.views || {};
        var fullViewName = viewName;
        if (fullViewName.indexOf('/') === -1) {
          fullViewName = viewName + '/' + viewName;
        }
        var depDbs = doc.views[fullViewName] = doc.views[fullViewName] || {};
        if (depDbs[depDbName]) {
          return;
        }
        depDbs[depDbName] = true;
        return doc;
      }
      return upsert(sourceDB, '_local/mrviews', diffFunction).then(function() {
        return sourceDB.registerDependentDatabase(depDbName).then(function(res) {
          var db = res.db;
          db.auto_compaction = true;
          var view = {
            name: depDbName,
            db: db,
            sourceDB: sourceDB,
            adapter: sourceDB.adapter,
            mapFun: mapFun,
            reduceFun: reduceFun
          };
          return view.db.get('_local/lastSeq').catch(function(err) {
            if (err.status !== 404) {
              throw err;
            }
          }).then(function(lastSeqDoc) {
            view.seq = lastSeqDoc ? lastSeqDoc.seq : 0;
            if (!temporary) {
              sourceDB._cachedViews = sourceDB._cachedViews || {};
              sourceDB._cachedViews[viewSignature] = view;
              view.db.once('destroyed', function() {
                delete sourceDB._cachedViews[viewSignature];
              });
            }
            return view;
          });
        });
      });
    });
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("144", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function(func, emit, sum, log, isArray, toJSON) {
    return eval("(" + func.replace(/;\s*$/, "") + ");");
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("145", ["f9", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var argsarray = req('f9');
    exports.promisedCallback = function(promise, callback) {
      if (callback) {
        promise.then(function(res) {
          process.nextTick(function() {
            callback(null, res);
          });
        }, function(reason) {
          process.nextTick(function() {
            callback(reason);
          });
        });
      }
      return promise;
    };
    exports.callbackify = function(fun) {
      return argsarray(function(args) {
        var cb = args.pop();
        var promise = fun.apply(this, args);
        if (typeof cb === 'function') {
          exports.promisedCallback(promise, cb);
        }
        return promise;
      });
    };
    exports.fin = function(promise, finalPromiseFactory) {
      return promise.then(function(res) {
        return finalPromiseFactory().then(function() {
          return res;
        });
      }, function(reason) {
        return finalPromiseFactory().then(function() {
          throw reason;
        });
      });
    };
    exports.sequentialize = function(queue, promiseFactory) {
      return function() {
        var args = arguments;
        var that = this;
        return queue.add(function() {
          return promiseFactory.apply(that, args);
        });
      };
    };
    exports.flatten = function(arrs) {
      var res = [];
      for (var i = 0,
          len = arrs.length; i < len; i++) {
        res = res.concat(arrs[i]);
      }
      return res;
    };
    exports.uniq = function(arr) {
      var map = {};
      for (var i = 0,
          len = arr.length; i < len; i++) {
        map['$' + arr[i]] = true;
      }
      var keys = Object.keys(map);
      var output = new Array(keys.length);
      for (i = 0, len = keys.length; i < len; i++) {
        output[i] = keys[i].substring(1);
      }
      return output;
    };
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("146", ["138", "12b", "141", "143", "144", "145", "101", "f0", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var b64ToBluffer = req('138');
    var pouchCollate = req('12b');
    var TaskQueue = req('141');
    var collate = pouchCollate.collate;
    var toIndexableString = pouchCollate.toIndexableString;
    var normalizeKey = pouchCollate.normalizeKey;
    var parseIndexableString = pouchCollate.parseIndexableString;
    var createView = req('143');
    var evalFunc = req('144');
    var log;
    if ((typeof console !== 'undefined') && (typeof console.log === 'function')) {
      log = Function.prototype.bind.call(console.log, console);
    } else {
      log = function() {};
    }
    var utils = req('145');
    var Promise = req('101');
    var inherits = req('f0');
    var persistentQueues = {};
    var tempViewQueue = new TaskQueue();
    var CHANGES_BATCH_SIZE = 50;
    function parseViewName(name) {
      return name.indexOf('/') === -1 ? [name, name] : name.split('/');
    }
    function isGenOne(changes) {
      return changes.length === 1 && /^1-/.test(changes[0].rev);
    }
    function emitError(db, e) {
      try {
        db.emit('error', e);
      } catch (err) {
        console.error('The user\'s map/reduce function threw an uncaught error.\n' + 'You can debug this error by doing:\n' + 'myDatabase.on(\'error\', function (err) { debugger; });\n' + 'Please double-check your map/reduce function.');
        console.error(e);
      }
    }
    function tryCode(db, fun, args) {
      try {
        return {output: fun.apply(null, args)};
      } catch (e) {
        emitError(db, e);
        return {error: e};
      }
    }
    function sortByKeyThenValue(x, y) {
      var keyCompare = collate(x.key, y.key);
      return keyCompare !== 0 ? keyCompare : collate(x.value, y.value);
    }
    function sliceResults(results, limit, skip) {
      skip = skip || 0;
      if (typeof limit === 'number') {
        return results.slice(skip, limit + skip);
      } else if (skip > 0) {
        return results.slice(skip);
      }
      return results;
    }
    function rowToDocId(row) {
      var val = row.value;
      var docId = (val && typeof val === 'object' && val._id) || row.id;
      return docId;
    }
    function readAttachmentsAsBlobOrBuffer(res) {
      res.rows.forEach(function(row) {
        var atts = row.doc && row.doc._attachments;
        if (!atts) {
          return;
        }
        Object.keys(atts).forEach(function(filename) {
          var att = atts[filename];
          atts[filename].data = b64ToBluffer(att.data, att.content_type);
        });
      });
    }
    function postprocessAttachments(opts) {
      return function(res) {
        if (opts.include_docs && opts.attachments && opts.binary) {
          readAttachmentsAsBlobOrBuffer(res);
        }
        return res;
      };
    }
    function createBuiltInError(name) {
      var message = 'builtin ' + name + ' function requires map values to be numbers' + ' or number arrays';
      return new BuiltInError(message);
    }
    function sum(values) {
      var result = 0;
      for (var i = 0,
          len = values.length; i < len; i++) {
        var num = values[i];
        if (typeof num !== 'number') {
          if (Array.isArray(num)) {
            result = typeof result === 'number' ? [result] : result;
            for (var j = 0,
                jLen = num.length; j < jLen; j++) {
              var jNum = num[j];
              if (typeof jNum !== 'number') {
                throw createBuiltInError('_sum');
              } else if (typeof result[j] === 'undefined') {
                result.push(jNum);
              } else {
                result[j] += jNum;
              }
            }
          } else {
            throw createBuiltInError('_sum');
          }
        } else if (typeof result === 'number') {
          result += num;
        } else {
          result[0] += num;
        }
      }
      return result;
    }
    var builtInReduce = {
      _sum: function(keys, values) {
        return sum(values);
      },
      _count: function(keys, values) {
        return values.length;
      },
      _stats: function(keys, values) {
        function sumsqr(values) {
          var _sumsqr = 0;
          for (var i = 0,
              len = values.length; i < len; i++) {
            var num = values[i];
            _sumsqr += (num * num);
          }
          return _sumsqr;
        }
        return {
          sum: sum(values),
          min: Math.min.apply(null, values),
          max: Math.max.apply(null, values),
          count: values.length,
          sumsqr: sumsqr(values)
        };
      }
    };
    function addHttpParam(paramName, opts, params, asJson) {
      var val = opts[paramName];
      if (typeof val !== 'undefined') {
        if (asJson) {
          val = encodeURIComponent(JSON.stringify(val));
        }
        params.push(paramName + '=' + val);
      }
    }
    function checkQueryParseError(options, fun) {
      var startkeyName = options.descending ? 'endkey' : 'startkey';
      var endkeyName = options.descending ? 'startkey' : 'endkey';
      if (typeof options[startkeyName] !== 'undefined' && typeof options[endkeyName] !== 'undefined' && collate(options[startkeyName], options[endkeyName]) > 0) {
        throw new QueryParseError('No rows can match your key range, ' + 'reverse your start_key and end_key or set {descending : true}');
      } else if (fun.reduce && options.reduce !== false) {
        if (options.include_docs) {
          throw new QueryParseError('{include_docs:true} is invalid for reduce');
        } else if (options.keys && options.keys.length > 1 && !options.group && !options.group_level) {
          throw new QueryParseError('Multi-key fetches for reduce views must use ' + '{group: true}');
        }
      }
      if (options.group_level) {
        if (typeof options.group_level !== 'number') {
          throw new QueryParseError('Invalid value for integer: "' + options.group_level + '"');
        }
        if (options.group_level < 0) {
          throw new QueryParseError('Invalid value for positive integer: ' + '"' + options.group_level + '"');
        }
      }
    }
    function httpQuery(db, fun, opts) {
      var params = [];
      var body;
      var method = 'GET';
      addHttpParam('reduce', opts, params);
      addHttpParam('include_docs', opts, params);
      addHttpParam('attachments', opts, params);
      addHttpParam('limit', opts, params);
      addHttpParam('descending', opts, params);
      addHttpParam('group', opts, params);
      addHttpParam('group_level', opts, params);
      addHttpParam('skip', opts, params);
      addHttpParam('stale', opts, params);
      addHttpParam('conflicts', opts, params);
      addHttpParam('startkey', opts, params, true);
      addHttpParam('start_key', opts, params, true);
      addHttpParam('endkey', opts, params, true);
      addHttpParam('end_key', opts, params, true);
      addHttpParam('inclusive_end', opts, params);
      addHttpParam('key', opts, params, true);
      params = params.join('&');
      params = params === '' ? '' : '?' + params;
      if (typeof opts.keys !== 'undefined') {
        var MAX_URL_LENGTH = 2000;
        var keysAsString = 'keys=' + encodeURIComponent(JSON.stringify(opts.keys));
        if (keysAsString.length + params.length + 1 <= MAX_URL_LENGTH) {
          params += (params[0] === '?' ? '&' : '?') + keysAsString;
        } else {
          method = 'POST';
          if (typeof fun === 'string') {
            body = {keys: opts.keys};
          } else {
            fun.keys = opts.keys;
          }
        }
      }
      if (typeof fun === 'string') {
        var parts = parseViewName(fun);
        return db.request({
          method: method,
          url: '_design/' + parts[0] + '/_view/' + parts[1] + params,
          body: body
        }).then(postprocessAttachments(opts));
      }
      body = body || {};
      Object.keys(fun).forEach(function(key) {
        if (Array.isArray(fun[key])) {
          body[key] = fun[key];
        } else {
          body[key] = fun[key].toString();
        }
      });
      return db.request({
        method: 'POST',
        url: '_temp_view' + params,
        body: body
      }).then(postprocessAttachments(opts));
    }
    function customQuery(db, fun, opts) {
      return new Promise(function(resolve, reject) {
        db._query(fun, opts, function(err, res) {
          if (err) {
            return reject(err);
          }
          resolve(res);
        });
      });
    }
    function customViewCleanup(db) {
      return new Promise(function(resolve, reject) {
        db._viewCleanup(function(err, res) {
          if (err) {
            return reject(err);
          }
          resolve(res);
        });
      });
    }
    function defaultsTo(value) {
      return function(reason) {
        if (reason.status === 404) {
          return value;
        } else {
          throw reason;
        }
      };
    }
    function getDocsToPersist(docId, view, docIdsToChangesAndEmits) {
      var metaDocId = '_local/doc_' + docId;
      var defaultMetaDoc = {
        _id: metaDocId,
        keys: []
      };
      var docData = docIdsToChangesAndEmits[docId];
      var indexableKeysToKeyValues = docData.indexableKeysToKeyValues;
      var changes = docData.changes;
      function getMetaDoc() {
        if (isGenOne(changes)) {
          return Promise.resolve(defaultMetaDoc);
        }
        return view.db.get(metaDocId).catch(defaultsTo(defaultMetaDoc));
      }
      function getKeyValueDocs(metaDoc) {
        if (!metaDoc.keys.length) {
          return Promise.resolve({rows: []});
        }
        return view.db.allDocs({
          keys: metaDoc.keys,
          include_docs: true
        });
      }
      function processKvDocs(metaDoc, kvDocsRes) {
        var kvDocs = [];
        var oldKeysMap = {};
        for (var i = 0,
            len = kvDocsRes.rows.length; i < len; i++) {
          var row = kvDocsRes.rows[i];
          var doc = row.doc;
          if (!doc) {
            continue;
          }
          kvDocs.push(doc);
          oldKeysMap[doc._id] = true;
          doc._deleted = !indexableKeysToKeyValues[doc._id];
          if (!doc._deleted) {
            var keyValue = indexableKeysToKeyValues[doc._id];
            if ('value' in keyValue) {
              doc.value = keyValue.value;
            }
          }
        }
        var newKeys = Object.keys(indexableKeysToKeyValues);
        newKeys.forEach(function(key) {
          if (!oldKeysMap[key]) {
            var kvDoc = {_id: key};
            var keyValue = indexableKeysToKeyValues[key];
            if ('value' in keyValue) {
              kvDoc.value = keyValue.value;
            }
            kvDocs.push(kvDoc);
          }
        });
        metaDoc.keys = utils.uniq(newKeys.concat(metaDoc.keys));
        kvDocs.push(metaDoc);
        return kvDocs;
      }
      return getMetaDoc().then(function(metaDoc) {
        return getKeyValueDocs(metaDoc).then(function(kvDocsRes) {
          return processKvDocs(metaDoc, kvDocsRes);
        });
      });
    }
    function saveKeyValues(view, docIdsToChangesAndEmits, seq) {
      var seqDocId = '_local/lastSeq';
      return view.db.get(seqDocId).catch(defaultsTo({
        _id: seqDocId,
        seq: 0
      })).then(function(lastSeqDoc) {
        var docIds = Object.keys(docIdsToChangesAndEmits);
        return Promise.all(docIds.map(function(docId) {
          return getDocsToPersist(docId, view, docIdsToChangesAndEmits);
        })).then(function(listOfDocsToPersist) {
          var docsToPersist = utils.flatten(listOfDocsToPersist);
          lastSeqDoc.seq = seq;
          docsToPersist.push(lastSeqDoc);
          return view.db.bulkDocs({docs: docsToPersist});
        });
      });
    }
    function getQueue(view) {
      var viewName = typeof view === 'string' ? view : view.name;
      var queue = persistentQueues[viewName];
      if (!queue) {
        queue = persistentQueues[viewName] = new TaskQueue();
      }
      return queue;
    }
    function updateView(view) {
      return utils.sequentialize(getQueue(view), function() {
        return updateViewInQueue(view);
      })();
    }
    function updateViewInQueue(view) {
      var mapResults;
      var doc;
      function emit(key, value) {
        var output = {
          id: doc._id,
          key: normalizeKey(key)
        };
        if (typeof value !== 'undefined' && value !== null) {
          output.value = normalizeKey(value);
        }
        mapResults.push(output);
      }
      var mapFun;
      if (typeof view.mapFun === "function" && view.mapFun.length === 2) {
        var origMap = view.mapFun;
        mapFun = function(doc) {
          return origMap(doc, emit);
        };
      } else {
        mapFun = evalFunc(view.mapFun.toString(), emit, sum, log, Array.isArray, JSON.parse);
      }
      var currentSeq = view.seq || 0;
      function processChange(docIdsToChangesAndEmits, seq) {
        return function() {
          return saveKeyValues(view, docIdsToChangesAndEmits, seq);
        };
      }
      var queue = new TaskQueue();
      return new Promise(function(resolve, reject) {
        function complete() {
          queue.finish().then(function() {
            view.seq = currentSeq;
            resolve();
          });
        }
        function processNextBatch() {
          view.sourceDB.changes({
            conflicts: true,
            include_docs: true,
            style: 'all_docs',
            since: currentSeq,
            limit: CHANGES_BATCH_SIZE
          }).on('complete', function(response) {
            var results = response.results;
            if (!results.length) {
              return complete();
            }
            var docIdsToChangesAndEmits = {};
            for (var i = 0,
                l = results.length; i < l; i++) {
              var change = results[i];
              if (change.doc._id[0] !== '_') {
                mapResults = [];
                doc = change.doc;
                if (!doc._deleted) {
                  tryCode(view.sourceDB, mapFun, [doc]);
                }
                mapResults.sort(sortByKeyThenValue);
                var indexableKeysToKeyValues = {};
                var lastKey;
                for (var j = 0,
                    jl = mapResults.length; j < jl; j++) {
                  var obj = mapResults[j];
                  var complexKey = [obj.key, obj.id];
                  if (collate(obj.key, lastKey) === 0) {
                    complexKey.push(j);
                  }
                  var indexableKey = toIndexableString(complexKey);
                  indexableKeysToKeyValues[indexableKey] = obj;
                  lastKey = obj.key;
                }
                docIdsToChangesAndEmits[change.doc._id] = {
                  indexableKeysToKeyValues: indexableKeysToKeyValues,
                  changes: change.changes
                };
              }
              currentSeq = change.seq;
            }
            queue.add(processChange(docIdsToChangesAndEmits, currentSeq));
            if (results.length < CHANGES_BATCH_SIZE) {
              return complete();
            }
            return processNextBatch();
          }).on('error', onError);
          function onError(err) {
            reject(err);
          }
        }
        processNextBatch();
      });
    }
    function reduceView(view, results, options) {
      if (options.group_level === 0) {
        delete options.group_level;
      }
      var shouldGroup = options.group || options.group_level;
      var reduceFun;
      if (builtInReduce[view.reduceFun]) {
        reduceFun = builtInReduce[view.reduceFun];
      } else {
        reduceFun = evalFunc(view.reduceFun.toString(), null, sum, log, Array.isArray, JSON.parse);
      }
      var groups = [];
      var lvl = options.group_level;
      results.forEach(function(e) {
        var last = groups[groups.length - 1];
        var key = shouldGroup ? e.key : null;
        if (shouldGroup && Array.isArray(key) && typeof lvl === 'number') {
          key = key.length > lvl ? key.slice(0, lvl) : key;
        }
        if (last && collate(last.key[0][0], key) === 0) {
          last.key.push([key, e.id]);
          last.value.push(e.value);
          return;
        }
        groups.push({
          key: [[key, e.id]],
          value: [e.value]
        });
      });
      for (var i = 0,
          len = groups.length; i < len; i++) {
        var e = groups[i];
        var reduceTry = tryCode(view.sourceDB, reduceFun, [e.key, e.value, false]);
        if (reduceTry.error && reduceTry.error instanceof BuiltInError) {
          throw reduceTry.error;
        }
        e.value = reduceTry.error ? null : reduceTry.output;
        e.key = e.key[0][0];
      }
      return {rows: sliceResults(groups, options.limit, options.skip)};
    }
    function queryView(view, opts) {
      return utils.sequentialize(getQueue(view), function() {
        return queryViewInQueue(view, opts);
      })();
    }
    function queryViewInQueue(view, opts) {
      var totalRows;
      var shouldReduce = view.reduceFun && opts.reduce !== false;
      var skip = opts.skip || 0;
      if (typeof opts.keys !== 'undefined' && !opts.keys.length) {
        opts.limit = 0;
        delete opts.keys;
      }
      function fetchFromView(viewOpts) {
        viewOpts.include_docs = true;
        return view.db.allDocs(viewOpts).then(function(res) {
          totalRows = res.total_rows;
          return res.rows.map(function(result) {
            if ('value' in result.doc && typeof result.doc.value === 'object' && result.doc.value !== null) {
              var keys = Object.keys(result.doc.value).sort();
              var expectedKeys = ['id', 'key', 'value'];
              if (!(keys < expectedKeys || keys > expectedKeys)) {
                return result.doc.value;
              }
            }
            var parsedKeyAndDocId = parseIndexableString(result.doc._id);
            return {
              key: parsedKeyAndDocId[0],
              id: parsedKeyAndDocId[1],
              value: ('value' in result.doc ? result.doc.value : null)
            };
          });
        });
      }
      function onMapResultsReady(rows) {
        var finalResults;
        if (shouldReduce) {
          finalResults = reduceView(view, rows, opts);
        } else {
          finalResults = {
            total_rows: totalRows,
            offset: skip,
            rows: rows
          };
        }
        if (opts.include_docs) {
          var docIds = utils.uniq(rows.map(rowToDocId));
          return view.sourceDB.allDocs({
            keys: docIds,
            include_docs: true,
            conflicts: opts.conflicts,
            attachments: opts.attachments,
            binary: opts.binary
          }).then(function(allDocsRes) {
            var docIdsToDocs = {};
            allDocsRes.rows.forEach(function(row) {
              if (row.doc) {
                docIdsToDocs['$' + row.id] = row.doc;
              }
            });
            rows.forEach(function(row) {
              var docId = rowToDocId(row);
              var doc = docIdsToDocs['$' + docId];
              if (doc) {
                row.doc = doc;
              }
            });
            return finalResults;
          });
        } else {
          return finalResults;
        }
      }
      var flatten = function(array) {
        return array.reduce(function(prev, cur) {
          return prev.concat(cur);
        });
      };
      if (typeof opts.keys !== 'undefined') {
        var keys = opts.keys;
        var fetchPromises = keys.map(function(key) {
          var viewOpts = {
            startkey: toIndexableString([key]),
            endkey: toIndexableString([key, {}])
          };
          return fetchFromView(viewOpts);
        });
        return Promise.all(fetchPromises).then(flatten).then(onMapResultsReady);
      } else {
        var viewOpts = {descending: opts.descending};
        if (opts.start_key) {
          opts.startkey = opts.start_key;
        }
        if (opts.end_key) {
          opts.endkey = opts.end_key;
        }
        if (typeof opts.startkey !== 'undefined') {
          viewOpts.startkey = opts.descending ? toIndexableString([opts.startkey, {}]) : toIndexableString([opts.startkey]);
        }
        if (typeof opts.endkey !== 'undefined') {
          var inclusiveEnd = opts.inclusive_end !== false;
          if (opts.descending) {
            inclusiveEnd = !inclusiveEnd;
          }
          viewOpts.endkey = toIndexableString(inclusiveEnd ? [opts.endkey, {}] : [opts.endkey]);
        }
        if (typeof opts.key !== 'undefined') {
          var keyStart = toIndexableString([opts.key]);
          var keyEnd = toIndexableString([opts.key, {}]);
          if (viewOpts.descending) {
            viewOpts.endkey = keyStart;
            viewOpts.startkey = keyEnd;
          } else {
            viewOpts.startkey = keyStart;
            viewOpts.endkey = keyEnd;
          }
        }
        if (!shouldReduce) {
          if (typeof opts.limit === 'number') {
            viewOpts.limit = opts.limit;
          }
          viewOpts.skip = skip;
        }
        return fetchFromView(viewOpts).then(onMapResultsReady);
      }
    }
    function httpViewCleanup(db) {
      return db.request({
        method: 'POST',
        url: '_view_cleanup'
      });
    }
    function localViewCleanup(db) {
      return db.get('_local/mrviews').then(function(metaDoc) {
        var docsToViews = {};
        Object.keys(metaDoc.views).forEach(function(fullViewName) {
          var parts = parseViewName(fullViewName);
          var designDocName = '_design/' + parts[0];
          var viewName = parts[1];
          docsToViews[designDocName] = docsToViews[designDocName] || {};
          docsToViews[designDocName][viewName] = true;
        });
        var opts = {
          keys: Object.keys(docsToViews),
          include_docs: true
        };
        return db.allDocs(opts).then(function(res) {
          var viewsToStatus = {};
          res.rows.forEach(function(row) {
            var ddocName = row.key.substring(8);
            Object.keys(docsToViews[row.key]).forEach(function(viewName) {
              var fullViewName = ddocName + '/' + viewName;
              if (!metaDoc.views[fullViewName]) {
                fullViewName = viewName;
              }
              var viewDBNames = Object.keys(metaDoc.views[fullViewName]);
              var statusIsGood = row.doc && row.doc.views && row.doc.views[viewName];
              viewDBNames.forEach(function(viewDBName) {
                viewsToStatus[viewDBName] = viewsToStatus[viewDBName] || statusIsGood;
              });
            });
          });
          var dbsToDelete = Object.keys(viewsToStatus).filter(function(viewDBName) {
            return !viewsToStatus[viewDBName];
          });
          var destroyPromises = dbsToDelete.map(function(viewDBName) {
            return utils.sequentialize(getQueue(viewDBName), function() {
              return new db.constructor(viewDBName, db.__opts).destroy();
            })();
          });
          return Promise.all(destroyPromises).then(function() {
            return {ok: true};
          });
        });
      }, defaultsTo({ok: true}));
    }
    exports.viewCleanup = utils.callbackify(function() {
      var db = this;
      if (db.type() === 'http') {
        return httpViewCleanup(db);
      }
      if (typeof db._viewCleanup === 'function') {
        return customViewCleanup(db);
      }
      return localViewCleanup(db);
    });
    function queryPromised(db, fun, opts) {
      if (db.type() === 'http') {
        return httpQuery(db, fun, opts);
      }
      if (typeof db._query === 'function') {
        return customQuery(db, fun, opts);
      }
      if (typeof fun !== 'string') {
        checkQueryParseError(opts, fun);
        var createViewOpts = {
          db: db,
          viewName: 'temp_view/temp_view',
          map: fun.map,
          reduce: fun.reduce,
          temporary: true
        };
        tempViewQueue.add(function() {
          return createView(createViewOpts).then(function(view) {
            function cleanup() {
              return view.db.destroy();
            }
            return utils.fin(updateView(view).then(function() {
              return queryView(view, opts);
            }), cleanup);
          });
        });
        return tempViewQueue.finish();
      } else {
        var fullViewName = fun;
        var parts = parseViewName(fullViewName);
        var designDocName = parts[0];
        var viewName = parts[1];
        return db.get('_design/' + designDocName).then(function(doc) {
          var fun = doc.views && doc.views[viewName];
          if (!fun || typeof fun.map !== 'string') {
            throw new NotFoundError('ddoc ' + designDocName + ' has no view named ' + viewName);
          }
          checkQueryParseError(opts, fun);
          var createViewOpts = {
            db: db,
            viewName: fullViewName,
            map: fun.map,
            reduce: fun.reduce
          };
          return createView(createViewOpts).then(function(view) {
            if (opts.stale === 'ok' || opts.stale === 'update_after') {
              if (opts.stale === 'update_after') {
                process.nextTick(function() {
                  updateView(view);
                });
              }
              return queryView(view, opts);
            } else {
              return updateView(view).then(function() {
                return queryView(view, opts);
              });
            }
          });
        });
      }
    }
    exports.query = function(fun, opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      opts = opts || {};
      if (typeof fun === 'function') {
        fun = {map: fun};
      }
      var db = this;
      var promise = Promise.resolve().then(function() {
        return queryPromised(db, fun, opts);
      });
      utils.promisedCallback(promise, callback);
      return promise;
    };
    function QueryParseError(message) {
      this.status = 400;
      this.name = 'query_parse_error';
      this.message = message;
      this.error = true;
      try {
        Error.captureStackTrace(this, QueryParseError);
      } catch (e) {}
    }
    inherits(QueryParseError, Error);
    function NotFoundError(message) {
      this.status = 404;
      this.name = 'not_found';
      this.message = message;
      this.error = true;
      try {
        Error.captureStackTrace(this, NotFoundError);
      } catch (e) {}
    }
    inherits(NotFoundError, Error);
    function BuiltInError(message) {
      this.status = 500;
      this.name = 'invalid_value';
      this.message = message;
      this.error = true;
      try {
        Error.captureStackTrace(this, BuiltInError);
      } catch (e) {}
    }
    inherits(BuiltInError, Error);
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("147", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  exports.ADAPTER_VERSION = 5;
  exports.DOC_STORE = 'document-store';
  exports.BY_SEQ_STORE = 'by-sequence';
  exports.ATTACH_STORE = 'attach-store';
  exports.ATTACH_AND_SEQ_STORE = 'attach-seq-store';
  exports.META_STORE = 'meta-store';
  exports.LOCAL_STORE = 'local-store';
  exports.DETECT_BLOB_SUPPORT_STORE = 'detect-blob-support';
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("148", ["f1", "ee", "103", "147", "13d", "138", "eb", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var errors = req('f1');
    var utils = req('ee');
    var base64 = req('103');
    var btoa = base64.btoa;
    var constants = req('147');
    var readAsBinaryString = req('13d');
    var b64StringToBlob = req('138');
    var createBlob = req('eb');
    function tryCode(fun, that, args) {
      try {
        fun.apply(that, args);
      } catch (err) {
        if (typeof PouchDB !== 'undefined') {
          PouchDB.emit('error', err);
        }
      }
    }
    exports.taskQueue = {
      running: false,
      queue: []
    };
    exports.applyNext = function() {
      if (exports.taskQueue.running || !exports.taskQueue.queue.length) {
        return;
      }
      exports.taskQueue.running = true;
      var item = exports.taskQueue.queue.shift();
      item.action(function(err, res) {
        tryCode(item.callback, this, [err, res]);
        exports.taskQueue.running = false;
        process.nextTick(exports.applyNext);
      });
    };
    exports.idbError = function(callback) {
      return function(evt) {
        var message = 'unknown_error';
        if (evt.target && evt.target.error) {
          message = evt.target.error.name || evt.target.error.message;
        }
        callback(errors.error(errors.IDB_ERROR, message, evt.type));
      };
    };
    exports.encodeMetadata = function(metadata, winningRev, deleted) {
      return {
        data: utils.safeJsonStringify(metadata),
        winningRev: winningRev,
        deletedOrLocal: deleted ? '1' : '0',
        seq: metadata.seq,
        id: metadata.id
      };
    };
    exports.decodeMetadata = function(storedObject) {
      if (!storedObject) {
        return null;
      }
      var metadata = utils.safeJsonParse(storedObject.data);
      metadata.winningRev = storedObject.winningRev;
      metadata.deleted = storedObject.deletedOrLocal === '1';
      metadata.seq = storedObject.seq;
      return metadata;
    };
    exports.decodeDoc = function(doc) {
      if (!doc) {
        return doc;
      }
      var idx = doc._doc_id_rev.lastIndexOf(':');
      doc._id = doc._doc_id_rev.substring(0, idx - 1);
      doc._rev = doc._doc_id_rev.substring(idx + 1);
      delete doc._doc_id_rev;
      return doc;
    };
    exports.readBlobData = function(body, type, asBlob, callback) {
      if (asBlob) {
        if (!body) {
          callback(createBlob([''], {type: type}));
        } else if (typeof body !== 'string') {
          callback(body);
        } else {
          callback(b64StringToBlob(body, type));
        }
      } else {
        if (!body) {
          callback('');
        } else if (typeof body !== 'string') {
          readAsBinaryString(body, function(binary) {
            callback(btoa(binary));
          });
        } else {
          callback(body);
        }
      }
    };
    exports.fetchAttachmentsIfNecessary = function(doc, opts, txn, cb) {
      var attachments = Object.keys(doc._attachments || {});
      if (!attachments.length) {
        return cb && cb();
      }
      var numDone = 0;
      function checkDone() {
        if (++numDone === attachments.length && cb) {
          cb();
        }
      }
      function fetchAttachment(doc, att) {
        var attObj = doc._attachments[att];
        var digest = attObj.digest;
        var req = txn.objectStore(constants.ATTACH_STORE).get(digest);
        req.onsuccess = function(e) {
          attObj.body = e.target.result.body;
          checkDone();
        };
      }
      attachments.forEach(function(att) {
        if (opts.attachments && opts.include_docs) {
          fetchAttachment(doc, att);
        } else {
          doc._attachments[att].stub = true;
          checkDone();
        }
      });
    };
    exports.postProcessAttachments = function(results, asBlob) {
      return utils.Promise.all(results.map(function(row) {
        if (row.doc && row.doc._attachments) {
          var attNames = Object.keys(row.doc._attachments);
          return utils.Promise.all(attNames.map(function(att) {
            var attObj = row.doc._attachments[att];
            if (!('body' in attObj)) {
              return;
            }
            var body = attObj.body;
            var type = attObj.content_type;
            return new utils.Promise(function(resolve) {
              exports.readBlobData(body, type, asBlob, function(data) {
                row.doc._attachments[att] = utils.extend(utils.pick(attObj, ['digest', 'content_type']), {data: data});
                resolve();
              });
            });
          }));
        }
      }));
    };
    exports.compactRevs = function(revs, docId, txn) {
      var possiblyOrphanedDigests = [];
      var seqStore = txn.objectStore(constants.BY_SEQ_STORE);
      var attStore = txn.objectStore(constants.ATTACH_STORE);
      var attAndSeqStore = txn.objectStore(constants.ATTACH_AND_SEQ_STORE);
      var count = revs.length;
      function checkDone() {
        count--;
        if (!count) {
          deleteOrphanedAttachments();
        }
      }
      function deleteOrphanedAttachments() {
        if (!possiblyOrphanedDigests.length) {
          return;
        }
        possiblyOrphanedDigests.forEach(function(digest) {
          var countReq = attAndSeqStore.index('digestSeq').count(IDBKeyRange.bound(digest + '::', digest + '::\uffff', false, false));
          countReq.onsuccess = function(e) {
            var count = e.target.result;
            if (!count) {
              attStore.delete(digest);
            }
          };
        });
      }
      revs.forEach(function(rev) {
        var index = seqStore.index('_doc_id_rev');
        var key = docId + "::" + rev;
        index.getKey(key).onsuccess = function(e) {
          var seq = e.target.result;
          if (typeof seq !== 'number') {
            return checkDone();
          }
          seqStore.delete(seq);
          var cursor = attAndSeqStore.index('seq').openCursor(IDBKeyRange.only(seq));
          cursor.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
              var digest = cursor.value.digestSeq.split('::')[0];
              possiblyOrphanedDigests.push(digest);
              attAndSeqStore.delete(cursor.primaryKey);
              cursor.continue();
            } else {
              checkDone();
            }
          };
        };
      });
    };
    exports.openTransactionSafely = function(idb, stores, mode) {
      try {
        return {txn: idb.transaction(stores, mode)};
      } catch (err) {
        return {error: err};
      }
    };
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("149", ["103", "13c", "ec", "105", "f1", "130", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var base64 = req('103');
    var arrayBuffToBinString = req('13c');
    var readAsArrayBuffer = req('ec');
    var binStringToBlobOrBuffer = req('105');
    var errors = req('f1');
    var md5 = req('130');
    function preprocessAttachments(docInfos, blobType, callback) {
      if (!docInfos.length) {
        return callback();
      }
      var docv = 0;
      function parseBase64(data) {
        try {
          return base64.atob(data);
        } catch (e) {
          var err = errors.error(errors.BAD_ARG, 'Attachments need to be base64 encoded');
          return {error: err};
        }
      }
      function preprocessAttachment(att, callback) {
        if (att.stub) {
          return callback();
        }
        if (typeof att.data === 'string') {
          var asBinary = parseBase64(att.data);
          if (asBinary.error) {
            return callback(asBinary.error);
          }
          att.length = asBinary.length;
          if (blobType === 'blob') {
            att.data = binStringToBlobOrBuffer(asBinary, att.content_type);
          } else if (blobType === 'base64') {
            att.data = base64.btoa(asBinary);
          } else {
            att.data = asBinary;
          }
          md5(asBinary).then(function(result) {
            att.digest = 'md5-' + result;
            callback();
          });
        } else {
          readAsArrayBuffer(att.data, function(buff) {
            if (blobType === 'binary') {
              att.data = arrayBuffToBinString(buff);
            } else if (blobType === 'base64') {
              att.data = base64.btoa(arrayBuffToBinString(buff));
            }
            md5(buff).then(function(result) {
              att.digest = 'md5-' + result;
              att.length = buff.byteLength;
              callback();
            });
          });
        }
      }
      var overallErr;
      docInfos.forEach(function(docInfo) {
        var attachments = docInfo.data && docInfo.data._attachments ? Object.keys(docInfo.data._attachments) : [];
        var recv = 0;
        if (!attachments.length) {
          return done();
        }
        function processedAttachment(err) {
          overallErr = err;
          recv++;
          if (recv === attachments.length) {
            done();
          }
        }
        for (var key in docInfo.data._attachments) {
          if (docInfo.data._attachments.hasOwnProperty(key)) {
            preprocessAttachment(docInfo.data._attachments[key], processedAttachment);
          }
        }
      });
      function done() {
        docv++;
        if (docInfos.length === docv) {
          if (overallErr) {
            callback(overallErr);
          } else {
            callback();
          }
        }
      }
    }
    module.exports = preprocessAttachments;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14a", ["124"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var rootToLeaf = req('124');
  function sortByPos(a, b) {
    return a.pos - b.pos;
  }
  function binarySearch(arr, item, comparator) {
    var low = 0;
    var high = arr.length;
    var mid;
    while (low < high) {
      mid = (low + high) >>> 1;
      if (comparator(arr[mid], item) < 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
  function insertSorted(arr, item, comparator) {
    var idx = binarySearch(arr, item, comparator);
    arr.splice(idx, 0, item);
  }
  function pathToTree(path, numStemmed) {
    var root;
    var leaf;
    for (var i = numStemmed,
        len = path.length; i < len; i++) {
      var node = path[i];
      var currentLeaf = [node.id, node.opts, []];
      if (leaf) {
        leaf[2].push(currentLeaf);
        leaf = currentLeaf;
      } else {
        root = leaf = currentLeaf;
      }
    }
    return root;
  }
  function compareTree(a, b) {
    return a[0] < b[0] ? -1 : 1;
  }
  function mergeTree(in_tree1, in_tree2) {
    var queue = [{
      tree1: in_tree1,
      tree2: in_tree2
    }];
    var conflicts = false;
    while (queue.length > 0) {
      var item = queue.pop();
      var tree1 = item.tree1;
      var tree2 = item.tree2;
      if (tree1[1].status || tree2[1].status) {
        tree1[1].status = (tree1[1].status === 'available' || tree2[1].status === 'available') ? 'available' : 'missing';
      }
      for (var i = 0; i < tree2[2].length; i++) {
        if (!tree1[2][0]) {
          conflicts = 'new_leaf';
          tree1[2][0] = tree2[2][i];
          continue;
        }
        var merged = false;
        for (var j = 0; j < tree1[2].length; j++) {
          if (tree1[2][j][0] === tree2[2][i][0]) {
            queue.push({
              tree1: tree1[2][j],
              tree2: tree2[2][i]
            });
            merged = true;
          }
        }
        if (!merged) {
          conflicts = 'new_branch';
          insertSorted(tree1[2], tree2[2][i], compareTree);
        }
      }
    }
    return {
      conflicts: conflicts,
      tree: in_tree1
    };
  }
  function doMerge(tree, path, dontExpand) {
    var restree = [];
    var conflicts = false;
    var merged = false;
    var res;
    if (!tree.length) {
      return {
        tree: [path],
        conflicts: 'new_leaf'
      };
    }
    for (var i = 0,
        len = tree.length; i < len; i++) {
      var branch = tree[i];
      if (branch.pos === path.pos && branch.ids[0] === path.ids[0]) {
        res = mergeTree(branch.ids, path.ids);
        restree.push({
          pos: branch.pos,
          ids: res.tree
        });
        conflicts = conflicts || res.conflicts;
        merged = true;
      } else if (dontExpand !== true) {
        var t1 = branch.pos < path.pos ? branch : path;
        var t2 = branch.pos < path.pos ? path : branch;
        var diff = t2.pos - t1.pos;
        var candidateParents = [];
        var trees = [];
        trees.push({
          ids: t1.ids,
          diff: diff,
          parent: null,
          parentIdx: null
        });
        while (trees.length > 0) {
          var item = trees.pop();
          if (item.diff === 0) {
            if (item.ids[0] === t2.ids[0]) {
              candidateParents.push(item);
            }
            continue;
          }
          var elements = item.ids[2];
          for (var j = 0,
              elementsLen = elements.length; j < elementsLen; j++) {
            trees.push({
              ids: elements[j],
              diff: item.diff - 1,
              parent: item.ids,
              parentIdx: j
            });
          }
        }
        var el = candidateParents[0];
        if (!el) {
          restree.push(branch);
        } else {
          res = mergeTree(el.ids, t2.ids);
          el.parent[2][el.parentIdx] = res.tree;
          restree.push({
            pos: t1.pos,
            ids: t1.ids
          });
          conflicts = conflicts || res.conflicts;
          merged = true;
        }
      } else {
        restree.push(branch);
      }
    }
    if (!merged) {
      restree.push(path);
    }
    restree.sort(sortByPos);
    return {
      tree: restree,
      conflicts: conflicts || 'internal_node'
    };
  }
  function stem(tree, depth) {
    var paths = rootToLeaf(tree);
    var result;
    for (var i = 0,
        len = paths.length; i < len; i++) {
      var path = paths[i];
      var stemmed = path.ids;
      var numStemmed = Math.max(0, stemmed.length - depth);
      var stemmedNode = {
        pos: path.pos + numStemmed,
        ids: pathToTree(stemmed, numStemmed)
      };
      if (result) {
        result = doMerge(result, stemmedNode, true).tree;
      } else {
        result = [stemmedNode];
      }
    }
    return result;
  }
  module.exports = function merge(tree, path, depth) {
    var newTree = doMerge(tree, path);
    return {
      tree: stem(newTree.tree, depth),
      conflicts: newTree.conflicts
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = function revExists(revs, rev) {
    var toVisit = revs.slice();
    var splitRev = rev.split('-');
    var targetPos = parseInt(splitRev[0], 10);
    var targetId = splitRev[1];
    var node;
    while ((node = toVisit.pop())) {
      if (node.pos === targetPos && node.ids[0] === targetId) {
        return true;
      }
      var branches = node.ids[2];
      for (var i = 0,
          len = branches.length; i < len; i++) {
        toVisit.push({
          pos: node.pos + 1,
          ids: branches[i]
        });
      }
    }
    return false;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14c", ["f1", "11a", "fc", "119", "14a", "14b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var errors = req('f1');
  var isDeleted = req('11a');
  var parseDoc = req('fc').parseDoc;
  var calculateWinningRev = req('119');
  var merge = req('14a');
  var revExists = req('14b');
  function updateDoc(prev, docInfo, results, i, cb, writeDoc, newEdits) {
    if (revExists(prev.rev_tree, docInfo.metadata.rev)) {
      results[i] = docInfo;
      return cb();
    }
    var previousWinningRev = prev.winningRev || calculateWinningRev(prev);
    var previouslyDeleted = 'deleted' in prev ? prev.deleted : isDeleted(prev, previousWinningRev);
    var deleted = 'deleted' in docInfo.metadata ? docInfo.metadata.deleted : isDeleted(docInfo.metadata);
    var isRoot = /^1-/.test(docInfo.metadata.rev);
    if (previouslyDeleted && !deleted && newEdits && isRoot) {
      var newDoc = docInfo.data;
      newDoc._rev = previousWinningRev;
      newDoc._id = docInfo.metadata.id;
      docInfo = parseDoc(newDoc, newEdits);
    }
    var merged = merge(prev.rev_tree, docInfo.metadata.rev_tree[0], 1000);
    var inConflict = newEdits && (((previouslyDeleted && deleted) || (!previouslyDeleted && merged.conflicts !== 'new_leaf') || (previouslyDeleted && !deleted && merged.conflicts === 'new_branch')));
    if (inConflict) {
      var err = errors.error(errors.REV_CONFLICT);
      results[i] = err;
      return cb();
    }
    var newRev = docInfo.metadata.rev;
    docInfo.metadata.rev_tree = merged.tree;
    if (prev.rev_map) {
      docInfo.metadata.rev_map = prev.rev_map;
    }
    var winningRev = calculateWinningRev(docInfo.metadata);
    var winningRevIsDeleted = isDeleted(docInfo.metadata, winningRev);
    var delta = (previouslyDeleted === winningRevIsDeleted) ? 0 : previouslyDeleted < winningRevIsDeleted ? -1 : 1;
    var newRevIsDeleted;
    if (newRev === winningRev) {
      newRevIsDeleted = winningRevIsDeleted;
    } else {
      newRevIsDeleted = isDeleted(docInfo.metadata, newRev);
    }
    writeDoc(docInfo, winningRev, winningRevIsDeleted, newRevIsDeleted, true, delta, i, cb);
  }
  module.exports = updateDoc;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14d", ["f1", "14c", "11a", "123", "119", "14a", "fb", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var errors = req('f1');
    var updateDoc = req('14c');
    var isDeleted = req('11a');
    var isLocalId = req('123');
    var calculateWinningRev = req('119');
    var merge = req('14a');
    var collections = req('fb');
    var Map = collections.Map;
    function processDocs(docInfos, api, fetchedDocs, tx, results, writeDoc, opts, overallCallback) {
      function insertDoc(docInfo, resultsIdx, callback) {
        var winningRev = calculateWinningRev(docInfo.metadata);
        var deleted = isDeleted(docInfo.metadata, winningRev);
        if ('was_delete' in opts && deleted) {
          results[resultsIdx] = errors.error(errors.MISSING_DOC, 'deleted');
          return callback();
        }
        var delta = deleted ? 0 : 1;
        writeDoc(docInfo, winningRev, deleted, deleted, false, delta, resultsIdx, callback);
      }
      var newEdits = opts.new_edits;
      var idsToDocs = new Map();
      var docsDone = 0;
      var docsToDo = docInfos.length;
      function checkAllDocsDone() {
        if (++docsDone === docsToDo && overallCallback) {
          overallCallback();
        }
      }
      docInfos.forEach(function(currentDoc, resultsIdx) {
        if (currentDoc._id && isLocalId(currentDoc._id)) {
          api[currentDoc._deleted ? '_removeLocal' : '_putLocal'](currentDoc, {ctx: tx}, function(err) {
            if (err) {
              results[resultsIdx] = err;
            } else {
              results[resultsIdx] = {ok: true};
            }
            checkAllDocsDone();
          });
          return;
        }
        var id = currentDoc.metadata.id;
        if (idsToDocs.has(id)) {
          docsToDo--;
          idsToDocs.get(id).push([currentDoc, resultsIdx]);
        } else {
          idsToDocs.set(id, [[currentDoc, resultsIdx]]);
        }
      });
      idsToDocs.forEach(function(docs, id) {
        var numDone = 0;
        function docWritten() {
          if (++numDone < docs.length) {
            nextDoc();
          } else {
            checkAllDocsDone();
          }
        }
        function nextDoc() {
          var value = docs[numDone];
          var currentDoc = value[0];
          var resultsIdx = value[1];
          if (fetchedDocs.has(id)) {
            updateDoc(fetchedDocs.get(id), currentDoc, results, resultsIdx, docWritten, writeDoc, newEdits);
          } else {
            var merged = merge([], currentDoc.metadata.rev_tree[0], 1000);
            currentDoc.metadata.rev_tree = merged.tree;
            insertDoc(currentDoc, resultsIdx, docWritten);
          }
        }
        nextDoc();
      });
    }
    module.exports = processDocs;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14e", ["ee", "f1", "149", "14d", "123", "148", "147", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var utils = req('ee');
    var errors = req('f1');
    var preprocessAttachments = req('149');
    var processDocs = req('14d');
    var isLocalId = req('123');
    var idbUtils = req('148');
    var idbConstants = req('147');
    var ATTACH_AND_SEQ_STORE = idbConstants.ATTACH_AND_SEQ_STORE;
    var ATTACH_STORE = idbConstants.ATTACH_STORE;
    var BY_SEQ_STORE = idbConstants.BY_SEQ_STORE;
    var DOC_STORE = idbConstants.DOC_STORE;
    var LOCAL_STORE = idbConstants.LOCAL_STORE;
    var META_STORE = idbConstants.META_STORE;
    var compactRevs = idbUtils.compactRevs;
    var decodeMetadata = idbUtils.decodeMetadata;
    var encodeMetadata = idbUtils.encodeMetadata;
    var idbError = idbUtils.idbError;
    var openTransactionSafely = idbUtils.openTransactionSafely;
    function idbBulkDocs(req, opts, api, idb, Changes, callback) {
      var docInfos = req.docs;
      var txn;
      var docStore;
      var bySeqStore;
      var attachStore;
      var attachAndSeqStore;
      var docInfoError;
      var docCountDelta = 0;
      for (var i = 0,
          len = docInfos.length; i < len; i++) {
        var doc = docInfos[i];
        if (doc._id && isLocalId(doc._id)) {
          continue;
        }
        doc = docInfos[i] = utils.parseDoc(doc, opts.new_edits);
        if (doc.error && !docInfoError) {
          docInfoError = doc;
        }
      }
      if (docInfoError) {
        return callback(docInfoError);
      }
      var results = new Array(docInfos.length);
      var fetchedDocs = new utils.Map();
      var preconditionErrored = false;
      var blobType = api._meta.blobSupport ? 'blob' : 'base64';
      preprocessAttachments(docInfos, blobType, function(err) {
        if (err) {
          return callback(err);
        }
        startTransaction();
      });
      function startTransaction() {
        var stores = [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, META_STORE, LOCAL_STORE, ATTACH_AND_SEQ_STORE];
        var txnResult = openTransactionSafely(idb, stores, 'readwrite');
        if (txnResult.error) {
          return callback(txnResult.error);
        }
        txn = txnResult.txn;
        txn.onabort = idbError(callback);
        txn.ontimeout = idbError(callback);
        txn.oncomplete = complete;
        docStore = txn.objectStore(DOC_STORE);
        bySeqStore = txn.objectStore(BY_SEQ_STORE);
        attachStore = txn.objectStore(ATTACH_STORE);
        attachAndSeqStore = txn.objectStore(ATTACH_AND_SEQ_STORE);
        verifyAttachments(function(err) {
          if (err) {
            preconditionErrored = true;
            return callback(err);
          }
          fetchExistingDocs();
        });
      }
      function idbProcessDocs() {
        processDocs(docInfos, api, fetchedDocs, txn, results, writeDoc, opts);
      }
      function fetchExistingDocs() {
        if (!docInfos.length) {
          return;
        }
        var numFetched = 0;
        function checkDone() {
          if (++numFetched === docInfos.length) {
            idbProcessDocs();
          }
        }
        function readMetadata(event) {
          var metadata = decodeMetadata(event.target.result);
          if (metadata) {
            fetchedDocs.set(metadata.id, metadata);
          }
          checkDone();
        }
        for (var i = 0,
            len = docInfos.length; i < len; i++) {
          var docInfo = docInfos[i];
          if (docInfo._id && isLocalId(docInfo._id)) {
            checkDone();
            continue;
          }
          var req = docStore.get(docInfo.metadata.id);
          req.onsuccess = readMetadata;
        }
      }
      function complete() {
        if (preconditionErrored) {
          return;
        }
        Changes.notify(api._meta.name);
        api._meta.docCount += docCountDelta;
        callback(null, results);
      }
      function verifyAttachment(digest, callback) {
        var req = attachStore.get(digest);
        req.onsuccess = function(e) {
          if (!e.target.result) {
            var err = errors.error(errors.MISSING_STUB, 'unknown stub attachment with digest ' + digest);
            err.status = 412;
            callback(err);
          } else {
            callback();
          }
        };
      }
      function verifyAttachments(finish) {
        var digests = [];
        docInfos.forEach(function(docInfo) {
          if (docInfo.data && docInfo.data._attachments) {
            Object.keys(docInfo.data._attachments).forEach(function(filename) {
              var att = docInfo.data._attachments[filename];
              if (att.stub) {
                digests.push(att.digest);
              }
            });
          }
        });
        if (!digests.length) {
          return finish();
        }
        var numDone = 0;
        var err;
        function checkDone() {
          if (++numDone === digests.length) {
            finish(err);
          }
        }
        digests.forEach(function(digest) {
          verifyAttachment(digest, function(attErr) {
            if (attErr && !err) {
              err = attErr;
            }
            checkDone();
          });
        });
      }
      function writeDoc(docInfo, winningRev, winningRevIsDeleted, newRevIsDeleted, isUpdate, delta, resultsIdx, callback) {
        docCountDelta += delta;
        docInfo.metadata.winningRev = winningRev;
        docInfo.metadata.deleted = winningRevIsDeleted;
        var doc = docInfo.data;
        doc._id = docInfo.metadata.id;
        doc._rev = docInfo.metadata.rev;
        if (newRevIsDeleted) {
          doc._deleted = true;
        }
        var hasAttachments = doc._attachments && Object.keys(doc._attachments).length;
        if (hasAttachments) {
          return writeAttachments(docInfo, winningRev, winningRevIsDeleted, isUpdate, resultsIdx, callback);
        }
        finishDoc(docInfo, winningRev, winningRevIsDeleted, isUpdate, resultsIdx, callback);
      }
      function autoCompact(docInfo) {
        var revsToDelete = utils.compactTree(docInfo.metadata);
        compactRevs(revsToDelete, docInfo.metadata.id, txn);
      }
      function finishDoc(docInfo, winningRev, winningRevIsDeleted, isUpdate, resultsIdx, callback) {
        var doc = docInfo.data;
        var metadata = docInfo.metadata;
        doc._doc_id_rev = metadata.id + '::' + metadata.rev;
        delete doc._id;
        delete doc._rev;
        function afterPutDoc(e) {
          if (isUpdate && api.auto_compaction) {
            autoCompact(docInfo);
          }
          metadata.seq = e.target.result;
          delete metadata.rev;
          var metadataToStore = encodeMetadata(metadata, winningRev, winningRevIsDeleted);
          var metaDataReq = docStore.put(metadataToStore);
          metaDataReq.onsuccess = afterPutMetadata;
        }
        function afterPutDocError(e) {
          e.preventDefault();
          e.stopPropagation();
          var index = bySeqStore.index('_doc_id_rev');
          var getKeyReq = index.getKey(doc._doc_id_rev);
          getKeyReq.onsuccess = function(e) {
            var putReq = bySeqStore.put(doc, e.target.result);
            putReq.onsuccess = afterPutDoc;
          };
        }
        function afterPutMetadata() {
          results[resultsIdx] = {
            ok: true,
            id: metadata.id,
            rev: winningRev
          };
          fetchedDocs.set(docInfo.metadata.id, docInfo.metadata);
          insertAttachmentMappings(docInfo, metadata.seq, callback);
        }
        var putReq = bySeqStore.put(doc);
        putReq.onsuccess = afterPutDoc;
        putReq.onerror = afterPutDocError;
      }
      function writeAttachments(docInfo, winningRev, winningRevIsDeleted, isUpdate, resultsIdx, callback) {
        var doc = docInfo.data;
        var numDone = 0;
        var attachments = Object.keys(doc._attachments);
        function collectResults() {
          if (numDone === attachments.length) {
            finishDoc(docInfo, winningRev, winningRevIsDeleted, isUpdate, resultsIdx, callback);
          }
        }
        function attachmentSaved() {
          numDone++;
          collectResults();
        }
        attachments.forEach(function(key) {
          var att = docInfo.data._attachments[key];
          if (!att.stub) {
            var data = att.data;
            delete att.data;
            var digest = att.digest;
            saveAttachment(digest, data, attachmentSaved);
          } else {
            numDone++;
            collectResults();
          }
        });
      }
      function insertAttachmentMappings(docInfo, seq, callback) {
        var attsAdded = 0;
        var attsToAdd = Object.keys(docInfo.data._attachments || {});
        if (!attsToAdd.length) {
          return callback();
        }
        function checkDone() {
          if (++attsAdded === attsToAdd.length) {
            callback();
          }
        }
        function add(att) {
          var digest = docInfo.data._attachments[att].digest;
          var req = attachAndSeqStore.put({
            seq: seq,
            digestSeq: digest + '::' + seq
          });
          req.onsuccess = checkDone;
          req.onerror = function(e) {
            e.preventDefault();
            e.stopPropagation();
            checkDone();
          };
        }
        for (var i = 0; i < attsToAdd.length; i++) {
          add(attsToAdd[i]);
        }
      }
      function saveAttachment(digest, data, callback) {
        var getKeyReq = attachStore.count(digest);
        getKeyReq.onsuccess = function(e) {
          var count = e.target.result;
          if (count) {
            return callback();
          }
          var newAtt = {
            digest: digest,
            body: data
          };
          var putReq = attachStore.put(newAtt);
          putReq.onsuccess = callback;
        };
      }
    }
    module.exports = idbBulkDocs;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14f", ["f1", "148", "147", "120"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var errors = req('f1');
  var idbUtils = req('148');
  var idbConstants = req('147');
  var collectConflicts = req('120');
  var ATTACH_STORE = idbConstants.ATTACH_STORE;
  var BY_SEQ_STORE = idbConstants.BY_SEQ_STORE;
  var DOC_STORE = idbConstants.DOC_STORE;
  var decodeDoc = idbUtils.decodeDoc;
  var decodeMetadata = idbUtils.decodeMetadata;
  var fetchAttachmentsIfNecessary = idbUtils.fetchAttachmentsIfNecessary;
  var postProcessAttachments = idbUtils.postProcessAttachments;
  var openTransactionSafely = idbUtils.openTransactionSafely;
  function createKeyRange(start, end, inclusiveEnd, key, descending) {
    try {
      if (start && end) {
        if (descending) {
          return IDBKeyRange.bound(end, start, !inclusiveEnd, false);
        } else {
          return IDBKeyRange.bound(start, end, false, !inclusiveEnd);
        }
      } else if (start) {
        if (descending) {
          return IDBKeyRange.upperBound(start);
        } else {
          return IDBKeyRange.lowerBound(start);
        }
      } else if (end) {
        if (descending) {
          return IDBKeyRange.lowerBound(end, !inclusiveEnd);
        } else {
          return IDBKeyRange.upperBound(end, !inclusiveEnd);
        }
      } else if (key) {
        return IDBKeyRange.only(key);
      }
    } catch (e) {
      return {error: e};
    }
    return null;
  }
  function handleKeyRangeError(api, opts, err, callback) {
    if (err.name === "DataError" && err.code === 0) {
      return callback(null, {
        total_rows: api._meta.docCount,
        offset: opts.skip,
        rows: []
      });
    }
    callback(errors.error(errors.IDB_ERROR, err.name, err.message));
  }
  function idbAllDocs(opts, api, idb, callback) {
    function allDocsQuery(opts, callback) {
      var start = 'startkey' in opts ? opts.startkey : false;
      var end = 'endkey' in opts ? opts.endkey : false;
      var key = 'key' in opts ? opts.key : false;
      var skip = opts.skip || 0;
      var limit = typeof opts.limit === 'number' ? opts.limit : -1;
      var inclusiveEnd = opts.inclusive_end !== false;
      var descending = 'descending' in opts && opts.descending ? 'prev' : null;
      var keyRange = createKeyRange(start, end, inclusiveEnd, key, descending);
      if (keyRange && keyRange.error) {
        return handleKeyRangeError(api, opts, keyRange.error, callback);
      }
      var stores = [DOC_STORE, BY_SEQ_STORE];
      if (opts.attachments) {
        stores.push(ATTACH_STORE);
      }
      var txnResult = openTransactionSafely(idb, stores, 'readonly');
      if (txnResult.error) {
        return callback(txnResult.error);
      }
      var txn = txnResult.txn;
      var docStore = txn.objectStore(DOC_STORE);
      var seqStore = txn.objectStore(BY_SEQ_STORE);
      var cursor = descending ? docStore.openCursor(keyRange, descending) : docStore.openCursor(keyRange);
      var docIdRevIndex = seqStore.index('_doc_id_rev');
      var results = [];
      var docCount = 0;
      function fetchDocAsynchronously(metadata, row, winningRev) {
        var key = metadata.id + "::" + winningRev;
        docIdRevIndex.get(key).onsuccess = function onGetDoc(e) {
          row.doc = decodeDoc(e.target.result);
          if (opts.conflicts) {
            row.doc._conflicts = collectConflicts(metadata);
          }
          fetchAttachmentsIfNecessary(row.doc, opts, txn);
        };
      }
      function allDocsInner(cursor, winningRev, metadata) {
        var row = {
          id: metadata.id,
          key: metadata.id,
          value: {rev: winningRev}
        };
        var deleted = metadata.deleted;
        if (opts.deleted === 'ok') {
          results.push(row);
          if (deleted) {
            row.value.deleted = true;
            row.doc = null;
          } else if (opts.include_docs) {
            fetchDocAsynchronously(metadata, row, winningRev);
          }
        } else if (!deleted && skip-- <= 0) {
          results.push(row);
          if (opts.include_docs) {
            fetchDocAsynchronously(metadata, row, winningRev);
          }
          if (--limit === 0) {
            return;
          }
        }
        cursor.continue();
      }
      function onGetCursor(e) {
        docCount = api._meta.docCount;
        var cursor = e.target.result;
        if (!cursor) {
          return;
        }
        var metadata = decodeMetadata(cursor.value);
        var winningRev = metadata.winningRev;
        allDocsInner(cursor, winningRev, metadata);
      }
      function onResultsReady() {
        callback(null, {
          total_rows: docCount,
          offset: opts.skip,
          rows: results
        });
      }
      function onTxnComplete() {
        if (opts.attachments) {
          postProcessAttachments(results, opts.binary).then(onResultsReady);
        } else {
          onResultsReady();
        }
      }
      txn.oncomplete = onTxnComplete;
      cursor.onsuccess = onGetCursor;
    }
    function allDocs(opts, callback) {
      if (opts.limit === 0) {
        return callback(null, {
          total_rows: api._meta.docCount,
          offset: opts.skip,
          rows: []
        });
      }
      allDocsQuery(opts, callback);
    }
    allDocs(opts, callback);
  }
  module.exports = idbAllDocs;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("150", ["ee", "eb", "147"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var utils = req('ee');
  var createBlob = req('eb');
  var idbConstants = req('147');
  var DETECT_BLOB_SUPPORT_STORE = idbConstants.DETECT_BLOB_SUPPORT_STORE;
  function checkBlobSupport(txn, idb) {
    return new utils.Promise(function(resolve, reject) {
      var blob = createBlob([''], {type: 'image/png'});
      txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');
      txn.onabort = function(e) {
        e.preventDefault();
        e.stopPropagation();
        resolve(false);
      };
      txn.oncomplete = function() {
        var blobTxn = idb.transaction([DETECT_BLOB_SUPPORT_STORE], 'readwrite');
        var getBlobReq = blobTxn.objectStore(DETECT_BLOB_SUPPORT_STORE).get('key');
        getBlobReq.onerror = reject;
        getBlobReq.onsuccess = function(e) {
          var storedBlob = e.target.result;
          var url = URL.createObjectURL(storedBlob);
          utils.ajax({
            url: url,
            cache: true,
            binary: true
          }, function(err, res) {
            if (err && err.status === 405) {
              resolve(true);
            } else {
              resolve(!!(res && res.type === 'image/png'));
              if (err && err.status === 404) {
                utils.explain404('PouchDB is just detecting blob URL support.');
              }
            }
            URL.revokeObjectURL(url);
          });
        };
      };
    }).catch(function() {
      return false;
    });
  }
  module.exports = checkBlobSupport;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("151", ["ee", "11a", "123", "f1", "148", "147", "14e", "14f", "150", "110", "119", "ea", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var utils = req('ee');
    var isDeleted = req('11a');
    var isLocalId = req('123');
    var errors = req('f1');
    var idbUtils = req('148');
    var idbConstants = req('147');
    var idbBulkDocs = req('14e');
    var idbAllDocs = req('14f');
    var checkBlobSupport = req('150');
    var hasLocalStorage = req('110');
    var calculateWinningRev = req('119');
    var traverseRevTree = req('ea');
    var ADAPTER_VERSION = idbConstants.ADAPTER_VERSION;
    var ATTACH_AND_SEQ_STORE = idbConstants.ATTACH_AND_SEQ_STORE;
    var ATTACH_STORE = idbConstants.ATTACH_STORE;
    var BY_SEQ_STORE = idbConstants.BY_SEQ_STORE;
    var DETECT_BLOB_SUPPORT_STORE = idbConstants.DETECT_BLOB_SUPPORT_STORE;
    var DOC_STORE = idbConstants.DOC_STORE;
    var LOCAL_STORE = idbConstants.LOCAL_STORE;
    var META_STORE = idbConstants.META_STORE;
    var applyNext = idbUtils.applyNext;
    var compactRevs = idbUtils.compactRevs;
    var decodeDoc = idbUtils.decodeDoc;
    var decodeMetadata = idbUtils.decodeMetadata;
    var encodeMetadata = idbUtils.encodeMetadata;
    var fetchAttachmentsIfNecessary = idbUtils.fetchAttachmentsIfNecessary;
    var idbError = idbUtils.idbError;
    var postProcessAttachments = idbUtils.postProcessAttachments;
    var readBlobData = idbUtils.readBlobData;
    var taskQueue = idbUtils.taskQueue;
    var openTransactionSafely = idbUtils.openTransactionSafely;
    var cachedDBs = {};
    var blobSupportPromise;
    function IdbPouch(opts, callback) {
      var api = this;
      taskQueue.queue.push({
        action: function(thisCallback) {
          init(api, opts, thisCallback);
        },
        callback: callback
      });
      applyNext();
    }
    function init(api, opts, callback) {
      var dbName = opts.name;
      var idb = null;
      api._meta = null;
      function createSchema(db) {
        var docStore = db.createObjectStore(DOC_STORE, {keyPath: 'id'});
        db.createObjectStore(BY_SEQ_STORE, {autoIncrement: true}).createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
        db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
        db.createObjectStore(META_STORE, {
          keyPath: 'id',
          autoIncrement: false
        });
        db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
        docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique: false});
        db.createObjectStore(LOCAL_STORE, {keyPath: '_id'});
        var attAndSeqStore = db.createObjectStore(ATTACH_AND_SEQ_STORE, {autoIncrement: true});
        attAndSeqStore.createIndex('seq', 'seq');
        attAndSeqStore.createIndex('digestSeq', 'digestSeq', {unique: true});
      }
      function addDeletedOrLocalIndex(txn, callback) {
        var docStore = txn.objectStore(DOC_STORE);
        docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique: false});
        docStore.openCursor().onsuccess = function(event) {
          var cursor = event.target.result;
          if (cursor) {
            var metadata = cursor.value;
            var deleted = isDeleted(metadata);
            metadata.deletedOrLocal = deleted ? "1" : "0";
            docStore.put(metadata);
            cursor.continue();
          } else {
            callback();
          }
        };
      }
      function createLocalStoreSchema(db) {
        db.createObjectStore(LOCAL_STORE, {keyPath: '_id'}).createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
      }
      function migrateLocalStore(txn, cb) {
        var localStore = txn.objectStore(LOCAL_STORE);
        var docStore = txn.objectStore(DOC_STORE);
        var seqStore = txn.objectStore(BY_SEQ_STORE);
        var cursor = docStore.openCursor();
        cursor.onsuccess = function(event) {
          var cursor = event.target.result;
          if (cursor) {
            var metadata = cursor.value;
            var docId = metadata.id;
            var local = isLocalId(docId);
            var rev = calculateWinningRev(metadata);
            if (local) {
              var docIdRev = docId + "::" + rev;
              var start = docId + "::";
              var end = docId + "::~";
              var index = seqStore.index('_doc_id_rev');
              var range = IDBKeyRange.bound(start, end, false, false);
              var seqCursor = index.openCursor(range);
              seqCursor.onsuccess = function(e) {
                seqCursor = e.target.result;
                if (!seqCursor) {
                  docStore.delete(cursor.primaryKey);
                  cursor.continue();
                } else {
                  var data = seqCursor.value;
                  if (data._doc_id_rev === docIdRev) {
                    localStore.put(data);
                  }
                  seqStore.delete(seqCursor.primaryKey);
                  seqCursor.continue();
                }
              };
            } else {
              cursor.continue();
            }
          } else if (cb) {
            cb();
          }
        };
      }
      function addAttachAndSeqStore(db) {
        var attAndSeqStore = db.createObjectStore(ATTACH_AND_SEQ_STORE, {autoIncrement: true});
        attAndSeqStore.createIndex('seq', 'seq');
        attAndSeqStore.createIndex('digestSeq', 'digestSeq', {unique: true});
      }
      function migrateAttsAndSeqs(txn, callback) {
        var seqStore = txn.objectStore(BY_SEQ_STORE);
        var attStore = txn.objectStore(ATTACH_STORE);
        var attAndSeqStore = txn.objectStore(ATTACH_AND_SEQ_STORE);
        var req = attStore.count();
        req.onsuccess = function(e) {
          var count = e.target.result;
          if (!count) {
            return callback();
          }
          seqStore.openCursor().onsuccess = function(e) {
            var cursor = e.target.result;
            if (!cursor) {
              return callback();
            }
            var doc = cursor.value;
            var seq = cursor.primaryKey;
            var atts = Object.keys(doc._attachments || {});
            var digestMap = {};
            for (var j = 0; j < atts.length; j++) {
              var att = doc._attachments[atts[j]];
              digestMap[att.digest] = true;
            }
            var digests = Object.keys(digestMap);
            for (j = 0; j < digests.length; j++) {
              var digest = digests[j];
              attAndSeqStore.put({
                seq: seq,
                digestSeq: digest + '::' + seq
              });
            }
            cursor.continue();
          };
        };
      }
      function migrateMetadata(txn) {
        function decodeMetadataCompat(storedObject) {
          if (!storedObject.data) {
            storedObject.deleted = storedObject.deletedOrLocal === '1';
            return storedObject;
          }
          return decodeMetadata(storedObject);
        }
        var bySeqStore = txn.objectStore(BY_SEQ_STORE);
        var docStore = txn.objectStore(DOC_STORE);
        var cursor = docStore.openCursor();
        cursor.onsuccess = function(e) {
          var cursor = e.target.result;
          if (!cursor) {
            return;
          }
          var metadata = decodeMetadataCompat(cursor.value);
          metadata.winningRev = metadata.winningRev || calculateWinningRev(metadata);
          function fetchMetadataSeq() {
            var start = metadata.id + '::';
            var end = metadata.id + '::\uffff';
            var req = bySeqStore.index('_doc_id_rev').openCursor(IDBKeyRange.bound(start, end));
            var metadataSeq = 0;
            req.onsuccess = function(e) {
              var cursor = e.target.result;
              if (!cursor) {
                metadata.seq = metadataSeq;
                return onGetMetadataSeq();
              }
              var seq = cursor.primaryKey;
              if (seq > metadataSeq) {
                metadataSeq = seq;
              }
              cursor.continue();
            };
          }
          function onGetMetadataSeq() {
            var metadataToStore = encodeMetadata(metadata, metadata.winningRev, metadata.deleted);
            var req = docStore.put(metadataToStore);
            req.onsuccess = function() {
              cursor.continue();
            };
          }
          if (metadata.seq) {
            return onGetMetadataSeq();
          }
          fetchMetadataSeq();
        };
      }
      api.type = function() {
        return 'idb';
      };
      api._id = utils.toPromise(function(callback) {
        callback(null, api._meta.instanceId);
      });
      api._bulkDocs = function idb_bulkDocs(req, opts, callback) {
        idbBulkDocs(req, opts, api, idb, IdbPouch.Changes, callback);
      };
      api._get = function idb_get(id, opts, callback) {
        var doc;
        var metadata;
        var err;
        var txn = opts.ctx;
        if (!txn) {
          var txnResult = openTransactionSafely(idb, [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
          if (txnResult.error) {
            return callback(txnResult.error);
          }
          txn = txnResult.txn;
        }
        function finish() {
          callback(err, {
            doc: doc,
            metadata: metadata,
            ctx: txn
          });
        }
        txn.objectStore(DOC_STORE).get(id).onsuccess = function(e) {
          metadata = decodeMetadata(e.target.result);
          if (!metadata) {
            err = errors.error(errors.MISSING_DOC, 'missing');
            return finish();
          }
          if (isDeleted(metadata) && !opts.rev) {
            err = errors.error(errors.MISSING_DOC, "deleted");
            return finish();
          }
          var objectStore = txn.objectStore(BY_SEQ_STORE);
          var rev = opts.rev || metadata.winningRev;
          var key = metadata.id + '::' + rev;
          objectStore.index('_doc_id_rev').get(key).onsuccess = function(e) {
            doc = e.target.result;
            if (doc) {
              doc = decodeDoc(doc);
            }
            if (!doc) {
              err = errors.error(errors.MISSING_DOC, 'missing');
              return finish();
            }
            finish();
          };
        };
      };
      api._getAttachment = function(attachment, opts, callback) {
        var txn;
        if (opts.ctx) {
          txn = opts.ctx;
        } else {
          var txnResult = openTransactionSafely(idb, [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
          if (txnResult.error) {
            return callback(txnResult.error);
          }
          txn = txnResult.txn;
        }
        var digest = attachment.digest;
        var type = attachment.content_type;
        txn.objectStore(ATTACH_STORE).get(digest).onsuccess = function(e) {
          var body = e.target.result.body;
          readBlobData(body, type, opts.binary, function(blobData) {
            callback(null, blobData);
          });
        };
      };
      api._info = function idb_info(callback) {
        if (idb === null || !cachedDBs[dbName]) {
          var error = new Error('db isn\'t open');
          error.id = 'idbNull';
          return callback(error);
        }
        var updateSeq;
        var docCount;
        var txnResult = openTransactionSafely(idb, [BY_SEQ_STORE], 'readonly');
        if (txnResult.error) {
          return callback(txnResult.error);
        }
        var txn = txnResult.txn;
        var cursor = txn.objectStore(BY_SEQ_STORE).openCursor(null, 'prev');
        cursor.onsuccess = function(event) {
          var cursor = event.target.result;
          updateSeq = cursor ? cursor.key : 0;
          docCount = api._meta.docCount;
        };
        txn.oncomplete = function() {
          callback(null, {
            doc_count: docCount,
            update_seq: updateSeq,
            idb_attachment_format: (api._meta.blobSupport ? 'binary' : 'base64')
          });
        };
      };
      api._allDocs = function idb_allDocs(opts, callback) {
        idbAllDocs(opts, api, idb, callback);
      };
      api._changes = function(opts) {
        opts = utils.clone(opts);
        if (opts.continuous) {
          var id = dbName + ':' + utils.uuid();
          IdbPouch.Changes.addListener(dbName, id, api, opts);
          IdbPouch.Changes.notify(dbName);
          return {cancel: function() {
              IdbPouch.Changes.removeListener(dbName, id);
            }};
        }
        var docIds = opts.doc_ids && new utils.Set(opts.doc_ids);
        opts.since = opts.since || 0;
        var lastSeq = opts.since;
        var limit = 'limit' in opts ? opts.limit : -1;
        if (limit === 0) {
          limit = 1;
        }
        var returnDocs;
        if ('returnDocs' in opts) {
          returnDocs = opts.returnDocs;
        } else {
          returnDocs = true;
        }
        var results = [];
        var numResults = 0;
        var filter = utils.filterChange(opts);
        var docIdsToMetadata = new utils.Map();
        var txn;
        var bySeqStore;
        var docStore;
        var docIdRevIndex;
        function onGetCursor(cursor) {
          var doc = decodeDoc(cursor.value);
          var seq = cursor.key;
          if (docIds && !docIds.has(doc._id)) {
            return cursor.continue();
          }
          var metadata;
          function onGetMetadata() {
            if (metadata.seq !== seq) {
              return cursor.continue();
            }
            lastSeq = seq;
            if (metadata.winningRev === doc._rev) {
              return onGetWinningDoc(doc);
            }
            fetchWinningDoc();
          }
          function fetchWinningDoc() {
            var docIdRev = doc._id + '::' + metadata.winningRev;
            var req = docIdRevIndex.get(docIdRev);
            req.onsuccess = function(e) {
              onGetWinningDoc(decodeDoc(e.target.result));
            };
          }
          function onGetWinningDoc(winningDoc) {
            var change = opts.processChange(winningDoc, metadata, opts);
            change.seq = metadata.seq;
            var filtered = filter(change);
            if (typeof filtered === 'object') {
              return opts.complete(filtered);
            }
            if (filtered) {
              numResults++;
              if (returnDocs) {
                results.push(change);
              }
              if (opts.attachments && opts.include_docs) {
                fetchAttachmentsIfNecessary(winningDoc, opts, txn, function() {
                  postProcessAttachments([change], opts.binary).then(function() {
                    opts.onChange(change);
                  });
                });
              } else {
                opts.onChange(change);
              }
            }
            if (numResults !== limit) {
              cursor.continue();
            }
          }
          metadata = docIdsToMetadata.get(doc._id);
          if (metadata) {
            return onGetMetadata();
          }
          docStore.get(doc._id).onsuccess = function(event) {
            metadata = decodeMetadata(event.target.result);
            docIdsToMetadata.set(doc._id, metadata);
            onGetMetadata();
          };
        }
        function onsuccess(event) {
          var cursor = event.target.result;
          if (!cursor) {
            return;
          }
          onGetCursor(cursor);
        }
        function fetchChanges() {
          var objectStores = [DOC_STORE, BY_SEQ_STORE];
          if (opts.attachments) {
            objectStores.push(ATTACH_STORE);
          }
          var txnResult = openTransactionSafely(idb, objectStores, 'readonly');
          if (txnResult.error) {
            return opts.complete(txnResult.error);
          }
          txn = txnResult.txn;
          txn.onabort = idbError(opts.complete);
          txn.oncomplete = onTxnComplete;
          bySeqStore = txn.objectStore(BY_SEQ_STORE);
          docStore = txn.objectStore(DOC_STORE);
          docIdRevIndex = bySeqStore.index('_doc_id_rev');
          var req;
          if (opts.descending) {
            req = bySeqStore.openCursor(null, 'prev');
          } else {
            req = bySeqStore.openCursor(IDBKeyRange.lowerBound(opts.since, true));
          }
          req.onsuccess = onsuccess;
        }
        fetchChanges();
        function onTxnComplete() {
          function finish() {
            opts.complete(null, {
              results: results,
              last_seq: lastSeq
            });
          }
          if (!opts.continuous && opts.attachments) {
            postProcessAttachments(results).then(finish);
          } else {
            finish();
          }
        }
      };
      api._close = function(callback) {
        if (idb === null) {
          return callback(errors.error(errors.NOT_OPEN));
        }
        idb.close();
        delete cachedDBs[dbName];
        idb = null;
        callback();
      };
      api._getRevisionTree = function(docId, callback) {
        var txnResult = openTransactionSafely(idb, [DOC_STORE], 'readonly');
        if (txnResult.error) {
          return callback(txnResult.error);
        }
        var txn = txnResult.txn;
        var req = txn.objectStore(DOC_STORE).get(docId);
        req.onsuccess = function(event) {
          var doc = decodeMetadata(event.target.result);
          if (!doc) {
            callback(errors.error(errors.MISSING_DOC));
          } else {
            callback(null, doc.rev_tree);
          }
        };
      };
      api._doCompaction = function(docId, revs, callback) {
        var stores = [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, ATTACH_AND_SEQ_STORE];
        var txnResult = openTransactionSafely(idb, stores, 'readwrite');
        if (txnResult.error) {
          return callback(txnResult.error);
        }
        var txn = txnResult.txn;
        var docStore = txn.objectStore(DOC_STORE);
        docStore.get(docId).onsuccess = function(event) {
          var metadata = decodeMetadata(event.target.result);
          traverseRevTree(metadata.rev_tree, function(isLeaf, pos, revHash, ctx, opts) {
            var rev = pos + '-' + revHash;
            if (revs.indexOf(rev) !== -1) {
              opts.status = 'missing';
            }
          });
          compactRevs(revs, docId, txn);
          var winningRev = metadata.winningRev;
          var deleted = metadata.deleted;
          txn.objectStore(DOC_STORE).put(encodeMetadata(metadata, winningRev, deleted));
        };
        txn.onabort = idbError(callback);
        txn.oncomplete = function() {
          callback();
        };
      };
      api._getLocal = function(id, callback) {
        var txnResult = openTransactionSafely(idb, [LOCAL_STORE], 'readonly');
        if (txnResult.error) {
          return callback(txnResult.error);
        }
        var tx = txnResult.txn;
        var req = tx.objectStore(LOCAL_STORE).get(id);
        req.onerror = idbError(callback);
        req.onsuccess = function(e) {
          var doc = e.target.result;
          if (!doc) {
            callback(errors.error(errors.MISSING_DOC));
          } else {
            delete doc['_doc_id_rev'];
            callback(null, doc);
          }
        };
      };
      api._putLocal = function(doc, opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        delete doc._revisions;
        var oldRev = doc._rev;
        var id = doc._id;
        if (!oldRev) {
          doc._rev = '0-1';
        } else {
          doc._rev = '0-' + (parseInt(oldRev.split('-')[1], 10) + 1);
        }
        var tx = opts.ctx;
        var ret;
        if (!tx) {
          var txnResult = openTransactionSafely(idb, [LOCAL_STORE], 'readwrite');
          if (txnResult.error) {
            return callback(txnResult.error);
          }
          tx = txnResult.txn;
          tx.onerror = idbError(callback);
          tx.oncomplete = function() {
            if (ret) {
              callback(null, ret);
            }
          };
        }
        var oStore = tx.objectStore(LOCAL_STORE);
        var req;
        if (oldRev) {
          req = oStore.get(id);
          req.onsuccess = function(e) {
            var oldDoc = e.target.result;
            if (!oldDoc || oldDoc._rev !== oldRev) {
              callback(errors.error(errors.REV_CONFLICT));
            } else {
              var req = oStore.put(doc);
              req.onsuccess = function() {
                ret = {
                  ok: true,
                  id: doc._id,
                  rev: doc._rev
                };
                if (opts.ctx) {
                  callback(null, ret);
                }
              };
            }
          };
        } else {
          req = oStore.add(doc);
          req.onerror = function(e) {
            callback(errors.error(errors.REV_CONFLICT));
            e.preventDefault();
            e.stopPropagation();
          };
          req.onsuccess = function() {
            ret = {
              ok: true,
              id: doc._id,
              rev: doc._rev
            };
            if (opts.ctx) {
              callback(null, ret);
            }
          };
        }
      };
      api._removeLocal = function(doc, opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        var tx = opts.ctx;
        if (!tx) {
          var txnResult = openTransactionSafely(idb, [LOCAL_STORE], 'readwrite');
          if (txnResult.error) {
            return callback(txnResult.error);
          }
          tx = txnResult.txn;
          tx.oncomplete = function() {
            if (ret) {
              callback(null, ret);
            }
          };
        }
        var ret;
        var id = doc._id;
        var oStore = tx.objectStore(LOCAL_STORE);
        var req = oStore.get(id);
        req.onerror = idbError(callback);
        req.onsuccess = function(e) {
          var oldDoc = e.target.result;
          if (!oldDoc || oldDoc._rev !== doc._rev) {
            callback(errors.error(errors.MISSING_DOC));
          } else {
            oStore.delete(id);
            ret = {
              ok: true,
              id: id,
              rev: '0-0'
            };
            if (opts.ctx) {
              callback(null, ret);
            }
          }
        };
      };
      api._destroy = function(opts, callback) {
        IdbPouch.Changes.removeAllListeners(dbName);
        if (IdbPouch.openReqList[dbName] && IdbPouch.openReqList[dbName].result) {
          IdbPouch.openReqList[dbName].result.close();
          delete cachedDBs[dbName];
        }
        var req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = function() {
          if (IdbPouch.openReqList[dbName]) {
            IdbPouch.openReqList[dbName] = null;
          }
          if (hasLocalStorage() && (dbName in localStorage)) {
            delete localStorage[dbName];
          }
          callback(null, {'ok': true});
        };
        req.onerror = idbError(callback);
      };
      var cached = cachedDBs[dbName];
      if (cached) {
        idb = cached.idb;
        api._meta = cached.global;
        process.nextTick(function() {
          callback(null, api);
        });
        return;
      }
      var req;
      if (opts.storage) {
        req = indexedDB.open(dbName, {
          version: ADAPTER_VERSION,
          storage: opts.storage
        });
      } else {
        req = indexedDB.open(dbName, ADAPTER_VERSION);
      }
      if (!('openReqList' in IdbPouch)) {
        IdbPouch.openReqList = {};
      }
      IdbPouch.openReqList[dbName] = req;
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (e.oldVersion < 1) {
          return createSchema(db);
        }
        var txn = e.currentTarget.transaction;
        if (e.oldVersion < 3) {
          createLocalStoreSchema(db);
        }
        if (e.oldVersion < 4) {
          addAttachAndSeqStore(db);
        }
        var migrations = [addDeletedOrLocalIndex, migrateLocalStore, migrateAttsAndSeqs, migrateMetadata];
        var i = e.oldVersion;
        function next() {
          var migration = migrations[i - 1];
          i++;
          if (migration) {
            migration(txn, next);
          }
        }
        next();
      };
      req.onsuccess = function(e) {
        idb = e.target.result;
        idb.onversionchange = function() {
          idb.close();
          delete cachedDBs[dbName];
        };
        idb.onabort = function(e) {
          console.error('Database has a global failure', e.target.error);
          idb.close();
          delete cachedDBs[dbName];
        };
        var txn = idb.transaction([META_STORE, DETECT_BLOB_SUPPORT_STORE, DOC_STORE], 'readwrite');
        var req = txn.objectStore(META_STORE).get(META_STORE);
        var blobSupport = null;
        var docCount = null;
        var instanceId = null;
        req.onsuccess = function(e) {
          var checkSetupComplete = function() {
            if (blobSupport === null || docCount === null || instanceId === null) {
              return;
            } else {
              api._meta = {
                name: dbName,
                instanceId: instanceId,
                blobSupport: blobSupport,
                docCount: docCount
              };
              cachedDBs[dbName] = {
                idb: idb,
                global: api._meta
              };
              callback(null, api);
            }
          };
          var meta = e.target.result || {id: META_STORE};
          if (dbName + '_id' in meta) {
            instanceId = meta[dbName + '_id'];
            checkSetupComplete();
          } else {
            instanceId = utils.uuid();
            meta[dbName + '_id'] = instanceId;
            txn.objectStore(META_STORE).put(meta).onsuccess = function() {
              checkSetupComplete();
            };
          }
          if (!blobSupportPromise) {
            blobSupportPromise = checkBlobSupport(txn, idb);
          }
          blobSupportPromise.then(function(val) {
            blobSupport = val;
            checkSetupComplete();
          });
          var index = txn.objectStore(DOC_STORE).index('deletedOrLocal');
          index.count(IDBKeyRange.only('0')).onsuccess = function(e) {
            docCount = e.target.result;
            checkSetupComplete();
          };
        };
      };
      req.onerror = function(e) {
        var msg = 'Failed to open indexedDB, are you in private browsing mode?';
        console.error(msg);
        callback(errors.error(errors.IDB_ERROR, msg));
      };
    }
    IdbPouch.valid = function() {
      var isSafari = typeof openDatabase !== 'undefined' && /(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/BlackBerry/.test(navigator.platform);
      return !isSafari && typeof indexedDB !== 'undefined' && typeof IDBKeyRange !== 'undefined';
    };
    IdbPouch.Changes = new utils.Changes();
    module.exports = IdbPouch;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("152", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function decodeUtf8(str) {
    return decodeURIComponent(window.escape(str));
  }
  function hexToInt(charCode) {
    return charCode < 65 ? (charCode - 48) : (charCode - 55);
  }
  function parseHexUtf8(str, start, end) {
    var result = '';
    while (start < end) {
      result += String.fromCharCode((hexToInt(str.charCodeAt(start++)) << 4) | hexToInt(str.charCodeAt(start++)));
    }
    return result;
  }
  function parseHexUtf16(str, start, end) {
    var result = '';
    while (start < end) {
      result += String.fromCharCode((hexToInt(str.charCodeAt(start + 2)) << 12) | (hexToInt(str.charCodeAt(start + 3)) << 8) | (hexToInt(str.charCodeAt(start)) << 4) | hexToInt(str.charCodeAt(start + 1)));
      start += 4;
    }
    return result;
  }
  function parseHexString(str, encoding) {
    if (encoding === 'UTF-8') {
      return decodeUtf8(parseHexUtf8(str, 0, str.length));
    } else {
      return parseHexUtf16(str, 0, str.length);
    }
  }
  module.exports = parseHexString;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("153", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  function quote(str) {
    return "'" + str + "'";
  }
  exports.ADAPTER_VERSION = 7;
  exports.DOC_STORE = quote('document-store');
  exports.BY_SEQ_STORE = quote('by-sequence');
  exports.ATTACH_STORE = quote('attach-store');
  exports.LOCAL_STORE = quote('local-store');
  exports.META_STORE = quote('metadata-store');
  exports.ATTACH_AND_SEQ_STORE = quote('attach-seq-store');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("154", ["ee", "f1", "153"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var utils = req('ee');
  var errors = req('f1');
  var websqlConstants = req('153');
  var BY_SEQ_STORE = websqlConstants.BY_SEQ_STORE;
  var ATTACH_STORE = websqlConstants.ATTACH_STORE;
  var ATTACH_AND_SEQ_STORE = websqlConstants.ATTACH_AND_SEQ_STORE;
  function escapeBlob(str) {
    return str.replace(/\u0002/g, '\u0002\u0002').replace(/\u0001/g, '\u0001\u0002').replace(/\u0000/g, '\u0001\u0001');
  }
  function unescapeBlob(str) {
    return str.replace(/\u0001\u0001/g, '\u0000').replace(/\u0001\u0002/g, '\u0001').replace(/\u0002\u0002/g, '\u0002');
  }
  function stringifyDoc(doc) {
    delete doc._id;
    delete doc._rev;
    return JSON.stringify(doc);
  }
  function unstringifyDoc(doc, id, rev) {
    doc = JSON.parse(doc);
    doc._id = id;
    doc._rev = rev;
    return doc;
  }
  function qMarks(num) {
    var s = '(';
    while (num--) {
      s += '?';
      if (num) {
        s += ',';
      }
    }
    return s + ')';
  }
  function select(selector, table, joiner, where, orderBy) {
    return 'SELECT ' + selector + ' FROM ' + (typeof table === 'string' ? table : table.join(' JOIN ')) + (joiner ? (' ON ' + joiner) : '') + (where ? (' WHERE ' + (typeof where === 'string' ? where : where.join(' AND '))) : '') + (orderBy ? (' ORDER BY ' + orderBy) : '');
  }
  function compactRevs(revs, docId, tx) {
    if (!revs.length) {
      return;
    }
    var numDone = 0;
    var seqs = [];
    function checkDone() {
      if (++numDone === revs.length) {
        deleteOrphans();
      }
    }
    function deleteOrphans() {
      if (!seqs.length) {
        return;
      }
      var sql = 'SELECT DISTINCT digest AS digest FROM ' + ATTACH_AND_SEQ_STORE + ' WHERE seq IN ' + qMarks(seqs.length);
      tx.executeSql(sql, seqs, function(tx, res) {
        var digestsToCheck = [];
        for (var i = 0; i < res.rows.length; i++) {
          digestsToCheck.push(res.rows.item(i).digest);
        }
        if (!digestsToCheck.length) {
          return;
        }
        var sql = 'DELETE FROM ' + ATTACH_AND_SEQ_STORE + ' WHERE seq IN (' + seqs.map(function() {
          return '?';
        }).join(',') + ')';
        tx.executeSql(sql, seqs, function(tx) {
          var sql = 'SELECT digest FROM ' + ATTACH_AND_SEQ_STORE + ' WHERE digest IN (' + digestsToCheck.map(function() {
            return '?';
          }).join(',') + ')';
          tx.executeSql(sql, digestsToCheck, function(tx, res) {
            var nonOrphanedDigests = new utils.Set();
            for (var i = 0; i < res.rows.length; i++) {
              nonOrphanedDigests.add(res.rows.item(i).digest);
            }
            digestsToCheck.forEach(function(digest) {
              if (nonOrphanedDigests.has(digest)) {
                return;
              }
              tx.executeSql('DELETE FROM ' + ATTACH_AND_SEQ_STORE + ' WHERE digest=?', [digest]);
              tx.executeSql('DELETE FROM ' + ATTACH_STORE + ' WHERE digest=?', [digest]);
            });
          });
        });
      });
    }
    revs.forEach(function(rev) {
      var sql = 'SELECT seq FROM ' + BY_SEQ_STORE + ' WHERE doc_id=? AND rev=?';
      tx.executeSql(sql, [docId, rev], function(tx, res) {
        if (!res.rows.length) {
          return checkDone();
        }
        var seq = res.rows.item(0).seq;
        seqs.push(seq);
        tx.executeSql('DELETE FROM ' + BY_SEQ_STORE + ' WHERE seq=?', [seq], checkDone);
      });
    });
  }
  function websqlError(callback) {
    return function(event) {
      console.error('WebSQL threw an error', event);
      var errorNameMatch = event && event.constructor.toString().match(/function ([^\(]+)/);
      var errorName = (errorNameMatch && errorNameMatch[1]) || event.type;
      var errorReason = event.target || event.message;
      callback(errors.error(errors.WSQ_ERROR, errorReason, errorName));
    };
  }
  function getSize(opts) {
    if ('size' in opts) {
      return opts.size * 1000000;
    }
    var isAndroid = /Android/.test(window.navigator.userAgent);
    return isAndroid ? 5000000 : 1;
  }
  function createOpenDBFunction() {
    if (typeof sqlitePlugin !== 'undefined') {
      return sqlitePlugin.openDatabase.bind(sqlitePlugin);
    }
    if (typeof openDatabase !== 'undefined') {
      return function openDB(opts) {
        return openDatabase(opts.name, opts.version, opts.description, opts.size);
      };
    }
  }
  function openDBSafely(openDBFunction, opts) {
    try {
      return {db: openDBFunction(opts)};
    } catch (err) {
      return {error: err};
    }
  }
  var cachedDatabases = {};
  function openDB(opts) {
    var cachedResult = cachedDatabases[opts.name];
    if (!cachedResult) {
      var openDBFun = createOpenDBFunction();
      cachedResult = cachedDatabases[opts.name] = openDBSafely(openDBFun, opts);
      if (cachedResult.db) {
        cachedResult.db._sqlitePlugin = typeof sqlitePlugin !== 'undefined';
      }
    }
    return cachedResult;
  }
  function valid() {
    return typeof openDatabase !== 'undefined' || typeof SQLitePlugin !== 'undefined';
  }
  module.exports = {
    escapeBlob: escapeBlob,
    unescapeBlob: unescapeBlob,
    stringifyDoc: stringifyDoc,
    unstringifyDoc: unstringifyDoc,
    qMarks: qMarks,
    select: select,
    compactRevs: compactRevs,
    websqlError: websqlError,
    getSize: getSize,
    openDB: openDB,
    valid: valid
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("155", ["ee", "f1", "149", "123", "14d", "154", "153", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var utils = req('ee');
    var errors = req('f1');
    var preprocessAttachments = req('149');
    var isLocalId = req('123');
    var processDocs = req('14d');
    var websqlUtils = req('154');
    var websqlConstants = req('153');
    var DOC_STORE = websqlConstants.DOC_STORE;
    var BY_SEQ_STORE = websqlConstants.BY_SEQ_STORE;
    var ATTACH_STORE = websqlConstants.ATTACH_STORE;
    var ATTACH_AND_SEQ_STORE = websqlConstants.ATTACH_AND_SEQ_STORE;
    var select = websqlUtils.select;
    var stringifyDoc = websqlUtils.stringifyDoc;
    var compactRevs = websqlUtils.compactRevs;
    var unknownError = websqlUtils.websqlError;
    function websqlBulkDocs(req, opts, api, db, Changes, callback) {
      var newEdits = opts.new_edits;
      var userDocs = req.docs;
      var docInfos = userDocs.map(function(doc) {
        if (doc._id && isLocalId(doc._id)) {
          return doc;
        }
        var newDoc = utils.parseDoc(doc, newEdits);
        return newDoc;
      });
      var docInfoErrors = docInfos.filter(function(docInfo) {
        return docInfo.error;
      });
      if (docInfoErrors.length) {
        return callback(docInfoErrors[0]);
      }
      var tx;
      var results = new Array(docInfos.length);
      var fetchedDocs = new utils.Map();
      var preconditionErrored;
      function complete() {
        if (preconditionErrored) {
          return callback(preconditionErrored);
        }
        Changes.notify(api._name);
        api._docCount = -1;
        callback(null, results);
      }
      function verifyAttachment(digest, callback) {
        var sql = 'SELECT count(*) as cnt FROM ' + ATTACH_STORE + ' WHERE digest=?';
        tx.executeSql(sql, [digest], function(tx, result) {
          if (result.rows.item(0).cnt === 0) {
            var err = errors.error(errors.MISSING_STUB, 'unknown stub attachment with digest ' + digest);
            callback(err);
          } else {
            callback();
          }
        });
      }
      function verifyAttachments(finish) {
        var digests = [];
        docInfos.forEach(function(docInfo) {
          if (docInfo.data && docInfo.data._attachments) {
            Object.keys(docInfo.data._attachments).forEach(function(filename) {
              var att = docInfo.data._attachments[filename];
              if (att.stub) {
                digests.push(att.digest);
              }
            });
          }
        });
        if (!digests.length) {
          return finish();
        }
        var numDone = 0;
        var err;
        function checkDone() {
          if (++numDone === digests.length) {
            finish(err);
          }
        }
        digests.forEach(function(digest) {
          verifyAttachment(digest, function(attErr) {
            if (attErr && !err) {
              err = attErr;
            }
            checkDone();
          });
        });
      }
      function writeDoc(docInfo, winningRev, winningRevIsDeleted, newRevIsDeleted, isUpdate, delta, resultsIdx, callback) {
        function finish() {
          var data = docInfo.data;
          var deletedInt = newRevIsDeleted ? 1 : 0;
          var id = data._id;
          var rev = data._rev;
          var json = stringifyDoc(data);
          var sql = 'INSERT INTO ' + BY_SEQ_STORE + ' (doc_id, rev, json, deleted) VALUES (?, ?, ?, ?);';
          var sqlArgs = [id, rev, json, deletedInt];
          function insertAttachmentMappings(seq, callback) {
            var attsAdded = 0;
            var attsToAdd = Object.keys(data._attachments || {});
            if (!attsToAdd.length) {
              return callback();
            }
            function checkDone() {
              if (++attsAdded === attsToAdd.length) {
                callback();
              }
              return false;
            }
            function add(att) {
              var sql = 'INSERT INTO ' + ATTACH_AND_SEQ_STORE + ' (digest, seq) VALUES (?,?)';
              var sqlArgs = [data._attachments[att].digest, seq];
              tx.executeSql(sql, sqlArgs, checkDone, checkDone);
            }
            for (var i = 0; i < attsToAdd.length; i++) {
              add(attsToAdd[i]);
            }
          }
          tx.executeSql(sql, sqlArgs, function(tx, result) {
            var seq = result.insertId;
            insertAttachmentMappings(seq, function() {
              dataWritten(tx, seq);
            });
          }, function() {
            var fetchSql = select('seq', BY_SEQ_STORE, null, 'doc_id=? AND rev=?');
            tx.executeSql(fetchSql, [id, rev], function(tx, res) {
              var seq = res.rows.item(0).seq;
              var sql = 'UPDATE ' + BY_SEQ_STORE + ' SET json=?, deleted=? WHERE doc_id=? AND rev=?;';
              var sqlArgs = [json, deletedInt, id, rev];
              tx.executeSql(sql, sqlArgs, function(tx) {
                insertAttachmentMappings(seq, function() {
                  dataWritten(tx, seq);
                });
              });
            });
            return false;
          });
        }
        function collectResults(attachmentErr) {
          if (!err) {
            if (attachmentErr) {
              err = attachmentErr;
              callback(err);
            } else if (recv === attachments.length) {
              finish();
            }
          }
        }
        var err = null;
        var recv = 0;
        docInfo.data._id = docInfo.metadata.id;
        docInfo.data._rev = docInfo.metadata.rev;
        var attachments = Object.keys(docInfo.data._attachments || {});
        if (newRevIsDeleted) {
          docInfo.data._deleted = true;
        }
        function attachmentSaved(err) {
          recv++;
          collectResults(err);
        }
        attachments.forEach(function(key) {
          var att = docInfo.data._attachments[key];
          if (!att.stub) {
            var data = att.data;
            delete att.data;
            var digest = att.digest;
            saveAttachment(digest, data, attachmentSaved);
          } else {
            recv++;
            collectResults();
          }
        });
        if (!attachments.length) {
          finish();
        }
        function autoCompact() {
          if (!isUpdate || !api.auto_compaction) {
            return;
          }
          var id = docInfo.metadata.id;
          var revsToDelete = utils.compactTree(docInfo.metadata);
          compactRevs(revsToDelete, id, tx);
        }
        function dataWritten(tx, seq) {
          autoCompact();
          docInfo.metadata.seq = seq;
          delete docInfo.metadata.rev;
          var sql = isUpdate ? 'UPDATE ' + DOC_STORE + ' SET json=?, max_seq=?, winningseq=' + '(SELECT seq FROM ' + BY_SEQ_STORE + ' WHERE doc_id=' + DOC_STORE + '.id AND rev=?) WHERE id=?' : 'INSERT INTO ' + DOC_STORE + ' (id, winningseq, max_seq, json) VALUES (?,?,?,?);';
          var metadataStr = utils.safeJsonStringify(docInfo.metadata);
          var id = docInfo.metadata.id;
          var params = isUpdate ? [metadataStr, seq, winningRev, id] : [id, seq, seq, metadataStr];
          tx.executeSql(sql, params, function() {
            results[resultsIdx] = {
              ok: true,
              id: docInfo.metadata.id,
              rev: winningRev
            };
            fetchedDocs.set(id, docInfo.metadata);
            callback();
          });
        }
      }
      function websqlProcessDocs() {
        processDocs(docInfos, api, fetchedDocs, tx, results, writeDoc, opts);
      }
      function fetchExistingDocs(callback) {
        if (!docInfos.length) {
          return callback();
        }
        var numFetched = 0;
        function checkDone() {
          if (++numFetched === docInfos.length) {
            callback();
          }
        }
        docInfos.forEach(function(docInfo) {
          if (docInfo._id && isLocalId(docInfo._id)) {
            return checkDone();
          }
          var id = docInfo.metadata.id;
          tx.executeSql('SELECT json FROM ' + DOC_STORE + ' WHERE id = ?', [id], function(tx, result) {
            if (result.rows.length) {
              var metadata = utils.safeJsonParse(result.rows.item(0).json);
              fetchedDocs.set(id, metadata);
            }
            checkDone();
          });
        });
      }
      function saveAttachment(digest, data, callback) {
        var sql = 'SELECT digest FROM ' + ATTACH_STORE + ' WHERE digest=?';
        tx.executeSql(sql, [digest], function(tx, result) {
          if (result.rows.length) {
            return callback();
          }
          sql = 'INSERT INTO ' + ATTACH_STORE + ' (digest, body, escaped) VALUES (?,?,1)';
          tx.executeSql(sql, [digest, websqlUtils.escapeBlob(data)], function() {
            callback();
          }, function() {
            callback();
            return false;
          });
        });
      }
      preprocessAttachments(docInfos, 'binary', function(err) {
        if (err) {
          return callback(err);
        }
        db.transaction(function(txn) {
          tx = txn;
          verifyAttachments(function(err) {
            if (err) {
              preconditionErrored = err;
            } else {
              fetchExistingDocs(websqlProcessDocs);
            }
          });
        }, unknownError(callback), complete);
      });
    }
    module.exports = websqlBulkDocs;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("156", ["ee", "11a", "123", "f1", "152", "105", "110", "120", "ea", "153", "154", "155", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var utils = req('ee');
    var isDeleted = req('11a');
    var isLocalId = req('123');
    var errors = req('f1');
    var parseHexString = req('152');
    var binStringToBlob = req('105');
    var hasLocalStorage = req('110');
    var collectConflicts = req('120');
    var traverseRevTree = req('ea');
    var websqlConstants = req('153');
    var websqlUtils = req('154');
    var websqlBulkDocs = req('155');
    var ADAPTER_VERSION = websqlConstants.ADAPTER_VERSION;
    var DOC_STORE = websqlConstants.DOC_STORE;
    var BY_SEQ_STORE = websqlConstants.BY_SEQ_STORE;
    var ATTACH_STORE = websqlConstants.ATTACH_STORE;
    var LOCAL_STORE = websqlConstants.LOCAL_STORE;
    var META_STORE = websqlConstants.META_STORE;
    var ATTACH_AND_SEQ_STORE = websqlConstants.ATTACH_AND_SEQ_STORE;
    var qMarks = websqlUtils.qMarks;
    var stringifyDoc = websqlUtils.stringifyDoc;
    var unstringifyDoc = websqlUtils.unstringifyDoc;
    var select = websqlUtils.select;
    var compactRevs = websqlUtils.compactRevs;
    var websqlError = websqlUtils.websqlError;
    var getSize = websqlUtils.getSize;
    var openDB = websqlUtils.openDB;
    function fetchAttachmentsIfNecessary(doc, opts, api, txn, cb) {
      var attachments = Object.keys(doc._attachments || {});
      if (!attachments.length) {
        return cb && cb();
      }
      var numDone = 0;
      function checkDone() {
        if (++numDone === attachments.length && cb) {
          cb();
        }
      }
      function fetchAttachment(doc, att) {
        var attObj = doc._attachments[att];
        var attOpts = {
          binary: opts.binary,
          ctx: txn
        };
        api._getAttachment(attObj, attOpts, function(_, data) {
          doc._attachments[att] = utils.extend(utils.pick(attObj, ['digest', 'content_type']), {data: data});
          checkDone();
        });
      }
      attachments.forEach(function(att) {
        if (opts.attachments && opts.include_docs) {
          fetchAttachment(doc, att);
        } else {
          doc._attachments[att].stub = true;
          checkDone();
        }
      });
    }
    var POUCH_VERSION = 1;
    var BY_SEQ_STORE_DELETED_INDEX_SQL = 'CREATE INDEX IF NOT EXISTS \'by-seq-deleted-idx\' ON ' + BY_SEQ_STORE + ' (seq, deleted)';
    var BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL = 'CREATE UNIQUE INDEX IF NOT EXISTS \'by-seq-doc-id-rev\' ON ' + BY_SEQ_STORE + ' (doc_id, rev)';
    var DOC_STORE_WINNINGSEQ_INDEX_SQL = 'CREATE INDEX IF NOT EXISTS \'doc-winningseq-idx\' ON ' + DOC_STORE + ' (winningseq)';
    var ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL = 'CREATE INDEX IF NOT EXISTS \'attach-seq-seq-idx\' ON ' + ATTACH_AND_SEQ_STORE + ' (seq)';
    var ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL = 'CREATE UNIQUE INDEX IF NOT EXISTS \'attach-seq-digest-idx\' ON ' + ATTACH_AND_SEQ_STORE + ' (digest, seq)';
    var DOC_STORE_AND_BY_SEQ_JOINER = BY_SEQ_STORE + '.seq = ' + DOC_STORE + '.winningseq';
    var SELECT_DOCS = BY_SEQ_STORE + '.seq AS seq, ' + BY_SEQ_STORE + '.deleted AS deleted, ' + BY_SEQ_STORE + '.json AS data, ' + BY_SEQ_STORE + '.rev AS rev, ' + DOC_STORE + '.json AS metadata';
    function WebSqlPouch(opts, callback) {
      var api = this;
      var instanceId = null;
      var size = getSize(opts);
      var idRequests = [];
      var encoding;
      api._docCount = -1;
      api._name = opts.name;
      var openDBResult = openDB({
        name: api._name,
        version: POUCH_VERSION,
        description: api._name,
        size: size,
        location: opts.location,
        createFromLocation: opts.createFromLocation,
        androidDatabaseImplementation: opts.androidDatabaseImplementation
      });
      if (openDBResult.error) {
        return websqlError(callback)(openDBResult.error);
      }
      var db = openDBResult.db;
      if (typeof db.readTransaction !== 'function') {
        db.readTransaction = db.transaction;
      }
      function dbCreated() {
        if (hasLocalStorage()) {
          window.localStorage['_pouch__websqldb_' + api._name] = true;
        }
        callback(null, api);
      }
      function runMigration2(tx, callback) {
        tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);
        tx.executeSql('ALTER TABLE ' + BY_SEQ_STORE + ' ADD COLUMN deleted TINYINT(1) DEFAULT 0', [], function() {
          tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
          tx.executeSql('ALTER TABLE ' + DOC_STORE + ' ADD COLUMN local TINYINT(1) DEFAULT 0', [], function() {
            tx.executeSql('CREATE INDEX IF NOT EXISTS \'doc-store-local-idx\' ON ' + DOC_STORE + ' (local, id)');
            var sql = 'SELECT ' + DOC_STORE + '.winningseq AS seq, ' + DOC_STORE + '.json AS metadata FROM ' + BY_SEQ_STORE + ' JOIN ' + DOC_STORE + ' ON ' + BY_SEQ_STORE + '.seq = ' + DOC_STORE + '.winningseq';
            tx.executeSql(sql, [], function(tx, result) {
              var deleted = [];
              var local = [];
              for (var i = 0; i < result.rows.length; i++) {
                var item = result.rows.item(i);
                var seq = item.seq;
                var metadata = JSON.parse(item.metadata);
                if (isDeleted(metadata)) {
                  deleted.push(seq);
                }
                if (isLocalId(metadata.id)) {
                  local.push(metadata.id);
                }
              }
              tx.executeSql('UPDATE ' + DOC_STORE + 'SET local = 1 WHERE id IN ' + qMarks(local.length), local, function() {
                tx.executeSql('UPDATE ' + BY_SEQ_STORE + ' SET deleted = 1 WHERE seq IN ' + qMarks(deleted.length), deleted, callback);
              });
            });
          });
        });
      }
      function runMigration3(tx, callback) {
        var local = 'CREATE TABLE IF NOT EXISTS ' + LOCAL_STORE + ' (id UNIQUE, rev, json)';
        tx.executeSql(local, [], function() {
          var sql = 'SELECT ' + DOC_STORE + '.id AS id, ' + BY_SEQ_STORE + '.json AS data ' + 'FROM ' + BY_SEQ_STORE + ' JOIN ' + DOC_STORE + ' ON ' + BY_SEQ_STORE + '.seq = ' + DOC_STORE + '.winningseq WHERE local = 1';
          tx.executeSql(sql, [], function(tx, res) {
            var rows = [];
            for (var i = 0; i < res.rows.length; i++) {
              rows.push(res.rows.item(i));
            }
            function doNext() {
              if (!rows.length) {
                return callback(tx);
              }
              var row = rows.shift();
              var rev = JSON.parse(row.data)._rev;
              tx.executeSql('INSERT INTO ' + LOCAL_STORE + ' (id, rev, json) VALUES (?,?,?)', [row.id, rev, row.data], function(tx) {
                tx.executeSql('DELETE FROM ' + DOC_STORE + ' WHERE id=?', [row.id], function(tx) {
                  tx.executeSql('DELETE FROM ' + BY_SEQ_STORE + ' WHERE seq=?', [row.seq], function() {
                    doNext();
                  });
                });
              });
            }
            doNext();
          });
        });
      }
      function runMigration4(tx, callback) {
        function updateRows(rows) {
          function doNext() {
            if (!rows.length) {
              return callback(tx);
            }
            var row = rows.shift();
            var doc_id_rev = parseHexString(row.hex, encoding);
            var idx = doc_id_rev.lastIndexOf('::');
            var doc_id = doc_id_rev.substring(0, idx);
            var rev = doc_id_rev.substring(idx + 2);
            var sql = 'UPDATE ' + BY_SEQ_STORE + ' SET doc_id=?, rev=? WHERE doc_id_rev=?';
            tx.executeSql(sql, [doc_id, rev, doc_id_rev], function() {
              doNext();
            });
          }
          doNext();
        }
        var sql = 'ALTER TABLE ' + BY_SEQ_STORE + ' ADD COLUMN doc_id';
        tx.executeSql(sql, [], function(tx) {
          var sql = 'ALTER TABLE ' + BY_SEQ_STORE + ' ADD COLUMN rev';
          tx.executeSql(sql, [], function(tx) {
            tx.executeSql(BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL, [], function(tx) {
              var sql = 'SELECT hex(doc_id_rev) as hex FROM ' + BY_SEQ_STORE;
              tx.executeSql(sql, [], function(tx, res) {
                var rows = [];
                for (var i = 0; i < res.rows.length; i++) {
                  rows.push(res.rows.item(i));
                }
                updateRows(rows);
              });
            });
          });
        });
      }
      function runMigration5(tx, callback) {
        function migrateAttsAndSeqs(tx) {
          var sql = 'SELECT COUNT(*) AS cnt FROM ' + ATTACH_STORE;
          tx.executeSql(sql, [], function(tx, res) {
            var count = res.rows.item(0).cnt;
            if (!count) {
              return callback(tx);
            }
            var offset = 0;
            var pageSize = 10;
            function nextPage() {
              var sql = select(SELECT_DOCS + ', ' + DOC_STORE + '.id AS id', [DOC_STORE, BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, null, DOC_STORE + '.id ');
              sql += ' LIMIT ' + pageSize + ' OFFSET ' + offset;
              offset += pageSize;
              tx.executeSql(sql, [], function(tx, res) {
                if (!res.rows.length) {
                  return callback(tx);
                }
                var digestSeqs = {};
                function addDigestSeq(digest, seq) {
                  var seqs = digestSeqs[digest] = (digestSeqs[digest] || []);
                  if (seqs.indexOf(seq) === -1) {
                    seqs.push(seq);
                  }
                }
                for (var i = 0; i < res.rows.length; i++) {
                  var row = res.rows.item(i);
                  var doc = unstringifyDoc(row.data, row.id, row.rev);
                  var atts = Object.keys(doc._attachments || {});
                  for (var j = 0; j < atts.length; j++) {
                    var att = doc._attachments[atts[j]];
                    addDigestSeq(att.digest, row.seq);
                  }
                }
                var digestSeqPairs = [];
                Object.keys(digestSeqs).forEach(function(digest) {
                  var seqs = digestSeqs[digest];
                  seqs.forEach(function(seq) {
                    digestSeqPairs.push([digest, seq]);
                  });
                });
                if (!digestSeqPairs.length) {
                  return nextPage();
                }
                var numDone = 0;
                digestSeqPairs.forEach(function(pair) {
                  var sql = 'INSERT INTO ' + ATTACH_AND_SEQ_STORE + ' (digest, seq) VALUES (?,?)';
                  tx.executeSql(sql, pair, function() {
                    if (++numDone === digestSeqPairs.length) {
                      nextPage();
                    }
                  });
                });
              });
            }
            nextPage();
          });
        }
        var attachAndRev = 'CREATE TABLE IF NOT EXISTS ' + ATTACH_AND_SEQ_STORE + ' (digest, seq INTEGER)';
        tx.executeSql(attachAndRev, [], function(tx) {
          tx.executeSql(ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL, [], function(tx) {
            tx.executeSql(ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL, [], migrateAttsAndSeqs);
          });
        });
      }
      function runMigration6(tx, callback) {
        var sql = 'ALTER TABLE ' + ATTACH_STORE + ' ADD COLUMN escaped TINYINT(1) DEFAULT 0';
        tx.executeSql(sql, [], callback);
      }
      function runMigration7(tx, callback) {
        var sql = 'ALTER TABLE ' + DOC_STORE + ' ADD COLUMN max_seq INTEGER';
        tx.executeSql(sql, [], function(tx) {
          var sql = 'UPDATE ' + DOC_STORE + ' SET max_seq=(SELECT MAX(seq) FROM ' + BY_SEQ_STORE + ' WHERE doc_id=id)';
          tx.executeSql(sql, [], function(tx) {
            var sql = 'CREATE UNIQUE INDEX IF NOT EXISTS \'doc-max-seq-idx\' ON ' + DOC_STORE + ' (max_seq)';
            tx.executeSql(sql, [], callback);
          });
        });
      }
      function checkEncoding(tx, cb) {
        tx.executeSql('SELECT HEX("a") AS hex', [], function(tx, res) {
          var hex = res.rows.item(0).hex;
          encoding = hex.length === 2 ? 'UTF-8' : 'UTF-16';
          cb();
        });
      }
      function onGetInstanceId() {
        while (idRequests.length > 0) {
          var idCallback = idRequests.pop();
          idCallback(null, instanceId);
        }
      }
      function onGetVersion(tx, dbVersion) {
        if (dbVersion === 0) {
          var meta = 'CREATE TABLE IF NOT EXISTS ' + META_STORE + ' (dbid, db_version INTEGER)';
          var attach = 'CREATE TABLE IF NOT EXISTS ' + ATTACH_STORE + ' (digest UNIQUE, escaped TINYINT(1), body BLOB)';
          var attachAndRev = 'CREATE TABLE IF NOT EXISTS ' + ATTACH_AND_SEQ_STORE + ' (digest, seq INTEGER)';
          var doc = 'CREATE TABLE IF NOT EXISTS ' + DOC_STORE + ' (id unique, json, winningseq, max_seq INTEGER UNIQUE)';
          var seq = 'CREATE TABLE IF NOT EXISTS ' + BY_SEQ_STORE + ' (seq INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, ' + 'json, deleted TINYINT(1), doc_id, rev)';
          var local = 'CREATE TABLE IF NOT EXISTS ' + LOCAL_STORE + ' (id UNIQUE, rev, json)';
          tx.executeSql(attach);
          tx.executeSql(local);
          tx.executeSql(attachAndRev, [], function() {
            tx.executeSql(ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL);
            tx.executeSql(ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL);
          });
          tx.executeSql(doc, [], function() {
            tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);
            tx.executeSql(seq, [], function() {
              tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
              tx.executeSql(BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL);
              tx.executeSql(meta, [], function() {
                var initSeq = 'INSERT INTO ' + META_STORE + ' (db_version, dbid) VALUES (?,?)';
                instanceId = utils.uuid();
                var initSeqArgs = [ADAPTER_VERSION, instanceId];
                tx.executeSql(initSeq, initSeqArgs, function() {
                  onGetInstanceId();
                });
              });
            });
          });
        } else {
          var setupDone = function() {
            var migrated = dbVersion < ADAPTER_VERSION;
            if (migrated) {
              tx.executeSql('UPDATE ' + META_STORE + ' SET db_version = ' + ADAPTER_VERSION);
            }
            var sql = 'SELECT dbid FROM ' + META_STORE;
            tx.executeSql(sql, [], function(tx, result) {
              instanceId = result.rows.item(0).dbid;
              onGetInstanceId();
            });
          };
          var tasks = [runMigration2, runMigration3, runMigration4, runMigration5, runMigration6, runMigration7, setupDone];
          var i = dbVersion;
          var nextMigration = function(tx) {
            tasks[i - 1](tx, nextMigration);
            i++;
          };
          nextMigration(tx);
        }
      }
      function setup() {
        db.transaction(function(tx) {
          checkEncoding(tx, function() {
            fetchVersion(tx);
          });
        }, websqlError(callback), dbCreated);
      }
      function fetchVersion(tx) {
        var sql = 'SELECT sql FROM sqlite_master WHERE tbl_name = ' + META_STORE;
        tx.executeSql(sql, [], function(tx, result) {
          if (!result.rows.length) {
            onGetVersion(tx, 0);
          } else if (!/db_version/.test(result.rows.item(0).sql)) {
            tx.executeSql('ALTER TABLE ' + META_STORE + ' ADD COLUMN db_version INTEGER', [], function() {
              onGetVersion(tx, 1);
            });
          } else {
            tx.executeSql('SELECT db_version FROM ' + META_STORE, [], function(tx, result) {
              var dbVersion = result.rows.item(0).db_version;
              onGetVersion(tx, dbVersion);
            });
          }
        });
      }
      if (utils.isCordova()) {
        window.addEventListener(api._name + '_pouch', function cordova_init() {
          window.removeEventListener(api._name + '_pouch', cordova_init, false);
          setup();
        }, false);
      } else {
        setup();
      }
      api.type = function() {
        return 'websql';
      };
      api._id = utils.toPromise(function(callback) {
        callback(null, instanceId);
      });
      api._info = function(callback) {
        db.readTransaction(function(tx) {
          countDocs(tx, function(docCount) {
            var sql = 'SELECT MAX(seq) AS seq FROM ' + BY_SEQ_STORE;
            tx.executeSql(sql, [], function(tx, res) {
              var updateSeq = res.rows.item(0).seq || 0;
              callback(null, {
                doc_count: docCount,
                update_seq: updateSeq,
                sqlite_plugin: db._sqlitePlugin,
                websql_encoding: encoding
              });
            });
          });
        }, websqlError(callback));
      };
      api._bulkDocs = function(req, opts, callback) {
        websqlBulkDocs(req, opts, api, db, WebSqlPouch.Changes, callback);
      };
      api._get = function(id, opts, callback) {
        var doc;
        var metadata;
        var err;
        var tx = opts.ctx;
        if (!tx) {
          return db.readTransaction(function(txn) {
            api._get(id, utils.extend({ctx: txn}, opts), callback);
          });
        }
        function finish() {
          callback(err, {
            doc: doc,
            metadata: metadata,
            ctx: tx
          });
        }
        var sql;
        var sqlArgs;
        if (opts.rev) {
          sql = select(SELECT_DOCS, [DOC_STORE, BY_SEQ_STORE], DOC_STORE + '.id=' + BY_SEQ_STORE + '.doc_id', [BY_SEQ_STORE + '.doc_id=?', BY_SEQ_STORE + '.rev=?']);
          sqlArgs = [id, opts.rev];
        } else {
          sql = select(SELECT_DOCS, [DOC_STORE, BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, DOC_STORE + '.id=?');
          sqlArgs = [id];
        }
        tx.executeSql(sql, sqlArgs, function(a, results) {
          if (!results.rows.length) {
            err = errors.error(errors.MISSING_DOC, 'missing');
            return finish();
          }
          var item = results.rows.item(0);
          metadata = utils.safeJsonParse(item.metadata);
          if (item.deleted && !opts.rev) {
            err = errors.error(errors.MISSING_DOC, 'deleted');
            return finish();
          }
          doc = unstringifyDoc(item.data, metadata.id, item.rev);
          finish();
        });
      };
      function countDocs(tx, callback) {
        if (api._docCount !== -1) {
          return callback(api._docCount);
        }
        var sql = select('COUNT(' + DOC_STORE + '.id) AS \'num\'', [DOC_STORE, BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, BY_SEQ_STORE + '.deleted=0');
        tx.executeSql(sql, [], function(tx, result) {
          api._docCount = result.rows.item(0).num;
          callback(api._docCount);
        });
      }
      api._allDocs = function(opts, callback) {
        var results = [];
        var totalRows;
        var start = 'startkey' in opts ? opts.startkey : false;
        var end = 'endkey' in opts ? opts.endkey : false;
        var key = 'key' in opts ? opts.key : false;
        var descending = 'descending' in opts ? opts.descending : false;
        var limit = 'limit' in opts ? opts.limit : -1;
        var offset = 'skip' in opts ? opts.skip : 0;
        var inclusiveEnd = opts.inclusive_end !== false;
        var sqlArgs = [];
        var criteria = [];
        if (key !== false) {
          criteria.push(DOC_STORE + '.id = ?');
          sqlArgs.push(key);
        } else if (start !== false || end !== false) {
          if (start !== false) {
            criteria.push(DOC_STORE + '.id ' + (descending ? '<=' : '>=') + ' ?');
            sqlArgs.push(start);
          }
          if (end !== false) {
            var comparator = descending ? '>' : '<';
            if (inclusiveEnd) {
              comparator += '=';
            }
            criteria.push(DOC_STORE + '.id ' + comparator + ' ?');
            sqlArgs.push(end);
          }
          if (key !== false) {
            criteria.push(DOC_STORE + '.id = ?');
            sqlArgs.push(key);
          }
        }
        if (opts.deleted !== 'ok') {
          criteria.push(BY_SEQ_STORE + '.deleted = 0');
        }
        db.readTransaction(function(tx) {
          countDocs(tx, function(count) {
            totalRows = count;
            if (limit === 0) {
              return;
            }
            var sql = select(SELECT_DOCS, [DOC_STORE, BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, criteria, DOC_STORE + '.id ' + (descending ? 'DESC' : 'ASC'));
            sql += ' LIMIT ' + limit + ' OFFSET ' + offset;
            tx.executeSql(sql, sqlArgs, function(tx, result) {
              for (var i = 0,
                  l = result.rows.length; i < l; i++) {
                var item = result.rows.item(i);
                var metadata = utils.safeJsonParse(item.metadata);
                var id = metadata.id;
                var data = unstringifyDoc(item.data, id, item.rev);
                var winningRev = data._rev;
                var doc = {
                  id: id,
                  key: id,
                  value: {rev: winningRev}
                };
                if (opts.include_docs) {
                  doc.doc = data;
                  doc.doc._rev = winningRev;
                  if (opts.conflicts) {
                    doc.doc._conflicts = collectConflicts(metadata);
                  }
                  fetchAttachmentsIfNecessary(doc.doc, opts, api, tx);
                }
                if (item.deleted) {
                  if (opts.deleted === 'ok') {
                    doc.value.deleted = true;
                    doc.doc = null;
                  } else {
                    continue;
                  }
                }
                results.push(doc);
              }
            });
          });
        }, websqlError(callback), function() {
          callback(null, {
            total_rows: totalRows,
            offset: opts.skip,
            rows: results
          });
        });
      };
      api._changes = function(opts) {
        opts = utils.clone(opts);
        if (opts.continuous) {
          var id = api._name + ':' + utils.uuid();
          WebSqlPouch.Changes.addListener(api._name, id, api, opts);
          WebSqlPouch.Changes.notify(api._name);
          return {cancel: function() {
              WebSqlPouch.Changes.removeListener(api._name, id);
            }};
        }
        var descending = opts.descending;
        opts.since = opts.since && !descending ? opts.since : 0;
        var limit = 'limit' in opts ? opts.limit : -1;
        if (limit === 0) {
          limit = 1;
        }
        var returnDocs;
        if ('returnDocs' in opts) {
          returnDocs = opts.returnDocs;
        } else {
          returnDocs = true;
        }
        var results = [];
        var numResults = 0;
        function fetchChanges() {
          var selectStmt = DOC_STORE + '.json AS metadata, ' + DOC_STORE + '.max_seq AS maxSeq, ' + BY_SEQ_STORE + '.json AS winningDoc, ' + BY_SEQ_STORE + '.rev AS winningRev ';
          var from = DOC_STORE + ' JOIN ' + BY_SEQ_STORE;
          var joiner = DOC_STORE + '.id=' + BY_SEQ_STORE + '.doc_id' + ' AND ' + DOC_STORE + '.winningseq=' + BY_SEQ_STORE + '.seq';
          var criteria = ['maxSeq > ?'];
          var sqlArgs = [opts.since];
          if (opts.doc_ids) {
            criteria.push(DOC_STORE + '.id IN ' + qMarks(opts.doc_ids.length));
            sqlArgs = sqlArgs.concat(opts.doc_ids);
          }
          var orderBy = 'maxSeq ' + (descending ? 'DESC' : 'ASC');
          var sql = select(selectStmt, from, joiner, criteria, orderBy);
          var filter = utils.filterChange(opts);
          if (!opts.view && !opts.filter) {
            sql += ' LIMIT ' + limit;
          }
          var lastSeq = opts.since || 0;
          db.readTransaction(function(tx) {
            tx.executeSql(sql, sqlArgs, function(tx, result) {
              function reportChange(change) {
                return function() {
                  opts.onChange(change);
                };
              }
              for (var i = 0,
                  l = result.rows.length; i < l; i++) {
                var item = result.rows.item(i);
                var metadata = utils.safeJsonParse(item.metadata);
                lastSeq = item.maxSeq;
                var doc = unstringifyDoc(item.winningDoc, metadata.id, item.winningRev);
                var change = opts.processChange(doc, metadata, opts);
                change.seq = item.maxSeq;
                var filtered = filter(change);
                if (typeof filtered === 'object') {
                  return opts.complete(filtered);
                }
                if (filtered) {
                  numResults++;
                  if (returnDocs) {
                    results.push(change);
                  }
                  if (opts.attachments && opts.include_docs) {
                    fetchAttachmentsIfNecessary(doc, opts, api, tx, reportChange(change));
                  } else {
                    reportChange(change)();
                  }
                }
                if (numResults === limit) {
                  break;
                }
              }
            });
          }, websqlError(opts.complete), function() {
            if (!opts.continuous) {
              opts.complete(null, {
                results: results,
                last_seq: lastSeq
              });
            }
          });
        }
        fetchChanges();
      };
      api._close = function(callback) {
        callback();
      };
      api._getAttachment = function(attachment, opts, callback) {
        var res;
        var tx = opts.ctx;
        var digest = attachment.digest;
        var type = attachment.content_type;
        var sql = 'SELECT escaped, ' + 'CASE WHEN escaped = 1 THEN body ELSE HEX(body) END AS body FROM ' + ATTACH_STORE + ' WHERE digest=?';
        tx.executeSql(sql, [digest], function(tx, result) {
          var item = result.rows.item(0);
          var data = item.escaped ? websqlUtils.unescapeBlob(item.body) : parseHexString(item.body, encoding);
          if (opts.binary) {
            res = binStringToBlob(data, type);
          } else {
            res = utils.btoa(data);
          }
          callback(null, res);
        });
      };
      api._getRevisionTree = function(docId, callback) {
        db.readTransaction(function(tx) {
          var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
          tx.executeSql(sql, [docId], function(tx, result) {
            if (!result.rows.length) {
              callback(errors.error(errors.MISSING_DOC));
            } else {
              var data = utils.safeJsonParse(result.rows.item(0).metadata);
              callback(null, data.rev_tree);
            }
          });
        });
      };
      api._doCompaction = function(docId, revs, callback) {
        if (!revs.length) {
          return callback();
        }
        db.transaction(function(tx) {
          var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
          tx.executeSql(sql, [docId], function(tx, result) {
            var metadata = utils.safeJsonParse(result.rows.item(0).metadata);
            traverseRevTree(metadata.rev_tree, function(isLeaf, pos, revHash, ctx, opts) {
              var rev = pos + '-' + revHash;
              if (revs.indexOf(rev) !== -1) {
                opts.status = 'missing';
              }
            });
            var sql = 'UPDATE ' + DOC_STORE + ' SET json = ? WHERE id = ?';
            tx.executeSql(sql, [utils.safeJsonStringify(metadata), docId]);
          });
          compactRevs(revs, docId, tx);
        }, websqlError(callback), function() {
          callback();
        });
      };
      api._getLocal = function(id, callback) {
        db.readTransaction(function(tx) {
          var sql = 'SELECT json, rev FROM ' + LOCAL_STORE + ' WHERE id=?';
          tx.executeSql(sql, [id], function(tx, res) {
            if (res.rows.length) {
              var item = res.rows.item(0);
              var doc = unstringifyDoc(item.json, id, item.rev);
              callback(null, doc);
            } else {
              callback(errors.error(errors.MISSING_DOC));
            }
          });
        });
      };
      api._putLocal = function(doc, opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        delete doc._revisions;
        var oldRev = doc._rev;
        var id = doc._id;
        var newRev;
        if (!oldRev) {
          newRev = doc._rev = '0-1';
        } else {
          newRev = doc._rev = '0-' + (parseInt(oldRev.split('-')[1], 10) + 1);
        }
        var json = stringifyDoc(doc);
        var ret;
        function putLocal(tx) {
          var sql;
          var values;
          if (oldRev) {
            sql = 'UPDATE ' + LOCAL_STORE + ' SET rev=?, json=? ' + 'WHERE id=? AND rev=?';
            values = [newRev, json, id, oldRev];
          } else {
            sql = 'INSERT INTO ' + LOCAL_STORE + ' (id, rev, json) VALUES (?,?,?)';
            values = [id, newRev, json];
          }
          tx.executeSql(sql, values, function(tx, res) {
            if (res.rowsAffected) {
              ret = {
                ok: true,
                id: id,
                rev: newRev
              };
              if (opts.ctx) {
                callback(null, ret);
              }
            } else {
              callback(errors.error(errors.REV_CONFLICT));
            }
          }, function() {
            callback(errors.error(errors.REV_CONFLICT));
            return false;
          });
        }
        if (opts.ctx) {
          putLocal(opts.ctx);
        } else {
          db.transaction(putLocal, websqlError(callback), function() {
            if (ret) {
              callback(null, ret);
            }
          });
        }
      };
      api._removeLocal = function(doc, opts, callback) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        var ret;
        function removeLocal(tx) {
          var sql = 'DELETE FROM ' + LOCAL_STORE + ' WHERE id=? AND rev=?';
          var params = [doc._id, doc._rev];
          tx.executeSql(sql, params, function(tx, res) {
            if (!res.rowsAffected) {
              return callback(errors.error(errors.MISSING_DOC));
            }
            ret = {
              ok: true,
              id: doc._id,
              rev: '0-0'
            };
            if (opts.ctx) {
              callback(null, ret);
            }
          });
        }
        if (opts.ctx) {
          removeLocal(opts.ctx);
        } else {
          db.transaction(removeLocal, websqlError(callback), function() {
            if (ret) {
              callback(null, ret);
            }
          });
        }
      };
      api._destroy = function(opts, callback) {
        WebSqlPouch.Changes.removeAllListeners(api._name);
        db.transaction(function(tx) {
          var stores = [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, META_STORE, LOCAL_STORE, ATTACH_AND_SEQ_STORE];
          stores.forEach(function(store) {
            tx.executeSql('DROP TABLE IF EXISTS ' + store, []);
          });
        }, websqlError(callback), function() {
          if (hasLocalStorage()) {
            delete window.localStorage['_pouch__websqldb_' + api._name];
            delete window.localStorage[api._name];
          }
          callback(null, {'ok': true});
        });
      };
    }
    WebSqlPouch.valid = websqlUtils.valid;
    WebSqlPouch.Changes = new utils.Changes();
    module.exports = WebSqlPouch;
  })(req('2f'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("157", ["151", "156"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  module.exports = {
    idb: req('151'),
    websql: req('156')
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("158", ["128", "f6", "ee", "f1", "135", "136", "137", "140", "146", "157"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var PouchDB = req('128');
  module.exports = PouchDB;
  PouchDB.ajax = req('f6');
  PouchDB.utils = req('ee');
  PouchDB.Errors = req('f1');
  PouchDB.replicate = req('135').replicate;
  PouchDB.sync = req('136');
  PouchDB.version = req('137');
  var httpAdapter = req('140');
  PouchDB.adapter('http', httpAdapter);
  PouchDB.adapter('https', httpAdapter);
  PouchDB.plugin(req('146'));
  var adapters = req('157');
  Object.keys(adapters).forEach(function(adapterName) {
    PouchDB.adapter(adapterName, adapters[adapterName], true);
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("159", ["158"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('158');
  global.define = __define;
  return module.exports;
});

$__System.register('15a', ['159', 'ce', 'cf', 'e4'], function (_export) {
  var PouchDB, _createClass, _classCallCheck, _Promise, db, CardDB;

  return {
    setters: [function (_) {
      PouchDB = _['default'];
    }, function (_ce) {
      _createClass = _ce['default'];
    }, function (_cf) {
      _classCallCheck = _cf['default'];
    }, function (_e4) {
      _Promise = _e4['default'];
    }],
    execute: function () {
      'use strict';

      db = new PouchDB('cards');

      CardDB = (function () {
        function CardDB() {
          _classCallCheck(this, CardDB);
        }

        _createClass(CardDB, [{
          key: 'addCard',
          value: function addCard(question, answer) {
            var card = {
              _id: new Date().toISOString(),
              question: question,
              answer: answer
            };
            return db.put(card);
          }
        }, {
          key: 'getCards',
          value: function getCards() {
            // XXX There is surely a neater way of doing this
            return new _Promise(function (resolve, reject) {
              db.allDocs({ include_docs: true, descending: true }).then(function (result) {
                return resolve(result.rows.map(function (row) {
                  return row.doc;
                }));
              })['catch'](function (err) {
                return reject(err);
              });
            });
          }
        }, {
          key: 'onUpdate',
          value: function onUpdate(func) {
            db.changes({ since: 'now', live: true }).on('change', func);
          }
        }]);

        return CardDB;
      })();

      _export('default', new CardDB());
    }
  };
});

$__System.registerDynamic("15b", ["c", "b", "f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(KEY, exec) {
    var $def = req('c'),
        fn = (req('b').Object || {})[KEY] || Object[KEY],
        exp = {};
    exp[KEY] = exec(fn);
    $def($def.S + $def.F * req('f')(function() {
      fn(1);
    }), 'Object', exp);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("15c", ["8", "15b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toIObject = req('8');
  req('15b')('getOwnPropertyDescriptor', function($getOwnPropertyDescriptor) {
    return function getOwnPropertyDescriptor(it, key) {
      return $getOwnPropertyDescriptor(toIObject(it), key);
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("15d", ["d", "15c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('d');
  req('15c');
  module.exports = function getOwnPropertyDescriptor(it, key) {
    return $.getDesc(it, key);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("15e", ["15d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('15d'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("15f", ["15e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _Object$getOwnPropertyDescriptor = req('15e')["default"];
  exports["default"] = function get(_x, _x2, _x3) {
    var _again = true;
    _function: while (_again) {
      var object = _x,
          property = _x2,
          receiver = _x3;
      desc = parent = getter = undefined;
      _again = false;
      if (object === null)
        object = Function.prototype;
      var desc = _Object$getOwnPropertyDescriptor(object, property);
      if (desc === undefined) {
        var parent = Object.getPrototypeOf(object);
        if (parent === null) {
          return undefined;
        } else {
          _x = parent;
          _x2 = property;
          _x3 = receiver;
          _again = true;
          continue _function;
        }
      } else if ("value" in desc) {
        return desc.value;
      } else {
        var getter = desc.get;
        if (getter === undefined) {
          return undefined;
        }
        return getter.call(receiver);
      }
    }
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("160", ["d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('d');
  module.exports = function create(P, D) {
    return $.create(P, D);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("161", ["160"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('160'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("162", ["c", "d8"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $def = req('c');
  $def($def.S, 'Object', {setPrototypeOf: req('d8').set});
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("163", ["162", "b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('162');
  module.exports = req('b').Object.setPrototypeOf;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("164", ["163"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('163'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("165", ["161", "164"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _Object$create = req('161')["default"];
  var _Object$setPrototypeOf = req('164')["default"];
  exports["default"] = function(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }
    subClass.prototype = _Object$create(superClass && superClass.prototype, {constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }});
    if (superClass)
      _Object$setPrototypeOf ? _Object$setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.register('166', ['165', '15f', 'ce', 'cf', 'cb'], function (_export) {
  var _inherits, _get, _createClass, _classCallCheck, React, CardRow;

  return {
    setters: [function (_) {
      _inherits = _['default'];
    }, function (_f) {
      _get = _f['default'];
    }, function (_ce) {
      _createClass = _ce['default'];
    }, function (_cf) {
      _classCallCheck = _cf['default'];
    }, function (_cb) {
      React = _cb['default'];
    }],
    execute: function () {
      'use strict';

      CardRow = (function (_React$Component) {
        _inherits(CardRow, _React$Component);

        function CardRow() {
          _classCallCheck(this, CardRow);

          _get(Object.getPrototypeOf(CardRow.prototype), 'constructor', this).apply(this, arguments);
        }

        _createClass(CardRow, [{
          key: 'render',
          value: function render() {
            return React.createElement("tr", null, React.createElement("td", { className: "question" }, this.props.question), React.createElement("td", { className: "answer" }, this.props.answer), React.createElement("td", { className: "delete" }, "X"));
          }
        }]);

        return CardRow;
      })(React.Component);

      _export('CardRow', CardRow);

      _export('default', CardRow);
    }
  };
});

$__System.register('167', ['165', '166', '15f', 'ce', 'cf', 'cb'], function (_export) {
  var _inherits, CardRow, _get, _createClass, _classCallCheck, React, CardGrid;

  return {
    setters: [function (_) {
      _inherits = _['default'];
    }, function (_2) {
      CardRow = _2['default'];
    }, function (_f) {
      _get = _f['default'];
    }, function (_ce) {
      _createClass = _ce['default'];
    }, function (_cf) {
      _classCallCheck = _cf['default'];
    }, function (_cb) {
      React = _cb['default'];
    }],
    execute: function () {
      'use strict';

      CardGrid = (function (_React$Component) {
        _inherits(CardGrid, _React$Component);

        function CardGrid() {
          _classCallCheck(this, CardGrid);

          _get(Object.getPrototypeOf(CardGrid.prototype), 'constructor', this).apply(this, arguments);
        }

        _createClass(CardGrid, [{
          key: 'render',
          value: function render() {
            return React.createElement("table", { className: "grid" }, React.createElement("tbody", null, this.props.cards.map(function (card) {
              return React.createElement(CardRow, React.__spread({ key: card._id }, card));
            })));
          }
        }]);

        return CardGrid;
      })(React.Component);

      _export('CardGrid', CardGrid);

      _export('default', CardGrid);
    }
  };
});

$__System.register('1', ['29', '167', 'be', 'cb', '15a'], function (_export) {
  var _slicedToArray, CardGrid, ReactDOM, React, CardDB, form;

  function addCard() {
    var _map = ['question', 'answer'].map(function (field) {
      return form[field].value.trim();
    });

    var _map2 = _slicedToArray(_map, 2);

    var question = _map2[0];
    var answer = _map2[1];

    if (!question.length || !answer.length) {
      console.warn('Empty question/answer');
      return;
    }

    CardDB.addCard(question, answer).then(function () {
      console.log('saved');
      form.reset();
    })['catch'](function (err) {
      return console.log(err);
    });
  }

  function render() {
    CardDB.getCards().then(function (cards) {
      ReactDOM.render(React.createElement(CardGrid, { cards: cards }), document.getElementById('card-grid'));
    });
  }

  return {
    setters: [function (_) {
      _slicedToArray = _['default'];
    }, function (_2) {
      CardGrid = _2['default'];
    }, function (_be) {
      ReactDOM = _be['default'];
    }, function (_cb) {
      React = _cb['default'];
    }, function (_a) {
      CardDB = _a['default'];
    }],
    execute: function () {
      'use strict';

      form = document.querySelector('form.add-card');

      form.addEventListener('submit', function (evt) {
        evt.preventDefault();
        addCard();
      });render();
      CardDB.onUpdate(function () {
        return render();
      });

      // Then: Set up server as part of gulp task and do watching
      //  -- if jspm_modules changes, rebuild and copy vendor.js
      //  -- if script files change, recopy THEN relint -- beep on error
      //  -- if js/html files change, recopy
      //  -- if json files change, relint??
      // Then: Do linting as well
      // Set up package.json script aliases

      // Reference: http://pouchdb.com/getting-started.html
      // Also: http://glenmaddern.com/articles/javascript-in-2015
      // And: http://pouchdb.com/guides/updating-deleting.html

      // Then: Deletion
      // Then: Add keywords
      // Then: Add hash to end of ID
      // Then: Editing
      // Then: Make it pretty with JSX and CSS Modules

      // Then: Shared notes?
      //       Deck hierarchy?
    }
  };
});

})
(function(factory) {
  factory();
});