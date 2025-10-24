// ABI for BMStreak1155 (Base Mainnet)
// Matches: bm(uint8), getUser(address) -> (lastDay,currentStreak,longestStreak,total),
// claimBadge(uint256), balanceOf(address,uint256), uri(uint256), bmFeeWei()
export const gmStreak1155Abi = [
  { "type":"function", "name":"bm", "stateMutability":"payable", "inputs":[ { "name":"reaction", "type":"uint8" } ], "outputs":[] },
  { "type":"function", "name":"getUser", "stateMutability":"view", "inputs":[ { "name":"a", "type":"address" } ],
    "outputs":[ { "name":"lastDay", "type":"uint32" }, { "name":"currentStreak", "type":"uint32" }, { "name":"longestStreak", "type":"uint32" }, { "name":"total", "type":"uint64" } ]
  },
  { "type":"function", "name":"claimBadge", "stateMutability":"nonpayable", "inputs":[ { "name":"badgeId", "type":"uint256" } ], "outputs":[] },
  { "type":"function", "name":"balanceOf", "stateMutability":"view", "inputs":[ { "name":"account", "type":"address" }, { "name":"id", "type":"uint256" } ], "outputs":[ { "type":"uint256" } ] },
  { "type":"function", "name":"uri", "stateMutability":"view", "inputs":[ { "name":"id", "type":"uint256" } ], "outputs":[ { "type":"string" } ] },
  { "type":"function", "name":"bmFeeWei", "stateMutability":"view", "inputs":[ ], "outputs":[ { "type":"uint256" } ] }
] as const;