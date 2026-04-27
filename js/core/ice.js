// @ts-check
// Re-export surface for backward compatibility during the ICE reinvention
// migration. All runtime logic lives in js/core/ice/runtime.js.

export {
  startIce, stopIce, initIceHandlers,
  handleIceTick, handleIceDetect, cancelIceDwell,
  teleportIce, ejectIce, disableIce, rebootIce,
} from "./ice/runtime.js";
