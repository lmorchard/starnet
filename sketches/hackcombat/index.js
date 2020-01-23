import {
  html,
  render,
  createContext,
  useContext,
  useReducer,
  useState,
  useCallback,
  useEffect
} from "./htm-preact.js"; // TODO: https://github.com/developit/htm/pull/146

import { useRng, pick, shuffled } from "../../lib/utils.js";

import {
  ExploitSet,
  VulnerabilitySet,
  EXPLOIT_RARITIES,
  VULNERABILITY_GRADES
} from "./combat.js";

const EXPLOITS_PER_PACK = 5;

const initialState = {
  log: [],
  wallet: 10000,
  exploitPackCost: 1000,
  exploits: null,
  newlyPurchasedExploits: [],
  playerExploits: new Set(),
  target: null,
  showVulnerabilities: false,
  isHacking: false,
  launchedExploit: null
};

async function init() {
  useRng(Math.seedrandom);
  initialState.exploits = new ExploitSet({ seed: "8675309", count: 100 });
  render(
    html`
      <${App} ...${{ initialState }} />
    `,
    document.getElementById("game")
  );
}

const wait = delay => new Promise(resolve => setTimeout(resolve, delay));

const reducer = (state, [type, param]) => {
  switch (type) {
    case "set": {
      return { ...state, ...param };
    }
    case "log": {
      return { ...state, log: [`${Date.now()}: ${param}`, ...state.log] };
    }
    case "clearLog": {
      return { ...state, log: [] };
    }
    default:
      return state;
  }
};

const reducerContext = createContext();

const App = ({ initialState }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const contextValue = { state, dispatch };

  useEffect(() => {
    dispatch(["log", "Booting up..."]);
    newTargetHost({ state, dispatch });
    purchaseExploitPack({ state, dispatch });
  }, []);

  return html`
    <${reducerContext.Provider} value=${contextValue}>
      <main class="app">
        <${TargetHost} />
        <${ActivityLog} />
        <${Market} />
        <${Inventory} />
      </main>
    <//>
  `;
};

const TargetHost = ({}) => {
  const { state, dispatch } = useContext(reducerContext);
  const { target, showVulnerabilities } = state;
  const clickTargetNewHost = useCallback(
    () => newTargetHost({ state, dispatch }),
    [state, dispatch]
  );
  const clickToggleVulnerabilities = useCallback(
    () => dispatch(["set", { showVulnerabilities: !showVulnerabilities }]),
    [state, dispatch]
  );
  const clickLaunchExploits = useCallback(
    () => launchExploits({ state, dispatch }),
    [state, dispatch]
  );
  if (!target) {
    return html`
      <section class="target">
        <h2>Target</h2>
        <ul class="actions">
          <li>
            <button onClick=${clickTargetNewHost}>
              Scan New Target Host
            </button>
          </li>
        </ul>
        <div class="target">
          <ul>
            <li>Disconnected</li>
          </ul>
        </div>
      </section>
    `;
  }
  return html`
    <section class="target">
      <h2>Target</h2>
      <ul class="actions">
        <li>
          <button onClick=${clickTargetNewHost}>
            Scan New Target Host
          </button>
        </li>
        <li>
          <button onClick=${clickLaunchExploits}>
            Launch exploits
          </button>
        </li>

        <li>
          <button onClick=${clickToggleVulnerabilities}>
            [CHEAT] ${showVulnerabilities ? "Hide" : "Reveal"} Vulnerabilities
          </button>
        </li>
      </ul>
      <div class="target">
        <ul>
          <li>ID: ${target.seed}</li>
          <li>Grade: ${target.grade}</li>
          <li>
            Vulnerabilities:
            ${showVulnerabilities
              ? html`
                  <ul class="vulnerabilities exploits">
                    ${target
                      .listVulnerabilities()
                      .map(exploit => Exploit({ state, exploit }))}
                  </ul>
                `
              : " (hidden)"}
          </li>
        </ul>
      </div>
    </section>
  `;
};

const Market = ({}) => {
  const { state, dispatch } = useContext(reducerContext);
  const clickPurchaseExploitPack = useCallback(
    () => purchaseExploitPack({ state, dispatch }),
    [state, dispatch]
  );
  return html`
    <section class="market">
      <h2>Market</h2>
      <ul class="actions">
        <li>
          <button onClick=${clickPurchaseExploitPack}>
            Buy Exploit Pack ($${state.exploitPackCost})
          </button>
        </li>
      </ul>
    </section>
  `;
};

const Inventory = ({}) => {
  const { state, dispatch } = useContext(reducerContext);
  const clickedTrashDisclosedExploits = useCallback(
    () => trashDisclosedExploits({ state, dispatch }),
    [state, dispatch]
  );
  return html`
    <section class="inventory">
      <h2>Inventory</h2>
      <ul class="actions">
        <li>
          <button onClick=${clickedTrashDisclosedExploits}>
            Trash disclosed exploits
          </button>
        </li>
      </ul>
      <ul>
        <li class="funds">Funds: <span>$${state.wallet}</span></li>
        <li>
          Exploits:
          <ul class="exploits">
            ${Array.from(state.playerExploits.values())
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(exploit => Exploit({ state, exploit }))}
          </ul>
        </li>
      </ul>
    </section>
  `;
};

