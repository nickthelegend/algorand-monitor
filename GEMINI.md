const response = await indexerClient
      .lookupAccountCreatedAssets(addr)
      .do();

    const assets = response['created-assets'] || response.assets || [];
    console.log(`Total assets created by ${addr}:`, assets.length);


    {
  "assets": [
    {
      "created-at-round": 46616570,
      "deleted": false,
      "index": 2724542844,
      "params": {
        "clawback": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
        "creator": "GONHNV3XMSPTGZITI4PXUZGCMIELXHVADCJQPZKVCTXDNJZVIYDIEGKPHU",
        "decimals": 0,
        "default-frozen": false,
        "freeze": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
        "manager": "GONHNV3XMSPTGZITI4PXUZGCMIELXHVADCJQPZKVCTXDNJZVIYDIEGKPHU",
        "name": "GONNA 1",
        "name-b64": "R09OTkEgMQ==",
        "reserve": "V3L7FMKTZFJVM2FIJCVLEOJAZHEWFGJRJ3YZHB66BTA6FW5JWL57LCCH3I",
        "total": 1,
        "unit-name": "GONNA1",
        "unit-name-b64": "R09OTkEx",
        "url": "template-ipfs://{ipfscid:1:raw:reserve:sha2-256}",
        "url-b64": "dGVtcGxhdGUtaXBmczovL3tpcGZzY2lkOjE6cmF3OnJlc2VydmU6c2hhMi0yNTZ9"
      }
    },
    {
      "created-at-round": 46616570,
      "deleted": false,
      "index": 2724542846,
      "params": {
        "clawback": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
        "creator": "GONHNV3XMSPTGZITI4PXUZGCMIELXHVADCJQPZKVCTXDNJZVIYDIEGKPHU",
        "decimals": 0,
        "default-frozen": false,
        "freeze": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
        "manager": "GONHNV3XMSPTGZITI4PXUZGCMIELXHVADCJQPZKVCTXDNJZVIYDIEGKPHU",
        "name": "GONNA 2",
        "name-b64": "R09OTkEgMg==",
        "reserve": "OKS6QGBHYLCCMQLMG7UENYLM3HQUVWQKE6GR72I47SIJ47UGUO7UMREUUI",
        "total": 1,
        "unit-name": "GONNA2",
        "unit-name-b64": "R09OTkEy",
        "url": "template-ipfs://{ipfscid:1:raw:reserve:sha2-256}",
        "url-b64": "dGVtcGxhdGUtaXBmczovL3tpcGZzY2lkOjE6cmF3OnJlc2VydmU6c2hhMi0yNTZ9"
      }
    },
    {
      "created-at-round": 46616570,
      "deleted": false,
      "index": 2724542848,
      "params": {
        "clawback": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
        "creator": "GONHNV3XMSPTGZITI4PXUZGCMIELXHVADCJQPZKVCTXDNJZVIYDIEGKPHU",
        "decimals": 0,
        "default-frozen": false,
        "freeze": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
        "manager": "GONHNV3XMSPTGZITI4PXUZGCMIELXHVADCJQPZKVCTXDNJZVIYDIEGKPHU",
        "name": "GONNA 3",
        "name-b64": "R09OTkEgMw==",
        "reserve": "WYGMA2GWHQPU7UEPZCQOEGN6VILQDCNC27IWK3KKRGM7KUVMUT7Q3DN3WU",
        "total": 1,
        "unit-name": "GONNA3",
        "unit-name-b64": "R09OTkEz",
        "url": "template-ipfs://{ipfscid:1:raw:reserve:sha2-256}",
        "url-b64": "dGVtcGxhdGUtaXBmczovL3tpcGZzY2lkOjE6cmF3OnJlc2VydmU6c2hhMi0yNTZ9"
      }
    },
    ...
  ],
  "current-round": 51606450,
  "next-token": "2740817906"
}

this is an example output

just list them in the asset output

