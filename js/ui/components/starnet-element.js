// Base class for all Starnet web components.
// Light DOM only — no shadow DOM, components inherit global css/style.css.

import { LitElement } from "lit";

export class StarnetElement extends LitElement {
  createRenderRoot() { return this; }
}