const ActivityLog = ({}) => {
  const { state, dispatch } = useContext(reducerContext);
  const clickClear = useCallback(() => dispatch(["clearLog"]), [
    state,
    dispatch
  ]);
  const { log } = state;
  return html`
    <section class="log">
      <h2>Activity log</h2>
      <ul class="actions">
        <li>
          <button onClick=${clickClear}>Clear</button>
        </li>
      </ul>
      <ul class="entries">
        ${log.map(
          entry =>
            html`
              <li class="entry">${entry}</li>
            `
        )}
      </ul>
    </section>
  `;
};

const Exploit = ({ exploit, state }) => html`
  <li
    class=${[
      "exploit",
      exploit.rarity,
      state.newlyPurchasedExploits.includes(exploit) ? "new" : "",
      state.launchedExploit === exploit ? "launched" : "",
      exploit.disclosure ? "disclosed" : ""
    ].join(" ")}
    title=${exploit.disclosure ? exploit.disclosure.name : ""}
    key=${exploit.name}
  >
    ${exploit.name}
  </li>
`;

function newTargetHost({ state, dispatch }) {
  const grade = pick(Math.random, Object.keys(VULNERABILITY_GRADES));
  const target = new VulnerabilitySet({
    seed: Math.floor(0xffffffff * Math.random())
      .toString(16)
      .padStart(8, "0"),
    grade,
    exploits: state.exploits
  });
  dispatch(["set", { target }]);
  dispatch(["log", `New host ${target.seed} scanned`]);
}

function purchaseExploitPack({
  state: { exploitPackCost, wallet, exploits, playerExploits },
  dispatch
}) {
  if (wallet - exploitPackCost < 0) {
    return;
  }
  const undisclosedExploits = shuffled(Math.random, exploits.listExploits().filter(exploit => !exploit.disclosure));
  const purchasedExploits = undisclosedExploits.slice(0, EXPLOITS_PER_PACK);
  const ownedExploits = [...playerExploits.values()];
  const newlyDiscovered = purchasedExploits.filter(
    exploit => !ownedExploits.includes(exploit)
  );
  dispatch([
    "set",
    {
      wallet: wallet - exploitPackCost,
      newlyPurchasedExploits: purchasedExploits,
      playerExploits: new Set([...ownedExploits, ...purchasedExploits])
    }
  ]);
  dispatch([
    "log",
    `Purchased exploit pack - ${purchasedExploits.length} purchased, ${
      newlyDiscovered.length
    } new, ${purchasedExploits.length - newlyDiscovered.length} already owned`
  ]);
}

function trashDisclosedExploits({ state, dispatch }) {
  const { playerExploits } = state;
  const disclosedExploits = [...playerExploits.values()].filter(
    exploit => !!exploit.disclosure
  );
  dispatch([
    "set",
    {
      playerExploits: new Set(
        [...playerExploits.values()].filter(
          exploit => !disclosedExploits.includes(exploit)
        )
      )
    }
  ]);
  dispatch(["log", `Trashed ${disclosedExploits.length} disclosed exploits`]);
}

async function launchExploits({ state, dispatch }) {
  const { target, playerExploits } = state;
  const toLaunch = shuffled(Math.random, [...playerExploits.values()]);

  let success = null;

  dispatch(["set", { isHacking: true }]);
  for (const exploit of toLaunch) {
    if (exploit.disclosure) {
      // continue;
    }

    dispatch(["log", `Running exploit ${exploit.name}...`]);
    dispatch(["set", { launchedExploit: exploit }]);
    await wait(200);

    console.log(Math.random(), target.disclosureChance);
    if (!exploit.disclosure && Math.random() < target.disclosureChance) {
      exploit.disclose();
      dispatch([
        "log",
        `Exploit ${exploit.name} detected and disclosed as ${exploit.disclosure.name}!`
      ]);
    }

    if (target.isVulnerableTo(exploit)) {
      success = exploit;
      break;
    }
  }

  if (success) {
    dispatch(["log", `ACCESS GRANTED to target ${target.seed}`]);
    await lootTarget({ state, dispatch, exploit: success, target });
  } else {
    dispatch(["log", `ACCESS DENIED to target ${target.seed}`]);
  }

  dispatch(["set", { launchedExploit: null }]);
  dispatch(["set", { isHacking: false }]);
  dispatch(["set", { target: null }]);
  dispatch(["log", `Disconnecting from target ${target.seed}`]);
}

async function lootTarget({ state, dispatch, exploit, target }) {
  const { wallet } = state;
  let cash = 0;
  switch (target.grade) {
    case "S":
      cash = 10000;
      break;
    case "A":
      cash = 5000;
      break;
    case "B":
      cash = 2000;
      break;
    case "C":
      cash = 1000;
      break;
    case "D":
      cash = 500;
      break;
    case "E":
      cash = 250;
      break;
    case "F":
      cash = 100;
      break;
  }
  dispatch(["set", { wallet: wallet + cash }]);
  dispatch(["log", `Absconded with $${cash} from target ${target.seed}`]);
}

init().catch(console.error);
