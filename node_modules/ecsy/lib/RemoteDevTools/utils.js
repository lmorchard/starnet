"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateId = generateId;
exports.injectScript = injectScript;

function generateId(length) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var charactersLength = characters.length;

  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

function injectScript(src, onLoad) {
  var script = document.createElement("script"); // @todo Use link to the ecsy-devtools repo?

  script.src = src;
  script.onload = onLoad;
  (document.head || document.documentElement).appendChild(script);
}