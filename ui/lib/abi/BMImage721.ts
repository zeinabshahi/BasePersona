export const bmImage721Abi = [
  {"type":"function","name":"claim","stateMutability":"payable","inputs":[
    {"name":"c","type":"tuple","components":[
      {"name":"to","type":"address"},
      {"name":"tokenURI","type":"string"},
      {"name":"imageHash","type":"bytes32"},
      {"name":"deadline","type":"uint256"},
      {"name":"nonce","type":"uint256"}
    ]},
    {"name":"signature","type":"bytes"}
  ],"outputs":[{"name":"tokenId","type":"uint256"}]},
  {"type":"function","name":"nonces","stateMutability":"view","inputs":[{"name":"user","type":"address"}],"outputs":[{"type":"uint256"}]},
  {"type":"function","name":"mintFeeWei","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}]}
] as const
