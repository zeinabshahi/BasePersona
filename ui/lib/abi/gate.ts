// D:\project\persona\ui\lib\abi\gate.ts
export const gateAbi = [
  { type: "function", name: "genFeeWei",        stateMutability: "view",    inputs: [],                        outputs: [{ type: "uint256" }] },
  { type: "function", name: "dailyCap",         stateMutability: "view",    inputs: [],                        outputs: [{ type: "uint256" }] },
  { type: "function", name: "remainingToday",   stateMutability: "view",    inputs: [{ name:"user", type:"address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "payGenerate",      stateMutability: "payable", inputs: [],                        outputs: [] }
] as const;
