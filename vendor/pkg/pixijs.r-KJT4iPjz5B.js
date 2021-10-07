import { z as isMobile, r as removeItems, A as Ticker, H as UPDATE_PRIORITY, P as Point, q as eventemitter3, I as autoDetectRenderer, R as Rectangle, J as RenderTexture, K as CanvasRenderTarget, T as Texture, g as TYPES$1, L as FORMATS$1, V as ViewableBuffer, N as BufferResource, Q as url, k as BaseTexture, w as MIPMAP_MODES$1, X as ALPHA_MODES$1, h as hex2rgb, Y as correctBlendMode, Z as premultiplyRgba, p as premultiplyTint, _ as ObjectRenderer, B as BLEND_MODES$1, M as Matrix, i as Shader, a as State, G as Geometry, f as Buffer, $ as createIndicesForQuads, a0 as sign, O as ObservablePoint, s as settings, a1 as string2hex, a2 as trimCanvas, a3 as hex2string, a4 as getResolutionOfUrl, W as WRAP_MODES$1, a5 as premultiplyTintToRgba, o as Transform, a6 as TextureMatrix, a7 as QuadUv, b as Polygon, D as DRAW_MODES$1, l as Program, a8 as defaultFilterVertex, F as Filter, a9 as uid, aa as Renderer, ab as BatchRenderer, ac as TickerPlugin } from './common/core-10e96121.khadxYzhfcy3.js';
export { X as ALPHA_MODES, ae as AbstractBatchRenderer, af as AbstractMultiResource, ag as AbstractRenderer, ah as ArrayResource, ai as Attribute, B as BLEND_MODES, b3 as BUFFER_BITS, b4 as BUFFER_TYPE, aj as BaseImageResource, ak as BaseRenderTexture, k as BaseTexture, t as BatchDrawCall, u as BatchGeometry, al as BatchPluginFactory, ab as BatchRenderer, am as BatchShaderGenerator, an as BatchSystem, j as BatchTextureArray, f as Buffer, N as BufferResource, b5 as CLEAR_MODES, ao as CanvasResource, C as Circle, ap as ContextSystem, aq as CubeResource, n as DEG_TO_RAD, D as DRAW_MODES, b6 as ENV, E as Ellipse, L as FORMATS, F as Filter, ar as FilterState, as as FilterSystem, at as Framebuffer, au as FramebufferSystem, b7 as GC_MODES, av as GLFramebuffer, aw as GLProgram, ax as GLTexture, G as Geometry, ay as GeometrySystem, az as IGLUniformData, aA as INSTALLED, aB as ImageBitmapResource, aC as ImageResource, b8 as MASK_TYPES, w as MIPMAP_MODES, b9 as MSAA_QUALITY, aD as MaskData, aE as MaskSystem, M as Matrix, _ as ObjectRenderer, O as ObservablePoint, c as PI_2, ba as PRECISION, P as Point, b as Polygon, l as Program, aF as ProjectionSystem, aG as Quad, a7 as QuadUv, m as RAD_TO_DEG, bb as RENDERER_TYPE, R as Rectangle, J as RenderTexture, aH as RenderTexturePool, aI as RenderTextureSystem, aa as Renderer, aJ as Resource, d as RoundedRectangle, bf as Runner, bc as SAMPLER_TYPES, x as SCALE_MODES, S as SHAPES, aK as SVGResource, aL as ScissorSystem, i as Shader, aM as ShaderSystem, aN as SpriteMaskFilter, a as State, aO as StateSystem, aP as StencilSystem, aQ as System, bd as TARGETS, g as TYPES, T as Texture, aR as TextureGCSystem, a6 as TextureMatrix, aS as TextureSystem, aT as TextureUvs, A as Ticker, ac as TickerPlugin, o as Transform, H as UPDATE_PRIORITY, U as UniformGroup, aU as VideoResource, V as ViewableBuffer, W as WRAP_MODES, I as autoDetectRenderer, aV as autoDetectResource, aW as checkMaxIfStatementsInShader, aX as createUBOElements, a8 as defaultFilterVertex, y as defaultVertex, aY as generateProgram, aZ as generateUniformBufferSync, a_ as getTestContext, a$ as getUBOData, be as groupD8, z as isMobile, b0 as resources, s as settings, b1 as systems, b2 as uniformParsers, ad as utils } from './common/core-10e96121.khadxYzhfcy3.js';
import { D as DisplayObject, T as TemporaryDisplayObject, C as Container, G as Graphics } from './common/graphics-5df5c487.8rXXGrel4q7z.js';
export { B as Bounds, C as Container, D as DisplayObject, F as FillStyle, b as GRAPHICS_CURVES, G as Graphics, c as GraphicsData, d as GraphicsGeometry, L as LINE_CAP, a as LINE_JOIN, e as LineStyle, T as TemporaryDisplayObject, g as graphicsUtils } from './common/graphics-5df5c487.8rXXGrel4q7z.js';
import { A as AlphaFilter, a as BlurFilter, B as BlurFilterPass } from './common/filter-blur-dd361249.1LvuxUf744FR.js';
import './common/_commonjsHelpers-798ad6a7.NdjIFkBWvq6n.js';

/**
 * @this {Promise}
 */
function finallyConstructor(callback) {
  var constructor = this.constructor;
  return this.then(
    function(value) {
      // @ts-ignore
      return constructor.resolve(callback()).then(function() {
        return value;
      });
    },
    function(reason) {
      // @ts-ignore
      return constructor.resolve(callback()).then(function() {
        // @ts-ignore
        return constructor.reject(reason);
      });
    }
  );
}

function allSettled(arr) {
  var P = this;
  return new P(function(resolve, reject) {
    if (!(arr && typeof arr.length !== 'undefined')) {
      return reject(
        new TypeError(
          typeof arr +
            ' ' +
            arr +
            ' is not iterable(cannot read property Symbol(Symbol.iterator))'
        )
      );
    }
    var args = Array.prototype.slice.call(arr);
    if (args.length === 0) return resolve([]);
    var remaining = args.length;

    function res(i, val) {
      if (val && (typeof val === 'object' || typeof val === 'function')) {
        var then = val.then;
        if (typeof then === 'function') {
          then.call(
            val,
            function(val) {
              res(i, val);
            },
            function(e) {
              args[i] = { status: 'rejected', reason: e };
              if (--remaining === 0) {
                resolve(args);
              }
            }
          );
          return;
        }
      }
      args[i] = { status: 'fulfilled', value: val };
      if (--remaining === 0) {
        resolve(args);
      }
    }

    for (var i = 0; i < args.length; i++) {
      res(i, args[i]);
    }
  });
}

// Store setTimeout reference so promise-polyfill will be unaffected by
// other code modifying setTimeout (like sinon.useFakeTimers())
var setTimeoutFunc = setTimeout;

function isArray(x) {
  return Boolean(x && typeof x.length !== 'undefined');
}

function noop() {}

// Polyfill for Function.prototype.bind
function bind(fn, thisArg) {
  return function() {
    fn.apply(thisArg, arguments);
  };
}

/**
 * @constructor
 * @param {Function} fn
 */
function Promise$1(fn) {
  if (!(this instanceof Promise$1))
    throw new TypeError('Promises must be constructed via new');
  if (typeof fn !== 'function') throw new TypeError('not a function');
  /** @type {!number} */
  this._state = 0;
  /** @type {!boolean} */
  this._handled = false;
  /** @type {Promise|undefined} */
  this._value = undefined;
  /** @type {!Array<!Function>} */
  this._deferreds = [];

  doResolve(fn, this);
}

function handle(self, deferred) {
  while (self._state === 3) {
    self = self._value;
  }
  if (self._state === 0) {
    self._deferreds.push(deferred);
    return;
  }
  self._handled = true;
  Promise$1._immediateFn(function() {
    var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
    if (cb === null) {
      (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
      return;
    }
    var ret;
    try {
      ret = cb(self._value);
    } catch (e) {
      reject(deferred.promise, e);
      return;
    }
    resolve(deferred.promise, ret);
  });
}

function resolve(self, newValue) {
  try {
    // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
    if (newValue === self)
      throw new TypeError('A promise cannot be resolved with itself.');
    if (
      newValue &&
      (typeof newValue === 'object' || typeof newValue === 'function')
    ) {
      var then = newValue.then;
      if (newValue instanceof Promise$1) {
        self._state = 3;
        self._value = newValue;
        finale(self);
        return;
      } else if (typeof then === 'function') {
        doResolve(bind(then, newValue), self);
        return;
      }
    }
    self._state = 1;
    self._value = newValue;
    finale(self);
  } catch (e) {
    reject(self, e);
  }
}

function reject(self, newValue) {
  self._state = 2;
  self._value = newValue;
  finale(self);
}

function finale(self) {
  if (self._state === 2 && self._deferreds.length === 0) {
    Promise$1._immediateFn(function() {
      if (!self._handled) {
        Promise$1._unhandledRejectionFn(self._value);
      }
    });
  }

  for (var i = 0, len = self._deferreds.length; i < len; i++) {
    handle(self, self._deferreds[i]);
  }
  self._deferreds = null;
}

/**
 * @constructor
 */
function Handler(onFulfilled, onRejected, promise) {
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
  this.onRejected = typeof onRejected === 'function' ? onRejected : null;
  this.promise = promise;
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, self) {
  var done = false;
  try {
    fn(
      function(value) {
        if (done) return;
        done = true;
        resolve(self, value);
      },
      function(reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      }
    );
  } catch (ex) {
    if (done) return;
    done = true;
    reject(self, ex);
  }
}

Promise$1.prototype['catch'] = function(onRejected) {
  return this.then(null, onRejected);
};

Promise$1.prototype.then = function(onFulfilled, onRejected) {
  // @ts-ignore
  var prom = new this.constructor(noop);

  handle(this, new Handler(onFulfilled, onRejected, prom));
  return prom;
};

Promise$1.prototype['finally'] = finallyConstructor;

Promise$1.all = function(arr) {
  return new Promise$1(function(resolve, reject) {
    if (!isArray(arr)) {
      return reject(new TypeError('Promise.all accepts an array'));
    }

    var args = Array.prototype.slice.call(arr);
    if (args.length === 0) return resolve([]);
    var remaining = args.length;

    function res(i, val) {
      try {
        if (val && (typeof val === 'object' || typeof val === 'function')) {
          var then = val.then;
          if (typeof then === 'function') {
            then.call(
              val,
              function(val) {
                res(i, val);
              },
              reject
            );
            return;
          }
        }
        args[i] = val;
        if (--remaining === 0) {
          resolve(args);
        }
      } catch (ex) {
        reject(ex);
      }
    }

    for (var i = 0; i < args.length; i++) {
      res(i, args[i]);
    }
  });
};

Promise$1.allSettled = allSettled;

Promise$1.resolve = function(value) {
  if (value && typeof value === 'object' && value.constructor === Promise$1) {
    return value;
  }

  return new Promise$1(function(resolve) {
    resolve(value);
  });
};

Promise$1.reject = function(value) {
  return new Promise$1(function(resolve, reject) {
    reject(value);
  });
};

Promise$1.race = function(arr) {
  return new Promise$1(function(resolve, reject) {
    if (!isArray(arr)) {
      return reject(new TypeError('Promise.race accepts an array'));
    }

    for (var i = 0, len = arr.length; i < len; i++) {
      Promise$1.resolve(arr[i]).then(resolve, reject);
    }
  });
};

// Use polyfill for setImmediate for performance gains
Promise$1._immediateFn =
  // @ts-ignore
  (typeof setImmediate === 'function' &&
    function(fn) {
      // @ts-ignore
      setImmediate(fn);
    }) ||
  function(fn) {
    setTimeoutFunc(fn, 0);
  };

Promise$1._unhandledRejectionFn = function _unhandledRejectionFn(err) {
  if (typeof console !== 'undefined' && console) {
    console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
  }
};

/*
object-assign
(c) Sindre Sorhus
@license MIT
*/
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

/*!
 * @pixi/polyfill - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/polyfill is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

// Support for IE 9 - 11 which does not include Promises
if (!self.Promise) {
    self.Promise = Promise$1;
}

// References:
if (!Object.assign) {
    Object.assign = objectAssign;
}

// References:
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// https://gist.github.com/1579671
// http://updates.html5rocks.com/2012/05/requestAnimationFrame-API-now-with-sub-millisecond-precision
// https://gist.github.com/timhall/4078614
// https://github.com/Financial-Times/polyfill-service/tree/master/polyfills/requestAnimationFrame
// Expected to be used with Browserfiy
// Browserify automatically detects the use of `global` and passes the
// correct reference of `global`, `self`, and finally `window`
var ONE_FRAME_TIME = 16;
// Date.now
if (!(Date.now && Date.prototype.getTime)) {
    Date.now = function now() {
        return new Date().getTime();
    };
}
// performance.now
if (!(self.performance && self.performance.now)) {
    var startTime_1 = Date.now();
    if (!self.performance) {
        self.performance = {};
    }
    self.performance.now = function () { return Date.now() - startTime_1; };
}
// requestAnimationFrame
var lastTime = Date.now();
var vendors = ['ms', 'moz', 'webkit', 'o'];
for (var x = 0; x < vendors.length && !self.requestAnimationFrame; ++x) {
    var p = vendors[x];
    self.requestAnimationFrame = self[p + "RequestAnimationFrame"];
    self.cancelAnimationFrame = self[p + "CancelAnimationFrame"]
        || self[p + "CancelRequestAnimationFrame"];
}
if (!self.requestAnimationFrame) {
    self.requestAnimationFrame = function (callback) {
        if (typeof callback !== 'function') {
            throw new TypeError(callback + "is not a function");
        }
        var currentTime = Date.now();
        var delay = ONE_FRAME_TIME + lastTime - currentTime;
        if (delay < 0) {
            delay = 0;
        }
        lastTime = currentTime;
        return self.setTimeout(function () {
            lastTime = Date.now();
            callback(performance.now());
        }, delay);
    };
}
if (!self.cancelAnimationFrame) {
    self.cancelAnimationFrame = function (id) { return clearTimeout(id); };
}

// References:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sign
if (!Math.sign) {
    Math.sign = function mathSign(x) {
        x = Number(x);
        if (x === 0 || isNaN(x)) {
            return x;
        }
        return x > 0 ? 1 : -1;
    };
}

// References:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger
if (!Number.isInteger) {
    Number.isInteger = function numberIsInteger(value) {
        return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
    };
}

if (!self.ArrayBuffer) {
    self.ArrayBuffer = Array;
}
if (!self.Float32Array) {
    self.Float32Array = Array;
}
if (!self.Uint32Array) {
    self.Uint32Array = Array;
}
if (!self.Uint16Array) {
    self.Uint16Array = Array;
}
if (!self.Uint8Array) {
    self.Uint8Array = Array;
}
if (!self.Int32Array) {
    self.Int32Array = Array;
}

/*!
 * @pixi/accessibility - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/accessibility is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/**
 * Default property values of accessible objects
 * used by {@link PIXI.AccessibilityManager}.
 *
 * @private
 * @function accessibleTarget
 * @memberof PIXI
 * @type {Object}
 * @example
 *      function MyObject() {}
 *
 *      Object.assign(
 *          MyObject.prototype,
 *          PIXI.accessibleTarget
 *      );
 */
var accessibleTarget = {
    /**
     *  Flag for if the object is accessible. If true AccessibilityManager will overlay a
     *   shadow div with attributes set
     *
     * @member {boolean}
     * @memberof PIXI.DisplayObject#
     */
    accessible: false,
    /**
     * Sets the title attribute of the shadow div
     * If accessibleTitle AND accessibleHint has not been this will default to 'displayObject [tabIndex]'
     *
     * @member {?string}
     * @memberof PIXI.DisplayObject#
     */
    accessibleTitle: null,
    /**
     * Sets the aria-label attribute of the shadow div
     *
     * @member {string}
     * @memberof PIXI.DisplayObject#
     */
    accessibleHint: null,
    /**
     * @member {number}
     * @memberof PIXI.DisplayObject#
     * @private
     * @todo Needs docs.
     */
    tabIndex: 0,
    /**
     * @member {boolean}
     * @memberof PIXI.DisplayObject#
     * @todo Needs docs.
     */
    _accessibleActive: false,
    /**
     * @member {boolean}
     * @memberof PIXI.DisplayObject#
     * @todo Needs docs.
     */
    _accessibleDiv: null,
    /**
     * Specify the type of div the accessible layer is. Screen readers treat the element differently
     * depending on this type. Defaults to button.
     *
     * @member {string}
     * @memberof PIXI.DisplayObject#
     * @default 'button'
     */
    accessibleType: 'button',
    /**
     * Specify the pointer-events the accessible div will use
     * Defaults to auto.
     *
     * @member {string}
     * @memberof PIXI.DisplayObject#
     * @default 'auto'
     */
    accessiblePointerEvents: 'auto',
    /**
     * Setting to false will prevent any children inside this container to
     * be accessible. Defaults to true.
     *
     * @member {boolean}
     * @memberof PIXI.DisplayObject#
     * @default true
     */
    accessibleChildren: true,
    renderId: -1,
};

// add some extra variables to the container..
DisplayObject.mixin(accessibleTarget);
var KEY_CODE_TAB = 9;
var DIV_TOUCH_SIZE = 100;
var DIV_TOUCH_POS_X = 0;
var DIV_TOUCH_POS_Y = 0;
var DIV_TOUCH_ZINDEX = 2;
var DIV_HOOK_SIZE = 1;
var DIV_HOOK_POS_X = -1000;
var DIV_HOOK_POS_Y = -1000;
var DIV_HOOK_ZINDEX = 2;
/**
 * The Accessibility manager recreates the ability to tab and have content read by screen readers.
 * This is very important as it can possibly help people with disabilities access PixiJS content.
 *
 * A DisplayObject can be made accessible just like it can be made interactive. This manager will map the
 * events as if the mouse was being used, minimizing the effort required to implement.
 *
 * An instance of this class is automatically created by default, and can be found at `renderer.plugins.accessibility`
 *
 * @class
 * @memberof PIXI
 */
var AccessibilityManager = /** @class */ (function () {
    /**
     * @param {PIXI.CanvasRenderer|PIXI.Renderer} renderer - A reference to the current renderer
     */
    function AccessibilityManager(renderer) {
        /** Setting this to true will visually show the divs. */
        this.debug = false;
        /** Internal variable, see isActive getter. */
        this._isActive = false;
        /** Internal variable, see isMobileAccessibility getter. */
        this._isMobileAccessibility = false;
        /** A simple pool for storing divs. */
        this.pool = [];
        /** This is a tick used to check if an object is no longer being rendered. */
        this.renderId = 0;
        /** The array of currently active accessible items. */
        this.children = [];
        /** Count to throttle div updates on android devices. */
        this.androidUpdateCount = 0;
        /**  The frequency to update the div elements. */
        this.androidUpdateFrequency = 500; // 2fps
        this._hookDiv = null;
        if (isMobile.tablet || isMobile.phone) {
            this.createTouchHook();
        }
        // first we create a div that will sit over the PixiJS element. This is where the div overlays will go.
        var div = document.createElement('div');
        div.style.width = DIV_TOUCH_SIZE + "px";
        div.style.height = DIV_TOUCH_SIZE + "px";
        div.style.position = 'absolute';
        div.style.top = DIV_TOUCH_POS_X + "px";
        div.style.left = DIV_TOUCH_POS_Y + "px";
        div.style.zIndex = DIV_TOUCH_ZINDEX.toString();
        this.div = div;
        this.renderer = renderer;
        /**
         * pre-bind the functions
         *
         * @type {Function}
         * @private
         */
        this._onKeyDown = this._onKeyDown.bind(this);
        /**
         * pre-bind the functions
         *
         * @type {Function}
         * @private
         */
        this._onMouseMove = this._onMouseMove.bind(this);
        // let listen for tab.. once pressed we can fire up and show the accessibility layer
        self.addEventListener('keydown', this._onKeyDown, false);
    }
    Object.defineProperty(AccessibilityManager.prototype, "isActive", {
        /**
         * Value of `true` if accessibility is currently active and accessibility layers are showing.
         * @member {boolean}
         * @readonly
         */
        get: function () {
            return this._isActive;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AccessibilityManager.prototype, "isMobileAccessibility", {
        /**
         * Value of `true` if accessibility is enabled for touch devices.
         * @member {boolean}
         * @readonly
         */
        get: function () {
            return this._isMobileAccessibility;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Creates the touch hooks.
     *
     * @private
     */
    AccessibilityManager.prototype.createTouchHook = function () {
        var _this = this;
        var hookDiv = document.createElement('button');
        hookDiv.style.width = DIV_HOOK_SIZE + "px";
        hookDiv.style.height = DIV_HOOK_SIZE + "px";
        hookDiv.style.position = 'absolute';
        hookDiv.style.top = DIV_HOOK_POS_X + "px";
        hookDiv.style.left = DIV_HOOK_POS_Y + "px";
        hookDiv.style.zIndex = DIV_HOOK_ZINDEX.toString();
        hookDiv.style.backgroundColor = '#FF0000';
        hookDiv.title = 'select to enable accessibility for this content';
        hookDiv.addEventListener('focus', function () {
            _this._isMobileAccessibility = true;
            _this.activate();
            _this.destroyTouchHook();
        });
        document.body.appendChild(hookDiv);
        this._hookDiv = hookDiv;
    };
    /**
     * Destroys the touch hooks.
     *
     * @private
     */
    AccessibilityManager.prototype.destroyTouchHook = function () {
        if (!this._hookDiv) {
            return;
        }
        document.body.removeChild(this._hookDiv);
        this._hookDiv = null;
    };
    /**
     * Activating will cause the Accessibility layer to be shown.
     * This is called when a user presses the tab key.
     *
     * @private
     */
    AccessibilityManager.prototype.activate = function () {
        var _a;
        if (this._isActive) {
            return;
        }
        this._isActive = true;
        self.document.addEventListener('mousemove', this._onMouseMove, true);
        self.removeEventListener('keydown', this._onKeyDown, false);
        this.renderer.on('postrender', this.update, this);
        (_a = this.renderer.view.parentNode) === null || _a === void 0 ? void 0 : _a.appendChild(this.div);
    };
    /**
     * Deactivating will cause the Accessibility layer to be hidden.
     * This is called when a user moves the mouse.
     *
     * @private
     */
    AccessibilityManager.prototype.deactivate = function () {
        var _a;
        if (!this._isActive || this._isMobileAccessibility) {
            return;
        }
        this._isActive = false;
        self.document.removeEventListener('mousemove', this._onMouseMove, true);
        self.addEventListener('keydown', this._onKeyDown, false);
        this.renderer.off('postrender', this.update);
        (_a = this.div.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(this.div);
    };
    /**
     * This recursive function will run through the scene graph and add any new accessible objects to the DOM layer.
     *
     * @private
     * @param {PIXI.Container} displayObject - The DisplayObject to check.
     */
    AccessibilityManager.prototype.updateAccessibleObjects = function (displayObject) {
        if (!displayObject.visible || !displayObject.accessibleChildren) {
            return;
        }
        if (displayObject.accessible && displayObject.interactive) {
            if (!displayObject._accessibleActive) {
                this.addChild(displayObject);
            }
            displayObject.renderId = this.renderId;
        }
        var children = displayObject.children;
        for (var i = 0; i < children.length; i++) {
            this.updateAccessibleObjects(children[i]);
        }
    };
    /**
     * Before each render this function will ensure that all divs are mapped correctly to their DisplayObjects.
     *
     * @private
     */
    AccessibilityManager.prototype.update = function () {
        /* On Android default web browser, tab order seems to be calculated by position rather than tabIndex,
        *  moving buttons can cause focus to flicker between two buttons making it hard/impossible to navigate,
        *  so I am just running update every half a second, seems to fix it.
        */
        var now = performance.now();
        if (isMobile.android.device && now < this.androidUpdateCount) {
            return;
        }
        this.androidUpdateCount = now + this.androidUpdateFrequency;
        if (!this.renderer.renderingToScreen) {
            return;
        }
        // update children...
        if (this.renderer._lastObjectRendered) {
            this.updateAccessibleObjects(this.renderer._lastObjectRendered);
        }
        var _a = this.renderer.view.getBoundingClientRect(), left = _a.left, top = _a.top, width = _a.width, height = _a.height;
        var _b = this.renderer, viewWidth = _b.width, viewHeight = _b.height, resolution = _b.resolution;
        var sx = (width / viewWidth) * resolution;
        var sy = (height / viewHeight) * resolution;
        var div = this.div;
        div.style.left = left + "px";
        div.style.top = top + "px";
        div.style.width = viewWidth + "px";
        div.style.height = viewHeight + "px";
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            if (child.renderId !== this.renderId) {
                child._accessibleActive = false;
                removeItems(this.children, i, 1);
                this.div.removeChild(child._accessibleDiv);
                this.pool.push(child._accessibleDiv);
                child._accessibleDiv = null;
                i--;
            }
            else {
                // map div to display..
                div = child._accessibleDiv;
                var hitArea = child.hitArea;
                var wt = child.worldTransform;
                if (child.hitArea) {
                    div.style.left = (wt.tx + (hitArea.x * wt.a)) * sx + "px";
                    div.style.top = (wt.ty + (hitArea.y * wt.d)) * sy + "px";
                    div.style.width = hitArea.width * wt.a * sx + "px";
                    div.style.height = hitArea.height * wt.d * sy + "px";
                }
                else {
                    hitArea = child.getBounds();
                    this.capHitArea(hitArea);
                    div.style.left = hitArea.x * sx + "px";
                    div.style.top = hitArea.y * sy + "px";
                    div.style.width = hitArea.width * sx + "px";
                    div.style.height = hitArea.height * sy + "px";
                    // update button titles and hints if they exist and they've changed
                    if (div.title !== child.accessibleTitle && child.accessibleTitle !== null) {
                        div.title = child.accessibleTitle;
                    }
                    if (div.getAttribute('aria-label') !== child.accessibleHint
                        && child.accessibleHint !== null) {
                        div.setAttribute('aria-label', child.accessibleHint);
                    }
                }
                // the title or index may have changed, if so lets update it!
                if (child.accessibleTitle !== div.title || child.tabIndex !== div.tabIndex) {
                    div.title = child.accessibleTitle;
                    div.tabIndex = child.tabIndex;
                    if (this.debug)
                        { this.updateDebugHTML(div); }
                }
            }
        }
        // increment the render id..
        this.renderId++;
    };
    /**
     * private function that will visually add the information to the
     * accessability div
     *
     * @param {HTMLElement} div
     */
    AccessibilityManager.prototype.updateDebugHTML = function (div) {
        div.innerHTML = "type: " + div.type + "</br> title : " + div.title + "</br> tabIndex: " + div.tabIndex;
    };
    /**
     * Adjust the hit area based on the bounds of a display object
     *
     * @param {PIXI.Rectangle} hitArea - Bounds of the child
     */
    AccessibilityManager.prototype.capHitArea = function (hitArea) {
        if (hitArea.x < 0) {
            hitArea.width += hitArea.x;
            hitArea.x = 0;
        }
        if (hitArea.y < 0) {
            hitArea.height += hitArea.y;
            hitArea.y = 0;
        }
        var _a = this.renderer, viewWidth = _a.width, viewHeight = _a.height;
        if (hitArea.x + hitArea.width > viewWidth) {
            hitArea.width = viewWidth - hitArea.x;
        }
        if (hitArea.y + hitArea.height > viewHeight) {
            hitArea.height = viewHeight - hitArea.y;
        }
    };
    /**
     * Adds a DisplayObject to the accessibility manager
     *
     * @private
     * @param {PIXI.DisplayObject} displayObject - The child to make accessible.
     */
    AccessibilityManager.prototype.addChild = function (displayObject) {
        //    this.activate();
        var div = this.pool.pop();
        if (!div) {
            div = document.createElement('button');
            div.style.width = DIV_TOUCH_SIZE + "px";
            div.style.height = DIV_TOUCH_SIZE + "px";
            div.style.backgroundColor = this.debug ? 'rgba(255,255,255,0.5)' : 'transparent';
            div.style.position = 'absolute';
            div.style.zIndex = DIV_TOUCH_ZINDEX.toString();
            div.style.borderStyle = 'none';
            // ARIA attributes ensure that button title and hint updates are announced properly
            if (navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
                // Chrome doesn't need aria-live to work as intended; in fact it just gets more confused.
                div.setAttribute('aria-live', 'off');
            }
            else {
                div.setAttribute('aria-live', 'polite');
            }
            if (navigator.userAgent.match(/rv:.*Gecko\//)) {
                // FireFox needs this to announce only the new button name
                div.setAttribute('aria-relevant', 'additions');
            }
            else {
                // required by IE, other browsers don't much care
                div.setAttribute('aria-relevant', 'text');
            }
            div.addEventListener('click', this._onClick.bind(this));
            div.addEventListener('focus', this._onFocus.bind(this));
            div.addEventListener('focusout', this._onFocusOut.bind(this));
        }
        // set pointer events
        div.style.pointerEvents = displayObject.accessiblePointerEvents;
        // set the type, this defaults to button!
        div.type = displayObject.accessibleType;
        if (displayObject.accessibleTitle && displayObject.accessibleTitle !== null) {
            div.title = displayObject.accessibleTitle;
        }
        else if (!displayObject.accessibleHint
            || displayObject.accessibleHint === null) {
            div.title = "displayObject " + displayObject.tabIndex;
        }
        if (displayObject.accessibleHint
            && displayObject.accessibleHint !== null) {
            div.setAttribute('aria-label', displayObject.accessibleHint);
        }
        if (this.debug)
            { this.updateDebugHTML(div); }
        displayObject._accessibleActive = true;
        displayObject._accessibleDiv = div;
        div.displayObject = displayObject;
        this.children.push(displayObject);
        this.div.appendChild(displayObject._accessibleDiv);
        displayObject._accessibleDiv.tabIndex = displayObject.tabIndex;
    };
    /**
     * Maps the div button press to pixi's InteractionManager (click)
     *
     * @private
     * @param {MouseEvent} e - The click event.
     */
    AccessibilityManager.prototype._onClick = function (e) {
        var interactionManager = this.renderer.plugins.interaction;
        var displayObject = e.target.displayObject;
        var eventData = interactionManager.eventData;
        interactionManager.dispatchEvent(displayObject, 'click', eventData);
        interactionManager.dispatchEvent(displayObject, 'pointertap', eventData);
        interactionManager.dispatchEvent(displayObject, 'tap', eventData);
    };
    /**
     * Maps the div focus events to pixi's InteractionManager (mouseover)
     *
     * @private
     * @param {FocusEvent} e - The focus event.
     */
    AccessibilityManager.prototype._onFocus = function (e) {
        if (!e.target.getAttribute('aria-live')) {
            e.target.setAttribute('aria-live', 'assertive');
        }
        var interactionManager = this.renderer.plugins.interaction;
        var displayObject = e.target.displayObject;
        var eventData = interactionManager.eventData;
        interactionManager.dispatchEvent(displayObject, 'mouseover', eventData);
    };
    /**
     * Maps the div focus events to pixi's InteractionManager (mouseout)
     *
     * @private
     * @param {FocusEvent} e - The focusout event.
     */
    AccessibilityManager.prototype._onFocusOut = function (e) {
        if (!e.target.getAttribute('aria-live')) {
            e.target.setAttribute('aria-live', 'polite');
        }
        var interactionManager = this.renderer.plugins.interaction;
        var displayObject = e.target.displayObject;
        var eventData = interactionManager.eventData;
        interactionManager.dispatchEvent(displayObject, 'mouseout', eventData);
    };
    /**
     * Is called when a key is pressed
     *
     * @private
     * @param {KeyboardEvent} e - The keydown event.
     */
    AccessibilityManager.prototype._onKeyDown = function (e) {
        if (e.keyCode !== KEY_CODE_TAB) {
            return;
        }
        this.activate();
    };
    /**
     * Is called when the mouse moves across the renderer element
     *
     * @private
     * @param {MouseEvent} e - The mouse event.
     */
    AccessibilityManager.prototype._onMouseMove = function (e) {
        if (e.movementX === 0 && e.movementY === 0) {
            return;
        }
        this.deactivate();
    };
    /**
     * Destroys the accessibility manager
     *
     */
    AccessibilityManager.prototype.destroy = function () {
        this.destroyTouchHook();
        this.div = null;
        self.document.removeEventListener('mousemove', this._onMouseMove, true);
        self.removeEventListener('keydown', this._onKeyDown);
        this.pool = null;
        this.children = null;
        this.renderer = null;
    };
    return AccessibilityManager;
}());

/*!
 * @pixi/interaction - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/interaction is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/**
 * Holds all information related to an Interaction event
 *
 * @class
 * @memberof PIXI
 */
var InteractionData = /** @class */ (function () {
    function InteractionData() {
        this.pressure = 0;
        this.rotationAngle = 0;
        this.twist = 0;
        this.tangentialPressure = 0;
        /**
         * This point stores the global coords of where the touch/mouse event happened
         *
         * @member {PIXI.Point}
         */
        this.global = new Point();
        /**
         * The target Sprite that was interacted with
         *
         * @member {PIXI.Sprite}
         */
        this.target = null;
        /**
         * When passed to an event handler, this will be the original DOM Event that was captured
         *
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
         * @see https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
         * @member {MouseEvent|TouchEvent|PointerEvent}
         */
        this.originalEvent = null;
        /**
         * Unique identifier for this interaction
         *
         * @member {number}
         */
        this.identifier = null;
        /**
         * Indicates whether or not the pointer device that created the event is the primary pointer.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary
         * @type {Boolean}
         */
        this.isPrimary = false;
        /**
         * Indicates which button was pressed on the mouse or pointer device to trigger the event.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
         * @type {number}
         */
        this.button = 0;
        /**
         * Indicates which buttons are pressed on the mouse or pointer device when the event is triggered.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
         * @type {number}
         */
        this.buttons = 0;
        /**
         * The width of the pointer's contact along the x-axis, measured in CSS pixels.
         * radiusX of TouchEvents will be represented by this value.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/width
         * @type {number}
         */
        this.width = 0;
        /**
         * The height of the pointer's contact along the y-axis, measured in CSS pixels.
         * radiusY of TouchEvents will be represented by this value.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/height
         * @type {number}
         */
        this.height = 0;
        /**
         * The angle, in degrees, between the pointer device and the screen.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/tiltX
         * @type {number}
         */
        this.tiltX = 0;
        /**
         * The angle, in degrees, between the pointer device and the screen.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/tiltY
         * @type {number}
         */
        this.tiltY = 0;
        /**
         * The type of pointer that triggered the event.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerType
         * @type {string}
         */
        this.pointerType = null;
        /**
         * Pressure applied by the pointing device during the event. A Touch's force property
         * will be represented by this value.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pressure
         * @type {number}
         */
        this.pressure = 0;
        /**
         * From TouchEvents (not PointerEvents triggered by touches), the rotationAngle of the Touch.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Touch/rotationAngle
         * @type {number}
         */
        this.rotationAngle = 0;
        /**
         * Twist of a stylus pointer.
         * @see https://w3c.github.io/pointerevents/#pointerevent-interface
         * @type {number}
         */
        this.twist = 0;
        /**
         * Barrel pressure on a stylus pointer.
         * @see https://w3c.github.io/pointerevents/#pointerevent-interface
         * @type {number}
         */
        this.tangentialPressure = 0;
    }
    Object.defineProperty(InteractionData.prototype, "pointerId", {
        /**
         * The unique identifier of the pointer. It will be the same as `identifier`.
         * @readonly
         * @member {number}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId
         */
        get: function () {
            return this.identifier;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * This will return the local coordinates of the specified displayObject for this InteractionData
     *
     * @param {PIXI.DisplayObject} displayObject - The DisplayObject that you would like the local
     *  coords off
     * @param {PIXI.Point} [point] - A Point object in which to store the value, optional (otherwise
     *  will create a new point)
     * @param {PIXI.Point} [globalPos] - A Point object containing your custom global coords, optional
     *  (otherwise will use the current global coords)
     * @return {PIXI.Point} A point containing the coordinates of the InteractionData position relative
     *  to the DisplayObject
     */
    InteractionData.prototype.getLocalPosition = function (displayObject, point, globalPos) {
        return displayObject.worldTransform.applyInverse(globalPos || this.global, point);
    };
    /**
     * Copies properties from normalized event data.
     *
     * @param {Touch|MouseEvent|PointerEvent} event - The normalized event data
     */
    InteractionData.prototype.copyEvent = function (event) {
        // isPrimary should only change on touchstart/pointerdown, so we don't want to overwrite
        // it with "false" on later events when our shim for it on touch events might not be
        // accurate
        if ('isPrimary' in event && event.isPrimary) {
            this.isPrimary = true;
        }
        this.button = 'button' in event && event.button;
        // event.buttons is not available in all browsers (ie. Safari), but it does have a non-standard
        // event.which property instead, which conveys the same information.
        var buttons = 'buttons' in event && event.buttons;
        this.buttons = Number.isInteger(buttons) ? buttons : 'which' in event && event.which;
        this.width = 'width' in event && event.width;
        this.height = 'height' in event && event.height;
        this.tiltX = 'tiltX' in event && event.tiltX;
        this.tiltY = 'tiltY' in event && event.tiltY;
        this.pointerType = 'pointerType' in event && event.pointerType;
        this.pressure = 'pressure' in event && event.pressure;
        this.rotationAngle = 'rotationAngle' in event && event.rotationAngle;
        this.twist = ('twist' in event && event.twist) || 0;
        this.tangentialPressure = ('tangentialPressure' in event && event.tangentialPressure) || 0;
    };
    /**
     * Resets the data for pooling.
     */
    InteractionData.prototype.reset = function () {
        // isPrimary is the only property that we really need to reset - everything else is
        // guaranteed to be overwritten
        this.isPrimary = false;
    };
    return InteractionData;
}());

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

/**
 * Event class that mimics native DOM events.
 *
 * @class
 * @memberof PIXI
 */
var InteractionEvent = /** @class */ (function () {
    function InteractionEvent() {
        /**
         * Whether this event will continue propagating in the tree.
         *
         * Remaining events for the {@link stopsPropagatingAt} object
         * will still be dispatched.
         *
         * @member {boolean}
         */
        this.stopped = false;
        /**
         * At which object this event stops propagating.
         *
         * @private
         * @member {PIXI.DisplayObject}
         */
        this.stopsPropagatingAt = null;
        /**
         * Whether we already reached the element we want to
         * stop propagating at. This is important for delayed events,
         * where we start over deeper in the tree again.
         *
         * @private
         * @member {boolean}
         */
        this.stopPropagationHint = false;
        /**
         * The object which caused this event to be dispatched.
         * For listener callback see {@link PIXI.InteractionEvent.currentTarget}.
         *
         * @member {PIXI.DisplayObject}
         */
        this.target = null;
        /**
         * The object whose event listener’s callback is currently being invoked.
         *
         * @member {PIXI.DisplayObject}
         */
        this.currentTarget = null;
        /**
         * Type of the event
         *
         * @member {string}
         */
        this.type = null;
        /**
         * InteractionData related to this event
         *
         * @member {PIXI.InteractionData}
         */
        this.data = null;
    }
    /**
     * Prevents event from reaching any objects other than the current object.
     *
     */
    InteractionEvent.prototype.stopPropagation = function () {
        this.stopped = true;
        this.stopPropagationHint = true;
        this.stopsPropagatingAt = this.currentTarget;
    };
    /**
     * Resets the event.
     */
    InteractionEvent.prototype.reset = function () {
        this.stopped = false;
        this.stopsPropagatingAt = null;
        this.stopPropagationHint = false;
        this.currentTarget = null;
        this.target = null;
    };
    return InteractionEvent;
}());

/**
 * DisplayObjects with the {@link PIXI.interactiveTarget} mixin use this class to track interactions
 *
 * @class
 * @private
 * @memberof PIXI
 */
var InteractionTrackingData = /** @class */ (function () {
    /**
     * @param {number} pointerId - Unique pointer id of the event
     * @private
     */
    function InteractionTrackingData(pointerId) {
        this._pointerId = pointerId;
        this._flags = InteractionTrackingData.FLAGS.NONE;
    }
    /**
     *
     * @private
     * @param {number} flag - The interaction flag to set
     * @param {boolean} yn - Should the flag be set or unset
     */
    InteractionTrackingData.prototype._doSet = function (flag, yn) {
        if (yn) {
            this._flags = this._flags | flag;
        }
        else {
            this._flags = this._flags & (~flag);
        }
    };
    Object.defineProperty(InteractionTrackingData.prototype, "pointerId", {
        /**
         * Unique pointer id of the event
         *
         * @readonly
         * @private
         * @member {number}
         */
        get: function () {
            return this._pointerId;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(InteractionTrackingData.prototype, "flags", {
        /**
         * State of the tracking data, expressed as bit flags
         *
         * @private
         * @member {number}
         */
        get: function () {
            return this._flags;
        },
        set: function (flags) {
            this._flags = flags;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(InteractionTrackingData.prototype, "none", {
        /**
         * Is the tracked event inactive (not over or down)?
         *
         * @private
         * @member {number}
         */
        get: function () {
            return this._flags === InteractionTrackingData.FLAGS.NONE;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(InteractionTrackingData.prototype, "over", {
        /**
         * Is the tracked event over the DisplayObject?
         *
         * @private
         * @member {boolean}
         */
        get: function () {
            return (this._flags & InteractionTrackingData.FLAGS.OVER) !== 0;
        },
        set: function (yn) {
            this._doSet(InteractionTrackingData.FLAGS.OVER, yn);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(InteractionTrackingData.prototype, "rightDown", {
        /**
         * Did the right mouse button come down in the DisplayObject?
         *
         * @private
         * @member {boolean}
         */
        get: function () {
            return (this._flags & InteractionTrackingData.FLAGS.RIGHT_DOWN) !== 0;
        },
        set: function (yn) {
            this._doSet(InteractionTrackingData.FLAGS.RIGHT_DOWN, yn);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(InteractionTrackingData.prototype, "leftDown", {
        /**
         * Did the left mouse button come down in the DisplayObject?
         *
         * @private
         * @member {boolean}
         */
        get: function () {
            return (this._flags & InteractionTrackingData.FLAGS.LEFT_DOWN) !== 0;
        },
        set: function (yn) {
            this._doSet(InteractionTrackingData.FLAGS.LEFT_DOWN, yn);
        },
        enumerable: false,
        configurable: true
    });
    InteractionTrackingData.FLAGS = Object.freeze({
        NONE: 0,
        OVER: 1 << 0,
        LEFT_DOWN: 1 << 1,
        RIGHT_DOWN: 1 << 2,
    });
    return InteractionTrackingData;
}());

/**
 * Strategy how to search through stage tree for interactive objects
 *
 * @private
 * @class
 * @memberof PIXI
 */
var TreeSearch = /** @class */ (function () {
    function TreeSearch() {
        this._tempPoint = new Point();
    }
    /**
     * Recursive implementation for findHit
     *
     * @private
     * @param {PIXI.InteractionEvent} interactionEvent - event containing the point that
     *  is tested for collision
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - the displayObject
     *  that will be hit test (recursively crawls its children)
     * @param {Function} [func] - the function that will be called on each interactive object. The
     *  interactionEvent, displayObject and hit will be passed to the function
     * @param {boolean} [hitTest] - this indicates if the objects inside should be hit test against the point
     * @param {boolean} [interactive] - Whether the displayObject is interactive
     * @return {boolean} returns true if the displayObject hit the point
     */
    TreeSearch.prototype.recursiveFindHit = function (interactionEvent, displayObject, func, hitTest, interactive) {
        if (!displayObject || !displayObject.visible) {
            return false;
        }
        var point = interactionEvent.data.global;
        // Took a little while to rework this function correctly! But now it is done and nice and optimized! ^_^
        //
        // This function will now loop through all objects and then only hit test the objects it HAS
        // to, not all of them. MUCH faster..
        // An object will be hit test if the following is true:
        //
        // 1: It is interactive.
        // 2: It belongs to a parent that is interactive AND one of the parents children have not already been hit.
        //
        // As another little optimization once an interactive object has been hit we can carry on
        // through the scenegraph, but we know that there will be no more hits! So we can avoid extra hit tests
        // A final optimization is that an object is not hit test directly if a child has already been hit.
        interactive = displayObject.interactive || interactive;
        var hit = false;
        var interactiveParent = interactive;
        // Flag here can set to false if the event is outside the parents hitArea or mask
        var hitTestChildren = true;
        // If there is a hitArea, no need to test against anything else if the pointer is not within the hitArea
        // There is also no longer a need to hitTest children.
        if (displayObject.hitArea) {
            if (hitTest) {
                displayObject.worldTransform.applyInverse(point, this._tempPoint);
                if (!displayObject.hitArea.contains(this._tempPoint.x, this._tempPoint.y)) {
                    hitTest = false;
                    hitTestChildren = false;
                }
                else {
                    hit = true;
                }
            }
            interactiveParent = false;
        }
        // If there is a mask, no need to hitTest against anything else if the pointer is not within the mask.
        // We still want to hitTestChildren, however, to ensure a mouseout can still be generated.
        // https://github.com/pixijs/pixi.js/issues/5135
        else if (displayObject._mask) {
            if (hitTest) {
                if (!(displayObject._mask.containsPoint && displayObject._mask.containsPoint(point))) {
                    hitTest = false;
                }
            }
        }
        // ** FREE TIP **! If an object is not interactive or has no buttons in it
        // (such as a game scene!) set interactiveChildren to false for that displayObject.
        // This will allow PixiJS to completely ignore and bypass checking the displayObjects children.
        if (hitTestChildren && displayObject.interactiveChildren && displayObject.children) {
            var children = displayObject.children;
            for (var i = children.length - 1; i >= 0; i--) {
                var child = children[i];
                // time to get recursive.. if this function will return if something is hit..
                var childHit = this.recursiveFindHit(interactionEvent, child, func, hitTest, interactiveParent);
                if (childHit) {
                    // its a good idea to check if a child has lost its parent.
                    // this means it has been removed whilst looping so its best
                    if (!child.parent) {
                        continue;
                    }
                    // we no longer need to hit test any more objects in this container as we we
                    // now know the parent has been hit
                    interactiveParent = false;
                    // If the child is interactive , that means that the object hit was actually
                    // interactive and not just the child of an interactive object.
                    // This means we no longer need to hit test anything else. We still need to run
                    // through all objects, but we don't need to perform any hit tests.
                    if (childHit) {
                        if (interactionEvent.target) {
                            hitTest = false;
                        }
                        hit = true;
                    }
                }
            }
        }
        // no point running this if the item is not interactive or does not have an interactive parent.
        if (interactive) {
            // if we are hit testing (as in we have no hit any objects yet)
            // We also don't need to worry about hit testing if once of the displayObjects children
            // has already been hit - but only if it was interactive, otherwise we need to keep
            // looking for an interactive child, just in case we hit one
            if (hitTest && !interactionEvent.target) {
                // already tested against hitArea if it is defined
                if (!displayObject.hitArea && displayObject.containsPoint) {
                    if (displayObject.containsPoint(point)) {
                        hit = true;
                    }
                }
            }
            if (displayObject.interactive) {
                if (hit && !interactionEvent.target) {
                    interactionEvent.target = displayObject;
                }
                if (func) {
                    func(interactionEvent, displayObject, !!hit);
                }
            }
        }
        return hit;
    };
    /**
     * This function is provides a neat way of crawling through the scene graph and running a
     * specified function on all interactive objects it finds. It will also take care of hit
     * testing the interactive objects and passes the hit across in the function.
     *
     * @private
     * @param {PIXI.InteractionEvent} interactionEvent - event containing the point that
     *  is tested for collision
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - the displayObject
     *  that will be hit test (recursively crawls its children)
     * @param {Function} [func] - the function that will be called on each interactive object. The
     *  interactionEvent, displayObject and hit will be passed to the function
     * @param {boolean} [hitTest] - this indicates if the objects inside should be hit test against the point
     * @return {boolean} returns true if the displayObject hit the point
     */
    TreeSearch.prototype.findHit = function (interactionEvent, displayObject, func, hitTest) {
        this.recursiveFindHit(interactionEvent, displayObject, func, hitTest, false);
    };
    return TreeSearch;
}());

/**
 * Interface for classes that represent a hit area.
 *
 * It is implemented by the following classes:
 * - {@link PIXI.Circle}
 * - {@link PIXI.Ellipse}
 * - {@link PIXI.Polygon}
 * - {@link PIXI.RoundedRectangle}
 *
 * @interface IHitArea
 * @memberof PIXI
 */
/**
 * Checks whether the x and y coordinates given are contained within this area
 *
 * @method
 * @name contains
 * @memberof PIXI.IHitArea#
 * @param {number} x - The X coordinate of the point to test
 * @param {number} y - The Y coordinate of the point to test
 * @return {boolean} Whether the x/y coordinates are within this area
 */
/**
 * Default property values of interactive objects
 * Used by {@link PIXI.InteractionManager} to automatically give all DisplayObjects these properties
 *
 * @private
 * @name interactiveTarget
 * @type {Object}
 * @memberof PIXI
 * @example
 *      function MyObject() {}
 *
 *      Object.assign(
 *          DisplayObject.prototype,
 *          PIXI.interactiveTarget
 *      );
 */
var interactiveTarget = {
    interactive: false,
    interactiveChildren: true,
    hitArea: null,
    /**
     * If enabled, the mouse cursor use the pointer behavior when hovered over the displayObject if it is interactive
     * Setting this changes the 'cursor' property to `'pointer'`.
     *
     * @example
     * const sprite = new PIXI.Sprite(texture);
     * sprite.interactive = true;
     * sprite.buttonMode = true;
     * @member {boolean}
     * @memberof PIXI.DisplayObject#
     */
    get buttonMode() {
        return this.cursor === 'pointer';
    },
    set buttonMode(value) {
        if (value) {
            this.cursor = 'pointer';
        }
        else if (this.cursor === 'pointer') {
            this.cursor = null;
        }
    },
    /**
     * This defines what cursor mode is used when the mouse cursor
     * is hovered over the displayObject.
     *
     * @example
     * const sprite = new PIXI.Sprite(texture);
     * sprite.interactive = true;
     * sprite.cursor = 'wait';
     * @see https://developer.mozilla.org/en/docs/Web/CSS/cursor
     *
     * @member {string}
     * @memberof PIXI.DisplayObject#
     */
    cursor: null,
    /**
     * Internal set of all active pointers, by identifier
     *
     * @member {Map<number, InteractionTrackingData>}
     * @memberof PIXI.DisplayObject#
     * @private
     */
    get trackedPointers() {
        if (this._trackedPointers === undefined)
            { this._trackedPointers = {}; }
        return this._trackedPointers;
    },
    /**
     * Map of all tracked pointers, by identifier. Use trackedPointers to access.
     *
     * @private
     * @type {Map<number, InteractionTrackingData>}
     */
    _trackedPointers: undefined,
};

// Mix interactiveTarget into DisplayObject.prototype
DisplayObject.mixin(interactiveTarget);
var MOUSE_POINTER_ID = 1;
// helpers for hitTest() - only used inside hitTest()
var hitTestEvent = {
    target: null,
    data: {
        global: null,
    },
};
/**
 * The interaction manager deals with mouse, touch and pointer events.
 *
 * Any DisplayObject can be interactive if its `interactive` property is set to true.
 *
 * This manager also supports multitouch.
 *
 * An instance of this class is automatically created by default, and can be found at `renderer.plugins.interaction`
 *
 * @class
 * @extends PIXI.utils.EventEmitter
 * @memberof PIXI
 */
var InteractionManager = /** @class */ (function (_super) {
    __extends(InteractionManager, _super);
    /**
     * @param {PIXI.CanvasRenderer|PIXI.Renderer} renderer - A reference to the current renderer
     * @param {object} [options] - The options for the manager.
     * @param {boolean} [options.autoPreventDefault=true] - Should the manager automatically prevent default browser actions.
     * @param {number} [options.interactionFrequency=10] - Maximum frequency (ms) at pointer over/out states will be checked.
     * @param {number} [options.useSystemTicker=true] - Whether to add {@link tickerUpdate} to {@link PIXI.Ticker.system}.
     */
    function InteractionManager(renderer, options) {
        var _this = _super.call(this) || this;
        options = options || {};
        /**
         * The renderer this interaction manager works for.
         *
         * @member {PIXI.AbstractRenderer}
         */
        _this.renderer = renderer;
        /**
         * Should default browser actions automatically be prevented.
         * Does not apply to pointer events for backwards compatibility
         * preventDefault on pointer events stops mouse events from firing
         * Thus, for every pointer event, there will always be either a mouse of touch event alongside it.
         *
         * @member {boolean}
         * @default true
         */
        _this.autoPreventDefault = options.autoPreventDefault !== undefined ? options.autoPreventDefault : true;
        /**
         * Maximum frequency in milliseconds at which pointer over/out states will be checked by {@link tickerUpdate}.
         *
         * @member {number}
         * @default 10
         */
        _this.interactionFrequency = options.interactionFrequency || 10;
        /**
         * The mouse data
         *
         * @member {PIXI.InteractionData}
         */
        _this.mouse = new InteractionData();
        _this.mouse.identifier = MOUSE_POINTER_ID;
        // setting the mouse to start off far off screen will mean that mouse over does
        //  not get called before we even move the mouse.
        _this.mouse.global.set(-999999);
        /**
         * Actively tracked InteractionData
         *
         * @private
         * @member {Object.<number,PIXI.InteractionData>}
         */
        _this.activeInteractionData = {};
        _this.activeInteractionData[MOUSE_POINTER_ID] = _this.mouse;
        /**
         * Pool of unused InteractionData
         *
         * @private
         * @member {PIXI.InteractionData[]}
         */
        _this.interactionDataPool = [];
        /**
         * An event data object to handle all the event tracking/dispatching
         *
         * @member {object}
         */
        _this.eventData = new InteractionEvent();
        /**
         * The DOM element to bind to.
         *
         * @protected
         * @member {HTMLElement}
         */
        _this.interactionDOMElement = null;
        /**
         * This property determines if mousemove and touchmove events are fired only when the cursor
         * is over the object.
         * Setting to true will make things work more in line with how the DOM version works.
         * Setting to false can make things easier for things like dragging
         * It is currently set to false as this is how PixiJS used to work. This will be set to true in
         * future versions of pixi.
         *
         * @member {boolean}
         * @default false
         */
        _this.moveWhenInside = false;
        /**
         * Have events been attached to the dom element?
         *
         * @protected
         * @member {boolean}
         */
        _this.eventsAdded = false;
        /**
         * Has the system ticker been added?
         *
         * @protected
         * @member {boolean}
         */
        _this.tickerAdded = false;
        /**
         * Is the mouse hovering over the renderer? If working in worker mouse considered to be over renderer by default.
         *
         * @protected
         * @member {boolean}
         */
        _this.mouseOverRenderer = !('PointerEvent' in self);
        /**
         * Does the device support touch events
         * https://www.w3.org/TR/touch-events/
         *
         * @readonly
         * @member {boolean}
         */
        _this.supportsTouchEvents = 'ontouchstart' in self;
        /**
         * Does the device support pointer events
         * https://www.w3.org/Submission/pointer-events/
         *
         * @readonly
         * @member {boolean}
         */
        _this.supportsPointerEvents = !!self.PointerEvent;
        // this will make it so that you don't have to call bind all the time
        /**
         * @private
         * @member {Function}
         */
        _this.onPointerUp = _this.onPointerUp.bind(_this);
        _this.processPointerUp = _this.processPointerUp.bind(_this);
        /**
         * @private
         * @member {Function}
         */
        _this.onPointerCancel = _this.onPointerCancel.bind(_this);
        _this.processPointerCancel = _this.processPointerCancel.bind(_this);
        /**
         * @private
         * @member {Function}
         */
        _this.onPointerDown = _this.onPointerDown.bind(_this);
        _this.processPointerDown = _this.processPointerDown.bind(_this);
        /**
         * @private
         * @member {Function}
         */
        _this.onPointerMove = _this.onPointerMove.bind(_this);
        _this.processPointerMove = _this.processPointerMove.bind(_this);
        /**
         * @private
         * @member {Function}
         */
        _this.onPointerOut = _this.onPointerOut.bind(_this);
        _this.processPointerOverOut = _this.processPointerOverOut.bind(_this);
        /**
         * @private
         * @member {Function}
         */
        _this.onPointerOver = _this.onPointerOver.bind(_this);
        /**
         * Dictionary of how different cursor modes are handled. Strings are handled as CSS cursor
         * values, objects are handled as dictionaries of CSS values for interactionDOMElement,
         * and functions are called instead of changing the CSS.
         * Default CSS cursor values are provided for 'default' and 'pointer' modes.
         * @member {Object.<string, Object>}
         */
        _this.cursorStyles = {
            default: 'inherit',
            pointer: 'pointer',
        };
        /**
         * The mode of the cursor that is being used.
         * The value of this is a key from the cursorStyles dictionary.
         *
         * @member {string}
         */
        _this.currentCursorMode = null;
        /**
         * Internal cached let.
         *
         * @private
         * @member {string}
         */
        _this.cursor = null;
        /**
         * The current resolution / device pixel ratio.
         *
         * @member {number}
         * @default 1
         */
        _this.resolution = 1;
        /**
         * Delayed pointer events. Used to guarantee correct ordering of over/out events.
         *
         * @private
         * @member {Array}
         */
        _this.delayedEvents = [];
        /**
         * TreeSearch component that is used to hitTest stage tree
         *
         * @private
         * @member {PIXI.TreeSearch}
         */
        _this.search = new TreeSearch();
        /**
         * Used as a last rendered object in case renderer doesnt have _lastObjectRendered
         * @member {DisplayObject}
         * @private
         */
        _this._tempDisplayObject = new TemporaryDisplayObject();
        /**
         * An options object specifies characteristics about the event listener.
         * @private
         * @readonly
         * @member {Object.<string, boolean>}
         */
        _this._eventListenerOptions = { capture: true, passive: false };
        /**
         * Fired when a pointer device button (usually a mouse left-button) is pressed on the display
         * object.
         *
         * @event PIXI.InteractionManager#mousedown
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is pressed
         * on the display object.
         *
         * @event PIXI.InteractionManager#rightdown
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button (usually a mouse left-button) is released over the display
         * object.
         *
         * @event PIXI.InteractionManager#mouseup
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is released
         * over the display object.
         *
         * @event PIXI.InteractionManager#rightup
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button (usually a mouse left-button) is pressed and released on
         * the display object.
         *
         * @event PIXI.InteractionManager#click
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is pressed
         * and released on the display object.
         *
         * @event PIXI.InteractionManager#rightclick
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button (usually a mouse left-button) is released outside the
         * display object that initially registered a
         * [mousedown]{@link PIXI.InteractionManager#event:mousedown}.
         *
         * @event PIXI.InteractionManager#mouseupoutside
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is released
         * outside the display object that initially registered a
         * [rightdown]{@link PIXI.InteractionManager#event:rightdown}.
         *
         * @event PIXI.InteractionManager#rightupoutside
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device (usually a mouse) is moved while over the display object
         *
         * @event PIXI.InteractionManager#mousemove
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device (usually a mouse) is moved onto the display object
         *
         * @event PIXI.InteractionManager#mouseover
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device (usually a mouse) is moved off the display object
         *
         * @event PIXI.InteractionManager#mouseout
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button is pressed on the display object.
         *
         * @event PIXI.InteractionManager#pointerdown
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button is released over the display object.
         * Not always fired when some buttons are held down while others are released. In those cases,
         * use [mousedown]{@link PIXI.InteractionManager#event:mousedown} and
         * [mouseup]{@link PIXI.InteractionManager#event:mouseup} instead.
         *
         * @event PIXI.InteractionManager#pointerup
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when the operating system cancels a pointer event
         *
         * @event PIXI.InteractionManager#pointercancel
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button is pressed and released on the display object.
         *
         * @event PIXI.InteractionManager#pointertap
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button is released outside the display object that initially
         * registered a [pointerdown]{@link PIXI.InteractionManager#event:pointerdown}.
         *
         * @event PIXI.InteractionManager#pointerupoutside
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device is moved while over the display object
         *
         * @event PIXI.InteractionManager#pointermove
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device is moved onto the display object
         *
         * @event PIXI.InteractionManager#pointerover
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device is moved off the display object
         *
         * @event PIXI.InteractionManager#pointerout
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is placed on the display object.
         *
         * @event PIXI.InteractionManager#touchstart
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is removed from the display object.
         *
         * @event PIXI.InteractionManager#touchend
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when the operating system cancels a touch
         *
         * @event PIXI.InteractionManager#touchcancel
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is placed and removed from the display object.
         *
         * @event PIXI.InteractionManager#tap
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is removed outside of the display object that initially
         * registered a [touchstart]{@link PIXI.InteractionManager#event:touchstart}.
         *
         * @event PIXI.InteractionManager#touchendoutside
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is moved along the display object.
         *
         * @event PIXI.InteractionManager#touchmove
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button (usually a mouse left-button) is pressed on the display.
         * object. DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#mousedown
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is pressed
         * on the display object. DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#rightdown
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button (usually a mouse left-button) is released over the display
         * object. DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#mouseup
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is released
         * over the display object. DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#rightup
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button (usually a mouse left-button) is pressed and released on
         * the display object. DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#click
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is pressed
         * and released on the display object. DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#rightclick
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button (usually a mouse left-button) is released outside the
         * display object that initially registered a
         * [mousedown]{@link PIXI.DisplayObject#event:mousedown}.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#mouseupoutside
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device secondary button (usually a mouse right-button) is released
         * outside the display object that initially registered a
         * [rightdown]{@link PIXI.DisplayObject#event:rightdown}.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#rightupoutside
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device (usually a mouse) is moved while over the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#mousemove
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device (usually a mouse) is moved onto the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#mouseover
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device (usually a mouse) is moved off the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#mouseout
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button is pressed on the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#pointerdown
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button is released over the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#pointerup
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when the operating system cancels a pointer event.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#pointercancel
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button is pressed and released on the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#pointertap
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device button is released outside the display object that initially
         * registered a [pointerdown]{@link PIXI.DisplayObject#event:pointerdown}.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#pointerupoutside
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device is moved while over the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#pointermove
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device is moved onto the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#pointerover
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a pointer device is moved off the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#pointerout
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is placed on the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#touchstart
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is removed from the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#touchend
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when the operating system cancels a touch.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#touchcancel
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is placed and removed from the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#tap
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is removed outside of the display object that initially
         * registered a [touchstart]{@link PIXI.DisplayObject#event:touchstart}.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#touchendoutside
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        /**
         * Fired when a touch point is moved along the display object.
         * DisplayObject's `interactive` property must be set to `true` to fire event.
         *
         * This comes from the @pixi/interaction package.
         *
         * @event PIXI.DisplayObject#touchmove
         * @param {PIXI.InteractionEvent} event - Interaction event
         */
        _this._useSystemTicker = options.useSystemTicker !== undefined ? options.useSystemTicker : true;
        _this.setTargetElement(_this.renderer.view, _this.renderer.resolution);
        return _this;
    }
    Object.defineProperty(InteractionManager.prototype, "useSystemTicker", {
        /**
         * Should the InteractionManager automatically add {@link tickerUpdate} to {@link PIXI.Ticker.system}.
         *
         * @member {boolean}
         * @default true
         */
        get: function () {
            return this._useSystemTicker;
        },
        set: function (useSystemTicker) {
            this._useSystemTicker = useSystemTicker;
            if (useSystemTicker) {
                this.addTickerListener();
            }
            else {
                this.removeTickerListener();
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(InteractionManager.prototype, "lastObjectRendered", {
        /**
         * Last rendered object or temp object
         * @readonly
         * @protected
         * @member {PIXI.DisplayObject}
         */
        get: function () {
            return this.renderer._lastObjectRendered || this._tempDisplayObject;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Hit tests a point against the display tree, returning the first interactive object that is hit.
     *
     * @param {PIXI.Point} globalPoint - A point to hit test with, in global space.
     * @param {PIXI.Container} [root] - The root display object to start from. If omitted, defaults
     * to the last rendered root of the associated renderer.
     * @return {PIXI.DisplayObject} The hit display object, if any.
     */
    InteractionManager.prototype.hitTest = function (globalPoint, root) {
        // clear the target for our hit test
        hitTestEvent.target = null;
        // assign the global point
        hitTestEvent.data.global = globalPoint;
        // ensure safety of the root
        if (!root) {
            root = this.lastObjectRendered;
        }
        // run the hit test
        this.processInteractive(hitTestEvent, root, null, true);
        // return our found object - it'll be null if we didn't hit anything
        return hitTestEvent.target;
    };
    /**
     * Sets the DOM element which will receive mouse/touch events. This is useful for when you have
     * other DOM elements on top of the renderers Canvas element. With this you'll be bale to delegate
     * another DOM element to receive those events.
     *
     * @param {HTMLElement} element - the DOM element which will receive mouse and touch events.
     * @param {number} [resolution=1] - The resolution / device pixel ratio of the new element (relative to the canvas).
     */
    InteractionManager.prototype.setTargetElement = function (element, resolution) {
        if (resolution === void 0) { resolution = 1; }
        this.removeTickerListener();
        this.removeEvents();
        this.interactionDOMElement = element;
        this.resolution = resolution;
        this.addEvents();
        this.addTickerListener();
    };
    /**
     * Add the ticker listener
     *
     * @private
     */
    InteractionManager.prototype.addTickerListener = function () {
        if (this.tickerAdded || !this.interactionDOMElement || !this._useSystemTicker) {
            return;
        }
        Ticker.system.add(this.tickerUpdate, this, UPDATE_PRIORITY.INTERACTION);
        this.tickerAdded = true;
    };
    /**
     * Remove the ticker listener
     *
     * @private
     */
    InteractionManager.prototype.removeTickerListener = function () {
        if (!this.tickerAdded) {
            return;
        }
        Ticker.system.remove(this.tickerUpdate, this);
        this.tickerAdded = false;
    };
    /**
     * Registers all the DOM events
     *
     * @private
     */
    InteractionManager.prototype.addEvents = function () {
        if (this.eventsAdded || !this.interactionDOMElement) {
            return;
        }
        var style = this.interactionDOMElement.style;
        if (self.navigator.msPointerEnabled) {
            style.msContentZooming = 'none';
            style.msTouchAction = 'none';
        }
        else if (this.supportsPointerEvents) {
            style.touchAction = 'none';
        }
        /*
         * These events are added first, so that if pointer events are normalized, they are fired
         * in the same order as non-normalized events. ie. pointer event 1st, mouse / touch 2nd
         */
        if (this.supportsPointerEvents) {
            self.document.addEventListener('pointermove', this.onPointerMove, this._eventListenerOptions);
            this.interactionDOMElement.addEventListener('pointerdown', this.onPointerDown, this._eventListenerOptions);
            // pointerout is fired in addition to pointerup (for touch events) and pointercancel
            // we already handle those, so for the purposes of what we do in onPointerOut, we only
            // care about the pointerleave event
            this.interactionDOMElement.addEventListener('pointerleave', this.onPointerOut, this._eventListenerOptions);
            this.interactionDOMElement.addEventListener('pointerover', this.onPointerOver, this._eventListenerOptions);
            self.addEventListener('pointercancel', this.onPointerCancel, this._eventListenerOptions);
            self.addEventListener('pointerup', this.onPointerUp, this._eventListenerOptions);
        }
        else {
            self.document.addEventListener('mousemove', this.onPointerMove, this._eventListenerOptions);
            this.interactionDOMElement.addEventListener('mousedown', this.onPointerDown, this._eventListenerOptions);
            this.interactionDOMElement.addEventListener('mouseout', this.onPointerOut, this._eventListenerOptions);
            this.interactionDOMElement.addEventListener('mouseover', this.onPointerOver, this._eventListenerOptions);
            self.addEventListener('mouseup', this.onPointerUp, this._eventListenerOptions);
        }
        // always look directly for touch events so that we can provide original data
        // In a future version we should change this to being just a fallback and rely solely on
        // PointerEvents whenever available
        if (this.supportsTouchEvents) {
            this.interactionDOMElement.addEventListener('touchstart', this.onPointerDown, this._eventListenerOptions);
            this.interactionDOMElement.addEventListener('touchcancel', this.onPointerCancel, this._eventListenerOptions);
            this.interactionDOMElement.addEventListener('touchend', this.onPointerUp, this._eventListenerOptions);
            this.interactionDOMElement.addEventListener('touchmove', this.onPointerMove, this._eventListenerOptions);
        }
        this.eventsAdded = true;
    };
    /**
     * Removes all the DOM events that were previously registered
     *
     * @private
     */
    InteractionManager.prototype.removeEvents = function () {
        if (!this.eventsAdded || !this.interactionDOMElement) {
            return;
        }
        var style = this.interactionDOMElement.style;
        if (self.navigator.msPointerEnabled) {
            style.msContentZooming = '';
            style.msTouchAction = '';
        }
        else if (this.supportsPointerEvents) {
            style.touchAction = '';
        }
        if (this.supportsPointerEvents) {
            self.document.removeEventListener('pointermove', this.onPointerMove, this._eventListenerOptions);
            this.interactionDOMElement.removeEventListener('pointerdown', this.onPointerDown, this._eventListenerOptions);
            this.interactionDOMElement.removeEventListener('pointerleave', this.onPointerOut, this._eventListenerOptions);
            this.interactionDOMElement.removeEventListener('pointerover', this.onPointerOver, this._eventListenerOptions);
            self.removeEventListener('pointercancel', this.onPointerCancel, this._eventListenerOptions);
            self.removeEventListener('pointerup', this.onPointerUp, this._eventListenerOptions);
        }
        else {
            self.document.removeEventListener('mousemove', this.onPointerMove, this._eventListenerOptions);
            this.interactionDOMElement.removeEventListener('mousedown', this.onPointerDown, this._eventListenerOptions);
            this.interactionDOMElement.removeEventListener('mouseout', this.onPointerOut, this._eventListenerOptions);
            this.interactionDOMElement.removeEventListener('mouseover', this.onPointerOver, this._eventListenerOptions);
            self.removeEventListener('mouseup', this.onPointerUp, this._eventListenerOptions);
        }
        if (this.supportsTouchEvents) {
            this.interactionDOMElement.removeEventListener('touchstart', this.onPointerDown, this._eventListenerOptions);
            this.interactionDOMElement.removeEventListener('touchcancel', this.onPointerCancel, this._eventListenerOptions);
            this.interactionDOMElement.removeEventListener('touchend', this.onPointerUp, this._eventListenerOptions);
            this.interactionDOMElement.removeEventListener('touchmove', this.onPointerMove, this._eventListenerOptions);
        }
        this.interactionDOMElement = null;
        this.eventsAdded = false;
    };
    /**
     * Updates the state of interactive objects if at least {@link interactionFrequency}
     * milliseconds have passed since the last invocation.
     *
     * Invoked by a throttled ticker update from {@link PIXI.Ticker.system}.
     *
     * @param {number} deltaTime - time delta since the last call
     */
    InteractionManager.prototype.tickerUpdate = function (deltaTime) {
        this._deltaTime += deltaTime;
        if (this._deltaTime < this.interactionFrequency) {
            return;
        }
        this._deltaTime = 0;
        this.update();
    };
    /**
     * Updates the state of interactive objects.
     */
    InteractionManager.prototype.update = function () {
        if (!this.interactionDOMElement) {
            return;
        }
        // if the user move the mouse this check has already been done using the mouse move!
        if (this._didMove) {
            this._didMove = false;
            return;
        }
        this.cursor = null;
        // Resets the flag as set by a stopPropagation call. This flag is usually reset by a user interaction of any kind,
        // but there was a scenario of a display object moving under a static mouse cursor.
        // In this case, mouseover and mouseevents would not pass the flag test in dispatchEvent function
        for (var k in this.activeInteractionData) {
            // eslint-disable-next-line no-prototype-builtins
            if (this.activeInteractionData.hasOwnProperty(k)) {
                var interactionData = this.activeInteractionData[k];
                if (interactionData.originalEvent && interactionData.pointerType !== 'touch') {
                    var interactionEvent = this.configureInteractionEventForDOMEvent(this.eventData, interactionData.originalEvent, interactionData);
                    this.processInteractive(interactionEvent, this.lastObjectRendered, this.processPointerOverOut, true);
                }
            }
        }
        this.setCursorMode(this.cursor);
    };
    /**
     * Sets the current cursor mode, handling any callbacks or CSS style changes.
     *
     * @param {string} mode - cursor mode, a key from the cursorStyles dictionary
     */
    InteractionManager.prototype.setCursorMode = function (mode) {
        mode = mode || 'default';
        var applyStyles = true;
        // offscreen canvas does not support setting styles, but cursor modes can be functions,
        // in order to handle pixi rendered cursors, so we can't bail
        if (self.OffscreenCanvas && this.interactionDOMElement instanceof OffscreenCanvas) {
            applyStyles = false;
        }
        // if the mode didn't actually change, bail early
        if (this.currentCursorMode === mode) {
            return;
        }
        this.currentCursorMode = mode;
        var style = this.cursorStyles[mode];
        // only do things if there is a cursor style for it
        if (style) {
            switch (typeof style) {
                case 'string':
                    // string styles are handled as cursor CSS
                    if (applyStyles) {
                        this.interactionDOMElement.style.cursor = style;
                    }
                    break;
                case 'function':
                    // functions are just called, and passed the cursor mode
                    style(mode);
                    break;
                case 'object':
                    // if it is an object, assume that it is a dictionary of CSS styles,
                    // apply it to the interactionDOMElement
                    if (applyStyles) {
                        Object.assign(this.interactionDOMElement.style, style);
                    }
                    break;
            }
        }
        else if (applyStyles && typeof mode === 'string' && !Object.prototype.hasOwnProperty.call(this.cursorStyles, mode)) {
            // if it mode is a string (not a Symbol) and cursorStyles doesn't have any entry
            // for the mode, then assume that the dev wants it to be CSS for the cursor.
            this.interactionDOMElement.style.cursor = mode;
        }
    };
    /**
     * Dispatches an event on the display object that was interacted with
     *
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - the display object in question
     * @param {string} eventString - the name of the event (e.g, mousedown)
     * @param {PIXI.InteractionEvent} eventData - the event data object
     * @private
     */
    InteractionManager.prototype.dispatchEvent = function (displayObject, eventString, eventData) {
        // Even if the event was stopped, at least dispatch any remaining events
        // for the same display object.
        if (!eventData.stopPropagationHint || displayObject === eventData.stopsPropagatingAt) {
            eventData.currentTarget = displayObject;
            eventData.type = eventString;
            displayObject.emit(eventString, eventData);
            if (displayObject[eventString]) {
                displayObject[eventString](eventData);
            }
        }
    };
    /**
     * Puts a event on a queue to be dispatched later. This is used to guarantee correct
     * ordering of over/out events.
     *
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - the display object in question
     * @param {string} eventString - the name of the event (e.g, mousedown)
     * @param {object} eventData - the event data object
     * @private
     */
    InteractionManager.prototype.delayDispatchEvent = function (displayObject, eventString, eventData) {
        this.delayedEvents.push({ displayObject: displayObject, eventString: eventString, eventData: eventData });
    };
    /**
     * Maps x and y coords from a DOM object and maps them correctly to the PixiJS view. The
     * resulting value is stored in the point. This takes into account the fact that the DOM
     * element could be scaled and positioned anywhere on the screen.
     *
     * @param  {PIXI.IPointData} point - the point that the result will be stored in
     * @param  {number} x - the x coord of the position to map
     * @param  {number} y - the y coord of the position to map
     */
    InteractionManager.prototype.mapPositionToPoint = function (point, x, y) {
        var rect;
        // IE 11 fix
        if (!this.interactionDOMElement.parentElement) {
            rect = {
                x: 0,
                y: 0,
                width: this.interactionDOMElement.width,
                height: this.interactionDOMElement.height,
                left: 0,
                top: 0
            };
        }
        else {
            rect = this.interactionDOMElement.getBoundingClientRect();
        }
        var resolutionMultiplier = 1.0 / this.resolution;
        point.x = ((x - rect.left) * (this.interactionDOMElement.width / rect.width)) * resolutionMultiplier;
        point.y = ((y - rect.top) * (this.interactionDOMElement.height / rect.height)) * resolutionMultiplier;
    };
    /**
     * This function is provides a neat way of crawling through the scene graph and running a
     * specified function on all interactive objects it finds. It will also take care of hit
     * testing the interactive objects and passes the hit across in the function.
     *
     * @protected
     * @param {PIXI.InteractionEvent} interactionEvent - event containing the point that
     *  is tested for collision
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - the displayObject
     *  that will be hit test (recursively crawls its children)
     * @param {Function} [func] - the function that will be called on each interactive object. The
     *  interactionEvent, displayObject and hit will be passed to the function
     * @param {boolean} [hitTest] - indicates whether we want to calculate hits
     *  or just iterate through all interactive objects
     */
    InteractionManager.prototype.processInteractive = function (interactionEvent, displayObject, func, hitTest) {
        var hit = this.search.findHit(interactionEvent, displayObject, func, hitTest);
        var delayedEvents = this.delayedEvents;
        if (!delayedEvents.length) {
            return hit;
        }
        // Reset the propagation hint, because we start deeper in the tree again.
        interactionEvent.stopPropagationHint = false;
        var delayedLen = delayedEvents.length;
        this.delayedEvents = [];
        for (var i = 0; i < delayedLen; i++) {
            var _a = delayedEvents[i], displayObject_1 = _a.displayObject, eventString = _a.eventString, eventData = _a.eventData;
            // When we reach the object we wanted to stop propagating at,
            // set the propagation hint.
            if (eventData.stopsPropagatingAt === displayObject_1) {
                eventData.stopPropagationHint = true;
            }
            this.dispatchEvent(displayObject_1, eventString, eventData);
        }
        return hit;
    };
    /**
     * Is called when the pointer button is pressed down on the renderer element
     *
     * @private
     * @param {PointerEvent} originalEvent - The DOM event of a pointer button being pressed down
     */
    InteractionManager.prototype.onPointerDown = function (originalEvent) {
        // if we support touch events, then only use those for touch events, not pointer events
        if (this.supportsTouchEvents && originalEvent.pointerType === 'touch')
            { return; }
        var events = this.normalizeToPointerData(originalEvent);
        /*
         * No need to prevent default on natural pointer events, as there are no side effects
         * Normalized events, however, may have the double mousedown/touchstart issue on the native android browser,
         * so still need to be prevented.
         */
        // Guaranteed that there will be at least one event in events, and all events must have the same pointer type
        if (this.autoPreventDefault && events[0].isNormalized) {
            var cancelable = originalEvent.cancelable || !('cancelable' in originalEvent);
            if (cancelable) {
                originalEvent.preventDefault();
            }
        }
        var eventLen = events.length;
        for (var i = 0; i < eventLen; i++) {
            var event = events[i];
            var interactionData = this.getInteractionDataForPointerId(event);
            var interactionEvent = this.configureInteractionEventForDOMEvent(this.eventData, event, interactionData);
            interactionEvent.data.originalEvent = originalEvent;
            this.processInteractive(interactionEvent, this.lastObjectRendered, this.processPointerDown, true);
            this.emit('pointerdown', interactionEvent);
            if (event.pointerType === 'touch') {
                this.emit('touchstart', interactionEvent);
            }
            // emit a mouse event for "pen" pointers, the way a browser would emit a fallback event
            else if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
                var isRightButton = event.button === 2;
                this.emit(isRightButton ? 'rightdown' : 'mousedown', this.eventData);
            }
        }
    };
    /**
     * Processes the result of the pointer down check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.InteractionEvent} interactionEvent - The interaction event wrapping the DOM event
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    InteractionManager.prototype.processPointerDown = function (interactionEvent, displayObject, hit) {
        var data = interactionEvent.data;
        var id = interactionEvent.data.identifier;
        if (hit) {
            if (!displayObject.trackedPointers[id]) {
                displayObject.trackedPointers[id] = new InteractionTrackingData(id);
            }
            this.dispatchEvent(displayObject, 'pointerdown', interactionEvent);
            if (data.pointerType === 'touch') {
                this.dispatchEvent(displayObject, 'touchstart', interactionEvent);
            }
            else if (data.pointerType === 'mouse' || data.pointerType === 'pen') {
                var isRightButton = data.button === 2;
                if (isRightButton) {
                    displayObject.trackedPointers[id].rightDown = true;
                }
                else {
                    displayObject.trackedPointers[id].leftDown = true;
                }
                this.dispatchEvent(displayObject, isRightButton ? 'rightdown' : 'mousedown', interactionEvent);
            }
        }
    };
    /**
     * Is called when the pointer button is released on the renderer element
     *
     * @private
     * @param {PointerEvent} originalEvent - The DOM event of a pointer button being released
     * @param {boolean} cancelled - true if the pointer is cancelled
     * @param {Function} func - Function passed to {@link processInteractive}
     */
    InteractionManager.prototype.onPointerComplete = function (originalEvent, cancelled, func) {
        var events = this.normalizeToPointerData(originalEvent);
        var eventLen = events.length;
        // if the event wasn't targeting our canvas, then consider it to be pointerupoutside
        // in all cases (unless it was a pointercancel)
        var eventAppend = originalEvent.target !== this.interactionDOMElement ? 'outside' : '';
        for (var i = 0; i < eventLen; i++) {
            var event = events[i];
            var interactionData = this.getInteractionDataForPointerId(event);
            var interactionEvent = this.configureInteractionEventForDOMEvent(this.eventData, event, interactionData);
            interactionEvent.data.originalEvent = originalEvent;
            // perform hit testing for events targeting our canvas or cancel events
            this.processInteractive(interactionEvent, this.lastObjectRendered, func, cancelled || !eventAppend);
            this.emit(cancelled ? 'pointercancel' : "pointerup" + eventAppend, interactionEvent);
            if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
                var isRightButton = event.button === 2;
                this.emit(isRightButton ? "rightup" + eventAppend : "mouseup" + eventAppend, interactionEvent);
            }
            else if (event.pointerType === 'touch') {
                this.emit(cancelled ? 'touchcancel' : "touchend" + eventAppend, interactionEvent);
                this.releaseInteractionDataForPointerId(event.pointerId);
            }
        }
    };
    /**
     * Is called when the pointer button is cancelled
     *
     * @private
     * @param {PointerEvent} event - The DOM event of a pointer button being released
     */
    InteractionManager.prototype.onPointerCancel = function (event) {
        // if we support touch events, then only use those for touch events, not pointer events
        if (this.supportsTouchEvents && event.pointerType === 'touch')
            { return; }
        this.onPointerComplete(event, true, this.processPointerCancel);
    };
    /**
     * Processes the result of the pointer cancel check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.InteractionEvent} interactionEvent - The interaction event wrapping the DOM event
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - The display object that was tested
     */
    InteractionManager.prototype.processPointerCancel = function (interactionEvent, displayObject) {
        var data = interactionEvent.data;
        var id = interactionEvent.data.identifier;
        if (displayObject.trackedPointers[id] !== undefined) {
            delete displayObject.trackedPointers[id];
            this.dispatchEvent(displayObject, 'pointercancel', interactionEvent);
            if (data.pointerType === 'touch') {
                this.dispatchEvent(displayObject, 'touchcancel', interactionEvent);
            }
        }
    };
    /**
     * Is called when the pointer button is released on the renderer element
     *
     * @private
     * @param {PointerEvent} event - The DOM event of a pointer button being released
     */
    InteractionManager.prototype.onPointerUp = function (event) {
        // if we support touch events, then only use those for touch events, not pointer events
        if (this.supportsTouchEvents && event.pointerType === 'touch')
            { return; }
        this.onPointerComplete(event, false, this.processPointerUp);
    };
    /**
     * Processes the result of the pointer up check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.InteractionEvent} interactionEvent - The interaction event wrapping the DOM event
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    InteractionManager.prototype.processPointerUp = function (interactionEvent, displayObject, hit) {
        var data = interactionEvent.data;
        var id = interactionEvent.data.identifier;
        var trackingData = displayObject.trackedPointers[id];
        var isTouch = data.pointerType === 'touch';
        var isMouse = (data.pointerType === 'mouse' || data.pointerType === 'pen');
        // need to track mouse down status in the mouse block so that we can emit
        // event in a later block
        var isMouseTap = false;
        // Mouse only
        if (isMouse) {
            var isRightButton = data.button === 2;
            var flags = InteractionTrackingData.FLAGS;
            var test = isRightButton ? flags.RIGHT_DOWN : flags.LEFT_DOWN;
            var isDown = trackingData !== undefined && (trackingData.flags & test);
            if (hit) {
                this.dispatchEvent(displayObject, isRightButton ? 'rightup' : 'mouseup', interactionEvent);
                if (isDown) {
                    this.dispatchEvent(displayObject, isRightButton ? 'rightclick' : 'click', interactionEvent);
                    // because we can confirm that the mousedown happened on this object, flag for later emit of pointertap
                    isMouseTap = true;
                }
            }
            else if (isDown) {
                this.dispatchEvent(displayObject, isRightButton ? 'rightupoutside' : 'mouseupoutside', interactionEvent);
            }
            // update the down state of the tracking data
            if (trackingData) {
                if (isRightButton) {
                    trackingData.rightDown = false;
                }
                else {
                    trackingData.leftDown = false;
                }
            }
        }
        // Pointers and Touches, and Mouse
        if (hit) {
            this.dispatchEvent(displayObject, 'pointerup', interactionEvent);
            if (isTouch)
                { this.dispatchEvent(displayObject, 'touchend', interactionEvent); }
            if (trackingData) {
                // emit pointertap if not a mouse, or if the mouse block decided it was a tap
                if (!isMouse || isMouseTap) {
                    this.dispatchEvent(displayObject, 'pointertap', interactionEvent);
                }
                if (isTouch) {
                    this.dispatchEvent(displayObject, 'tap', interactionEvent);
                    // touches are no longer over (if they ever were) when we get the touchend
                    // so we should ensure that we don't keep pretending that they are
                    trackingData.over = false;
                }
            }
        }
        else if (trackingData) {
            this.dispatchEvent(displayObject, 'pointerupoutside', interactionEvent);
            if (isTouch)
                { this.dispatchEvent(displayObject, 'touchendoutside', interactionEvent); }
        }
        // Only remove the tracking data if there is no over/down state still associated with it
        if (trackingData && trackingData.none) {
            delete displayObject.trackedPointers[id];
        }
    };
    /**
     * Is called when the pointer moves across the renderer element
     *
     * @private
     * @param {PointerEvent} originalEvent - The DOM event of a pointer moving
     */
    InteractionManager.prototype.onPointerMove = function (originalEvent) {
        // if we support touch events, then only use those for touch events, not pointer events
        if (this.supportsTouchEvents && originalEvent.pointerType === 'touch')
            { return; }
        var events = this.normalizeToPointerData(originalEvent);
        if (events[0].pointerType === 'mouse' || events[0].pointerType === 'pen') {
            this._didMove = true;
            this.cursor = null;
        }
        var eventLen = events.length;
        for (var i = 0; i < eventLen; i++) {
            var event = events[i];
            var interactionData = this.getInteractionDataForPointerId(event);
            var interactionEvent = this.configureInteractionEventForDOMEvent(this.eventData, event, interactionData);
            interactionEvent.data.originalEvent = originalEvent;
            this.processInteractive(interactionEvent, this.lastObjectRendered, this.processPointerMove, true);
            this.emit('pointermove', interactionEvent);
            if (event.pointerType === 'touch')
                { this.emit('touchmove', interactionEvent); }
            if (event.pointerType === 'mouse' || event.pointerType === 'pen')
                { this.emit('mousemove', interactionEvent); }
        }
        if (events[0].pointerType === 'mouse') {
            this.setCursorMode(this.cursor);
            // TODO BUG for parents interactive object (border order issue)
        }
    };
    /**
     * Processes the result of the pointer move check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.InteractionEvent} interactionEvent - The interaction event wrapping the DOM event
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    InteractionManager.prototype.processPointerMove = function (interactionEvent, displayObject, hit) {
        var data = interactionEvent.data;
        var isTouch = data.pointerType === 'touch';
        var isMouse = (data.pointerType === 'mouse' || data.pointerType === 'pen');
        if (isMouse) {
            this.processPointerOverOut(interactionEvent, displayObject, hit);
        }
        if (!this.moveWhenInside || hit) {
            this.dispatchEvent(displayObject, 'pointermove', interactionEvent);
            if (isTouch)
                { this.dispatchEvent(displayObject, 'touchmove', interactionEvent); }
            if (isMouse)
                { this.dispatchEvent(displayObject, 'mousemove', interactionEvent); }
        }
    };
    /**
     * Is called when the pointer is moved out of the renderer element
     *
     * @private
     * @param {PointerEvent} originalEvent - The DOM event of a pointer being moved out
     */
    InteractionManager.prototype.onPointerOut = function (originalEvent) {
        // if we support touch events, then only use those for touch events, not pointer events
        if (this.supportsTouchEvents && originalEvent.pointerType === 'touch')
            { return; }
        var events = this.normalizeToPointerData(originalEvent);
        // Only mouse and pointer can call onPointerOut, so events will always be length 1
        var event = events[0];
        if (event.pointerType === 'mouse') {
            this.mouseOverRenderer = false;
            this.setCursorMode(null);
        }
        var interactionData = this.getInteractionDataForPointerId(event);
        var interactionEvent = this.configureInteractionEventForDOMEvent(this.eventData, event, interactionData);
        interactionEvent.data.originalEvent = event;
        this.processInteractive(interactionEvent, this.lastObjectRendered, this.processPointerOverOut, false);
        this.emit('pointerout', interactionEvent);
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
            this.emit('mouseout', interactionEvent);
        }
        else {
            // we can get touchleave events after touchend, so we want to make sure we don't
            // introduce memory leaks
            this.releaseInteractionDataForPointerId(interactionData.identifier);
        }
    };
    /**
     * Processes the result of the pointer over/out check and dispatches the event if need be
     *
     * @private
     * @param {PIXI.InteractionEvent} interactionEvent - The interaction event wrapping the DOM event
     * @param {PIXI.Container|PIXI.Sprite|PIXI.TilingSprite} displayObject - The display object that was tested
     * @param {boolean} hit - the result of the hit test on the display object
     */
    InteractionManager.prototype.processPointerOverOut = function (interactionEvent, displayObject, hit) {
        var data = interactionEvent.data;
        var id = interactionEvent.data.identifier;
        var isMouse = (data.pointerType === 'mouse' || data.pointerType === 'pen');
        var trackingData = displayObject.trackedPointers[id];
        // if we just moused over the display object, then we need to track that state
        if (hit && !trackingData) {
            trackingData = displayObject.trackedPointers[id] = new InteractionTrackingData(id);
        }
        if (trackingData === undefined)
            { return; }
        if (hit && this.mouseOverRenderer) {
            if (!trackingData.over) {
                trackingData.over = true;
                this.delayDispatchEvent(displayObject, 'pointerover', interactionEvent);
                if (isMouse) {
                    this.delayDispatchEvent(displayObject, 'mouseover', interactionEvent);
                }
            }
            // only change the cursor if it has not already been changed (by something deeper in the
            // display tree)
            if (isMouse && this.cursor === null) {
                this.cursor = displayObject.cursor;
            }
        }
        else if (trackingData.over) {
            trackingData.over = false;
            this.dispatchEvent(displayObject, 'pointerout', this.eventData);
            if (isMouse) {
                this.dispatchEvent(displayObject, 'mouseout', interactionEvent);
            }
            // if there is no mouse down information for the pointer, then it is safe to delete
            if (trackingData.none) {
                delete displayObject.trackedPointers[id];
            }
        }
    };
    /**
     * Is called when the pointer is moved into the renderer element
     *
     * @private
     * @param {PointerEvent} originalEvent - The DOM event of a pointer button being moved into the renderer view
     */
    InteractionManager.prototype.onPointerOver = function (originalEvent) {
        var events = this.normalizeToPointerData(originalEvent);
        // Only mouse and pointer can call onPointerOver, so events will always be length 1
        var event = events[0];
        var interactionData = this.getInteractionDataForPointerId(event);
        var interactionEvent = this.configureInteractionEventForDOMEvent(this.eventData, event, interactionData);
        interactionEvent.data.originalEvent = event;
        if (event.pointerType === 'mouse') {
            this.mouseOverRenderer = true;
        }
        this.emit('pointerover', interactionEvent);
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
            this.emit('mouseover', interactionEvent);
        }
    };
    /**
     * Get InteractionData for a given pointerId. Store that data as well
     *
     * @private
     * @param {PointerEvent} event - Normalized pointer event, output from normalizeToPointerData
     * @return {PIXI.InteractionData} - Interaction data for the given pointer identifier
     */
    InteractionManager.prototype.getInteractionDataForPointerId = function (event) {
        var pointerId = event.pointerId;
        var interactionData;
        if (pointerId === MOUSE_POINTER_ID || event.pointerType === 'mouse') {
            interactionData = this.mouse;
        }
        else if (this.activeInteractionData[pointerId]) {
            interactionData = this.activeInteractionData[pointerId];
        }
        else {
            interactionData = this.interactionDataPool.pop() || new InteractionData();
            interactionData.identifier = pointerId;
            this.activeInteractionData[pointerId] = interactionData;
        }
        // copy properties from the event, so that we can make sure that touch/pointer specific
        // data is available
        interactionData.copyEvent(event);
        return interactionData;
    };
    /**
     * Return unused InteractionData to the pool, for a given pointerId
     *
     * @private
     * @param {number} pointerId - Identifier from a pointer event
     */
    InteractionManager.prototype.releaseInteractionDataForPointerId = function (pointerId) {
        var interactionData = this.activeInteractionData[pointerId];
        if (interactionData) {
            delete this.activeInteractionData[pointerId];
            interactionData.reset();
            this.interactionDataPool.push(interactionData);
        }
    };
    /**
     * Configure an InteractionEvent to wrap a DOM PointerEvent and InteractionData
     *
     * @private
     * @param {PIXI.InteractionEvent} interactionEvent - The event to be configured
     * @param {PointerEvent} pointerEvent - The DOM event that will be paired with the InteractionEvent
     * @param {PIXI.InteractionData} interactionData - The InteractionData that will be paired
     *        with the InteractionEvent
     * @return {PIXI.InteractionEvent} the interaction event that was passed in
     */
    InteractionManager.prototype.configureInteractionEventForDOMEvent = function (interactionEvent, pointerEvent, interactionData) {
        interactionEvent.data = interactionData;
        this.mapPositionToPoint(interactionData.global, pointerEvent.clientX, pointerEvent.clientY);
        // Not really sure why this is happening, but it's how a previous version handled things
        if (pointerEvent.pointerType === 'touch') {
            pointerEvent.globalX = interactionData.global.x;
            pointerEvent.globalY = interactionData.global.y;
        }
        interactionData.originalEvent = pointerEvent;
        interactionEvent.reset();
        return interactionEvent;
    };
    /**
     * Ensures that the original event object contains all data that a regular pointer event would have
     *
     * @private
     * @param {TouchEvent|MouseEvent|PointerEvent} event - The original event data from a touch or mouse event
     * @return {PointerEvent[]} An array containing a single normalized pointer event, in the case of a pointer
     *  or mouse event, or a multiple normalized pointer events if there are multiple changed touches
     */
    InteractionManager.prototype.normalizeToPointerData = function (event) {
        var normalizedEvents = [];
        if (this.supportsTouchEvents && event instanceof TouchEvent) {
            for (var i = 0, li = event.changedTouches.length; i < li; i++) {
                var touch = event.changedTouches[i];
                if (typeof touch.button === 'undefined')
                    { touch.button = event.touches.length ? 1 : 0; }
                if (typeof touch.buttons === 'undefined')
                    { touch.buttons = event.touches.length ? 1 : 0; }
                if (typeof touch.isPrimary === 'undefined') {
                    touch.isPrimary = event.touches.length === 1 && event.type === 'touchstart';
                }
                if (typeof touch.width === 'undefined')
                    { touch.width = touch.radiusX || 1; }
                if (typeof touch.height === 'undefined')
                    { touch.height = touch.radiusY || 1; }
                if (typeof touch.tiltX === 'undefined')
                    { touch.tiltX = 0; }
                if (typeof touch.tiltY === 'undefined')
                    { touch.tiltY = 0; }
                if (typeof touch.pointerType === 'undefined')
                    { touch.pointerType = 'touch'; }
                if (typeof touch.pointerId === 'undefined')
                    { touch.pointerId = touch.identifier || 0; }
                if (typeof touch.pressure === 'undefined')
                    { touch.pressure = touch.force || 0.5; }
                if (typeof touch.twist === 'undefined')
                    { touch.twist = 0; }
                if (typeof touch.tangentialPressure === 'undefined')
                    { touch.tangentialPressure = 0; }
                // TODO: Remove these, as layerX/Y is not a standard, is deprecated, has uneven
                // support, and the fill ins are not quite the same
                // offsetX/Y might be okay, but is not the same as clientX/Y when the canvas's top
                // left is not 0,0 on the page
                if (typeof touch.layerX === 'undefined')
                    { touch.layerX = touch.offsetX = touch.clientX; }
                if (typeof touch.layerY === 'undefined')
                    { touch.layerY = touch.offsetY = touch.clientY; }
                // mark the touch as normalized, just so that we know we did it
                touch.isNormalized = true;
                normalizedEvents.push(touch);
            }
        }
        // apparently PointerEvent subclasses MouseEvent, so yay
        else if (!self.MouseEvent
            || (event instanceof MouseEvent && (!this.supportsPointerEvents || !(event instanceof self.PointerEvent)))) {
            var tempEvent = event;
            if (typeof tempEvent.isPrimary === 'undefined')
                { tempEvent.isPrimary = true; }
            if (typeof tempEvent.width === 'undefined')
                { tempEvent.width = 1; }
            if (typeof tempEvent.height === 'undefined')
                { tempEvent.height = 1; }
            if (typeof tempEvent.tiltX === 'undefined')
                { tempEvent.tiltX = 0; }
            if (typeof tempEvent.tiltY === 'undefined')
                { tempEvent.tiltY = 0; }
            if (typeof tempEvent.pointerType === 'undefined')
                { tempEvent.pointerType = 'mouse'; }
            if (typeof tempEvent.pointerId === 'undefined')
                { tempEvent.pointerId = MOUSE_POINTER_ID; }
            if (typeof tempEvent.pressure === 'undefined')
                { tempEvent.pressure = 0.5; }
            if (typeof tempEvent.twist === 'undefined')
                { tempEvent.twist = 0; }
            if (typeof tempEvent.tangentialPressure === 'undefined')
                { tempEvent.tangentialPressure = 0; }
            // mark the mouse event as normalized, just so that we know we did it
            tempEvent.isNormalized = true;
            normalizedEvents.push(tempEvent);
        }
        else {
            normalizedEvents.push(event);
        }
        return normalizedEvents;
    };
    /**
     * Destroys the interaction manager
     *
     */
    InteractionManager.prototype.destroy = function () {
        this.removeEvents();
        this.removeTickerListener();
        this.removeAllListeners();
        this.renderer = null;
        this.mouse = null;
        this.eventData = null;
        this.interactionDOMElement = null;
        this.onPointerDown = null;
        this.processPointerDown = null;
        this.onPointerUp = null;
        this.processPointerUp = null;
        this.onPointerCancel = null;
        this.processPointerCancel = null;
        this.onPointerMove = null;
        this.processPointerMove = null;
        this.onPointerOut = null;
        this.processPointerOverOut = null;
        this.onPointerOver = null;
        this.search = null;
    };
    return InteractionManager;
}(eventemitter3));

/*!
 * @pixi/app - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/app is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/**
 * Convenience class to create a new PIXI application.
 *
 * This class automatically creates the renderer, ticker and root container.
 *
 * @example
 * // Create the application
 * const app = new PIXI.Application();
 *
 * // Add the view to the DOM
 * document.body.appendChild(app.view);
 *
 * // ex, add display objects
 * app.stage.addChild(PIXI.Sprite.from('something.png'));
 *
 * @class
 * @memberof PIXI
 */
var Application = /** @class */ (function () {
    /**
     * @param {object} [options] - The optional renderer parameters.
     * @param {boolean} [options.autoStart=true] - Automatically starts the rendering after the construction.
     *     **Note**: Setting this parameter to false does NOT stop the shared ticker even if you set
     *     options.sharedTicker to true in case that it is already started. Stop it by your own.
     * @param {number} [options.width=800] - The width of the renderers view.
     * @param {number} [options.height=600] - The height of the renderers view.
     * @param {HTMLCanvasElement} [options.view] - The canvas to use as a view, optional.
     * @param {boolean} [options.useContextAlpha=true] - Pass-through value for canvas' context `alpha` property.
     *   If you want to set transparency, please use `backgroundAlpha`. This option is for cases where the
     *   canvas needs to be opaque, possibly for performance reasons on some older devices.
     * @param {boolean} [options.autoDensity=false] - Resizes renderer view in CSS pixels to allow for
     *   resolutions other than 1.
     * @param {boolean} [options.antialias=false] - Sets antialias
     * @param {boolean} [options.preserveDrawingBuffer=false] - Enables drawing buffer preservation, enable this if you
     *  need to call toDataUrl on the WebGL context.
     * @param {number} [options.resolution=PIXI.settings.RESOLUTION] - The resolution / device pixel ratio of the renderer.
     * @param {boolean} [options.forceCanvas=false] - prevents selection of WebGL renderer, even if such is present, this
     *   option only is available when using **pixi.js-legacy** or **@pixi/canvas-renderer** modules, otherwise
     *   it is ignored.
     * @param {number} [options.backgroundColor=0x000000] - The background color of the rendered area
     *  (shown if not transparent).
     * @param {number} [options.backgroundAlpha=1] - Value from 0 (fully transparent) to 1 (fully opaque).
     * @param {boolean} [options.clearBeforeRender=true] - This sets if the renderer will clear the canvas or
     *   not before the new render pass.
     * @param {string} [options.powerPreference] - Parameter passed to webgl context, set to "high-performance"
     *  for devices with dual graphics card. **(WebGL only)**.
     * @param {boolean} [options.sharedTicker=false] - `true` to use PIXI.Ticker.shared, `false` to create new ticker.
     *  If set to false, you cannot register a handler to occur before anything that runs on the shared ticker.
     *  The system ticker will always run before both the shared ticker and the app ticker.
     * @param {boolean} [options.sharedLoader=false] - `true` to use PIXI.Loader.shared, `false` to create new Loader.
     * @param {Window|HTMLElement} [options.resizeTo] - Element to automatically resize stage to.
     */
    function Application(options) {
        var _this = this;
        /**
         * The root display container that's rendered.
         * @member {PIXI.Container}
         */
        this.stage = new Container();
        // The default options
        options = Object.assign({
            forceCanvas: false,
        }, options);
        this.renderer = autoDetectRenderer(options);
        // install plugins here
        Application._plugins.forEach(function (plugin) {
            plugin.init.call(_this, options);
        });
    }
    /**
     * Register a middleware plugin for the application
     * @static
     * @param {PIXI.IApplicationPlugin} plugin - Plugin being installed
     */
    Application.registerPlugin = function (plugin) {
        Application._plugins.push(plugin);
    };
    /**
     * Render the current stage.
     */
    Application.prototype.render = function () {
        this.renderer.render(this.stage);
    };
    Object.defineProperty(Application.prototype, "view", {
        /**
         * Reference to the renderer's canvas element.
         * @member {HTMLCanvasElement}
         * @readonly
         */
        get: function () {
            return this.renderer.view;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Application.prototype, "screen", {
        /**
         * Reference to the renderer's screen rectangle. Its safe to use as `filterArea` or `hitArea` for the whole screen.
         * @member {PIXI.Rectangle}
         * @readonly
         */
        get: function () {
            return this.renderer.screen;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Destroy and don't use after this.
     * @param {Boolean} [removeView=false] - Automatically remove canvas from DOM.
     * @param {object|boolean} [stageOptions] - Options parameter. A boolean will act as if all options
     *  have been set to that value
     * @param {boolean} [stageOptions.children=false] - if set to true, all the children will have their destroy
     *  method called as well. 'stageOptions' will be passed on to those calls.
     * @param {boolean} [stageOptions.texture=false] - Only used for child Sprites if stageOptions.children is set
     *  to true. Should it destroy the texture of the child sprite
     * @param {boolean} [stageOptions.baseTexture=false] - Only used for child Sprites if stageOptions.children is set
     *  to true. Should it destroy the base texture of the child sprite
     */
    Application.prototype.destroy = function (removeView, stageOptions) {
        var _this = this;
        // Destroy plugins in the opposite order
        // which they were constructed
        var plugins = Application._plugins.slice(0);
        plugins.reverse();
        plugins.forEach(function (plugin) {
            plugin.destroy.call(_this);
        });
        this.stage.destroy(stageOptions);
        this.stage = null;
        this.renderer.destroy(removeView);
        this.renderer = null;
    };
    /** Collection of installed plugins. */
    Application._plugins = [];
    return Application;
}());

/**
 * Middleware for for Application's resize functionality
 * @private
 * @class
 */
var ResizePlugin = /** @class */ (function () {
    function ResizePlugin() {
    }
    /**
     * Initialize the plugin with scope of application instance
     * @static
     * @private
     * @param {object} [options] - See application options
     */
    ResizePlugin.init = function (options) {
        var _this = this;
        Object.defineProperty(this, 'resizeTo', 
        /**
         * The HTML element or window to automatically resize the
         * renderer's view element to match width and height.
         * @member {Window|HTMLElement}
         * @name resizeTo
         * @memberof PIXI.Application#
         */
        {
            set: function (dom) {
                self.removeEventListener('resize', this.queueResize);
                this._resizeTo = dom;
                if (dom) {
                    self.addEventListener('resize', this.queueResize);
                    this.resize();
                }
            },
            get: function () {
                return this._resizeTo;
            },
        });
        /**
         * Resize is throttled, so it's safe to call this multiple times per frame and it'll
         * only be called once.
         *
         * @memberof PIXI.Application#
         * @method queueResize
         * @private
         */
        this.queueResize = function () {
            if (!_this._resizeTo) {
                return;
            }
            _this.cancelResize();
            // // Throttle resize events per raf
            _this._resizeId = requestAnimationFrame(function () { return _this.resize(); });
        };
        /**
         * Cancel the resize queue.
         *
         * @memberof PIXI.Application#
         * @method cancelResize
         * @private
         */
        this.cancelResize = function () {
            if (_this._resizeId) {
                cancelAnimationFrame(_this._resizeId);
                _this._resizeId = null;
            }
        };
        /**
         * Execute an immediate resize on the renderer, this is not
         * throttled and can be expensive to call many times in a row.
         * Will resize only if `resizeTo` property is set.
         *
         * @memberof PIXI.Application#
         * @method resize
         */
        this.resize = function () {
            if (!_this._resizeTo) {
                return;
            }
            // clear queue resize
            _this.cancelResize();
            var width;
            var height;
            // Resize to the window
            if (_this._resizeTo === self) {
                width = self.innerWidth;
                height = self.innerHeight;
            }
            // Resize to other HTML entities
            else {
                var _a = _this._resizeTo, clientWidth = _a.clientWidth, clientHeight = _a.clientHeight;
                width = clientWidth;
                height = clientHeight;
            }
            _this.renderer.resize(width, height);
        };
        // On resize
        this._resizeId = null;
        this._resizeTo = null;
        this.resizeTo = options.resizeTo || null;
    };
    /**
     * Clean up the ticker, scoped to application
     *
     * @static
     * @private
     */
    ResizePlugin.destroy = function () {
        self.removeEventListener('resize', this.queueResize);
        this.cancelResize();
        this.cancelResize = null;
        this.queueResize = null;
        this.resizeTo = null;
        this.resize = null;
    };
    return ResizePlugin;
}());

Application.registerPlugin(ResizePlugin);

/*!
 * @pixi/extract - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/extract is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

var TEMP_RECT = new Rectangle();
var BYTES_PER_PIXEL = 4;
/**
 * This class provides renderer-specific plugins for exporting content from a renderer.
 * For instance, these plugins can be used for saving an Image, Canvas element or for exporting the raw image data (pixels).
 *
 * Do not instantiate these plugins directly. It is available from the `renderer.plugins` property.
 * See {@link PIXI.CanvasRenderer#plugins} or {@link PIXI.Renderer#plugins}.
 * @example
 * // Create a new app (will auto-add extract plugin to renderer)
 * const app = new PIXI.Application();
 *
 * // Draw a red circle
 * const graphics = new PIXI.Graphics()
 *     .beginFill(0xFF0000)
 *     .drawCircle(0, 0, 50);
 *
 * // Render the graphics as an HTMLImageElement
 * const image = app.renderer.plugins.extract.image(graphics);
 * document.body.appendChild(image);
 * @class
 * @memberof PIXI
 */
var Extract = /** @class */ (function () {
    /**
     * @param {PIXI.Renderer} renderer - A reference to the current renderer
     */
    function Extract(renderer) {
        this.renderer = renderer;
    }
    /**
     * Will return a HTML Image of the target
     *
     * @param {PIXI.DisplayObject|PIXI.RenderTexture} target - A displayObject or renderTexture
     *  to convert. If left empty will use the main renderer
     * @param {string} [format] - Image format, e.g. "image/jpeg" or "image/webp".
     * @param {number} [quality] - JPEG or Webp compression from 0 to 1. Default is 0.92.
     * @return {HTMLImageElement} HTML Image of the target
     */
    Extract.prototype.image = function (target, format, quality) {
        var image = new Image();
        image.src = this.base64(target, format, quality);
        return image;
    };
    /**
     * Will return a a base64 encoded string of this target. It works by calling
     *  `Extract.getCanvas` and then running toDataURL on that.
     *
     * @param {PIXI.DisplayObject|PIXI.RenderTexture} target - A displayObject or renderTexture
     *  to convert. If left empty will use the main renderer
     * @param {string} [format] - Image format, e.g. "image/jpeg" or "image/webp".
     * @param {number} [quality] - JPEG or Webp compression from 0 to 1. Default is 0.92.
     * @return {string} A base64 encoded string of the texture.
     */
    Extract.prototype.base64 = function (target, format, quality) {
        return this.canvas(target).toDataURL(format, quality);
    };
    /**
     * Creates a Canvas element, renders this target to it and then returns it.
     *
     * @param {PIXI.DisplayObject|PIXI.RenderTexture} target - A displayObject or renderTexture
     *  to convert. If left empty will use the main renderer
     * @return {HTMLCanvasElement} A Canvas element with the texture rendered on.
     */
    Extract.prototype.canvas = function (target) {
        var renderer = this.renderer;
        var resolution;
        var frame;
        var flipY = false;
        var renderTexture;
        var generated = false;
        if (target) {
            if (target instanceof RenderTexture) {
                renderTexture = target;
            }
            else {
                renderTexture = this.renderer.generateTexture(target);
                generated = true;
            }
        }
        if (renderTexture) {
            resolution = renderTexture.baseTexture.resolution;
            frame = renderTexture.frame;
            flipY = false;
            renderer.renderTexture.bind(renderTexture);
        }
        else {
            resolution = this.renderer.resolution;
            flipY = true;
            frame = TEMP_RECT;
            frame.width = this.renderer.width;
            frame.height = this.renderer.height;
            renderer.renderTexture.bind(null);
        }
        var width = Math.floor((frame.width * resolution) + 1e-4);
        var height = Math.floor((frame.height * resolution) + 1e-4);
        var canvasBuffer = new CanvasRenderTarget(width, height, 1);
        var webglPixels = new Uint8Array(BYTES_PER_PIXEL * width * height);
        // read pixels to the array
        var gl = renderer.gl;
        gl.readPixels(frame.x * resolution, frame.y * resolution, width, height, gl.RGBA, gl.UNSIGNED_BYTE, webglPixels);
        // add the pixels to the canvas
        var canvasData = canvasBuffer.context.getImageData(0, 0, width, height);
        Extract.arrayPostDivide(webglPixels, canvasData.data);
        canvasBuffer.context.putImageData(canvasData, 0, 0);
        // pulling pixels
        if (flipY) {
            var target_1 = new CanvasRenderTarget(canvasBuffer.width, canvasBuffer.height, 1);
            target_1.context.scale(1, -1);
            // we can't render to itself because we should be empty before render.
            target_1.context.drawImage(canvasBuffer.canvas, 0, -height);
            canvasBuffer.destroy();
            canvasBuffer = target_1;
        }
        if (generated) {
            renderTexture.destroy(true);
        }
        // send the canvas back..
        return canvasBuffer.canvas;
    };
    /**
     * Will return a one-dimensional array containing the pixel data of the entire texture in RGBA
     * order, with integer values between 0 and 255 (included).
     *
     * @param {PIXI.DisplayObject|PIXI.RenderTexture} target - A displayObject or renderTexture
     *  to convert. If left empty will use the main renderer
     * @return {Uint8Array} One-dimensional array containing the pixel data of the entire texture
     */
    Extract.prototype.pixels = function (target) {
        var renderer = this.renderer;
        var resolution;
        var frame;
        var renderTexture;
        var generated = false;
        if (target) {
            if (target instanceof RenderTexture) {
                renderTexture = target;
            }
            else {
                renderTexture = this.renderer.generateTexture(target);
                generated = true;
            }
        }
        if (renderTexture) {
            resolution = renderTexture.baseTexture.resolution;
            frame = renderTexture.frame;
            // bind the buffer
            renderer.renderTexture.bind(renderTexture);
        }
        else {
            resolution = renderer.resolution;
            frame = TEMP_RECT;
            frame.width = renderer.width;
            frame.height = renderer.height;
            renderer.renderTexture.bind(null);
        }
        var width = frame.width * resolution;
        var height = frame.height * resolution;
        var webglPixels = new Uint8Array(BYTES_PER_PIXEL * width * height);
        // read pixels to the array
        var gl = renderer.gl;
        gl.readPixels(frame.x * resolution, frame.y * resolution, width, height, gl.RGBA, gl.UNSIGNED_BYTE, webglPixels);
        if (generated) {
            renderTexture.destroy(true);
        }
        Extract.arrayPostDivide(webglPixels, webglPixels);
        return webglPixels;
    };
    /**
     * Destroys the extract
     *
     */
    Extract.prototype.destroy = function () {
        this.renderer = null;
    };
    /**
     * Takes premultiplied pixel data and produces regular pixel data
     *
     * @private
     * @param {number[] | Uint8Array | Uint8ClampedArray} pixels - array of pixel data
     * @param {number[] | Uint8Array | Uint8ClampedArray} out - output array
     */
    Extract.arrayPostDivide = function (pixels, out) {
        for (var i = 0; i < pixels.length; i += 4) {
            var alpha = out[i + 3] = pixels[i + 3];
            if (alpha !== 0) {
                out[i] = Math.round(Math.min(pixels[i] * 255.0 / alpha, 255.0));
                out[i + 1] = Math.round(Math.min(pixels[i + 1] * 255.0 / alpha, 255.0));
                out[i + 2] = Math.round(Math.min(pixels[i + 2] * 255.0 / alpha, 255.0));
            }
            else {
                out[i] = pixels[i];
                out[i + 1] = pixels[i + 1];
                out[i + 2] = pixels[i + 2];
            }
        }
    };
    return Extract;
}());

/*!
 * @pixi/loaders - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/loaders is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/* jshint -W097 */
/**
 * @memberof PIXI
 */
var SignalBinding = /** @class */ (function () {
    /**
     * SignalBinding constructor.
     * @constructs SignalBinding
     * @param {Function} fn - Event handler to be called.
     * @param {Boolean} [once=false] - Should this listener be removed after dispatch
     * @param {object} [thisArg] - The context of the callback function.
     * @api private
     */
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    function SignalBinding(fn, once, thisArg) {
        if (once === void 0) { once = false; }
        this._fn = fn;
        this._once = once;
        this._thisArg = thisArg;
        this._next = this._prev = this._owner = null;
    }
    SignalBinding.prototype.detach = function () {
        if (this._owner === null)
            { return false; }
        this._owner.detach(this);
        return true;
    };
    return SignalBinding;
}());
/**
 * @private
 */
function _addSignalBinding(self, node) {
    if (!self._head) {
        self._head = node;
        self._tail = node;
    }
    else {
        self._tail._next = node;
        node._prev = self._tail;
        self._tail = node;
    }
    node._owner = self;
    return node;
}
/**
 * @memberof PIXI
 */
var Signal = /** @class */ (function () {
    /**
     * MiniSignal constructor.
     * @example
     * let mySignal = new Signal();
     * let binding = mySignal.add(onSignal);
     * mySignal.dispatch('foo', 'bar');
     * mySignal.detach(binding);
     */
    function Signal() {
        this._head = this._tail = undefined;
    }
    /**
     * Return an array of attached SignalBinding.
     *
     * @param {Boolean} [exists=false] - We only need to know if there are handlers.
     * @returns {PIXI.SignalBinding[]|Boolean} Array of attached SignalBinding or Boolean if called with exists = true
     * @api public
     */
    Signal.prototype.handlers = function (exists) {
        if (exists === void 0) { exists = false; }
        var node = this._head;
        if (exists)
            { return !!node; }
        var ee = [];
        while (node) {
            ee.push(node);
            node = node._next;
        }
        return ee;
    };
    /**
     * Return true if node is a SignalBinding attached to this MiniSignal
     *
     * @param {PIXI.SignalBinding} node - Node to check.
     * @returns {Boolean} True if node is attache to mini-signal
     */
    Signal.prototype.has = function (node) {
        if (!(node instanceof SignalBinding)) {
            throw new Error('MiniSignal#has(): First arg must be a SignalBinding object.');
        }
        return node._owner === this;
    };
    /**
     * Dispaches a signal to all registered listeners.
     *
     * @returns {Boolean} Indication if we've emitted an event.
     */
    Signal.prototype.dispatch = function () {
        var arguments$1 = arguments;

        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments$1[_i];
        }
        var node = this._head;
        if (!node)
            { return false; }
        while (node) {
            if (node._once)
                { this.detach(node); }
            node._fn.apply(node._thisArg, args);
            node = node._next;
        }
        return true;
    };
    /**
     * Register a new listener.
     *
     * @param {Function} fn - Callback function.
     * @param {object} [thisArg] - The context of the callback function.
     * @returns {PIXI.SignalBinding} The SignalBinding node that was added.
     */
    Signal.prototype.add = function (fn, thisArg) {
        if (thisArg === void 0) { thisArg = null; }
        if (typeof fn !== 'function') {
            throw new Error('MiniSignal#add(): First arg must be a Function.');
        }
        return _addSignalBinding(this, new SignalBinding(fn, false, thisArg));
    };
    /**
     * Register a new listener that will be executed only once.
     *
     * @param {Function} fn - Callback function.
     * @param {object} [thisArg] - The context of the callback function.
     * @returns {PIXI.SignalBinding} The SignalBinding node that was added.
     */
    Signal.prototype.once = function (fn, thisArg) {
        if (thisArg === void 0) { thisArg = null; }
        if (typeof fn !== 'function') {
            throw new Error('MiniSignal#once(): First arg must be a Function.');
        }
        return _addSignalBinding(this, new SignalBinding(fn, true, thisArg));
    };
    /**
     * Remove binding object.
     *
     * @param {PIXI.SignalBinding} node - The binding node that will be removed.
     * @returns {Signal} The instance on which this method was called.
     * @api public */
    Signal.prototype.detach = function (node) {
        if (!(node instanceof SignalBinding)) {
            throw new Error('MiniSignal#detach(): First arg must be a SignalBinding object.');
        }
        if (node._owner !== this)
            { return this; } // todo: or error?
        if (node._prev)
            { node._prev._next = node._next; }
        if (node._next)
            { node._next._prev = node._prev; }
        if (node === this._head) { // first node
            this._head = node._next;
            if (node._next === null) {
                this._tail = null;
            }
        }
        else if (node === this._tail) { // last node
            this._tail = node._prev;
            this._tail._next = null;
        }
        node._owner = null;
        return this;
    };
    /**
     * Detach all listeners.
     *
     * @returns {Signal} The instance on which this method was called.
     */
    Signal.prototype.detachAll = function () {
        var node = this._head;
        if (!node)
            { return this; }
        this._head = this._tail = null;
        while (node) {
            node._owner = null;
            node = node._next;
        }
        return this;
    };
    return Signal;
}());

/**
 * function from npm package `parseUri`, converted to TS to avoid leftpad incident
 * @param {string} str
 * @param [opts] - options
 * @param {boolean} [opts.strictMode] - type of parser
 */
function parseUri(str, opts) {
    opts = opts || {};
    var o = {
        // eslint-disable-next-line max-len
        key: ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'],
        q: {
            name: 'queryKey',
            parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        },
        parser: {
            // eslint-disable-next-line max-len
            strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
            // eslint-disable-next-line max-len
            loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
        }
    };
    var m = o.parser[opts.strictMode ? 'strict' : 'loose'].exec(str);
    var uri = {};
    var i = 14;
    while (i--)
        { uri[o.key[i]] = m[i] || ''; }
    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function (_t0, t1, t2) {
        if (t1)
            { uri[o.q.name][t1] = t2; }
    });
    return uri;
}

// tests if CORS is supported in XHR, if not we need to use XDR
var useXdr = !!(self.XDomainRequest && !('withCredentials' in (new XMLHttpRequest())));
var tempAnchor = null;
// some status constants
var STATUS_NONE = 0;
var STATUS_OK = 200;
var STATUS_EMPTY = 204;
var STATUS_IE_BUG_EMPTY = 1223;
var STATUS_TYPE_OK = 2;
// noop
function _noop() { }
/**
 * Quick helper to set a value on one of the extension maps. Ensures there is no
 * dot at the start of the extension.
 *
 * @ignore
 * @param map - The map to set on.
 * @param extname - The extension (or key) to set.
 * @param val - The value to set.
 */
function setExtMap(map, extname, val) {
    if (extname && extname.indexOf('.') === 0) {
        extname = extname.substring(1);
    }
    if (!extname) {
        return;
    }
    map[extname] = val;
}
/**
 * Quick helper to get string xhr type.
 *
 * @ignore
 * @param xhr - The request to check.
 * @return The type.
 */
function reqType(xhr) {
    return xhr.toString().replace('object ', '');
}
/**
 * Manages the state and loading of a resource and all child resources.
 *
 * Can be extended in `GlobalMixins.LoaderResource`.
 *
 * @memberof PIXI
 */
var LoaderResource = /** @class */ (function () {
    /**
     * @param {string} name - The name of the resource to load.
     * @param {string|string[]} url - The url for this resource, for audio/video loads you can pass
     *      an array of sources.
     * @param {object} [options] - The options for the load.
     * @param {string|boolean} [options.crossOrigin] - Is this request cross-origin? Default is to
     *      determine automatically.
     * @param {number} [options.timeout=0] - A timeout in milliseconds for the load. If the load takes
     *      longer than this time it is cancelled and the load is considered a failure. If this value is
     *      set to `0` then there is no explicit timeout.
     * @param {PIXI.LoaderResource.LOAD_TYPE} [options.loadType=LOAD_TYPE.XHR] - How should this resource
     *      be loaded?
     * @param {PIXI.LoaderResource.XHR_RESPONSE_TYPE} [options.xhrType=XHR_RESPONSE_TYPE.DEFAULT] - How
     *      should the data being loaded be interpreted when using XHR?
     * @param {PIXI.LoaderResource.IMetadata} [options.metadata] - Extra configuration for middleware
     *      and the Resource object.
     */
    function LoaderResource(name, url, options) {
        /**
         * The `dequeue` method that will be used a storage place for the async queue dequeue method
         * used privately by the loader.
         *
         * @private
         * @member {function}
         */
        this._dequeue = _noop;
        /**
         * Used a storage place for the on load binding used privately by the loader.
         *
         * @private
         * @member {function}
         */
        this._onLoadBinding = null;
        /**
         * The timer for element loads to check if they timeout.
         *
         * @private
         */
        this._elementTimer = 0;
        /**
         * The `complete` function bound to this resource's context.
         *
         * @private
         * @type {function}
         */
        this._boundComplete = null;
        /**
         * The `_onError` function bound to this resource's context.
         *
         * @private
         * @type {function}
         */
        this._boundOnError = null;
        /**
         * The `_onProgress` function bound to this resource's context.
         *
         * @private
         * @type {function}
         */
        this._boundOnProgress = null;
        /**
         * The `_onTimeout` function bound to this resource's context.
         *
         * @private
         * @type {function}
         */
        this._boundOnTimeout = null;
        this._boundXhrOnError = null;
        this._boundXhrOnTimeout = null;
        this._boundXhrOnAbort = null;
        this._boundXhrOnLoad = null;
        if (typeof name !== 'string' || typeof url !== 'string') {
            throw new Error('Both name and url are required for constructing a resource.');
        }
        options = options || {};
        this._flags = 0;
        // set data url flag, needs to be set early for some _determineX checks to work.
        this._setFlag(LoaderResource.STATUS_FLAGS.DATA_URL, url.indexOf('data:') === 0);
        this.name = name;
        this.url = url;
        this.extension = this._getExtension();
        this.data = null;
        this.crossOrigin = options.crossOrigin === true ? 'anonymous' : options.crossOrigin;
        this.timeout = options.timeout || 0;
        this.loadType = options.loadType || this._determineLoadType();
        // The type used to load the resource via XHR. If unset, determined automatically.
        this.xhrType = options.xhrType;
        // Extra info for middleware, and controlling specifics about how the resource loads.
        // Note that if you pass in a `loadElement`, the Resource class takes ownership of it.
        // Meaning it will modify it as it sees fit.
        this.metadata = options.metadata || {};
        // The error that occurred while loading (if any).
        this.error = null;
        // The XHR object that was used to load this resource. This is only set
        // when `loadType` is `LoaderResource.LOAD_TYPE.XHR`.
        this.xhr = null;
        // The child resources this resource owns.
        this.children = [];
        // The resource type.
        this.type = LoaderResource.TYPE.UNKNOWN;
        // The progress chunk owned by this resource.
        this.progressChunk = 0;
        // The `dequeue` method that will be used a storage place for the async queue dequeue method
        // used privately by the loader.
        this._dequeue = _noop;
        // Used a storage place for the on load binding used privately by the loader.
        this._onLoadBinding = null;
        // The timer for element loads to check if they timeout.
        this._elementTimer = 0;
        this._boundComplete = this.complete.bind(this);
        this._boundOnError = this._onError.bind(this);
        this._boundOnProgress = this._onProgress.bind(this);
        this._boundOnTimeout = this._onTimeout.bind(this);
        // xhr callbacks
        this._boundXhrOnError = this._xhrOnError.bind(this);
        this._boundXhrOnTimeout = this._xhrOnTimeout.bind(this);
        this._boundXhrOnAbort = this._xhrOnAbort.bind(this);
        this._boundXhrOnLoad = this._xhrOnLoad.bind(this);
        // Dispatched when the resource beings to load.
        this.onStart = new Signal();
        // Dispatched each time progress of this resource load updates.
        // Not all resources types and loader systems can support this event
        // so sometimes it may not be available. If the resource
        // is being loaded on a modern browser, using XHR, and the remote server
        // properly sets Content-Length headers, then this will be available.
        this.onProgress = new Signal();
        // Dispatched once this resource has loaded, if there was an error it will
        // be in the `error` property.
        this.onComplete = new Signal();
        // Dispatched after this resource has had all the *after* middleware run on it.
        this.onAfterMiddleware = new Signal();
    }
    /**
     * Sets the load type to be used for a specific extension.
     *
     * @static
     * @param {string} extname - The extension to set the type for, e.g. "png" or "fnt"
     * @param {PIXI.LoaderResource.LOAD_TYPE} loadType - The load type to set it to.
     */
    LoaderResource.setExtensionLoadType = function (extname, loadType) {
        setExtMap(LoaderResource._loadTypeMap, extname, loadType);
    };
    /**
     * Sets the load type to be used for a specific extension.
     *
     * @static
     * @param {string} extname - The extension to set the type for, e.g. "png" or "fnt"
     * @param {PIXI.LoaderResource.XHR_RESPONSE_TYPE} xhrType - The xhr type to set it to.
     */
    LoaderResource.setExtensionXhrType = function (extname, xhrType) {
        setExtMap(LoaderResource._xhrTypeMap, extname, xhrType);
    };
    Object.defineProperty(LoaderResource.prototype, "isDataUrl", {
        /**
         * When the resource starts to load.
         *
         * @memberof PIXI.LoaderResource
         * @callback OnStartSignal
         * @param {Resource} resource - The resource that the event happened on.
         */
        /**
         * When the resource reports loading progress.
         *
         * @memberof PIXI.LoaderResource
         * @callback OnProgressSignal
         * @param {Resource} resource - The resource that the event happened on.
         * @param {number} percentage - The progress of the load in the range [0, 1].
         */
        /**
         * When the resource finishes loading.
         *
         * @memberof PIXI.LoaderResource
         * @callback OnCompleteSignal
         * @param {Resource} resource - The resource that the event happened on.
         */
        /**
         * @memberof PIXI.LoaderResource
         * @typedef {object} IMetadata
         * @property {HTMLImageElement|HTMLAudioElement|HTMLVideoElement} [loadElement=null] - The
         *      element to use for loading, instead of creating one.
         * @property {boolean} [skipSource=false] - Skips adding source(s) to the load element. This
         *      is useful if you want to pass in a `loadElement` that you already added load sources to.
         * @property {string|string[]} [mimeType] - The mime type to use for the source element
         *      of a video/audio elment. If the urls are an array, you can pass this as an array as well
         *      where each index is the mime type to use for the corresponding url index.
         */
        /**
         * Stores whether or not this url is a data url.
         *
         * @readonly
         * @member {boolean}
         */
        get: function () {
            return this._hasFlag(LoaderResource.STATUS_FLAGS.DATA_URL);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LoaderResource.prototype, "isComplete", {
        /**
         * Describes if this resource has finished loading. Is true when the resource has completely
         * loaded.
         *
         * @readonly
         * @member {boolean}
         */
        get: function () {
            return this._hasFlag(LoaderResource.STATUS_FLAGS.COMPLETE);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(LoaderResource.prototype, "isLoading", {
        /**
         * Describes if this resource is currently loading. Is true when the resource starts loading,
         * and is false again when complete.
         *
         * @readonly
         * @member {boolean}
         */
        get: function () {
            return this._hasFlag(LoaderResource.STATUS_FLAGS.LOADING);
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Marks the resource as complete.
     *
     */
    LoaderResource.prototype.complete = function () {
        this._clearEvents();
        this._finish();
    };
    /**
     * Aborts the loading of this resource, with an optional message.
     *
     * @param {string} message - The message to use for the error
     */
    LoaderResource.prototype.abort = function (message) {
        // abort can be called multiple times, ignore subsequent calls.
        if (this.error) {
            return;
        }
        // store error
        this.error = new Error(message);
        // clear events before calling aborts
        this._clearEvents();
        // abort the actual loading
        if (this.xhr) {
            this.xhr.abort();
        }
        else if (this.xdr) {
            this.xdr.abort();
        }
        else if (this.data) {
            // single source
            if (this.data.src) {
                this.data.src = LoaderResource.EMPTY_GIF;
            }
            // multi-source
            else {
                while (this.data.firstChild) {
                    this.data.removeChild(this.data.firstChild);
                }
            }
        }
        // done now.
        this._finish();
    };
    /**
     * Kicks off loading of this resource. This method is asynchronous.
     *
     * @param {PIXI.LoaderResource.OnCompleteSignal} [cb] - Optional callback to call once the resource is loaded.
     */
    LoaderResource.prototype.load = function (cb) {
        var _this = this;
        if (this.isLoading) {
            return;
        }
        if (this.isComplete) {
            if (cb) {
                setTimeout(function () { return cb(_this); }, 1);
            }
            return;
        }
        else if (cb) {
            this.onComplete.once(cb);
        }
        this._setFlag(LoaderResource.STATUS_FLAGS.LOADING, true);
        this.onStart.dispatch(this);
        // if unset, determine the value
        if (this.crossOrigin === false || typeof this.crossOrigin !== 'string') {
            this.crossOrigin = this._determineCrossOrigin(this.url);
        }
        switch (this.loadType) {
            case LoaderResource.LOAD_TYPE.IMAGE:
                this.type = LoaderResource.TYPE.IMAGE;
                this._loadElement('image');
                break;
            case LoaderResource.LOAD_TYPE.AUDIO:
                this.type = LoaderResource.TYPE.AUDIO;
                this._loadSourceElement('audio');
                break;
            case LoaderResource.LOAD_TYPE.VIDEO:
                this.type = LoaderResource.TYPE.VIDEO;
                this._loadSourceElement('video');
                break;
            case LoaderResource.LOAD_TYPE.XHR:
            /* falls through */
            default:
                if (useXdr && this.crossOrigin) {
                    this._loadXdr();
                }
                else {
                    this._loadXhr();
                }
                break;
        }
    };
    /**
     * Checks if the flag is set.
     *
     * @param flag - The flag to check.
     * @return True if the flag is set.
     */
    LoaderResource.prototype._hasFlag = function (flag) {
        return (this._flags & flag) !== 0;
    };
    /**
     * (Un)Sets the flag.
     *
     * @param flag - The flag to (un)set.
     * @param value - Whether to set or (un)set the flag.
     */
    LoaderResource.prototype._setFlag = function (flag, value) {
        this._flags = value ? (this._flags | flag) : (this._flags & ~flag);
    };
    /**
     * Clears all the events from the underlying loading source.
     */
    LoaderResource.prototype._clearEvents = function () {
        clearTimeout(this._elementTimer);
        if (this.data && this.data.removeEventListener) {
            this.data.removeEventListener('error', this._boundOnError, false);
            this.data.removeEventListener('load', this._boundComplete, false);
            this.data.removeEventListener('progress', this._boundOnProgress, false);
            this.data.removeEventListener('canplaythrough', this._boundComplete, false);
        }
        if (this.xhr) {
            if (this.xhr.removeEventListener) {
                this.xhr.removeEventListener('error', this._boundXhrOnError, false);
                this.xhr.removeEventListener('timeout', this._boundXhrOnTimeout, false);
                this.xhr.removeEventListener('abort', this._boundXhrOnAbort, false);
                this.xhr.removeEventListener('progress', this._boundOnProgress, false);
                this.xhr.removeEventListener('load', this._boundXhrOnLoad, false);
            }
            else {
                this.xhr.onerror = null;
                this.xhr.ontimeout = null;
                this.xhr.onprogress = null;
                this.xhr.onload = null;
            }
        }
    };
    /**
     * Finalizes the load.
     */
    LoaderResource.prototype._finish = function () {
        if (this.isComplete) {
            throw new Error('Complete called again for an already completed resource.');
        }
        this._setFlag(LoaderResource.STATUS_FLAGS.COMPLETE, true);
        this._setFlag(LoaderResource.STATUS_FLAGS.LOADING, false);
        this.onComplete.dispatch(this);
    };
    /**
     * Loads this resources using an element that has a single source,
     * like an HTMLImageElement.
     * @private
     * @param type - The type of element to use.
     */
    LoaderResource.prototype._loadElement = function (type) {
        if (this.metadata.loadElement) {
            this.data = this.metadata.loadElement;
        }
        else if (type === 'image' && typeof self.Image !== 'undefined') {
            this.data = new Image();
        }
        else {
            this.data = document.createElement(type);
        }
        if (this.crossOrigin) {
            this.data.crossOrigin = this.crossOrigin;
        }
        if (!this.metadata.skipSource) {
            this.data.src = this.url;
        }
        this.data.addEventListener('error', this._boundOnError, false);
        this.data.addEventListener('load', this._boundComplete, false);
        this.data.addEventListener('progress', this._boundOnProgress, false);
        if (this.timeout) {
            this._elementTimer = setTimeout(this._boundOnTimeout, this.timeout);
        }
    };
    /**
     * Loads this resources using an element that has multiple sources,
     * like an HTMLAudioElement or HTMLVideoElement.
     * @param type - The type of element to use.
     */
    LoaderResource.prototype._loadSourceElement = function (type) {
        if (this.metadata.loadElement) {
            this.data = this.metadata.loadElement;
        }
        else if (type === 'audio' && typeof self.Audio !== 'undefined') {
            this.data = new Audio();
        }
        else {
            this.data = document.createElement(type);
        }
        if (this.data === null) {
            this.abort("Unsupported element: " + type);
            return;
        }
        if (this.crossOrigin) {
            this.data.crossOrigin = this.crossOrigin;
        }
        if (!this.metadata.skipSource) {
            // support for CocoonJS Canvas+ runtime, lacks document.createElement('source')
            if (navigator.isCocoonJS) {
                this.data.src = Array.isArray(this.url) ? this.url[0] : this.url;
            }
            else if (Array.isArray(this.url)) {
                var mimeTypes = this.metadata.mimeType;
                for (var i = 0; i < this.url.length; ++i) {
                    this.data.appendChild(this._createSource(type, this.url[i], Array.isArray(mimeTypes) ? mimeTypes[i] : mimeTypes));
                }
            }
            else {
                var mimeTypes = this.metadata.mimeType;
                this.data.appendChild(this._createSource(type, this.url, Array.isArray(mimeTypes) ? mimeTypes[0] : mimeTypes));
            }
        }
        this.data.addEventListener('error', this._boundOnError, false);
        this.data.addEventListener('load', this._boundComplete, false);
        this.data.addEventListener('progress', this._boundOnProgress, false);
        this.data.addEventListener('canplaythrough', this._boundComplete, false);
        this.data.load();
        if (this.timeout) {
            this._elementTimer = setTimeout(this._boundOnTimeout, this.timeout);
        }
    };
    /**
     * Loads this resources using an XMLHttpRequest.
     */
    LoaderResource.prototype._loadXhr = function () {
        // if unset, determine the value
        if (typeof this.xhrType !== 'string') {
            this.xhrType = this._determineXhrType();
        }
        var xhr = this.xhr = new XMLHttpRequest();
        // set the request type and url
        xhr.open('GET', this.url, true);
        xhr.timeout = this.timeout;
        // load json as text and parse it ourselves. We do this because some browsers
        // *cough* safari *cough* can't deal with it.
        if (this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.JSON
            || this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT) {
            xhr.responseType = LoaderResource.XHR_RESPONSE_TYPE.TEXT;
        }
        else {
            xhr.responseType = this.xhrType;
        }
        xhr.addEventListener('error', this._boundXhrOnError, false);
        xhr.addEventListener('timeout', this._boundXhrOnTimeout, false);
        xhr.addEventListener('abort', this._boundXhrOnAbort, false);
        xhr.addEventListener('progress', this._boundOnProgress, false);
        xhr.addEventListener('load', this._boundXhrOnLoad, false);
        xhr.send();
    };
    /**
     * Loads this resources using an XDomainRequest. This is here because we need to support IE9 (gross).
     */
    LoaderResource.prototype._loadXdr = function () {
        // if unset, determine the value
        if (typeof this.xhrType !== 'string') {
            this.xhrType = this._determineXhrType();
        }
        var xdr = this.xhr = new self.XDomainRequest(); // eslint-disable-line no-undef
        // XDomainRequest has a few quirks. Occasionally it will abort requests
        // A way to avoid this is to make sure ALL callbacks are set even if not used
        // More info here: http://stackoverflow.com/questions/15786966/xdomainrequest-aborts-post-on-ie-9
        xdr.timeout = this.timeout || 5000; // XDR needs a timeout value or it breaks in IE9
        xdr.onerror = this._boundXhrOnError;
        xdr.ontimeout = this._boundXhrOnTimeout;
        xdr.onprogress = this._boundOnProgress;
        xdr.onload = this._boundXhrOnLoad;
        xdr.open('GET', this.url, true);
        // Note: The xdr.send() call is wrapped in a timeout to prevent an
        // issue with the interface where some requests are lost if multiple
        // XDomainRequests are being sent at the same time.
        // Some info here: https://github.com/photonstorm/phaser/issues/1248
        setTimeout(function () { return xdr.send(); }, 1);
    };
    /**
     * Creates a source used in loading via an element.
     * @param type - The element type (video or audio).
     * @param url - The source URL to load from.
     * @param [mime] - The mime type of the video
     * @return The source element.
     */
    LoaderResource.prototype._createSource = function (type, url, mime) {
        if (!mime) {
            mime = type + "/" + this._getExtension(url);
        }
        var source = document.createElement('source');
        source.src = url;
        source.type = mime;
        return source;
    };
    /**
     * Called if a load errors out.
     *
     * @param event - The error event from the element that emits it.
     */
    LoaderResource.prototype._onError = function (event) {
        this.abort("Failed to load element using: " + event.target.nodeName);
    };
    /**
     * Called if a load progress event fires for an element or xhr/xdr.
     * @param event - Progress event.
     */
    LoaderResource.prototype._onProgress = function (event) {
        if (event && event.lengthComputable) {
            this.onProgress.dispatch(this, event.loaded / event.total);
        }
    };
    /**
     * Called if a timeout event fires for an element.
     */
    LoaderResource.prototype._onTimeout = function () {
        this.abort("Load timed out.");
    };
    /**
     * Called if an error event fires for xhr/xdr.
     */
    LoaderResource.prototype._xhrOnError = function () {
        var xhr = this.xhr;
        this.abort(reqType(xhr) + " Request failed. Status: " + xhr.status + ", text: \"" + xhr.statusText + "\"");
    };
    /**
     * Called if an error event fires for xhr/xdr.
     */
    LoaderResource.prototype._xhrOnTimeout = function () {
        var xhr = this.xhr;
        this.abort(reqType(xhr) + " Request timed out.");
    };
    /**
     * Called if an abort event fires for xhr/xdr.
     */
    LoaderResource.prototype._xhrOnAbort = function () {
        var xhr = this.xhr;
        this.abort(reqType(xhr) + " Request was aborted by the user.");
    };
    /**
     * Called when data successfully loads from an xhr/xdr request.
     */
    LoaderResource.prototype._xhrOnLoad = function () {
        var xhr = this.xhr;
        var text = '';
        var status = typeof xhr.status === 'undefined' ? STATUS_OK : xhr.status; // XDR has no `.status`, assume 200.
        // responseText is accessible only if responseType is '' or 'text' and on older browsers
        if (xhr.responseType === '' || xhr.responseType === 'text' || typeof xhr.responseType === 'undefined') {
            text = xhr.responseText;
        }
        // status can be 0 when using the `file://` protocol so we also check if a response is set.
        // If it has a response, we assume 200; otherwise a 0 status code with no contents is an aborted request.
        if (status === STATUS_NONE && (text.length > 0 || xhr.responseType === LoaderResource.XHR_RESPONSE_TYPE.BUFFER)) {
            status = STATUS_OK;
        }
        // handle IE9 bug: http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
        else if (status === STATUS_IE_BUG_EMPTY) {
            status = STATUS_EMPTY;
        }
        var statusType = (status / 100) | 0;
        if (statusType === STATUS_TYPE_OK) {
            // if text, just return it
            if (this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.TEXT) {
                this.data = text;
                this.type = LoaderResource.TYPE.TEXT;
            }
            // if json, parse into json object
            else if (this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.JSON) {
                try {
                    this.data = JSON.parse(text);
                    this.type = LoaderResource.TYPE.JSON;
                }
                catch (e) {
                    this.abort("Error trying to parse loaded json: " + e);
                    return;
                }
            }
            // if xml, parse into an xml document or div element
            else if (this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT) {
                try {
                    if (self.DOMParser) {
                        var domparser = new DOMParser();
                        this.data = domparser.parseFromString(text, 'text/xml');
                    }
                    else {
                        var div = document.createElement('div');
                        div.innerHTML = text;
                        this.data = div;
                    }
                    this.type = LoaderResource.TYPE.XML;
                }
                catch (e$1) {
                    this.abort("Error trying to parse loaded xml: " + e$1);
                    return;
                }
            }
            // other types just return the response
            else {
                this.data = xhr.response || text;
            }
        }
        else {
            this.abort("[" + xhr.status + "] " + xhr.statusText + ": " + xhr.responseURL);
            return;
        }
        this.complete();
    };
    /**
     * Sets the `crossOrigin` property for this resource based on if the url
     * for this resource is cross-origin. If crossOrigin was manually set, this
     * function does nothing.
     * @private
     * @param url - The url to test.
     * @param [loc=self.location] - The location object to test against.
     * @return The crossOrigin value to use (or empty string for none).
     */
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    LoaderResource.prototype._determineCrossOrigin = function (url, loc) {
        // data: and javascript: urls are considered same-origin
        if (url.indexOf('data:') === 0) {
            return '';
        }
        // A sandboxed iframe without the 'allow-same-origin' attribute will have a special
        // origin designed not to match self.location.origin, and will always require
        // crossOrigin requests regardless of whether the location matches.
        if (self.origin !== self.location.origin) {
            return 'anonymous';
        }
        // default is self.location
        loc = loc || self.location;
        if (!tempAnchor) {
            tempAnchor = document.createElement('a');
        }
        // let the browser determine the full href for the url of this resource and then
        // parse with the node url lib, we can't use the properties of the anchor element
        // because they don't work in IE9 :(
        tempAnchor.href = url;
        var parsedUrl = parseUri(tempAnchor.href, { strictMode: true });
        var samePort = (!parsedUrl.port && loc.port === '') || (parsedUrl.port === loc.port);
        var protocol = parsedUrl.protocol ? parsedUrl.protocol + ":" : '';
        // if cross origin
        if (parsedUrl.host !== loc.hostname || !samePort || protocol !== loc.protocol) {
            return 'anonymous';
        }
        return '';
    };
    /**
     * Determines the responseType of an XHR request based on the extension of the
     * resource being loaded.
     *
     * @private
     * @return {PIXI.LoaderResource.XHR_RESPONSE_TYPE} The responseType to use.
     */
    LoaderResource.prototype._determineXhrType = function () {
        return LoaderResource._xhrTypeMap[this.extension] || LoaderResource.XHR_RESPONSE_TYPE.TEXT;
    };
    /**
     * Determines the loadType of a resource based on the extension of the
     * resource being loaded.
     *
     * @private
     * @return {PIXI.LoaderResource.LOAD_TYPE} The loadType to use.
     */
    LoaderResource.prototype._determineLoadType = function () {
        return LoaderResource._loadTypeMap[this.extension] || LoaderResource.LOAD_TYPE.XHR;
    };
    /**
     * Extracts the extension (sans '.') of the file being loaded by the resource.
     *
     * @param [url] - url to parse, `this.url` by default.
     * @return The extension.
     */
    LoaderResource.prototype._getExtension = function (url) {
        if (url === void 0) { url = this.url; }
        var ext = '';
        if (this.isDataUrl) {
            var slashIndex = url.indexOf('/');
            ext = url.substring(slashIndex + 1, url.indexOf(';', slashIndex));
        }
        else {
            var queryStart = url.indexOf('?');
            var hashStart = url.indexOf('#');
            var index = Math.min(queryStart > -1 ? queryStart : url.length, hashStart > -1 ? hashStart : url.length);
            url = url.substring(0, index);
            ext = url.substring(url.lastIndexOf('.') + 1);
        }
        return ext.toLowerCase();
    };
    /**
     * Determines the mime type of an XHR request based on the responseType of
     * resource being loaded.
     *
     * @param type - The type to get a mime type for.
     * @private
     * @return The mime type to use.
     */
    LoaderResource.prototype._getMimeFromXhrType = function (type) {
        switch (type) {
            case LoaderResource.XHR_RESPONSE_TYPE.BUFFER:
                return 'application/octet-binary';
            case LoaderResource.XHR_RESPONSE_TYPE.BLOB:
                return 'application/blob';
            case LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT:
                return 'application/xml';
            case LoaderResource.XHR_RESPONSE_TYPE.JSON:
                return 'application/json';
            case LoaderResource.XHR_RESPONSE_TYPE.DEFAULT:
            case LoaderResource.XHR_RESPONSE_TYPE.TEXT:
            /* falls through */
            default:
                return 'text/plain';
        }
    };
    return LoaderResource;
}());
// eslint-disable-next-line @typescript-eslint/no-namespace
(function (LoaderResource) {
    (function (STATUS_FLAGS) {
        /** None */
        STATUS_FLAGS[STATUS_FLAGS["NONE"] = 0] = "NONE";
        /** Data URL */
        STATUS_FLAGS[STATUS_FLAGS["DATA_URL"] = 1] = "DATA_URL";
        /** Complete */
        STATUS_FLAGS[STATUS_FLAGS["COMPLETE"] = 2] = "COMPLETE";
        /** Loading */
        STATUS_FLAGS[STATUS_FLAGS["LOADING"] = 4] = "LOADING";
    })(LoaderResource.STATUS_FLAGS || (LoaderResource.STATUS_FLAGS = {}));
    (function (TYPE) {
        /** Unknown */
        TYPE[TYPE["UNKNOWN"] = 0] = "UNKNOWN";
        /** JSON */
        TYPE[TYPE["JSON"] = 1] = "JSON";
        /** XML */
        TYPE[TYPE["XML"] = 2] = "XML";
        /** Image */
        TYPE[TYPE["IMAGE"] = 3] = "IMAGE";
        /** Audio */
        TYPE[TYPE["AUDIO"] = 4] = "AUDIO";
        /** Video */
        TYPE[TYPE["VIDEO"] = 5] = "VIDEO";
        /** Plain text */
        TYPE[TYPE["TEXT"] = 6] = "TEXT";
    })(LoaderResource.TYPE || (LoaderResource.TYPE = {}));
    (function (LOAD_TYPE) {
        /** Uses XMLHttpRequest to load the resource. */
        LOAD_TYPE[LOAD_TYPE["XHR"] = 1] = "XHR";
        /** Uses an `Image` object to load the resource. */
        LOAD_TYPE[LOAD_TYPE["IMAGE"] = 2] = "IMAGE";
        /** Uses an `Audio` object to load the resource. */
        LOAD_TYPE[LOAD_TYPE["AUDIO"] = 3] = "AUDIO";
        /** Uses a `Video` object to load the resource. */
        LOAD_TYPE[LOAD_TYPE["VIDEO"] = 4] = "VIDEO";
    })(LoaderResource.LOAD_TYPE || (LoaderResource.LOAD_TYPE = {}));
    (function (XHR_RESPONSE_TYPE) {
        /** string */
        XHR_RESPONSE_TYPE["DEFAULT"] = "text";
        /** ArrayBuffer */
        XHR_RESPONSE_TYPE["BUFFER"] = "arraybuffer";
        /** Blob */
        XHR_RESPONSE_TYPE["BLOB"] = "blob";
        /** Document */
        XHR_RESPONSE_TYPE["DOCUMENT"] = "document";
        /** Object */
        XHR_RESPONSE_TYPE["JSON"] = "json";
        /** String */
        XHR_RESPONSE_TYPE["TEXT"] = "text";
    })(LoaderResource.XHR_RESPONSE_TYPE || (LoaderResource.XHR_RESPONSE_TYPE = {}));
    LoaderResource._loadTypeMap = {
        // images
        gif: LoaderResource.LOAD_TYPE.IMAGE,
        png: LoaderResource.LOAD_TYPE.IMAGE,
        bmp: LoaderResource.LOAD_TYPE.IMAGE,
        jpg: LoaderResource.LOAD_TYPE.IMAGE,
        jpeg: LoaderResource.LOAD_TYPE.IMAGE,
        tif: LoaderResource.LOAD_TYPE.IMAGE,
        tiff: LoaderResource.LOAD_TYPE.IMAGE,
        webp: LoaderResource.LOAD_TYPE.IMAGE,
        tga: LoaderResource.LOAD_TYPE.IMAGE,
        svg: LoaderResource.LOAD_TYPE.IMAGE,
        'svg+xml': LoaderResource.LOAD_TYPE.IMAGE,
        // audio
        mp3: LoaderResource.LOAD_TYPE.AUDIO,
        ogg: LoaderResource.LOAD_TYPE.AUDIO,
        wav: LoaderResource.LOAD_TYPE.AUDIO,
        // videos
        mp4: LoaderResource.LOAD_TYPE.VIDEO,
        webm: LoaderResource.LOAD_TYPE.VIDEO,
    };
    LoaderResource._xhrTypeMap = {
        // xml
        xhtml: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        html: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        htm: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        xml: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        tmx: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        svg: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        // This was added to handle Tiled Tileset XML, but .tsx is also a TypeScript React Component.
        // Since it is way less likely for people to be loading TypeScript files instead of Tiled files,
        // this should probably be fine.
        tsx: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        // images
        gif: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        png: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        bmp: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        jpg: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        jpeg: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        tif: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        tiff: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        webp: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        tga: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        // json
        json: LoaderResource.XHR_RESPONSE_TYPE.JSON,
        // text
        text: LoaderResource.XHR_RESPONSE_TYPE.TEXT,
        txt: LoaderResource.XHR_RESPONSE_TYPE.TEXT,
        // fonts
        ttf: LoaderResource.XHR_RESPONSE_TYPE.BUFFER,
        otf: LoaderResource.XHR_RESPONSE_TYPE.BUFFER,
    };
    // We can't set the `src` attribute to empty string, so on abort we set it to this 1px transparent gif
    LoaderResource.EMPTY_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
})(LoaderResource || (LoaderResource = {}));

/**
 * Smaller version of the async library constructs.
 * @ignore
 */
function _noop$1() {
}
/**
 * Ensures a function is only called once.
 * @ignore
 * @param {function} fn - The function to wrap.
 * @return {function} The wrapping function.
 */
function onlyOnce(fn) {
    return function onceWrapper() {
        var arguments$1 = arguments;

        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments$1[_i];
        }
        if (fn === null) {
            throw new Error('Callback was already called.');
        }
        var callFn = fn;
        fn = null;
        callFn.apply(this, args);
    };
}
/**
 * @private
 * @memberof PIXI
 */
var AsyncQueueItem = /** @class */ (function () {
    /**
     * @private
     */
    function AsyncQueueItem(data, callback) {
        this.data = data;
        this.callback = callback;
    }
    return AsyncQueueItem;
}());
/**
 * @private
 * @memberof PIXI
 */
var AsyncQueue = /** @class */ (function () {
    /**
     * @private
     */
    function AsyncQueue(worker, concurrency) {
        var _this = this;
        if (concurrency === void 0) { concurrency = 1; }
        this.workers = 0;
        this.saturated = _noop$1;
        this.unsaturated = _noop$1;
        this.empty = _noop$1;
        this.drain = _noop$1;
        this.error = _noop$1;
        this.started = false;
        this.paused = false;
        this._tasks = [];
        this._insert = function (data, insertAtFront, callback) {
            if (callback && typeof callback !== 'function') {
                throw new Error('task callback must be a function');
            }
            _this.started = true;
            // eslint-disable-next-line no-eq-null,eqeqeq
            if (data == null && _this.idle()) {
                // call drain immediately if there are no tasks
                setTimeout(function () { return _this.drain(); }, 1);
                return;
            }
            var item = new AsyncQueueItem(data, typeof callback === 'function' ? callback : _noop$1);
            if (insertAtFront) {
                _this._tasks.unshift(item);
            }
            else {
                _this._tasks.push(item);
            }
            setTimeout(_this.process, 1);
        };
        this.process = function () {
            while (!_this.paused && _this.workers < _this.concurrency && _this._tasks.length) {
                var task = _this._tasks.shift();
                if (_this._tasks.length === 0) {
                    _this.empty();
                }
                _this.workers += 1;
                if (_this.workers === _this.concurrency) {
                    _this.saturated();
                }
                _this._worker(task.data, onlyOnce(_this._next(task)));
            }
        };
        this._worker = worker;
        if (concurrency === 0) {
            throw new Error('Concurrency must not be zero');
        }
        this.concurrency = concurrency;
        this.buffer = concurrency / 4.0;
    }
    /**
     * @private
     */
    AsyncQueue.prototype._next = function (task) {
        var _this = this;
        return function () {
            var arguments$1 = arguments;

            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments$1[_i];
            }
            _this.workers -= 1;
            task.callback.apply(task, args);
            // eslint-disable-next-line no-eq-null,eqeqeq
            if (args[0] != null) {
                _this.error(args[0], task.data);
            }
            if (_this.workers <= (_this.concurrency - _this.buffer)) {
                _this.unsaturated();
            }
            if (_this.idle()) {
                _this.drain();
            }
            _this.process();
        };
    };
    // That was in object
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    AsyncQueue.prototype.push = function (data, callback) {
        this._insert(data, false, callback);
    };
    AsyncQueue.prototype.kill = function () {
        this.workers = 0;
        this.drain = _noop$1;
        this.started = false;
        this._tasks = [];
    };
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    AsyncQueue.prototype.unshift = function (data, callback) {
        this._insert(data, true, callback);
    };
    AsyncQueue.prototype.length = function () {
        return this._tasks.length;
    };
    AsyncQueue.prototype.running = function () {
        return this.workers;
    };
    AsyncQueue.prototype.idle = function () {
        return this._tasks.length + this.workers === 0;
    };
    AsyncQueue.prototype.pause = function () {
        if (this.paused === true) {
            return;
        }
        this.paused = true;
    };
    AsyncQueue.prototype.resume = function () {
        if (this.paused === false) {
            return;
        }
        this.paused = false;
        // Need to call this.process once per concurrent
        // worker to preserve full concurrency after pause
        for (var w = 1; w <= this.concurrency; w++) {
            this.process();
        }
    };
    /**
     * Iterates an array in series.
     *
     * @param {Array.<*>} array - Array to iterate.
     * @param {function} iterator - Function to call for each element.
     * @param {function} callback - Function to call when done, or on error.
     * @param {boolean} [deferNext=false] - Break synchronous each loop by calling next with a setTimeout of 1.
     */
    AsyncQueue.eachSeries = function (array, iterator, callback, deferNext) {
        var i = 0;
        var len = array.length;
        function next(err) {
            if (err || i === len) {
                if (callback) {
                    callback(err);
                }
                return;
            }
            if (deferNext) {
                setTimeout(function () {
                    iterator(array[i++], next);
                }, 1);
            }
            else {
                iterator(array[i++], next);
            }
        }
        next();
    };
    /**
     * Async queue implementation,
     *
     * @param {function} worker - The worker function to call for each task.
     * @param {number} concurrency - How many workers to run in parrallel.
     * @return {*} The async queue object.
     */
    AsyncQueue.queue = function (worker, concurrency) {
        return new AsyncQueue(worker, concurrency);
    };
    return AsyncQueue;
}());

// some constants
var MAX_PROGRESS = 100;
var rgxExtractUrlHash = /(#[\w-]+)?$/;
/**
 * The new loader, forked from Resource Loader by Chad Engler: https://github.com/englercj/resource-loader
 *
 * ```js
 * const loader = PIXI.Loader.shared; // PixiJS exposes a premade instance for you to use.
 * //or
 * const loader = new PIXI.Loader(); // you can also create your own if you want
 *
 * const sprites = {};
 *
 * // Chainable `add` to enqueue a resource
 * loader.add('bunny', 'data/bunny.png')
 *       .add('spaceship', 'assets/spritesheet.json');
 * loader.add('scoreFont', 'assets/score.fnt');
 *
 * // Chainable `pre` to add a middleware that runs for each resource, *before* loading that resource.
 * // This is useful to implement custom caching modules (using filesystem, indexeddb, memory, etc).
 * loader.pre(cachingMiddleware);
 *
 * // Chainable `use` to add a middleware that runs for each resource, *after* loading that resource.
 * // This is useful to implement custom parsing modules (like spritesheet parsers, spine parser, etc).
 * loader.use(parsingMiddleware);
 *
 * // The `load` method loads the queue of resources, and calls the passed in callback called once all
 * // resources have loaded.
 * loader.load((loader, resources) => {
 *     // resources is an object where the key is the name of the resource loaded and the value is the resource object.
 *     // They have a couple default properties:
 *     // - `url`: The URL that the resource was loaded from
 *     // - `error`: The error that happened when trying to load (if any)
 *     // - `data`: The raw data that was loaded
 *     // also may contain other properties based on the middleware that runs.
 *     sprites.bunny = new PIXI.TilingSprite(resources.bunny.texture);
 *     sprites.spaceship = new PIXI.TilingSprite(resources.spaceship.texture);
 *     sprites.scoreFont = new PIXI.TilingSprite(resources.scoreFont.texture);
 * });
 *
 * // throughout the process multiple signals can be dispatched.
 * loader.onProgress.add(() => {}); // called once per loaded/errored file
 * loader.onError.add(() => {}); // called once per errored file
 * loader.onLoad.add(() => {}); // called once per loaded file
 * loader.onComplete.add(() => {}); // called once when the queued resources all load.
 * ```
 *
 * @class Loader
 * @memberof PIXI
 */
var Loader = /** @class */ (function () {
    /**
     * @param baseUrl - The base url for all resources loaded by this loader.
     * @param concurrency - The number of resources to load concurrently.
     */
    function Loader(baseUrl, concurrency) {
        var _this = this;
        if (baseUrl === void 0) { baseUrl = ''; }
        if (concurrency === void 0) { concurrency = 10; }
        /**
         * The middleware to run before loading each resource.
         */
        this._beforeMiddleware = [];
        /**
         * The middleware to run after loading each resource.
         */
        this._afterMiddleware = [];
        /**
         * The tracks the resources we are currently completing parsing for.
         */
        this._resourcesParsing = [];
        /**
         * The `_loadResource` function bound with this object context.
         *
         * @private
         * @member {function}
         * @param {PIXI.LoaderResource} r - The resource to load
         * @param {Function} d - The dequeue function
         * @return {undefined}
         */
        this._boundLoadResource = function (r, d) { return _this._loadResource(r, d); };
        /**
         * All the resources for this loader keyed by name.
         *
         * @member {object<string, PIXI.LoaderResource>}
         */
        this.resources = {};
        this.baseUrl = baseUrl;
        this.progress = 0;
        this.loading = false;
        this.defaultQueryString = '';
        this._beforeMiddleware = [];
        this._afterMiddleware = [];
        this._resourcesParsing = [];
        this._boundLoadResource = function (r, d) { return _this._loadResource(r, d); };
        this._queue = AsyncQueue.queue(this._boundLoadResource, concurrency);
        this._queue.pause();
        this.resources = {};
        this.onProgress = new Signal();
        this.onError = new Signal();
        this.onLoad = new Signal();
        this.onStart = new Signal();
        this.onComplete = new Signal();
        for (var i = 0; i < Loader._plugins.length; ++i) {
            var plugin = Loader._plugins[i];
            var pre = plugin.pre, use = plugin.use;
            if (pre) {
                this.pre(pre);
            }
            if (use) {
                this.use(use);
            }
        }
        this._protected = false;
    }
    /**
     * Same as add, params have strict order
     * @private
     * @param name - The name of the resource to load.
     * @param url - The url for this resource, relative to the baseUrl of this loader.
     * @param options - The options for the load.
     * @param callback - Function to call when this specific resource completes loading.
     * @return {this} Returns itself.
     */
    Loader.prototype._add = function (name, url, options, callback) {
        // if loading already you can only add resources that have a parent.
        if (this.loading && (!options || !options.parentResource)) {
            throw new Error('Cannot add resources while the loader is running.');
        }
        // check if resource already exists.
        if (this.resources[name]) {
            throw new Error("Resource named \"" + name + "\" already exists.");
        }
        // add base url if this isn't an absolute url
        url = this._prepareUrl(url);
        // create the store the resource
        this.resources[name] = new LoaderResource(name, url, options);
        if (typeof callback === 'function') {
            this.resources[name].onAfterMiddleware.once(callback);
        }
        // if actively loading, make sure to adjust progress chunks for that parent and its children
        if (this.loading) {
            var parent = options.parentResource;
            var incompleteChildren = [];
            for (var i = 0; i < parent.children.length; ++i) {
                if (!parent.children[i].isComplete) {
                    incompleteChildren.push(parent.children[i]);
                }
            }
            var fullChunk = parent.progressChunk * (incompleteChildren.length + 1); // +1 for parent
            var eachChunk = fullChunk / (incompleteChildren.length + 2); // +2 for parent & new child
            parent.children.push(this.resources[name]);
            parent.progressChunk = eachChunk;
            for (var i = 0; i < incompleteChildren.length; ++i) {
                incompleteChildren[i].progressChunk = eachChunk;
            }
            this.resources[name].progressChunk = eachChunk;
        }
        // add the resource to the queue
        this._queue.push(this.resources[name]);
        return this;
    };
    /* eslint-enable require-jsdoc,valid-jsdoc */
    /**
     * Sets up a middleware function that will run *before* the
     * resource is loaded.
     *
     * @param fn - The middleware function to register.
     * @return Returns itself.
     */
    Loader.prototype.pre = function (fn) {
        this._beforeMiddleware.push(fn);
        return this;
    };
    /**
     * Sets up a middleware function that will run *after* the
     * resource is loaded.
     *
     * @param fn - The middleware function to register.
     * @return Returns itself.
     */
    Loader.prototype.use = function (fn) {
        this._afterMiddleware.push(fn);
        return this;
    };
    /**
     * Resets the queue of the loader to prepare for a new load.
     *
     * @return Returns itself.
     */
    Loader.prototype.reset = function () {
        this.progress = 0;
        this.loading = false;
        this._queue.kill();
        this._queue.pause();
        // abort all resource loads
        for (var k in this.resources) {
            var res = this.resources[k];
            if (res._onLoadBinding) {
                res._onLoadBinding.detach();
            }
            if (res.isLoading) {
                res.abort('loader reset');
            }
        }
        this.resources = {};
        return this;
    };
    /**
     * Starts loading the queued resources.
     * @param [cb] - Optional callback that will be bound to the `complete` event.
     * @return Returns itself.
     */
    Loader.prototype.load = function (cb) {
        // register complete callback if they pass one
        if (typeof cb === 'function') {
            this.onComplete.once(cb);
        }
        // if the queue has already started we are done here
        if (this.loading) {
            return this;
        }
        if (this._queue.idle()) {
            this._onStart();
            this._onComplete();
        }
        else {
            // distribute progress chunks
            var numTasks = this._queue._tasks.length;
            var chunk = MAX_PROGRESS / numTasks;
            for (var i = 0; i < this._queue._tasks.length; ++i) {
                this._queue._tasks[i].data.progressChunk = chunk;
            }
            // notify we are starting
            this._onStart();
            // start loading
            this._queue.resume();
        }
        return this;
    };
    Object.defineProperty(Loader.prototype, "concurrency", {
        /**
         * The number of resources to load concurrently.
         *
         * @member {number}
         * @default 10
         */
        get: function () {
            return this._queue.concurrency;
        },
        // eslint-disable-next-line require-jsdoc
        set: function (concurrency) {
            this._queue.concurrency = concurrency;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Prepares a url for usage based on the configuration of this object
     * @param url - The url to prepare.
     * @return The prepared url.
     */
    Loader.prototype._prepareUrl = function (url) {
        var parsedUrl = parseUri(url, { strictMode: true });
        var result;
        // absolute url, just use it as is.
        if (parsedUrl.protocol || !parsedUrl.path || url.indexOf('//') === 0) {
            result = url;
        }
        // if baseUrl doesn't end in slash and url doesn't start with slash, then add a slash inbetween
        else if (this.baseUrl.length
            && this.baseUrl.lastIndexOf('/') !== this.baseUrl.length - 1
            && url.charAt(0) !== '/') {
            result = this.baseUrl + "/" + url;
        }
        else {
            result = this.baseUrl + url;
        }
        // if we need to add a default querystring, there is a bit more work
        if (this.defaultQueryString) {
            var hash = rgxExtractUrlHash.exec(result)[0];
            result = result.substr(0, result.length - hash.length);
            if (result.indexOf('?') !== -1) {
                result += "&" + this.defaultQueryString;
            }
            else {
                result += "?" + this.defaultQueryString;
            }
            result += hash;
        }
        return result;
    };
    /**
     * Loads a single resource.
     *
     * @private
     * @param {PIXI.LoaderResource} resource - The resource to load.
     * @param {function} dequeue - The function to call when we need to dequeue this item.
     */
    Loader.prototype._loadResource = function (resource, dequeue) {
        var _this = this;
        resource._dequeue = dequeue;
        // run before middleware
        AsyncQueue.eachSeries(this._beforeMiddleware, function (fn, next) {
            fn.call(_this, resource, function () {
                // if the before middleware marks the resource as complete,
                // break and don't process any more before middleware
                next(resource.isComplete ? {} : null);
            });
        }, function () {
            if (resource.isComplete) {
                _this._onLoad(resource);
            }
            else {
                resource._onLoadBinding = resource.onComplete.once(_this._onLoad, _this);
                resource.load();
            }
        }, true);
    };
    /**
     * Called once loading has started.
     */
    Loader.prototype._onStart = function () {
        this.progress = 0;
        this.loading = true;
        this.onStart.dispatch(this);
    };
    /**
     * Called once each resource has loaded.
     */
    Loader.prototype._onComplete = function () {
        this.progress = MAX_PROGRESS;
        this.loading = false;
        this.onComplete.dispatch(this, this.resources);
    };
    /**
     * Called each time a resources is loaded.
     * @param resource - The resource that was loaded
     */
    Loader.prototype._onLoad = function (resource) {
        var _this = this;
        resource._onLoadBinding = null;
        // remove this resource from the async queue, and add it to our list of resources that are being parsed
        this._resourcesParsing.push(resource);
        resource._dequeue();
        // run all the after middleware for this resource
        AsyncQueue.eachSeries(this._afterMiddleware, function (fn, next) {
            fn.call(_this, resource, next);
        }, function () {
            resource.onAfterMiddleware.dispatch(resource);
            _this.progress = Math.min(MAX_PROGRESS, _this.progress + resource.progressChunk);
            _this.onProgress.dispatch(_this, resource);
            if (resource.error) {
                _this.onError.dispatch(resource.error, _this, resource);
            }
            else {
                _this.onLoad.dispatch(_this, resource);
            }
            _this._resourcesParsing.splice(_this._resourcesParsing.indexOf(resource), 1);
            // do completion check
            if (_this._queue.idle() && _this._resourcesParsing.length === 0) {
                _this._onComplete();
            }
        }, true);
    };
    /**
     * Destroy the loader, removes references.
     */
    Loader.prototype.destroy = function () {
        if (!this._protected) {
            this.reset();
        }
    };
    Object.defineProperty(Loader, "shared", {
        /**
         * A premade instance of the loader that can be used to load resources.
         */
        get: function () {
            var shared = Loader._shared;
            if (!shared) {
                shared = new Loader();
                shared._protected = true;
                Loader._shared = shared;
            }
            return shared;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Adds a Loader plugin for the global shared loader and all
     * new Loader instances created.
     *
     * @param plugin - The plugin to add
     * @return Reference to PIXI.Loader for chaining
     */
    Loader.registerPlugin = function (plugin) {
        Loader._plugins.push(plugin);
        if (plugin.add) {
            plugin.add();
        }
        return Loader;
    };
    Loader._plugins = [];
    return Loader;
}());
Loader.prototype.add = function add(name, url, options, callback) {
    // special case of an array of objects or urls
    if (Array.isArray(name)) {
        for (var i = 0; i < name.length; ++i) {
            this.add(name[i]);
        }
        return this;
    }
    // if an object is passed instead of params
    if (typeof name === 'object') {
        options = name;
        callback = url || options.callback || options.onComplete;
        url = options.url;
        name = options.name || options.key || options.url;
    }
    // case where no name is passed shift all args over by one.
    if (typeof url !== 'string') {
        callback = options;
        options = url;
        url = name;
    }
    // now that we shifted make sure we have a proper url.
    if (typeof url !== 'string') {
        throw new Error('No url passed to add resource to loader.');
    }
    // options are optional so people might pass a function and no options
    if (typeof options === 'function') {
        callback = options;
        options = null;
    }
    return this._add(name, url, options, callback);
};

/**
 * Application plugin for supporting loader option. Installing the LoaderPlugin
 * is not necessary if using **pixi.js** or **pixi.js-legacy**.
 * @example
 * import {AppLoaderPlugin} from '@pixi/loaders';
 * import {Application} from '@pixi/app';
 * Application.registerPlugin(AppLoaderPlugin);
 * @class
 * @memberof PIXI
 */
var AppLoaderPlugin = /** @class */ (function () {
    function AppLoaderPlugin() {
    }
    /**
     * Called on application constructor
     * @param {object} options
     * @private
     */
    AppLoaderPlugin.init = function (options) {
        options = Object.assign({
            sharedLoader: false,
        }, options);
        /**
         * Loader instance to help with asset loading.
         * @memberof PIXI.Application#
         * @type {PIXI.Loader}
         * @readonly
         */
        this.loader = options.sharedLoader ? Loader.shared : new Loader();
    };
    /**
     * Called when application destroyed
     *
     * @private
     */
    AppLoaderPlugin.destroy = function () {
        if (this.loader) {
            this.loader.destroy();
            this.loader = null;
        }
    };
    return AppLoaderPlugin;
}());

/**
 * Loader plugin for handling Texture resources.
 *
 * @memberof PIXI
 */
var TextureLoader = /** @class */ (function () {
    function TextureLoader() {
    }
    /**
     * Handle SVG elements a text, render with SVGResource.
     */
    TextureLoader.add = function () {
        LoaderResource.setExtensionLoadType('svg', LoaderResource.LOAD_TYPE.XHR);
        LoaderResource.setExtensionXhrType('svg', LoaderResource.XHR_RESPONSE_TYPE.TEXT);
    };
    /**
     * Called after a resource is loaded.
     * @see PIXI.Loader.loaderMiddleware
     * @param resource
     * @param {function} next
     */
    TextureLoader.use = function (resource, next) {
        // create a new texture if the data is an Image object
        if (resource.data && (resource.type === LoaderResource.TYPE.IMAGE || resource.extension === 'svg')) {
            var data = resource.data, url = resource.url, name = resource.name, metadata = resource.metadata;
            Texture.fromLoader(data, url, name, metadata).then(function (texture) {
                resource.texture = texture;
                next();
            })
                // TODO: handle errors in Texture.fromLoader
                // so we can pass them to the Loader
                .catch(next);
        }
        else {
            next();
        }
    };
    return TextureLoader;
}());

var _keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
/**
 * Encodes binary into base64.
 *
 * @function encodeBinary
 * @param {string} input - The input data to encode.
 * @returns {string} The encoded base64 string
 */
function encodeBinary(input) {
    var output = '';
    var inx = 0;
    while (inx < input.length) {
        // Fill byte buffer array
        var bytebuffer = [0, 0, 0];
        var encodedCharIndexes = [0, 0, 0, 0];
        for (var jnx = 0; jnx < bytebuffer.length; ++jnx) {
            if (inx < input.length) {
                // throw away high-order byte, as documented at:
                // https://developer.mozilla.org/En/Using_XMLHttpRequest#Handling_binary_data
                bytebuffer[jnx] = input.charCodeAt(inx++) & 0xff;
            }
            else {
                bytebuffer[jnx] = 0;
            }
        }
        // Get each encoded character, 6 bits at a time
        // index 1: first 6 bits
        encodedCharIndexes[0] = bytebuffer[0] >> 2;
        // index 2: second 6 bits (2 least significant bits from input byte 1 + 4 most significant bits from byte 2)
        encodedCharIndexes[1] = ((bytebuffer[0] & 0x3) << 4) | (bytebuffer[1] >> 4);
        // index 3: third 6 bits (4 least significant bits from input byte 2 + 2 most significant bits from byte 3)
        encodedCharIndexes[2] = ((bytebuffer[1] & 0x0f) << 2) | (bytebuffer[2] >> 6);
        // index 3: forth 6 bits (6 least significant bits from input byte 3)
        encodedCharIndexes[3] = bytebuffer[2] & 0x3f;
        // Determine whether padding happened, and adjust accordingly
        var paddingBytes = inx - (input.length - 1);
        switch (paddingBytes) {
            case 2:
                // Set last 2 characters to padding char
                encodedCharIndexes[3] = 64;
                encodedCharIndexes[2] = 64;
                break;
            case 1:
                // Set last character to padding char
                encodedCharIndexes[3] = 64;
                break;
        }
        // Now we will grab each appropriate character out of our keystring
        // based on our index array and append it to the output string
        for (var jnx = 0; jnx < encodedCharIndexes.length; ++jnx) {
            output += _keyStr.charAt(encodedCharIndexes[jnx]);
        }
    }
    return output;
}

var Url = self.URL || self.webkitURL;
/**
 * A middleware for transforming XHR loaded Blobs into more useful objects
 *
 * @ignore
 * @function parsing
 * @example
 * import { Loader, middleware } from 'resource-loader';
 * const loader = new Loader();
 * loader.use(middleware.parsing);
 * @param resource - Current Resource
 * @param next - Callback when complete
 */
function parsing(resource, next) {
    if (!resource.data) {
        next();
        return;
    }
    // if this was an XHR load of a blob
    if (resource.xhr && resource.xhrType === LoaderResource.XHR_RESPONSE_TYPE.BLOB) {
        // if there is no blob support we probably got a binary string back
        if (!self.Blob || typeof resource.data === 'string') {
            var type = resource.xhr.getResponseHeader('content-type');
            // this is an image, convert the binary string into a data url
            if (type && type.indexOf('image') === 0) {
                resource.data = new Image();
                resource.data.src = "data:" + type + ";base64," + encodeBinary(resource.xhr.responseText);
                resource.type = LoaderResource.TYPE.IMAGE;
                // wait until the image loads and then callback
                resource.data.onload = function () {
                    resource.data.onload = null;
                    next();
                };
                // next will be called on load
                return;
            }
        }
        // if content type says this is an image, then we should transform the blob into an Image object
        else if (resource.data.type.indexOf('image') === 0) {
            var src_1 = Url.createObjectURL(resource.data);
            resource.blob = resource.data;
            resource.data = new Image();
            resource.data.src = src_1;
            resource.type = LoaderResource.TYPE.IMAGE;
            // cleanup the no longer used blob after the image loads
            // TODO: Is this correct? Will the image be invalid after revoking?
            resource.data.onload = function () {
                Url.revokeObjectURL(src_1);
                resource.data.onload = null;
                next();
            };
            // next will be called on load.
            return;
        }
    }
    next();
}

// parse any blob into more usable objects (e.g. Image)
Loader.registerPlugin({ use: parsing });
// parse any Image objects into textures
Loader.registerPlugin(TextureLoader);

/*!
 * @pixi/compressed-textures - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/compressed-textures is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

var _a;
/**
 * WebGL internal formats, including compressed texture formats provided by extensions
 *
 * @memberof PIXI
 * @static
 * @name INTERNAL_FORMATS
 * @enum {number}
 * @property {number} COMPRESSED_RGB_S3TC_DXT1_EXT=0x83F0
 * @property {number} COMPRESSED_RGBA_S3TC_DXT1_EXT=0x83F1
 * @property {number} COMPRESSED_RGBA_S3TC_DXT3_EXT=0x83F2
 * @property {number} COMPRESSED_RGBA_S3TC_DXT5_EXT=0x83F3
 * @property {number} COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT=35917
 * @property {number} COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT=35918
 * @property {number} COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT=35919
 * @property {number} COMPRESSED_SRGB_S3TC_DXT1_EXT=35916
 * @property {number} COMPRESSED_R11_EAC=0x9270
 * @property {number} COMPRESSED_SIGNED_R11_EAC=0x9271
 * @property {number} COMPRESSED_RG11_EAC=0x9272
 * @property {number} COMPRESSED_SIGNED_RG11_EAC=0x9273
 * @property {number} COMPRESSED_RGB8_ETC2=0x9274
 * @property {number} COMPRESSED_RGBA8_ETC2_EAC=0x9278
 * @property {number} COMPRESSED_SRGB8_ETC2=0x9275
 * @property {number} COMPRESSED_SRGB8_ALPHA8_ETC2_EAC=0x9279
 * @property {number} COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2=0x9276
 * @property {number} COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2=0x9277
 * @property {number} COMPRESSED_RGB_PVRTC_4BPPV1_IMG=0x8C00
 * @property {number} COMPRESSED_RGBA_PVRTC_4BPPV1_IMG=0x8C02
 * @property {number} COMPRESSED_RGB_PVRTC_2BPPV1_IMG=0x8C01
 * @property {number} COMPRESSED_RGBA_PVRTC_2BPPV1_IMG=0x8C03
 * @property {number} COMPRESSED_RGB_ETC1_WEBGL=0x8D64
 * @property {number} COMPRESSED_RGB_ATC_WEBGL=0x8C92
 * @property {number} COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL=0x8C92
 * @property {number} COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL=0x87EE
 */
var INTERNAL_FORMATS;
(function (INTERNAL_FORMATS) {
    // WEBGL_compressed_texture_s3tc
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGB_S3TC_DXT1_EXT"] = 33776] = "COMPRESSED_RGB_S3TC_DXT1_EXT";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGBA_S3TC_DXT1_EXT"] = 33777] = "COMPRESSED_RGBA_S3TC_DXT1_EXT";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGBA_S3TC_DXT3_EXT"] = 33778] = "COMPRESSED_RGBA_S3TC_DXT3_EXT";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGBA_S3TC_DXT5_EXT"] = 33779] = "COMPRESSED_RGBA_S3TC_DXT5_EXT";
    // WEBGL_compressed_texture_s3tc_srgb
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT"] = 35917] = "COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT"] = 35918] = "COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT"] = 35919] = "COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_SRGB_S3TC_DXT1_EXT"] = 35916] = "COMPRESSED_SRGB_S3TC_DXT1_EXT";
    // WEBGL_compressed_texture_etc
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_R11_EAC"] = 37488] = "COMPRESSED_R11_EAC";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_SIGNED_R11_EAC"] = 37489] = "COMPRESSED_SIGNED_R11_EAC";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RG11_EAC"] = 37490] = "COMPRESSED_RG11_EAC";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_SIGNED_RG11_EAC"] = 37491] = "COMPRESSED_SIGNED_RG11_EAC";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGB8_ETC2"] = 37492] = "COMPRESSED_RGB8_ETC2";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGBA8_ETC2_EAC"] = 37496] = "COMPRESSED_RGBA8_ETC2_EAC";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_SRGB8_ETC2"] = 37493] = "COMPRESSED_SRGB8_ETC2";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_SRGB8_ALPHA8_ETC2_EAC"] = 37497] = "COMPRESSED_SRGB8_ALPHA8_ETC2_EAC";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2"] = 37494] = "COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2"] = 37495] = "COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2";
    // WEBGL_compressed_texture_pvrtc
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGB_PVRTC_4BPPV1_IMG"] = 35840] = "COMPRESSED_RGB_PVRTC_4BPPV1_IMG";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGBA_PVRTC_4BPPV1_IMG"] = 35842] = "COMPRESSED_RGBA_PVRTC_4BPPV1_IMG";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGB_PVRTC_2BPPV1_IMG"] = 35841] = "COMPRESSED_RGB_PVRTC_2BPPV1_IMG";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGBA_PVRTC_2BPPV1_IMG"] = 35843] = "COMPRESSED_RGBA_PVRTC_2BPPV1_IMG";
    // WEBGL_compressed_texture_etc1
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGB_ETC1_WEBGL"] = 36196] = "COMPRESSED_RGB_ETC1_WEBGL";
    // WEBGL_compressed_texture_atc
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGB_ATC_WEBGL"] = 35986] = "COMPRESSED_RGB_ATC_WEBGL";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL"] = 35986] = "COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL";
    INTERNAL_FORMATS[INTERNAL_FORMATS["COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL"] = 34798] = "COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL";
})(INTERNAL_FORMATS || (INTERNAL_FORMATS = {}));
/**
 * Maps the compressed texture formats in {@link PIXI.INTERNAL_FORMATS} to the number of bytes taken by
 * each texel.
 *
 * @memberof PIXI
 * @static
 * @ignore
 */
var INTERNAL_FORMAT_TO_BYTES_PER_PIXEL = (_a = {},
    // WEBGL_compressed_texture_s3tc
    _a[INTERNAL_FORMATS.COMPRESSED_RGB_S3TC_DXT1_EXT] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT1_EXT] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT3_EXT] = 1,
    _a[INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT] = 1,
    // WEBGL_compressed_texture_s3tc
    _a[INTERNAL_FORMATS.COMPRESSED_SRGB_S3TC_DXT1_EXT] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT] = 1,
    _a[INTERNAL_FORMATS.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT] = 1,
    // WEBGL_compressed_texture_etc
    _a[INTERNAL_FORMATS.COMPRESSED_R11_EAC] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_SIGNED_R11_EAC] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_RG11_EAC] = 1,
    _a[INTERNAL_FORMATS.COMPRESSED_SIGNED_RG11_EAC] = 1,
    _a[INTERNAL_FORMATS.COMPRESSED_RGB8_ETC2] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_RGBA8_ETC2_EAC] = 1,
    _a[INTERNAL_FORMATS.COMPRESSED_SRGB8_ETC2] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC] = 1,
    _a[INTERNAL_FORMATS.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2] = 0.5,
    // WEBGL_compressed_texture_pvrtc
    _a[INTERNAL_FORMATS.COMPRESSED_RGB_PVRTC_4BPPV1_IMG] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_RGB_PVRTC_2BPPV1_IMG] = 0.25,
    _a[INTERNAL_FORMATS.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG] = 0.25,
    // WEBGL_compressed_texture_etc1
    _a[INTERNAL_FORMATS.COMPRESSED_RGB_ETC1_WEBGL] = 0.5,
    // @see https://www.khronos.org/registry/OpenGL/extensions/AMD/AMD_compressed_ATC_texture.txt
    // WEBGL_compressed_texture_atc
    _a[INTERNAL_FORMATS.COMPRESSED_RGB_ATC_WEBGL] = 0.5,
    _a[INTERNAL_FORMATS.COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL] = 1,
    _a[INTERNAL_FORMATS.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL] = 1,
    _a);

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$1 = function(d, b) {
    extendStatics$1 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$1(d, b);
};

function __extends$1(d, b) {
    extendStatics$1(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) { throw t[1]; } return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) { throw new TypeError("Generator is already executing."); }
        while (_) { try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) { return t; }
            if (y = 0, t) { op = [op[0] & 2, t.value]; }
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) { _.ops.pop(); }
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; } }
        if (op[0] & 5) { throw op[1]; } return { value: op[0] ? op[1] : void 0, done: true };
    }
}

/**
 * Resource that fetches texture data over the network and stores it in a buffer.
 *
 * @class
 * @extends PIXI.Resource
 * @memberof PIXI
 */
var BlobResource = /** @class */ (function (_super) {
    __extends$1(BlobResource, _super);
    /**
     * @param {string} url - the URL of the texture file
     * @param {boolean}[autoLoad] - whether to fetch the data immediately;
     *  you can fetch it later via {@link BlobResource#load}
     */
    function BlobResource(source, options) {
        if (options === void 0) { options = { width: 1, height: 1, autoLoad: true }; }
        var _this = this;
        var origin;
        var data;
        if (typeof source === 'string') {
            origin = source;
            data = new Uint8Array();
        }
        else {
            origin = null;
            data = source;
        }
        _this = _super.call(this, data, options) || this;
        /**
         * The URL of the texture file
         * @member {string}
         */
        _this.origin = origin;
        /**
         * The viewable buffer on the data
         * @member {ViewableBuffer}
         */
        // HINT: BlobResource allows "null" sources, assuming the child class provides an alternative
        _this.buffer = data ? new ViewableBuffer(data) : null;
        // Allow autoLoad = "undefined" still load the resource by default
        if (_this.origin && options.autoLoad !== false) {
            _this.load();
        }
        if (data && data.length) {
            _this.loaded = true;
            _this.onBlobLoaded(_this.buffer.rawBinaryData);
        }
        return _this;
    }
    BlobResource.prototype.onBlobLoaded = function (_data) {
        // TODO: Override this method
    };
    /**
     * Loads the blob
     */
    BlobResource.prototype.load = function () {
        return __awaiter(this, void 0, Promise, function () {
            var response, blob, arrayBuffer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch(this.origin)];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.blob()];
                    case 2:
                        blob = _a.sent();
                        return [4 /*yield*/, blob.arrayBuffer()];
                    case 3:
                        arrayBuffer = _a.sent();
                        this.data = new Uint32Array(arrayBuffer);
                        this.buffer = new ViewableBuffer(arrayBuffer);
                        this.loaded = true;
                        this.onBlobLoaded(arrayBuffer);
                        this.update();
                        return [2 /*return*/, this];
                }
            });
        });
    };
    return BlobResource;
}(BufferResource));

/**
 * Resource for compressed texture formats, as follows: S3TC/DXTn (& their sRGB formats), ATC, ASTC, ETC 1/2, PVRTC.
 *
 * Compressed textures improve performance when rendering is texture-bound. The texture data stays compressed in
 * graphics memory, increasing memory locality and speeding up texture fetches. These formats can also be used to store
 * more detail in the same amount of memory.
 *
 * For most developers, container file formats are a better abstraction instead of directly handling raw texture
 * data. PixiJS provides native support for the following texture file formats (via {@link PIXI.Loader}):
 *
 * * **.dds** - the DirectDraw Surface file format stores DXTn (DXT-1,3,5) data. See {@link PIXI.DDSLoader}
 * * **.ktx** - the Khronos Texture Container file format supports storing all the supported WebGL compression formats.
 *  See {@link PIXI.KTXLoader}.
 * * **.basis** - the BASIS supercompressed file format stores texture data in an internal format that is transcoded
 *  to the compression format supported on the device at _runtime_. It also supports transcoding into a uncompressed
 *  format as a fallback; you must install the `@pixi/basis-loader`, `@pixi/basis-transcoder` packages separately to
 *  use these files. See {@link PIXI.BasisLoader}.
 *
 * The loaders for the aforementioned formats use `CompressedTextureResource` internally. It is strongly suggested that
 * they be used instead.
 *
 * ## Working directly with CompressedTextureResource
 *
 * Since `CompressedTextureResource` inherits `BlobResource`, you can provide it a URL pointing to a file containing
 * the raw texture data (with no file headers!):
 *
 * ```js
 * // The resource backing the texture data for your textures.
 * // NOTE: You can also provide a ArrayBufferView instead of a URL. This is used when loading data from a container file
 * //   format such as KTX, DDS, or BASIS.
 * const compressedResource = new PIXI.CompressedTextureResource("bunny.dxt5", {
 *   format: PIXI.INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT,
 *   width: 256,
 *   height: 256
 * });
 *
 * // You can create a base-texture to the cache, so that future `Texture`s can be created using the `Texture.from` API.
 * const baseTexture = new PIXI.BaseTexture(compressedResource, { pmaMode: PIXI.ALPHA_MODES.NPM });
 *
 * // Create a Texture to add to the TextureCache
 * const texture = new PIXI.Texture(baseTexture);
 *
 * // Add baseTexture & texture to the global texture cache
 * PIXI.BaseTexture.addToCache(baseTexture, "bunny.dxt5");
 * PIXI.Texture.addToCache(texture, "bunny.dxt5");
 * ```
 *
 * @memberof PIXI
 */
var CompressedTextureResource = /** @class */ (function (_super) {
    __extends$1(CompressedTextureResource, _super);
    /**
     * @param source - the buffer/URL holding the compressed texture data
     * @param options
     * @param {PIXI.INTERNAL_FORMATS} options.format - the compression format
     * @param {number} options.width - the image width in pixels.
     * @param {number} options.height - the image height in pixels.
     * @param {number} [options.level=1] - the mipmap levels stored in the compressed texture, including level 0.
     * @param {number} [options.levelBuffers] - the buffers for each mipmap level. `CompressedTextureResource` can allows you
     *      to pass `null` for `source`, for cases where each level is stored in non-contiguous memory.
     */
    function CompressedTextureResource(source, options) {
        var _this = _super.call(this, source, options) || this;
        _this.format = options.format;
        _this.levels = options.levels || 1;
        _this._width = options.width;
        _this._height = options.height;
        _this._extension = CompressedTextureResource._formatToExtension(_this.format);
        if (options.levelBuffers || _this.buffer) {
            // ViewableBuffer doesn't support byteOffset :-( so allow source to be Uint8Array
            _this._levelBuffers = options.levelBuffers
                || CompressedTextureResource._createLevelBuffers(source instanceof Uint8Array ? source : _this.buffer.uint8View, _this.format, _this.levels, 4, 4, // PVRTC has 8x4 blocks in 2bpp mode
                _this.width, _this.height);
        }
        return _this;
    }
    /**
     * @override
     * @param renderer - A reference to the current renderer
     * @param _texture - the texture
     * @param _glTexture - texture instance for this webgl context
     */
    CompressedTextureResource.prototype.upload = function (renderer, _texture, _glTexture) {
        var gl = renderer.gl;
        var extension = renderer.context.extensions[this._extension];
        if (!extension) {
            throw new Error(this._extension + " textures are not supported on the current machine");
        }
        if (!this._levelBuffers) {
            // Do not try to upload data before BlobResource loads, unless the levelBuffers were provided directly!
            return false;
        }
        for (var i = 0, j = this.levels; i < j; i++) {
            var _a = this._levelBuffers[i], levelID = _a.levelID, levelWidth = _a.levelWidth, levelHeight = _a.levelHeight, levelBuffer = _a.levelBuffer;
            gl.compressedTexImage2D(gl.TEXTURE_2D, levelID, this.format, levelWidth, levelHeight, 0, levelBuffer);
        }
        return true;
    };
    /** @protected */
    CompressedTextureResource.prototype.onBlobLoaded = function () {
        this._levelBuffers = CompressedTextureResource._createLevelBuffers(this.buffer.uint8View, this.format, this.levels, 4, 4, // PVRTC has 8x4 blocks in 2bpp mode
        this.width, this.height);
    };
    /**
     * Returns the key (to ContextSystem#extensions) for the WebGL extension supporting the compression format
     *
     * @private
     * @param format - the compression format to get the extension for.
     */
    CompressedTextureResource._formatToExtension = function (format) {
        if (format >= 0x83F0 && format <= 0x83F3) {
            return 's3tc';
        }
        else if (format >= 0x9270 && format <= 0x9279) {
            return 'etc';
        }
        else if (format >= 0x8C00 && format <= 0x8C03) {
            return 'pvrtc';
        }
        else if (format >= 0x8D64) {
            return 'etc1';
        }
        else if (format >= 0x8C92 && format <= 0x87EE) {
            return 'atc';
        }
        throw new Error('Invalid (compressed) texture format given!');
    };
    /**
     * Pre-creates buffer views for each mipmap level
     *
     * @private
     * @param buffer -
     * @param format - compression formats
     * @param levels - mipmap levels
     * @param blockWidth -
     * @param blockHeight -
     * @param imageWidth - width of the image in pixels
     * @param imageHeight - height of the image in pixels
     */
    CompressedTextureResource._createLevelBuffers = function (buffer, format, levels, blockWidth, blockHeight, imageWidth, imageHeight) {
        // The byte-size of the first level buffer
        var buffers = new Array(levels);
        var offset = buffer.byteOffset;
        var levelWidth = imageWidth;
        var levelHeight = imageHeight;
        var alignedLevelWidth = (levelWidth + blockWidth - 1) & ~(blockWidth - 1);
        var alignedLevelHeight = (levelHeight + blockHeight - 1) & ~(blockHeight - 1);
        var levelSize = alignedLevelWidth * alignedLevelHeight * INTERNAL_FORMAT_TO_BYTES_PER_PIXEL[format];
        for (var i = 0; i < levels; i++) {
            buffers[i] = {
                levelID: i,
                levelWidth: levels > 1 ? levelWidth : alignedLevelWidth,
                levelHeight: levels > 1 ? levelHeight : alignedLevelHeight,
                levelBuffer: new Uint8Array(buffer.buffer, offset, levelSize)
            };
            offset += levelSize;
            // Calculate levelBuffer dimensions for next iteration
            levelWidth = (levelWidth >> 1) || 1;
            levelHeight = (levelHeight >> 1) || 1;
            alignedLevelWidth = (levelWidth + blockWidth - 1) & ~(blockWidth - 1);
            alignedLevelHeight = (levelHeight + blockHeight - 1) & ~(blockHeight - 1);
            levelSize = alignedLevelWidth * alignedLevelHeight * INTERNAL_FORMAT_TO_BYTES_PER_PIXEL[format];
        }
        return buffers;
    };
    return CompressedTextureResource;
}(BlobResource));

/* eslint-enable camelcase */
/**
 * Loader plugin for handling compressed textures for all platforms.
 *
 * @class
 * @memberof PIXI
 * @implements PIXI.ILoaderPlugin
 */
var CompressedTextureLoader = /** @class */ (function () {
    function CompressedTextureLoader() {
    }
    /**
     * Called after a compressed-textures manifest is loaded.
     *
     * This will then load the correct compression format for the device. Your manifest should adhere
     * to the following schema:
     *
     * ```js
     * import { INTERNAL_FORMATS } from '@pixi/constants';
     *
     * type CompressedTextureManifest = {
     *  textures: Array<{ src: string, format?: keyof INTERNAL_FORMATS}>,
     *  cacheID: string;
     * };
     * ```
     *
     * This is an example of a .json manifest file
     *
     * ```json
     * {
     *   "cacheID":"asset",
     *   "textures":[
     *     { "src":"asset.fallback.png" },
     *     { "format":"COMPRESSED_RGBA_S3TC_DXT5_EXT", "src":"asset.s3tc.ktx" },
     *     { "format":"COMPRESSED_RGBA8_ETC2_EAC", "src":"asset.etc.ktx" },
     *     { "format":"RGBA_PVRTC_4BPPV1_IMG", "src":"asset.pvrtc.ktx" }
     *   ]
     * }
     * ```
     */
    CompressedTextureLoader.use = function (resource, next) {
        var data = resource.data;
        var loader = this;
        if (resource.type === LoaderResource.TYPE.JSON
            && data
            && data.cacheID
            && data.textures) {
            var textures = data.textures;
            var textureURL = void 0;
            var fallbackURL = void 0;
            // Search for an extension that holds one the formats
            for (var i = 0, j = textures.length; i < j; i++) {
                var texture = textures[i];
                var url_1 = texture.src;
                var format = texture.format;
                if (!format) {
                    fallbackURL = url_1;
                }
                if (CompressedTextureLoader.textureFormats[format]) {
                    textureURL = url_1;
                    break;
                }
            }
            textureURL = textureURL || fallbackURL;
            // Make sure we have a URL
            if (!textureURL) {
                next(new Error("Cannot load compressed-textures in " + resource.url + ", make sure you provide a fallback"));
                return;
            }
            if (textureURL === resource.url) {
                // Prevent infinite loops
                next(new Error('URL of compressed texture cannot be the same as the manifest\'s URL'));
                return;
            }
            var loadOptions = {
                crossOrigin: resource.crossOrigin,
                metadata: resource.metadata.imageMetadata,
                parentResource: resource
            };
            var resourcePath = url.resolve(resource.url.replace(loader.baseUrl, ''), textureURL);
            var resourceName = data.cacheID;
            // The appropriate loader should register the texture
            loader.add(resourceName, resourcePath, loadOptions, function (res) {
                if (res.error) {
                    next(res.error);
                    return;
                }
                var _a = res.texture, texture = _a === void 0 ? null : _a, _b = res.textures, textures = _b === void 0 ? {} : _b;
                // Make sure texture/textures is assigned to parent resource
                Object.assign(resource, { texture: texture, textures: textures });
                // Pass along any error
                next();
            });
        }
        else {
            next();
        }
    };
    /**
     * Detects the available compressed texture extensions on the device.
     * @ignore
     */
    CompressedTextureLoader.add = function () {
        // Auto-detect WebGL compressed-texture extensions
        var canvas = document.createElement('canvas');
        var gl = canvas.getContext('webgl');
        if (!gl) {
            console.warn('WebGL not available for compressed textures. Silently failing.');
            return;
        }
        var extensions = {
            s3tc: gl.getExtension('WEBGL_compressed_texture_s3tc'),
            s3tc_sRGB: gl.getExtension('WEBGL_compressed_texture_s3tc_srgb'),
            etc: gl.getExtension('WEBGL_compressed_texture_etc'),
            etc1: gl.getExtension('WEBGL_compressed_texture_etc1'),
            pvrtc: gl.getExtension('WEBGL_compressed_texture_pvrtc')
                || gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc'),
            atc: gl.getExtension('WEBGL_compressed_texture_atc'),
            astc: gl.getExtension('WEBGL_compressed_texture_astc')
        };
        CompressedTextureLoader.textureExtensions = extensions;
        CompressedTextureLoader.textureFormats = {};
        // Assign all available compressed-texture formats
        for (var extensionName in extensions) {
            var extension = extensions[extensionName];
            if (!extension) {
                continue;
            }
            Object.assign(CompressedTextureLoader.textureFormats, Object.getPrototypeOf(extension));
        }
    };
    return CompressedTextureLoader;
}());

/**
 * Creates base-textures and textures for each compressed-texture resource and adds them into the global
 * texture cache. The first texture has two IDs - `${url}`, `${url}-1`; while the rest have an ID of the
 * form `${url}-i`.
 *
 * @param url - the original address of the resources
 * @param resources - the resources backing texture data
 * @ignore
 */
function registerCompressedTextures(url, resources, metadata) {
    var result = {
        textures: {},
        texture: null,
    };
    if (!resources) {
        return result;
    }
    var textures = resources.map(function (resource) {
        return (new Texture(new BaseTexture(resource, Object.assign({
            mipmap: MIPMAP_MODES$1.OFF,
            alphaMode: ALPHA_MODES$1.NO_PREMULTIPLIED_ALPHA
        }, metadata))));
    });
    textures.forEach(function (texture, i) {
        var baseTexture = texture.baseTexture;
        var cacheID = url + "-" + (i + 1);
        BaseTexture.addToCache(baseTexture, cacheID);
        Texture.addToCache(texture, cacheID);
        if (i === 0) {
            BaseTexture.addToCache(baseTexture, url);
            Texture.addToCache(texture, url);
            result.texture = texture;
        }
        result.textures[cacheID] = texture;
    });
    return result;
}

var _a$1, _b;
// Set DDS files to be loaded as an ArrayBuffer
LoaderResource.setExtensionXhrType('dds', LoaderResource.XHR_RESPONSE_TYPE.BUFFER);
var DDS_MAGIC_SIZE = 4;
var DDS_HEADER_SIZE = 124;
var DDS_HEADER_PF_SIZE = 32;
var DDS_HEADER_DX10_SIZE = 20;
// DDS file format magic word
var DDS_MAGIC = 0x20534444;
/**
 * DWORD offsets of the DDS file header fields (relative to file start).
 *
 * @ignore
 */
var DDS_FIELDS = {
    SIZE: 1,
    FLAGS: 2,
    HEIGHT: 3,
    WIDTH: 4,
    MIPMAP_COUNT: 7,
    PIXEL_FORMAT: 19,
};
/**
 * DWORD offsets of the DDS PIXEL_FORMAT fields.
 *
 * @ignore
 */
var DDS_PF_FIELDS = {
    SIZE: 0,
    FLAGS: 1,
    FOURCC: 2,
    RGB_BITCOUNT: 3,
    R_BIT_MASK: 4,
    G_BIT_MASK: 5,
    B_BIT_MASK: 6,
    A_BIT_MASK: 7
};
/**
 * DWORD offsets of the DDS_HEADER_DX10 fields.
 *
 * @ignore
 */
var DDS_DX10_FIELDS = {
    DXGI_FORMAT: 0,
    RESOURCE_DIMENSION: 1,
    MISC_FLAG: 2,
    ARRAY_SIZE: 3,
    MISC_FLAGS2: 4
};
/**
 * @see https://docs.microsoft.com/en-us/windows/win32/api/dxgiformat/ne-dxgiformat-dxgi_format
 * @ignore
 */
// This is way over-blown for us! Lend us a hand, and remove the ones that aren't used (but set the remaining
// ones to their correct value)
var DXGI_FORMAT;
(function (DXGI_FORMAT) {
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_UNKNOWN"] = 0] = "DXGI_FORMAT_UNKNOWN";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32B32A32_TYPELESS"] = 1] = "DXGI_FORMAT_R32G32B32A32_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32B32A32_FLOAT"] = 2] = "DXGI_FORMAT_R32G32B32A32_FLOAT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32B32A32_UINT"] = 3] = "DXGI_FORMAT_R32G32B32A32_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32B32A32_SINT"] = 4] = "DXGI_FORMAT_R32G32B32A32_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32B32_TYPELESS"] = 5] = "DXGI_FORMAT_R32G32B32_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32B32_FLOAT"] = 6] = "DXGI_FORMAT_R32G32B32_FLOAT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32B32_UINT"] = 7] = "DXGI_FORMAT_R32G32B32_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32B32_SINT"] = 8] = "DXGI_FORMAT_R32G32B32_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16B16A16_TYPELESS"] = 9] = "DXGI_FORMAT_R16G16B16A16_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16B16A16_FLOAT"] = 10] = "DXGI_FORMAT_R16G16B16A16_FLOAT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16B16A16_UNORM"] = 11] = "DXGI_FORMAT_R16G16B16A16_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16B16A16_UINT"] = 12] = "DXGI_FORMAT_R16G16B16A16_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16B16A16_SNORM"] = 13] = "DXGI_FORMAT_R16G16B16A16_SNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16B16A16_SINT"] = 14] = "DXGI_FORMAT_R16G16B16A16_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32_TYPELESS"] = 15] = "DXGI_FORMAT_R32G32_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32_FLOAT"] = 16] = "DXGI_FORMAT_R32G32_FLOAT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32_UINT"] = 17] = "DXGI_FORMAT_R32G32_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G32_SINT"] = 18] = "DXGI_FORMAT_R32G32_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32G8X24_TYPELESS"] = 19] = "DXGI_FORMAT_R32G8X24_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_D32_FLOAT_S8X24_UINT"] = 20] = "DXGI_FORMAT_D32_FLOAT_S8X24_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32_FLOAT_X8X24_TYPELESS"] = 21] = "DXGI_FORMAT_R32_FLOAT_X8X24_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_X32_TYPELESS_G8X24_UINT"] = 22] = "DXGI_FORMAT_X32_TYPELESS_G8X24_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R10G10B10A2_TYPELESS"] = 23] = "DXGI_FORMAT_R10G10B10A2_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R10G10B10A2_UNORM"] = 24] = "DXGI_FORMAT_R10G10B10A2_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R10G10B10A2_UINT"] = 25] = "DXGI_FORMAT_R10G10B10A2_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R11G11B10_FLOAT"] = 26] = "DXGI_FORMAT_R11G11B10_FLOAT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8B8A8_TYPELESS"] = 27] = "DXGI_FORMAT_R8G8B8A8_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8B8A8_UNORM"] = 28] = "DXGI_FORMAT_R8G8B8A8_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8B8A8_UNORM_SRGB"] = 29] = "DXGI_FORMAT_R8G8B8A8_UNORM_SRGB";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8B8A8_UINT"] = 30] = "DXGI_FORMAT_R8G8B8A8_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8B8A8_SNORM"] = 31] = "DXGI_FORMAT_R8G8B8A8_SNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8B8A8_SINT"] = 32] = "DXGI_FORMAT_R8G8B8A8_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16_TYPELESS"] = 33] = "DXGI_FORMAT_R16G16_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16_FLOAT"] = 34] = "DXGI_FORMAT_R16G16_FLOAT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16_UNORM"] = 35] = "DXGI_FORMAT_R16G16_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16_UINT"] = 36] = "DXGI_FORMAT_R16G16_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16_SNORM"] = 37] = "DXGI_FORMAT_R16G16_SNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16G16_SINT"] = 38] = "DXGI_FORMAT_R16G16_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32_TYPELESS"] = 39] = "DXGI_FORMAT_R32_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_D32_FLOAT"] = 40] = "DXGI_FORMAT_D32_FLOAT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32_FLOAT"] = 41] = "DXGI_FORMAT_R32_FLOAT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32_UINT"] = 42] = "DXGI_FORMAT_R32_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R32_SINT"] = 43] = "DXGI_FORMAT_R32_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R24G8_TYPELESS"] = 44] = "DXGI_FORMAT_R24G8_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_D24_UNORM_S8_UINT"] = 45] = "DXGI_FORMAT_D24_UNORM_S8_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R24_UNORM_X8_TYPELESS"] = 46] = "DXGI_FORMAT_R24_UNORM_X8_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_X24_TYPELESS_G8_UINT"] = 47] = "DXGI_FORMAT_X24_TYPELESS_G8_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8_TYPELESS"] = 48] = "DXGI_FORMAT_R8G8_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8_UNORM"] = 49] = "DXGI_FORMAT_R8G8_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8_UINT"] = 50] = "DXGI_FORMAT_R8G8_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8_SNORM"] = 51] = "DXGI_FORMAT_R8G8_SNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8_SINT"] = 52] = "DXGI_FORMAT_R8G8_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16_TYPELESS"] = 53] = "DXGI_FORMAT_R16_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16_FLOAT"] = 54] = "DXGI_FORMAT_R16_FLOAT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_D16_UNORM"] = 55] = "DXGI_FORMAT_D16_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16_UNORM"] = 56] = "DXGI_FORMAT_R16_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16_UINT"] = 57] = "DXGI_FORMAT_R16_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16_SNORM"] = 58] = "DXGI_FORMAT_R16_SNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R16_SINT"] = 59] = "DXGI_FORMAT_R16_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8_TYPELESS"] = 60] = "DXGI_FORMAT_R8_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8_UNORM"] = 61] = "DXGI_FORMAT_R8_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8_UINT"] = 62] = "DXGI_FORMAT_R8_UINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8_SNORM"] = 63] = "DXGI_FORMAT_R8_SNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8_SINT"] = 64] = "DXGI_FORMAT_R8_SINT";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_A8_UNORM"] = 65] = "DXGI_FORMAT_A8_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R1_UNORM"] = 66] = "DXGI_FORMAT_R1_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R9G9B9E5_SHAREDEXP"] = 67] = "DXGI_FORMAT_R9G9B9E5_SHAREDEXP";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R8G8_B8G8_UNORM"] = 68] = "DXGI_FORMAT_R8G8_B8G8_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_G8R8_G8B8_UNORM"] = 69] = "DXGI_FORMAT_G8R8_G8B8_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC1_TYPELESS"] = 70] = "DXGI_FORMAT_BC1_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC1_UNORM"] = 71] = "DXGI_FORMAT_BC1_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC1_UNORM_SRGB"] = 72] = "DXGI_FORMAT_BC1_UNORM_SRGB";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC2_TYPELESS"] = 73] = "DXGI_FORMAT_BC2_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC2_UNORM"] = 74] = "DXGI_FORMAT_BC2_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC2_UNORM_SRGB"] = 75] = "DXGI_FORMAT_BC2_UNORM_SRGB";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC3_TYPELESS"] = 76] = "DXGI_FORMAT_BC3_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC3_UNORM"] = 77] = "DXGI_FORMAT_BC3_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC3_UNORM_SRGB"] = 78] = "DXGI_FORMAT_BC3_UNORM_SRGB";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC4_TYPELESS"] = 79] = "DXGI_FORMAT_BC4_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC4_UNORM"] = 80] = "DXGI_FORMAT_BC4_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC4_SNORM"] = 81] = "DXGI_FORMAT_BC4_SNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC5_TYPELESS"] = 82] = "DXGI_FORMAT_BC5_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC5_UNORM"] = 83] = "DXGI_FORMAT_BC5_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC5_SNORM"] = 84] = "DXGI_FORMAT_BC5_SNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_B5G6R5_UNORM"] = 85] = "DXGI_FORMAT_B5G6R5_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_B5G5R5A1_UNORM"] = 86] = "DXGI_FORMAT_B5G5R5A1_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_B8G8R8A8_UNORM"] = 87] = "DXGI_FORMAT_B8G8R8A8_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_B8G8R8X8_UNORM"] = 88] = "DXGI_FORMAT_B8G8R8X8_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_R10G10B10_XR_BIAS_A2_UNORM"] = 89] = "DXGI_FORMAT_R10G10B10_XR_BIAS_A2_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_B8G8R8A8_TYPELESS"] = 90] = "DXGI_FORMAT_B8G8R8A8_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_B8G8R8A8_UNORM_SRGB"] = 91] = "DXGI_FORMAT_B8G8R8A8_UNORM_SRGB";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_B8G8R8X8_TYPELESS"] = 92] = "DXGI_FORMAT_B8G8R8X8_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_B8G8R8X8_UNORM_SRGB"] = 93] = "DXGI_FORMAT_B8G8R8X8_UNORM_SRGB";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC6H_TYPELESS"] = 94] = "DXGI_FORMAT_BC6H_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC6H_UF16"] = 95] = "DXGI_FORMAT_BC6H_UF16";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC6H_SF16"] = 96] = "DXGI_FORMAT_BC6H_SF16";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC7_TYPELESS"] = 97] = "DXGI_FORMAT_BC7_TYPELESS";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC7_UNORM"] = 98] = "DXGI_FORMAT_BC7_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_BC7_UNORM_SRGB"] = 99] = "DXGI_FORMAT_BC7_UNORM_SRGB";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_AYUV"] = 100] = "DXGI_FORMAT_AYUV";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_Y410"] = 101] = "DXGI_FORMAT_Y410";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_Y416"] = 102] = "DXGI_FORMAT_Y416";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_NV12"] = 103] = "DXGI_FORMAT_NV12";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_P010"] = 104] = "DXGI_FORMAT_P010";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_P016"] = 105] = "DXGI_FORMAT_P016";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_420_OPAQUE"] = 106] = "DXGI_FORMAT_420_OPAQUE";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_YUY2"] = 107] = "DXGI_FORMAT_YUY2";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_Y210"] = 108] = "DXGI_FORMAT_Y210";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_Y216"] = 109] = "DXGI_FORMAT_Y216";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_NV11"] = 110] = "DXGI_FORMAT_NV11";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_AI44"] = 111] = "DXGI_FORMAT_AI44";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_IA44"] = 112] = "DXGI_FORMAT_IA44";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_P8"] = 113] = "DXGI_FORMAT_P8";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_A8P8"] = 114] = "DXGI_FORMAT_A8P8";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_B4G4R4A4_UNORM"] = 115] = "DXGI_FORMAT_B4G4R4A4_UNORM";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_P208"] = 116] = "DXGI_FORMAT_P208";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_V208"] = 117] = "DXGI_FORMAT_V208";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_V408"] = 118] = "DXGI_FORMAT_V408";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_SAMPLER_FEEDBACK_MIN_MIP_OPAQUE"] = 119] = "DXGI_FORMAT_SAMPLER_FEEDBACK_MIN_MIP_OPAQUE";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_SAMPLER_FEEDBACK_MIP_REGION_USED_OPAQUE"] = 120] = "DXGI_FORMAT_SAMPLER_FEEDBACK_MIP_REGION_USED_OPAQUE";
    DXGI_FORMAT[DXGI_FORMAT["DXGI_FORMAT_FORCE_UINT"] = 121] = "DXGI_FORMAT_FORCE_UINT";
})(DXGI_FORMAT || (DXGI_FORMAT = {}));
/**
 * Possible values of the field {@link DDS_DX10_FIELDS.RESOURCE_DIMENSION}
 *
 * @ignore
 */
var D3D10_RESOURCE_DIMENSION;
(function (D3D10_RESOURCE_DIMENSION) {
    D3D10_RESOURCE_DIMENSION[D3D10_RESOURCE_DIMENSION["DDS_DIMENSION_TEXTURE1D"] = 2] = "DDS_DIMENSION_TEXTURE1D";
    D3D10_RESOURCE_DIMENSION[D3D10_RESOURCE_DIMENSION["DDS_DIMENSION_TEXTURE2D"] = 3] = "DDS_DIMENSION_TEXTURE2D";
    D3D10_RESOURCE_DIMENSION[D3D10_RESOURCE_DIMENSION["DDS_DIMENSION_TEXTURE3D"] = 6] = "DDS_DIMENSION_TEXTURE3D";
})(D3D10_RESOURCE_DIMENSION || (D3D10_RESOURCE_DIMENSION = {}));
var PF_FLAGS = 1;
// PIXEL_FORMAT flags
var DDPF_ALPHA = 0x2;
var DDPF_FOURCC = 0x4;
var DDPF_RGB = 0x40;
var DDPF_YUV = 0x200;
var DDPF_LUMINANCE = 0x20000;
// Four character codes for DXTn formats
var FOURCC_DXT1 = 0x31545844;
var FOURCC_DXT3 = 0x33545844;
var FOURCC_DXT5 = 0x35545844;
var FOURCC_DX10 = 0x30315844;
// Cubemap texture flag (for DDS_DX10_FIELDS.MISC_FLAG)
var DDS_RESOURCE_MISC_TEXTURECUBE = 0x4;
/**
 * Maps `FOURCC_*` formats to internal formats (see {@link PIXI.INTERNAL_FORMATS}).
 *
 * @ignore
 */
var FOURCC_TO_FORMAT = (_a$1 = {},
    _a$1[FOURCC_DXT1] = INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT1_EXT,
    _a$1[FOURCC_DXT3] = INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT3_EXT,
    _a$1[FOURCC_DXT5] = INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT,
    _a$1);
/**
 * Maps {@link DXGI_FORMAT} to types/internal-formats (see {@link PIXI.TYPES}, {@link PIXI.INTERNAL_FORMATS})
 *
 * @ignore
 */
var DXGI_TO_FORMAT = (_b = {},
    // WEBGL_compressed_texture_s3tc
    _b[DXGI_FORMAT.DXGI_FORMAT_BC1_TYPELESS] = INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT1_EXT,
    _b[DXGI_FORMAT.DXGI_FORMAT_BC1_UNORM] = INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT1_EXT,
    _b[DXGI_FORMAT.DXGI_FORMAT_BC2_TYPELESS] = INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT3_EXT,
    _b[DXGI_FORMAT.DXGI_FORMAT_BC2_UNORM] = INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT3_EXT,
    _b[DXGI_FORMAT.DXGI_FORMAT_BC3_TYPELESS] = INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT,
    _b[DXGI_FORMAT.DXGI_FORMAT_BC3_UNORM] = INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT,
    // WEBGL_compressed_texture_s3tc_srgb
    _b[DXGI_FORMAT.DXGI_FORMAT_BC1_UNORM_SRGB] = INTERNAL_FORMATS.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT,
    _b[DXGI_FORMAT.DXGI_FORMAT_BC2_UNORM_SRGB] = INTERNAL_FORMATS.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT,
    _b[DXGI_FORMAT.DXGI_FORMAT_BC3_UNORM_SRGB] = INTERNAL_FORMATS.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT,
    _b);
/**
 * @class
 * @memberof PIXI
 * @implements PIXI.ILoaderPlugin
 * @see https://docs.microsoft.com/en-us/windows/win32/direct3ddds/dx-graphics-dds-pguide
 */
var DDSLoader = /** @class */ (function () {
    function DDSLoader() {
    }
    /**
     * Registers a DDS compressed texture
     * @see PIXI.Loader.loaderMiddleware
     * @param resource - loader resource that is checked to see if it is a DDS file
     * @param next - callback Function to call when done
     */
    DDSLoader.use = function (resource, next) {
        if (resource.extension === 'dds' && resource.data) {
            try {
                Object.assign(resource, registerCompressedTextures(resource.name || resource.url, DDSLoader.parse(resource.data), resource.metadata));
            }
            catch (err) {
                next(err);
                return;
            }
        }
        next();
    };
    /** Parses the DDS file header, generates base-textures, and puts them into the texture cache. */
    DDSLoader.parse = function (arrayBuffer) {
        var data = new Uint32Array(arrayBuffer);
        var magicWord = data[0];
        if (magicWord !== DDS_MAGIC) {
            throw new Error('Invalid DDS file magic word');
        }
        var header = new Uint32Array(arrayBuffer, 0, DDS_HEADER_SIZE / Uint32Array.BYTES_PER_ELEMENT);
        // DDS header fields
        var height = header[DDS_FIELDS.HEIGHT];
        var width = header[DDS_FIELDS.WIDTH];
        var mipmapCount = header[DDS_FIELDS.MIPMAP_COUNT];
        // PIXEL_FORMAT fields
        var pixelFormat = new Uint32Array(arrayBuffer, DDS_FIELDS.PIXEL_FORMAT * Uint32Array.BYTES_PER_ELEMENT, DDS_HEADER_PF_SIZE / Uint32Array.BYTES_PER_ELEMENT);
        var formatFlags = pixelFormat[PF_FLAGS];
        // File contains compressed texture(s)
        if (formatFlags & DDPF_FOURCC) {
            var fourCC = pixelFormat[DDS_PF_FIELDS.FOURCC];
            // File contains one DXTn compressed texture
            if (fourCC !== FOURCC_DX10) {
                var internalFormat_1 = FOURCC_TO_FORMAT[fourCC];
                var dataOffset_1 = DDS_MAGIC_SIZE + DDS_HEADER_SIZE;
                var texData = new Uint8Array(arrayBuffer, dataOffset_1);
                var resource = new CompressedTextureResource(texData, {
                    format: internalFormat_1,
                    width: width,
                    height: height,
                    levels: mipmapCount // CompressedTextureResource will separate the levelBuffers for us!
                });
                return [resource];
            }
            // FOURCC_DX10 indicates there is a 20-byte DDS_HEADER_DX10 after DDS_HEADER
            var dx10Offset = DDS_MAGIC_SIZE + DDS_HEADER_SIZE;
            var dx10Header = new Uint32Array(data.buffer, dx10Offset, DDS_HEADER_DX10_SIZE / Uint32Array.BYTES_PER_ELEMENT);
            var dxgiFormat = dx10Header[DDS_DX10_FIELDS.DXGI_FORMAT];
            var resourceDimension = dx10Header[DDS_DX10_FIELDS.RESOURCE_DIMENSION];
            var miscFlag = dx10Header[DDS_DX10_FIELDS.MISC_FLAG];
            var arraySize = dx10Header[DDS_DX10_FIELDS.ARRAY_SIZE];
            // Map dxgiFormat to PIXI.INTERNAL_FORMATS
            var internalFormat_2 = DXGI_TO_FORMAT[dxgiFormat];
            if (internalFormat_2 === undefined) {
                throw new Error("DDSLoader cannot parse texture data with DXGI format " + dxgiFormat);
            }
            if (miscFlag === DDS_RESOURCE_MISC_TEXTURECUBE) {
                // FIXME: Anybody excited about cubemap compressed textures?
                throw new Error('DDSLoader does not support cubemap textures');
            }
            if (resourceDimension === D3D10_RESOURCE_DIMENSION.DDS_DIMENSION_TEXTURE3D) {
                // FIXME: Anybody excited about 3D compressed textures?
                throw new Error('DDSLoader does not supported 3D texture data');
            }
            // Uint8Array buffers of image data, including all mipmap levels in each image
            var imageBuffers = new Array();
            var dataOffset = DDS_MAGIC_SIZE
                + DDS_HEADER_SIZE
                + DDS_HEADER_DX10_SIZE;
            if (arraySize === 1) {
                // No need bothering with the imageSize calculation!
                imageBuffers.push(new Uint8Array(arrayBuffer, dataOffset));
            }
            else {
                // Calculate imageSize for each texture, and then locate each image's texture data
                var pixelSize = INTERNAL_FORMAT_TO_BYTES_PER_PIXEL[internalFormat_2];
                var imageSize = 0;
                var levelWidth = width;
                var levelHeight = height;
                for (var i = 0; i < mipmapCount; i++) {
                    var alignedLevelWidth = Math.max(1, (levelWidth + 3) & ~3);
                    var alignedLevelHeight = Math.max(1, (levelHeight + 3) & ~3);
                    var levelSize = alignedLevelWidth * alignedLevelHeight * pixelSize;
                    imageSize += levelSize;
                    levelWidth = levelWidth >>> 1;
                    levelHeight = levelHeight >>> 1;
                }
                var imageOffset = dataOffset;
                // NOTE: Cubemaps have 6-images per texture (but they aren't supported so ^_^)
                for (var i = 0; i < arraySize; i++) {
                    imageBuffers.push(new Uint8Array(arrayBuffer, imageOffset, imageSize));
                    imageOffset += imageSize;
                }
            }
            // Uint8Array -> CompressedTextureResource, and we're done!
            return imageBuffers.map(function (buffer) { return new CompressedTextureResource(buffer, {
                format: internalFormat_2,
                width: width,
                height: height,
                levels: mipmapCount
            }); });
        }
        if (formatFlags & DDPF_RGB) {
            // FIXME: We might want to allow uncompressed *.dds files?
            throw new Error('DDSLoader does not support uncompressed texture data.');
        }
        if (formatFlags & DDPF_YUV) {
            // FIXME: Does anybody need this feature?
            throw new Error('DDSLoader does not supported YUV uncompressed texture data.');
        }
        if (formatFlags & DDPF_LUMINANCE) {
            // FIXME: Microsoft says older DDS filers use this feature! Probably not worth the effort!
            throw new Error('DDSLoader does not support single-channel (lumninance) texture data!');
        }
        if (formatFlags & DDPF_ALPHA) {
            // FIXME: I'm tired! See above =)
            throw new Error('DDSLoader does not support single-channel (alpha) texture data!');
        }
        throw new Error('DDSLoader failed to load a texture file due to an unknown reason!');
    };
    return DDSLoader;
}());

var _a$2, _b$1, _c;
// Set KTX files to be loaded as an ArrayBuffer
LoaderResource.setExtensionXhrType('ktx', LoaderResource.XHR_RESPONSE_TYPE.BUFFER);
/**
 * The 12-byte KTX file identifier
 *
 * @see https://www.khronos.org/opengles/sdk/tools/KTX/file_format_spec/#2.1
 * @ignore
 */
var FILE_IDENTIFIER = [0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A];
/**
 * The value stored in the "endianness" field.
 *
 * @see https://www.khronos.org/opengles/sdk/tools/KTX/file_format_spec/#2.2
 * @ignore
 */
var ENDIANNESS = 0x04030201;
/**
 * Byte offsets of the KTX file header fields
 *
 * @ignore
 */
var KTX_FIELDS = {
    FILE_IDENTIFIER: 0,
    ENDIANNESS: 12,
    GL_TYPE: 16,
    GL_TYPE_SIZE: 20,
    GL_FORMAT: 24,
    GL_INTERNAL_FORMAT: 28,
    GL_BASE_INTERNAL_FORMAT: 32,
    PIXEL_WIDTH: 36,
    PIXEL_HEIGHT: 40,
    PIXEL_DEPTH: 44,
    NUMBER_OF_ARRAY_ELEMENTS: 48,
    NUMBER_OF_FACES: 52,
    NUMBER_OF_MIPMAP_LEVELS: 56,
    BYTES_OF_KEY_VALUE_DATA: 60
};
/**
 * Byte size of the file header fields in {@code KTX_FIELDS}
 *
 * @ignore
 */
var FILE_HEADER_SIZE = 64;
/**
 * Maps {@link PIXI.TYPES} to the bytes taken per component, excluding those ones that are bit-fields.
 *
 * @ignore
 */
var TYPES_TO_BYTES_PER_COMPONENT = (_a$2 = {},
    _a$2[TYPES$1.UNSIGNED_BYTE] = 1,
    _a$2[TYPES$1.UNSIGNED_SHORT] = 2,
    _a$2[TYPES$1.FLOAT] = 4,
    _a$2[TYPES$1.HALF_FLOAT] = 8,
    _a$2);
/**
 * Number of components in each {@link PIXI.FORMATS}
 *
 * @ignore
 */
var FORMATS_TO_COMPONENTS = (_b$1 = {},
    _b$1[FORMATS$1.RGBA] = 4,
    _b$1[FORMATS$1.RGB] = 3,
    _b$1[FORMATS$1.LUMINANCE] = 1,
    _b$1[FORMATS$1.LUMINANCE_ALPHA] = 2,
    _b$1[FORMATS$1.ALPHA] = 1,
    _b$1);
/**
 * Number of bytes per pixel in bit-field types in {@link PIXI.TYPES}
 *
 * @ignore
 */
var TYPES_TO_BYTES_PER_PIXEL = (_c = {},
    _c[TYPES$1.UNSIGNED_SHORT_4_4_4_4] = 2,
    _c[TYPES$1.UNSIGNED_SHORT_5_5_5_1] = 2,
    _c[TYPES$1.UNSIGNED_SHORT_5_6_5] = 2,
    _c);
/**
 * Loader plugin for handling KTX texture container files.
 *
 * This KTX loader does not currently support the following features:
 * * cube textures
 * * 3D textures
 * * vendor-specific key/value data parsing
 * * endianness conversion for big-endian machines
 * * embedded *.basis files
 *
 * It does supports the following features:
 * * multiple textures per file
 * * mipmapping
 *
 * @class
 * @memberof PIXI
 * @implements PIXI.ILoaderPlugin
 */
var KTXLoader = /** @class */ (function () {
    function KTXLoader() {
    }
    /**
     * Called after a KTX file is loaded.
     *
     * This will parse the KTX file header and add a {@code BaseTexture} to the texture
     * cache.
     *
     * @see PIXI.Loader.loaderMiddleware
     * @param resource - loader resource that is checked to see if it is a KTX file
     * @param next - callback Function to call when done
     */
    KTXLoader.use = function (resource, next) {
        if (resource.extension === 'ktx' && resource.data) {
            try {
                var url = resource.name || resource.url;
                Object.assign(resource, registerCompressedTextures(url, KTXLoader.parse(url, resource.data), resource.metadata));
            }
            catch (err) {
                next(err);
                return;
            }
        }
        next();
    };
    /** Parses the KTX file header, generates base-textures, and puts them into the texture cache. */
    KTXLoader.parse = function (url, arrayBuffer) {
        var dataView = new DataView(arrayBuffer);
        if (!KTXLoader.validate(url, dataView)) {
            return null;
        }
        var littleEndian = dataView.getUint32(KTX_FIELDS.ENDIANNESS, true) === ENDIANNESS;
        var glType = dataView.getUint32(KTX_FIELDS.GL_TYPE, littleEndian);
        // const glTypeSize = dataView.getUint32(KTX_FIELDS.GL_TYPE_SIZE, littleEndian);
        var glFormat = dataView.getUint32(KTX_FIELDS.GL_FORMAT, littleEndian);
        var glInternalFormat = dataView.getUint32(KTX_FIELDS.GL_INTERNAL_FORMAT, littleEndian);
        var pixelWidth = dataView.getUint32(KTX_FIELDS.PIXEL_WIDTH, littleEndian);
        var pixelHeight = dataView.getUint32(KTX_FIELDS.PIXEL_HEIGHT, littleEndian) || 1; // "pixelHeight = 0" -> "1"
        var pixelDepth = dataView.getUint32(KTX_FIELDS.PIXEL_DEPTH, littleEndian) || 1; // ^^
        var numberOfArrayElements = dataView.getUint32(KTX_FIELDS.NUMBER_OF_ARRAY_ELEMENTS, littleEndian) || 1; // ^^
        var numberOfFaces = dataView.getUint32(KTX_FIELDS.NUMBER_OF_FACES, littleEndian);
        var numberOfMipmapLevels = dataView.getUint32(KTX_FIELDS.NUMBER_OF_MIPMAP_LEVELS, littleEndian);
        var bytesOfKeyValueData = dataView.getUint32(KTX_FIELDS.BYTES_OF_KEY_VALUE_DATA, littleEndian);
        // Whether the platform architecture is little endian. If littleEndian !== platformLittleEndian, then the
        // file contents must be endian-converted!
        // TODO: Endianness conversion
        // const platformLittleEndian = new Uint8Array((new Uint32Array([ENDIANNESS])).buffer)[0] === 0x01;
        if (pixelHeight === 0 || pixelDepth !== 1) {
            throw new Error('Only 2D textures are supported');
        }
        if (numberOfFaces !== 1) {
            throw new Error('CubeTextures are not supported by KTXLoader yet!');
        }
        if (numberOfArrayElements !== 1) {
            // TODO: Support splitting array-textures into multiple BaseTextures
            throw new Error('WebGL does not support array textures');
        }
        // TODO: 8x4 blocks for 2bpp pvrtc
        var blockWidth = 4;
        var blockHeight = 4;
        var alignedWidth = (pixelWidth + 3) & ~3;
        var alignedHeight = (pixelHeight + 3) & ~3;
        var imageBuffers = new Array(numberOfArrayElements);
        var imagePixels = pixelWidth * pixelHeight;
        if (glType === 0) {
            // Align to 16 pixels (4x4 blocks)
            imagePixels = alignedWidth * alignedHeight;
        }
        var imagePixelByteSize;
        if (glType !== 0) {
            // Uncompressed texture format
            if (TYPES_TO_BYTES_PER_COMPONENT[glType]) {
                imagePixelByteSize = TYPES_TO_BYTES_PER_COMPONENT[glType] * FORMATS_TO_COMPONENTS[glFormat];
            }
            else {
                imagePixelByteSize = TYPES_TO_BYTES_PER_PIXEL[glType];
            }
        }
        else {
            imagePixelByteSize = INTERNAL_FORMAT_TO_BYTES_PER_PIXEL[glInternalFormat];
        }
        if (imagePixelByteSize === undefined) {
            throw new Error('Unable to resolve the pixel format stored in the *.ktx file!');
        }
        var imageByteSize = imagePixels * imagePixelByteSize;
        var mipByteSize = imageByteSize;
        var mipWidth = pixelWidth;
        var mipHeight = pixelHeight;
        var alignedMipWidth = alignedWidth;
        var alignedMipHeight = alignedHeight;
        var imageOffset = FILE_HEADER_SIZE + bytesOfKeyValueData;
        for (var mipmapLevel = 0; mipmapLevel < numberOfMipmapLevels; mipmapLevel++) {
            var imageSize = dataView.getUint32(imageOffset, littleEndian);
            var elementOffset = imageOffset + 4;
            for (var arrayElement = 0; arrayElement < numberOfArrayElements; arrayElement++) {
                // TODO: Maybe support 3D textures? :-)
                // for (let zSlice = 0; zSlice < pixelDepth; zSlice)
                var mips = imageBuffers[arrayElement];
                if (!mips) {
                    mips = imageBuffers[arrayElement] = new Array(numberOfMipmapLevels);
                }
                mips[mipmapLevel] = {
                    levelID: mipmapLevel,
                    levelWidth: numberOfMipmapLevels > 1 ? mipWidth : alignedMipWidth,
                    levelHeight: numberOfMipmapLevels > 1 ? mipHeight : alignedMipHeight,
                    levelBuffer: new Uint8Array(arrayBuffer, elementOffset, mipByteSize)
                };
                elementOffset += mipByteSize;
            }
            // HINT: Aligns to 4-byte boundary after jumping imageSize (in lieu of mipPadding)
            imageOffset += imageSize + 4; // (+4 to jump the imageSize field itself)
            imageOffset = imageOffset % 4 !== 0 ? imageOffset + 4 - (imageOffset % 4) : imageOffset;
            // Calculate mipWidth, mipHeight for _next_ iteration
            mipWidth = (mipWidth >> 1) || 1;
            mipHeight = (mipHeight >> 1) || 1;
            alignedMipWidth = (mipWidth + blockWidth - 1) & ~(blockWidth - 1);
            alignedMipHeight = (mipHeight + blockHeight - 1) & ~(blockHeight - 1);
            // Each mipmap level is 4-times smaller?
            mipByteSize = alignedMipWidth * alignedMipHeight * imagePixelByteSize;
        }
        // We use the levelBuffers feature of CompressedTextureResource b/c texture data is image-major, not level-major.
        if (glType !== 0) {
            throw new Error('TODO: Uncompressed');
        }
        return imageBuffers.map(function (levelBuffers) { return new CompressedTextureResource(null, {
            format: glInternalFormat,
            width: pixelWidth,
            height: pixelHeight,
            levels: numberOfMipmapLevels,
            levelBuffers: levelBuffers,
        }); });
    };
    /** Checks whether the arrayBuffer contains a valid *.ktx file. */
    KTXLoader.validate = function (url, dataView) {
        // NOTE: Do not optimize this into 3 32-bit integer comparison because the endianness
        // of the data is not specified.
        for (var i = 0; i < FILE_IDENTIFIER.length; i++) {
            if (dataView.getUint8(i) !== FILE_IDENTIFIER[i]) {
                console.error(url + " is not a valid *.ktx file!");
                return false;
            }
        }
        return true;
    };
    return KTXLoader;
}());

/*!
 * @pixi/particle-container - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/particle-container is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$2 = function(d, b) {
    extendStatics$2 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$2(d, b);
};

function __extends$2(d, b) {
    extendStatics$2(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

/**
 * The ParticleContainer class is a really fast version of the Container built solely for speed,
 * so use when you need a lot of sprites or particles.
 *
 * The tradeoff of the ParticleContainer is that most advanced functionality will not work.
 * ParticleContainer implements the basic object transform (position, scale, rotation)
 * and some advanced functionality like tint (as of v4.5.6).
 *
 * Other more advanced functionality like masking, children, filters, etc will not work on sprites in this batch.
 *
 * It's extremely easy to use:
 * ```js
 * let container = new ParticleContainer();
 *
 * for (let i = 0; i < 100; ++i)
 * {
 *     let sprite = PIXI.Sprite.from("myImage.png");
 *     container.addChild(sprite);
 * }
 * ```
 *
 * And here you have a hundred sprites that will be rendered at the speed of light.
 *
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 */
var ParticleContainer = /** @class */ (function (_super) {
    __extends$2(ParticleContainer, _super);
    /**
     * @param {number} [maxSize=1500] - The maximum number of particles that can be rendered by the container.
     *  Affects size of allocated buffers.
     * @param {object} [properties] - The properties of children that should be uploaded to the gpu and applied.
     * @param {boolean} [properties.vertices=false] - When true, vertices be uploaded and applied.
     *                  if sprite's ` scale/anchor/trim/frame/orig` is dynamic, please set `true`.
     * @param {boolean} [properties.position=true] - When true, position be uploaded and applied.
     * @param {boolean} [properties.rotation=false] - When true, rotation be uploaded and applied.
     * @param {boolean} [properties.uvs=false] - When true, uvs be uploaded and applied.
     * @param {boolean} [properties.tint=false] - When true, alpha and tint be uploaded and applied.
     * @param {number} [batchSize=16384] - Number of particles per batch. If less than maxSize, it uses maxSize instead.
     * @param {boolean} [autoResize=false] - If true, container allocates more batches in case
     *  there are more than `maxSize` particles.
     */
    function ParticleContainer(maxSize, properties, batchSize, autoResize) {
        if (maxSize === void 0) { maxSize = 1500; }
        if (batchSize === void 0) { batchSize = 16384; }
        if (autoResize === void 0) { autoResize = false; }
        var _this = _super.call(this) || this;
        // Making sure the batch size is valid
        // 65535 is max vertex index in the index buffer (see ParticleRenderer)
        // so max number of particles is 65536 / 4 = 16384
        var maxBatchSize = 16384;
        if (batchSize > maxBatchSize) {
            batchSize = maxBatchSize;
        }
        /**
         * Set properties to be dynamic (true) / static (false)
         *
         * @member {boolean[]}
         * @private
         */
        _this._properties = [false, true, false, false, false];
        /**
         * @member {number}
         * @private
         */
        _this._maxSize = maxSize;
        /**
         * @member {number}
         * @private
         */
        _this._batchSize = batchSize;
        /**
         * @member {Array<PIXI.Buffer>}
         * @private
         */
        _this._buffers = null;
        /**
         * for every batch stores _updateID corresponding to the last change in that batch
         * @member {number[]}
         * @private
         */
        _this._bufferUpdateIDs = [];
        /**
         * when child inserted, removed or changes position this number goes up
         * @member {number[]}
         * @private
         */
        _this._updateID = 0;
        /**
         * @member {boolean}
         *
         */
        _this.interactiveChildren = false;
        /**
         * The blend mode to be applied to the sprite. Apply a value of `PIXI.BLEND_MODES.NORMAL`
         * to reset the blend mode.
         *
         * @member {number}
         * @default PIXI.BLEND_MODES.NORMAL
         * @see PIXI.BLEND_MODES
         */
        _this.blendMode = BLEND_MODES$1.NORMAL;
        /**
         * If true, container allocates more batches in case there are more than `maxSize` particles.
         * @member {boolean}
         * @default false
         */
        _this.autoResize = autoResize;
        /**
         * If true PixiJS will Math.floor() x/y values when rendering, stopping pixel interpolation.
         * Advantages can include sharper image quality (like text) and faster rendering on canvas.
         * The main disadvantage is movement of objects may appear less smooth.
         * Default to true here as performance is usually the priority for particles.
         *
         * @member {boolean}
         * @default true
         */
        _this.roundPixels = true;
        /**
         * The texture used to render the children.
         *
         * @readonly
         * @member {PIXI.BaseTexture}
         */
        _this.baseTexture = null;
        _this.setProperties(properties);
        /**
         * The tint applied to the container.
         * This is a hex value. A value of 0xFFFFFF will remove any tint effect.
         *
         * @private
         * @member {number}
         * @default 0xFFFFFF
         */
        _this._tint = 0;
        _this.tintRgb = new Float32Array(4);
        _this.tint = 0xFFFFFF;
        return _this;
    }
    /**
     * Sets the private properties array to dynamic / static based on the passed properties object
     *
     * @param {object} properties - The properties to be uploaded
     */
    ParticleContainer.prototype.setProperties = function (properties) {
        if (properties) {
            this._properties[0] = 'vertices' in properties || 'scale' in properties
                ? !!properties.vertices || !!properties.scale : this._properties[0];
            this._properties[1] = 'position' in properties ? !!properties.position : this._properties[1];
            this._properties[2] = 'rotation' in properties ? !!properties.rotation : this._properties[2];
            this._properties[3] = 'uvs' in properties ? !!properties.uvs : this._properties[3];
            this._properties[4] = 'tint' in properties || 'alpha' in properties
                ? !!properties.tint || !!properties.alpha : this._properties[4];
        }
    };
    /**
     * Updates the object transform for rendering
     *
     * @private
     */
    ParticleContainer.prototype.updateTransform = function () {
        // TODO don't need to!
        this.displayObjectUpdateTransform();
    };
    Object.defineProperty(ParticleContainer.prototype, "tint", {
        /**
         * The tint applied to the container. This is a hex value.
         * A value of 0xFFFFFF will remove any tint effect.
         ** IMPORTANT: This is a WebGL only feature and will be ignored by the canvas renderer.
         * @member {number}
         * @default 0xFFFFFF
         */
        get: function () {
            return this._tint;
        },
        set: function (value) {
            this._tint = value;
            hex2rgb(value, this.tintRgb);
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Renders the container using the WebGL renderer
     *
     * @private
     * @param {PIXI.Renderer} renderer - The webgl renderer
     */
    ParticleContainer.prototype.render = function (renderer) {
        var _this = this;
        if (!this.visible || this.worldAlpha <= 0 || !this.children.length || !this.renderable) {
            return;
        }
        if (!this.baseTexture) {
            this.baseTexture = this.children[0]._texture.baseTexture;
            if (!this.baseTexture.valid) {
                this.baseTexture.once('update', function () { return _this.onChildrenChange(0); });
            }
        }
        renderer.batch.setObjectRenderer(renderer.plugins.particle);
        renderer.plugins.particle.render(this);
    };
    /**
     * Set the flag that static data should be updated to true
     *
     * @private
     * @param {number} smallestChildIndex - The smallest child index
     */
    ParticleContainer.prototype.onChildrenChange = function (smallestChildIndex) {
        var bufferIndex = Math.floor(smallestChildIndex / this._batchSize);
        while (this._bufferUpdateIDs.length < bufferIndex) {
            this._bufferUpdateIDs.push(0);
        }
        this._bufferUpdateIDs[bufferIndex] = ++this._updateID;
    };
    ParticleContainer.prototype.dispose = function () {
        if (this._buffers) {
            for (var i = 0; i < this._buffers.length; ++i) {
                this._buffers[i].destroy();
            }
            this._buffers = null;
        }
    };
    /**
     * Destroys the container
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
     *  have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have their
     *  destroy method called as well. 'options' will be passed on to those calls.
     * @param {boolean} [options.texture=false] - Only used for child Sprites if options.children is set to true
     *  Should it destroy the texture of the child sprite
     * @param {boolean} [options.baseTexture=false] - Only used for child Sprites if options.children is set to true
     *  Should it destroy the base texture of the child sprite
     */
    ParticleContainer.prototype.destroy = function (options) {
        _super.prototype.destroy.call(this, options);
        this.dispose();
        this._properties = null;
        this._buffers = null;
        this._bufferUpdateIDs = null;
    };
    return ParticleContainer;
}(Container));

/*
 * @author Mat Groves
 *
 * Big thanks to the very clever Matt DesLauriers <mattdesl> https://github.com/mattdesl/
 * for creating the original PixiJS version!
 * Also a thanks to https://github.com/bchevalier for tweaking the tint and alpha so that
 * they now share 4 bytes on the vertex buffer
 *
 * Heavily inspired by LibGDX's ParticleBuffer:
 * https://github.com/libgdx/libgdx/blob/master/gdx/src/com/badlogic/gdx/graphics/g2d/ParticleBuffer.java
 */
/**
 * The particle buffer manages the static and dynamic buffers for a particle container.
 *
 * @class
 * @private
 * @memberof PIXI
 */
var ParticleBuffer = /** @class */ (function () {
    /**
     * @private
     * @param {object} properties - The properties to upload.
     * @param {boolean[]} dynamicPropertyFlags - Flags for which properties are dynamic.
     * @param {number} size - The size of the batch.
     */
    function ParticleBuffer(properties, dynamicPropertyFlags, size) {
        this.geometry = new Geometry();
        this.indexBuffer = null;
        /**
         * The number of particles the buffer can hold
         *
         * @private
         * @member {number}
         */
        this.size = size;
        /**
         * A list of the properties that are dynamic.
         *
         * @private
         * @member {object[]}
         */
        this.dynamicProperties = [];
        /**
         * A list of the properties that are static.
         *
         * @private
         * @member {object[]}
         */
        this.staticProperties = [];
        for (var i = 0; i < properties.length; ++i) {
            var property = properties[i];
            // Make copy of properties object so that when we edit the offset it doesn't
            // change all other instances of the object literal
            property = {
                attributeName: property.attributeName,
                size: property.size,
                uploadFunction: property.uploadFunction,
                type: property.type || TYPES$1.FLOAT,
                offset: property.offset,
            };
            if (dynamicPropertyFlags[i]) {
                this.dynamicProperties.push(property);
            }
            else {
                this.staticProperties.push(property);
            }
        }
        this.staticStride = 0;
        this.staticBuffer = null;
        this.staticData = null;
        this.staticDataUint32 = null;
        this.dynamicStride = 0;
        this.dynamicBuffer = null;
        this.dynamicData = null;
        this.dynamicDataUint32 = null;
        this._updateID = 0;
        this.initBuffers();
    }
    /**
     * Sets up the renderer context and necessary buffers.
     *
     * @private
     */
    ParticleBuffer.prototype.initBuffers = function () {
        var geometry = this.geometry;
        var dynamicOffset = 0;
        /**
         * Holds the indices of the geometry (quads) to draw
         *
         * @member {Uint16Array}
         * @private
         */
        this.indexBuffer = new Buffer(createIndicesForQuads(this.size), true, true);
        geometry.addIndex(this.indexBuffer);
        this.dynamicStride = 0;
        for (var i = 0; i < this.dynamicProperties.length; ++i) {
            var property = this.dynamicProperties[i];
            property.offset = dynamicOffset;
            dynamicOffset += property.size;
            this.dynamicStride += property.size;
        }
        var dynBuffer = new ArrayBuffer(this.size * this.dynamicStride * 4 * 4);
        this.dynamicData = new Float32Array(dynBuffer);
        this.dynamicDataUint32 = new Uint32Array(dynBuffer);
        this.dynamicBuffer = new Buffer(this.dynamicData, false, false);
        // static //
        var staticOffset = 0;
        this.staticStride = 0;
        for (var i = 0; i < this.staticProperties.length; ++i) {
            var property = this.staticProperties[i];
            property.offset = staticOffset;
            staticOffset += property.size;
            this.staticStride += property.size;
        }
        var statBuffer = new ArrayBuffer(this.size * this.staticStride * 4 * 4);
        this.staticData = new Float32Array(statBuffer);
        this.staticDataUint32 = new Uint32Array(statBuffer);
        this.staticBuffer = new Buffer(this.staticData, true, false);
        for (var i = 0; i < this.dynamicProperties.length; ++i) {
            var property = this.dynamicProperties[i];
            geometry.addAttribute(property.attributeName, this.dynamicBuffer, 0, property.type === TYPES$1.UNSIGNED_BYTE, property.type, this.dynamicStride * 4, property.offset * 4);
        }
        for (var i = 0; i < this.staticProperties.length; ++i) {
            var property = this.staticProperties[i];
            geometry.addAttribute(property.attributeName, this.staticBuffer, 0, property.type === TYPES$1.UNSIGNED_BYTE, property.type, this.staticStride * 4, property.offset * 4);
        }
    };
    /**
     * Uploads the dynamic properties.
     *
     * @private
     * @param {PIXI.DisplayObject[]} children - The children to upload.
     * @param {number} startIndex - The index to start at.
     * @param {number} amount - The number to upload.
     */
    ParticleBuffer.prototype.uploadDynamic = function (children, startIndex, amount) {
        for (var i = 0; i < this.dynamicProperties.length; i++) {
            var property = this.dynamicProperties[i];
            property.uploadFunction(children, startIndex, amount, property.type === TYPES$1.UNSIGNED_BYTE ? this.dynamicDataUint32 : this.dynamicData, this.dynamicStride, property.offset);
        }
        this.dynamicBuffer._updateID++;
    };
    /**
     * Uploads the static properties.
     *
     * @private
     * @param {PIXI.DisplayObject[]} children - The children to upload.
     * @param {number} startIndex - The index to start at.
     * @param {number} amount - The number to upload.
     */
    ParticleBuffer.prototype.uploadStatic = function (children, startIndex, amount) {
        for (var i = 0; i < this.staticProperties.length; i++) {
            var property = this.staticProperties[i];
            property.uploadFunction(children, startIndex, amount, property.type === TYPES$1.UNSIGNED_BYTE ? this.staticDataUint32 : this.staticData, this.staticStride, property.offset);
        }
        this.staticBuffer._updateID++;
    };
    /**
     * Destroys the ParticleBuffer.
     *
     * @private
     */
    ParticleBuffer.prototype.destroy = function () {
        this.indexBuffer = null;
        this.dynamicProperties = null;
        this.dynamicBuffer = null;
        this.dynamicData = null;
        this.dynamicDataUint32 = null;
        this.staticProperties = null;
        this.staticBuffer = null;
        this.staticData = null;
        this.staticDataUint32 = null;
        // all buffers are destroyed inside geometry
        this.geometry.destroy();
    };
    return ParticleBuffer;
}());

var fragment = "varying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nuniform sampler2D uSampler;\n\nvoid main(void){\n    vec4 color = texture2D(uSampler, vTextureCoord) * vColor;\n    gl_FragColor = color;\n}";

var vertex = "attribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec4 aColor;\n\nattribute vec2 aPositionCoord;\nattribute float aRotation;\n\nuniform mat3 translationMatrix;\nuniform vec4 uColor;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nvoid main(void){\n    float x = (aVertexPosition.x) * cos(aRotation) - (aVertexPosition.y) * sin(aRotation);\n    float y = (aVertexPosition.x) * sin(aRotation) + (aVertexPosition.y) * cos(aRotation);\n\n    vec2 v = vec2(x, y);\n    v = v + aPositionCoord;\n\n    gl_Position = vec4((translationMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);\n\n    vTextureCoord = aTextureCoord;\n    vColor = aColor * uColor;\n}\n";

/*
 * @author Mat Groves
 *
 * Big thanks to the very clever Matt DesLauriers <mattdesl> https://github.com/mattdesl/
 * for creating the original PixiJS version!
 * Also a thanks to https://github.com/bchevalier for tweaking the tint and alpha so that they now
 * share 4 bytes on the vertex buffer
 *
 * Heavily inspired by LibGDX's ParticleRenderer:
 * https://github.com/libgdx/libgdx/blob/master/gdx/src/com/badlogic/gdx/graphics/g2d/ParticleRenderer.java
 */
/**
 * Renderer for Particles that is designer for speed over feature set.
 *
 * @class
 * @memberof PIXI
 */
var ParticleRenderer = /** @class */ (function (_super) {
    __extends$2(ParticleRenderer, _super);
    /**
     * @param {PIXI.Renderer} renderer - The renderer this sprite batch works for.
     */
    function ParticleRenderer(renderer) {
        var _this = _super.call(this, renderer) || this;
        // 65535 is max vertex index in the index buffer (see ParticleRenderer)
        // so max number of particles is 65536 / 4 = 16384
        // and max number of element in the index buffer is 16384 * 6 = 98304
        // Creating a full index buffer, overhead is 98304 * 2 = 196Ko
        // let numIndices = 98304;
        /**
         * The default shader that is used if a sprite doesn't have a more specific one.
         *
         * @member {PIXI.Shader}
         */
        _this.shader = null;
        _this.properties = null;
        _this.tempMatrix = new Matrix();
        _this.properties = [
            // verticesData
            {
                attributeName: 'aVertexPosition',
                size: 2,
                uploadFunction: _this.uploadVertices,
                offset: 0,
            },
            // positionData
            {
                attributeName: 'aPositionCoord',
                size: 2,
                uploadFunction: _this.uploadPosition,
                offset: 0,
            },
            // rotationData
            {
                attributeName: 'aRotation',
                size: 1,
                uploadFunction: _this.uploadRotation,
                offset: 0,
            },
            // uvsData
            {
                attributeName: 'aTextureCoord',
                size: 2,
                uploadFunction: _this.uploadUvs,
                offset: 0,
            },
            // tintData
            {
                attributeName: 'aColor',
                size: 1,
                type: TYPES$1.UNSIGNED_BYTE,
                uploadFunction: _this.uploadTint,
                offset: 0,
            } ];
        _this.shader = Shader.from(vertex, fragment, {});
        /**
         * The WebGL state in which this renderer will work.
         *
         * @member {PIXI.State}
         * @readonly
         */
        _this.state = State.for2d();
        return _this;
    }
    /**
     * Renders the particle container object.
     *
     * @param {PIXI.ParticleContainer} container - The container to render using this ParticleRenderer
     */
    ParticleRenderer.prototype.render = function (container) {
        var children = container.children;
        var maxSize = container._maxSize;
        var batchSize = container._batchSize;
        var renderer = this.renderer;
        var totalChildren = children.length;
        if (totalChildren === 0) {
            return;
        }
        else if (totalChildren > maxSize && !container.autoResize) {
            totalChildren = maxSize;
        }
        var buffers = container._buffers;
        if (!buffers) {
            buffers = container._buffers = this.generateBuffers(container);
        }
        var baseTexture = children[0]._texture.baseTexture;
        // if the uvs have not updated then no point rendering just yet!
        this.state.blendMode = correctBlendMode(container.blendMode, baseTexture.alphaMode);
        renderer.state.set(this.state);
        var gl = renderer.gl;
        var m = container.worldTransform.copyTo(this.tempMatrix);
        m.prepend(renderer.globalUniforms.uniforms.projectionMatrix);
        this.shader.uniforms.translationMatrix = m.toArray(true);
        this.shader.uniforms.uColor = premultiplyRgba(container.tintRgb, container.worldAlpha, this.shader.uniforms.uColor, baseTexture.alphaMode);
        this.shader.uniforms.uSampler = baseTexture;
        this.renderer.shader.bind(this.shader);
        var updateStatic = false;
        // now lets upload and render the buffers..
        for (var i = 0, j = 0; i < totalChildren; i += batchSize, j += 1) {
            var amount = (totalChildren - i);
            if (amount > batchSize) {
                amount = batchSize;
            }
            if (j >= buffers.length) {
                buffers.push(this._generateOneMoreBuffer(container));
            }
            var buffer = buffers[j];
            // we always upload the dynamic
            buffer.uploadDynamic(children, i, amount);
            var bid = container._bufferUpdateIDs[j] || 0;
            updateStatic = updateStatic || (buffer._updateID < bid);
            // we only upload the static content when we have to!
            if (updateStatic) {
                buffer._updateID = container._updateID;
                buffer.uploadStatic(children, i, amount);
            }
            // bind the buffer
            renderer.geometry.bind(buffer.geometry);
            gl.drawElements(gl.TRIANGLES, amount * 6, gl.UNSIGNED_SHORT, 0);
        }
    };
    /**
     * Creates one particle buffer for each child in the container we want to render and updates internal properties
     *
     * @param {PIXI.ParticleContainer} container - The container to render using this ParticleRenderer
     * @return {PIXI.ParticleBuffer[]} The buffers
     * @private
     */
    ParticleRenderer.prototype.generateBuffers = function (container) {
        var buffers = [];
        var size = container._maxSize;
        var batchSize = container._batchSize;
        var dynamicPropertyFlags = container._properties;
        for (var i = 0; i < size; i += batchSize) {
            buffers.push(new ParticleBuffer(this.properties, dynamicPropertyFlags, batchSize));
        }
        return buffers;
    };
    /**
     * Creates one more particle buffer, because container has autoResize feature
     *
     * @param {PIXI.ParticleContainer} container - The container to render using this ParticleRenderer
     * @return {PIXI.ParticleBuffer} generated buffer
     * @private
     */
    ParticleRenderer.prototype._generateOneMoreBuffer = function (container) {
        var batchSize = container._batchSize;
        var dynamicPropertyFlags = container._properties;
        return new ParticleBuffer(this.properties, dynamicPropertyFlags, batchSize);
    };
    /**
     * Uploads the vertices.
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their vertices uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    ParticleRenderer.prototype.uploadVertices = function (children, startIndex, amount, array, stride, offset) {
        var w0 = 0;
        var w1 = 0;
        var h0 = 0;
        var h1 = 0;
        for (var i = 0; i < amount; ++i) {
            var sprite = children[startIndex + i];
            var texture = sprite._texture;
            var sx = sprite.scale.x;
            var sy = sprite.scale.y;
            var trim = texture.trim;
            var orig = texture.orig;
            if (trim) {
                // if the sprite is trimmed and is not a tilingsprite then we need to add the
                // extra space before transforming the sprite coords..
                w1 = trim.x - (sprite.anchor.x * orig.width);
                w0 = w1 + trim.width;
                h1 = trim.y - (sprite.anchor.y * orig.height);
                h0 = h1 + trim.height;
            }
            else {
                w0 = (orig.width) * (1 - sprite.anchor.x);
                w1 = (orig.width) * -sprite.anchor.x;
                h0 = orig.height * (1 - sprite.anchor.y);
                h1 = orig.height * -sprite.anchor.y;
            }
            array[offset] = w1 * sx;
            array[offset + 1] = h1 * sy;
            array[offset + stride] = w0 * sx;
            array[offset + stride + 1] = h1 * sy;
            array[offset + (stride * 2)] = w0 * sx;
            array[offset + (stride * 2) + 1] = h0 * sy;
            array[offset + (stride * 3)] = w1 * sx;
            array[offset + (stride * 3) + 1] = h0 * sy;
            offset += stride * 4;
        }
    };
    /**
     * Uploads the position.
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their positions uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    ParticleRenderer.prototype.uploadPosition = function (children, startIndex, amount, array, stride, offset) {
        for (var i = 0; i < amount; i++) {
            var spritePosition = children[startIndex + i].position;
            array[offset] = spritePosition.x;
            array[offset + 1] = spritePosition.y;
            array[offset + stride] = spritePosition.x;
            array[offset + stride + 1] = spritePosition.y;
            array[offset + (stride * 2)] = spritePosition.x;
            array[offset + (stride * 2) + 1] = spritePosition.y;
            array[offset + (stride * 3)] = spritePosition.x;
            array[offset + (stride * 3) + 1] = spritePosition.y;
            offset += stride * 4;
        }
    };
    /**
     * Uploads the rotation.
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their rotation uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    ParticleRenderer.prototype.uploadRotation = function (children, startIndex, amount, array, stride, offset) {
        for (var i = 0; i < amount; i++) {
            var spriteRotation = children[startIndex + i].rotation;
            array[offset] = spriteRotation;
            array[offset + stride] = spriteRotation;
            array[offset + (stride * 2)] = spriteRotation;
            array[offset + (stride * 3)] = spriteRotation;
            offset += stride * 4;
        }
    };
    /**
     * Uploads the Uvs
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their rotation uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    ParticleRenderer.prototype.uploadUvs = function (children, startIndex, amount, array, stride, offset) {
        for (var i = 0; i < amount; ++i) {
            var textureUvs = children[startIndex + i]._texture._uvs;
            if (textureUvs) {
                array[offset] = textureUvs.x0;
                array[offset + 1] = textureUvs.y0;
                array[offset + stride] = textureUvs.x1;
                array[offset + stride + 1] = textureUvs.y1;
                array[offset + (stride * 2)] = textureUvs.x2;
                array[offset + (stride * 2) + 1] = textureUvs.y2;
                array[offset + (stride * 3)] = textureUvs.x3;
                array[offset + (stride * 3) + 1] = textureUvs.y3;
                offset += stride * 4;
            }
            else {
                // TODO you know this can be easier!
                array[offset] = 0;
                array[offset + 1] = 0;
                array[offset + stride] = 0;
                array[offset + stride + 1] = 0;
                array[offset + (stride * 2)] = 0;
                array[offset + (stride * 2) + 1] = 0;
                array[offset + (stride * 3)] = 0;
                array[offset + (stride * 3) + 1] = 0;
                offset += stride * 4;
            }
        }
    };
    /**
     * Uploads the tint.
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their rotation uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    ParticleRenderer.prototype.uploadTint = function (children, startIndex, amount, array, stride, offset) {
        for (var i = 0; i < amount; ++i) {
            var sprite = children[startIndex + i];
            var premultiplied = sprite._texture.baseTexture.alphaMode > 0;
            var alpha = sprite.alpha;
            // we dont call extra function if alpha is 1.0, that's faster
            var argb = alpha < 1.0 && premultiplied
                ? premultiplyTint(sprite._tintRGB, alpha) : sprite._tintRGB + (alpha * 255 << 24);
            array[offset] = argb;
            array[offset + stride] = argb;
            array[offset + (stride * 2)] = argb;
            array[offset + (stride * 3)] = argb;
            offset += stride * 4;
        }
    };
    /**
     * Destroys the ParticleRenderer.
     */
    ParticleRenderer.prototype.destroy = function () {
        _super.prototype.destroy.call(this);
        if (this.shader) {
            this.shader.destroy();
            this.shader = null;
        }
        this.tempMatrix = null;
    };
    return ParticleRenderer;
}(ObjectRenderer));

/*!
 * @pixi/sprite - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/sprite is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$3 = function(d, b) {
    extendStatics$3 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$3(d, b);
};

function __extends$3(d, b) {
    extendStatics$3(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var tempPoint = new Point();
var indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
/**
 * The Sprite object is the base for all textured objects that are rendered to the screen
*
 * A sprite can be created directly from an image like this:
 *
 * ```js
 * let sprite = PIXI.Sprite.from('assets/image.png');
 * ```
 *
 * The more efficient way to create sprites is using a {@link PIXI.Spritesheet},
 * as swapping base textures when rendering to the screen is inefficient.
 *
 * ```js
 * PIXI.Loader.shared.add("assets/spritesheet.json").load(setup);
 *
 * function setup() {
 *   let sheet = PIXI.Loader.shared.resources["assets/spritesheet.json"].spritesheet;
 *   let sprite = new PIXI.Sprite(sheet.textures["image.png"]);
 *   ...
 * }
 * ```
 *
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 */
var Sprite = /** @class */ (function (_super) {
    __extends$3(Sprite, _super);
    /**
     * @param {PIXI.Texture} [texture] - The texture for this sprite.
     */
    function Sprite(texture) {
        var _this = _super.call(this) || this;
        /**
         * The anchor point defines the normalized coordinates
         * in the texture that map to the position of this
         * sprite.
         *
         * By default, this is `(0,0)` (or `texture.defaultAnchor`
         * if you have modified that), which means the position
         * `(x,y)` of this `Sprite` will be the top-left corner.
         *
         * Note: Updating `texture.defaultAnchor` after
         * constructing a `Sprite` does _not_ update its anchor.
         *
         * {@link https://docs.cocos2d-x.org/cocos2d-x/en/sprites/manipulation.html}
         *
         * @default `texture.defaultAnchor`
         * @member {PIXI.ObservablePoint}
         * @private
         */
        _this._anchor = new ObservablePoint(_this._onAnchorUpdate, _this, (texture ? texture.defaultAnchor.x : 0), (texture ? texture.defaultAnchor.y : 0));
        /**
         * The texture that the sprite is using
         *
         * @private
         * @member {PIXI.Texture}
         */
        _this._texture = null;
        /**
         * The width of the sprite (this is initially set by the texture)
         *
         * @protected
         * @member {number}
         */
        _this._width = 0;
        /**
         * The height of the sprite (this is initially set by the texture)
         *
         * @protected
         * @member {number}
         */
        _this._height = 0;
        /**
         * The tint applied to the sprite. This is a hex value. A value of 0xFFFFFF will remove any tint effect.
         *
         * @private
         * @member {number}
         * @default 0xFFFFFF
         */
        _this._tint = null;
        /**
         * The tint applied to the sprite. This is a RGB value. A value of 0xFFFFFF will remove any tint effect.
         *
         * @private
         * @member {number}
         * @default 16777215
         */
        _this._tintRGB = null;
        _this.tint = 0xFFFFFF;
        /**
         * The blend mode to be applied to the sprite. Apply a value of `PIXI.BLEND_MODES.NORMAL` to reset the blend mode.
         *
         * @member {number}
         * @default PIXI.BLEND_MODES.NORMAL
         * @see PIXI.BLEND_MODES
         */
        _this.blendMode = BLEND_MODES$1.NORMAL;
        /**
         * Cached tint value so we can tell when the tint is changed.
         * Value is used for 2d CanvasRenderer.
         *
         * @protected
         * @member {number}
         * @default 0xFFFFFF
         */
        _this._cachedTint = 0xFFFFFF;
        /**
         * this is used to store the uvs data of the sprite, assigned at the same time
         * as the vertexData in calculateVertices()
         *
         * @private
         * @member {Float32Array}
         */
        _this.uvs = null;
        // call texture setter
        _this.texture = texture || Texture.EMPTY;
        /**
         * this is used to store the vertex data of the sprite (basically a quad)
         *
         * @private
         * @member {Float32Array}
         */
        _this.vertexData = new Float32Array(8);
        /**
         * This is used to calculate the bounds of the object IF it is a trimmed sprite
         *
         * @private
         * @member {Float32Array}
         */
        _this.vertexTrimmedData = null;
        _this._transformID = -1;
        _this._textureID = -1;
        _this._transformTrimmedID = -1;
        _this._textureTrimmedID = -1;
        // Batchable stuff..
        // TODO could make this a mixin?
        _this.indices = indices;
        /**
         * Plugin that is responsible for rendering this element.
         * Allows to customize the rendering process without overriding '_render' & '_renderCanvas' methods.
         *
         * @member {string}
         * @default 'batch'
         */
        _this.pluginName = 'batch';
        /**
         * used to fast check if a sprite is.. a sprite!
         * @member {boolean}
         */
        _this.isSprite = true;
        /**
         * Internal roundPixels field
         *
         * @member {boolean}
         * @private
         */
        _this._roundPixels = settings.ROUND_PIXELS;
        return _this;
    }
    /**
     * When the texture is updated, this event will fire to update the scale and frame
     *
     * @protected
     */
    Sprite.prototype._onTextureUpdate = function () {
        this._textureID = -1;
        this._textureTrimmedID = -1;
        this._cachedTint = 0xFFFFFF;
        // so if _width is 0 then width was not set..
        if (this._width) {
            this.scale.x = sign(this.scale.x) * this._width / this._texture.orig.width;
        }
        if (this._height) {
            this.scale.y = sign(this.scale.y) * this._height / this._texture.orig.height;
        }
    };
    /**
     * Called when the anchor position updates.
     *
     * @private
     */
    Sprite.prototype._onAnchorUpdate = function () {
        this._transformID = -1;
        this._transformTrimmedID = -1;
    };
    /**
     * calculates worldTransform * vertices, store it in vertexData
     */
    Sprite.prototype.calculateVertices = function () {
        var texture = this._texture;
        if (this._transformID === this.transform._worldID && this._textureID === texture._updateID) {
            return;
        }
        // update texture UV here, because base texture can be changed without calling `_onTextureUpdate`
        if (this._textureID !== texture._updateID) {
            this.uvs = this._texture._uvs.uvsFloat32;
        }
        this._transformID = this.transform._worldID;
        this._textureID = texture._updateID;
        // set the vertex data
        var wt = this.transform.worldTransform;
        var a = wt.a;
        var b = wt.b;
        var c = wt.c;
        var d = wt.d;
        var tx = wt.tx;
        var ty = wt.ty;
        var vertexData = this.vertexData;
        var trim = texture.trim;
        var orig = texture.orig;
        var anchor = this._anchor;
        var w0 = 0;
        var w1 = 0;
        var h0 = 0;
        var h1 = 0;
        if (trim) {
            // if the sprite is trimmed and is not a tilingsprite then we need to add the extra
            // space before transforming the sprite coords.
            w1 = trim.x - (anchor._x * orig.width);
            w0 = w1 + trim.width;
            h1 = trim.y - (anchor._y * orig.height);
            h0 = h1 + trim.height;
        }
        else {
            w1 = -anchor._x * orig.width;
            w0 = w1 + orig.width;
            h1 = -anchor._y * orig.height;
            h0 = h1 + orig.height;
        }
        // xy
        vertexData[0] = (a * w1) + (c * h1) + tx;
        vertexData[1] = (d * h1) + (b * w1) + ty;
        // xy
        vertexData[2] = (a * w0) + (c * h1) + tx;
        vertexData[3] = (d * h1) + (b * w0) + ty;
        // xy
        vertexData[4] = (a * w0) + (c * h0) + tx;
        vertexData[5] = (d * h0) + (b * w0) + ty;
        // xy
        vertexData[6] = (a * w1) + (c * h0) + tx;
        vertexData[7] = (d * h0) + (b * w1) + ty;
        if (this._roundPixels) {
            var resolution = settings.RESOLUTION;
            for (var i = 0; i < vertexData.length; ++i) {
                vertexData[i] = Math.round((vertexData[i] * resolution | 0) / resolution);
            }
        }
    };
    /**
     * calculates worldTransform * vertices for a non texture with a trim. store it in vertexTrimmedData
     * This is used to ensure that the true width and height of a trimmed texture is respected
     */
    Sprite.prototype.calculateTrimmedVertices = function () {
        if (!this.vertexTrimmedData) {
            this.vertexTrimmedData = new Float32Array(8);
        }
        else if (this._transformTrimmedID === this.transform._worldID && this._textureTrimmedID === this._texture._updateID) {
            return;
        }
        this._transformTrimmedID = this.transform._worldID;
        this._textureTrimmedID = this._texture._updateID;
        // lets do some special trim code!
        var texture = this._texture;
        var vertexData = this.vertexTrimmedData;
        var orig = texture.orig;
        var anchor = this._anchor;
        // lets calculate the new untrimmed bounds..
        var wt = this.transform.worldTransform;
        var a = wt.a;
        var b = wt.b;
        var c = wt.c;
        var d = wt.d;
        var tx = wt.tx;
        var ty = wt.ty;
        var w1 = -anchor._x * orig.width;
        var w0 = w1 + orig.width;
        var h1 = -anchor._y * orig.height;
        var h0 = h1 + orig.height;
        // xy
        vertexData[0] = (a * w1) + (c * h1) + tx;
        vertexData[1] = (d * h1) + (b * w1) + ty;
        // xy
        vertexData[2] = (a * w0) + (c * h1) + tx;
        vertexData[3] = (d * h1) + (b * w0) + ty;
        // xy
        vertexData[4] = (a * w0) + (c * h0) + tx;
        vertexData[5] = (d * h0) + (b * w0) + ty;
        // xy
        vertexData[6] = (a * w1) + (c * h0) + tx;
        vertexData[7] = (d * h0) + (b * w1) + ty;
    };
    /**
    *
    * Renders the object using the WebGL renderer
    *
    * @protected
    * @param {PIXI.Renderer} renderer - The webgl renderer to use.
    */
    Sprite.prototype._render = function (renderer) {
        this.calculateVertices();
        renderer.batch.setObjectRenderer(renderer.plugins[this.pluginName]);
        renderer.plugins[this.pluginName].render(this);
    };
    /**
     * Updates the bounds of the sprite.
     *
     * @protected
     */
    Sprite.prototype._calculateBounds = function () {
        var trim = this._texture.trim;
        var orig = this._texture.orig;
        // First lets check to see if the current texture has a trim..
        if (!trim || (trim.width === orig.width && trim.height === orig.height)) {
            // no trim! lets use the usual calculations..
            this.calculateVertices();
            this._bounds.addQuad(this.vertexData);
        }
        else {
            // lets calculate a special trimmed bounds...
            this.calculateTrimmedVertices();
            this._bounds.addQuad(this.vertexTrimmedData);
        }
    };
    /**
     * Gets the local bounds of the sprite object.
     *
     * @param {PIXI.Rectangle} [rect] - Optional output rectangle.
     * @return {PIXI.Rectangle} The bounds.
     */
    Sprite.prototype.getLocalBounds = function (rect) {
        // we can do a fast local bounds if the sprite has no children!
        if (this.children.length === 0) {
            this._bounds.minX = this._texture.orig.width * -this._anchor._x;
            this._bounds.minY = this._texture.orig.height * -this._anchor._y;
            this._bounds.maxX = this._texture.orig.width * (1 - this._anchor._x);
            this._bounds.maxY = this._texture.orig.height * (1 - this._anchor._y);
            if (!rect) {
                if (!this._localBoundsRect) {
                    this._localBoundsRect = new Rectangle();
                }
                rect = this._localBoundsRect;
            }
            return this._bounds.getRectangle(rect);
        }
        return _super.prototype.getLocalBounds.call(this, rect);
    };
    /**
     * Tests if a point is inside this sprite
     *
     * @param {PIXI.IPointData} point - the point to test
     * @return {boolean} the result of the test
     */
    Sprite.prototype.containsPoint = function (point) {
        this.worldTransform.applyInverse(point, tempPoint);
        var width = this._texture.orig.width;
        var height = this._texture.orig.height;
        var x1 = -width * this.anchor.x;
        var y1 = 0;
        if (tempPoint.x >= x1 && tempPoint.x < x1 + width) {
            y1 = -height * this.anchor.y;
            if (tempPoint.y >= y1 && tempPoint.y < y1 + height) {
                return true;
            }
        }
        return false;
    };
    /**
     * Destroys this sprite and optionally its texture and children
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
     *  have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have their destroy
     *      method called as well. 'options' will be passed on to those calls.
     * @param {boolean} [options.texture=false] - Should it destroy the current texture of the sprite as well
     * @param {boolean} [options.baseTexture=false] - Should it destroy the base texture of the sprite as well
     */
    Sprite.prototype.destroy = function (options) {
        _super.prototype.destroy.call(this, options);
        this._texture.off('update', this._onTextureUpdate, this);
        this._anchor = null;
        var destroyTexture = typeof options === 'boolean' ? options : options && options.texture;
        if (destroyTexture) {
            var destroyBaseTexture = typeof options === 'boolean' ? options : options && options.baseTexture;
            this._texture.destroy(!!destroyBaseTexture);
        }
        this._texture = null;
    };
    // some helper functions..
    /**
     * Helper function that creates a new sprite based on the source you provide.
     * The source can be - frame id, image url, video url, canvas element, video element, base texture
     *
     * @static
     * @param {string|PIXI.Texture|HTMLCanvasElement|HTMLVideoElement} source - Source to create texture from
     * @param {object} [options] - See {@link PIXI.BaseTexture}'s constructor for options.
     * @return {PIXI.Sprite} The newly created sprite
     */
    Sprite.from = function (source, options) {
        var texture = (source instanceof Texture)
            ? source
            : Texture.from(source, options);
        return new Sprite(texture);
    };
    Object.defineProperty(Sprite.prototype, "roundPixels", {
        get: function () {
            return this._roundPixels;
        },
        /**
         * If true PixiJS will Math.floor() x/y values when rendering, stopping pixel interpolation.
         * Advantages can include sharper image quality (like text) and faster rendering on canvas.
         * The main disadvantage is movement of objects may appear less smooth.
         * To set the global default, change {@link PIXI.settings.ROUND_PIXELS}
         *
         * @member {boolean}
         * @default false
         */
        set: function (value) {
            if (this._roundPixels !== value) {
                this._transformID = -1;
            }
            this._roundPixels = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sprite.prototype, "width", {
        /**
         * The width of the sprite, setting this will actually modify the scale to achieve the value set
         *
         * @member {number}
         */
        get: function () {
            return Math.abs(this.scale.x) * this._texture.orig.width;
        },
        set: function (value) {
            var s = sign(this.scale.x) || 1;
            this.scale.x = s * value / this._texture.orig.width;
            this._width = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sprite.prototype, "height", {
        /**
         * The height of the sprite, setting this will actually modify the scale to achieve the value set
         *
         * @member {number}
         */
        get: function () {
            return Math.abs(this.scale.y) * this._texture.orig.height;
        },
        set: function (value) {
            var s = sign(this.scale.y) || 1;
            this.scale.y = s * value / this._texture.orig.height;
            this._height = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sprite.prototype, "anchor", {
        /**
         * The anchor sets the origin point of the sprite. The default value is taken from the {@link PIXI.Texture|Texture}
         * and passed to the constructor.
         *
         * The default is `(0,0)`, this means the sprite's origin is the top left.
         *
         * Setting the anchor to `(0.5,0.5)` means the sprite's origin is centered.
         *
         * Setting the anchor to `(1,1)` would mean the sprite's origin point will be the bottom right corner.
         *
         * If you pass only single parameter, it will set both x and y to the same value as shown in the example below.
         *
         * @example
         * const sprite = new PIXI.Sprite(texture);
         * sprite.anchor.set(0.5); // This will set the origin to center. (0.5) is same as (0.5, 0.5).
         *
         * @member {PIXI.ObservablePoint}
         */
        get: function () {
            return this._anchor;
        },
        set: function (value) {
            this._anchor.copyFrom(value);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sprite.prototype, "tint", {
        /**
         * The tint applied to the sprite. This is a hex value.
         * A value of 0xFFFFFF will remove any tint effect.
         *
         * @member {number}
         * @default 0xFFFFFF
         */
        get: function () {
            return this._tint;
        },
        set: function (value) {
            this._tint = value;
            this._tintRGB = (value >> 16) + (value & 0xff00) + ((value & 0xff) << 16);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sprite.prototype, "texture", {
        /**
         * The texture that the sprite is using
         *
         * @member {PIXI.Texture}
         */
        get: function () {
            return this._texture;
        },
        set: function (value) {
            if (this._texture === value) {
                return;
            }
            if (this._texture) {
                this._texture.off('update', this._onTextureUpdate, this);
            }
            this._texture = value || Texture.EMPTY;
            this._cachedTint = 0xFFFFFF;
            this._textureID = -1;
            this._textureTrimmedID = -1;
            if (value) {
                // wait for the texture to load
                if (value.baseTexture.valid) {
                    this._onTextureUpdate();
                }
                else {
                    value.once('update', this._onTextureUpdate, this);
                }
            }
        },
        enumerable: false,
        configurable: true
    });
    return Sprite;
}(Container));

/*!
 * @pixi/text - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/text is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$4 = function(d, b) {
    extendStatics$4 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$4(d, b);
};

function __extends$4(d, b) {
    extendStatics$4(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

/**
 * Constants that define the type of gradient on text.
 *
 * @static
 * @constant
 * @name TEXT_GRADIENT
 * @memberof PIXI
 * @type {object}
 * @property {number} LINEAR_VERTICAL Vertical gradient
 * @property {number} LINEAR_HORIZONTAL Linear gradient
 */
var TEXT_GRADIENT;
(function (TEXT_GRADIENT) {
    TEXT_GRADIENT[TEXT_GRADIENT["LINEAR_VERTICAL"] = 0] = "LINEAR_VERTICAL";
    TEXT_GRADIENT[TEXT_GRADIENT["LINEAR_HORIZONTAL"] = 1] = "LINEAR_HORIZONTAL";
})(TEXT_GRADIENT || (TEXT_GRADIENT = {}));

// disabling eslint for now, going to rewrite this in v5
var defaultStyle = {
    align: 'left',
    breakWords: false,
    dropShadow: false,
    dropShadowAlpha: 1,
    dropShadowAngle: Math.PI / 6,
    dropShadowBlur: 0,
    dropShadowColor: 'black',
    dropShadowDistance: 5,
    fill: 'black',
    fillGradientType: TEXT_GRADIENT.LINEAR_VERTICAL,
    fillGradientStops: [],
    fontFamily: 'Arial',
    fontSize: 26,
    fontStyle: 'normal',
    fontVariant: 'normal',
    fontWeight: 'normal',
    letterSpacing: 0,
    lineHeight: 0,
    lineJoin: 'miter',
    miterLimit: 10,
    padding: 0,
    stroke: 'black',
    strokeThickness: 0,
    textBaseline: 'alphabetic',
    trim: false,
    whiteSpace: 'pre',
    wordWrap: false,
    wordWrapWidth: 100,
    leading: 0,
};
var genericFontFamilies = [
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui' ];
/**
 * A TextStyle Object contains information to decorate a Text objects.
 *
 * An instance can be shared between multiple Text objects; then changing the style will update all text objects using it.
 *
 * A tool can be used to generate a text style [here](https://pixijs.io/pixi-text-style).
 *
 * @class
 * @memberof PIXI
 */
var TextStyle = /** @class */ (function () {
    /**
     * @param {object} [style] - The style parameters
     * @param {string} [style.align='left'] - Alignment for multiline text ('left', 'center' or 'right'),
     *  does not affect single line text
     * @param {boolean} [style.breakWords=false] - Indicates if lines can be wrapped within words, it
     *  needs wordWrap to be set to true
     * @param {boolean} [style.dropShadow=false] - Set a drop shadow for the text
     * @param {number} [style.dropShadowAlpha=1] - Set alpha for the drop shadow
     * @param {number} [style.dropShadowAngle=Math.PI/6] - Set a angle of the drop shadow
     * @param {number} [style.dropShadowBlur=0] - Set a shadow blur radius
     * @param {string|number} [style.dropShadowColor='black'] - A fill style to be used on the dropshadow e.g 'red', '#00FF00'
     * @param {number} [style.dropShadowDistance=5] - Set a distance of the drop shadow
     * @param {string|string[]|number|number[]|CanvasGradient|CanvasPattern} [style.fill='black'] - A canvas
     *  fillstyle that will be used on the text e.g 'red', '#00FF00'. Can be an array to create a gradient
     *  eg ['#000000','#FFFFFF']
     * {@link https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillStyle|MDN}
     * @param {number} [style.fillGradientType=PIXI.TEXT_GRADIENT.LINEAR_VERTICAL] - If fill is an array of colours
     *  to create a gradient, this can change the type/direction of the gradient. See {@link PIXI.TEXT_GRADIENT}
     * @param {number[]} [style.fillGradientStops] - If fill is an array of colours to create a gradient, this array can set
     * the stop points (numbers between 0 and 1) for the color, overriding the default behaviour of evenly spacing them.
     * @param {string|string[]} [style.fontFamily='Arial'] - The font family
     * @param {number|string} [style.fontSize=26] - The font size (as a number it converts to px, but as a string,
     *  equivalents are '26px','20pt','160%' or '1.6em')
     * @param {string} [style.fontStyle='normal'] - The font style ('normal', 'italic' or 'oblique')
     * @param {string} [style.fontVariant='normal'] - The font variant ('normal' or 'small-caps')
     * @param {string} [style.fontWeight='normal'] - The font weight ('normal', 'bold', 'bolder', 'lighter' and '100',
     *  '200', '300', '400', '500', '600', '700', '800' or '900')
     * @param {number} [style.leading=0] - The space between lines
     * @param {number} [style.letterSpacing=0] - The amount of spacing between letters, default is 0
     * @param {number} [style.lineHeight] - The line height, a number that represents the vertical space that a letter uses
     * @param {string} [style.lineJoin='miter'] - The lineJoin property sets the type of corner created, it can resolve
     *      spiked text issues. Possible values "miter" (creates a sharp corner), "round" (creates a round corner) or "bevel"
     *      (creates a squared corner).
     * @param {number} [style.miterLimit=10] - The miter limit to use when using the 'miter' lineJoin mode. This can reduce
     *      or increase the spikiness of rendered text.
     * @param {number} [style.padding=0] - Occasionally some fonts are cropped. Adding some padding will prevent this from
     *     happening by adding padding to all sides of the text.
     * @param {string|number} [style.stroke='black'] - A canvas fillstyle that will be used on the text stroke
     *  e.g 'blue', '#FCFF00'
     * @param {number} [style.strokeThickness=0] - A number that represents the thickness of the stroke.
     *  Default is 0 (no stroke)
     * @param {boolean} [style.trim=false] - Trim transparent borders
     * @param {string} [style.textBaseline='alphabetic'] - The baseline of the text that is rendered.
     * @param {string} [style.whiteSpace='pre'] - Determines whether newlines & spaces are collapsed or preserved "normal"
     *      (collapse, collapse), "pre" (preserve, preserve) | "pre-line" (preserve, collapse). It needs wordWrap to be set to true
     * @param {boolean} [style.wordWrap=false] - Indicates if word wrap should be used
     * @param {number} [style.wordWrapWidth=100] - The width at which text will wrap, it needs wordWrap to be set to true
     */
    function TextStyle(style) {
        this.styleID = 0;
        this.reset();
        deepCopyProperties(this, style, style);
    }
    /**
     * Creates a new TextStyle object with the same values as this one.
     * Note that the only the properties of the object are cloned.
     *
     * @return {PIXI.TextStyle} New cloned TextStyle object
     */
    TextStyle.prototype.clone = function () {
        var clonedProperties = {};
        deepCopyProperties(clonedProperties, this, defaultStyle);
        return new TextStyle(clonedProperties);
    };
    /**
     * Resets all properties to the defaults specified in TextStyle.prototype._default
     */
    TextStyle.prototype.reset = function () {
        deepCopyProperties(this, defaultStyle, defaultStyle);
    };
    Object.defineProperty(TextStyle.prototype, "align", {
        /**
         * Alignment for multiline text ('left', 'center' or 'right'), does not affect single line text
         *
         * @member {string}
         */
        get: function () {
            return this._align;
        },
        set: function (align) {
            if (this._align !== align) {
                this._align = align;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "breakWords", {
        /**
         * Indicates if lines can be wrapped within words, it needs wordWrap to be set to true
         *
         * @member {boolean}
         */
        get: function () {
            return this._breakWords;
        },
        set: function (breakWords) {
            if (this._breakWords !== breakWords) {
                this._breakWords = breakWords;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "dropShadow", {
        /**
         * Set a drop shadow for the text
         *
         * @member {boolean}
         */
        get: function () {
            return this._dropShadow;
        },
        set: function (dropShadow) {
            if (this._dropShadow !== dropShadow) {
                this._dropShadow = dropShadow;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "dropShadowAlpha", {
        /**
         * Set alpha for the drop shadow
         *
         * @member {number}
         */
        get: function () {
            return this._dropShadowAlpha;
        },
        set: function (dropShadowAlpha) {
            if (this._dropShadowAlpha !== dropShadowAlpha) {
                this._dropShadowAlpha = dropShadowAlpha;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "dropShadowAngle", {
        /**
         * Set a angle of the drop shadow
         *
         * @member {number}
         */
        get: function () {
            return this._dropShadowAngle;
        },
        set: function (dropShadowAngle) {
            if (this._dropShadowAngle !== dropShadowAngle) {
                this._dropShadowAngle = dropShadowAngle;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "dropShadowBlur", {
        /**
         * Set a shadow blur radius
         *
         * @member {number}
         */
        get: function () {
            return this._dropShadowBlur;
        },
        set: function (dropShadowBlur) {
            if (this._dropShadowBlur !== dropShadowBlur) {
                this._dropShadowBlur = dropShadowBlur;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "dropShadowColor", {
        /**
         * A fill style to be used on the dropshadow e.g 'red', '#00FF00'
         *
         * @member {string|number}
         */
        get: function () {
            return this._dropShadowColor;
        },
        set: function (dropShadowColor) {
            var outputColor = getColor(dropShadowColor);
            if (this._dropShadowColor !== outputColor) {
                this._dropShadowColor = outputColor;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "dropShadowDistance", {
        /**
         * Set a distance of the drop shadow
         *
         * @member {number}
         */
        get: function () {
            return this._dropShadowDistance;
        },
        set: function (dropShadowDistance) {
            if (this._dropShadowDistance !== dropShadowDistance) {
                this._dropShadowDistance = dropShadowDistance;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "fill", {
        /**
         * A canvas fillstyle that will be used on the text e.g 'red', '#00FF00'.
         * Can be an array to create a gradient eg ['#000000','#FFFFFF']
         * {@link https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillStyle|MDN}
         *
         * @member {string|string[]|number|number[]|CanvasGradient|CanvasPattern}
         */
        get: function () {
            return this._fill;
        },
        set: function (fill) {
            // TODO: Can't have different types for getter and setter. The getter shouldn't have the number type as
            //       the setter converts to string. See this thread for more details:
            //       https://github.com/microsoft/TypeScript/issues/2521
            // TODO: Not sure if getColor works properly with CanvasGradient and/or CanvasPattern, can't pass in
            //       without casting here.
            var outputColor = getColor(fill);
            if (this._fill !== outputColor) {
                this._fill = outputColor;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "fillGradientType", {
        /**
         * If fill is an array of colours to create a gradient, this can change the type/direction of the gradient.
         * See {@link PIXI.TEXT_GRADIENT}
         *
         * @member {number}
         */
        get: function () {
            return this._fillGradientType;
        },
        set: function (fillGradientType) {
            if (this._fillGradientType !== fillGradientType) {
                this._fillGradientType = fillGradientType;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "fillGradientStops", {
        /**
         * If fill is an array of colours to create a gradient, this array can set the stop points
         * (numbers between 0 and 1) for the color, overriding the default behaviour of evenly spacing them.
         *
         * @member {number[]}
         */
        get: function () {
            return this._fillGradientStops;
        },
        set: function (fillGradientStops) {
            if (!areArraysEqual(this._fillGradientStops, fillGradientStops)) {
                this._fillGradientStops = fillGradientStops;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "fontFamily", {
        /**
         * The font family
         *
         * @member {string|string[]}
         */
        get: function () {
            return this._fontFamily;
        },
        set: function (fontFamily) {
            if (this.fontFamily !== fontFamily) {
                this._fontFamily = fontFamily;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "fontSize", {
        /**
         * The font size
         * (as a number it converts to px, but as a string, equivalents are '26px','20pt','160%' or '1.6em')
         *
         * @member {number|string}
         */
        get: function () {
            return this._fontSize;
        },
        set: function (fontSize) {
            if (this._fontSize !== fontSize) {
                this._fontSize = fontSize;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "fontStyle", {
        /**
         * The font style
         * ('normal', 'italic' or 'oblique')
         *
         * @member {string}
         */
        get: function () {
            return this._fontStyle;
        },
        set: function (fontStyle) {
            if (this._fontStyle !== fontStyle) {
                this._fontStyle = fontStyle;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "fontVariant", {
        /**
         * The font variant
         * ('normal' or 'small-caps')
         *
         * @member {string}
         */
        get: function () {
            return this._fontVariant;
        },
        set: function (fontVariant) {
            if (this._fontVariant !== fontVariant) {
                this._fontVariant = fontVariant;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "fontWeight", {
        /**
         * The font weight
         * ('normal', 'bold', 'bolder', 'lighter' and '100', '200', '300', '400', '500', '600', '700', 800' or '900')
         *
         * @member {string}
         */
        get: function () {
            return this._fontWeight;
        },
        set: function (fontWeight) {
            if (this._fontWeight !== fontWeight) {
                this._fontWeight = fontWeight;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "letterSpacing", {
        /**
         * The amount of spacing between letters, default is 0
         *
         * @member {number}
         */
        get: function () {
            return this._letterSpacing;
        },
        set: function (letterSpacing) {
            if (this._letterSpacing !== letterSpacing) {
                this._letterSpacing = letterSpacing;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "lineHeight", {
        /**
         * The line height, a number that represents the vertical space that a letter uses
         *
         * @member {number}
         */
        get: function () {
            return this._lineHeight;
        },
        set: function (lineHeight) {
            if (this._lineHeight !== lineHeight) {
                this._lineHeight = lineHeight;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "leading", {
        /**
         * The space between lines
         *
         * @member {number}
         */
        get: function () {
            return this._leading;
        },
        set: function (leading) {
            if (this._leading !== leading) {
                this._leading = leading;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "lineJoin", {
        /**
         * The lineJoin property sets the type of corner created, it can resolve spiked text issues.
         * Default is 'miter' (creates a sharp corner).
         *
         * @member {string}
         */
        get: function () {
            return this._lineJoin;
        },
        set: function (lineJoin) {
            if (this._lineJoin !== lineJoin) {
                this._lineJoin = lineJoin;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "miterLimit", {
        /**
         * The miter limit to use when using the 'miter' lineJoin mode
         * This can reduce or increase the spikiness of rendered text.
         *
         * @member {number}
         */
        get: function () {
            return this._miterLimit;
        },
        set: function (miterLimit) {
            if (this._miterLimit !== miterLimit) {
                this._miterLimit = miterLimit;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "padding", {
        /**
         * Occasionally some fonts are cropped. Adding some padding will prevent this from happening
         * by adding padding to all sides of the text.
         *
         * @member {number}
         */
        get: function () {
            return this._padding;
        },
        set: function (padding) {
            if (this._padding !== padding) {
                this._padding = padding;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "stroke", {
        /**
         * A canvas fillstyle that will be used on the text stroke
         * e.g 'blue', '#FCFF00'
         *
         * @member {string|number}
         */
        get: function () {
            return this._stroke;
        },
        set: function (stroke) {
            // TODO: Can't have different types for getter and setter. The getter shouldn't have the number type as
            //       the setter converts to string. See this thread for more details:
            //       https://github.com/microsoft/TypeScript/issues/2521
            var outputColor = getColor(stroke);
            if (this._stroke !== outputColor) {
                this._stroke = outputColor;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "strokeThickness", {
        /**
         * A number that represents the thickness of the stroke.
         * Default is 0 (no stroke)
         *
         * @member {number}
         */
        get: function () {
            return this._strokeThickness;
        },
        set: function (strokeThickness) {
            if (this._strokeThickness !== strokeThickness) {
                this._strokeThickness = strokeThickness;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "textBaseline", {
        /**
         * The baseline of the text that is rendered.
         *
         * @member {string}
         */
        get: function () {
            return this._textBaseline;
        },
        set: function (textBaseline) {
            if (this._textBaseline !== textBaseline) {
                this._textBaseline = textBaseline;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "trim", {
        /**
         * Trim transparent borders
         *
         * @member {boolean}
         */
        get: function () {
            return this._trim;
        },
        set: function (trim) {
            if (this._trim !== trim) {
                this._trim = trim;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "whiteSpace", {
        /**
         * How newlines and spaces should be handled.
         * Default is 'pre' (preserve, preserve).
         *
         *  value       | New lines     |   Spaces
         *  ---         | ---           |   ---
         * 'normal'     | Collapse      |   Collapse
         * 'pre'        | Preserve      |   Preserve
         * 'pre-line'   | Preserve      |   Collapse
         *
         * @member {string}
         */
        get: function () {
            return this._whiteSpace;
        },
        set: function (whiteSpace) {
            if (this._whiteSpace !== whiteSpace) {
                this._whiteSpace = whiteSpace;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "wordWrap", {
        /**
         * Indicates if word wrap should be used
         *
         * @member {boolean}
         */
        get: function () {
            return this._wordWrap;
        },
        set: function (wordWrap) {
            if (this._wordWrap !== wordWrap) {
                this._wordWrap = wordWrap;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TextStyle.prototype, "wordWrapWidth", {
        /**
         * The width at which text will wrap, it needs wordWrap to be set to true
         *
         * @member {number}
         */
        get: function () {
            return this._wordWrapWidth;
        },
        set: function (wordWrapWidth) {
            if (this._wordWrapWidth !== wordWrapWidth) {
                this._wordWrapWidth = wordWrapWidth;
                this.styleID++;
            }
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Generates a font style string to use for `TextMetrics.measureFont()`.
     *
     * @return {string} Font style string, for passing to `TextMetrics.measureFont()`
     */
    TextStyle.prototype.toFontString = function () {
        // build canvas api font setting from individual components. Convert a numeric this.fontSize to px
        var fontSizeString = (typeof this.fontSize === 'number') ? this.fontSize + "px" : this.fontSize;
        // Clean-up fontFamily property by quoting each font name
        // this will support font names with spaces
        var fontFamilies = this.fontFamily;
        if (!Array.isArray(this.fontFamily)) {
            fontFamilies = this.fontFamily.split(',');
        }
        for (var i = fontFamilies.length - 1; i >= 0; i--) {
            // Trim any extra white-space
            var fontFamily = fontFamilies[i].trim();
            // Check if font already contains strings
            if (!(/([\"\'])[^\'\"]+\1/).test(fontFamily) && genericFontFamilies.indexOf(fontFamily) < 0) {
                fontFamily = "\"" + fontFamily + "\"";
            }
            fontFamilies[i] = fontFamily;
        }
        return this.fontStyle + " " + this.fontVariant + " " + this.fontWeight + " " + fontSizeString + " " + fontFamilies.join(',');
    };
    return TextStyle;
}());
/**
 * Utility function to convert hexadecimal colors to strings, and simply return the color if it's a string.
 * @private
 * @param {string|number} color
 * @return {string} The color as a string.
 */
function getSingleColor(color) {
    if (typeof color === 'number') {
        return hex2string(color);
    }
    else if (typeof color === 'string') {
        if (color.indexOf('0x') === 0) {
            color = color.replace('0x', '#');
        }
    }
    return color;
}
function getColor(color) {
    if (!Array.isArray(color)) {
        return getSingleColor(color);
    }
    else {
        for (var i = 0; i < color.length; ++i) {
            color[i] = getSingleColor(color[i]);
        }
        return color;
    }
}
/**
 * Utility function to convert hexadecimal colors to strings, and simply return the color if it's a string.
 * This version can also convert array of colors
 * @private
 * @param {Array} array1 - First array to compare
 * @param {Array} array2 - Second array to compare
 * @return {boolean} Do the arrays contain the same values in the same order
 */
function areArraysEqual(array1, array2) {
    if (!Array.isArray(array1) || !Array.isArray(array2)) {
        return false;
    }
    if (array1.length !== array2.length) {
        return false;
    }
    for (var i = 0; i < array1.length; ++i) {
        if (array1[i] !== array2[i]) {
            return false;
        }
    }
    return true;
}
/**
 * Utility function to ensure that object properties are copied by value, and not by reference
 * @private
 * @param {Object} target - Target object to copy properties into
 * @param {Object} source - Source object for the properties to copy
 * @param {string} propertyObj - Object containing properties names we want to loop over
 */
function deepCopyProperties(target, source, propertyObj) {
    for (var prop in propertyObj) {
        if (Array.isArray(source[prop])) {
            target[prop] = source[prop].slice();
        }
        else {
            target[prop] = source[prop];
        }
    }
}

/**
 * The TextMetrics object represents the measurement of a block of text with a specified style.
 *
 * ```js
 * let style = new PIXI.TextStyle({fontFamily : 'Arial', fontSize: 24, fill : 0xff1010, align : 'center'})
 * let textMetrics = PIXI.TextMetrics.measureText('Your text', style)
 * ```
 *
 * @class
 * @memberof PIXI
 */
var TextMetrics = /** @class */ (function () {
    /**
     * @param {string} text - the text that was measured
     * @param {PIXI.TextStyle} style - the style that was measured
     * @param {number} width - the measured width of the text
     * @param {number} height - the measured height of the text
     * @param {string[]} lines - an array of the lines of text broken by new lines and wrapping if specified in style
     * @param {number[]} lineWidths - an array of the line widths for each line matched to `lines`
     * @param {number} lineHeight - the measured line height for this style
     * @param {number} maxLineWidth - the maximum line width for all measured lines
     * @param {Object} fontProperties - the font properties object from TextMetrics.measureFont
     */
    function TextMetrics(text, style, width, height, lines, lineWidths, lineHeight, maxLineWidth, fontProperties) {
        /**
         * The text that was measured
         *
         * @member {string}
         */
        this.text = text;
        /**
         * The style that was measured
         *
         * @member {PIXI.TextStyle}
         */
        this.style = style;
        /**
         * The measured width of the text
         *
         * @member {number}
         */
        this.width = width;
        /**
         * The measured height of the text
         *
         * @member {number}
         */
        this.height = height;
        /**
         * An array of lines of the text broken by new lines and wrapping is specified in style
         *
         * @member {string[]}
         */
        this.lines = lines;
        /**
         * An array of the line widths for each line matched to `lines`
         *
         * @member {number[]}
         */
        this.lineWidths = lineWidths;
        /**
         * The measured line height for this style
         *
         * @member {number}
         */
        this.lineHeight = lineHeight;
        /**
         * The maximum line width for all measured lines
         *
         * @member {number}
         */
        this.maxLineWidth = maxLineWidth;
        /**
         * The font properties object from TextMetrics.measureFont
         *
         * @member {PIXI.IFontMetrics}
         */
        this.fontProperties = fontProperties;
    }
    /**
     * Measures the supplied string of text and returns a Rectangle.
     *
     * @param {string} text - the text to measure.
     * @param {PIXI.TextStyle} style - the text style to use for measuring
     * @param {boolean} [wordWrap] - optional override for if word-wrap should be applied to the text.
     * @param {HTMLCanvasElement} [canvas] - optional specification of the canvas to use for measuring.
     * @return {PIXI.TextMetrics} measured width and height of the text.
     */
    TextMetrics.measureText = function (text, style, wordWrap, canvas) {
        if (canvas === void 0) { canvas = TextMetrics._canvas; }
        wordWrap = (wordWrap === undefined || wordWrap === null) ? style.wordWrap : wordWrap;
        var font = style.toFontString();
        var fontProperties = TextMetrics.measureFont(font);
        // fallback in case UA disallow canvas data extraction
        // (toDataURI, getImageData functions)
        if (fontProperties.fontSize === 0) {
            fontProperties.fontSize = style.fontSize;
            fontProperties.ascent = style.fontSize;
        }
        var context = canvas.getContext('2d');
        context.font = font;
        var outputText = wordWrap ? TextMetrics.wordWrap(text, style, canvas) : text;
        var lines = outputText.split(/(?:\r\n|\r|\n)/);
        var lineWidths = new Array(lines.length);
        var maxLineWidth = 0;
        for (var i = 0; i < lines.length; i++) {
            var lineWidth = context.measureText(lines[i]).width + ((lines[i].length - 1) * style.letterSpacing);
            lineWidths[i] = lineWidth;
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
        }
        var width = maxLineWidth + style.strokeThickness;
        if (style.dropShadow) {
            width += style.dropShadowDistance;
        }
        var lineHeight = style.lineHeight || fontProperties.fontSize + style.strokeThickness;
        var height = Math.max(lineHeight, fontProperties.fontSize + style.strokeThickness)
            + ((lines.length - 1) * (lineHeight + style.leading));
        if (style.dropShadow) {
            height += style.dropShadowDistance;
        }
        return new TextMetrics(text, style, width, height, lines, lineWidths, lineHeight + style.leading, maxLineWidth, fontProperties);
    };
    /**
     * Applies newlines to a string to have it optimally fit into the horizontal
     * bounds set by the Text object's wordWrapWidth property.
     *
     * @private
     * @param {string} text - String to apply word wrapping to
     * @param {PIXI.TextStyle} style - the style to use when wrapping
     * @param {HTMLCanvasElement} [canvas] - optional specification of the canvas to use for measuring.
     * @return {string} New string with new lines applied where required
     */
    TextMetrics.wordWrap = function (text, style, canvas) {
        if (canvas === void 0) { canvas = TextMetrics._canvas; }
        var context = canvas.getContext('2d');
        var width = 0;
        var line = '';
        var lines = '';
        var cache = Object.create(null);
        var letterSpacing = style.letterSpacing, whiteSpace = style.whiteSpace;
        // How to handle whitespaces
        var collapseSpaces = TextMetrics.collapseSpaces(whiteSpace);
        var collapseNewlines = TextMetrics.collapseNewlines(whiteSpace);
        // whether or not spaces may be added to the beginning of lines
        var canPrependSpaces = !collapseSpaces;
        // There is letterSpacing after every char except the last one
        // t_h_i_s_' '_i_s_' '_a_n_' '_e_x_a_m_p_l_e_' '_!
        // so for convenience the above needs to be compared to width + 1 extra letterSpace
        // t_h_i_s_' '_i_s_' '_a_n_' '_e_x_a_m_p_l_e_' '_!_
        // ________________________________________________
        // And then the final space is simply no appended to each line
        var wordWrapWidth = style.wordWrapWidth + letterSpacing;
        // break text into words, spaces and newline chars
        var tokens = TextMetrics.tokenize(text);
        for (var i = 0; i < tokens.length; i++) {
            // get the word, space or newlineChar
            var token = tokens[i];
            // if word is a new line
            if (TextMetrics.isNewline(token)) {
                // keep the new line
                if (!collapseNewlines) {
                    lines += TextMetrics.addLine(line);
                    canPrependSpaces = !collapseSpaces;
                    line = '';
                    width = 0;
                    continue;
                }
                // if we should collapse new lines
                // we simply convert it into a space
                token = ' ';
            }
            // if we should collapse repeated whitespaces
            if (collapseSpaces) {
                // check both this and the last tokens for spaces
                var currIsBreakingSpace = TextMetrics.isBreakingSpace(token);
                var lastIsBreakingSpace = TextMetrics.isBreakingSpace(line[line.length - 1]);
                if (currIsBreakingSpace && lastIsBreakingSpace) {
                    continue;
                }
            }
            // get word width from cache if possible
            var tokenWidth = TextMetrics.getFromCache(token, letterSpacing, cache, context);
            // word is longer than desired bounds
            if (tokenWidth > wordWrapWidth) {
                // if we are not already at the beginning of a line
                if (line !== '') {
                    // start newlines for overflow words
                    lines += TextMetrics.addLine(line);
                    line = '';
                    width = 0;
                }
                // break large word over multiple lines
                if (TextMetrics.canBreakWords(token, style.breakWords)) {
                    // break word into characters
                    var characters = TextMetrics.wordWrapSplit(token);
                    // loop the characters
                    for (var j = 0; j < characters.length; j++) {
                        var char = characters[j];
                        var k = 1;
                        // we are not at the end of the token
                        while (characters[j + k]) {
                            var nextChar = characters[j + k];
                            var lastChar = char[char.length - 1];
                            // should not split chars
                            if (!TextMetrics.canBreakChars(lastChar, nextChar, token, j, style.breakWords)) {
                                // combine chars & move forward one
                                char += nextChar;
                            }
                            else {
                                break;
                            }
                            k++;
                        }
                        j += char.length - 1;
                        var characterWidth = TextMetrics.getFromCache(char, letterSpacing, cache, context);
                        if (characterWidth + width > wordWrapWidth) {
                            lines += TextMetrics.addLine(line);
                            canPrependSpaces = false;
                            line = '';
                            width = 0;
                        }
                        line += char;
                        width += characterWidth;
                    }
                }
                // run word out of the bounds
                else {
                    // if there are words in this line already
                    // finish that line and start a new one
                    if (line.length > 0) {
                        lines += TextMetrics.addLine(line);
                        line = '';
                        width = 0;
                    }
                    var isLastToken = i === tokens.length - 1;
                    // give it its own line if it's not the end
                    lines += TextMetrics.addLine(token, !isLastToken);
                    canPrependSpaces = false;
                    line = '';
                    width = 0;
                }
            }
            // word could fit
            else {
                // word won't fit because of existing words
                // start a new line
                if (tokenWidth + width > wordWrapWidth) {
                    // if its a space we don't want it
                    canPrependSpaces = false;
                    // add a new line
                    lines += TextMetrics.addLine(line);
                    // start a new line
                    line = '';
                    width = 0;
                }
                // don't add spaces to the beginning of lines
                if (line.length > 0 || !TextMetrics.isBreakingSpace(token) || canPrependSpaces) {
                    // add the word to the current line
                    line += token;
                    // update width counter
                    width += tokenWidth;
                }
            }
        }
        lines += TextMetrics.addLine(line, false);
        return lines;
    };
    /**
     * Convienience function for logging each line added during the wordWrap
     * method
     *
     * @private
     * @param  {string}   line        - The line of text to add
     * @param  {boolean}  newLine     - Add new line character to end
     * @return {string}  A formatted line
     */
    TextMetrics.addLine = function (line, newLine) {
        if (newLine === void 0) { newLine = true; }
        line = TextMetrics.trimRight(line);
        line = (newLine) ? line + "\n" : line;
        return line;
    };
    /**
     * Gets & sets the widths of calculated characters in a cache object
     *
     * @private
     * @param  {string}                    key            - The key
     * @param  {number}                    letterSpacing  - The letter spacing
     * @param  {object}                    cache          - The cache
     * @param  {CanvasRenderingContext2D}  context        - The canvas context
     * @return {number}                    The from cache.
     */
    TextMetrics.getFromCache = function (key, letterSpacing, cache, context) {
        var width = cache[key];
        if (typeof width !== 'number') {
            var spacing = ((key.length) * letterSpacing);
            width = context.measureText(key).width + spacing;
            cache[key] = width;
        }
        return width;
    };
    /**
     * Determines whether we should collapse breaking spaces
     *
     * @private
     * @param  {string}   whiteSpace - The TextStyle property whiteSpace
     * @return {boolean}  should collapse
     */
    TextMetrics.collapseSpaces = function (whiteSpace) {
        return (whiteSpace === 'normal' || whiteSpace === 'pre-line');
    };
    /**
     * Determines whether we should collapse newLine chars
     *
     * @private
     * @param  {string}   whiteSpace - The white space
     * @return {boolean}  should collapse
     */
    TextMetrics.collapseNewlines = function (whiteSpace) {
        return (whiteSpace === 'normal');
    };
    /**
     * trims breaking whitespaces from string
     *
     * @private
     * @param  {string}  text - The text
     * @return {string}  trimmed string
     */
    TextMetrics.trimRight = function (text) {
        if (typeof text !== 'string') {
            return '';
        }
        for (var i = text.length - 1; i >= 0; i--) {
            var char = text[i];
            if (!TextMetrics.isBreakingSpace(char)) {
                break;
            }
            text = text.slice(0, -1);
        }
        return text;
    };
    /**
     * Determines if char is a newline.
     *
     * @private
     * @param  {string}  char - The character
     * @return {boolean}  True if newline, False otherwise.
     */
    TextMetrics.isNewline = function (char) {
        if (typeof char !== 'string') {
            return false;
        }
        return (TextMetrics._newlines.indexOf(char.charCodeAt(0)) >= 0);
    };
    /**
     * Determines if char is a breaking whitespace.
     *
     * It allows one to determine whether char should be a breaking whitespace
     * For example certain characters in CJK langs or numbers.
     * It must return a boolean.
     *
     * @param  {string}  char     - The character
     * @param  {string}  [nextChar] - The next character
     * @return {boolean}  True if whitespace, False otherwise.
     */
    TextMetrics.isBreakingSpace = function (char, _nextChar) {
        if (typeof char !== 'string') {
            return false;
        }
        return (TextMetrics._breakingSpaces.indexOf(char.charCodeAt(0)) >= 0);
    };
    /**
     * Splits a string into words, breaking-spaces and newLine characters
     *
     * @private
     * @param  {string}  text - The text
     * @return {string[]}  A tokenized array
     */
    TextMetrics.tokenize = function (text) {
        var tokens = [];
        var token = '';
        if (typeof text !== 'string') {
            return tokens;
        }
        for (var i = 0; i < text.length; i++) {
            var char = text[i];
            var nextChar = text[i + 1];
            if (TextMetrics.isBreakingSpace(char, nextChar) || TextMetrics.isNewline(char)) {
                if (token !== '') {
                    tokens.push(token);
                    token = '';
                }
                tokens.push(char);
                continue;
            }
            token += char;
        }
        if (token !== '') {
            tokens.push(token);
        }
        return tokens;
    };
    /**
     * Overridable helper method used internally by TextMetrics, exposed to allow customizing the class's behavior.
     *
     * It allows one to customise which words should break
     * Examples are if the token is CJK or numbers.
     * It must return a boolean.
     *
     * @param  {string}  token       - The token
     * @param  {boolean}  breakWords - The style attr break words
     * @return {boolean} whether to break word or not
     */
    TextMetrics.canBreakWords = function (_token, breakWords) {
        return breakWords;
    };
    /**
     * Overridable helper method used internally by TextMetrics, exposed to allow customizing the class's behavior.
     *
     * It allows one to determine whether a pair of characters
     * should be broken by newlines
     * For example certain characters in CJK langs or numbers.
     * It must return a boolean.
     *
     * @param  {string}  char        - The character
     * @param  {string}  nextChar    - The next character
     * @param  {string}  token       - The token/word the characters are from
     * @param  {number}  index       - The index in the token of the char
     * @param  {boolean}  breakWords - The style attr break words
     * @return {boolean} whether to break word or not
     */
    TextMetrics.canBreakChars = function (_char, _nextChar, _token, _index, _breakWords) {
        return true;
    };
    /**
     * Overridable helper method used internally by TextMetrics, exposed to allow customizing the class's behavior.
     *
     * It is called when a token (usually a word) has to be split into separate pieces
     * in order to determine the point to break a word.
     * It must return an array of characters.
     *
     * @example
     * // Correctly splits emojis, eg "🤪🤪" will result in two element array, each with one emoji.
     * TextMetrics.wordWrapSplit = (token) => [...token];
     *
     * @param  {string}  token - The token to split
     * @return {string[]} The characters of the token
     */
    TextMetrics.wordWrapSplit = function (token) {
        return token.split('');
    };
    /**
     * Calculates the ascent, descent and fontSize of a given font-style
     *
     * @static
     * @param {string} font - String representing the style of the font
     * @return {PIXI.IFontMetrics} Font properties object
     */
    TextMetrics.measureFont = function (font) {
        // as this method is used for preparing assets, don't recalculate things if we don't need to
        if (TextMetrics._fonts[font]) {
            return TextMetrics._fonts[font];
        }
        var properties = {
            ascent: 0,
            descent: 0,
            fontSize: 0,
        };
        var canvas = TextMetrics._canvas;
        var context = TextMetrics._context;
        context.font = font;
        var metricsString = TextMetrics.METRICS_STRING + TextMetrics.BASELINE_SYMBOL;
        var width = Math.ceil(context.measureText(metricsString).width);
        var baseline = Math.ceil(context.measureText(TextMetrics.BASELINE_SYMBOL).width);
        var height = Math.ceil(TextMetrics.HEIGHT_MULTIPLIER * baseline);
        baseline = baseline * TextMetrics.BASELINE_MULTIPLIER | 0;
        canvas.width = width;
        canvas.height = height;
        context.fillStyle = '#f00';
        context.fillRect(0, 0, width, height);
        context.font = font;
        context.textBaseline = 'alphabetic';
        context.fillStyle = '#000';
        context.fillText(metricsString, 0, baseline);
        var imagedata = context.getImageData(0, 0, width, height).data;
        var pixels = imagedata.length;
        var line = width * 4;
        var i = 0;
        var idx = 0;
        var stop = false;
        // ascent. scan from top to bottom until we find a non red pixel
        for (i = 0; i < baseline; ++i) {
            for (var j = 0; j < line; j += 4) {
                if (imagedata[idx + j] !== 255) {
                    stop = true;
                    break;
                }
            }
            if (!stop) {
                idx += line;
            }
            else {
                break;
            }
        }
        properties.ascent = baseline - i;
        idx = pixels - line;
        stop = false;
        // descent. scan from bottom to top until we find a non red pixel
        for (i = height; i > baseline; --i) {
            for (var j = 0; j < line; j += 4) {
                if (imagedata[idx + j] !== 255) {
                    stop = true;
                    break;
                }
            }
            if (!stop) {
                idx -= line;
            }
            else {
                break;
            }
        }
        properties.descent = i - baseline;
        properties.fontSize = properties.ascent + properties.descent;
        TextMetrics._fonts[font] = properties;
        return properties;
    };
    /**
     * Clear font metrics in metrics cache.
     *
     * @static
     * @param {string} [font] - font name. If font name not set then clear cache for all fonts.
     */
    TextMetrics.clearMetrics = function (font) {
        if (font === void 0) { font = ''; }
        if (font) {
            delete TextMetrics._fonts[font];
        }
        else {
            TextMetrics._fonts = {};
        }
    };
    return TextMetrics;
}());
/**
 * Internal return object for {@link PIXI.TextMetrics.measureFont `TextMetrics.measureFont`}.
 *
 * @typedef {object} FontMetrics
 * @property {number} ascent - The ascent distance
 * @property {number} descent - The descent distance
 * @property {number} fontSize - Font size from ascent to descent
 * @memberof PIXI.TextMetrics
 * @private
 */
var canvas = (function () {
    try {
        // OffscreenCanvas2D measureText can be up to 40% faster.
        var c = new OffscreenCanvas(0, 0);
        var context = c.getContext('2d');
        if (context && context.measureText) {
            return c;
        }
        return document.createElement('canvas');
    }
    catch (ex) {
        return document.createElement('canvas');
    }
})();
canvas.width = canvas.height = 10;
/**
 * Cached canvas element for measuring text
 *
 * @memberof PIXI.TextMetrics
 * @type {HTMLCanvasElement}
 * @private
 */
TextMetrics._canvas = canvas;
/**
 * Cache for context to use.
 *
 * @memberof PIXI.TextMetrics
 * @type {CanvasRenderingContext2D}
 * @private
 */
TextMetrics._context = canvas.getContext('2d');
/**
 * Cache of {@see PIXI.TextMetrics.FontMetrics} objects.
 *
 * @memberof PIXI.TextMetrics
 * @type {Object}
 * @private
 */
TextMetrics._fonts = {};
/**
 * String used for calculate font metrics.
 * These characters are all tall to help calculate the height required for text.
 *
 * @static
 * @memberof PIXI.TextMetrics
 * @name METRICS_STRING
 * @type {string}
 * @default |ÉqÅ
 */
TextMetrics.METRICS_STRING = '|ÉqÅ';
/**
 * Baseline symbol for calculate font metrics.
 *
 * @static
 * @memberof PIXI.TextMetrics
 * @name BASELINE_SYMBOL
 * @type {string}
 * @default M
 */
TextMetrics.BASELINE_SYMBOL = 'M';
/**
 * Baseline multiplier for calculate font metrics.
 *
 * @static
 * @memberof PIXI.TextMetrics
 * @name BASELINE_MULTIPLIER
 * @type {number}
 * @default 1.4
 */
TextMetrics.BASELINE_MULTIPLIER = 1.4;
/**
 * Height multiplier for setting height of canvas to calculate font metrics.
 *
 * @static
 * @memberof PIXI.TextMetrics
 * @name HEIGHT_MULTIPLIER
 * @type {number}
 * @default 2.00
 */
TextMetrics.HEIGHT_MULTIPLIER = 2.0;
/**
 * Cache of new line chars.
 *
 * @memberof PIXI.TextMetrics
 * @type {number[]}
 * @private
 */
TextMetrics._newlines = [
    0x000A,
    0x000D ];
/**
 * Cache of breaking spaces.
 *
 * @memberof PIXI.TextMetrics
 * @type {number[]}
 * @private
 */
TextMetrics._breakingSpaces = [
    0x0009,
    0x0020,
    0x2000,
    0x2001,
    0x2002,
    0x2003,
    0x2004,
    0x2005,
    0x2006,
    0x2008,
    0x2009,
    0x200A,
    0x205F,
    0x3000 ];
/**
 * A number, or a string containing a number.
 *
 * @memberof PIXI
 * @typedef {object} IFontMetrics
 * @property {number} ascent - Font ascent
 * @property {number} descent - Font descent
 * @property {number} fontSize - Font size
 */

var defaultDestroyOptions = {
    texture: true,
    children: false,
    baseTexture: true,
};
/**
 * A Text Object will create a line or multiple lines of text.
 *
 * The text is created using the [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API).
 *
 * The primary advantage of this class over BitmapText is that you have great control over the style of the text,
 * which you can change at runtime.
 *
 * The primary disadvantages is that each piece of text has it's own texture, which can use more memory.
 * When text changes, this texture has to be re-generated and re-uploaded to the GPU, taking up time.
 *
 * To split a line you can use '\n' in your text string, or, on the `style` object,
 * change its `wordWrap` property to true and and give the `wordWrapWidth` property a value.
 *
 * A Text can be created directly from a string and a style object,
 * which can be generated [here](https://pixijs.io/pixi-text-style).
 *
 * ```js
 * let text = new PIXI.Text('This is a PixiJS text',{fontFamily : 'Arial', fontSize: 24, fill : 0xff1010, align : 'center'});
 * ```
 *
 * @class
 * @extends PIXI.Sprite
 * @memberof PIXI
 */
var Text = /** @class */ (function (_super) {
    __extends$4(Text, _super);
    /**
     * @param {string} text - The string that you would like the text to display
     * @param {object|PIXI.TextStyle} [style] - The style parameters
     * @param {HTMLCanvasElement} [canvas] - The canvas element for drawing text
     */
    function Text(text, style, canvas) {
        var _this = this;
        var ownCanvas = false;
        if (!canvas) {
            canvas = document.createElement('canvas');
            ownCanvas = true;
        }
        canvas.width = 3;
        canvas.height = 3;
        var texture = Texture.from(canvas);
        texture.orig = new Rectangle();
        texture.trim = new Rectangle();
        _this = _super.call(this, texture) || this;
        /**
         * Keep track if this Text object created it's own canvas
         * element (`true`) or uses the constructor argument (`false`).
         * Used to workaround a GC issues with Safari < 13 when
         * destroying Text. See `destroy` for more info.
         *
         * @member {boolean}
         * @private
         */
        _this._ownCanvas = ownCanvas;
        /**
         * The canvas element that everything is drawn to
         *
         * @member {HTMLCanvasElement}
         */
        _this.canvas = canvas;
        /**
         * The canvas 2d context that everything is drawn with
         * @member {CanvasRenderingContext2D}
         */
        _this.context = _this.canvas.getContext('2d');
        /**
         * The resolution / device pixel ratio of the canvas.
         * This is set to automatically match the renderer resolution by default, but can be overridden by setting manually.
         * @member {number}
         * @default PIXI.settings.RESOLUTION
         */
        _this._resolution = settings.RESOLUTION;
        _this._autoResolution = true;
        /**
         * Private tracker for the current text.
         *
         * @member {string}
         * @private
         */
        _this._text = null;
        /**
         * Private tracker for the current style.
         *
         * @member {object}
         * @private
         */
        _this._style = null;
        /**
         * Private listener to track style changes.
         *
         * @member {Function}
         * @private
         */
        _this._styleListener = null;
        /**
         * Private tracker for the current font.
         *
         * @member {string}
         * @private
         */
        _this._font = '';
        _this.text = text;
        _this.style = style;
        _this.localStyleID = -1;
        return _this;
    }
    /**
     * Renders text to its canvas, and updates its texture.
     * By default this is used internally to ensure the texture is correct before rendering,
     * but it can be used called externally, for example from this class to 'pre-generate' the texture from a piece of text,
     * and then shared across multiple Sprites.
     *
     * @param {boolean} respectDirty - Whether to abort updating the text if the Text isn't dirty and the function is called.
     */
    Text.prototype.updateText = function (respectDirty) {
        var style = this._style;
        // check if style has changed..
        if (this.localStyleID !== style.styleID) {
            this.dirty = true;
            this.localStyleID = style.styleID;
        }
        if (!this.dirty && respectDirty) {
            return;
        }
        this._font = this._style.toFontString();
        var context = this.context;
        var measured = TextMetrics.measureText(this._text || ' ', this._style, this._style.wordWrap, this.canvas);
        var width = measured.width;
        var height = measured.height;
        var lines = measured.lines;
        var lineHeight = measured.lineHeight;
        var lineWidths = measured.lineWidths;
        var maxLineWidth = measured.maxLineWidth;
        var fontProperties = measured.fontProperties;
        this.canvas.width = Math.ceil(Math.ceil((Math.max(1, width) + (style.padding * 2))) * this._resolution);
        this.canvas.height = Math.ceil(Math.ceil((Math.max(1, height) + (style.padding * 2))) * this._resolution);
        context.scale(this._resolution, this._resolution);
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        context.font = this._font;
        context.lineWidth = style.strokeThickness;
        context.textBaseline = style.textBaseline;
        context.lineJoin = style.lineJoin;
        context.miterLimit = style.miterLimit;
        var linePositionX;
        var linePositionY;
        // require 2 passes if a shadow; the first to draw the drop shadow, the second to draw the text
        var passesCount = style.dropShadow ? 2 : 1;
        // For v4, we drew text at the colours of the drop shadow underneath the normal text. This gave the correct zIndex,
        // but features such as alpha and shadowblur did not look right at all, since we were using actual text as a shadow.
        //
        // For v5.0.0, we moved over to just use the canvas API for drop shadows, which made them look much nicer and more
        // visually please, but now because the stroke is drawn and then the fill, drop shadows would appear on both the fill
        // and the stroke; and fill drop shadows would appear over the top of the stroke.
        //
        // For v5.1.1, the new route is to revert to v4 style of drawing text first to get the drop shadows underneath normal
        // text, but instead drawing text in the correct location, we'll draw it off screen (-paddingY), and then adjust the
        // drop shadow so only that appears on screen (+paddingY). Now we'll have the correct draw order of the shadow
        // beneath the text, whilst also having the proper text shadow styling.
        for (var i = 0; i < passesCount; ++i) {
            var isShadowPass = style.dropShadow && i === 0;
            // we only want the drop shadow, so put text way off-screen
            var dsOffsetText = isShadowPass ? Math.ceil(Math.max(1, height) + (style.padding * 2)) : 0;
            var dsOffsetShadow = dsOffsetText * this._resolution;
            if (isShadowPass) {
                // On Safari, text with gradient and drop shadows together do not position correctly
                // if the scale of the canvas is not 1: https://bugs.webkit.org/show_bug.cgi?id=197689
                // Therefore we'll set the styles to be a plain black whilst generating this drop shadow
                context.fillStyle = 'black';
                context.strokeStyle = 'black';
                var dropShadowColor = style.dropShadowColor;
                var rgb = hex2rgb(typeof dropShadowColor === 'number' ? dropShadowColor : string2hex(dropShadowColor));
                context.shadowColor = "rgba(" + rgb[0] * 255 + "," + rgb[1] * 255 + "," + rgb[2] * 255 + "," + style.dropShadowAlpha + ")";
                context.shadowBlur = style.dropShadowBlur;
                context.shadowOffsetX = Math.cos(style.dropShadowAngle) * style.dropShadowDistance;
                context.shadowOffsetY = (Math.sin(style.dropShadowAngle) * style.dropShadowDistance) + dsOffsetShadow;
            }
            else {
                // set canvas text styles
                context.fillStyle = this._generateFillStyle(style, lines, measured);
                // TODO: Can't have different types for getter and setter. The getter shouldn't have the number type as
                //       the setter converts to string. See this thread for more details:
                //       https://github.com/microsoft/TypeScript/issues/2521
                context.strokeStyle = style.stroke;
                context.shadowColor = 'black';
                context.shadowBlur = 0;
                context.shadowOffsetX = 0;
                context.shadowOffsetY = 0;
            }
            var linePositionYShift = (lineHeight - fontProperties.fontSize) / 2;
            if (!Text.nextLineHeightBehavior || lineHeight - fontProperties.fontSize < 0) {
                linePositionYShift = 0;
            }
            // draw lines line by line
            for (var i_1 = 0; i_1 < lines.length; i_1++) {
                linePositionX = style.strokeThickness / 2;
                linePositionY = ((style.strokeThickness / 2) + (i_1 * lineHeight)) + fontProperties.ascent
                    + linePositionYShift;
                if (style.align === 'right') {
                    linePositionX += maxLineWidth - lineWidths[i_1];
                }
                else if (style.align === 'center') {
                    linePositionX += (maxLineWidth - lineWidths[i_1]) / 2;
                }
                if (style.stroke && style.strokeThickness) {
                    this.drawLetterSpacing(lines[i_1], linePositionX + style.padding, linePositionY + style.padding - dsOffsetText, true);
                }
                if (style.fill) {
                    this.drawLetterSpacing(lines[i_1], linePositionX + style.padding, linePositionY + style.padding - dsOffsetText);
                }
            }
        }
        this.updateTexture();
    };
    /**
     * Render the text with letter-spacing.
     * @param {string} text - The text to draw
     * @param {number} x - Horizontal position to draw the text
     * @param {number} y - Vertical position to draw the text
     * @param {boolean} [isStroke=false] - Is this drawing for the outside stroke of the
     *  text? If not, it's for the inside fill
     * @private
     */
    Text.prototype.drawLetterSpacing = function (text, x, y, isStroke) {
        if (isStroke === void 0) { isStroke = false; }
        var style = this._style;
        // letterSpacing of 0 means normal
        var letterSpacing = style.letterSpacing;
        if (letterSpacing === 0) {
            if (isStroke) {
                this.context.strokeText(text, x, y);
            }
            else {
                this.context.fillText(text, x, y);
            }
            return;
        }
        var currentPosition = x;
        // Using Array.from correctly splits characters whilst keeping emoji together.
        // This is not supported on IE as it requires ES6, so regular text splitting occurs.
        // This also doesn't account for emoji that are multiple emoji put together to make something else.
        // Handling all of this would require a big library itself.
        // https://medium.com/@giltayar/iterating-over-emoji-characters-the-es6-way-f06e4589516
        // https://github.com/orling/grapheme-splitter
        var stringArray = Array.from ? Array.from(text) : text.split('');
        var previousWidth = this.context.measureText(text).width;
        var currentWidth = 0;
        for (var i = 0; i < stringArray.length; ++i) {
            var currentChar = stringArray[i];
            if (isStroke) {
                this.context.strokeText(currentChar, currentPosition, y);
            }
            else {
                this.context.fillText(currentChar, currentPosition, y);
            }
            currentWidth = this.context.measureText(text.substring(i + 1)).width;
            currentPosition += previousWidth - currentWidth + letterSpacing;
            previousWidth = currentWidth;
        }
    };
    /**
     * Updates texture size based on canvas size
     *
     * @private
     */
    Text.prototype.updateTexture = function () {
        var canvas = this.canvas;
        if (this._style.trim) {
            var trimmed = trimCanvas(canvas);
            if (trimmed.data) {
                canvas.width = trimmed.width;
                canvas.height = trimmed.height;
                this.context.putImageData(trimmed.data, 0, 0);
            }
        }
        var texture = this._texture;
        var style = this._style;
        var padding = style.trim ? 0 : style.padding;
        var baseTexture = texture.baseTexture;
        texture.trim.width = texture._frame.width = canvas.width / this._resolution;
        texture.trim.height = texture._frame.height = canvas.height / this._resolution;
        texture.trim.x = -padding;
        texture.trim.y = -padding;
        texture.orig.width = texture._frame.width - (padding * 2);
        texture.orig.height = texture._frame.height - (padding * 2);
        // call sprite onTextureUpdate to update scale if _width or _height were set
        this._onTextureUpdate();
        baseTexture.setRealSize(canvas.width, canvas.height, this._resolution);
        texture.updateUvs();
        // Recursively updates transform of all objects from the root to this one
        this._recursivePostUpdateTransform();
        this.dirty = false;
    };
    /**
     * Renders the object using the WebGL renderer
     *
     * @protected
     * @param {PIXI.Renderer} renderer - The renderer
     */
    Text.prototype._render = function (renderer) {
        if (this._autoResolution && this._resolution !== renderer.resolution) {
            this._resolution = renderer.resolution;
            this.dirty = true;
        }
        this.updateText(true);
        _super.prototype._render.call(this, renderer);
    };
    /**
     * Gets the local bounds of the text object.
     *
     * @param {PIXI.Rectangle} rect - The output rectangle.
     * @return {PIXI.Rectangle} The bounds.
     */
    Text.prototype.getLocalBounds = function (rect) {
        this.updateText(true);
        return _super.prototype.getLocalBounds.call(this, rect);
    };
    /**
     * calculates the bounds of the Text as a rectangle. The bounds calculation takes the worldTransform into account.
     * @protected
     */
    Text.prototype._calculateBounds = function () {
        this.updateText(true);
        this.calculateVertices();
        // if we have already done this on THIS frame.
        this._bounds.addQuad(this.vertexData);
    };
    /**
     * Generates the fill style. Can automatically generate a gradient based on the fill style being an array
     *
     * @private
     * @param {object} style - The style.
     * @param {string[]} lines - The lines of text.
     * @return {string|number|CanvasGradient} The fill style
     */
    Text.prototype._generateFillStyle = function (style, lines, metrics) {
        // TODO: Can't have different types for getter and setter. The getter shouldn't have the number type as
        //       the setter converts to string. See this thread for more details:
        //       https://github.com/microsoft/TypeScript/issues/2521
        var fillStyle = style.fill;
        if (!Array.isArray(fillStyle)) {
            return fillStyle;
        }
        else if (fillStyle.length === 1) {
            return fillStyle[0];
        }
        // the gradient will be evenly spaced out according to how large the array is.
        // ['#FF0000', '#00FF00', '#0000FF'] would created stops at 0.25, 0.5 and 0.75
        var gradient;
        // a dropshadow will enlarge the canvas and result in the gradient being
        // generated with the incorrect dimensions
        var dropShadowCorrection = (style.dropShadow) ? style.dropShadowDistance : 0;
        // should also take padding into account, padding can offset the gradient
        var padding = style.padding || 0;
        var width = (this.canvas.width / this._resolution) - dropShadowCorrection - (padding * 2);
        var height = (this.canvas.height / this._resolution) - dropShadowCorrection - (padding * 2);
        // make a copy of the style settings, so we can manipulate them later
        var fill = fillStyle.slice();
        var fillGradientStops = style.fillGradientStops.slice();
        // wanting to evenly distribute the fills. So an array of 4 colours should give fills of 0.25, 0.5 and 0.75
        if (!fillGradientStops.length) {
            var lengthPlus1 = fill.length + 1;
            for (var i = 1; i < lengthPlus1; ++i) {
                fillGradientStops.push(i / lengthPlus1);
            }
        }
        // stop the bleeding of the last gradient on the line above to the top gradient of the this line
        // by hard defining the first gradient colour at point 0, and last gradient colour at point 1
        fill.unshift(fillStyle[0]);
        fillGradientStops.unshift(0);
        fill.push(fillStyle[fillStyle.length - 1]);
        fillGradientStops.push(1);
        if (style.fillGradientType === TEXT_GRADIENT.LINEAR_VERTICAL) {
            // start the gradient at the top center of the canvas, and end at the bottom middle of the canvas
            gradient = this.context.createLinearGradient(width / 2, padding, width / 2, height + padding);
            // we need to repeat the gradient so that each individual line of text has the same vertical gradient effect
            // ['#FF0000', '#00FF00', '#0000FF'] over 2 lines would create stops at 0.125, 0.25, 0.375, 0.625, 0.75, 0.875
            // Actual height of the text itself, not counting spacing for lineHeight/leading/dropShadow etc
            var textHeight = metrics.fontProperties.fontSize + style.strokeThickness;
            for (var i = 0; i < lines.length; i++) {
                var lastLineBottom = (metrics.lineHeight * (i - 1)) + textHeight;
                var thisLineTop = metrics.lineHeight * i;
                var thisLineGradientStart = thisLineTop;
                // Handle case where last & this line overlap
                if (i > 0 && lastLineBottom > thisLineTop) {
                    thisLineGradientStart = (thisLineTop + lastLineBottom) / 2;
                }
                var thisLineBottom = thisLineTop + textHeight;
                var nextLineTop = metrics.lineHeight * (i + 1);
                var thisLineGradientEnd = thisLineBottom;
                // Handle case where this & next line overlap
                if (i + 1 < lines.length && nextLineTop < thisLineBottom) {
                    thisLineGradientEnd = (thisLineBottom + nextLineTop) / 2;
                }
                // textHeight, but as a 0-1 size in global gradient stop space
                var gradStopLineHeight = (thisLineGradientEnd - thisLineGradientStart) / height;
                for (var j = 0; j < fill.length; j++) {
                    // 0-1 stop point for the current line, multiplied to global space afterwards
                    var lineStop = 0;
                    if (typeof fillGradientStops[j] === 'number') {
                        lineStop = fillGradientStops[j];
                    }
                    else {
                        lineStop = j / fill.length;
                    }
                    var globalStop = Math.min(1, Math.max(0, (thisLineGradientStart / height) + (lineStop * gradStopLineHeight)));
                    // There's potential for floating point precision issues at the seams between gradient repeats.
                    globalStop = Number(globalStop.toFixed(5));
                    gradient.addColorStop(globalStop, fill[j]);
                }
            }
        }
        else {
            // start the gradient at the center left of the canvas, and end at the center right of the canvas
            gradient = this.context.createLinearGradient(padding, height / 2, width + padding, height / 2);
            // can just evenly space out the gradients in this case, as multiple lines makes no difference
            // to an even left to right gradient
            var totalIterations = fill.length + 1;
            var currentIteration = 1;
            for (var i = 0; i < fill.length; i++) {
                var stop = void 0;
                if (typeof fillGradientStops[i] === 'number') {
                    stop = fillGradientStops[i];
                }
                else {
                    stop = currentIteration / totalIterations;
                }
                gradient.addColorStop(stop, fill[i]);
                currentIteration++;
            }
        }
        return gradient;
    };
    /**
     * Destroys this text object.
     * Note* Unlike a Sprite, a Text object will automatically destroy its baseTexture and texture as
     * the majority of the time the texture will not be shared with any other Sprites.
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
     *  have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have their
     *  destroy method called as well. 'options' will be passed on to those calls.
     * @param {boolean} [options.texture=true] - Should it destroy the current texture of the sprite as well
     * @param {boolean} [options.baseTexture=true] - Should it destroy the base texture of the sprite as well
     */
    Text.prototype.destroy = function (options) {
        if (typeof options === 'boolean') {
            options = { children: options };
        }
        options = Object.assign({}, defaultDestroyOptions, options);
        _super.prototype.destroy.call(this, options);
        // set canvas width and height to 0 to workaround memory leak in Safari < 13
        // https://stackoverflow.com/questions/52532614/total-canvas-memory-use-exceeds-the-maximum-limit-safari-12
        if (this._ownCanvas) {
            this.canvas.height = this.canvas.width = 0;
        }
        // make sure to reset the the context and canvas.. dont want this hanging around in memory!
        this.context = null;
        this.canvas = null;
        this._style = null;
    };
    Object.defineProperty(Text.prototype, "width", {
        /**
         * The width of the Text, setting this will actually modify the scale to achieve the value set
         *
         * @member {number}
         */
        get: function () {
            this.updateText(true);
            return Math.abs(this.scale.x) * this._texture.orig.width;
        },
        set: function (value) {
            this.updateText(true);
            var s = sign(this.scale.x) || 1;
            this.scale.x = s * value / this._texture.orig.width;
            this._width = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Text.prototype, "height", {
        /**
         * The height of the Text, setting this will actually modify the scale to achieve the value set
         *
         * @member {number}
         */
        get: function () {
            this.updateText(true);
            return Math.abs(this.scale.y) * this._texture.orig.height;
        },
        set: function (value) {
            this.updateText(true);
            var s = sign(this.scale.y) || 1;
            this.scale.y = s * value / this._texture.orig.height;
            this._height = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Text.prototype, "style", {
        /**
         * Set the style of the text. Set up an event listener to listen for changes on the style
         * object and mark the text as dirty.
         *
         * @member {object|PIXI.TextStyle}
         */
        get: function () {
            // TODO: Can't have different types for getter and setter. The getter shouldn't have the ITextStyle
            //       since the setter creates the TextStyle. See this thread for more details:
            //       https://github.com/microsoft/TypeScript/issues/2521
            return this._style;
        },
        set: function (style) {
            style = style || {};
            if (style instanceof TextStyle) {
                this._style = style;
            }
            else {
                this._style = new TextStyle(style);
            }
            this.localStyleID = -1;
            this.dirty = true;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Text.prototype, "text", {
        /**
         * Set the copy for the text object. To split a line you can use '\n'.
         *
         * @member {string}
         */
        get: function () {
            return this._text;
        },
        set: function (text) {
            text = String(text === null || text === undefined ? '' : text);
            if (this._text === text) {
                return;
            }
            this._text = text;
            this.dirty = true;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Text.prototype, "resolution", {
        /**
         * The resolution / device pixel ratio of the canvas.
         * This is set to automatically match the renderer resolution by default, but can be overridden by setting manually.
         * @member {number}
         * @default 1
         */
        get: function () {
            return this._resolution;
        },
        set: function (value) {
            this._autoResolution = false;
            if (this._resolution === value) {
                return;
            }
            this._resolution = value;
            this.dirty = true;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * New behavior for `lineHeight` that's meant to mimic HTML text. A value of `true` will
     * make sure the first baseline is offset by the `lineHeight` value if it is greater than `fontSize`.
     * A value of `false` will use the legacy behavior and not change the baseline of the first line.
     * In the next major release, we'll enable this by default.
     *
     * @static
     * @memberof PIXI.Text
     * @member {boolean} nextLineHeightBehavior
     * @default false
     */
    Text.nextLineHeightBehavior = false;
    return Text;
}(Sprite));

/*!
 * @pixi/prepare - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/prepare is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/**
 * Default number of uploads per frame using prepare plugin.
 *
 * @static
 * @memberof PIXI.settings
 * @name UPLOADS_PER_FRAME
 * @type {number}
 * @default 4
 */
settings.UPLOADS_PER_FRAME = 4;

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$5 = function(d, b) {
    extendStatics$5 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$5(d, b);
};

function __extends$5(d, b) {
    extendStatics$5(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

/**
 * CountLimiter limits the number of items handled by a {@link PIXI.BasePrepare} to a specified
 * number of items per frame.
 *
 * @class
 * @memberof PIXI
 */
var CountLimiter = /** @class */ (function () {
    /**
     * @param {number} maxItemsPerFrame - The maximum number of items that can be prepared each frame.
     */
    function CountLimiter(maxItemsPerFrame) {
        /**
         * The maximum number of items that can be prepared each frame.
         * @type {number}
         * @private
         */
        this.maxItemsPerFrame = maxItemsPerFrame;
        /**
         * The number of items that can be prepared in the current frame.
         * @type {number}
         * @private
         */
        this.itemsLeft = 0;
    }
    /**
     * Resets any counting properties to start fresh on a new frame.
     */
    CountLimiter.prototype.beginFrame = function () {
        this.itemsLeft = this.maxItemsPerFrame;
    };
    /**
     * Checks to see if another item can be uploaded. This should only be called once per item.
     * @return {boolean} If the item is allowed to be uploaded.
     */
    CountLimiter.prototype.allowedToUpload = function () {
        return this.itemsLeft-- > 0;
    };
    return CountLimiter;
}());

/**
 * Built-in hook to find multiple textures from objects like AnimatedSprites.
 *
 * @private
 * @param {PIXI.DisplayObject} item - Display object to check
 * @param {Array<*>} queue - Collection of items to upload
 * @return {boolean} if a PIXI.Texture object was found.
 */
function findMultipleBaseTextures(item, queue) {
    var result = false;
    // Objects with multiple textures
    if (item && item._textures && item._textures.length) {
        for (var i = 0; i < item._textures.length; i++) {
            if (item._textures[i] instanceof Texture) {
                var baseTexture = item._textures[i].baseTexture;
                if (queue.indexOf(baseTexture) === -1) {
                    queue.push(baseTexture);
                    result = true;
                }
            }
        }
    }
    return result;
}
/**
 * Built-in hook to find BaseTextures from Texture.
 *
 * @private
 * @param {PIXI.Texture} item - Display object to check
 * @param {Array<*>} queue - Collection of items to upload
 * @return {boolean} if a PIXI.Texture object was found.
 */
function findBaseTexture(item, queue) {
    if (item.baseTexture instanceof BaseTexture) {
        var texture = item.baseTexture;
        if (queue.indexOf(texture) === -1) {
            queue.push(texture);
        }
        return true;
    }
    return false;
}
/**
 * Built-in hook to find textures from objects.
 *
 * @private
 * @param {PIXI.DisplayObject} item - Display object to check
 * @param {Array<*>} queue - Collection of items to upload
 * @return {boolean} if a PIXI.Texture object was found.
 */
function findTexture(item, queue) {
    if (item._texture && item._texture instanceof Texture) {
        var texture = item._texture.baseTexture;
        if (queue.indexOf(texture) === -1) {
            queue.push(texture);
        }
        return true;
    }
    return false;
}
/**
 * Built-in hook to draw PIXI.Text to its texture.
 *
 * @private
 * @param {PIXI.AbstractRenderer|PIXI.BasePrepare} helper - Not used by this upload handler
 * @param {PIXI.DisplayObject} item - Item to check
 * @return {boolean} If item was uploaded.
 */
function drawText(_helper, item) {
    if (item instanceof Text) {
        // updating text will return early if it is not dirty
        item.updateText(true);
        return true;
    }
    return false;
}
/**
 * Built-in hook to calculate a text style for a PIXI.Text object.
 *
 * @private
 * @param {PIXI.AbstractRenderer|PIXI.BasePrepare} helper - Not used by this upload handler
 * @param {PIXI.DisplayObject} item - Item to check
 * @return {boolean} If item was uploaded.
 */
function calculateTextStyle(_helper, item) {
    if (item instanceof TextStyle) {
        var font = item.toFontString();
        TextMetrics.measureFont(font);
        return true;
    }
    return false;
}
/**
 * Built-in hook to find Text objects.
 *
 * @private
 * @param {PIXI.DisplayObject} item - Display object to check
 * @param {Array<*>} queue - Collection of items to upload
 * @return {boolean} if a PIXI.Text object was found.
 */
function findText(item, queue) {
    if (item instanceof Text) {
        // push the text style to prepare it - this can be really expensive
        if (queue.indexOf(item.style) === -1) {
            queue.push(item.style);
        }
        // also push the text object so that we can render it (to canvas/texture) if needed
        if (queue.indexOf(item) === -1) {
            queue.push(item);
        }
        // also push the Text's texture for upload to GPU
        var texture = item._texture.baseTexture;
        if (queue.indexOf(texture) === -1) {
            queue.push(texture);
        }
        return true;
    }
    return false;
}
/**
 * Built-in hook to find TextStyle objects.
 *
 * @private
 * @param {PIXI.TextStyle} item - Display object to check
 * @param {Array<*>} queue - Collection of items to upload
 * @return {boolean} if a PIXI.TextStyle object was found.
 */
function findTextStyle(item, queue) {
    if (item instanceof TextStyle) {
        if (queue.indexOf(item) === -1) {
            queue.push(item);
        }
        return true;
    }
    return false;
}
/**
 * The prepare manager provides functionality to upload content to the GPU.
 *
 * BasePrepare handles basic queuing functionality and is extended by
 * {@link PIXI.Prepare} and {@link PIXI.CanvasPrepare}
 * to provide preparation capabilities specific to their respective renderers.
 *
 * @example
 * // Create a sprite
 * const sprite = PIXI.Sprite.from('something.png');
 *
 * // Load object into GPU
 * app.renderer.plugins.prepare.upload(sprite, () => {
 *
 *     //Texture(s) has been uploaded to GPU
 *     app.stage.addChild(sprite);
 *
 * })
 *
 * @abstract
 * @class
 * @memberof PIXI
 */
var BasePrepare = /** @class */ (function () {
    /**
     * @param {PIXI.AbstractRenderer} renderer - A reference to the current renderer
     */
    function BasePrepare(renderer) {
        var _this = this;
        /**
         * The limiter to be used to control how quickly items are prepared.
         * @type {PIXI.CountLimiter|PIXI.TimeLimiter}
         */
        this.limiter = new CountLimiter(settings.UPLOADS_PER_FRAME);
        /**
         * Reference to the renderer.
         * @type {PIXI.AbstractRenderer}
         * @protected
         */
        this.renderer = renderer;
        /**
         * The only real difference between CanvasPrepare and Prepare is what they pass
         * to upload hooks. That different parameter is stored here.
         * @type {object}
         * @protected
         */
        this.uploadHookHelper = null;
        /**
         * Collection of items to uploads at once.
         * @type {Array<*>}
         * @private
         */
        this.queue = [];
        /**
         * Collection of additional hooks for finding assets.
         * @type {Array<Function>}
         * @private
         */
        this.addHooks = [];
        /**
         * Collection of additional hooks for processing assets.
         * @type {Array<Function>}
         * @private
         */
        this.uploadHooks = [];
        /**
         * Callback to call after completed.
         * @type {Array<Function>}
         * @private
         */
        this.completes = [];
        /**
         * If prepare is ticking (running).
         * @type {boolean}
         * @private
         */
        this.ticking = false;
        /**
         * 'bound' call for prepareItems().
         * @type {Function}
         * @private
         */
        this.delayedTick = function () {
            // unlikely, but in case we were destroyed between tick() and delayedTick()
            if (!_this.queue) {
                return;
            }
            _this.prepareItems();
        };
        // hooks to find the correct texture
        this.registerFindHook(findText);
        this.registerFindHook(findTextStyle);
        this.registerFindHook(findMultipleBaseTextures);
        this.registerFindHook(findBaseTexture);
        this.registerFindHook(findTexture);
        // upload hooks
        this.registerUploadHook(drawText);
        this.registerUploadHook(calculateTextStyle);
    }
    /**
     * Upload all the textures and graphics to the GPU.
     *
     * @param {Function|PIXI.DisplayObject|PIXI.Container|PIXI.BaseTexture|PIXI.Texture|PIXI.Graphics|PIXI.Text} item -
     *        Either the container or display object to search for items to upload, the items to upload themselves,
     *        or the callback function, if items have been added using `prepare.add`.
     * @param {Function} [done] - Optional callback when all queued uploads have completed
     */
    BasePrepare.prototype.upload = function (item, done) {
        if (typeof item === 'function') {
            done = item;
            item = null;
        }
        // If a display object, search for items
        // that we could upload
        if (item) {
            this.add(item);
        }
        // Get the items for upload from the display
        if (this.queue.length) {
            if (done) {
                this.completes.push(done);
            }
            if (!this.ticking) {
                this.ticking = true;
                Ticker.system.addOnce(this.tick, this, UPDATE_PRIORITY.UTILITY);
            }
        }
        else if (done) {
            done();
        }
    };
    /**
     * Handle tick update
     *
     * @private
     */
    BasePrepare.prototype.tick = function () {
        setTimeout(this.delayedTick, 0);
    };
    /**
     * Actually prepare items. This is handled outside of the tick because it will take a while
     * and we do NOT want to block the current animation frame from rendering.
     *
     * @private
     */
    BasePrepare.prototype.prepareItems = function () {
        this.limiter.beginFrame();
        // Upload the graphics
        while (this.queue.length && this.limiter.allowedToUpload()) {
            var item = this.queue[0];
            var uploaded = false;
            if (item && !item._destroyed) {
                for (var i = 0, len = this.uploadHooks.length; i < len; i++) {
                    if (this.uploadHooks[i](this.uploadHookHelper, item)) {
                        this.queue.shift();
                        uploaded = true;
                        break;
                    }
                }
            }
            if (!uploaded) {
                this.queue.shift();
            }
        }
        // We're finished
        if (!this.queue.length) {
            this.ticking = false;
            var completes = this.completes.slice(0);
            this.completes.length = 0;
            for (var i = 0, len = completes.length; i < len; i++) {
                completes[i]();
            }
        }
        else {
            // if we are not finished, on the next rAF do this again
            Ticker.system.addOnce(this.tick, this, UPDATE_PRIORITY.UTILITY);
        }
    };
    /**
     * Adds hooks for finding items.
     *
     * @param {Function} addHook - Function call that takes two parameters: `item:*, queue:Array`
     *          function must return `true` if it was able to add item to the queue.
     * @return {this} Instance of plugin for chaining.
     */
    BasePrepare.prototype.registerFindHook = function (addHook) {
        if (addHook) {
            this.addHooks.push(addHook);
        }
        return this;
    };
    /**
     * Adds hooks for uploading items.
     *
     * @param {Function} uploadHook - Function call that takes two parameters: `prepare:CanvasPrepare, item:*` and
     *          function must return `true` if it was able to handle upload of item.
     * @return {this} Instance of plugin for chaining.
     */
    BasePrepare.prototype.registerUploadHook = function (uploadHook) {
        if (uploadHook) {
            this.uploadHooks.push(uploadHook);
        }
        return this;
    };
    /**
     * Manually add an item to the uploading queue.
     *
     * @param {PIXI.DisplayObject|PIXI.Container|PIXI.BaseTexture|PIXI.Texture|PIXI.Graphics|PIXI.Text|*} item - Object to
     *        add to the queue
     * @return {this} Instance of plugin for chaining.
     */
    BasePrepare.prototype.add = function (item) {
        // Add additional hooks for finding elements on special
        // types of objects that
        for (var i = 0, len = this.addHooks.length; i < len; i++) {
            if (this.addHooks[i](item, this.queue)) {
                break;
            }
        }
        // Get children recursively
        if (item instanceof Container) {
            for (var i = item.children.length - 1; i >= 0; i--) {
                this.add(item.children[i]);
            }
        }
        return this;
    };
    /**
     * Destroys the plugin, don't use after this.
     *
     */
    BasePrepare.prototype.destroy = function () {
        if (this.ticking) {
            Ticker.system.remove(this.tick, this);
        }
        this.ticking = false;
        this.addHooks = null;
        this.uploadHooks = null;
        this.renderer = null;
        this.completes = null;
        this.queue = null;
        this.limiter = null;
        this.uploadHookHelper = null;
    };
    return BasePrepare;
}());

/**
 * Built-in hook to upload PIXI.Texture objects to the GPU.
 *
 * @private
 * @param {PIXI.Renderer} renderer - instance of the webgl renderer
 * @param {PIXI.BaseTexture} item - Item to check
 * @return {boolean} If item was uploaded.
 */
function uploadBaseTextures(renderer, item) {
    if (item instanceof BaseTexture) {
        // if the texture already has a GL texture, then the texture has been prepared or rendered
        // before now. If the texture changed, then the changer should be calling texture.update() which
        // reuploads the texture without need for preparing it again
        if (!item._glTextures[renderer.CONTEXT_UID]) {
            renderer.texture.bind(item);
        }
        return true;
    }
    return false;
}
/**
 * Built-in hook to upload PIXI.Graphics to the GPU.
 *
 * @private
 * @param {PIXI.Renderer} renderer - instance of the webgl renderer
 * @param {PIXI.DisplayObject} item - Item to check
 * @return {boolean} If item was uploaded.
 */
function uploadGraphics(renderer, item) {
    if (!(item instanceof Graphics)) {
        return false;
    }
    var geometry = item.geometry;
    // update dirty graphics to get batches
    item.finishPoly();
    geometry.updateBatches();
    var batches = geometry.batches;
    // upload all textures found in styles
    for (var i = 0; i < batches.length; i++) {
        var texture = batches[i].style.texture;
        if (texture) {
            uploadBaseTextures(renderer, texture.baseTexture);
        }
    }
    // if its not batchable - update vao for particular shader
    if (!geometry.batchable) {
        renderer.geometry.bind(geometry, item._resolveDirectShader(renderer));
    }
    return true;
}
/**
 * Built-in hook to find graphics.
 *
 * @private
 * @param {PIXI.DisplayObject} item - Display object to check
 * @param {Array<*>} queue - Collection of items to upload
 * @return {boolean} if a PIXI.Graphics object was found.
 */
function findGraphics(item, queue) {
    if (item instanceof Graphics) {
        queue.push(item);
        return true;
    }
    return false;
}
/**
 * The prepare plugin provides renderer-specific plugins for pre-rendering DisplayObjects. These plugins are useful for
 * asynchronously preparing and uploading to the GPU assets, textures, graphics waiting to be displayed.
 *
 * Do not instantiate this plugin directly. It is available from the `renderer.plugins` property.
 * See {@link PIXI.CanvasRenderer#plugins} or {@link PIXI.Renderer#plugins}.
 * @example
 * // Create a new application
 * const app = new PIXI.Application();
 * document.body.appendChild(app.view);
 *
 * // Don't start rendering right away
 * app.stop();
 *
 * // create a display object
 * const rect = new PIXI.Graphics()
 *     .beginFill(0x00ff00)
 *     .drawRect(40, 40, 200, 200);
 *
 * // Add to the stage
 * app.stage.addChild(rect);
 *
 * // Don't start rendering until the graphic is uploaded to the GPU
 * app.renderer.plugins.prepare.upload(app.stage, () => {
 *     app.start();
 * });
 *
 * @class
 * @extends PIXI.BasePrepare
 * @memberof PIXI
 */
var Prepare = /** @class */ (function (_super) {
    __extends$5(Prepare, _super);
    /**
     * @param {PIXI.Renderer} renderer - A reference to the current renderer
     */
    function Prepare(renderer) {
        var _this = _super.call(this, renderer) || this;
        _this.uploadHookHelper = _this.renderer;
        // Add textures and graphics to upload
        _this.registerFindHook(findGraphics);
        _this.registerUploadHook(uploadBaseTextures);
        _this.registerUploadHook(uploadGraphics);
        return _this;
    }
    return Prepare;
}(BasePrepare));

/**
 * TimeLimiter limits the number of items handled by a {@link PIXI.BasePrepare} to a specified
 * number of milliseconds per frame.
 *
 * @class
 * @memberof PIXI
 */
var TimeLimiter = /** @class */ (function () {
    /**
     * @param {number} maxMilliseconds - The maximum milliseconds that can be spent preparing items each frame.
     */
    function TimeLimiter(maxMilliseconds) {
        /**
         * The maximum milliseconds that can be spent preparing items each frame.
         * @type {number}
         * @private
         */
        this.maxMilliseconds = maxMilliseconds;
        /**
         * The start time of the current frame.
         * @type {number}
         * @private
         */
        this.frameStart = 0;
    }
    /**
     * Resets any counting properties to start fresh on a new frame.
     */
    TimeLimiter.prototype.beginFrame = function () {
        this.frameStart = Date.now();
    };
    /**
     * Checks to see if another item can be uploaded. This should only be called once per item.
     * @return {boolean} If the item is allowed to be uploaded.
     */
    TimeLimiter.prototype.allowedToUpload = function () {
        return Date.now() - this.frameStart < this.maxMilliseconds;
    };
    return TimeLimiter;
}());

/*!
 * @pixi/spritesheet - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/spritesheet is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/**
 * Utility class for maintaining reference to a collection
 * of Textures on a single Spritesheet.
 *
 * To access a sprite sheet from your code pass its JSON data file to Pixi's loader:
 *
 * ```js
 * PIXI.Loader.shared.add("images/spritesheet.json").load(setup);
 *
 * function setup() {
 *   let sheet = PIXI.Loader.shared.resources["images/spritesheet.json"].spritesheet;
 *   ...
 * }
 * ```
 * With the `sheet.textures` you can create Sprite objects,`sheet.animations` can be used to create an AnimatedSprite.
 *
 * Sprite sheets can be packed using tools like {@link https://codeandweb.com/texturepacker|TexturePacker},
 * {@link https://renderhjs.net/shoebox/|Shoebox} or {@link https://github.com/krzysztof-o/spritesheet.js|Spritesheet.js}.
 * Default anchor points (see {@link PIXI.Texture#defaultAnchor}) and grouping of animation sprites are currently only
 * supported by TexturePacker.
 *
 * @class
 * @memberof PIXI
 */
var Spritesheet = /** @class */ (function () {
    /**
     * @param {PIXI.BaseTexture|PIXI.Texture} baseTexture - Reference to the source BaseTexture object.
     * @param {Object} data - Spritesheet image data.
     * @param {string} [resolutionFilename] - The filename to consider when determining
     *        the resolution of the spritesheet. If not provided, the imageUrl will
     *        be used on the BaseTexture.
     */
    function Spritesheet(texture, data, resolutionFilename) {
        if (resolutionFilename === void 0) { resolutionFilename = null; }
        /**
         * Reference to original source image from the Loader. This reference is retained so we
         * can destroy the Texture later on. It is never used internally.
         * @type {PIXI.Texture}
         * @private
         */
        this._texture = texture instanceof Texture ? texture : null;
        /**
         * Reference to ths source texture.
         * @type {PIXI.BaseTexture}
         */
        this.baseTexture = texture instanceof BaseTexture ? texture : this._texture.baseTexture;
        /**
         * A map containing all textures of the sprite sheet.
         * Can be used to create a {@link PIXI.Sprite|Sprite}:
         * ```js
         * new PIXI.Sprite(sheet.textures["image.png"]);
         * ```
         * @member {Object}
         */
        this.textures = {};
        /**
         * A map containing the textures for each animation.
         * Can be used to create an {@link PIXI.AnimatedSprite|AnimatedSprite}:
         * ```js
         * new PIXI.AnimatedSprite(sheet.animations["anim_name"])
         * ```
         * @member {Object}
         */
        this.animations = {};
        /**
         * Reference to the original JSON data.
         * @type {Object}
         */
        this.data = data;
        var resource = this.baseTexture.resource;
        /**
         * The resolution of the spritesheet.
         * @type {number}
         */
        this.resolution = this._updateResolution(resolutionFilename || (resource ? resource.url : null));
        /**
         * Map of spritesheet frames.
         * @type {Object}
         * @private
         */
        this._frames = this.data.frames;
        /**
         * Collection of frame names.
         * @type {string[]}
         * @private
         */
        this._frameKeys = Object.keys(this._frames);
        /**
         * Current batch index being processed.
         * @type {number}
         * @private
         */
        this._batchIndex = 0;
        /**
         * Callback when parse is completed.
         * @type {Function}
         * @private
         */
        this._callback = null;
    }
    /**
     * Generate the resolution from the filename or fallback
     * to the meta.scale field of the JSON data.
     *
     * @private
     * @param {string} resolutionFilename - The filename to use for resolving
     *        the default resolution.
     * @return {number} Resolution to use for spritesheet.
     */
    Spritesheet.prototype._updateResolution = function (resolutionFilename) {
        if (resolutionFilename === void 0) { resolutionFilename = null; }
        var scale = this.data.meta.scale;
        // Use a defaultValue of `null` to check if a url-based resolution is set
        var resolution = getResolutionOfUrl(resolutionFilename, null);
        // No resolution found via URL
        if (resolution === null) {
            // Use the scale value or default to 1
            resolution = scale !== undefined ? parseFloat(scale) : 1;
        }
        // For non-1 resolutions, update baseTexture
        if (resolution !== 1) {
            this.baseTexture.setResolution(resolution);
        }
        return resolution;
    };
    /**
     * Parser spritesheet from loaded data. This is done asynchronously
     * to prevent creating too many Texture within a single process.
     *
     * @param {Function} callback - Callback when complete returns
     *        a map of the Textures for this spritesheet.
     */
    Spritesheet.prototype.parse = function (callback) {
        this._batchIndex = 0;
        this._callback = callback;
        if (this._frameKeys.length <= Spritesheet.BATCH_SIZE) {
            this._processFrames(0);
            this._processAnimations();
            this._parseComplete();
        }
        else {
            this._nextBatch();
        }
    };
    /**
     * Process a batch of frames
     *
     * @private
     * @param {number} initialFrameIndex - The index of frame to start.
     */
    Spritesheet.prototype._processFrames = function (initialFrameIndex) {
        var frameIndex = initialFrameIndex;
        var maxFrames = Spritesheet.BATCH_SIZE;
        while (frameIndex - initialFrameIndex < maxFrames && frameIndex < this._frameKeys.length) {
            var i = this._frameKeys[frameIndex];
            var data = this._frames[i];
            var rect = data.frame;
            if (rect) {
                var frame = null;
                var trim = null;
                var sourceSize = data.trimmed !== false && data.sourceSize
                    ? data.sourceSize : data.frame;
                var orig = new Rectangle(0, 0, Math.floor(sourceSize.w) / this.resolution, Math.floor(sourceSize.h) / this.resolution);
                if (data.rotated) {
                    frame = new Rectangle(Math.floor(rect.x) / this.resolution, Math.floor(rect.y) / this.resolution, Math.floor(rect.h) / this.resolution, Math.floor(rect.w) / this.resolution);
                }
                else {
                    frame = new Rectangle(Math.floor(rect.x) / this.resolution, Math.floor(rect.y) / this.resolution, Math.floor(rect.w) / this.resolution, Math.floor(rect.h) / this.resolution);
                }
                //  Check to see if the sprite is trimmed
                if (data.trimmed !== false && data.spriteSourceSize) {
                    trim = new Rectangle(Math.floor(data.spriteSourceSize.x) / this.resolution, Math.floor(data.spriteSourceSize.y) / this.resolution, Math.floor(rect.w) / this.resolution, Math.floor(rect.h) / this.resolution);
                }
                this.textures[i] = new Texture(this.baseTexture, frame, orig, trim, data.rotated ? 2 : 0, data.anchor);
                // lets also add the frame to pixi's global cache for 'from' and 'fromLoader' functions
                Texture.addToCache(this.textures[i], i);
            }
            frameIndex++;
        }
    };
    /**
     * Parse animations config
     *
     * @private
     */
    Spritesheet.prototype._processAnimations = function () {
        var animations = this.data.animations || {};
        for (var animName in animations) {
            this.animations[animName] = [];
            for (var i = 0; i < animations[animName].length; i++) {
                var frameName = animations[animName][i];
                this.animations[animName].push(this.textures[frameName]);
            }
        }
    };
    /**
     * The parse has completed.
     *
     * @private
     */
    Spritesheet.prototype._parseComplete = function () {
        var callback = this._callback;
        this._callback = null;
        this._batchIndex = 0;
        callback.call(this, this.textures);
    };
    /**
     * Begin the next batch of textures.
     *
     * @private
     */
    Spritesheet.prototype._nextBatch = function () {
        var _this = this;
        this._processFrames(this._batchIndex * Spritesheet.BATCH_SIZE);
        this._batchIndex++;
        setTimeout(function () {
            if (_this._batchIndex * Spritesheet.BATCH_SIZE < _this._frameKeys.length) {
                _this._nextBatch();
            }
            else {
                _this._processAnimations();
                _this._parseComplete();
            }
        }, 0);
    };
    /**
     * Destroy Spritesheet and don't use after this.
     *
     * @param {boolean} [destroyBase=false] - Whether to destroy the base texture as well
     */
    Spritesheet.prototype.destroy = function (destroyBase) {
        var _a;
        if (destroyBase === void 0) { destroyBase = false; }
        for (var i in this.textures) {
            this.textures[i].destroy();
        }
        this._frames = null;
        this._frameKeys = null;
        this.data = null;
        this.textures = null;
        if (destroyBase) {
            (_a = this._texture) === null || _a === void 0 ? void 0 : _a.destroy();
            this.baseTexture.destroy();
        }
        this._texture = null;
        this.baseTexture = null;
    };
    /**
     * The maximum number of Textures to build per process.
     *
     * @type {number}
     * @default 1000
     */
    Spritesheet.BATCH_SIZE = 1000;
    return Spritesheet;
}());
/**
 * Reference to Spritesheet object created.
 * @member {PIXI.Spritesheet} spritesheet
 * @memberof PIXI.LoaderResource
 * @instance
 */
/**
 * Dictionary of textures from Spritesheet.
 * @member {object<string, PIXI.Texture>} textures
 * @memberof PIXI.LoaderResource
 * @instance
 */

/**
 * {@link PIXI.Loader} middleware for loading texture atlases that have been created with
 * TexturePacker or similar JSON-based spritesheet.
 *
 * This middleware automatically generates Texture resources.
 *
 * If you're using Webpack or other bundlers and plan on bundling the atlas' JSON,
 * use the {@link PIXI.Spritesheet} class to directly parse the JSON.
 *
 * The Loader's image Resource name is automatically appended with `"_image"`.
 * If a Resource with this name is already loaded, the Loader will skip parsing the
 * Spritesheet. The code below will generate an internal Loader Resource called `"myatlas_image"`.
 *
 * @example
 * loader.add('myatlas', 'path/to/myatlas.json');
 * loader.load(() => {
 *   loader.resources.myatlas; // atlas JSON resource
 *   loader.resources.myatlas_image; // atlas Image resource
 * });
 *
 * @class
 * @memberof PIXI
 * @implements PIXI.ILoaderPlugin
 */
var SpritesheetLoader = /** @class */ (function () {
    function SpritesheetLoader() {
    }
    /**
     * Called after a resource is loaded.
     * @see PIXI.Loader.loaderMiddleware
     * @param {PIXI.LoaderResource} resource
     * @param {function} next
     */
    SpritesheetLoader.use = function (resource, next) {
        var _a, _b;
        // because this is middleware, it execute in loader context. `this` = loader
        var loader = this;
        var imageResourceName = resource.name + "_image";
        // skip if no data, its not json, it isn't spritesheet data, or the image resource already exists
        if (!resource.data
            || resource.type !== LoaderResource.TYPE.JSON
            || !resource.data.frames
            || loader.resources[imageResourceName]) {
            next();
            return;
        }
        // Check and add the multi atlas
        // Heavily influenced and based on https://github.com/rocket-ua/pixi-tps-loader/blob/master/src/ResourceLoader.js
        // eslint-disable-next-line camelcase
        var multiPacks = (_b = (_a = resource.data) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.related_multi_packs;
        if (Array.isArray(multiPacks)) {
            var _loop_1 = function (item) {
                if (typeof item !== 'string') {
                    return "continue";
                }
                var itemName = item.replace('.json', '');
                var itemUrl = url.resolve(resource.url.replace(loader.baseUrl, ''), item);
                // Check if the file wasn't already added as multipacks are redundant
                if (loader.resources[itemName]
                    || Object.values(loader.resources).some(function (r) { return url.format(url.parse(r.url)) === itemUrl; })) {
                    return "continue";
                }
                var options = {
                    crossOrigin: resource.crossOrigin,
                    loadType: LoaderResource.LOAD_TYPE.XHR,
                    xhrType: LoaderResource.XHR_RESPONSE_TYPE.JSON,
                    parentResource: resource,
                };
                loader.add(itemName, itemUrl, options);
            };
            for (var _i = 0, multiPacks_1 = multiPacks; _i < multiPacks_1.length; _i++) {
                var item = multiPacks_1[_i];
                _loop_1(item);
            }
        }
        var loadOptions = {
            crossOrigin: resource.crossOrigin,
            metadata: resource.metadata.imageMetadata,
            parentResource: resource,
        };
        var resourcePath = SpritesheetLoader.getResourcePath(resource, loader.baseUrl);
        // load the image for this sheet
        loader.add(imageResourceName, resourcePath, loadOptions, function onImageLoad(res) {
            if (res.error) {
                next(res.error);
                return;
            }
            var spritesheet = new Spritesheet(res.texture, resource.data, resource.url);
            spritesheet.parse(function () {
                resource.spritesheet = spritesheet;
                resource.textures = spritesheet.textures;
                next();
            });
        });
    };
    /**
     * Get the spritesheets root path
     * @param {PIXI.LoaderResource} resource - Resource to check path
     * @param {string} baseUrl - Base root url
     */
    SpritesheetLoader.getResourcePath = function (resource, baseUrl) {
        // Prepend url path unless the resource image is a data url
        if (resource.isDataUrl) {
            return resource.data.meta.image;
        }
        return url.resolve(resource.url.replace(baseUrl, ''), resource.data.meta.image);
    };
    return SpritesheetLoader;
}());

/*!
 * @pixi/sprite-tiling - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/sprite-tiling is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$6 = function(d, b) {
    extendStatics$6 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$6(d, b);
};

function __extends$6(d, b) {
    extendStatics$6(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var tempPoint$1 = new Point();
/**
 * A tiling sprite is a fast way of rendering a tiling image.
 *
 * @class
 * @extends PIXI.Sprite
 * @memberof PIXI
 */
var TilingSprite = /** @class */ (function (_super) {
    __extends$6(TilingSprite, _super);
    /**
     * @param {PIXI.Texture} texture - the texture of the tiling sprite
     * @param {number} [width=100] - the width of the tiling sprite
     * @param {number} [height=100] - the height of the tiling sprite
     */
    function TilingSprite(texture, width, height) {
        if (width === void 0) { width = 100; }
        if (height === void 0) { height = 100; }
        var _this = _super.call(this, texture) || this;
        /**
         * Tile transform
         *
         * @member {PIXI.Transform}
         */
        _this.tileTransform = new Transform();
        /**
         * The with of the tiling sprite
         *
         * @member {number}
         * @private
         */
        _this._width = width;
        /**
         * The height of the tiling sprite
         *
         * @member {number}
         * @private
         */
        _this._height = height;
        /**
         * matrix that is applied to UV to get the coords in Texture normalized space to coords in BaseTexture space
         *
         * @member {PIXI.TextureMatrix}
         */
        _this.uvMatrix = _this.texture.uvMatrix || new TextureMatrix(texture);
        /**
         * Plugin that is responsible for rendering this element.
         * Allows to customize the rendering process without overriding '_render' method.
         *
         * @member {string}
         * @default 'tilingSprite'
         */
        _this.pluginName = 'tilingSprite';
        /**
         * Flags whether the tiling pattern should originate from the origin instead of the top-left corner in
         * local space.
         *
         * This will make the texture coordinates assigned to each vertex dependent on the value of the anchor. Without
         * this, the top-left corner always gets the (0, 0) texture coordinate.
         *
         * @member {boolean}
         * @default false
         */
        _this.uvRespectAnchor = false;
        return _this;
    }
    Object.defineProperty(TilingSprite.prototype, "clampMargin", {
        /**
         * Changes frame clamping in corresponding textureTransform, shortcut
         * Change to -0.5 to add a pixel to the edge, recommended for transparent trimmed textures in atlas
         *
         * @default 0.5
         * @member {number}
         */
        get: function () {
            return this.uvMatrix.clampMargin;
        },
        set: function (value) {
            this.uvMatrix.clampMargin = value;
            this.uvMatrix.update(true);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TilingSprite.prototype, "tileScale", {
        /**
         * The scaling of the image that is being tiled
         *
         * @member {PIXI.ObservablePoint}
         */
        get: function () {
            return this.tileTransform.scale;
        },
        set: function (value) {
            this.tileTransform.scale.copyFrom(value);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TilingSprite.prototype, "tilePosition", {
        /**
         * The offset of the image that is being tiled
         *
         * @member {PIXI.ObservablePoint}
         */
        get: function () {
            return this.tileTransform.position;
        },
        set: function (value) {
            this.tileTransform.position.copyFrom(value);
        },
        enumerable: false,
        configurable: true
    });
    /**
     * @protected
     */
    TilingSprite.prototype._onTextureUpdate = function () {
        if (this.uvMatrix) {
            this.uvMatrix.texture = this._texture;
        }
        this._cachedTint = 0xFFFFFF;
    };
    /**
     * Renders the object using the WebGL renderer
     *
     * @protected
     * @param {PIXI.Renderer} renderer - The renderer
     */
    TilingSprite.prototype._render = function (renderer) {
        // tweak our texture temporarily..
        var texture = this._texture;
        if (!texture || !texture.valid) {
            return;
        }
        this.tileTransform.updateLocalTransform();
        this.uvMatrix.update();
        renderer.batch.setObjectRenderer(renderer.plugins[this.pluginName]);
        renderer.plugins[this.pluginName].render(this);
    };
    /**
     * Updates the bounds of the tiling sprite.
     *
     * @protected
     */
    TilingSprite.prototype._calculateBounds = function () {
        var minX = this._width * -this._anchor._x;
        var minY = this._height * -this._anchor._y;
        var maxX = this._width * (1 - this._anchor._x);
        var maxY = this._height * (1 - this._anchor._y);
        this._bounds.addFrame(this.transform, minX, minY, maxX, maxY);
    };
    /**
     * Gets the local bounds of the sprite object.
     *
     * @param {PIXI.Rectangle} [rect] - Optional output rectangle.
     * @return {PIXI.Rectangle} The bounds.
     */
    TilingSprite.prototype.getLocalBounds = function (rect) {
        // we can do a fast local bounds if the sprite has no children!
        if (this.children.length === 0) {
            this._bounds.minX = this._width * -this._anchor._x;
            this._bounds.minY = this._height * -this._anchor._y;
            this._bounds.maxX = this._width * (1 - this._anchor._x);
            this._bounds.maxY = this._height * (1 - this._anchor._y);
            if (!rect) {
                if (!this._localBoundsRect) {
                    this._localBoundsRect = new Rectangle();
                }
                rect = this._localBoundsRect;
            }
            return this._bounds.getRectangle(rect);
        }
        return _super.prototype.getLocalBounds.call(this, rect);
    };
    /**
     * Checks if a point is inside this tiling sprite.
     *
     * @param {PIXI.IPointData} point - the point to check
     * @return {boolean} Whether or not the sprite contains the point.
     */
    TilingSprite.prototype.containsPoint = function (point) {
        this.worldTransform.applyInverse(point, tempPoint$1);
        var width = this._width;
        var height = this._height;
        var x1 = -width * this.anchor._x;
        if (tempPoint$1.x >= x1 && tempPoint$1.x < x1 + width) {
            var y1 = -height * this.anchor._y;
            if (tempPoint$1.y >= y1 && tempPoint$1.y < y1 + height) {
                return true;
            }
        }
        return false;
    };
    /**
     * Destroys this sprite and optionally its texture and children
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
     *  have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have their destroy
     *      method called as well. 'options' will be passed on to those calls.
     * @param {boolean} [options.texture=false] - Should it destroy the current texture of the sprite as well
     * @param {boolean} [options.baseTexture=false] - Should it destroy the base texture of the sprite as well
     */
    TilingSprite.prototype.destroy = function (options) {
        _super.prototype.destroy.call(this, options);
        this.tileTransform = null;
        this.uvMatrix = null;
    };
    /**
     * Helper function that creates a new tiling sprite based on the source you provide.
     * The source can be - frame id, image url, video url, canvas element, video element, base texture
     *
     * @static
     * @param {string|PIXI.Texture|HTMLCanvasElement|HTMLVideoElement} source - Source to create texture from
     * @param {Object} options - See {@link PIXI.BaseTexture}'s constructor for options.
     * @param {number} options.width - required width of the tiling sprite
     * @param {number} options.height - required height of the tiling sprite
     * @return {PIXI.TilingSprite} The newly created texture
     */
    TilingSprite.from = function (source, options) {
        var texture = (source instanceof Texture)
            ? source
            : Texture.from(source, options);
        return new TilingSprite(texture, options.width, options.height);
    };
    Object.defineProperty(TilingSprite.prototype, "width", {
        /**
         * The width of the sprite, setting this will actually modify the scale to achieve the value set
         *
         * @member {number}
         */
        get: function () {
            return this._width;
        },
        set: function (value) {
            this._width = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TilingSprite.prototype, "height", {
        /**
         * The height of the TilingSprite, setting this will actually modify the scale to achieve the value set
         *
         * @member {number}
         */
        get: function () {
            return this._height;
        },
        set: function (value) {
            this._height = value;
        },
        enumerable: false,
        configurable: true
    });
    return TilingSprite;
}(Sprite));

var vertex$1 = "attribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\n\nuniform mat3 projectionMatrix;\nuniform mat3 translationMatrix;\nuniform mat3 uTransform;\n\nvarying vec2 vTextureCoord;\n\nvoid main(void)\n{\n    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);\n\n    vTextureCoord = (uTransform * vec3(aTextureCoord, 1.0)).xy;\n}\n";

var fragment$1 = "varying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform vec4 uColor;\nuniform mat3 uMapCoord;\nuniform vec4 uClampFrame;\nuniform vec2 uClampOffset;\n\nvoid main(void)\n{\n    vec2 coord = vTextureCoord + ceil(uClampOffset - vTextureCoord);\n    coord = (uMapCoord * vec3(coord, 1.0)).xy;\n    coord = clamp(coord, uClampFrame.xy, uClampFrame.zw);\n\n    vec4 texSample = texture2D(uSampler, coord);\n    gl_FragColor = texSample * uColor;\n}\n";

var fragmentSimple = "varying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform vec4 uColor;\n\nvoid main(void)\n{\n    vec4 sample = texture2D(uSampler, vTextureCoord);\n    gl_FragColor = sample * uColor;\n}\n";

var tempMat = new Matrix();
/**
 * WebGL renderer plugin for tiling sprites
 *
 * @class
 * @memberof PIXI
 * @extends PIXI.ObjectRenderer
 */
var TilingSpriteRenderer = /** @class */ (function (_super) {
    __extends$6(TilingSpriteRenderer, _super);
    /**
     * constructor for renderer
     *
     * @param {PIXI.Renderer} renderer - The renderer this tiling awesomeness works for.
     */
    function TilingSpriteRenderer(renderer) {
        var _this = _super.call(this, renderer) || this;
        var uniforms = { globals: _this.renderer.globalUniforms };
        _this.shader = Shader.from(vertex$1, fragment$1, uniforms);
        _this.simpleShader = Shader.from(vertex$1, fragmentSimple, uniforms);
        _this.quad = new QuadUv();
        /**
         * The WebGL state in which this renderer will work.
         *
         * @member {PIXI.State}
         * @readonly
         */
        _this.state = State.for2d();
        return _this;
    }
    /**
     *
     * @param {PIXI.TilingSprite} ts - tilingSprite to be rendered
     */
    TilingSpriteRenderer.prototype.render = function (ts) {
        var renderer = this.renderer;
        var quad = this.quad;
        var vertices = quad.vertices;
        vertices[0] = vertices[6] = (ts._width) * -ts.anchor.x;
        vertices[1] = vertices[3] = ts._height * -ts.anchor.y;
        vertices[2] = vertices[4] = (ts._width) * (1.0 - ts.anchor.x);
        vertices[5] = vertices[7] = ts._height * (1.0 - ts.anchor.y);
        var anchorX = ts.uvRespectAnchor ? ts.anchor.x : 0;
        var anchorY = ts.uvRespectAnchor ? ts.anchor.y : 0;
        vertices = quad.uvs;
        vertices[0] = vertices[6] = -anchorX;
        vertices[1] = vertices[3] = -anchorY;
        vertices[2] = vertices[4] = 1.0 - anchorX;
        vertices[5] = vertices[7] = 1.0 - anchorY;
        quad.invalidate();
        var tex = ts._texture;
        var baseTex = tex.baseTexture;
        var lt = ts.tileTransform.localTransform;
        var uv = ts.uvMatrix;
        var isSimple = baseTex.isPowerOfTwo
            && tex.frame.width === baseTex.width && tex.frame.height === baseTex.height;
        // auto, force repeat wrapMode for big tiling textures
        if (isSimple) {
            if (!baseTex._glTextures[renderer.CONTEXT_UID]) {
                if (baseTex.wrapMode === WRAP_MODES$1.CLAMP) {
                    baseTex.wrapMode = WRAP_MODES$1.REPEAT;
                }
            }
            else {
                isSimple = baseTex.wrapMode !== WRAP_MODES$1.CLAMP;
            }
        }
        var shader = isSimple ? this.simpleShader : this.shader;
        var w = tex.width;
        var h = tex.height;
        var W = ts._width;
        var H = ts._height;
        tempMat.set(lt.a * w / W, lt.b * w / H, lt.c * h / W, lt.d * h / H, lt.tx / W, lt.ty / H);
        // that part is the same as above:
        // tempMat.identity();
        // tempMat.scale(tex.width, tex.height);
        // tempMat.prepend(lt);
        // tempMat.scale(1.0 / ts._width, 1.0 / ts._height);
        tempMat.invert();
        if (isSimple) {
            tempMat.prepend(uv.mapCoord);
        }
        else {
            shader.uniforms.uMapCoord = uv.mapCoord.toArray(true);
            shader.uniforms.uClampFrame = uv.uClampFrame;
            shader.uniforms.uClampOffset = uv.uClampOffset;
        }
        shader.uniforms.uTransform = tempMat.toArray(true);
        shader.uniforms.uColor = premultiplyTintToRgba(ts.tint, ts.worldAlpha, shader.uniforms.uColor, baseTex.alphaMode);
        shader.uniforms.translationMatrix = ts.transform.worldTransform.toArray(true);
        shader.uniforms.uSampler = tex;
        renderer.shader.bind(shader);
        renderer.geometry.bind(quad);
        this.state.blendMode = correctBlendMode(ts.blendMode, baseTex.alphaMode);
        renderer.state.set(this.state);
        renderer.geometry.draw(this.renderer.gl.TRIANGLES, 6, 0);
    };
    return TilingSpriteRenderer;
}(ObjectRenderer));

/*!
 * @pixi/mesh - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/mesh is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$7 = function(d, b) {
    extendStatics$7 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$7(d, b);
};

function __extends$7(d, b) {
    extendStatics$7(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

/**
 * Class controls cache for UV mapping from Texture normal space to BaseTexture normal space.
 *
 * @class
 * @memberof PIXI
 */
var MeshBatchUvs = /** @class */ (function () {
    /**
     * @param {PIXI.Buffer} uvBuffer - Buffer with normalized uv's
     * @param {PIXI.TextureMatrix} uvMatrix - Material UV matrix
     */
    function MeshBatchUvs(uvBuffer, uvMatrix) {
        /**
         * Buffer with normalized UV's
         * @member {PIXI.Buffer}
         */
        this.uvBuffer = uvBuffer;
        /**
         * Material UV matrix
         * @member {PIXI.TextureMatrix}
         */
        this.uvMatrix = uvMatrix;
        /**
         * UV Buffer data
         * @member {Float32Array}
         * @readonly
         */
        this.data = null;
        this._bufferUpdateId = -1;
        this._textureUpdateId = -1;
        this._updateID = 0;
    }
    /**
     * updates
     *
     * @param {boolean} [forceUpdate] - force the update
     */
    MeshBatchUvs.prototype.update = function (forceUpdate) {
        if (!forceUpdate
            && this._bufferUpdateId === this.uvBuffer._updateID
            && this._textureUpdateId === this.uvMatrix._updateID) {
            return;
        }
        this._bufferUpdateId = this.uvBuffer._updateID;
        this._textureUpdateId = this.uvMatrix._updateID;
        var data = this.uvBuffer.data;
        if (!this.data || this.data.length !== data.length) {
            this.data = new Float32Array(data.length);
        }
        this.uvMatrix.multiplyUvs(data, this.data);
        this._updateID++;
    };
    return MeshBatchUvs;
}());

var tempPoint$2 = new Point();
var tempPolygon = new Polygon();
/**
 * Base mesh class.
 *
 * This class empowers you to have maximum flexibility to render any kind of WebGL visuals you can think of.
 * This class assumes a certain level of WebGL knowledge.
 * If you know a bit this should abstract enough away to make you life easier!
 *
 * Pretty much ALL WebGL can be broken down into the following:
 * - Geometry - The structure and data for the mesh. This can include anything from positions, uvs, normals, colors etc..
 * - Shader - This is the shader that PixiJS will render the geometry with (attributes in the shader must match the geometry)
 * - State - This is the state of WebGL required to render the mesh.
 *
 * Through a combination of the above elements you can render anything you want, 2D or 3D!
 *
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 */
var Mesh = /** @class */ (function (_super) {
    __extends$7(Mesh, _super);
    /**
     * @param {PIXI.Geometry} geometry - the geometry the mesh will use
     * @param {PIXI.MeshMaterial} shader - the shader the mesh will use
     * @param {PIXI.State} [state] - the state that the WebGL context is required to be in to render the mesh
     *        if no state is provided, uses {@link PIXI.State.for2d} to create a 2D state for PixiJS.
     * @param {number} [drawMode=PIXI.DRAW_MODES.TRIANGLES] - the drawMode, can be any of the PIXI.DRAW_MODES consts
     */
    function Mesh(geometry, shader, state, drawMode) {
        if (drawMode === void 0) { drawMode = DRAW_MODES$1.TRIANGLES; }
        var _this = _super.call(this) || this;
        /**
         * Includes vertex positions, face indices, normals, colors, UVs, and
         * custom attributes within buffers, reducing the cost of passing all
         * this data to the GPU. Can be shared between multiple Mesh objects.
         * @member {PIXI.Geometry}
         * @readonly
         */
        _this.geometry = geometry;
        geometry.refCount++;
        /**
         * Represents the vertex and fragment shaders that processes the geometry and runs on the GPU.
         * Can be shared between multiple Mesh objects.
         * @member {PIXI.Shader|PIXI.MeshMaterial}
         */
        _this.shader = shader;
        /**
         * Represents the WebGL state the Mesh required to render, excludes shader and geometry. E.g.,
         * blend mode, culling, depth testing, direction of rendering triangles, backface, etc.
         * @member {PIXI.State}
         */
        _this.state = state || State.for2d();
        /**
         * The way the Mesh should be drawn, can be any of the {@link PIXI.DRAW_MODES} constants.
         *
         * @member {number}
         * @see PIXI.DRAW_MODES
         */
        _this.drawMode = drawMode;
        /**
         * Typically the index of the IndexBuffer where to start drawing.
         * @member {number}
         * @default 0
         */
        _this.start = 0;
        /**
         * How much of the geometry to draw, by default `0` renders everything.
         * @member {number}
         * @default 0
         */
        _this.size = 0;
        /**
         * these are used as easy access for batching
         * @member {Float32Array}
         * @private
         */
        _this.uvs = null;
        /**
         * these are used as easy access for batching
         * @member {Uint16Array}
         * @private
         */
        _this.indices = null;
        /**
         * this is the caching layer used by the batcher
         * @member {Float32Array}
         * @private
         */
        _this.vertexData = new Float32Array(1);
        /**
         * If geometry is changed used to decide to re-transform
         * the vertexData.
         * @member {number}
         * @private
         */
        _this.vertexDirty = -1;
        _this._transformID = -1;
        /**
         * Internal roundPixels field
         *
         * @member {boolean}
         * @private
         */
        _this._roundPixels = settings.ROUND_PIXELS;
        /**
         * Batched UV's are cached for atlas textures
         * @member {PIXI.MeshBatchUvs}
         * @private
         */
        _this.batchUvs = null;
        return _this;
    }
    Object.defineProperty(Mesh.prototype, "uvBuffer", {
        /**
         * To change mesh uv's, change its uvBuffer data and increment its _updateID.
         * @member {PIXI.Buffer}
         * @readonly
         */
        get: function () {
            return this.geometry.buffers[1];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Mesh.prototype, "verticesBuffer", {
        /**
         * To change mesh vertices, change its uvBuffer data and increment its _updateID.
         * Incrementing _updateID is optional because most of Mesh objects do it anyway.
         * @member {PIXI.Buffer}
         * @readonly
         */
        get: function () {
            return this.geometry.buffers[0];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Mesh.prototype, "material", {
        get: function () {
            return this.shader;
        },
        /**
         * Alias for {@link PIXI.Mesh#shader}.
         * @member {PIXI.MeshMaterial}
         */
        set: function (value) {
            this.shader = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Mesh.prototype, "blendMode", {
        get: function () {
            return this.state.blendMode;
        },
        /**
         * The blend mode to be applied to the Mesh. Apply a value of
         * `PIXI.BLEND_MODES.NORMAL` to reset the blend mode.
         *
         * @member {number}
         * @default PIXI.BLEND_MODES.NORMAL;
         * @see PIXI.BLEND_MODES
         */
        set: function (value) {
            this.state.blendMode = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Mesh.prototype, "roundPixels", {
        get: function () {
            return this._roundPixels;
        },
        /**
         * If true PixiJS will Math.floor() x/y values when rendering, stopping pixel interpolation.
         * Advantages can include sharper image quality (like text) and faster rendering on canvas.
         * The main disadvantage is movement of objects may appear less smooth.
         * To set the global default, change {@link PIXI.settings.ROUND_PIXELS}
         *
         * @member {boolean}
         * @default false
         */
        set: function (value) {
            if (this._roundPixels !== value) {
                this._transformID = -1;
            }
            this._roundPixels = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Mesh.prototype, "tint", {
        /**
         * The multiply tint applied to the Mesh. This is a hex value. A value of
         * `0xFFFFFF` will remove any tint effect.
         *
         * Null for non-MeshMaterial shaders
         * @member {number}
         * @default 0xFFFFFF
         */
        get: function () {
            return 'tint' in this.shader ? this.shader.tint : null;
        },
        set: function (value) {
            this.shader.tint = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Mesh.prototype, "texture", {
        /**
         * The texture that the Mesh uses.
         *
         * Null for non-MeshMaterial shaders
         * @member {PIXI.Texture}
         */
        get: function () {
            return 'texture' in this.shader ? this.shader.texture : null;
        },
        set: function (value) {
            this.shader.texture = value;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Standard renderer draw.
     * @protected
     * @param {PIXI.Renderer} renderer - Instance to renderer.
     */
    Mesh.prototype._render = function (renderer) {
        // set properties for batching..
        // TODO could use a different way to grab verts?
        var vertices = this.geometry.buffers[0].data;
        var shader = this.shader;
        // TODO benchmark check for attribute size..
        if (shader.batchable
            && this.drawMode === DRAW_MODES$1.TRIANGLES
            && vertices.length < Mesh.BATCHABLE_SIZE * 2) {
            this._renderToBatch(renderer);
        }
        else {
            this._renderDefault(renderer);
        }
    };
    /**
     * Standard non-batching way of rendering.
     * @protected
     * @param {PIXI.Renderer} renderer - Instance to renderer.
     */
    Mesh.prototype._renderDefault = function (renderer) {
        var shader = this.shader;
        shader.alpha = this.worldAlpha;
        if (shader.update) {
            shader.update();
        }
        renderer.batch.flush();
        // bind and sync uniforms..
        shader.uniforms.translationMatrix = this.transform.worldTransform.toArray(true);
        renderer.shader.bind(shader);
        // set state..
        renderer.state.set(this.state);
        // bind the geometry...
        renderer.geometry.bind(this.geometry, shader);
        // then render it
        renderer.geometry.draw(this.drawMode, this.size, this.start, this.geometry.instanceCount);
    };
    /**
     * Rendering by using the Batch system.
     * @protected
     * @param {PIXI.Renderer} renderer - Instance to renderer.
     */
    Mesh.prototype._renderToBatch = function (renderer) {
        var geometry = this.geometry;
        var shader = this.shader;
        if (shader.uvMatrix) {
            shader.uvMatrix.update();
            this.calculateUvs();
        }
        // set properties for batching..
        this.calculateVertices();
        this.indices = geometry.indexBuffer.data;
        this._tintRGB = shader._tintRGB;
        this._texture = shader.texture;
        var pluginName = this.material.pluginName;
        renderer.batch.setObjectRenderer(renderer.plugins[pluginName]);
        renderer.plugins[pluginName].render(this);
    };
    /**
     * Updates vertexData field based on transform and vertices
     */
    Mesh.prototype.calculateVertices = function () {
        var geometry = this.geometry;
        var verticesBuffer = geometry.buffers[0];
        var vertices = verticesBuffer.data;
        var vertexDirtyId = verticesBuffer._updateID;
        if (vertexDirtyId === this.vertexDirty && this._transformID === this.transform._worldID) {
            return;
        }
        this._transformID = this.transform._worldID;
        if (this.vertexData.length !== vertices.length) {
            this.vertexData = new Float32Array(vertices.length);
        }
        var wt = this.transform.worldTransform;
        var a = wt.a;
        var b = wt.b;
        var c = wt.c;
        var d = wt.d;
        var tx = wt.tx;
        var ty = wt.ty;
        var vertexData = this.vertexData;
        for (var i = 0; i < vertexData.length / 2; i++) {
            var x = vertices[(i * 2)];
            var y = vertices[(i * 2) + 1];
            vertexData[(i * 2)] = (a * x) + (c * y) + tx;
            vertexData[(i * 2) + 1] = (b * x) + (d * y) + ty;
        }
        if (this._roundPixels) {
            var resolution = settings.RESOLUTION;
            for (var i = 0; i < vertexData.length; ++i) {
                vertexData[i] = Math.round((vertexData[i] * resolution | 0) / resolution);
            }
        }
        this.vertexDirty = vertexDirtyId;
    };
    /**
     * Updates uv field based on from geometry uv's or batchUvs
     */
    Mesh.prototype.calculateUvs = function () {
        var geomUvs = this.geometry.buffers[1];
        var shader = this.shader;
        if (!shader.uvMatrix.isSimple) {
            if (!this.batchUvs) {
                this.batchUvs = new MeshBatchUvs(geomUvs, shader.uvMatrix);
            }
            this.batchUvs.update();
            this.uvs = this.batchUvs.data;
        }
        else {
            this.uvs = geomUvs.data;
        }
    };
    /**
     * Updates the bounds of the mesh as a rectangle. The bounds calculation takes the worldTransform into account.
     * there must be a aVertexPosition attribute present in the geometry for bounds to be calculated correctly.
     *
     * @protected
     */
    Mesh.prototype._calculateBounds = function () {
        this.calculateVertices();
        this._bounds.addVertexData(this.vertexData, 0, this.vertexData.length);
    };
    /**
     * Tests if a point is inside this mesh. Works only for PIXI.DRAW_MODES.TRIANGLES.
     *
     * @param {PIXI.IPointData} point - the point to test
     * @return {boolean} the result of the test
     */
    Mesh.prototype.containsPoint = function (point) {
        if (!this.getBounds().contains(point.x, point.y)) {
            return false;
        }
        this.worldTransform.applyInverse(point, tempPoint$2);
        var vertices = this.geometry.getBuffer('aVertexPosition').data;
        var points = tempPolygon.points;
        var indices = this.geometry.getIndex().data;
        var len = indices.length;
        var step = this.drawMode === 4 ? 3 : 1;
        for (var i = 0; i + 2 < len; i += step) {
            var ind0 = indices[i] * 2;
            var ind1 = indices[i + 1] * 2;
            var ind2 = indices[i + 2] * 2;
            points[0] = vertices[ind0];
            points[1] = vertices[ind0 + 1];
            points[2] = vertices[ind1];
            points[3] = vertices[ind1 + 1];
            points[4] = vertices[ind2];
            points[5] = vertices[ind2 + 1];
            if (tempPolygon.contains(tempPoint$2.x, tempPoint$2.y)) {
                return true;
            }
        }
        return false;
    };
    /**
     * Destroys the Mesh object.
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all
     *  options have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have
     *  their destroy method called as well. 'options' will be passed on to those calls.
     */
    Mesh.prototype.destroy = function (options) {
        _super.prototype.destroy.call(this, options);
        this.geometry.refCount--;
        if (this.geometry.refCount === 0) {
            this.geometry.dispose();
        }
        if (this._cachedTexture) {
            this._cachedTexture.destroy();
            this._cachedTexture = null;
        }
        this.geometry = null;
        this.shader = null;
        this.state = null;
        this.uvs = null;
        this.indices = null;
        this.vertexData = null;
    };
    /**
     * The maximum number of vertices to consider batchable. Generally, the complexity
     * of the geometry.
     * @memberof PIXI.Mesh
     * @static
     * @member {number} BATCHABLE_SIZE
     */
    Mesh.BATCHABLE_SIZE = 100;
    return Mesh;
}(Container));

var fragment$2 = "varying vec2 vTextureCoord;\nuniform vec4 uColor;\n\nuniform sampler2D uSampler;\n\nvoid main(void)\n{\n    gl_FragColor = texture2D(uSampler, vTextureCoord) * uColor;\n}\n";

var vertex$2 = "attribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\n\nuniform mat3 projectionMatrix;\nuniform mat3 translationMatrix;\nuniform mat3 uTextureMatrix;\n\nvarying vec2 vTextureCoord;\n\nvoid main(void)\n{\n    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);\n\n    vTextureCoord = (uTextureMatrix * vec3(aTextureCoord, 1.0)).xy;\n}\n";

/**
 * Slightly opinionated default shader for PixiJS 2D objects.
 * @class
 * @memberof PIXI
 * @extends PIXI.Shader
 */
var MeshMaterial = /** @class */ (function (_super) {
    __extends$7(MeshMaterial, _super);
    /**
     * @param {PIXI.Texture} uSampler - Texture that material uses to render.
     * @param {object} [options] - Additional options
     * @param {number} [options.alpha=1] - Default alpha.
     * @param {number} [options.tint=0xFFFFFF] - Default tint.
     * @param {string} [options.pluginName='batch'] - Renderer plugin for batching.
     * @param {PIXI.Program} [options.program=0xFFFFFF] - Custom program.
     * @param {object} [options.uniforms] - Custom uniforms.
     */
    function MeshMaterial(uSampler, options) {
        var _this = this;
        var uniforms = {
            uSampler: uSampler,
            alpha: 1,
            uTextureMatrix: Matrix.IDENTITY,
            uColor: new Float32Array([1, 1, 1, 1]),
        };
        // Set defaults
        options = Object.assign({
            tint: 0xFFFFFF,
            alpha: 1,
            pluginName: 'batch',
        }, options);
        if (options.uniforms) {
            Object.assign(uniforms, options.uniforms);
        }
        _this = _super.call(this, options.program || Program.from(vertex$2, fragment$2), uniforms) || this;
        /**
         * Only do update if tint or alpha changes.
         * @member {boolean}
         * @private
         * @default false
         */
        _this._colorDirty = false;
        /**
         * TextureMatrix instance for this Mesh, used to track Texture changes
         *
         * @member {PIXI.TextureMatrix}
         * @readonly
         */
        _this.uvMatrix = new TextureMatrix(uSampler);
        /**
         * `true` if shader can be batch with the renderer's batch system.
         * @member {boolean}
         * @default true
         */
        _this.batchable = options.program === undefined;
        /**
         * Renderer plugin for batching
         *
         * @member {string}
         * @default 'batch'
         */
        _this.pluginName = options.pluginName;
        _this.tint = options.tint;
        _this.alpha = options.alpha;
        return _this;
    }
    Object.defineProperty(MeshMaterial.prototype, "texture", {
        /**
         * Reference to the texture being rendered.
         * @member {PIXI.Texture}
         */
        get: function () {
            return this.uniforms.uSampler;
        },
        set: function (value) {
            if (this.uniforms.uSampler !== value) {
                this.uniforms.uSampler = value;
                this.uvMatrix.texture = value;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(MeshMaterial.prototype, "alpha", {
        get: function () {
            return this._alpha;
        },
        /**
         * This gets automatically set by the object using this.
         *
         * @default 1
         * @member {number}
         */
        set: function (value) {
            if (value === this._alpha)
                { return; }
            this._alpha = value;
            this._colorDirty = true;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(MeshMaterial.prototype, "tint", {
        get: function () {
            return this._tint;
        },
        /**
         * Multiply tint for the material.
         * @member {number}
         * @default 0xFFFFFF
         */
        set: function (value) {
            if (value === this._tint)
                { return; }
            this._tint = value;
            this._tintRGB = (value >> 16) + (value & 0xff00) + ((value & 0xff) << 16);
            this._colorDirty = true;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Gets called automatically by the Mesh. Intended to be overridden for custom
     * MeshMaterial objects.
     */
    MeshMaterial.prototype.update = function () {
        if (this._colorDirty) {
            this._colorDirty = false;
            var baseTexture = this.texture.baseTexture;
            premultiplyTintToRgba(this._tint, this._alpha, this.uniforms.uColor, baseTexture.alphaMode);
        }
        if (this.uvMatrix.update()) {
            this.uniforms.uTextureMatrix = this.uvMatrix.mapCoord;
        }
    };
    return MeshMaterial;
}(Shader));

/**
 * Standard 2D geometry used in PixiJS.
 *
 * Geometry can be defined without passing in a style or data if required.
 *
 * ```js
 * const geometry = new PIXI.Geometry();
 *
 * geometry.addAttribute('positions', [0, 0, 100, 0, 100, 100, 0, 100], 2);
 * geometry.addAttribute('uvs', [0,0,1,0,1,1,0,1], 2);
 * geometry.addIndex([0,1,2,1,3,2]);
 *
 * ```
 * @class
 * @memberof PIXI
 * @extends PIXI.Geometry
 */
var MeshGeometry = /** @class */ (function (_super) {
    __extends$7(MeshGeometry, _super);
    /**
     * @param {Float32Array|number[]} [vertices] - Positional data on geometry.
     * @param {Float32Array|number[]} [uvs] - Texture UVs.
     * @param {Uint16Array|number[]} [index] - IndexBuffer
     */
    function MeshGeometry(vertices, uvs, index) {
        var _this = _super.call(this) || this;
        var verticesBuffer = new Buffer(vertices);
        var uvsBuffer = new Buffer(uvs, true);
        var indexBuffer = new Buffer(index, true, true);
        _this.addAttribute('aVertexPosition', verticesBuffer, 2, false, TYPES$1.FLOAT)
            .addAttribute('aTextureCoord', uvsBuffer, 2, false, TYPES$1.FLOAT)
            .addIndex(indexBuffer);
        /**
         * Dirty flag to limit update calls on Mesh. For example,
         * limiting updates on a single Mesh instance with a shared Geometry
         * within the render loop.
         * @private
         * @member {number}
         * @default -1
         */
        _this._updateId = -1;
        return _this;
    }
    Object.defineProperty(MeshGeometry.prototype, "vertexDirtyId", {
        /**
         * If the vertex position is updated.
         * @member {number}
         * @readonly
         * @private
         */
        get: function () {
            return this.buffers[0]._updateID;
        },
        enumerable: false,
        configurable: true
    });
    return MeshGeometry;
}(Geometry));

/*!
 * @pixi/text-bitmap - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/text-bitmap is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$8 = function(d, b) {
    extendStatics$8 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$8(d, b);
};

function __extends$8(d, b) {
    extendStatics$8(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

/* eslint-disable max-len */
/**
 * Normalized parsed data from .fnt files.
 *
 * @class
 * @memberof PIXI
 */
var BitmapFontData = /** @class */ (function () {
    function BitmapFontData() {
        /**
         * @member {PIXI.IBitmapFontDataInfo[]}
         * @readOnly
         */
        this.info = [];
        /**
         * @member {PIXI.IBitmapFontDataCommon[]}
         * @readOnly
         */
        this.common = [];
        /**
         * @member {PIXI.IBitmapFontDataPage[]}
         * @readOnly
         */
        this.page = [];
        /**
         * @member {PIXI.IBitmapFontDataChar[]}
         * @readOnly
         */
        this.char = [];
        /**
         * @member {PIXI.IBitmapFontDataKerning[]}
         * @readOnly
         */
        this.kerning = [];
    }
    return BitmapFontData;
}());
/**
 * @memberof PIXI
 * @typedef {object} IBitmapFontDataInfo
 * @property {string} face
 * @property {number} size
 */
/**
 * @memberof PIXI
 * @typedef {object} IBitmapFontDataCommon
 * @property {number} lineHeight
 */
/**
 * @memberof PIXI
 * @typedef {object} IBitmapFontDataPage
 * @property {number} id
 * @property {string} file
 */
/**
 * @memberof PIXI
 * @typedef {object} IBitmapFontDataChar
 * @property {string} id
 * @property {number} page
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} xoffset
 * @property {number} yoffset
 * @property {number} xadvance
 */
/**
 * @memberof PIXI
 * @typedef {object} IBitmapFontDataKerning
 * @property {number} first
 * @property {number} second
 * @property {number} amount
 */

/**
 * BitmapFont format that's Text-based.
 *
 * @class
 * @private
 */
var TextFormat = /** @class */ (function () {
    function TextFormat() {
    }
    /**
     * Check if resource refers to txt font data.
     *
     * @static
     * @private
     * @param {any} data
     * @return {boolean} True if resource could be treated as font data, false otherwise.
     */
    TextFormat.test = function (data) {
        return typeof data === 'string' && data.indexOf('info face=') === 0;
    };
    /**
     * Convert text font data to a javascript object.
     *
     * @static
     * @private
     * @param {string} txt - Raw string data to be converted
     * @return {PIXI.BitmapFontData} Parsed font data
     */
    TextFormat.parse = function (txt) {
        // Retrieve data item
        var items = txt.match(/^[a-z]+\s+.+$/gm);
        var rawData = {
            info: [],
            common: [],
            page: [],
            char: [],
            chars: [],
            kerning: [],
            kernings: [],
        };
        for (var i in items) {
            // Extract item name
            var name = items[i].match(/^[a-z]+/gm)[0];
            // Extract item attribute list as string ex.: "width=10"
            var attributeList = items[i].match(/[a-zA-Z]+=([^\s"']+|"([^"]*)")/gm);
            // Convert attribute list into an object
            var itemData = {};
            for (var i_1 in attributeList) {
                // Split key-value pairs
                var split = attributeList[i_1].split('=');
                var key = split[0];
                // Remove eventual quotes from value
                var strValue = split[1].replace(/"/gm, '');
                // Try to convert value into float
                var floatValue = parseFloat(strValue);
                // Use string value case float value is NaN
                var value = isNaN(floatValue) ? strValue : floatValue;
                itemData[key] = value;
            }
            // Push current item to the resulting data
            rawData[name].push(itemData);
        }
        var font = new BitmapFontData();
        rawData.info.forEach(function (info) { return font.info.push({
            face: info.face,
            size: parseInt(info.size, 10),
        }); });
        rawData.common.forEach(function (common) { return font.common.push({
            lineHeight: parseInt(common.lineHeight, 10),
        }); });
        rawData.page.forEach(function (page) { return font.page.push({
            id: parseInt(page.id, 10),
            file: page.file,
        }); });
        rawData.char.forEach(function (char) { return font.char.push({
            id: parseInt(char.id, 10),
            page: parseInt(char.page, 10),
            x: parseInt(char.x, 10),
            y: parseInt(char.y, 10),
            width: parseInt(char.width, 10),
            height: parseInt(char.height, 10),
            xoffset: parseInt(char.xoffset, 10),
            yoffset: parseInt(char.yoffset, 10),
            xadvance: parseInt(char.xadvance, 10),
        }); });
        rawData.kerning.forEach(function (kerning) { return font.kerning.push({
            first: parseInt(kerning.first, 10),
            second: parseInt(kerning.second, 10),
            amount: parseInt(kerning.amount, 10),
        }); });
        return font;
    };
    return TextFormat;
}());

/**
 * BitmapFont format that's XML-based.
 *
 * @class
 * @private
 */
var XMLFormat = /** @class */ (function () {
    function XMLFormat() {
    }
    /**
     * Check if resource refers to xml font data.
     *
     * @static
     * @private
     * @param {any} data
     * @return {boolean} True if resource could be treated as font data, false otherwise.
     */
    XMLFormat.test = function (data) {
        return data instanceof XMLDocument
            && data.getElementsByTagName('page').length
            && data.getElementsByTagName('info')[0].getAttribute('face') !== null;
    };
    /**
     * Convert the XML into BitmapFontData that we can use.
     *
     * @static
     * @private
     * @param {XMLDocument} xml
     * @return {BitmapFontData} Data to use for BitmapFont
     */
    XMLFormat.parse = function (xml) {
        var data = new BitmapFontData();
        var info = xml.getElementsByTagName('info');
        var common = xml.getElementsByTagName('common');
        var page = xml.getElementsByTagName('page');
        var char = xml.getElementsByTagName('char');
        var kerning = xml.getElementsByTagName('kerning');
        for (var i = 0; i < info.length; i++) {
            data.info.push({
                face: info[i].getAttribute('face'),
                size: parseInt(info[i].getAttribute('size'), 10),
            });
        }
        for (var i = 0; i < common.length; i++) {
            data.common.push({
                lineHeight: parseInt(common[i].getAttribute('lineHeight'), 10),
            });
        }
        for (var i = 0; i < page.length; i++) {
            data.page.push({
                id: parseInt(page[i].getAttribute('id'), 10) || 0,
                file: page[i].getAttribute('file'),
            });
        }
        for (var i = 0; i < char.length; i++) {
            var letter = char[i];
            data.char.push({
                id: parseInt(letter.getAttribute('id'), 10),
                page: parseInt(letter.getAttribute('page'), 10) || 0,
                x: parseInt(letter.getAttribute('x'), 10),
                y: parseInt(letter.getAttribute('y'), 10),
                width: parseInt(letter.getAttribute('width'), 10),
                height: parseInt(letter.getAttribute('height'), 10),
                xoffset: parseInt(letter.getAttribute('xoffset'), 10),
                yoffset: parseInt(letter.getAttribute('yoffset'), 10),
                xadvance: parseInt(letter.getAttribute('xadvance'), 10),
            });
        }
        for (var i = 0; i < kerning.length; i++) {
            data.kerning.push({
                first: parseInt(kerning[i].getAttribute('first'), 10),
                second: parseInt(kerning[i].getAttribute('second'), 10),
                amount: parseInt(kerning[i].getAttribute('amount'), 10),
            });
        }
        return data;
    };
    return XMLFormat;
}());

/**
 * BitmapFont format that's XML-based.
 *
 * @class
 * @private
 */
var XMLStringFormat = /** @class */ (function () {
    function XMLStringFormat() {
    }
    /**
     * Check if resource refers to text xml font data.
     *
     * @static
     * @private
     * @param {any} data
     * @return {boolean} True if resource could be treated as font data, false otherwise.
     */
    XMLStringFormat.test = function (data) {
        if (typeof data === 'string' && data.indexOf('<font>') > -1) {
            var xml = new self.DOMParser().parseFromString(data, 'text/xml');
            return XMLFormat.test(xml);
        }
        return false;
    };
    /**
     * Convert the text XML into BitmapFontData that we can use.
     *
     * @static
     * @private
     * @param {string} xmlTxt
     * @return {BitmapFontData} Data to use for BitmapFont
     */
    XMLStringFormat.parse = function (xmlTxt) {
        var xml = new self.DOMParser().parseFromString(xmlTxt, 'text/xml');
        return XMLFormat.parse(xml);
    };
    return XMLStringFormat;
}());

// Registered formats, maybe make this extensible in the future?
var formats = [
    TextFormat,
    XMLFormat,
    XMLStringFormat ];
/**
 * Auto-detect BitmapFont parsing format based on data.
 * @private
 * @param {any} data - Data to detect format
 * @return {any} Format or null
 */
function autoDetectFormat(data) {
    for (var i = 0; i < formats.length; i++) {
        if (formats[i].test(data)) {
            return formats[i];
        }
    }
    return null;
}

// TODO: Prevent code duplication b/w generateFillStyle & Text#generateFillStyle
/**
 * Generates the fill style. Can automatically generate a gradient based on the fill style being an array
 *
 * @private
 * @param {object} style - The style.
 * @param {string[]} lines - The lines of text.
 * @return {string|number|CanvasGradient} The fill style
 */
function generateFillStyle(canvas, context, style, resolution, lines, metrics) {
    // TODO: Can't have different types for getter and setter. The getter shouldn't have the number type as
    //       the setter converts to string. See this thread for more details:
    //       https://github.com/microsoft/TypeScript/issues/2521
    var fillStyle = style.fill;
    if (!Array.isArray(fillStyle)) {
        return fillStyle;
    }
    else if (fillStyle.length === 1) {
        return fillStyle[0];
    }
    // the gradient will be evenly spaced out according to how large the array is.
    // ['#FF0000', '#00FF00', '#0000FF'] would created stops at 0.25, 0.5 and 0.75
    var gradient;
    // a dropshadow will enlarge the canvas and result in the gradient being
    // generated with the incorrect dimensions
    var dropShadowCorrection = (style.dropShadow) ? style.dropShadowDistance : 0;
    // should also take padding into account, padding can offset the gradient
    var padding = style.padding || 0;
    var width = (canvas.width / resolution) - dropShadowCorrection - (padding * 2);
    var height = (canvas.height / resolution) - dropShadowCorrection - (padding * 2);
    // make a copy of the style settings, so we can manipulate them later
    var fill = fillStyle.slice();
    var fillGradientStops = style.fillGradientStops.slice();
    // wanting to evenly distribute the fills. So an array of 4 colours should give fills of 0.25, 0.5 and 0.75
    if (!fillGradientStops.length) {
        var lengthPlus1 = fill.length + 1;
        for (var i = 1; i < lengthPlus1; ++i) {
            fillGradientStops.push(i / lengthPlus1);
        }
    }
    // stop the bleeding of the last gradient on the line above to the top gradient of the this line
    // by hard defining the first gradient colour at point 0, and last gradient colour at point 1
    fill.unshift(fillStyle[0]);
    fillGradientStops.unshift(0);
    fill.push(fillStyle[fillStyle.length - 1]);
    fillGradientStops.push(1);
    if (style.fillGradientType === TEXT_GRADIENT.LINEAR_VERTICAL) {
        // start the gradient at the top center of the canvas, and end at the bottom middle of the canvas
        gradient = context.createLinearGradient(width / 2, padding, width / 2, height + padding);
        // we need to repeat the gradient so that each individual line of text has the same vertical gradient effect
        // ['#FF0000', '#00FF00', '#0000FF'] over 2 lines would create stops at 0.125, 0.25, 0.375, 0.625, 0.75, 0.875
        // There's potential for floating point precision issues at the seams between gradient repeats.
        // The loop below generates the stops in order, so track the last generated one to prevent
        // floating point precision from making us go the teeniest bit backwards, resulting in
        // the first and last colors getting swapped.
        var lastIterationStop = 0;
        // Actual height of the text itself, not counting spacing for lineHeight/leading/dropShadow etc
        var textHeight = metrics.fontProperties.fontSize + style.strokeThickness;
        // textHeight, but as a 0-1 size in global gradient stop space
        var gradStopLineHeight = textHeight / height;
        for (var i = 0; i < lines.length; i++) {
            var thisLineTop = metrics.lineHeight * i;
            for (var j = 0; j < fill.length; j++) {
                // 0-1 stop point for the current line, multiplied to global space afterwards
                var lineStop = 0;
                if (typeof fillGradientStops[j] === 'number') {
                    lineStop = fillGradientStops[j];
                }
                else {
                    lineStop = j / fill.length;
                }
                var globalStop = (thisLineTop / height) + (lineStop * gradStopLineHeight);
                // Prevent color stop generation going backwards from floating point imprecision
                var clampedStop = Math.max(lastIterationStop, globalStop);
                clampedStop = Math.min(clampedStop, 1); // Cap at 1 as well for safety's sake to avoid a possible throw.
                gradient.addColorStop(clampedStop, fill[j]);
                lastIterationStop = clampedStop;
            }
        }
    }
    else {
        // start the gradient at the center left of the canvas, and end at the center right of the canvas
        gradient = context.createLinearGradient(padding, height / 2, width + padding, height / 2);
        // can just evenly space out the gradients in this case, as multiple lines makes no difference
        // to an even left to right gradient
        var totalIterations = fill.length + 1;
        var currentIteration = 1;
        for (var i = 0; i < fill.length; i++) {
            var stop = void 0;
            if (typeof fillGradientStops[i] === 'number') {
                stop = fillGradientStops[i];
            }
            else {
                stop = currentIteration / totalIterations;
            }
            gradient.addColorStop(stop, fill[i]);
            currentIteration++;
        }
    }
    return gradient;
}

// TODO: Prevent code duplication b/w drawGlyph & Text#updateText
/**
 * Draws the glyph `metrics.text` on the given canvas.
 *
 * Ignored because not directly exposed.
 *
 * @ignore
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} context
 * @param {TextMetrics} metrics
 * @param {number} x
 * @param {number} y
 * @param {number} resolution
 * @param {TextStyle} style
 */
function drawGlyph(canvas, context, metrics, x, y, resolution, style) {
    var char = metrics.text;
    var fontProperties = metrics.fontProperties;
    context.translate(x, y);
    context.scale(resolution, resolution);
    var tx = style.strokeThickness / 2;
    var ty = -(style.strokeThickness / 2);
    context.font = style.toFontString();
    context.lineWidth = style.strokeThickness;
    context.textBaseline = style.textBaseline;
    context.lineJoin = style.lineJoin;
    context.miterLimit = style.miterLimit;
    // set canvas text styles
    context.fillStyle = generateFillStyle(canvas, context, style, resolution, [char], metrics);
    context.strokeStyle = style.stroke;
    var dropShadowColor = style.dropShadowColor;
    var rgb = hex2rgb(typeof dropShadowColor === 'number' ? dropShadowColor : string2hex(dropShadowColor));
    if (style.dropShadow) {
        context.shadowColor = "rgba(" + rgb[0] * 255 + "," + rgb[1] * 255 + "," + rgb[2] * 255 + "," + style.dropShadowAlpha + ")";
        context.shadowBlur = style.dropShadowBlur;
        context.shadowOffsetX = Math.cos(style.dropShadowAngle) * style.dropShadowDistance;
        context.shadowOffsetY = Math.sin(style.dropShadowAngle) * style.dropShadowDistance;
    }
    else {
        context.shadowColor = 'black';
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
    }
    if (style.stroke && style.strokeThickness) {
        context.strokeText(char, tx, ty + metrics.lineHeight - fontProperties.descent);
    }
    if (style.fill) {
        context.fillText(char, tx, ty + metrics.lineHeight - fontProperties.descent);
    }
    context.setTransform(1, 0, 0, 1, 0, 0); // defaults needed for older browsers (e.g. Opera 29)
    context.fillStyle = 'rgba(0, 0, 0, 0)';
}

/**
 * Processes the passed character set data and returns a flattened array of all the characters.
 *
 * Ignored because not directly exposed.
 *
 * @ignore
 * @param {string | string[] | string[][] } chars
 * @returns {string[]}
 */
function resolveCharacters(chars) {
    // Split the chars string into individual characters
    if (typeof chars === 'string') {
        chars = [chars];
    }
    // Handle an array of characters+ranges
    var result = [];
    for (var i = 0, j = chars.length; i < j; i++) {
        var item = chars[i];
        // Handle range delimited by start/end chars
        if (Array.isArray(item)) {
            if (item.length !== 2) {
                throw new Error("[BitmapFont]: Invalid character range length, expecting 2 got " + item.length + ".");
            }
            var startCode = item[0].charCodeAt(0);
            var endCode = item[1].charCodeAt(0);
            if (endCode < startCode) {
                throw new Error('[BitmapFont]: Invalid character range.');
            }
            for (var i_1 = startCode, j_1 = endCode; i_1 <= j_1; i_1++) {
                result.push(String.fromCharCode(i_1));
            }
        }
        // Handle a character set string
        else {
            result.push.apply(result, item.split(''));
        }
    }
    if (result.length === 0) {
        throw new Error('[BitmapFont]: Empty set when resolving characters.');
    }
    return result;
}

/**
 * BitmapFont represents a typeface available for use with the BitmapText class. Use the `install`
 * method for adding a font to be used.
 *
 * @class
 * @memberof PIXI
 */
var BitmapFont = /** @class */ (function () {
    /**
     * @param {PIXI.BitmapFontData} data
     * @param {PIXI.Texture[]|Object.<string, PIXI.Texture>} textures
     * @param {boolean} ownsTextures - Setting to `true` will destroy page textures
     *        when the font is uninstalled.
     */
    function BitmapFont(data, textures, ownsTextures) {
        var info = data.info[0];
        var common = data.common[0];
        var page = data.page[0];
        var res = getResolutionOfUrl(page.file);
        var pageTextures = {};
        this._ownsTextures = ownsTextures;
        /**
         * The name of the font face.
         *
         * @member {string}
         * @readonly
         */
        this.font = info.face;
        /**
         * The size of the font face in pixels.
         *
         * @member {number}
         * @readonly
         */
        this.size = info.size;
        /**
         * The line-height of the font face in pixels.
         *
         * @member {number}
         * @readonly
         */
        this.lineHeight = common.lineHeight / res;
        /**
         * The map of characters by character code.
         *
         * @member {object}
         * @readonly
         */
        this.chars = {};
        /**
         * The map of base page textures (i.e., sheets of glyphs).
         *
         * @member {object}
         * @readonly
         * @private
         */
        this.pageTextures = pageTextures;
        // Convert the input Texture, Textures or object
        // into a page Texture lookup by "id"
        for (var i = 0; i < data.page.length; i++) {
            var _a = data.page[i], id = _a.id, file = _a.file;
            pageTextures[id] = textures instanceof Array
                ? textures[i] : textures[file];
        }
        // parse letters
        for (var i = 0; i < data.char.length; i++) {
            var _b = data.char[i], id = _b.id, page_1 = _b.page;
            var _c = data.char[i], x = _c.x, y = _c.y, width = _c.width, height = _c.height, xoffset = _c.xoffset, yoffset = _c.yoffset, xadvance = _c.xadvance;
            x /= res;
            y /= res;
            width /= res;
            height /= res;
            xoffset /= res;
            yoffset /= res;
            xadvance /= res;
            var rect = new Rectangle(x + (pageTextures[page_1].frame.x / res), y + (pageTextures[page_1].frame.y / res), width, height);
            this.chars[id] = {
                xOffset: xoffset,
                yOffset: yoffset,
                xAdvance: xadvance,
                kerning: {},
                texture: new Texture(pageTextures[page_1].baseTexture, rect),
                page: page_1,
            };
        }
        // parse kernings
        for (var i = 0; i < data.kerning.length; i++) {
            var _d = data.kerning[i], first = _d.first, second = _d.second, amount = _d.amount;
            first /= res;
            second /= res;
            amount /= res;
            if (this.chars[second]) {
                this.chars[second].kerning[first] = amount;
            }
        }
    }
    /**
     * Remove references to created glyph textures.
     */
    BitmapFont.prototype.destroy = function () {
        for (var id in this.chars) {
            this.chars[id].texture.destroy();
            this.chars[id].texture = null;
        }
        for (var id in this.pageTextures) {
            if (this._ownsTextures) {
                this.pageTextures[id].destroy(true);
            }
            this.pageTextures[id] = null;
        }
        // Set readonly null.
        this.chars = null;
        this.pageTextures = null;
    };
    /**
     * Register a new bitmap font.
     *
     * @static
     * @param {XMLDocument|string|PIXI.BitmapFontData} data - The
     *        characters map that could be provided as xml or raw string.
     * @param {Object.<string, PIXI.Texture>|PIXI.Texture|PIXI.Texture[]}
     *        textures - List of textures for each page.
     * @param managedTexture - Set to `true` to destroy page textures
     *        when the font is uninstalled. By default fonts created with
     *        `BitmapFont.from` or from the `BitmapFontLoader` are `true`.
     * @return {PIXI.BitmapFont} Result font object with font, size, lineHeight
     *         and char fields.
     */
    BitmapFont.install = function (data, textures, ownsTextures) {
        var fontData;
        if (data instanceof BitmapFontData) {
            fontData = data;
        }
        else {
            var format = autoDetectFormat(data);
            if (!format) {
                throw new Error('Unrecognized data format for font.');
            }
            fontData = format.parse(data);
        }
        // Single texture, convert to list
        if (textures instanceof Texture) {
            textures = [textures];
        }
        var font = new BitmapFont(fontData, textures, ownsTextures);
        BitmapFont.available[font.font] = font;
        return font;
    };
    /**
     * Remove bitmap font by name.
     *
     * @static
     * @param name - Name of the font to uninstall.
     */
    BitmapFont.uninstall = function (name) {
        var font = BitmapFont.available[name];
        if (!font) {
            throw new Error("No font found named '" + name + "'");
        }
        font.destroy();
        delete BitmapFont.available[name];
    };
    /**
     * Generates a bitmap-font for the given style and character set. This does not support
     * kernings yet. With `style` properties, only the following non-layout properties are used:
     *
     * - {@link PIXI.TextStyle#dropShadow|dropShadow}
     * - {@link PIXI.TextStyle#dropShadowDistance|dropShadowDistance}
     * - {@link PIXI.TextStyle#dropShadowColor|dropShadowColor}
     * - {@link PIXI.TextStyle#dropShadowBlur|dropShadowBlur}
     * - {@link PIXI.TextStyle#dropShadowAngle|dropShadowAngle}
     * - {@link PIXI.TextStyle#fill|fill}
     * - {@link PIXI.TextStyle#fillGradientStops|fillGradientStops}
     * - {@link PIXI.TextStyle#fillGradientType|fillGradientType}
     * - {@link PIXI.TextStyle#fontFamily|fontFamily}
     * - {@link PIXI.TextStyle#fontSize|fontSize}
     * - {@link PIXI.TextStyle#fontVariant|fontVariant}
     * - {@link PIXI.TextStyle#fontWeight|fontWeight}
     * - {@link PIXI.TextStyle#lineJoin|lineJoin}
     * - {@link PIXI.TextStyle#miterLimit|miterLimit}
     * - {@link PIXI.TextStyle#stroke|stroke}
     * - {@link PIXI.TextStyle#strokeThickness|strokeThickness}
     * - {@link PIXI.TextStyle#textBaseline|textBaseline}
     *
     * @param {string} name - The name of the custom font to use with BitmapText.
     * @param {object|PIXI.TextStyle} [style] - Style options to render with BitmapFont.
     * @param {PIXI.IBitmapFontOptions} [options] - Setup options for font or name of the font.
     * @param {string|string[]|string[][]} [options.chars=PIXI.BitmapFont.ALPHANUMERIC] - characters included
     *      in the font set. You can also use ranges. For example, `[['a', 'z'], ['A', 'Z'], "!@#$%^&*()~{}[] "]`.
     *      Don't forget to include spaces ' ' in your character set!
     * @param {number} [options.resolution=1] - Render resolution for glyphs.
     * @param {number} [options.textureWidth=512] - Optional width of atlas, smaller values to reduce memory.
     * @param {number} [options.textureHeight=512] - Optional height of atlas, smaller values to reduce memory.
     * @param {number} [options.padding=4] - Padding between glyphs on texture atlas.
     * @return {PIXI.BitmapFont} Font generated by style options.
     * @static
     * @example
     * PIXI.BitmapFont.from("TitleFont", {
     *     fontFamily: "Arial",
     *     fontSize: 12,
     *     strokeThickness: 2,
     *     fill: "purple"
     * });
     *
     * const title = new PIXI.BitmapText("This is the title", { fontName: "TitleFont" });
     */
    BitmapFont.from = function (name, textStyle, options) {
        if (!name) {
            throw new Error('[BitmapFont] Property `name` is required.');
        }
        var _a = Object.assign({}, BitmapFont.defaultOptions, options), chars = _a.chars, padding = _a.padding, resolution = _a.resolution, textureWidth = _a.textureWidth, textureHeight = _a.textureHeight;
        var charsList = resolveCharacters(chars);
        var style = textStyle instanceof TextStyle ? textStyle : new TextStyle(textStyle);
        var lineWidth = textureWidth;
        var fontData = new BitmapFontData();
        fontData.info[0] = {
            face: style.fontFamily,
            size: style.fontSize,
        };
        fontData.common[0] = {
            lineHeight: style.fontSize,
        };
        var positionX = 0;
        var positionY = 0;
        var canvas;
        var context;
        var baseTexture;
        var maxCharHeight = 0;
        var textures = [];
        for (var i = 0; i < charsList.length; i++) {
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.width = textureWidth;
                canvas.height = textureHeight;
                context = canvas.getContext('2d');
                baseTexture = new BaseTexture(canvas, { resolution: resolution });
                textures.push(new Texture(baseTexture));
                fontData.page.push({
                    id: textures.length - 1,
                    file: '',
                });
            }
            // Measure glyph dimensions
            var metrics = TextMetrics.measureText(charsList[i], style, false, canvas);
            var width = metrics.width;
            var height = Math.ceil(metrics.height);
            // This is ugly - but italics are given more space so they don't overlap
            var textureGlyphWidth = Math.ceil((style.fontStyle === 'italic' ? 2 : 1) * width);
            // Can't fit char anymore: next canvas please!
            if (positionY >= textureHeight - (height * resolution)) {
                if (positionY === 0) {
                    // We don't want user debugging an infinite loop (or do we? :)
                    throw new Error("[BitmapFont] textureHeight " + textureHeight + "px is "
                        + ("too small for " + style.fontSize + "px fonts"));
                }
                --i;
                // Create new atlas once current has filled up
                canvas = null;
                context = null;
                baseTexture = null;
                positionY = 0;
                positionX = 0;
                maxCharHeight = 0;
                continue;
            }
            maxCharHeight = Math.max(height + metrics.fontProperties.descent, maxCharHeight);
            // Wrap line once full row has been rendered
            if ((textureGlyphWidth * resolution) + positionX >= lineWidth) {
                --i;
                positionY += maxCharHeight * resolution;
                positionY = Math.ceil(positionY);
                positionX = 0;
                maxCharHeight = 0;
                continue;
            }
            drawGlyph(canvas, context, metrics, positionX, positionY, resolution, style);
            // Unique (numeric) ID mapping to this glyph
            var id = metrics.text.charCodeAt(0);
            // Create a texture holding just the glyph
            fontData.char.push({
                id: id,
                page: textures.length - 1,
                x: positionX / resolution,
                y: positionY / resolution,
                width: textureGlyphWidth,
                height: height,
                xoffset: 0,
                yoffset: 0,
                xadvance: Math.ceil(width
                    - (style.dropShadow ? style.dropShadowDistance : 0)
                    - (style.stroke ? style.strokeThickness : 0)),
            });
            positionX += (textureGlyphWidth + (2 * padding)) * resolution;
            positionX = Math.ceil(positionX);
        }
        // Brute-force kerning info, this can be expensive b/c it's an O(n²),
        // but we're using measureText which is native and fast.
        for (var i = 0, len = charsList.length; i < len; i++) {
            var first = charsList[i];
            for (var j = 0; j < len; j++) {
                var second = charsList[j];
                var c1 = context.measureText(first).width;
                var c2 = context.measureText(second).width;
                var total = context.measureText(first + second).width;
                var amount = total - (c1 + c2);
                if (amount) {
                    fontData.kerning.push({
                        first: first.charCodeAt(0),
                        second: second.charCodeAt(0),
                        amount: amount,
                    });
                }
            }
        }
        var font = new BitmapFont(fontData, textures, true);
        // Make it easier to replace a font
        if (BitmapFont.available[name] !== undefined) {
            BitmapFont.uninstall(name);
        }
        BitmapFont.available[name] = font;
        return font;
    };
    /**
     * This character set includes all the letters in the alphabet (both lower- and upper- case).
     * @readonly
     * @static
     * @member {string[][]}
     * @example
     * BitmapFont.from("ExampleFont", style, { chars: BitmapFont.ALPHA })
     */
    BitmapFont.ALPHA = [['a', 'z'], ['A', 'Z'], ' '];
    /**
     * This character set includes all decimal digits (from 0 to 9).
     * @readonly
     * @static
     * @member {string[][]}
     * @example
     * BitmapFont.from("ExampleFont", style, { chars: BitmapFont.NUMERIC })
     */
    BitmapFont.NUMERIC = [['0', '9']];
    /**
     * This character set is the union of `BitmapFont.ALPHA` and `BitmapFont.NUMERIC`.
     * @readonly
     * @static
     * @member {string[][]}
     */
    BitmapFont.ALPHANUMERIC = [['a', 'z'], ['A', 'Z'], ['0', '9'], ' '];
    /**
     * This character set consists of all the ASCII table.
     * @readonly
     * @static
     * @member {string[][]}
     * @see http://www.asciitable.com/
     */
    BitmapFont.ASCII = [[' ', '~']];
    /**
     * Collection of default options when using `BitmapFont.from`.
     *
     * @readonly
     * @static
     * @member {PIXI.IBitmapFontOptions}
     * @property {number} resolution=1
     * @property {number} textureWidth=512
     * @property {number} textureHeight=512
     * @property {number} padding=4
     * @property {string|string[]|string[][]} chars = PIXI.BitmapFont.ALPHANUMERIC
     */
    BitmapFont.defaultOptions = {
        resolution: 1,
        textureWidth: 512,
        textureHeight: 512,
        padding: 4,
        chars: BitmapFont.ALPHANUMERIC,
    };
    /**
     * Collection of available/installed fonts.
     *
     * @readonly
     * @static
     * @member {Object.<string, PIXI.BitmapFont>}
     */
    BitmapFont.available = {};
    return BitmapFont;
}());
/**
 * @memberof PIXI
 * @interface IBitmapFontOptions
 * @property {string | string[] | string[][]} [chars=PIXI.BitmapFont.ALPHANUMERIC] - the character set to generate
 * @property {number} [resolution=1] - the resolution for rendering
 * @property {number} [padding=4] - the padding between glyphs in the atlas
 * @property {number} [textureWidth=512] - the width of the texture atlas
 * @property {number} [textureHeight=512] - the height of the texture atlas
 */

var pageMeshDataPool = [];
var charRenderDataPool = [];
/**
 * A BitmapText object will create a line or multiple lines of text using bitmap font.
 *
 * The primary advantage of this class over Text is that all of your textures are pre-generated and loading,
 * meaning that rendering is fast, and changing text has no performance implications.
 *
 * Supporting character sets other than latin, such as CJK languages, may be impractical due to the number of characters.
 *
 * To split a line you can use '\n', '\r' or '\r\n' in your string.
 *
 * PixiJS can auto-generate fonts on-the-fly using BitmapFont or use fnt files provided by:
 * http://www.angelcode.com/products/bmfont/ for Windows or
 * http://www.bmglyph.com/ for Mac.
 *
 * A BitmapText can only be created when the font is loaded.
 *
 * ```js
 * // in this case the font is in a file called 'desyrel.fnt'
 * let bitmapText = new PIXI.BitmapText("text using a fancy font!", {
 *   fontName: "Desyrel",
 *   fontSize: 35,
 *   align: "right"
 * });
 * ```
 *
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 */
var BitmapText = /** @class */ (function (_super) {
    __extends$8(BitmapText, _super);
    /**
     * @param {string} text - A string that you would like the text to display.
     * @param {object} style - The style parameters.
     * @param {string} style.fontName - The installed BitmapFont name.
     * @param {number} [style.fontSize] - The size of the font in pixels, e.g. 24. If undefined,
     *.     this will default to the BitmapFont size.
     * @param {string} [style.align='left'] - Alignment for multiline text ('left', 'center', 'right' or 'justify'),
     *      does not affect single line text.
     * @param {number} [style.tint=0xFFFFFF] - The tint color.
     * @param {number} [style.letterSpacing=0] - The amount of spacing between letters.
     * @param {number} [style.maxWidth=0] - The max width of the text before line wrapping.
     */
    function BitmapText(text, style) {
        if (style === void 0) { style = {}; }
        var _this = _super.call(this) || this;
        _this._tint = 0xFFFFFF;
        // Apply the defaults
        var _a = Object.assign({}, BitmapText.styleDefaults, style), align = _a.align, tint = _a.tint, maxWidth = _a.maxWidth, letterSpacing = _a.letterSpacing, fontName = _a.fontName, fontSize = _a.fontSize;
        if (!BitmapFont.available[fontName]) {
            throw new Error("Missing BitmapFont \"" + fontName + "\"");
        }
        /**
         * Collection of page mesh data.
         *
         * @member {object}
         * @private
         */
        _this._activePagesMeshData = [];
        /**
         * Private tracker for the width of the overall text
         *
         * @member {number}
         * @private
         */
        _this._textWidth = 0;
        /**
         * Private tracker for the height of the overall text
         *
         * @member {number}
         * @private
         */
        _this._textHeight = 0;
        /**
         * Private tracker for the current text align.
         *
         * @member {string}
         * @private
         */
        _this._align = align;
        /**
         * Private tracker for the current tint.
         *
         * @member {number}
         * @private
         */
        _this._tint = tint;
        /**
         * Private tracker for the current font name.
         *
         * @member {string}
         * @private
         */
        _this._fontName = fontName;
        /**
         * Private tracker for the current font size.
         *
         * @member {number}
         * @private
         */
        _this._fontSize = fontSize || BitmapFont.available[fontName].size;
        /**
         * Private tracker for the current text.
         *
         * @member {string}
         * @private
         */
        _this._text = text;
        /**
         * The max width of this bitmap text in pixels. If the text provided is longer than the
         * value provided, line breaks will be automatically inserted in the last whitespace.
         * Disable by setting value to 0
         *
         * @member {number}
         * @private
         */
        _this._maxWidth = maxWidth;
        /**
         * The max line height. This is useful when trying to use the total height of the Text,
         * ie: when trying to vertically align. (Internally used)
         *
         * @member {number}
         * @private
         */
        _this._maxLineHeight = 0;
        /**
         * Letter spacing. This is useful for setting the space between characters.
         * @member {number}
         * @private
         */
        _this._letterSpacing = letterSpacing;
        /**
         * Text anchor. read-only
         *
         * @member {PIXI.ObservablePoint}
         * @private
         */
        _this._anchor = new ObservablePoint(function () { _this.dirty = true; }, _this, 0, 0);
        /**
         * If true PixiJS will Math.floor() x/y values when rendering
         *
         * @member {boolean}
         * @default PIXI.settings.ROUND_PIXELS
         */
        _this._roundPixels = settings.ROUND_PIXELS;
        /**
         * Set to `true` if the BitmapText needs to be redrawn.
         *
         * @member {boolean}
         */
        _this.dirty = true;
        /**
         * Cached char texture is destroyed when BitmapText is destroyed
         * @member {Record<number, Texture>}
         * @private
         */
        _this._textureCache = {};
        return _this;
    }
    /**
     * Renders text and updates it when needed. This should only be called
     * if the BitmapFont is regenerated.
     */
    BitmapText.prototype.updateText = function () {
        var _a;
        var data = BitmapFont.available[this._fontName];
        var scale = this._fontSize / data.size;
        var pos = new Point();
        var chars = [];
        var lineWidths = [];
        var lineSpaces = [];
        var text = this._text.replace(/(?:\r\n|\r)/g, '\n') || ' ';
        var textLength = text.length;
        var maxWidth = this._maxWidth * data.size / this._fontSize;
        var prevCharCode = null;
        var lastLineWidth = 0;
        var maxLineWidth = 0;
        var line = 0;
        var lastBreakPos = -1;
        var lastBreakWidth = 0;
        var spacesRemoved = 0;
        var maxLineHeight = 0;
        var spaceCount = 0;
        for (var i = 0; i < textLength; i++) {
            var charCode = text.charCodeAt(i);
            var char = text.charAt(i);
            if ((/(?:\s)/).test(char)) {
                lastBreakPos = i;
                lastBreakWidth = lastLineWidth;
                spaceCount++;
            }
            if (char === '\r' || char === '\n') {
                lineWidths.push(lastLineWidth);
                lineSpaces.push(-1);
                maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
                ++line;
                ++spacesRemoved;
                pos.x = 0;
                pos.y += data.lineHeight;
                prevCharCode = null;
                spaceCount = 0;
                continue;
            }
            var charData = data.chars[charCode];
            if (!charData) {
                continue;
            }
            if (prevCharCode && charData.kerning[prevCharCode]) {
                pos.x += charData.kerning[prevCharCode];
            }
            var charRenderData = charRenderDataPool.pop() || {
                texture: Texture.EMPTY,
                line: 0,
                charCode: 0,
                prevSpaces: 0,
                position: new Point(),
            };
            charRenderData.texture = charData.texture;
            charRenderData.line = line;
            charRenderData.charCode = charCode;
            charRenderData.position.x = pos.x + charData.xOffset + (this._letterSpacing / 2);
            charRenderData.position.y = pos.y + charData.yOffset;
            charRenderData.prevSpaces = spaceCount;
            chars.push(charRenderData);
            lastLineWidth = charRenderData.position.x + charData.texture.orig.width; // Use charRenderData position!
            pos.x += charData.xAdvance + this._letterSpacing;
            maxLineHeight = Math.max(maxLineHeight, (charData.yOffset + charData.texture.height));
            prevCharCode = charCode;
            if (lastBreakPos !== -1 && maxWidth > 0 && pos.x > maxWidth) {
                ++spacesRemoved;
                removeItems(chars, 1 + lastBreakPos - spacesRemoved, 1 + i - lastBreakPos);
                i = lastBreakPos;
                lastBreakPos = -1;
                lineWidths.push(lastBreakWidth);
                lineSpaces.push(chars.length > 0 ? chars[chars.length - 1].prevSpaces : 0);
                maxLineWidth = Math.max(maxLineWidth, lastBreakWidth);
                line++;
                pos.x = 0;
                pos.y += data.lineHeight;
                prevCharCode = null;
                spaceCount = 0;
            }
        }
        var lastChar = text.charAt(text.length - 1);
        if (lastChar !== '\r' && lastChar !== '\n') {
            if ((/(?:\s)/).test(lastChar)) {
                lastLineWidth = lastBreakWidth;
            }
            lineWidths.push(lastLineWidth);
            maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
            lineSpaces.push(-1);
        }
        var lineAlignOffsets = [];
        for (var i = 0; i <= line; i++) {
            var alignOffset = 0;
            if (this._align === 'right') {
                alignOffset = maxLineWidth - lineWidths[i];
            }
            else if (this._align === 'center') {
                alignOffset = (maxLineWidth - lineWidths[i]) / 2;
            }
            else if (this._align === 'justify') {
                alignOffset = lineSpaces[i] < 0 ? 0 : (maxLineWidth - lineWidths[i]) / lineSpaces[i];
            }
            lineAlignOffsets.push(alignOffset);
        }
        var lenChars = chars.length;
        var pagesMeshData = {};
        var newPagesMeshData = [];
        var activePagesMeshData = this._activePagesMeshData;
        for (var i = 0; i < activePagesMeshData.length; i++) {
            pageMeshDataPool.push(activePagesMeshData[i]);
        }
        for (var i = 0; i < lenChars; i++) {
            var texture = chars[i].texture;
            var baseTextureUid = texture.baseTexture.uid;
            if (!pagesMeshData[baseTextureUid]) {
                var pageMeshData = pageMeshDataPool.pop();
                if (!pageMeshData) {
                    var geometry = new MeshGeometry();
                    var material = new MeshMaterial(Texture.EMPTY);
                    var mesh = new Mesh(geometry, material);
                    pageMeshData = {
                        index: 0,
                        indexCount: 0,
                        vertexCount: 0,
                        uvsCount: 0,
                        total: 0,
                        mesh: mesh,
                        vertices: null,
                        uvs: null,
                        indices: null,
                    };
                }
                // reset data..
                pageMeshData.index = 0;
                pageMeshData.indexCount = 0;
                pageMeshData.vertexCount = 0;
                pageMeshData.uvsCount = 0;
                pageMeshData.total = 0;
                // TODO need to get page texture here somehow..
                var _textureCache = this._textureCache;
                _textureCache[baseTextureUid] = _textureCache[baseTextureUid] || new Texture(texture.baseTexture);
                pageMeshData.mesh.texture = _textureCache[baseTextureUid];
                pageMeshData.mesh.tint = this._tint;
                newPagesMeshData.push(pageMeshData);
                pagesMeshData[baseTextureUid] = pageMeshData;
            }
            pagesMeshData[baseTextureUid].total++;
        }
        // lets find any previously active pageMeshDatas that are no longer required for
        // the updated text (if any), removed and return them to the pool.
        for (var i = 0; i < activePagesMeshData.length; i++) {
            if (newPagesMeshData.indexOf(activePagesMeshData[i]) === -1) {
                this.removeChild(activePagesMeshData[i].mesh);
            }
        }
        // next lets add any new meshes, that have not yet been added to this BitmapText
        // we only add if its not already a child of this BitmapObject
        for (var i = 0; i < newPagesMeshData.length; i++) {
            if (newPagesMeshData[i].mesh.parent !== this) {
                this.addChild(newPagesMeshData[i].mesh);
            }
        }
        // active page mesh datas are set to be the new pages added.
        this._activePagesMeshData = newPagesMeshData;
        for (var i in pagesMeshData) {
            var pageMeshData = pagesMeshData[i];
            var total = pageMeshData.total;
            // lets only allocate new buffers if we can fit the new text in the current ones..
            // unless that is, we will be batching. Currently batching dose not respect the size property of mesh
            if (!(((_a = pageMeshData.indices) === null || _a === void 0 ? void 0 : _a.length) > 6 * total) || pageMeshData.vertices.length < Mesh.BATCHABLE_SIZE * 2) {
                pageMeshData.vertices = new Float32Array(4 * 2 * total);
                pageMeshData.uvs = new Float32Array(4 * 2 * total);
                pageMeshData.indices = new Uint16Array(6 * total);
            }
            else {
                var total_1 = pageMeshData.total;
                var vertices = pageMeshData.vertices;
                // Clear the garbage at the end of the vertices buffer. This will prevent the bounds miscalculation.
                for (var i_1 = total_1 * 4 * 2; i_1 < vertices.length; i_1++) {
                    vertices[i_1] = 0;
                }
            }
            // as a buffer maybe bigger than the current word, we set the size of the meshMaterial
            // to match the number of letters needed
            pageMeshData.mesh.size = 6 * total;
        }
        for (var i = 0; i < lenChars; i++) {
            var char = chars[i];
            var offset = char.position.x + (lineAlignOffsets[char.line] * (this._align === 'justify' ? char.prevSpaces : 1));
            if (this._roundPixels) {
                offset = Math.round(offset);
            }
            var xPos = offset * scale;
            var yPos = char.position.y * scale;
            var texture = char.texture;
            var pageMesh = pagesMeshData[texture.baseTexture.uid];
            var textureFrame = texture.frame;
            var textureUvs = texture._uvs;
            var index = pageMesh.index++;
            pageMesh.indices[(index * 6) + 0] = 0 + (index * 4);
            pageMesh.indices[(index * 6) + 1] = 1 + (index * 4);
            pageMesh.indices[(index * 6) + 2] = 2 + (index * 4);
            pageMesh.indices[(index * 6) + 3] = 0 + (index * 4);
            pageMesh.indices[(index * 6) + 4] = 2 + (index * 4);
            pageMesh.indices[(index * 6) + 5] = 3 + (index * 4);
            pageMesh.vertices[(index * 8) + 0] = xPos;
            pageMesh.vertices[(index * 8) + 1] = yPos;
            pageMesh.vertices[(index * 8) + 2] = xPos + (textureFrame.width * scale);
            pageMesh.vertices[(index * 8) + 3] = yPos;
            pageMesh.vertices[(index * 8) + 4] = xPos + (textureFrame.width * scale);
            pageMesh.vertices[(index * 8) + 5] = yPos + (textureFrame.height * scale);
            pageMesh.vertices[(index * 8) + 6] = xPos;
            pageMesh.vertices[(index * 8) + 7] = yPos + (textureFrame.height * scale);
            pageMesh.uvs[(index * 8) + 0] = textureUvs.x0;
            pageMesh.uvs[(index * 8) + 1] = textureUvs.y0;
            pageMesh.uvs[(index * 8) + 2] = textureUvs.x1;
            pageMesh.uvs[(index * 8) + 3] = textureUvs.y1;
            pageMesh.uvs[(index * 8) + 4] = textureUvs.x2;
            pageMesh.uvs[(index * 8) + 5] = textureUvs.y2;
            pageMesh.uvs[(index * 8) + 6] = textureUvs.x3;
            pageMesh.uvs[(index * 8) + 7] = textureUvs.y3;
        }
        this._textWidth = maxLineWidth * scale;
        this._textHeight = (pos.y + data.lineHeight) * scale;
        for (var i in pagesMeshData) {
            var pageMeshData = pagesMeshData[i];
            // apply anchor
            if (this.anchor.x !== 0 || this.anchor.y !== 0) {
                var vertexCount = 0;
                var anchorOffsetX = this._textWidth * this.anchor.x;
                var anchorOffsetY = this._textHeight * this.anchor.y;
                for (var i_2 = 0; i_2 < pageMeshData.total; i_2++) {
                    pageMeshData.vertices[vertexCount++] -= anchorOffsetX;
                    pageMeshData.vertices[vertexCount++] -= anchorOffsetY;
                    pageMeshData.vertices[vertexCount++] -= anchorOffsetX;
                    pageMeshData.vertices[vertexCount++] -= anchorOffsetY;
                    pageMeshData.vertices[vertexCount++] -= anchorOffsetX;
                    pageMeshData.vertices[vertexCount++] -= anchorOffsetY;
                    pageMeshData.vertices[vertexCount++] -= anchorOffsetX;
                    pageMeshData.vertices[vertexCount++] -= anchorOffsetY;
                }
            }
            this._maxLineHeight = maxLineHeight * scale;
            var vertexBuffer = pageMeshData.mesh.geometry.getBuffer('aVertexPosition');
            var textureBuffer = pageMeshData.mesh.geometry.getBuffer('aTextureCoord');
            var indexBuffer = pageMeshData.mesh.geometry.getIndex();
            vertexBuffer.data = pageMeshData.vertices;
            textureBuffer.data = pageMeshData.uvs;
            indexBuffer.data = pageMeshData.indices;
            vertexBuffer.update();
            textureBuffer.update();
            indexBuffer.update();
        }
        for (var i = 0; i < chars.length; i++) {
            charRenderDataPool.push(chars[i]);
        }
    };
    /**
     * Updates the transform of this object
     *
     * @private
     */
    BitmapText.prototype.updateTransform = function () {
        this.validate();
        this.containerUpdateTransform();
    };
    /**
     * Validates text before calling parent's getLocalBounds
     *
     * @return {PIXI.Rectangle} The rectangular bounding area
     */
    BitmapText.prototype.getLocalBounds = function () {
        this.validate();
        return _super.prototype.getLocalBounds.call(this);
    };
    /**
     * Updates text when needed
     *
     * @private
     */
    BitmapText.prototype.validate = function () {
        if (this.dirty) {
            this.updateText();
            this.dirty = false;
        }
    };
    Object.defineProperty(BitmapText.prototype, "tint", {
        /**
         * The tint of the BitmapText object.
         *
         * @member {number}
         * @default 0xffffff
         */
        get: function () {
            return this._tint;
        },
        set: function (value) {
            if (this._tint === value)
                { return; }
            this._tint = value;
            for (var i = 0; i < this._activePagesMeshData.length; i++) {
                this._activePagesMeshData[i].mesh.tint = value;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "align", {
        /**
         * The alignment of the BitmapText object.
         *
         * @member {string}
         * @default 'left'
         */
        get: function () {
            return this._align;
        },
        set: function (value) {
            if (this._align !== value) {
                this._align = value;
                this.dirty = true;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "fontName", {
        /**
         * The name of the BitmapFont.
         *
         * @member {string}
         */
        get: function () {
            return this._fontName;
        },
        set: function (value) {
            if (!BitmapFont.available[value]) {
                throw new Error("Missing BitmapFont \"" + value + "\"");
            }
            if (this._fontName !== value) {
                this._fontName = value;
                this.dirty = true;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "fontSize", {
        /**
         * The size of the font to display.
         *
         * @member {number}
         */
        get: function () {
            return this._fontSize;
        },
        set: function (value) {
            if (this._fontSize !== value) {
                this._fontSize = value;
                this.dirty = true;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "anchor", {
        /**
         * The anchor sets the origin point of the text.
         *
         * The default is `(0,0)`, this means the text's origin is the top left.
         *
         * Setting the anchor to `(0.5,0.5)` means the text's origin is centered.
         *
         * Setting the anchor to `(1,1)` would mean the text's origin point will be the bottom right corner.
         *
         * @member {PIXI.Point | number}
         */
        get: function () {
            return this._anchor;
        },
        set: function (value) {
            if (typeof value === 'number') {
                this._anchor.set(value);
            }
            else {
                this._anchor.copyFrom(value);
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "text", {
        /**
         * The text of the BitmapText object.
         *
         * @member {string}
         */
        get: function () {
            return this._text;
        },
        set: function (text) {
            text = String(text === null || text === undefined ? '' : text);
            if (this._text === text) {
                return;
            }
            this._text = text;
            this.dirty = true;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "maxWidth", {
        /**
         * The max width of this bitmap text in pixels. If the text provided is longer than the
         * value provided, line breaks will be automatically inserted in the last whitespace.
         * Disable by setting the value to 0.
         *
         * @member {number}
         */
        get: function () {
            return this._maxWidth;
        },
        set: function (value) {
            if (this._maxWidth === value) {
                return;
            }
            this._maxWidth = value;
            this.dirty = true;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "maxLineHeight", {
        /**
         * The max line height. This is useful when trying to use the total height of the Text,
         * i.e. when trying to vertically align.
         *
         * @member {number}
         * @readonly
         */
        get: function () {
            this.validate();
            return this._maxLineHeight;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "textWidth", {
        /**
         * The width of the overall text, different from fontSize,
         * which is defined in the style object.
         *
         * @member {number}
         * @readonly
         */
        get: function () {
            this.validate();
            return this._textWidth;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "letterSpacing", {
        /**
         * Additional space between characters.
         *
         * @member {number}
         */
        get: function () {
            return this._letterSpacing;
        },
        set: function (value) {
            if (this._letterSpacing !== value) {
                this._letterSpacing = value;
                this.dirty = true;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "roundPixels", {
        /**
         * If true PixiJS will Math.floor() x/y values when rendering, stopping pixel interpolation.
         * Advantages can include sharper image quality (like text) and faster rendering on canvas.
         * The main disadvantage is movement of objects may appear less smooth.
         * To set the global default, change {@link PIXI.settings.ROUND_PIXELS}
         *
         * @member {boolean}
         * @default PIXI.settings.ROUND_PIXELS
         */
        get: function () {
            return this._roundPixels;
        },
        set: function (value) {
            if (value !== this._roundPixels) {
                this._roundPixels = value;
                this.dirty = true;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BitmapText.prototype, "textHeight", {
        /**
         * The height of the overall text, different from fontSize,
         * which is defined in the style object.
         *
         * @member {number}
         * @readonly
         */
        get: function () {
            this.validate();
            return this._textHeight;
        },
        enumerable: false,
        configurable: true
    });
    BitmapText.prototype.destroy = function (options) {
        var _textureCache = this._textureCache;
        for (var id in _textureCache) {
            var texture = _textureCache[id];
            texture.destroy();
            delete _textureCache[id];
        }
        this._textureCache = null;
        _super.prototype.destroy.call(this, options);
    };
    BitmapText.styleDefaults = {
        align: 'left',
        tint: 0xFFFFFF,
        maxWidth: 0,
        letterSpacing: 0,
    };
    return BitmapText;
}(Container));

/**
 * {@link PIXI.Loader Loader} middleware for loading
 * bitmap-based fonts suitable for using with {@link PIXI.BitmapText}.
 * @class
 * @memberof PIXI
 * @implements PIXI.ILoaderPlugin
 */
var BitmapFontLoader = /** @class */ (function () {
    function BitmapFontLoader() {
    }
    /**
     * Called when the plugin is installed.
     *
     * @see PIXI.Loader.registerPlugin
     */
    BitmapFontLoader.add = function () {
        LoaderResource.setExtensionXhrType('fnt', LoaderResource.XHR_RESPONSE_TYPE.TEXT);
    };
    /**
     * Called after a resource is loaded.
     * @see PIXI.Loader.loaderMiddleware
     * @param {PIXI.LoaderResource} resource
     * @param {function} next
     */
    BitmapFontLoader.use = function (resource, next) {
        var format = autoDetectFormat(resource.data);
        // Resource was not recognised as any of the expected font data format
        if (!format) {
            next();
            return;
        }
        var baseUrl = BitmapFontLoader.getBaseUrl(this, resource);
        var data = format.parse(resource.data);
        var textures = {};
        // Handle completed, when the number of textures
        // load is the same number as references in the fnt file
        var completed = function (page) {
            textures[page.metadata.pageFile] = page.texture;
            if (Object.keys(textures).length === data.page.length) {
                resource.bitmapFont = BitmapFont.install(data, textures, true);
                next();
            }
        };
        for (var i = 0; i < data.page.length; ++i) {
            var pageFile = data.page[i].file;
            var url = baseUrl + pageFile;
            var exists = false;
            // incase the image is loaded outside
            // using the same loader, resource will be available
            for (var name in this.resources) {
                var bitmapResource = this.resources[name];
                if (bitmapResource.url === url) {
                    bitmapResource.metadata.pageFile = pageFile;
                    if (bitmapResource.texture) {
                        completed(bitmapResource);
                    }
                    else {
                        bitmapResource.onAfterMiddleware.add(completed);
                    }
                    exists = true;
                    break;
                }
            }
            // texture is not loaded, we'll attempt to add
            // it to the load and add the texture to the list
            if (!exists) {
                // Standard loading options for images
                var options = {
                    crossOrigin: resource.crossOrigin,
                    loadType: LoaderResource.LOAD_TYPE.IMAGE,
                    metadata: Object.assign({ pageFile: pageFile }, resource.metadata.imageMetadata),
                    parentResource: resource,
                };
                this.add(url, options, completed);
            }
        }
    };
    /**
     * Get folder path from a resource
     * @private
     * @param {PIXI.Loader} loader
     * @param {PIXI.LoaderResource} resource
     * @return {string}
     */
    BitmapFontLoader.getBaseUrl = function (loader, resource) {
        var resUrl = !resource.isDataUrl ? BitmapFontLoader.dirname(resource.url) : '';
        if (resource.isDataUrl) {
            if (resUrl === '.') {
                resUrl = '';
            }
            if (loader.baseUrl && resUrl) {
                // if baseurl has a trailing slash then add one to resUrl so the replace works below
                if (loader.baseUrl.charAt(loader.baseUrl.length - 1) === '/') {
                    resUrl += '/';
                }
            }
        }
        // remove baseUrl from resUrl
        resUrl = resUrl.replace(loader.baseUrl, '');
        // if there is an resUrl now, it needs a trailing slash. Ensure that it does if the string isn't empty.
        if (resUrl && resUrl.charAt(resUrl.length - 1) !== '/') {
            resUrl += '/';
        }
        return resUrl;
    };
    /**
     * Replacement for NodeJS's path.dirname
     * @private
     * @param {string} url - Path to get directory for
     */
    BitmapFontLoader.dirname = function (url) {
        var dir = url
            .replace(/\\/g, '/') // convert windows notation to UNIX notation, URL-safe because it's a forbidden character
            .replace(/\/$/, '') // replace trailing slash
            .replace(/\/[^\/]*$/, ''); // remove everything after the last
        // File request is relative, use current directory
        if (dir === url) {
            return '.';
        }
        // Started with a slash
        else if (dir === '') {
            return '/';
        }
        return dir;
    };
    return BitmapFontLoader;
}());

/*!
 * @pixi/filter-color-matrix - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/filter-color-matrix is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$9 = function(d, b) {
    extendStatics$9 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$9(d, b);
};

function __extends$9(d, b) {
    extendStatics$9(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var fragment$3 = "varying vec2 vTextureCoord;\nuniform sampler2D uSampler;\nuniform float m[20];\nuniform float uAlpha;\n\nvoid main(void)\n{\n    vec4 c = texture2D(uSampler, vTextureCoord);\n\n    if (uAlpha == 0.0) {\n        gl_FragColor = c;\n        return;\n    }\n\n    // Un-premultiply alpha before applying the color matrix. See issue #3539.\n    if (c.a > 0.0) {\n      c.rgb /= c.a;\n    }\n\n    vec4 result;\n\n    result.r = (m[0] * c.r);\n        result.r += (m[1] * c.g);\n        result.r += (m[2] * c.b);\n        result.r += (m[3] * c.a);\n        result.r += m[4];\n\n    result.g = (m[5] * c.r);\n        result.g += (m[6] * c.g);\n        result.g += (m[7] * c.b);\n        result.g += (m[8] * c.a);\n        result.g += m[9];\n\n    result.b = (m[10] * c.r);\n       result.b += (m[11] * c.g);\n       result.b += (m[12] * c.b);\n       result.b += (m[13] * c.a);\n       result.b += m[14];\n\n    result.a = (m[15] * c.r);\n       result.a += (m[16] * c.g);\n       result.a += (m[17] * c.b);\n       result.a += (m[18] * c.a);\n       result.a += m[19];\n\n    vec3 rgb = mix(c.rgb, result.rgb, uAlpha);\n\n    // Premultiply alpha again.\n    rgb *= result.a;\n\n    gl_FragColor = vec4(rgb, result.a);\n}\n";

/**
 * The ColorMatrixFilter class lets you apply a 5x4 matrix transformation on the RGBA
 * color and alpha values of every pixel on your displayObject to produce a result
 * with a new set of RGBA color and alpha values. It's pretty powerful!
 *
 * ```js
 *  let colorMatrix = new PIXI.filters.ColorMatrixFilter();
 *  container.filters = [colorMatrix];
 *  colorMatrix.contrast(2);
 * ```
 * @author Clément Chenebault <clement@goodboydigital.com>
 * @class
 * @extends PIXI.Filter
 * @memberof PIXI.filters
 */
var ColorMatrixFilter = /** @class */ (function (_super) {
    __extends$9(ColorMatrixFilter, _super);
    function ColorMatrixFilter() {
        var _this = this;
        var uniforms = {
            m: new Float32Array([1, 0, 0, 0, 0,
                0, 1, 0, 0, 0,
                0, 0, 1, 0, 0,
                0, 0, 0, 1, 0]),
            uAlpha: 1,
        };
        _this = _super.call(this, defaultFilterVertex, fragment$3, uniforms) || this;
        _this.alpha = 1;
        return _this;
    }
    /**
     * Transforms current matrix and set the new one
     *
     * @param {number[]} matrix - 5x4 matrix
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype._loadMatrix = function (matrix, multiply) {
        if (multiply === void 0) { multiply = false; }
        var newMatrix = matrix;
        if (multiply) {
            this._multiply(newMatrix, this.uniforms.m, matrix);
            newMatrix = this._colorMatrix(newMatrix);
        }
        // set the new matrix
        this.uniforms.m = newMatrix;
    };
    /**
     * Multiplies two mat5's
     *
     * @private
     * @param {number[]} out - 5x4 matrix the receiving matrix
     * @param {number[]} a - 5x4 matrix the first operand
     * @param {number[]} b - 5x4 matrix the second operand
     * @returns {number[]} 5x4 matrix
     */
    ColorMatrixFilter.prototype._multiply = function (out, a, b) {
        // Red Channel
        out[0] = (a[0] * b[0]) + (a[1] * b[5]) + (a[2] * b[10]) + (a[3] * b[15]);
        out[1] = (a[0] * b[1]) + (a[1] * b[6]) + (a[2] * b[11]) + (a[3] * b[16]);
        out[2] = (a[0] * b[2]) + (a[1] * b[7]) + (a[2] * b[12]) + (a[3] * b[17]);
        out[3] = (a[0] * b[3]) + (a[1] * b[8]) + (a[2] * b[13]) + (a[3] * b[18]);
        out[4] = (a[0] * b[4]) + (a[1] * b[9]) + (a[2] * b[14]) + (a[3] * b[19]) + a[4];
        // Green Channel
        out[5] = (a[5] * b[0]) + (a[6] * b[5]) + (a[7] * b[10]) + (a[8] * b[15]);
        out[6] = (a[5] * b[1]) + (a[6] * b[6]) + (a[7] * b[11]) + (a[8] * b[16]);
        out[7] = (a[5] * b[2]) + (a[6] * b[7]) + (a[7] * b[12]) + (a[8] * b[17]);
        out[8] = (a[5] * b[3]) + (a[6] * b[8]) + (a[7] * b[13]) + (a[8] * b[18]);
        out[9] = (a[5] * b[4]) + (a[6] * b[9]) + (a[7] * b[14]) + (a[8] * b[19]) + a[9];
        // Blue Channel
        out[10] = (a[10] * b[0]) + (a[11] * b[5]) + (a[12] * b[10]) + (a[13] * b[15]);
        out[11] = (a[10] * b[1]) + (a[11] * b[6]) + (a[12] * b[11]) + (a[13] * b[16]);
        out[12] = (a[10] * b[2]) + (a[11] * b[7]) + (a[12] * b[12]) + (a[13] * b[17]);
        out[13] = (a[10] * b[3]) + (a[11] * b[8]) + (a[12] * b[13]) + (a[13] * b[18]);
        out[14] = (a[10] * b[4]) + (a[11] * b[9]) + (a[12] * b[14]) + (a[13] * b[19]) + a[14];
        // Alpha Channel
        out[15] = (a[15] * b[0]) + (a[16] * b[5]) + (a[17] * b[10]) + (a[18] * b[15]);
        out[16] = (a[15] * b[1]) + (a[16] * b[6]) + (a[17] * b[11]) + (a[18] * b[16]);
        out[17] = (a[15] * b[2]) + (a[16] * b[7]) + (a[17] * b[12]) + (a[18] * b[17]);
        out[18] = (a[15] * b[3]) + (a[16] * b[8]) + (a[17] * b[13]) + (a[18] * b[18]);
        out[19] = (a[15] * b[4]) + (a[16] * b[9]) + (a[17] * b[14]) + (a[18] * b[19]) + a[19];
        return out;
    };
    /**
     * Create a Float32 Array and normalize the offset component to 0-1
     *
     * @private
     * @param {number[]} matrix - 5x4 matrix
     * @return {number[]} 5x4 matrix with all values between 0-1
     */
    ColorMatrixFilter.prototype._colorMatrix = function (matrix) {
        // Create a Float32 Array and normalize the offset component to 0-1
        var m = new Float32Array(matrix);
        m[4] /= 255;
        m[9] /= 255;
        m[14] /= 255;
        m[19] /= 255;
        return m;
    };
    /**
     * Adjusts brightness
     *
     * @param {number} b - value of the brigthness (0-1, where 0 is black)
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.brightness = function (b, multiply) {
        var matrix = [
            b, 0, 0, 0, 0,
            0, b, 0, 0, 0,
            0, 0, b, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Sets each channel on the diagonal of the color matrix.
     * This can be used to achieve a tinting effect on Containers similar to the tint field of some
     * display objects like Sprite, Text, Graphics, and Mesh.
     *
     * @param {number} color - Color of the tint. This is a hex value.
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.tint = function (color, multiply) {
        var r = (color >> 16) & 0xff;
        var g = (color >> 8) & 0xff;
        var b = color & 0xff;
        var matrix = [
            r / 255, 0, 0, 0, 0,
            0, g / 255, 0, 0, 0,
            0, 0, b / 255, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Set the matrices in grey scales
     *
     * @param {number} scale - value of the grey (0-1, where 0 is black)
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.greyscale = function (scale, multiply) {
        var matrix = [
            scale, scale, scale, 0, 0,
            scale, scale, scale, 0, 0,
            scale, scale, scale, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Set the black and white matrice.
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.blackAndWhite = function (multiply) {
        var matrix = [
            0.3, 0.6, 0.1, 0, 0,
            0.3, 0.6, 0.1, 0, 0,
            0.3, 0.6, 0.1, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Set the hue property of the color
     *
     * @param {number} rotation - in degrees
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.hue = function (rotation, multiply) {
        rotation = (rotation || 0) / 180 * Math.PI;
        var cosR = Math.cos(rotation);
        var sinR = Math.sin(rotation);
        var sqrt = Math.sqrt;
        /* a good approximation for hue rotation
         This matrix is far better than the versions with magic luminance constants
         formerly used here, but also used in the starling framework (flash) and known from this
         old part of the internet: quasimondo.com/archives/000565.php

         This new matrix is based on rgb cube rotation in space. Look here for a more descriptive
         implementation as a shader not a general matrix:
         https://github.com/evanw/glfx.js/blob/58841c23919bd59787effc0333a4897b43835412/src/filters/adjust/huesaturation.js

         This is the source for the code:
         see http://stackoverflow.com/questions/8507885/shift-hue-of-an-rgb-color/8510751#8510751
         */
        var w = 1 / 3;
        var sqrW = sqrt(w); // weight is
        var a00 = cosR + ((1.0 - cosR) * w);
        var a01 = (w * (1.0 - cosR)) - (sqrW * sinR);
        var a02 = (w * (1.0 - cosR)) + (sqrW * sinR);
        var a10 = (w * (1.0 - cosR)) + (sqrW * sinR);
        var a11 = cosR + (w * (1.0 - cosR));
        var a12 = (w * (1.0 - cosR)) - (sqrW * sinR);
        var a20 = (w * (1.0 - cosR)) - (sqrW * sinR);
        var a21 = (w * (1.0 - cosR)) + (sqrW * sinR);
        var a22 = cosR + (w * (1.0 - cosR));
        var matrix = [
            a00, a01, a02, 0, 0,
            a10, a11, a12, 0, 0,
            a20, a21, a22, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Set the contrast matrix, increase the separation between dark and bright
     * Increase contrast : shadows darker and highlights brighter
     * Decrease contrast : bring the shadows up and the highlights down
     *
     * @param {number} amount - value of the contrast (0-1)
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.contrast = function (amount, multiply) {
        var v = (amount || 0) + 1;
        var o = -0.5 * (v - 1);
        var matrix = [
            v, 0, 0, 0, o,
            0, v, 0, 0, o,
            0, 0, v, 0, o,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Set the saturation matrix, increase the separation between colors
     * Increase saturation : increase contrast, brightness, and sharpness
     *
     * @param {number} amount - The saturation amount (0-1)
     * @param {boolean} [multiply] - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.saturate = function (amount, multiply) {
        if (amount === void 0) { amount = 0; }
        var x = (amount * 2 / 3) + 1;
        var y = ((x - 1) * -0.5);
        var matrix = [
            x, y, y, 0, 0,
            y, x, y, 0, 0,
            y, y, x, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Desaturate image (remove color)
     *
     * Call the saturate function
     *
     */
    ColorMatrixFilter.prototype.desaturate = function () {
        this.saturate(-1);
    };
    /**
     * Negative image (inverse of classic rgb matrix)
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.negative = function (multiply) {
        var matrix = [
            -1, 0, 0, 1, 0,
            0, -1, 0, 1, 0,
            0, 0, -1, 1, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Sepia image
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.sepia = function (multiply) {
        var matrix = [
            0.393, 0.7689999, 0.18899999, 0, 0,
            0.349, 0.6859999, 0.16799999, 0, 0,
            0.272, 0.5339999, 0.13099999, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Color motion picture process invented in 1916 (thanks Dominic Szablewski)
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.technicolor = function (multiply) {
        var matrix = [
            1.9125277891456083, -0.8545344976951645, -0.09155508482755585, 0, 11.793603434377337,
            -0.3087833385928097, 1.7658908555458428, -0.10601743074722245, 0, -70.35205161461398,
            -0.231103377548616, -0.7501899197440212, 1.847597816108189, 0, 30.950940869491138,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Polaroid filter
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.polaroid = function (multiply) {
        var matrix = [
            1.438, -0.062, -0.062, 0, 0,
            -0.122, 1.378, -0.122, 0, 0,
            -0.016, -0.016, 1.483, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Filter who transforms : Red -> Blue and Blue -> Red
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.toBGR = function (multiply) {
        var matrix = [
            0, 0, 1, 0, 0,
            0, 1, 0, 0, 0,
            1, 0, 0, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Color reversal film introduced by Eastman Kodak in 1935. (thanks Dominic Szablewski)
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.kodachrome = function (multiply) {
        var matrix = [
            1.1285582396593525, -0.3967382283601348, -0.03992559172921793, 0, 63.72958762196502,
            -0.16404339962244616, 1.0835251566291304, -0.05498805115633132, 0, 24.732407896706203,
            -0.16786010706155763, -0.5603416277695248, 1.6014850761964943, 0, 35.62982807460946,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Brown delicious browni filter (thanks Dominic Szablewski)
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.browni = function (multiply) {
        var matrix = [
            0.5997023498159715, 0.34553243048391263, -0.2708298674538042, 0, 47.43192855600873,
            -0.037703249837783157, 0.8609577587992641, 0.15059552388459913, 0, -36.96841498319127,
            0.24113635128153335, -0.07441037908422492, 0.44972182064877153, 0, -7.562075277591283,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Vintage filter (thanks Dominic Szablewski)
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.vintage = function (multiply) {
        var matrix = [
            0.6279345635605994, 0.3202183420819367, -0.03965408211312453, 0, 9.651285835294123,
            0.02578397704808868, 0.6441188644374771, 0.03259127616149294, 0, 7.462829176470591,
            0.0466055556782719, -0.0851232987247891, 0.5241648018700465, 0, 5.159190588235296,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * We don't know exactly what it does, kind of gradient map, but funny to play with!
     *
     * @param {number} desaturation - Tone values.
     * @param {number} toned - Tone values.
     * @param {number} lightColor - Tone values, example: `0xFFE580`
     * @param {number} darkColor - Tone values, example: `0xFFE580`
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.colorTone = function (desaturation, toned, lightColor, darkColor, multiply) {
        desaturation = desaturation || 0.2;
        toned = toned || 0.15;
        lightColor = lightColor || 0xFFE580;
        darkColor = darkColor || 0x338000;
        var lR = ((lightColor >> 16) & 0xFF) / 255;
        var lG = ((lightColor >> 8) & 0xFF) / 255;
        var lB = (lightColor & 0xFF) / 255;
        var dR = ((darkColor >> 16) & 0xFF) / 255;
        var dG = ((darkColor >> 8) & 0xFF) / 255;
        var dB = (darkColor & 0xFF) / 255;
        var matrix = [
            0.3, 0.59, 0.11, 0, 0,
            lR, lG, lB, desaturation, 0,
            dR, dG, dB, toned, 0,
            lR - dR, lG - dG, lB - dB, 0, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Night effect
     *
     * @param {number} intensity - The intensity of the night effect.
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.night = function (intensity, multiply) {
        intensity = intensity || 0.1;
        var matrix = [
            intensity * (-2.0), -intensity, 0, 0, 0,
            -intensity, 0, intensity, 0, 0,
            0, intensity, intensity * 2.0, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Predator effect
     *
     * Erase the current matrix by setting a new indepent one
     *
     * @param {number} amount - how much the predator feels his future victim
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.predator = function (amount, multiply) {
        var matrix = [
            // row 1
            11.224130630493164 * amount,
            -4.794486999511719 * amount,
            -2.8746118545532227 * amount,
            0 * amount,
            0.40342438220977783 * amount,
            // row 2
            -3.6330697536468506 * amount,
            9.193157196044922 * amount,
            -2.951810836791992 * amount,
            0 * amount,
            -1.316135048866272 * amount,
            // row 3
            -3.2184197902679443 * amount,
            -4.2375030517578125 * amount,
            7.476448059082031 * amount,
            0 * amount,
            0.8044459223747253 * amount,
            // row 4
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * LSD effect
     *
     * Multiply the current matrix
     *
     * @param {boolean} multiply - if true, current matrix and matrix are multiplied. If false,
     *  just set the current matrix with @param matrix
     */
    ColorMatrixFilter.prototype.lsd = function (multiply) {
        var matrix = [
            2, -0.4, 0.5, 0, 0,
            -0.5, 2, -0.4, 0, 0,
            -0.4, -0.5, 3, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, multiply);
    };
    /**
     * Erase the current matrix by setting the default one
     *
     */
    ColorMatrixFilter.prototype.reset = function () {
        var matrix = [
            1, 0, 0, 0, 0,
            0, 1, 0, 0, 0,
            0, 0, 1, 0, 0,
            0, 0, 0, 1, 0 ];
        this._loadMatrix(matrix, false);
    };
    Object.defineProperty(ColorMatrixFilter.prototype, "matrix", {
        /**
         * The matrix of the color matrix filter
         *
         * @member {number[]}
         * @default [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]
         */
        get: function () {
            return this.uniforms.m;
        },
        set: function (value) {
            this.uniforms.m = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ColorMatrixFilter.prototype, "alpha", {
        /**
         * The opacity value to use when mixing the original and resultant colors.
         *
         * When the value is 0, the original color is used without modification.
         * When the value is 1, the result color is used.
         * When in the range (0, 1) the color is interpolated between the original and result by this amount.
         *
         * @member {number}
         * @default 1
         */
        get: function () {
            return this.uniforms.uAlpha;
        },
        set: function (value) {
            this.uniforms.uAlpha = value;
        },
        enumerable: false,
        configurable: true
    });
    return ColorMatrixFilter;
}(Filter));
// Americanized alias
ColorMatrixFilter.prototype.grayscale = ColorMatrixFilter.prototype.greyscale;

/*!
 * @pixi/filter-displacement - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/filter-displacement is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$a = function(d, b) {
    extendStatics$a = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$a(d, b);
};

function __extends$a(d, b) {
    extendStatics$a(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var fragment$4 = "varying vec2 vFilterCoord;\nvarying vec2 vTextureCoord;\n\nuniform vec2 scale;\nuniform mat2 rotation;\nuniform sampler2D uSampler;\nuniform sampler2D mapSampler;\n\nuniform highp vec4 inputSize;\nuniform vec4 inputClamp;\n\nvoid main(void)\n{\n  vec4 map =  texture2D(mapSampler, vFilterCoord);\n\n  map -= 0.5;\n  map.xy = scale * inputSize.zw * (rotation * map.xy);\n\n  gl_FragColor = texture2D(uSampler, clamp(vec2(vTextureCoord.x + map.x, vTextureCoord.y + map.y), inputClamp.xy, inputClamp.zw));\n}\n";

var vertex$3 = "attribute vec2 aVertexPosition;\n\nuniform mat3 projectionMatrix;\nuniform mat3 filterMatrix;\n\nvarying vec2 vTextureCoord;\nvarying vec2 vFilterCoord;\n\nuniform vec4 inputSize;\nuniform vec4 outputFrame;\n\nvec4 filterVertexPosition( void )\n{\n    vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.)) + outputFrame.xy;\n\n    return vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);\n}\n\nvec2 filterTextureCoord( void )\n{\n    return aVertexPosition * (outputFrame.zw * inputSize.zw);\n}\n\nvoid main(void)\n{\n\tgl_Position = filterVertexPosition();\n\tvTextureCoord = filterTextureCoord();\n\tvFilterCoord = ( filterMatrix * vec3( vTextureCoord, 1.0)  ).xy;\n}\n";

/**
 * The DisplacementFilter class uses the pixel values from the specified texture
 * (called the displacement map) to perform a displacement of an object.
 *
 * You can use this filter to apply all manor of crazy warping effects.
 * Currently the `r` property of the texture is used to offset the `x`
 * and the `g` property of the texture is used to offset the `y`.
 *
 * The way it works is it uses the values of the displacement map to look up the
 * correct pixels to output. This means it's not technically moving the original.
 * Instead, it's starting at the output and asking "which pixel from the original goes here".
 * For example, if a displacement map pixel has `red = 1` and the filter scale is `20`,
 * this filter will output the pixel approximately 20 pixels to the right of the original.
 *
 * @class
 * @extends PIXI.Filter
 * @memberof PIXI.filters
 */
var DisplacementFilter = /** @class */ (function (_super) {
    __extends$a(DisplacementFilter, _super);
    /**
     * @param {PIXI.Sprite} sprite - The sprite used for the displacement map. (make sure its added to the scene!)
     * @param {number} [scale] - The scale of the displacement
     */
    function DisplacementFilter(sprite, scale) {
        var _this = this;
        var maskMatrix = new Matrix();
        sprite.renderable = false;
        _this = _super.call(this, vertex$3, fragment$4, {
            mapSampler: sprite._texture,
            filterMatrix: maskMatrix,
            scale: { x: 1, y: 1 },
            rotation: new Float32Array([1, 0, 0, 1]),
        }) || this;
        _this.maskSprite = sprite;
        _this.maskMatrix = maskMatrix;
        if (scale === null || scale === undefined) {
            scale = 20;
        }
        /**
         * scaleX, scaleY for displacements
         * @member {PIXI.Point}
         */
        _this.scale = new Point(scale, scale);
        return _this;
    }
    /**
     * Applies the filter.
     *
     * @param {PIXI.FilterSystem} filterManager - The manager.
     * @param {PIXI.RenderTexture} input - The input target.
     * @param {PIXI.RenderTexture} output - The output target.
     * @param {PIXI.CLEAR_MODES} clearMode - clearMode.
     */
    DisplacementFilter.prototype.apply = function (filterManager, input, output, clearMode) {
        // fill maskMatrix with _normalized sprite texture coords_
        this.uniforms.filterMatrix = filterManager.calculateSpriteMatrix(this.maskMatrix, this.maskSprite);
        this.uniforms.scale.x = this.scale.x;
        this.uniforms.scale.y = this.scale.y;
        // Extract rotation from world transform
        var wt = this.maskSprite.worldTransform;
        var lenX = Math.sqrt((wt.a * wt.a) + (wt.b * wt.b));
        var lenY = Math.sqrt((wt.c * wt.c) + (wt.d * wt.d));
        if (lenX !== 0 && lenY !== 0) {
            this.uniforms.rotation[0] = wt.a / lenX;
            this.uniforms.rotation[1] = wt.b / lenX;
            this.uniforms.rotation[2] = wt.c / lenY;
            this.uniforms.rotation[3] = wt.d / lenY;
        }
        // draw the filter...
        filterManager.applyFilter(this, input, output, clearMode);
    };
    Object.defineProperty(DisplacementFilter.prototype, "map", {
        /**
         * The texture used for the displacement map. Must be power of 2 sized texture.
         *
         * @member {PIXI.Texture}
         */
        get: function () {
            return this.uniforms.mapSampler;
        },
        set: function (value) {
            this.uniforms.mapSampler = value;
        },
        enumerable: false,
        configurable: true
    });
    return DisplacementFilter;
}(Filter));

/*!
 * @pixi/filter-fxaa - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/filter-fxaa is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$b = function(d, b) {
    extendStatics$b = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$b(d, b);
};

function __extends$b(d, b) {
    extendStatics$b(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var vertex$4 = "\nattribute vec2 aVertexPosition;\n\nuniform mat3 projectionMatrix;\n\nvarying vec2 v_rgbNW;\nvarying vec2 v_rgbNE;\nvarying vec2 v_rgbSW;\nvarying vec2 v_rgbSE;\nvarying vec2 v_rgbM;\n\nvarying vec2 vFragCoord;\n\nuniform vec4 inputSize;\nuniform vec4 outputFrame;\n\nvec4 filterVertexPosition( void )\n{\n    vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.)) + outputFrame.xy;\n\n    return vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);\n}\n\nvoid texcoords(vec2 fragCoord, vec2 inverseVP,\n               out vec2 v_rgbNW, out vec2 v_rgbNE,\n               out vec2 v_rgbSW, out vec2 v_rgbSE,\n               out vec2 v_rgbM) {\n    v_rgbNW = (fragCoord + vec2(-1.0, -1.0)) * inverseVP;\n    v_rgbNE = (fragCoord + vec2(1.0, -1.0)) * inverseVP;\n    v_rgbSW = (fragCoord + vec2(-1.0, 1.0)) * inverseVP;\n    v_rgbSE = (fragCoord + vec2(1.0, 1.0)) * inverseVP;\n    v_rgbM = vec2(fragCoord * inverseVP);\n}\n\nvoid main(void) {\n\n   gl_Position = filterVertexPosition();\n\n   vFragCoord = aVertexPosition * outputFrame.zw;\n\n   texcoords(vFragCoord, inputSize.zw, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);\n}\n";

var fragment$5 = "varying vec2 v_rgbNW;\nvarying vec2 v_rgbNE;\nvarying vec2 v_rgbSW;\nvarying vec2 v_rgbSE;\nvarying vec2 v_rgbM;\n\nvarying vec2 vFragCoord;\nuniform sampler2D uSampler;\nuniform highp vec4 inputSize;\n\n\n/**\n Basic FXAA implementation based on the code on geeks3d.com with the\n modification that the texture2DLod stuff was removed since it's\n unsupported by WebGL.\n\n --\n\n From:\n https://github.com/mitsuhiko/webgl-meincraft\n\n Copyright (c) 2011 by Armin Ronacher.\n\n Some rights reserved.\n\n Redistribution and use in source and binary forms, with or without\n modification, are permitted provided that the following conditions are\n met:\n\n * Redistributions of source code must retain the above copyright\n notice, this list of conditions and the following disclaimer.\n\n * Redistributions in binary form must reproduce the above\n copyright notice, this list of conditions and the following\n disclaimer in the documentation and/or other materials provided\n with the distribution.\n\n * The names of the contributors may not be used to endorse or\n promote products derived from this software without specific\n prior written permission.\n\n THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS\n \"AS IS\" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT\n LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR\n A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT\n OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,\n SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT\n LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,\n DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY\n THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT\n (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\n OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\n */\n\n#ifndef FXAA_REDUCE_MIN\n#define FXAA_REDUCE_MIN   (1.0/ 128.0)\n#endif\n#ifndef FXAA_REDUCE_MUL\n#define FXAA_REDUCE_MUL   (1.0 / 8.0)\n#endif\n#ifndef FXAA_SPAN_MAX\n#define FXAA_SPAN_MAX     8.0\n#endif\n\n//optimized version for mobile, where dependent\n//texture reads can be a bottleneck\nvec4 fxaa(sampler2D tex, vec2 fragCoord, vec2 inverseVP,\n          vec2 v_rgbNW, vec2 v_rgbNE,\n          vec2 v_rgbSW, vec2 v_rgbSE,\n          vec2 v_rgbM) {\n    vec4 color;\n    vec3 rgbNW = texture2D(tex, v_rgbNW).xyz;\n    vec3 rgbNE = texture2D(tex, v_rgbNE).xyz;\n    vec3 rgbSW = texture2D(tex, v_rgbSW).xyz;\n    vec3 rgbSE = texture2D(tex, v_rgbSE).xyz;\n    vec4 texColor = texture2D(tex, v_rgbM);\n    vec3 rgbM  = texColor.xyz;\n    vec3 luma = vec3(0.299, 0.587, 0.114);\n    float lumaNW = dot(rgbNW, luma);\n    float lumaNE = dot(rgbNE, luma);\n    float lumaSW = dot(rgbSW, luma);\n    float lumaSE = dot(rgbSE, luma);\n    float lumaM  = dot(rgbM,  luma);\n    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));\n    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));\n\n    mediump vec2 dir;\n    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));\n    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));\n\n    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) *\n                          (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);\n\n    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);\n    dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),\n              max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),\n                  dir * rcpDirMin)) * inverseVP;\n\n    vec3 rgbA = 0.5 * (\n                       texture2D(tex, fragCoord * inverseVP + dir * (1.0 / 3.0 - 0.5)).xyz +\n                       texture2D(tex, fragCoord * inverseVP + dir * (2.0 / 3.0 - 0.5)).xyz);\n    vec3 rgbB = rgbA * 0.5 + 0.25 * (\n                                     texture2D(tex, fragCoord * inverseVP + dir * -0.5).xyz +\n                                     texture2D(tex, fragCoord * inverseVP + dir * 0.5).xyz);\n\n    float lumaB = dot(rgbB, luma);\n    if ((lumaB < lumaMin) || (lumaB > lumaMax))\n        color = vec4(rgbA, texColor.a);\n    else\n        color = vec4(rgbB, texColor.a);\n    return color;\n}\n\nvoid main() {\n\n      vec4 color;\n\n      color = fxaa(uSampler, vFragCoord, inputSize.zw, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);\n\n      gl_FragColor = color;\n}\n";

/**
 * Basic FXAA (Fast Approximate Anti-Aliasing) implementation based on the code on geeks3d.com
 * with the modification that the texture2DLod stuff was removed since it is unsupported by WebGL.
 *
 * @see https://github.com/mitsuhiko/webgl-meincraft
 *
 * @class
 * @extends PIXI.Filter
 * @memberof PIXI.filters
 *
 */
var FXAAFilter = /** @class */ (function (_super) {
    __extends$b(FXAAFilter, _super);
    function FXAAFilter() {
        // TODO - needs work
        return _super.call(this, vertex$4, fragment$5) || this;
    }
    return FXAAFilter;
}(Filter));

/*!
 * @pixi/filter-noise - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/filter-noise is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$c = function(d, b) {
    extendStatics$c = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$c(d, b);
};

function __extends$c(d, b) {
    extendStatics$c(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var fragment$6 = "precision highp float;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nuniform float uNoise;\nuniform float uSeed;\nuniform sampler2D uSampler;\n\nfloat rand(vec2 co)\n{\n    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);\n}\n\nvoid main()\n{\n    vec4 color = texture2D(uSampler, vTextureCoord);\n    float randomValue = rand(gl_FragCoord.xy * uSeed);\n    float diff = (randomValue - 0.5) * uNoise;\n\n    // Un-premultiply alpha before applying the color matrix. See issue #3539.\n    if (color.a > 0.0) {\n        color.rgb /= color.a;\n    }\n\n    color.r += diff;\n    color.g += diff;\n    color.b += diff;\n\n    // Premultiply alpha again.\n    color.rgb *= color.a;\n\n    gl_FragColor = color;\n}\n";

/**
 * A Noise effect filter.
 *
 * original filter: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/noise.js
 *
 * @class
 * @extends PIXI.Filter
 * @memberof PIXI.filters
 * @author Vico @vicocotea
 */
var NoiseFilter = /** @class */ (function (_super) {
    __extends$c(NoiseFilter, _super);
    /**
     * @param {number} [noise=0.5] - The noise intensity, should be a normalized value in the range [0, 1].
     * @param {number} [seed] - A random seed for the noise generation. Default is `Math.random()`.
     */
    function NoiseFilter(noise, seed) {
        if (noise === void 0) { noise = 0.5; }
        if (seed === void 0) { seed = Math.random(); }
        var _this = _super.call(this, defaultFilterVertex, fragment$6, {
            uNoise: 0,
            uSeed: 0,
        }) || this;
        _this.noise = noise;
        _this.seed = seed;
        return _this;
    }
    Object.defineProperty(NoiseFilter.prototype, "noise", {
        /**
         * The amount of noise to apply, this value should be in the range (0, 1].
         *
         * @member {number}
         * @default 0.5
         */
        get: function () {
            return this.uniforms.uNoise;
        },
        set: function (value) {
            this.uniforms.uNoise = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NoiseFilter.prototype, "seed", {
        /**
         * A seed value to apply to the random noise generation. `Math.random()` is a good value to use.
         *
         * @member {number}
         */
        get: function () {
            return this.uniforms.uSeed;
        },
        set: function (value) {
            this.uniforms.uSeed = value;
        },
        enumerable: false,
        configurable: true
    });
    return NoiseFilter;
}(Filter));

/*!
 * @pixi/mixin-cache-as-bitmap - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/mixin-cache-as-bitmap is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*!
 * @pixi/constants - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/constants is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */
/**
 * Different types of environments for WebGL.
 *
 * @static
 * @memberof PIXI
 * @name ENV
 * @enum {number}
 * @property {number} WEBGL_LEGACY - Used for older v1 WebGL devices. PixiJS will aim to ensure compatibility
 *  with older / less advanced devices. If you experience unexplained flickering prefer this environment.
 * @property {number} WEBGL - Version 1 of WebGL
 * @property {number} WEBGL2 - Version 2 of WebGL
 */
var ENV;
(function (ENV) {
    ENV[ENV["WEBGL_LEGACY"] = 0] = "WEBGL_LEGACY";
    ENV[ENV["WEBGL"] = 1] = "WEBGL";
    ENV[ENV["WEBGL2"] = 2] = "WEBGL2";
})(ENV || (ENV = {}));
/**
 * Constant to identify the Renderer Type.
 *
 * @static
 * @memberof PIXI
 * @name RENDERER_TYPE
 * @enum {number}
 * @property {number} UNKNOWN - Unknown render type.
 * @property {number} WEBGL - WebGL render type.
 * @property {number} CANVAS - Canvas render type.
 */
var RENDERER_TYPE;
(function (RENDERER_TYPE) {
    RENDERER_TYPE[RENDERER_TYPE["UNKNOWN"] = 0] = "UNKNOWN";
    RENDERER_TYPE[RENDERER_TYPE["WEBGL"] = 1] = "WEBGL";
    RENDERER_TYPE[RENDERER_TYPE["CANVAS"] = 2] = "CANVAS";
})(RENDERER_TYPE || (RENDERER_TYPE = {}));
/**
 * Bitwise OR of masks that indicate the buffers to be cleared.
 *
 * @static
 * @memberof PIXI
 * @name BUFFER_BITS
 * @enum {number}
 * @property {number} COLOR - Indicates the buffers currently enabled for color writing.
 * @property {number} DEPTH - Indicates the depth buffer.
 * @property {number} STENCIL - Indicates the stencil buffer.
 */
var BUFFER_BITS;
(function (BUFFER_BITS) {
    BUFFER_BITS[BUFFER_BITS["COLOR"] = 16384] = "COLOR";
    BUFFER_BITS[BUFFER_BITS["DEPTH"] = 256] = "DEPTH";
    BUFFER_BITS[BUFFER_BITS["STENCIL"] = 1024] = "STENCIL";
})(BUFFER_BITS || (BUFFER_BITS = {}));
/**
 * Various blend modes supported by PIXI.
 *
 * IMPORTANT - The WebGL renderer only supports the NORMAL, ADD, MULTIPLY and SCREEN blend modes.
 * Anything else will silently act like NORMAL.
 *
 * @memberof PIXI
 * @name BLEND_MODES
 * @enum {number}
 * @property {number} NORMAL
 * @property {number} ADD
 * @property {number} MULTIPLY
 * @property {number} SCREEN
 * @property {number} OVERLAY
 * @property {number} DARKEN
 * @property {number} LIGHTEN
 * @property {number} COLOR_DODGE
 * @property {number} COLOR_BURN
 * @property {number} HARD_LIGHT
 * @property {number} SOFT_LIGHT
 * @property {number} DIFFERENCE
 * @property {number} EXCLUSION
 * @property {number} HUE
 * @property {number} SATURATION
 * @property {number} COLOR
 * @property {number} LUMINOSITY
 * @property {number} NORMAL_NPM
 * @property {number} ADD_NPM
 * @property {number} SCREEN_NPM
 * @property {number} NONE
 * @property {number} SRC_IN
 * @property {number} SRC_OUT
 * @property {number} SRC_ATOP
 * @property {number} DST_OVER
 * @property {number} DST_IN
 * @property {number} DST_OUT
 * @property {number} DST_ATOP
 * @property {number} SUBTRACT
 * @property {number} SRC_OVER
 * @property {number} ERASE
 * @property {number} XOR
 */
var BLEND_MODES;
(function (BLEND_MODES) {
    BLEND_MODES[BLEND_MODES["NORMAL"] = 0] = "NORMAL";
    BLEND_MODES[BLEND_MODES["ADD"] = 1] = "ADD";
    BLEND_MODES[BLEND_MODES["MULTIPLY"] = 2] = "MULTIPLY";
    BLEND_MODES[BLEND_MODES["SCREEN"] = 3] = "SCREEN";
    BLEND_MODES[BLEND_MODES["OVERLAY"] = 4] = "OVERLAY";
    BLEND_MODES[BLEND_MODES["DARKEN"] = 5] = "DARKEN";
    BLEND_MODES[BLEND_MODES["LIGHTEN"] = 6] = "LIGHTEN";
    BLEND_MODES[BLEND_MODES["COLOR_DODGE"] = 7] = "COLOR_DODGE";
    BLEND_MODES[BLEND_MODES["COLOR_BURN"] = 8] = "COLOR_BURN";
    BLEND_MODES[BLEND_MODES["HARD_LIGHT"] = 9] = "HARD_LIGHT";
    BLEND_MODES[BLEND_MODES["SOFT_LIGHT"] = 10] = "SOFT_LIGHT";
    BLEND_MODES[BLEND_MODES["DIFFERENCE"] = 11] = "DIFFERENCE";
    BLEND_MODES[BLEND_MODES["EXCLUSION"] = 12] = "EXCLUSION";
    BLEND_MODES[BLEND_MODES["HUE"] = 13] = "HUE";
    BLEND_MODES[BLEND_MODES["SATURATION"] = 14] = "SATURATION";
    BLEND_MODES[BLEND_MODES["COLOR"] = 15] = "COLOR";
    BLEND_MODES[BLEND_MODES["LUMINOSITY"] = 16] = "LUMINOSITY";
    BLEND_MODES[BLEND_MODES["NORMAL_NPM"] = 17] = "NORMAL_NPM";
    BLEND_MODES[BLEND_MODES["ADD_NPM"] = 18] = "ADD_NPM";
    BLEND_MODES[BLEND_MODES["SCREEN_NPM"] = 19] = "SCREEN_NPM";
    BLEND_MODES[BLEND_MODES["NONE"] = 20] = "NONE";
    BLEND_MODES[BLEND_MODES["SRC_OVER"] = 0] = "SRC_OVER";
    BLEND_MODES[BLEND_MODES["SRC_IN"] = 21] = "SRC_IN";
    BLEND_MODES[BLEND_MODES["SRC_OUT"] = 22] = "SRC_OUT";
    BLEND_MODES[BLEND_MODES["SRC_ATOP"] = 23] = "SRC_ATOP";
    BLEND_MODES[BLEND_MODES["DST_OVER"] = 24] = "DST_OVER";
    BLEND_MODES[BLEND_MODES["DST_IN"] = 25] = "DST_IN";
    BLEND_MODES[BLEND_MODES["DST_OUT"] = 26] = "DST_OUT";
    BLEND_MODES[BLEND_MODES["DST_ATOP"] = 27] = "DST_ATOP";
    BLEND_MODES[BLEND_MODES["ERASE"] = 26] = "ERASE";
    BLEND_MODES[BLEND_MODES["SUBTRACT"] = 28] = "SUBTRACT";
    BLEND_MODES[BLEND_MODES["XOR"] = 29] = "XOR";
})(BLEND_MODES || (BLEND_MODES = {}));
/**
 * Various webgl draw modes. These can be used to specify which GL drawMode to use
 * under certain situations and renderers.
 *
 * @memberof PIXI
 * @static
 * @name DRAW_MODES
 * @enum {number}
 * @property {number} POINTS
 * @property {number} LINES
 * @property {number} LINE_LOOP
 * @property {number} LINE_STRIP
 * @property {number} TRIANGLES
 * @property {number} TRIANGLE_STRIP
 * @property {number} TRIANGLE_FAN
 */
var DRAW_MODES;
(function (DRAW_MODES) {
    DRAW_MODES[DRAW_MODES["POINTS"] = 0] = "POINTS";
    DRAW_MODES[DRAW_MODES["LINES"] = 1] = "LINES";
    DRAW_MODES[DRAW_MODES["LINE_LOOP"] = 2] = "LINE_LOOP";
    DRAW_MODES[DRAW_MODES["LINE_STRIP"] = 3] = "LINE_STRIP";
    DRAW_MODES[DRAW_MODES["TRIANGLES"] = 4] = "TRIANGLES";
    DRAW_MODES[DRAW_MODES["TRIANGLE_STRIP"] = 5] = "TRIANGLE_STRIP";
    DRAW_MODES[DRAW_MODES["TRIANGLE_FAN"] = 6] = "TRIANGLE_FAN";
})(DRAW_MODES || (DRAW_MODES = {}));
/**
 * Various GL texture/resources formats.
 *
 * @memberof PIXI
 * @static
 * @name FORMATS
 * @enum {number}
 * @property {number} RGBA=6408
 * @property {number} RGB=6407
 * @property {number} RG=33319
 * @property {number} RED=6403
 * @property {number} RGBA_INTEGER=36249
 * @property {number} RGB_INTEGER=36248
 * @property {number} RG_INTEGER=33320
 * @property {number} RED_INTEGER=36244
 * @property {number} ALPHA=6406
 * @property {number} LUMINANCE=6409
 * @property {number} LUMINANCE_ALPHA=6410
 * @property {number} DEPTH_COMPONENT=6402
 * @property {number} DEPTH_STENCIL=34041
 */
var FORMATS;
(function (FORMATS) {
    FORMATS[FORMATS["RGBA"] = 6408] = "RGBA";
    FORMATS[FORMATS["RGB"] = 6407] = "RGB";
    FORMATS[FORMATS["RG"] = 33319] = "RG";
    FORMATS[FORMATS["RED"] = 6403] = "RED";
    FORMATS[FORMATS["RGBA_INTEGER"] = 36249] = "RGBA_INTEGER";
    FORMATS[FORMATS["RGB_INTEGER"] = 36248] = "RGB_INTEGER";
    FORMATS[FORMATS["RG_INTEGER"] = 33320] = "RG_INTEGER";
    FORMATS[FORMATS["RED_INTEGER"] = 36244] = "RED_INTEGER";
    FORMATS[FORMATS["ALPHA"] = 6406] = "ALPHA";
    FORMATS[FORMATS["LUMINANCE"] = 6409] = "LUMINANCE";
    FORMATS[FORMATS["LUMINANCE_ALPHA"] = 6410] = "LUMINANCE_ALPHA";
    FORMATS[FORMATS["DEPTH_COMPONENT"] = 6402] = "DEPTH_COMPONENT";
    FORMATS[FORMATS["DEPTH_STENCIL"] = 34041] = "DEPTH_STENCIL";
})(FORMATS || (FORMATS = {}));
/**
 * Various GL target types.
 *
 * @memberof PIXI
 * @static
 * @name TARGETS
 * @enum {number}
 * @property {number} TEXTURE_2D=3553
 * @property {number} TEXTURE_CUBE_MAP=34067
 * @property {number} TEXTURE_2D_ARRAY=35866
 * @property {number} TEXTURE_CUBE_MAP_POSITIVE_X=34069
 * @property {number} TEXTURE_CUBE_MAP_NEGATIVE_X=34070
 * @property {number} TEXTURE_CUBE_MAP_POSITIVE_Y=34071
 * @property {number} TEXTURE_CUBE_MAP_NEGATIVE_Y=34072
 * @property {number} TEXTURE_CUBE_MAP_POSITIVE_Z=34073
 * @property {number} TEXTURE_CUBE_MAP_NEGATIVE_Z=34074
 */
var TARGETS;
(function (TARGETS) {
    TARGETS[TARGETS["TEXTURE_2D"] = 3553] = "TEXTURE_2D";
    TARGETS[TARGETS["TEXTURE_CUBE_MAP"] = 34067] = "TEXTURE_CUBE_MAP";
    TARGETS[TARGETS["TEXTURE_2D_ARRAY"] = 35866] = "TEXTURE_2D_ARRAY";
    TARGETS[TARGETS["TEXTURE_CUBE_MAP_POSITIVE_X"] = 34069] = "TEXTURE_CUBE_MAP_POSITIVE_X";
    TARGETS[TARGETS["TEXTURE_CUBE_MAP_NEGATIVE_X"] = 34070] = "TEXTURE_CUBE_MAP_NEGATIVE_X";
    TARGETS[TARGETS["TEXTURE_CUBE_MAP_POSITIVE_Y"] = 34071] = "TEXTURE_CUBE_MAP_POSITIVE_Y";
    TARGETS[TARGETS["TEXTURE_CUBE_MAP_NEGATIVE_Y"] = 34072] = "TEXTURE_CUBE_MAP_NEGATIVE_Y";
    TARGETS[TARGETS["TEXTURE_CUBE_MAP_POSITIVE_Z"] = 34073] = "TEXTURE_CUBE_MAP_POSITIVE_Z";
    TARGETS[TARGETS["TEXTURE_CUBE_MAP_NEGATIVE_Z"] = 34074] = "TEXTURE_CUBE_MAP_NEGATIVE_Z";
})(TARGETS || (TARGETS = {}));
/**
 * Various GL data format types.
 *
 * @memberof PIXI
 * @static
 * @name TYPES
 * @enum {number}
 * @property {number} UNSIGNED_BYTE=5121
 * @property {number} UNSIGNED_SHORT=5123
 * @property {number} UNSIGNED_SHORT_5_6_5=33635
 * @property {number} UNSIGNED_SHORT_4_4_4_4=32819
 * @property {number} UNSIGNED_SHORT_5_5_5_1=32820
 * @property {number} UNSIGNED_INT=5125
 * @property {number} UNSIGNED_INT_10F_11F_11F_REV=35899
 * @property {number} UNSIGNED_INT_2_10_10_10_REV=33640
 * @property {number} UNSIGNED_INT_24_8=34042
 * @property {number} UNSIGNED_INT_5_9_9_9_REV=35902
 * @property {number} BYTE=5120
 * @property {number} SHORT=5122
 * @property {number} INT=5124
 * @property {number} FLOAT=5126
 * @property {number} FLOAT_32_UNSIGNED_INT_24_8_REV=36269
 * @property {number} HALF_FLOAT=36193
 */
var TYPES;
(function (TYPES) {
    TYPES[TYPES["UNSIGNED_BYTE"] = 5121] = "UNSIGNED_BYTE";
    TYPES[TYPES["UNSIGNED_SHORT"] = 5123] = "UNSIGNED_SHORT";
    TYPES[TYPES["UNSIGNED_SHORT_5_6_5"] = 33635] = "UNSIGNED_SHORT_5_6_5";
    TYPES[TYPES["UNSIGNED_SHORT_4_4_4_4"] = 32819] = "UNSIGNED_SHORT_4_4_4_4";
    TYPES[TYPES["UNSIGNED_SHORT_5_5_5_1"] = 32820] = "UNSIGNED_SHORT_5_5_5_1";
    TYPES[TYPES["UNSIGNED_INT"] = 5125] = "UNSIGNED_INT";
    TYPES[TYPES["UNSIGNED_INT_10F_11F_11F_REV"] = 35899] = "UNSIGNED_INT_10F_11F_11F_REV";
    TYPES[TYPES["UNSIGNED_INT_2_10_10_10_REV"] = 33640] = "UNSIGNED_INT_2_10_10_10_REV";
    TYPES[TYPES["UNSIGNED_INT_24_8"] = 34042] = "UNSIGNED_INT_24_8";
    TYPES[TYPES["UNSIGNED_INT_5_9_9_9_REV"] = 35902] = "UNSIGNED_INT_5_9_9_9_REV";
    TYPES[TYPES["BYTE"] = 5120] = "BYTE";
    TYPES[TYPES["SHORT"] = 5122] = "SHORT";
    TYPES[TYPES["INT"] = 5124] = "INT";
    TYPES[TYPES["FLOAT"] = 5126] = "FLOAT";
    TYPES[TYPES["FLOAT_32_UNSIGNED_INT_24_8_REV"] = 36269] = "FLOAT_32_UNSIGNED_INT_24_8_REV";
    TYPES[TYPES["HALF_FLOAT"] = 36193] = "HALF_FLOAT";
})(TYPES || (TYPES = {}));
/**
 * Various sampler types. Correspond to `sampler`, `isampler`, `usampler` GLSL types respectively.
 * WebGL1 works only with FLOAT.
 *
 * @memberof PIXI
 * @static
 * @name SAMPLER_TYPES
 * @enum {number}
 * @property {number} FLOAT=0
 * @property {number} INT=1
 * @property {number} UINT=2
 */
var SAMPLER_TYPES;
(function (SAMPLER_TYPES) {
    SAMPLER_TYPES[SAMPLER_TYPES["FLOAT"] = 0] = "FLOAT";
    SAMPLER_TYPES[SAMPLER_TYPES["INT"] = 1] = "INT";
    SAMPLER_TYPES[SAMPLER_TYPES["UINT"] = 2] = "UINT";
})(SAMPLER_TYPES || (SAMPLER_TYPES = {}));
/**
 * The scale modes that are supported by pixi.
 *
 * The {@link PIXI.settings.SCALE_MODE} scale mode affects the default scaling mode of future operations.
 * It can be re-assigned to either LINEAR or NEAREST, depending upon suitability.
 *
 * @memberof PIXI
 * @static
 * @name SCALE_MODES
 * @enum {number}
 * @property {number} LINEAR Smooth scaling
 * @property {number} NEAREST Pixelating scaling
 */
var SCALE_MODES;
(function (SCALE_MODES) {
    SCALE_MODES[SCALE_MODES["NEAREST"] = 0] = "NEAREST";
    SCALE_MODES[SCALE_MODES["LINEAR"] = 1] = "LINEAR";
})(SCALE_MODES || (SCALE_MODES = {}));
/**
 * The wrap modes that are supported by pixi.
 *
 * The {@link PIXI.settings.WRAP_MODE} wrap mode affects the default wrapping mode of future operations.
 * It can be re-assigned to either CLAMP or REPEAT, depending upon suitability.
 * If the texture is non power of two then clamp will be used regardless as WebGL can
 * only use REPEAT if the texture is po2.
 *
 * This property only affects WebGL.
 *
 * @name WRAP_MODES
 * @memberof PIXI
 * @static
 * @enum {number}
 * @property {number} CLAMP - The textures uvs are clamped
 * @property {number} REPEAT - The texture uvs tile and repeat
 * @property {number} MIRRORED_REPEAT - The texture uvs tile and repeat with mirroring
 */
var WRAP_MODES;
(function (WRAP_MODES) {
    WRAP_MODES[WRAP_MODES["CLAMP"] = 33071] = "CLAMP";
    WRAP_MODES[WRAP_MODES["REPEAT"] = 10497] = "REPEAT";
    WRAP_MODES[WRAP_MODES["MIRRORED_REPEAT"] = 33648] = "MIRRORED_REPEAT";
})(WRAP_MODES || (WRAP_MODES = {}));
/**
 * Mipmap filtering modes that are supported by pixi.
 *
 * The {@link PIXI.settings.MIPMAP_TEXTURES} affects default texture filtering.
 * Mipmaps are generated for a baseTexture if its `mipmap` field is `ON`,
 * or its `POW2` and texture dimensions are powers of 2.
 * Due to platform restriction, `ON` option will work like `POW2` for webgl-1.
 *
 * This property only affects WebGL.
 *
 * @name MIPMAP_MODES
 * @memberof PIXI
 * @static
 * @enum {number}
 * @property {number} OFF - No mipmaps
 * @property {number} POW2 - Generate mipmaps if texture dimensions are pow2
 * @property {number} ON - Always generate mipmaps
 * @property {number} ON_MANUAL - Use mipmaps, but do not auto-generate them; this is used with a resource
 *   that supports buffering each level-of-detail.
 */
var MIPMAP_MODES;
(function (MIPMAP_MODES) {
    MIPMAP_MODES[MIPMAP_MODES["OFF"] = 0] = "OFF";
    MIPMAP_MODES[MIPMAP_MODES["POW2"] = 1] = "POW2";
    MIPMAP_MODES[MIPMAP_MODES["ON"] = 2] = "ON";
    MIPMAP_MODES[MIPMAP_MODES["ON_MANUAL"] = 3] = "ON_MANUAL";
})(MIPMAP_MODES || (MIPMAP_MODES = {}));
/**
 * How to treat textures with premultiplied alpha
 *
 * @name ALPHA_MODES
 * @memberof PIXI
 * @static
 * @enum {number}
 * @property {number} NO_PREMULTIPLIED_ALPHA - Source is not premultiplied, leave it like that.
 *  Option for compressed and data textures that are created from typed arrays.
 * @property {number} PREMULTIPLY_ON_UPLOAD - Source is not premultiplied, premultiply on upload.
 *  Default option, used for all loaded images.
 * @property {number} PREMULTIPLIED_ALPHA - Source is already premultiplied
 *  Example: spine atlases with `_pma` suffix.
 * @property {number} NPM - Alias for NO_PREMULTIPLIED_ALPHA.
 * @property {number} UNPACK - Default option, alias for PREMULTIPLY_ON_UPLOAD.
 * @property {number} PMA - Alias for PREMULTIPLIED_ALPHA.
 */
var ALPHA_MODES;
(function (ALPHA_MODES) {
    ALPHA_MODES[ALPHA_MODES["NPM"] = 0] = "NPM";
    ALPHA_MODES[ALPHA_MODES["UNPACK"] = 1] = "UNPACK";
    ALPHA_MODES[ALPHA_MODES["PMA"] = 2] = "PMA";
    ALPHA_MODES[ALPHA_MODES["NO_PREMULTIPLIED_ALPHA"] = 0] = "NO_PREMULTIPLIED_ALPHA";
    ALPHA_MODES[ALPHA_MODES["PREMULTIPLY_ON_UPLOAD"] = 1] = "PREMULTIPLY_ON_UPLOAD";
    ALPHA_MODES[ALPHA_MODES["PREMULTIPLY_ALPHA"] = 2] = "PREMULTIPLY_ALPHA";
})(ALPHA_MODES || (ALPHA_MODES = {}));
/**
 * Configure whether filter textures are cleared after binding.
 *
 * Filter textures need not be cleared if the filter does not use pixel blending. {@link CLEAR_MODES.BLIT} will detect
 * this and skip clearing as an optimization.
 *
 * @name CLEAR_MODES
 * @memberof PIXI
 * @static
 * @enum {number}
 * @property {number} BLEND - Do not clear the filter texture. The filter's output will blend on top of the output texture.
 * @property {number} CLEAR - Always clear the filter texture.
 * @property {number} BLIT - Clear only if {@link FilterSystem.forceClear} is set or if the filter uses pixel blending.
 * @property {number} NO - Alias for BLEND, same as `false` in earlier versions
 * @property {number} YES - Alias for CLEAR, same as `true` in earlier versions
 * @property {number} AUTO - Alias for BLIT
 */
var CLEAR_MODES;
(function (CLEAR_MODES) {
    CLEAR_MODES[CLEAR_MODES["NO"] = 0] = "NO";
    CLEAR_MODES[CLEAR_MODES["YES"] = 1] = "YES";
    CLEAR_MODES[CLEAR_MODES["AUTO"] = 2] = "AUTO";
    CLEAR_MODES[CLEAR_MODES["BLEND"] = 0] = "BLEND";
    CLEAR_MODES[CLEAR_MODES["CLEAR"] = 1] = "CLEAR";
    CLEAR_MODES[CLEAR_MODES["BLIT"] = 2] = "BLIT";
})(CLEAR_MODES || (CLEAR_MODES = {}));
/**
 * The gc modes that are supported by pixi.
 *
 * The {@link PIXI.settings.GC_MODE} Garbage Collection mode for PixiJS textures is AUTO
 * If set to GC_MODE, the renderer will occasionally check textures usage. If they are not
 * used for a specified period of time they will be removed from the GPU. They will of course
 * be uploaded again when they are required. This is a silent behind the scenes process that
 * should ensure that the GPU does not  get filled up.
 *
 * Handy for mobile devices!
 * This property only affects WebGL.
 *
 * @name GC_MODES
 * @enum {number}
 * @static
 * @memberof PIXI
 * @property {number} AUTO - Garbage collection will happen periodically automatically
 * @property {number} MANUAL - Garbage collection will need to be called manually
 */
var GC_MODES;
(function (GC_MODES) {
    GC_MODES[GC_MODES["AUTO"] = 0] = "AUTO";
    GC_MODES[GC_MODES["MANUAL"] = 1] = "MANUAL";
})(GC_MODES || (GC_MODES = {}));
/**
 * Constants that specify float precision in shaders.
 *
 * @name PRECISION
 * @memberof PIXI
 * @constant
 * @static
 * @enum {string}
 * @property {string} LOW='lowp'
 * @property {string} MEDIUM='mediump'
 * @property {string} HIGH='highp'
 */
var PRECISION;
(function (PRECISION) {
    PRECISION["LOW"] = "lowp";
    PRECISION["MEDIUM"] = "mediump";
    PRECISION["HIGH"] = "highp";
})(PRECISION || (PRECISION = {}));
/**
 * Constants for mask implementations.
 * We use `type` suffix because it leads to very different behaviours
 *
 * @name MASK_TYPES
 * @memberof PIXI
 * @static
 * @enum {number}
 * @property {number} NONE - Mask is ignored
 * @property {number} SCISSOR - Scissor mask, rectangle on screen, cheap
 * @property {number} STENCIL - Stencil mask, 1-bit, medium, works only if renderer supports stencil
 * @property {number} SPRITE - Mask that uses SpriteMaskFilter, uses temporary RenderTexture
 */
var MASK_TYPES;
(function (MASK_TYPES) {
    MASK_TYPES[MASK_TYPES["NONE"] = 0] = "NONE";
    MASK_TYPES[MASK_TYPES["SCISSOR"] = 1] = "SCISSOR";
    MASK_TYPES[MASK_TYPES["STENCIL"] = 2] = "STENCIL";
    MASK_TYPES[MASK_TYPES["SPRITE"] = 3] = "SPRITE";
})(MASK_TYPES || (MASK_TYPES = {}));
/**
 * Constants for multi-sampling antialiasing.
 *
 * @see PIXI.Framebuffer#multisample
 *
 * @name MSAA_QUALITY
 * @memberof PIXI
 * @static
 * @enum {number}
 * @property {number} NONE - No multisampling for this renderTexture
 * @property {number} LOW - Try 2 samples
 * @property {number} MEDIUM - Try 4 samples
 * @property {number} HIGH - Try 8 samples
 */
var MSAA_QUALITY;
(function (MSAA_QUALITY) {
    MSAA_QUALITY[MSAA_QUALITY["NONE"] = 0] = "NONE";
    MSAA_QUALITY[MSAA_QUALITY["LOW"] = 2] = "LOW";
    MSAA_QUALITY[MSAA_QUALITY["MEDIUM"] = 4] = "MEDIUM";
    MSAA_QUALITY[MSAA_QUALITY["HIGH"] = 8] = "HIGH";
})(MSAA_QUALITY || (MSAA_QUALITY = {}));
/**
 * Constants for various buffer types in Pixi
 *
 * @see PIXI.BUFFER_TYPE
 *
 * @name BUFFER_TYPE
 * @memberof PIXI
 * @static
 * @enum {number}
 * @property {number} ELEMENT_ARRAY_BUFFER - buffer type for using as an index buffer
 * @property {number} ARRAY_BUFFER - buffer type for using attribute data
 * @property {number} UNIFORM_BUFFER - the buffer type is for uniform buffer objects
 */
var BUFFER_TYPE;
(function (BUFFER_TYPE) {
    BUFFER_TYPE[BUFFER_TYPE["ELEMENT_ARRAY_BUFFER"] = 34963] = "ELEMENT_ARRAY_BUFFER";
    BUFFER_TYPE[BUFFER_TYPE["ARRAY_BUFFER"] = 34962] = "ARRAY_BUFFER";
    // NOT YET SUPPORTED
    BUFFER_TYPE[BUFFER_TYPE["UNIFORM_BUFFER"] = 35345] = "UNIFORM_BUFFER";
})(BUFFER_TYPE || (BUFFER_TYPE = {}));

var _tempMatrix = new Matrix();
DisplayObject.prototype._cacheAsBitmap = false;
DisplayObject.prototype._cacheData = null;
DisplayObject.prototype._cacheAsBitmapResolution = null;
DisplayObject.prototype._cacheAsBitmapMultisample = MSAA_QUALITY.NONE;
// figured there's no point adding ALL the extra variables to prototype.
// this model can hold the information needed. This can also be generated on demand as
// most objects are not cached as bitmaps.
/**
 * @class
 * @ignore
 * @private
 */
var CacheData = /** @class */ (function () {
    function CacheData() {
        this.textureCacheId = null;
        this.originalRender = null;
        this.originalRenderCanvas = null;
        this.originalCalculateBounds = null;
        this.originalGetLocalBounds = null;
        this.originalUpdateTransform = null;
        this.originalDestroy = null;
        this.originalMask = null;
        this.originalFilterArea = null;
        this.originalContainsPoint = null;
        this.sprite = null;
    }
    return CacheData;
}());
Object.defineProperties(DisplayObject.prototype, {
    /**
     * The resolution to use for cacheAsBitmap. By default this will use the renderer's resolution
     * but can be overriden for performance. Lower values will reduce memory usage at the expense
     * of render quality. A falsey value of `null` or `0` will default to the renderer's resolution.
     * If `cacheAsBitmap` is set to `true`, this will re-render with the new resolution.
     *
     * @member {number} cacheAsBitmapResolution
     * @memberof PIXI.DisplayObject#
     * @default null
     */
    cacheAsBitmapResolution: {
        get: function () {
            return this._cacheAsBitmapResolution;
        },
        set: function (resolution) {
            if (resolution === this._cacheAsBitmapResolution) {
                return;
            }
            this._cacheAsBitmapResolution = resolution;
            if (this.cacheAsBitmap) {
                // Toggle to re-render at the new resolution
                this.cacheAsBitmap = false;
                this.cacheAsBitmap = true;
            }
        },
    },
    /**
     * The number of samples to use for cacheAsBitmap. If set to `null`, the renderer's
     * sample count is used.
     * If `cacheAsBitmap` is set to `true`, this will re-render with the new number of samples.
     *
     * @member {number} cacheAsBitmapMultisample
     * @memberof PIXI.DisplayObject#
     * @default PIXI.MSAA_QUALITY.NONE
     */
    cacheAsBitmapMultisample: {
        get: function () {
            return this._cacheAsBitmapMultisample;
        },
        set: function (multisample) {
            if (multisample === this._cacheAsBitmapMultisample) {
                return;
            }
            this._cacheAsBitmapMultisample = multisample;
            if (this.cacheAsBitmap) {
                // Toggle to re-render with new multisample
                this.cacheAsBitmap = false;
                this.cacheAsBitmap = true;
            }
        },
    },
    /**
     * Set this to true if you want this display object to be cached as a bitmap.
     * This basically takes a snap shot of the display object as it is at that moment. It can
     * provide a performance benefit for complex static displayObjects.
     * To remove simply set this property to `false`
     *
     * IMPORTANT GOTCHA - Make sure that all your textures are preloaded BEFORE setting this property to true
     * as it will take a snapshot of what is currently there. If the textures have not loaded then they will not appear.
     *
     * @member {boolean}
     * @memberof PIXI.DisplayObject#
     */
    cacheAsBitmap: {
        get: function () {
            return this._cacheAsBitmap;
        },
        set: function (value) {
            if (this._cacheAsBitmap === value) {
                return;
            }
            this._cacheAsBitmap = value;
            var data;
            if (value) {
                if (!this._cacheData) {
                    this._cacheData = new CacheData();
                }
                data = this._cacheData;
                data.originalRender = this.render;
                data.originalRenderCanvas = this.renderCanvas;
                data.originalUpdateTransform = this.updateTransform;
                data.originalCalculateBounds = this.calculateBounds;
                data.originalGetLocalBounds = this.getLocalBounds;
                data.originalDestroy = this.destroy;
                data.originalContainsPoint = this.containsPoint;
                data.originalMask = this._mask;
                data.originalFilterArea = this.filterArea;
                this.render = this._renderCached;
                this.renderCanvas = this._renderCachedCanvas;
                this.destroy = this._cacheAsBitmapDestroy;
            }
            else {
                data = this._cacheData;
                if (data.sprite) {
                    this._destroyCachedDisplayObject();
                }
                this.render = data.originalRender;
                this.renderCanvas = data.originalRenderCanvas;
                this.calculateBounds = data.originalCalculateBounds;
                this.getLocalBounds = data.originalGetLocalBounds;
                this.destroy = data.originalDestroy;
                this.updateTransform = data.originalUpdateTransform;
                this.containsPoint = data.originalContainsPoint;
                this._mask = data.originalMask;
                this.filterArea = data.originalFilterArea;
            }
        },
    },
});
/**
 * Renders a cached version of the sprite with WebGL
 *
 * @private
 * @method _renderCached
 * @memberof PIXI.DisplayObject#
 * @param {PIXI.Renderer} renderer - the WebGL renderer
 */
DisplayObject.prototype._renderCached = function _renderCached(renderer) {
    if (!this.visible || this.worldAlpha <= 0 || !this.renderable) {
        return;
    }
    this._initCachedDisplayObject(renderer);
    this._cacheData.sprite.transform._worldID = this.transform._worldID;
    this._cacheData.sprite.worldAlpha = this.worldAlpha;
    this._cacheData.sprite._render(renderer);
};
/**
 * Prepares the WebGL renderer to cache the sprite
 *
 * @private
 * @method _initCachedDisplayObject
 * @memberof PIXI.DisplayObject#
 * @param {PIXI.Renderer} renderer - the WebGL renderer
 */
DisplayObject.prototype._initCachedDisplayObject = function _initCachedDisplayObject(renderer) {
    var _a;
    if (this._cacheData && this._cacheData.sprite) {
        return;
    }
    // make sure alpha is set to 1 otherwise it will get rendered as invisible!
    var cacheAlpha = this.alpha;
    this.alpha = 1;
    // first we flush anything left in the renderer (otherwise it would get rendered to the cached texture)
    renderer.batch.flush();
    // this.filters= [];
    // next we find the dimensions of the untransformed object
    // this function also calls updatetransform on all its children as part of the measuring.
    // This means we don't need to update the transform again in this function
    // TODO pass an object to clone too? saves having to create a new one each time!
    var bounds = this.getLocalBounds(null, true).clone();
    // add some padding!
    if (this.filters) {
        var padding = this.filters[0].padding;
        bounds.pad(padding);
    }
    bounds.ceil(settings.RESOLUTION);
    // for now we cache the current renderTarget that the WebGL renderer is currently using.
    // this could be more elegant..
    var cachedRenderTexture = renderer.renderTexture.current;
    var cachedSourceFrame = renderer.renderTexture.sourceFrame.clone();
    var cachedDestinationFrame = renderer.renderTexture.destinationFrame.clone();
    var cachedProjectionTransform = renderer.projection.transform;
    // We also store the filter stack - I will definitely look to change how this works a little later down the line.
    // const stack = renderer.filterManager.filterStack;
    // this renderTexture will be used to store the cached DisplayObject
    var renderTexture = RenderTexture.create({
        width: bounds.width,
        height: bounds.height,
        resolution: this.cacheAsBitmapResolution || renderer.resolution,
        multisample: (_a = this.cacheAsBitmapMultisample) !== null && _a !== void 0 ? _a : renderer.multisample,
    });
    var textureCacheId = "cacheAsBitmap_" + uid();
    this._cacheData.textureCacheId = textureCacheId;
    BaseTexture.addToCache(renderTexture.baseTexture, textureCacheId);
    Texture.addToCache(renderTexture, textureCacheId);
    // need to set //
    var m = this.transform.localTransform.copyTo(_tempMatrix).invert().translate(-bounds.x, -bounds.y);
    // set all properties to there original so we can render to a texture
    this.render = this._cacheData.originalRender;
    renderer.render(this, { renderTexture: renderTexture, clear: true, transform: m, skipUpdateTransform: false });
    renderer.framebuffer.blit();
    // now restore the state be setting the new properties
    renderer.projection.transform = cachedProjectionTransform;
    renderer.renderTexture.bind(cachedRenderTexture, cachedSourceFrame, cachedDestinationFrame);
    // renderer.filterManager.filterStack = stack;
    this.render = this._renderCached;
    // the rest is the same as for Canvas
    this.updateTransform = this.displayObjectUpdateTransform;
    this.calculateBounds = this._calculateCachedBounds;
    this.getLocalBounds = this._getCachedLocalBounds;
    this._mask = null;
    this.filterArea = null;
    this.alpha = cacheAlpha;
    // create our cached sprite
    var cachedSprite = new Sprite(renderTexture);
    cachedSprite.transform.worldTransform = this.transform.worldTransform;
    cachedSprite.anchor.x = -(bounds.x / bounds.width);
    cachedSprite.anchor.y = -(bounds.y / bounds.height);
    cachedSprite.alpha = cacheAlpha;
    cachedSprite._bounds = this._bounds;
    this._cacheData.sprite = cachedSprite;
    this.transform._parentID = -1;
    // restore the transform of the cached sprite to avoid the nasty flicker..
    if (!this.parent) {
        this.enableTempParent();
        this.updateTransform();
        this.disableTempParent(null);
    }
    else {
        this.updateTransform();
    }
    // map the hit test..
    this.containsPoint = cachedSprite.containsPoint.bind(cachedSprite);
};
/**
 * Renders a cached version of the sprite with canvas
 *
 * @private
 * @method _renderCachedCanvas
 * @memberof PIXI.DisplayObject#
 * @param {PIXI.CanvasRenderer} renderer - The canvas renderer
 */
DisplayObject.prototype._renderCachedCanvas = function _renderCachedCanvas(renderer) {
    if (!this.visible || this.worldAlpha <= 0 || !this.renderable) {
        return;
    }
    this._initCachedDisplayObjectCanvas(renderer);
    this._cacheData.sprite.worldAlpha = this.worldAlpha;
    this._cacheData.sprite._renderCanvas(renderer);
};
// TODO this can be the same as the WebGL version.. will need to do a little tweaking first though..
/**
 * Prepares the Canvas renderer to cache the sprite
 *
 * @private
 * @method _initCachedDisplayObjectCanvas
 * @memberof PIXI.DisplayObject#
 * @param {PIXI.CanvasRenderer} renderer - The canvas renderer
 */
DisplayObject.prototype._initCachedDisplayObjectCanvas = function _initCachedDisplayObjectCanvas(renderer) {
    if (this._cacheData && this._cacheData.sprite) {
        return;
    }
    // get bounds actually transforms the object for us already!
    var bounds = this.getLocalBounds(null, true);
    var cacheAlpha = this.alpha;
    this.alpha = 1;
    var cachedRenderTarget = renderer.context;
    var cachedProjectionTransform = renderer._projTransform;
    bounds.ceil(settings.RESOLUTION);
    var renderTexture = RenderTexture.create({ width: bounds.width, height: bounds.height });
    var textureCacheId = "cacheAsBitmap_" + uid();
    this._cacheData.textureCacheId = textureCacheId;
    BaseTexture.addToCache(renderTexture.baseTexture, textureCacheId);
    Texture.addToCache(renderTexture, textureCacheId);
    // need to set //
    var m = _tempMatrix;
    this.transform.localTransform.copyTo(m);
    m.invert();
    m.tx -= bounds.x;
    m.ty -= bounds.y;
    // m.append(this.transform.worldTransform.)
    // set all properties to there original so we can render to a texture
    this.renderCanvas = this._cacheData.originalRenderCanvas;
    renderer.render(this, { renderTexture: renderTexture, clear: true, transform: m, skipUpdateTransform: false });
    // now restore the state be setting the new properties
    renderer.context = cachedRenderTarget;
    renderer._projTransform = cachedProjectionTransform;
    this.renderCanvas = this._renderCachedCanvas;
    // the rest is the same as for WebGL
    this.updateTransform = this.displayObjectUpdateTransform;
    this.calculateBounds = this._calculateCachedBounds;
    this.getLocalBounds = this._getCachedLocalBounds;
    this._mask = null;
    this.filterArea = null;
    this.alpha = cacheAlpha;
    // create our cached sprite
    var cachedSprite = new Sprite(renderTexture);
    cachedSprite.transform.worldTransform = this.transform.worldTransform;
    cachedSprite.anchor.x = -(bounds.x / bounds.width);
    cachedSprite.anchor.y = -(bounds.y / bounds.height);
    cachedSprite.alpha = cacheAlpha;
    cachedSprite._bounds = this._bounds;
    this._cacheData.sprite = cachedSprite;
    this.transform._parentID = -1;
    // restore the transform of the cached sprite to avoid the nasty flicker..
    if (!this.parent) {
        this.parent = renderer._tempDisplayObjectParent;
        this.updateTransform();
        this.parent = null;
    }
    else {
        this.updateTransform();
    }
    // map the hit test..
    this.containsPoint = cachedSprite.containsPoint.bind(cachedSprite);
};
/**
 * Calculates the bounds of the cached sprite
 *
 * @private
 * @method
 */
DisplayObject.prototype._calculateCachedBounds = function _calculateCachedBounds() {
    this._bounds.clear();
    this._cacheData.sprite.transform._worldID = this.transform._worldID;
    this._cacheData.sprite._calculateBounds();
    this._bounds.updateID = this._boundsID;
};
/**
 * Gets the bounds of the cached sprite.
 *
 * @private
 * @method
 * @return {Rectangle} The local bounds.
 */
DisplayObject.prototype._getCachedLocalBounds = function _getCachedLocalBounds() {
    return this._cacheData.sprite.getLocalBounds(null);
};
/**
 * Destroys the cached sprite.
 *
 * @private
 * @method
 */
DisplayObject.prototype._destroyCachedDisplayObject = function _destroyCachedDisplayObject() {
    this._cacheData.sprite._texture.destroy(true);
    this._cacheData.sprite = null;
    BaseTexture.removeFromCache(this._cacheData.textureCacheId);
    Texture.removeFromCache(this._cacheData.textureCacheId);
    this._cacheData.textureCacheId = null;
};
/**
 * Destroys the cached object.
 *
 * @private
 * @method
 * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
 *  have been set to that value.
 *  Used when destroying containers, see the Container.destroy method.
 */
DisplayObject.prototype._cacheAsBitmapDestroy = function _cacheAsBitmapDestroy(options) {
    this.cacheAsBitmap = false;
    this.destroy(options);
};

/*!
 * @pixi/mixin-get-child-by-name - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/mixin-get-child-by-name is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/**
 * The instance name of the object.
 *
 * @memberof PIXI.DisplayObject#
 * @member {string} name
 */
DisplayObject.prototype.name = null;
/**
 * Returns the display object in the container.
 *
 * Recursive searches are done in a preorder traversal.
 *
 * @method getChildByName
 * @memberof PIXI.Container#
 * @param {string} name - Instance name.
 * @param {boolean}[deep=false] - Whether to search recursively
 * @return {PIXI.DisplayObject} The child with the specified name.
 */
Container.prototype.getChildByName = function getChildByName(name, deep) {
    for (var i = 0, j = this.children.length; i < j; i++) {
        if (this.children[i].name === name) {
            return this.children[i];
        }
    }
    if (deep) {
        for (var i = 0, j = this.children.length; i < j; i++) {
            var child = this.children[i];
            if (!child.getChildByName) {
                continue;
            }
            var target = this.children[i].getChildByName(name, true);
            if (target) {
                return target;
            }
        }
    }
    return null;
};

/*!
 * @pixi/mixin-get-global-position - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/mixin-get-global-position is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/**
 * Returns the global position of the displayObject. Does not depend on object scale, rotation and pivot.
 *
 * @method getGlobalPosition
 * @memberof PIXI.DisplayObject#
 * @param {PIXI.Point} [point=new PIXI.Point()] - The point to write the global value to.
 * @param {boolean} [skipUpdate=false] - Setting to true will stop the transforms of the scene graph from
 *  being updated. This means the calculation returned MAY be out of date BUT will give you a
 *  nice performance boost.
 * @return {PIXI.Point} The updated point.
 */
DisplayObject.prototype.getGlobalPosition = function getGlobalPosition(point, skipUpdate) {
    if (point === void 0) { point = new Point(); }
    if (skipUpdate === void 0) { skipUpdate = false; }
    if (this.parent) {
        this.parent.toGlobal(this.position, point, skipUpdate);
    }
    else {
        point.x = this.position.x;
        point.y = this.position.y;
    }
    return point;
};

/*!
 * @pixi/mesh-extras - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/mesh-extras is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$d = function(d, b) {
    extendStatics$d = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$d(d, b);
};

function __extends$d(d, b) {
    extendStatics$d(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

/**
 * @memberof PIXI
 */
var PlaneGeometry = /** @class */ (function (_super) {
    __extends$d(PlaneGeometry, _super);
    /**
     * @param width - The width of the plane.
     * @param height - The height of the plane.
     * @param segWidth - Number of horizontal segments.
     * @param segHeight - Number of vertical segments.
     */
    function PlaneGeometry(width, height, segWidth, segHeight) {
        if (width === void 0) { width = 100; }
        if (height === void 0) { height = 100; }
        if (segWidth === void 0) { segWidth = 10; }
        if (segHeight === void 0) { segHeight = 10; }
        var _this = _super.call(this) || this;
        _this.segWidth = segWidth;
        _this.segHeight = segHeight;
        _this.width = width;
        _this.height = height;
        _this.build();
        return _this;
    }
    /**
     * Refreshes plane coordinates
     * @private
     */
    PlaneGeometry.prototype.build = function () {
        var total = this.segWidth * this.segHeight;
        var verts = [];
        var uvs = [];
        var indices = [];
        var segmentsX = this.segWidth - 1;
        var segmentsY = this.segHeight - 1;
        var sizeX = (this.width) / segmentsX;
        var sizeY = (this.height) / segmentsY;
        for (var i = 0; i < total; i++) {
            var x = (i % this.segWidth);
            var y = ((i / this.segWidth) | 0);
            verts.push(x * sizeX, y * sizeY);
            uvs.push(x / segmentsX, y / segmentsY);
        }
        var totalSub = segmentsX * segmentsY;
        for (var i = 0; i < totalSub; i++) {
            var xpos = i % segmentsX;
            var ypos = (i / segmentsX) | 0;
            var value = (ypos * this.segWidth) + xpos;
            var value2 = (ypos * this.segWidth) + xpos + 1;
            var value3 = ((ypos + 1) * this.segWidth) + xpos;
            var value4 = ((ypos + 1) * this.segWidth) + xpos + 1;
            indices.push(value, value2, value3, value2, value4, value3);
        }
        this.buffers[0].data = new Float32Array(verts);
        this.buffers[1].data = new Float32Array(uvs);
        this.indexBuffer.data = new Uint16Array(indices);
        // ensure that the changes are uploaded
        this.buffers[0].update();
        this.buffers[1].update();
        this.indexBuffer.update();
    };
    return PlaneGeometry;
}(MeshGeometry));

/**
 * RopeGeometry allows you to draw a geometry across several points and then manipulate these points.
 *
 * ```js
 * for (let i = 0; i < 20; i++) {
 *     points.push(new PIXI.Point(i * 50, 0));
 * };
 * const rope = new PIXI.RopeGeometry(100, points);
 * ```
 *
 * @class
 * @extends PIXI.MeshGeometry
 * @memberof PIXI
 *
 */
var RopeGeometry = /** @class */ (function (_super) {
    __extends$d(RopeGeometry, _super);
    /**
     * @param {number} [width=200] - The width (i.e., thickness) of the rope.
     * @param {PIXI.Point[]} [points] - An array of {@link PIXI.Point} objects to construct this rope.
     * @param {number} [textureScale=0] - By default the rope texture will be stretched to match
     *     rope length. If textureScale is positive this value will be treated as a scaling
     *     factor and the texture will preserve its aspect ratio instead. To create a tiling rope
     *     set baseTexture.wrapMode to {@link PIXI.WRAP_MODES.REPEAT} and use a power of two texture,
     *     then set textureScale=1 to keep the original texture pixel size.
     *     In order to reduce alpha channel artifacts provide a larger texture and downsample -
     *     i.e. set textureScale=0.5 to scale it down twice.
     */
    function RopeGeometry(width, points, textureScale) {
        if (width === void 0) { width = 200; }
        if (textureScale === void 0) { textureScale = 0; }
        var _this = _super.call(this, new Float32Array(points.length * 4), new Float32Array(points.length * 4), new Uint16Array((points.length - 1) * 6)) || this;
        /**
         * An array of points that determine the rope
         * @member {PIXI.Point[]}
         */
        _this.points = points;
        /**
         * The width (i.e., thickness) of the rope.
         * @member {number}
         * @readOnly
         */
        _this._width = width;
        /**
         * Rope texture scale, if zero then the rope texture is stretched.
         * @member {number}
         * @readOnly
         */
        _this.textureScale = textureScale;
        _this.build();
        return _this;
    }
    Object.defineProperty(RopeGeometry.prototype, "width", {
        /**
         * The width (i.e., thickness) of the rope.
         * @member {number}
         * @readOnly
         */
        get: function () {
            return this._width;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Refreshes Rope indices and uvs
     * @private
     */
    RopeGeometry.prototype.build = function () {
        var points = this.points;
        if (!points)
            { return; }
        var vertexBuffer = this.getBuffer('aVertexPosition');
        var uvBuffer = this.getBuffer('aTextureCoord');
        var indexBuffer = this.getIndex();
        // if too little points, or texture hasn't got UVs set yet just move on.
        if (points.length < 1) {
            return;
        }
        // if the number of points has changed we will need to recreate the arraybuffers
        if (vertexBuffer.data.length / 4 !== points.length) {
            vertexBuffer.data = new Float32Array(points.length * 4);
            uvBuffer.data = new Float32Array(points.length * 4);
            indexBuffer.data = new Uint16Array((points.length - 1) * 6);
        }
        var uvs = uvBuffer.data;
        var indices = indexBuffer.data;
        uvs[0] = 0;
        uvs[1] = 0;
        uvs[2] = 0;
        uvs[3] = 1;
        var amount = 0;
        var prev = points[0];
        var textureWidth = this._width * this.textureScale;
        var total = points.length; // - 1;
        for (var i = 0; i < total; i++) {
            // time to do some smart drawing!
            var index = i * 4;
            if (this.textureScale > 0) {
                // calculate pixel distance from previous point
                var dx = prev.x - points[i].x;
                var dy = prev.y - points[i].y;
                var distance = Math.sqrt((dx * dx) + (dy * dy));
                prev = points[i];
                amount += distance / textureWidth;
            }
            else {
                // stretch texture
                amount = i / (total - 1);
            }
            uvs[index] = amount;
            uvs[index + 1] = 0;
            uvs[index + 2] = amount;
            uvs[index + 3] = 1;
        }
        var indexCount = 0;
        for (var i = 0; i < total - 1; i++) {
            var index = i * 2;
            indices[indexCount++] = index;
            indices[indexCount++] = index + 1;
            indices[indexCount++] = index + 2;
            indices[indexCount++] = index + 2;
            indices[indexCount++] = index + 1;
            indices[indexCount++] = index + 3;
        }
        // ensure that the changes are uploaded
        uvBuffer.update();
        indexBuffer.update();
        this.updateVertices();
    };
    /**
     * refreshes vertices of Rope mesh
     */
    RopeGeometry.prototype.updateVertices = function () {
        var points = this.points;
        if (points.length < 1) {
            return;
        }
        var lastPoint = points[0];
        var nextPoint;
        var perpX = 0;
        var perpY = 0;
        var vertices = this.buffers[0].data;
        var total = points.length;
        for (var i = 0; i < total; i++) {
            var point = points[i];
            var index = i * 4;
            if (i < points.length - 1) {
                nextPoint = points[i + 1];
            }
            else {
                nextPoint = point;
            }
            perpY = -(nextPoint.x - lastPoint.x);
            perpX = nextPoint.y - lastPoint.y;
            var perpLength = Math.sqrt((perpX * perpX) + (perpY * perpY));
            var num = this.textureScale > 0 ? this.textureScale * this._width / 2 : this._width / 2;
            perpX /= perpLength;
            perpY /= perpLength;
            perpX *= num;
            perpY *= num;
            vertices[index] = point.x + perpX;
            vertices[index + 1] = point.y + perpY;
            vertices[index + 2] = point.x - perpX;
            vertices[index + 3] = point.y - perpY;
            lastPoint = point;
        }
        this.buffers[0].update();
    };
    RopeGeometry.prototype.update = function () {
        if (this.textureScale > 0) {
            this.build(); // we need to update UVs
        }
        else {
            this.updateVertices();
        }
    };
    return RopeGeometry;
}(MeshGeometry));

/**
 * The rope allows you to draw a texture across several points and then manipulate these points
 *
 *```js
 * for (let i = 0; i < 20; i++) {
 *     points.push(new PIXI.Point(i * 50, 0));
 * };
 * let rope = new PIXI.SimpleRope(PIXI.Texture.from("snake.png"), points);
 *  ```
 *
 * @class
 * @extends PIXI.Mesh
 * @memberof PIXI
 *
 */
var SimpleRope = /** @class */ (function (_super) {
    __extends$d(SimpleRope, _super);
    /**
     * @param {PIXI.Texture} texture - The texture to use on the rope.
     * @param {PIXI.Point[]} points - An array of {@link PIXI.Point} objects to construct this rope.
     * @param {number} [textureScale=0] - Optional. Positive values scale rope texture
     * keeping its aspect ratio. You can reduce alpha channel artifacts by providing a larger texture
     * and downsampling here. If set to zero, texture will be stretched instead.
     */
    function SimpleRope(texture, points, textureScale) {
        if (textureScale === void 0) { textureScale = 0; }
        var _this = this;
        var ropeGeometry = new RopeGeometry(texture.height, points, textureScale);
        var meshMaterial = new MeshMaterial(texture);
        if (textureScale > 0) {
            // attempt to set UV wrapping, will fail on non-power of two textures
            texture.baseTexture.wrapMode = WRAP_MODES$1.REPEAT;
        }
        _this = _super.call(this, ropeGeometry, meshMaterial) || this;
        /**
         * re-calculate vertices by rope points each frame
         *
         * @member {boolean}
         */
        _this.autoUpdate = true;
        return _this;
    }
    SimpleRope.prototype._render = function (renderer) {
        var geometry = this.geometry;
        if (this.autoUpdate || geometry._width !== this.shader.texture.height) {
            geometry._width = this.shader.texture.height;
            geometry.update();
        }
        _super.prototype._render.call(this, renderer);
    };
    return SimpleRope;
}(Mesh));

/**
 * The SimplePlane allows you to draw a texture across several points and then manipulate these points
 *
 *```js
 * for (let i = 0; i < 20; i++) {
 *     points.push(new PIXI.Point(i * 50, 0));
 * };
 * let SimplePlane = new PIXI.SimplePlane(PIXI.Texture.from("snake.png"), points);
 *  ```
 *
 * @class
 * @extends PIXI.Mesh
 * @memberof PIXI
 *
 */
var SimplePlane = /** @class */ (function (_super) {
    __extends$d(SimplePlane, _super);
    /**
     * @param {PIXI.Texture} texture - The texture to use on the SimplePlane.
     * @param {number} verticesX - The number of vertices in the x-axis
     * @param {number} verticesY - The number of vertices in the y-axis
     */
    function SimplePlane(texture, verticesX, verticesY) {
        var _this = this;
        var planeGeometry = new PlaneGeometry(texture.width, texture.height, verticesX, verticesY);
        var meshMaterial = new MeshMaterial(Texture.WHITE);
        _this = _super.call(this, planeGeometry, meshMaterial) || this;
        // lets call the setter to ensure all necessary updates are performed
        _this.texture = texture;
        _this.autoResize = true;
        return _this;
    }
    /**
     * Method used for overrides, to do something in case texture frame was changed.
     * Meshes based on plane can override it and change more details based on texture.
     */
    SimplePlane.prototype.textureUpdated = function () {
        this._textureID = this.shader.texture._updateID;
        var geometry = this.geometry;
        var _a = this.shader.texture, width = _a.width, height = _a.height;
        if (this.autoResize && (geometry.width !== width || geometry.height !== height)) {
            geometry.width = this.shader.texture.width;
            geometry.height = this.shader.texture.height;
            geometry.build();
        }
    };
    Object.defineProperty(SimplePlane.prototype, "texture", {
        get: function () {
            return this.shader.texture;
        },
        set: function (value) {
            // Track texture same way sprite does.
            // For generated meshes like NineSlicePlane it can change the geometry.
            // Unfortunately, this method might not work if you directly change texture in material.
            if (this.shader.texture === value) {
                return;
            }
            this.shader.texture = value;
            this._textureID = -1;
            if (value.baseTexture.valid) {
                this.textureUpdated();
            }
            else {
                value.once('update', this.textureUpdated, this);
            }
        },
        enumerable: false,
        configurable: true
    });
    SimplePlane.prototype._render = function (renderer) {
        if (this._textureID !== this.shader.texture._updateID) {
            this.textureUpdated();
        }
        _super.prototype._render.call(this, renderer);
    };
    SimplePlane.prototype.destroy = function (options) {
        this.shader.texture.off('update', this.textureUpdated, this);
        _super.prototype.destroy.call(this, options);
    };
    return SimplePlane;
}(Mesh));

/**
 * The Simple Mesh class mimics Mesh in PixiJS v4, providing easy-to-use constructor arguments.
 * For more robust customization, use {@link PIXI.Mesh}.
 *
 * @class
 * @extends PIXI.Mesh
 * @memberof PIXI
 */
var SimpleMesh = /** @class */ (function (_super) {
    __extends$d(SimpleMesh, _super);
    /**
     * @param {PIXI.Texture} [texture=Texture.EMPTY] - The texture to use
     * @param {Float32Array} [vertices] - if you want to specify the vertices
     * @param {Float32Array} [uvs] - if you want to specify the uvs
     * @param {Uint16Array} [indices] - if you want to specify the indices
     * @param {number} [drawMode] - the drawMode, can be any of the Mesh.DRAW_MODES consts
     */
    function SimpleMesh(texture, vertices, uvs, indices, drawMode) {
        if (texture === void 0) { texture = Texture.EMPTY; }
        var _this = this;
        var geometry = new MeshGeometry(vertices, uvs, indices);
        geometry.getBuffer('aVertexPosition').static = false;
        var meshMaterial = new MeshMaterial(texture);
        _this = _super.call(this, geometry, meshMaterial, null, drawMode) || this;
        /**
         * upload vertices buffer each frame
         * @member {boolean}
         */
        _this.autoUpdate = true;
        return _this;
    }
    Object.defineProperty(SimpleMesh.prototype, "vertices", {
        /**
         * Collection of vertices data.
         * @member {Float32Array}
         */
        get: function () {
            return this.geometry.getBuffer('aVertexPosition').data;
        },
        set: function (value) {
            this.geometry.getBuffer('aVertexPosition').data = value;
        },
        enumerable: false,
        configurable: true
    });
    SimpleMesh.prototype._render = function (renderer) {
        if (this.autoUpdate) {
            this.geometry.getBuffer('aVertexPosition').update();
        }
        _super.prototype._render.call(this, renderer);
    };
    return SimpleMesh;
}(Mesh));

var DEFAULT_BORDER_SIZE = 10;
/**
 * The NineSlicePlane allows you to stretch a texture using 9-slice scaling. The corners will remain unscaled (useful
 * for buttons with rounded corners for example) and the other areas will be scaled horizontally and or vertically
 *
 *```js
 * let Plane9 = new PIXI.NineSlicePlane(PIXI.Texture.from('BoxWithRoundedCorners.png'), 15, 15, 15, 15);
 *  ```
 * <pre>
 *      A                          B
 *    +---+----------------------+---+
 *  C | 1 |          2           | 3 |
 *    +---+----------------------+---+
 *    |   |                      |   |
 *    | 4 |          5           | 6 |
 *    |   |                      |   |
 *    +---+----------------------+---+
 *  D | 7 |          8           | 9 |
 *    +---+----------------------+---+

 *  When changing this objects width and/or height:
 *     areas 1 3 7 and 9 will remain unscaled.
 *     areas 2 and 8 will be stretched horizontally
 *     areas 4 and 6 will be stretched vertically
 *     area 5 will be stretched both horizontally and vertically
 * </pre>
 *
 * @class
 * @extends PIXI.SimplePlane
 * @memberof PIXI
 *
 */
var NineSlicePlane = /** @class */ (function (_super) {
    __extends$d(NineSlicePlane, _super);
    /**
     * @param {PIXI.Texture} texture - The texture to use on the NineSlicePlane.
     * @param {number} [leftWidth=10] - size of the left vertical bar (A)
     * @param {number} [topHeight=10] - size of the top horizontal bar (C)
     * @param {number} [rightWidth=10] - size of the right vertical bar (B)
     * @param {number} [bottomHeight=10] - size of the bottom horizontal bar (D)
     */
    function NineSlicePlane(texture, leftWidth, topHeight, rightWidth, bottomHeight) {
        if (leftWidth === void 0) { leftWidth = DEFAULT_BORDER_SIZE; }
        if (topHeight === void 0) { topHeight = DEFAULT_BORDER_SIZE; }
        if (rightWidth === void 0) { rightWidth = DEFAULT_BORDER_SIZE; }
        if (bottomHeight === void 0) { bottomHeight = DEFAULT_BORDER_SIZE; }
        var _this = _super.call(this, Texture.WHITE, 4, 4) || this;
        _this._origWidth = texture.orig.width;
        _this._origHeight = texture.orig.height;
        /**
         * The width of the NineSlicePlane, setting this will actually modify the vertices and UV's of this plane
         *
         * @member {number}
         * @override
         */
        _this._width = _this._origWidth;
        /**
         * The height of the NineSlicePlane, setting this will actually modify the vertices and UV's of this plane
         *
         * @member {number}
         * @override
         */
        _this._height = _this._origHeight;
        /**
         * The width of the left column (a)
         *
         * @member {number}
         * @private
         */
        _this._leftWidth = leftWidth;
        /**
         * The width of the right column (b)
         *
         * @member {number}
         * @private
         */
        _this._rightWidth = rightWidth;
        /**
         * The height of the top row (c)
         *
         * @member {number}
         * @private
         */
        _this._topHeight = topHeight;
        /**
         * The height of the bottom row (d)
         *
         * @member {number}
         * @private
         */
        _this._bottomHeight = bottomHeight;
        // lets call the setter to ensure all necessary updates are performed
        _this.texture = texture;
        return _this;
    }
    NineSlicePlane.prototype.textureUpdated = function () {
        this._textureID = this.shader.texture._updateID;
        this._refresh();
    };
    Object.defineProperty(NineSlicePlane.prototype, "vertices", {
        get: function () {
            return this.geometry.getBuffer('aVertexPosition').data;
        },
        set: function (value) {
            this.geometry.getBuffer('aVertexPosition').data = value;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Updates the horizontal vertices.
     *
     */
    NineSlicePlane.prototype.updateHorizontalVertices = function () {
        var vertices = this.vertices;
        var scale = this._getMinScale();
        vertices[9] = vertices[11] = vertices[13] = vertices[15] = this._topHeight * scale;
        vertices[17] = vertices[19] = vertices[21] = vertices[23] = this._height - (this._bottomHeight * scale);
        vertices[25] = vertices[27] = vertices[29] = vertices[31] = this._height;
    };
    /**
     * Updates the vertical vertices.
     *
     */
    NineSlicePlane.prototype.updateVerticalVertices = function () {
        var vertices = this.vertices;
        var scale = this._getMinScale();
        vertices[2] = vertices[10] = vertices[18] = vertices[26] = this._leftWidth * scale;
        vertices[4] = vertices[12] = vertices[20] = vertices[28] = this._width - (this._rightWidth * scale);
        vertices[6] = vertices[14] = vertices[22] = vertices[30] = this._width;
    };
    /**
     * Returns the smaller of a set of vertical and horizontal scale of nine slice corners.
     *
     * @return {number} Smaller number of vertical and horizontal scale.
     * @private
     */
    NineSlicePlane.prototype._getMinScale = function () {
        var w = this._leftWidth + this._rightWidth;
        var scaleW = this._width > w ? 1.0 : this._width / w;
        var h = this._topHeight + this._bottomHeight;
        var scaleH = this._height > h ? 1.0 : this._height / h;
        var scale = Math.min(scaleW, scaleH);
        return scale;
    };
    Object.defineProperty(NineSlicePlane.prototype, "width", {
        /**
         * The width of the NineSlicePlane, setting this will actually modify the vertices and UV's of this plane
         *
         * @member {number}
         */
        get: function () {
            return this._width;
        },
        set: function (value) {
            this._width = value;
            this._refresh();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NineSlicePlane.prototype, "height", {
        /**
         * The height of the NineSlicePlane, setting this will actually modify the vertices and UV's of this plane
         *
         * @member {number}
         */
        get: function () {
            return this._height;
        },
        set: function (value) {
            this._height = value;
            this._refresh();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NineSlicePlane.prototype, "leftWidth", {
        /**
         * The width of the left column
         *
         * @member {number}
         */
        get: function () {
            return this._leftWidth;
        },
        set: function (value) {
            this._leftWidth = value;
            this._refresh();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NineSlicePlane.prototype, "rightWidth", {
        /**
         * The width of the right column
         *
         * @member {number}
         */
        get: function () {
            return this._rightWidth;
        },
        set: function (value) {
            this._rightWidth = value;
            this._refresh();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NineSlicePlane.prototype, "topHeight", {
        /**
         * The height of the top row
         *
         * @member {number}
         */
        get: function () {
            return this._topHeight;
        },
        set: function (value) {
            this._topHeight = value;
            this._refresh();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NineSlicePlane.prototype, "bottomHeight", {
        /**
         * The height of the bottom row
         *
         * @member {number}
         */
        get: function () {
            return this._bottomHeight;
        },
        set: function (value) {
            this._bottomHeight = value;
            this._refresh();
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Refreshes NineSlicePlane coords. All of them.
     */
    NineSlicePlane.prototype._refresh = function () {
        var texture = this.texture;
        var uvs = this.geometry.buffers[1].data;
        this._origWidth = texture.orig.width;
        this._origHeight = texture.orig.height;
        var _uvw = 1.0 / this._origWidth;
        var _uvh = 1.0 / this._origHeight;
        uvs[0] = uvs[8] = uvs[16] = uvs[24] = 0;
        uvs[1] = uvs[3] = uvs[5] = uvs[7] = 0;
        uvs[6] = uvs[14] = uvs[22] = uvs[30] = 1;
        uvs[25] = uvs[27] = uvs[29] = uvs[31] = 1;
        uvs[2] = uvs[10] = uvs[18] = uvs[26] = _uvw * this._leftWidth;
        uvs[4] = uvs[12] = uvs[20] = uvs[28] = 1 - (_uvw * this._rightWidth);
        uvs[9] = uvs[11] = uvs[13] = uvs[15] = _uvh * this._topHeight;
        uvs[17] = uvs[19] = uvs[21] = uvs[23] = 1 - (_uvh * this._bottomHeight);
        this.updateHorizontalVertices();
        this.updateVerticalVertices();
        this.geometry.buffers[0].update();
        this.geometry.buffers[1].update();
    };
    return NineSlicePlane;
}(SimplePlane));

/*!
 * @pixi/sprite-animated - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * @pixi/sprite-animated is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$e = function(d, b) {
    extendStatics$e = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };
    return extendStatics$e(d, b);
};

function __extends$e(d, b) {
    extendStatics$e(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

/**
 * An AnimatedSprite is a simple way to display an animation depicted by a list of textures.
 *
 * ```js
 * let alienImages = ["image_sequence_01.png","image_sequence_02.png","image_sequence_03.png","image_sequence_04.png"];
 * let textureArray = [];
 *
 * for (let i=0; i < 4; i++)
 * {
 *      let texture = PIXI.Texture.from(alienImages[i]);
 *      textureArray.push(texture);
 * };
 *
 * let animatedSprite = new PIXI.AnimatedSprite(textureArray);
 * ```
 *
 * The more efficient and simpler way to create an animated sprite is using a {@link PIXI.Spritesheet}
 * containing the animation definitions:
 *
 * ```js
 * PIXI.Loader.shared.add("assets/spritesheet.json").load(setup);
 *
 * function setup() {
 *   let sheet = PIXI.Loader.shared.resources["assets/spritesheet.json"].spritesheet;
 *   animatedSprite = new PIXI.AnimatedSprite(sheet.animations["image_sequence"]);
 *   ...
 * }
 * ```
 *
 * @class
 * @extends PIXI.Sprite
 * @memberof PIXI
 */
var AnimatedSprite = /** @class */ (function (_super) {
    __extends$e(AnimatedSprite, _super);
    /**
     * @param {PIXI.Texture[]|PIXI.AnimatedSprite.FrameObject[]} textures - An array of {@link PIXI.Texture} or frame
     *  objects that make up the animation.
     * @param {boolean} [autoUpdate=true] - Whether to use PIXI.Ticker.shared to auto update animation time.
     */
    function AnimatedSprite(textures, autoUpdate) {
        if (autoUpdate === void 0) { autoUpdate = true; }
        var _this = _super.call(this, textures[0] instanceof Texture ? textures[0] : textures[0].texture) || this;
        /**
         * @type {PIXI.Texture[]}
         * @private
         */
        _this._textures = null;
        /**
         * @type {number[]}
         * @private
         */
        _this._durations = null;
        /**
         * `true` uses PIXI.Ticker.shared to auto update animation time.
         *
         * @type {boolean}
         * @default true
         * @private
         */
        _this._autoUpdate = autoUpdate;
        /**
         * `true` if the instance is currently connected to PIXI.Ticker.shared to auto update animation time.
         *
         * @type {boolean}
         * @default false
         * @private
         */
        _this._isConnectedToTicker = false;
        /**
         * The speed that the AnimatedSprite will play at. Higher is faster, lower is slower.
         *
         * @member {number}
         * @default 1
         */
        _this.animationSpeed = 1;
        /**
         * Whether or not the animate sprite repeats after playing.
         *
         * @member {boolean}
         * @default true
         */
        _this.loop = true;
        /**
         * Update anchor to [Texture's defaultAnchor]{@link PIXI.Texture#defaultAnchor} when frame changes.
         *
         * Useful with [sprite sheet animations]{@link PIXI.Spritesheet#animations} created with tools.
         * Changing anchor for each frame allows to pin sprite origin to certain moving feature
         * of the frame (e.g. left foot).
         *
         * Note: Enabling this will override any previously set `anchor` on each frame change.
         *
         * @member {boolean}
         * @default false
         */
        _this.updateAnchor = false;
        /**
         * User-assigned function to call when an AnimatedSprite finishes playing.
         *
         * @example
         * animation.onComplete = function () {
         *   // finished!
         * };
         * @member {Function}
         */
        _this.onComplete = null;
        /**
         * User-assigned function to call when an AnimatedSprite changes which texture is being rendered.
         *
         * @example
         * animation.onFrameChange = function () {
         *   // updated!
         * };
         * @member {Function}
         */
        _this.onFrameChange = null;
        /**
         * User-assigned function to call when `loop` is true, and an AnimatedSprite is played and
         * loops around to start again.
         *
         * @example
         * animation.onLoop = function () {
         *   // looped!
         * };
         * @member {Function}
         */
        _this.onLoop = null;
        /**
         * Elapsed time since animation has been started, used internally to display current texture.
         *
         * @member {number}
         * @private
         */
        _this._currentTime = 0;
        _this._playing = false;
        /**
         * The texture index that was displayed last time
         *
         * @member {number}
         * @private
         */
        _this._previousFrame = null;
        _this.textures = textures;
        return _this;
    }
    /**
     * Stops the AnimatedSprite.
     *
     */
    AnimatedSprite.prototype.stop = function () {
        if (!this._playing) {
            return;
        }
        this._playing = false;
        if (this._autoUpdate && this._isConnectedToTicker) {
            Ticker.shared.remove(this.update, this);
            this._isConnectedToTicker = false;
        }
    };
    /**
     * Plays the AnimatedSprite.
     *
     */
    AnimatedSprite.prototype.play = function () {
        if (this._playing) {
            return;
        }
        this._playing = true;
        if (this._autoUpdate && !this._isConnectedToTicker) {
            Ticker.shared.add(this.update, this, UPDATE_PRIORITY.HIGH);
            this._isConnectedToTicker = true;
        }
    };
    /**
     * Stops the AnimatedSprite and goes to a specific frame.
     *
     * @param {number} frameNumber - Frame index to stop at.
     */
    AnimatedSprite.prototype.gotoAndStop = function (frameNumber) {
        this.stop();
        var previousFrame = this.currentFrame;
        this._currentTime = frameNumber;
        if (previousFrame !== this.currentFrame) {
            this.updateTexture();
        }
    };
    /**
     * Goes to a specific frame and begins playing the AnimatedSprite.
     *
     * @param {number} frameNumber - Frame index to start at.
     */
    AnimatedSprite.prototype.gotoAndPlay = function (frameNumber) {
        var previousFrame = this.currentFrame;
        this._currentTime = frameNumber;
        if (previousFrame !== this.currentFrame) {
            this.updateTexture();
        }
        this.play();
    };
    /**
     * Updates the object transform for rendering.
     *
     * @param {number} deltaTime - Time since last tick.
     */
    AnimatedSprite.prototype.update = function (deltaTime) {
        if (!this._playing) {
            return;
        }
        var elapsed = this.animationSpeed * deltaTime;
        var previousFrame = this.currentFrame;
        if (this._durations !== null) {
            var lag = this._currentTime % 1 * this._durations[this.currentFrame];
            lag += elapsed / 60 * 1000;
            while (lag < 0) {
                this._currentTime--;
                lag += this._durations[this.currentFrame];
            }
            var sign = Math.sign(this.animationSpeed * deltaTime);
            this._currentTime = Math.floor(this._currentTime);
            while (lag >= this._durations[this.currentFrame]) {
                lag -= this._durations[this.currentFrame] * sign;
                this._currentTime += sign;
            }
            this._currentTime += lag / this._durations[this.currentFrame];
        }
        else {
            this._currentTime += elapsed;
        }
        if (this._currentTime < 0 && !this.loop) {
            this.gotoAndStop(0);
            if (this.onComplete) {
                this.onComplete();
            }
        }
        else if (this._currentTime >= this._textures.length && !this.loop) {
            this.gotoAndStop(this._textures.length - 1);
            if (this.onComplete) {
                this.onComplete();
            }
        }
        else if (previousFrame !== this.currentFrame) {
            if (this.loop && this.onLoop) {
                if (this.animationSpeed > 0 && this.currentFrame < previousFrame) {
                    this.onLoop();
                }
                else if (this.animationSpeed < 0 && this.currentFrame > previousFrame) {
                    this.onLoop();
                }
            }
            this.updateTexture();
        }
    };
    /**
     * Updates the displayed texture to match the current frame index.
     *
     * @private
     */
    AnimatedSprite.prototype.updateTexture = function () {
        var currentFrame = this.currentFrame;
        if (this._previousFrame === currentFrame) {
            return;
        }
        this._previousFrame = currentFrame;
        this._texture = this._textures[currentFrame];
        this._textureID = -1;
        this._textureTrimmedID = -1;
        this._cachedTint = 0xFFFFFF;
        this.uvs = this._texture._uvs.uvsFloat32;
        if (this.updateAnchor) {
            this._anchor.copyFrom(this._texture.defaultAnchor);
        }
        if (this.onFrameChange) {
            this.onFrameChange(this.currentFrame);
        }
    };
    /**
     * Stops the AnimatedSprite and destroys it.
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
     *  have been set to that value.
     * @param {boolean} [options.children=false] - If set to true, all the children will have their destroy
     *      method called as well. 'options' will be passed on to those calls.
     * @param {boolean} [options.texture=false] - Should it destroy the current texture of the sprite as well.
     * @param {boolean} [options.baseTexture=false] - Should it destroy the base texture of the sprite as well.
     */
    AnimatedSprite.prototype.destroy = function (options) {
        this.stop();
        _super.prototype.destroy.call(this, options);
        this.onComplete = null;
        this.onFrameChange = null;
        this.onLoop = null;
    };
    /**
     * A short hand way of creating an AnimatedSprite from an array of frame ids.
     *
     * @static
     * @param {string[]} frames - The array of frames ids the AnimatedSprite will use as its texture frames.
     * @return {PIXI.AnimatedSprite} The new animated sprite with the specified frames.
     */
    AnimatedSprite.fromFrames = function (frames) {
        var textures = [];
        for (var i = 0; i < frames.length; ++i) {
            textures.push(Texture.from(frames[i]));
        }
        return new AnimatedSprite(textures);
    };
    /**
     * A short hand way of creating an AnimatedSprite from an array of image ids.
     *
     * @static
     * @param {string[]} images - The array of image urls the AnimatedSprite will use as its texture frames.
     * @return {PIXI.AnimatedSprite} The new animate sprite with the specified images as frames.
     */
    AnimatedSprite.fromImages = function (images) {
        var textures = [];
        for (var i = 0; i < images.length; ++i) {
            textures.push(Texture.from(images[i]));
        }
        return new AnimatedSprite(textures);
    };
    Object.defineProperty(AnimatedSprite.prototype, "totalFrames", {
        /**
         * The total number of frames in the AnimatedSprite. This is the same as number of textures
         * assigned to the AnimatedSprite.
         *
         * @readonly
         * @member {number}
         * @default 0
         */
        get: function () {
            return this._textures.length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AnimatedSprite.prototype, "textures", {
        /**
         * The array of textures used for this AnimatedSprite.
         *
         * @member {PIXI.Texture[]}
         */
        get: function () {
            return this._textures;
        },
        set: function (value) {
            if (value[0] instanceof Texture) {
                this._textures = value;
                this._durations = null;
            }
            else {
                this._textures = [];
                this._durations = [];
                for (var i = 0; i < value.length; i++) {
                    this._textures.push(value[i].texture);
                    this._durations.push(value[i].time);
                }
            }
            this._previousFrame = null;
            this.gotoAndStop(0);
            this.updateTexture();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AnimatedSprite.prototype, "currentFrame", {
        /**
        * The AnimatedSprites current frame index.
        *
        * @member {number}
        * @readonly
        */
        get: function () {
            var currentFrame = Math.floor(this._currentTime) % this._textures.length;
            if (currentFrame < 0) {
                currentFrame += this._textures.length;
            }
            return currentFrame;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AnimatedSprite.prototype, "playing", {
        /**
         * Indicates if the AnimatedSprite is currently playing.
         *
         * @member {boolean}
         * @readonly
         */
        get: function () {
            return this._playing;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AnimatedSprite.prototype, "autoUpdate", {
        /**
         * Whether to use PIXI.Ticker.shared to auto update animation time
         *
         * @member {boolean}
         */
        get: function () {
            return this._autoUpdate;
        },
        set: function (value) {
            if (value !== this._autoUpdate) {
                this._autoUpdate = value;
                if (!this._autoUpdate && this._isConnectedToTicker) {
                    Ticker.shared.remove(this.update, this);
                    this._isConnectedToTicker = false;
                }
                else if (this._autoUpdate && !this._isConnectedToTicker && this._playing) {
                    Ticker.shared.add(this.update, this);
                    this._isConnectedToTicker = true;
                }
            }
        },
        enumerable: false,
        configurable: true
    });
    return AnimatedSprite;
}(Sprite));

/*!
 * pixi.js - v6.1.2
 * Compiled Thu, 12 Aug 2021 17:11:19 UTC
 *
 * pixi.js is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */

// Install renderer plugins
Renderer.registerPlugin('accessibility', AccessibilityManager);
Renderer.registerPlugin('extract', Extract);
Renderer.registerPlugin('interaction', InteractionManager);
Renderer.registerPlugin('particle', ParticleRenderer);
Renderer.registerPlugin('prepare', Prepare);
Renderer.registerPlugin('batch', BatchRenderer);
Renderer.registerPlugin('tilingSprite', TilingSpriteRenderer);
// Install loader plugins
Loader.registerPlugin(BitmapFontLoader);
Loader.registerPlugin(CompressedTextureLoader);
Loader.registerPlugin(DDSLoader);
Loader.registerPlugin(KTXLoader);
Loader.registerPlugin(SpritesheetLoader);
// Install application plugins
Application.registerPlugin(TickerPlugin);
Application.registerPlugin(AppLoaderPlugin);
/**
 * String of the current PIXI version.
 *
 * @static
 * @constant
 * @memberof PIXI
 * @name VERSION
 * @type {string}
 */
var VERSION = '6.1.2';
/**
 * @namespace PIXI
 */
/**
 * This namespace contains WebGL-only display filters that can be applied
 * to DisplayObjects using the {@link PIXI.DisplayObject#filters filters} property.
 *
 * Since PixiJS only had a handful of built-in filters, additional filters
 * can be downloaded {@link https://github.com/pixijs/pixi-filters here} from the
 * PixiJS Filters repository.
 *
 * All filters must extend {@link PIXI.Filter}.
 *
 * @example
 * // Create a new application
 * const app = new PIXI.Application();
 *
 * // Draw a green rectangle
 * const rect = new PIXI.Graphics()
 *     .beginFill(0x00ff00)
 *     .drawRect(40, 40, 200, 200);
 *
 * // Add a blur filter
 * rect.filters = [new PIXI.filters.BlurFilter()];
 *
 * // Display rectangle
 * app.stage.addChild(rect);
 * document.body.appendChild(app.view);
 * @namespace PIXI.filters
 */
var filters = {
    AlphaFilter: AlphaFilter,
    BlurFilter: BlurFilter,
    BlurFilterPass: BlurFilterPass,
    ColorMatrixFilter: ColorMatrixFilter,
    DisplacementFilter: DisplacementFilter,
    FXAAFilter: FXAAFilter,
    NoiseFilter: NoiseFilter,
};

export { AccessibilityManager, AnimatedSprite, AppLoaderPlugin, Application, BasePrepare, BitmapFont, BitmapFontData, BitmapFontLoader, BitmapText, BlobResource, CompressedTextureLoader, CompressedTextureResource, CountLimiter, DDSLoader, Extract, FORMATS_TO_COMPONENTS, INTERNAL_FORMATS, INTERNAL_FORMAT_TO_BYTES_PER_PIXEL, InteractionData, InteractionEvent, InteractionManager, InteractionTrackingData, KTXLoader, Loader, LoaderResource, Mesh, MeshBatchUvs, MeshGeometry, MeshMaterial, NineSlicePlane, ParticleContainer, ParticleRenderer, PlaneGeometry, Prepare, RopeGeometry, SimpleMesh, SimplePlane, SimpleRope, Sprite, Spritesheet, SpritesheetLoader, TEXT_GRADIENT, TYPES_TO_BYTES_PER_COMPONENT, TYPES_TO_BYTES_PER_PIXEL, Text, TextMetrics, TextStyle, TextureLoader, TilingSprite, TilingSpriteRenderer, TimeLimiter, VERSION, accessibleTarget, filters, interactiveTarget };
