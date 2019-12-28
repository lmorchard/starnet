import { BaseNode, ContainerNode } from "./base.js";

export class Gateway extends ContainerNode {}
export class Firewall extends ContainerNode {}
export class Switch extends ContainerNode {}

export class Device extends BaseNode {}

export class Deck extends Device {}
export class Television extends Device {}
export class Refrigerator extends Device {}
export class Microwave extends Device {}
export class Thermostat extends Device {}
export class GameConsole extends Device {}
export class BabyMonitor extends Device {}
export class PowerMeter extends Device {}
export class WaterHeater extends Device {}
export class FileServer extends Device {}
