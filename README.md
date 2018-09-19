# Bitquery

Query BitDB

Bitquery is a JavaScript library that lets you query a BitDB node.

# Install

```
npm install --save bitquery
```

# Usage

First initialize, and use the returned db object to make the query. 


```
var bitquery = require('bitquery')
var bql = {
  "request": {
    "encoding": {
      "output.b0": "hex"
    },
    "find": {
      "output.b0": "6d02"
    },
    "sort": {
      "output.b1": 1
    },
    "limit": 50
  },
  "response": {
    "encoding": {
      "output.b0": "hex",
      "output.b1": "utf8",
      "output.b2": "hex"
    }
  }
}
bitquery.init().then(function(db) {
  db.read(bql).then(function(response) {
    console.log("Response = ", response)
  })
})
```

> Note: By default, bitquery connects to `mongodb://localhost:27017` so you don't need to configure anything if you set up BitDB without changing anything.

# BitDB Query Language

BitDB Query Language is a meta query language that builds on top of MongoDB query language, which means it supports 100% of all MongoDB operations.

Learn more here: ___

# Configuration

You can set the following two options:

1. **url:** BitDB Node URL
2. **timeout:** Request timeout

## 1. url

Select the BitDB URL to connect to. 

```
bitquery.init({
  url: "mongodb://localhost:27017"
}).then(function(db) {
  ...
})
```

## 2. timeout

Set request timeout in milliseconds. All BitDB requests will time out after this duration.

```
var init = async function() {
  let db = await bitquery.init({
    timeout: 20000
  })
}
```
