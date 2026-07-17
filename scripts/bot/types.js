// @ts-check
// Bot player type definitions — JSDoc typedefs only, no runtime code.

/**
 * @typedef {Object} WorldNode
 * @property {string} id
 * @property {string} label
 * @property {string} type
 * @property {string} accessLevel
 * @property {string} visibility
 * @property {string} grade
 * @property {boolean} probed
 * @property {boolean} [read]
 * @property {boolean} [looted]
 * @property {boolean} [rebooting]
 * @property {boolean} [forwardingEnabled]
 * @property {any[]} [vulnerabilities]
 * @property {any[]} [macguffins]
 */

/**
 * @typedef {Object} WorldIce
 * @property {{ nodeId: string, grade: string }[]} instances — all active ICE instances
 * @property {string|null} nodeId — attention node of the instance on the selected node, else the first active instance
 * @property {boolean} isOnSelectedNode — true if ANY active instance is on the selected node
 * @property {boolean} isActive — true if any ICE instance is active
 */

/**
 * @typedef {Object} WorldPlayer
 * @property {string|null} selectedNodeId
 * @property {number} cash
 * @property {string} alertLevel — "green", "yellow", "red"
 * @property {boolean} traceActive
 * @property {number|null} traceCountdown — seconds remaining, or null
 */

/**
 * @typedef {Object} WorldMission
 * @property {string|null} targetMacguffinId
 * @property {string|null} targetName
 * @property {boolean} complete
 * @property {string|null} targetNodeId — node containing the mission macguffin, if known
 */

/**
 * @typedef {Object} WorldModel
 * @property {Map<string, WorldNode>} nodes — all visible nodes by ID
 * @property {Object<string, string[]>} adjacency
 * @property {string[]} revealed — revealed but not yet accessible (select to traverse)
 * @property {string[]} accessible — visible, not owned, not WAN
 * @property {string[]} owned
 * @property {string[]} needsProbe — accessible + not probed
 * @property {string[]} needsExploit — accessible + probed + not owned
 * @property {string[]} lootable — owned + (not read or has uncollected macguffins)
 * @property {string[]} security — IDS / security-monitor nodes
 * @property {string[]} hasDisarmActions — owned nodes with disarm-* actions
 * @property {{ nodeId: string, vulnTypes: Set<string> }[]} minable — owned nodes whose mine action is still available
 * @property {WorldIce} ice
 * @property {WorldPlayer} player
 * @property {import('../../js/core/types.js').ExploitRound[]} hoard — the exploit hoard (ammo)
 * @property {number} hoardUsable — count of non-disclosed (usable) rounds in the hoard
 * @property {Map<string, import('../../js/core/types.js').ActionDef[]>} availableActions
 * @property {WorldMission} mission
 * @property {string} gamePhase
 * @property {Set<string>} failedNodes — nodes where auto-burn stalled without cracking
 * @property {Set<string>} completedActions — "nodeId:actionId" pairs already completed
 * @property {Set<string>} iceCooldown — node IDs recently interrupted by ICE
 * @property {(fromId: string, toId: string) => string[]|null} shortestPath
 */

/**
 * @typedef {Object} ScoredAction
 * @property {string} action — action ID
 * @property {string|null} nodeId — target node (null for global actions)
 * @property {number} score
 * @property {string} reason — human-readable explanation
 * @property {string} [strategy] — which heuristic produced this
 * @property {Object} [payload] — extra data (e.g. { packId })
 */

/**
 * @callback Strategy
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */

/**
 * @typedef {Object} BotRunStats
 * @property {boolean} success
 * @property {string|null} failReason
 * @property {number} ticksElapsed
 * @property {number} nodesOwned
 * @property {number} nodesTotal
 * @property {number} autoBurns
 * @property {number} storeVisits
 * @property {number} cashSpent
 * @property {number} cashRemaining
 * @property {string} peakAlert
 * @property {boolean} traceFired
 * @property {number} iceDetections
 * @property {number} iceEvasions
 * @property {number} disarmActionsUsed
 * @property {number} mineAttempts
 * @property {number} mineResolved
 * @property {number} mineRounds
 * @property {Record<string, number>} strategyCounts
 * @property {number} roundsFired — coherence rounds fired across all auto-burn bursts this run
 * @property {number} heatGenerated — total heat added to the system this run (Dampener halves per-shot)
 */
