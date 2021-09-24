import { c as createCommonjsModule, a as commonjsGlobal } from './common/_commonjsHelpers-798ad6a7.NdjIFkBWvq6n.js';

var mainloop_min = createCommonjsModule(function (module) {
/**
 * mainloop.js 1.0.3-20170529
 *
 * @author Isaac Sukin (http://www.isaacsukin.com/)
 * @license MIT
 */

!function(a){function b(a){if(x=q(b),!(a<e+l)){for(d+=a-e,e=a,t(a,d),a>i+h&&(f=g*j*1e3/(a-i)+(1-g)*f,i=a,j=0),j++,k=0;d>=c;)if(u(c),d-=c,++k>=240){o=!0;break}v(d/c),w(f,o),o=!1;}}var c=1e3/60,d=0,e=0,f=60,g=.9,h=1e3,i=0,j=0,k=0,l=0,m=!1,n=!1,o=!1,p="object"==typeof window?window:a,q=p.requestAnimationFrame||function(){var a=Date.now(),b,d;return function(e){return b=Date.now(),d=Math.max(0,c-(b-a)),a=b+d,setTimeout(function(){e(b+d);},d)}}(),r=p.cancelAnimationFrame||clearTimeout,s=function(){},t=s,u=s,v=s,w=s,x;a.MainLoop={getSimulationTimestep:function(){return c},setSimulationTimestep:function(a){return c=a,this},getFPS:function(){return f},getMaxAllowedFPS:function(){return 1e3/l},setMaxAllowedFPS:function(a){return "undefined"==typeof a&&(a=1/0),0===a?this.stop():l=1e3/a,this},resetFrameDelta:function(){var a=d;return d=0,a},setBegin:function(a){return t=a||t,this},setUpdate:function(a){return u=a||u,this},setDraw:function(a){return v=a||v,this},setEnd:function(a){return w=a||w,this},start:function(){return n||(n=!0,x=q(function(a){v(1),m=!0,e=a,i=a,j=0,x=q(b);})),this},stop:function(){return m=!1,n=!1,r(x),this},isRunning:function(){return m}},null!==module&&"object"=='object'&&(module.exports=a.MainLoop);}(commonjsGlobal);

});

export default mainloop_min;
var getFPS = mainloop_min.getFPS;
var getMaxAllowedFPS = mainloop_min.getMaxAllowedFPS;
var getSimulationTimestep = mainloop_min.getSimulationTimestep;
var isRunning = mainloop_min.isRunning;
var resetFrameDelta = mainloop_min.resetFrameDelta;
var setBegin = mainloop_min.setBegin;
var setDraw = mainloop_min.setDraw;
var setEnd = mainloop_min.setEnd;
var setMaxAllowedFPS = mainloop_min.setMaxAllowedFPS;
var setSimulationTimestep = mainloop_min.setSimulationTimestep;
var setUpdate = mainloop_min.setUpdate;
var start = mainloop_min.start;
var stop = mainloop_min.stop;
export { mainloop_min as __moduleExports, getFPS, getMaxAllowedFPS, getSimulationTimestep, isRunning, resetFrameDelta, setBegin, setDraw, setEnd, setMaxAllowedFPS, setSimulationTimestep, setUpdate, start, stop };
