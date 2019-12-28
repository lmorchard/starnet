import { RootNode } from "./base.js";
import * as Devices from "./devices.js";

export class BuildingNode extends RootNode {}
export class LANNode extends RootNode {}

const BasicLAN = (
  children = [],
  firewallCls = Devices.Firewall,
  switchCls = Devices.Switch
) => [
  {
    class: firewallCls,
    children: [
      {
        class: switchCls,
        children
      }
    ]
  }
];

const CommonApartmentDevices = [
  { class: Devices.Refrigerator },
  { class: Devices.Microwave },
  { class: Devices.Thermostat },
  { class: Devices.FileServer, min: -3, max: 1 }
];

export class FamilyApartment extends LANNode {
  childMap() {
    return BasicLAN([
      { class: Devices.Television, min: 1, max: 3 },
      { class: Devices.BabyMonitor, min: -2, max: 2 },
      { class: Devices.GameConsole, min: -1, max: 2 },
      ...CommonApartmentDevices
    ]);
  }
}

export class BachelorApartment extends LANNode {
  childMap() {
    return BasicLAN([
      { class: Devices.Television, min: 1, max: 3 },
      { class: Devices.GameConsole, min: 1, max: 3 },
      ...CommonApartmentDevices
    ]);
  }
}

export class HackerApartment extends LANNode {
  childMap() {
    return BasicLAN([
      { class: Devices.Deck },
      { class: Devices.Television, min: -1, max: 1 },
      { class: Devices.GameConsole, min: -1, max: 1 },
      ...CommonApartmentDevices
    ]);
  }
}

export class ApartmentBuilding extends BuildingNode {
  childMap() {
    return BasicLAN([
      { class: HackerApartment, min: -10, max: 2 },
      { class: FamilyApartment, min: 1, max: 7 },
      { class: BachelorApartment, min: 1, max: 7 }
    ]);
  }
}
