import { writable, derived, readable } from "svelte/store";

export const ipfsNode = writable(0);
export const nodeId = writable(0);
export const nodeAgentVersion = writable(0);
export const nodeProtocolVersion = writable(0);
export const rootHash = writable(0);
